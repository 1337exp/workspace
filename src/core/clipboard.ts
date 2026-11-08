import type { Registry } from './registry';
import { parse, serialize } from './serialize';
import type { NodeInstance, Workspace } from './types';
import { carriedBy } from './workspace';
import { uid } from '@1337exp/taoux/ids';
import { nodesBounds } from './bounds';

/**
 * Буфер обмена. Скопированные ноды лежат в системном буфере обычным текстом в том же формате, что и файл
 * `workspace.json`: так вставка работает между вкладками и окнами, текст читается глазами, а проверка, миграции данных
 * и отбрасывание битых связей уже есть в `parse`. Вставка принимает и чужой текст: что с ним делать (ссылка или текст),
 * решает редактор.
 *
 * The clipboard. Copied nodes go to the system clipboard as plain text in the same format as the `workspace.json` file:
 * so pasting works between tabs and windows, the text is readable, and the checking, the data migrations and the
 * dropping of broken links are already in `parse`. Paste accepts somebody else's text too: what to do with it (a link or
 * a text) is up to the editor.
 */

/** Больше этого в буфере не разбираем: это не наше. / Anything bigger is not ours and is not parsed. */
export const MAX_CLIPBOARD_CHARS = 2_000_000;
/** Длиннее этого текст в ноду не превращаем. / Longer text is not turned into a node. */
export const MAX_TEXT_NODE_CHARS = 10_000;

/**
 * Текст для буфера: выбранные ноды, всё, что лежит внутри выбранных групп, и связи между этими нодами. Пусто, если
 * копировать нечего.
 * Text for the clipboard: the picked nodes, everything inside the picked groups, and the links between those nodes.
 * `null` if there is nothing to copy.
 */
export function copyText(ws: Workspace, registry: Registry, ids: Iterable<string>): string | null {
    const picked = [...ids].filter((id) => ws.nodes[id]);
    if (picked.length === 0) return null;

    const all = new Set([...picked, ...carriedBy(ws, registry, picked)]);
    const part: Workspace = { nodes: {}, connections: [] };
    // По порядку отрисовки: после вставки кто над кем останется тем же.
    for (const id of Object.keys(ws.nodes)) if (all.has(id)) part.nodes[id] = ws.nodes[id]!;
    part.connections = ws.connections.filter((c) => all.has(c.from.node) && all.has(c.to.node));
    return serialize(part, undefined, false);
}

/** Что оказалось в буфере. / What was found in the clipboard. */
export type ClipboardContent = { kind: 'nodes'; workspace: Workspace } | { kind: 'text'; text: string };

/** Разбирает текст буфера; `null`, если там пусто или слишком много. / Parses the clipboard text; null if empty or too big. */
export function readClipboard(text: string, registry: Registry): ClipboardContent | null {
    if (text.trim() === '' || text.length > MAX_CLIPBOARD_CHARS) return null;

    const parsed = parse(text, registry);
    if (parsed.ok) return Object.keys(parsed.workspace.nodes).length ? { kind: 'nodes', workspace: parsed.workspace } : null;

    return text.length <= MAX_TEXT_NODE_CHARS ? { kind: 'text', text: text.replace(/\r\n/g, '\n').trim() } : null;
}

/**
 * Вставляет ноды из `source` с новыми id, сдвинув на (`dx`, `dy`); связи между ними переносятся. Копии ложатся сверху.
 * Возвращает вставленные ноды. Вложенные в группу тоже возвращаются: выделять стоит всё вставленное.
 * Inserts the nodes of `source` with new ids, shifted by (`dx`, `dy`); the links between them come along. The copies go
 * on top. Returns the inserted nodes (those inside a group too: everything pasted is worth selecting).
 */
export function insertNodes(ws: Workspace, source: Workspace, dx: number, dy: number): NodeInstance[] {
    const map = new Map<string, string>();
    const created: NodeInstance[] = [];

    for (const src of Object.values(source.nodes)) {
        const copy: NodeInstance = {
            ...src,
            id: uid('n', (id) => id in ws.nodes),
            x: src.x + dx,
            y: src.y + dy,
            data: JSON.parse(JSON.stringify(src.data)) as NodeInstance['data'],
        };
        ws.nodes[copy.id] = copy;
        map.set(src.id, copy.id);
        created.push(copy);
    }

    // Состав переносится, если контейнер вставлен вместе с нодой; иначе нода вставляется сама по себе.
    for (const copy of created) {
        const p = copy.parent;
        if (p === undefined) continue;
        const mapped = map.get(p);
        if (mapped !== undefined) copy.parent = mapped;
        else delete copy.parent;
    }

    for (const c of source.connections) {
        const from = map.get(c.from.node);
        const to = map.get(c.to.node);
        if (from === undefined || to === undefined) continue;
        ws.connections.push({
            id: uid('c', (id) => ws.connections.some((k) => k.id === id)),
            from: { node: from, side: c.from.side },
            to: { node: to, side: c.to.side },
            arrow: c.arrow,
            ...(c.label !== undefined ? { label: c.label } : {}),
        });
    }
    return created;
}

/**
 * Куда сдвинуть вставляемое. С `at` (меню у курсора) центр вставляемого встаёт в эту точку. Без неё: если вставляемое
 * лежит в видимой области, оно ложится на прежнее место со сдвигом на 24 за каждую вставку подряд (чтобы копии не
 * слипались), иначе центром в центр видимой области.
 * Where to move what is pasted. With `at` (a menu at the cursor) the centre of it goes to that point. Without it: if it
 * lies in the visible area it goes to its old place shifted by 24 for each paste in a row (so copies do not pile up),
 * otherwise its centre goes to the centre of the visible area.
 */
export function pasteOffset(
    source: Workspace,
    visible: { x: number; y: number; w: number; h: number },
    repeat: number,
    at?: readonly [number, number],
): [number, number] {
    const box = nodesBounds(source);
    if (!box) return [0, 0];
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    if (at) return [at[0] - cx, at[1] - cy];

    const inView = box.x < visible.x + visible.w && box.x + box.w > visible.x && box.y < visible.y + visible.h && box.y + box.h > visible.y;
    if (inView) return [24 * (repeat + 1), 24 * (repeat + 1)];
    return [visible.x + visible.w / 2 - cx, visible.y + visible.h / 2 - cy];
}
