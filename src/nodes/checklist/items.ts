import { uid } from '@1337exp/taoux/ids';
import { moveItem } from '@1337exp/taoux/sortable';

/** Пункт чеклиста. / A checklist item. */
export interface ChecklistItem {
    id: string;
    text: string;
    done: boolean;
}

// type, а не interface: у данных ноды должна быть индексная подпись (`NodeData`).
export type ChecklistData = {
    items: ChecklistItem[];
    /** Прятать выполненные пункты (они остаются в данных и считаются в счётчике). */
    hideDone?: boolean;
};

/** Свободный id пункта внутри этого списка. / A free item id inside this list. */
export const newId = (items: readonly ChecklistItem[]) => uid('i', (id) => items.some((i) => i.id === id));

export const emptyItem = (items: readonly ChecklistItem[]): ChecklistItem => ({ id: newId(items), text: '', done: false });

/**
 * Список в том виде, в каком он показывается и пишется: только `id`, `text`, `done`. Лишние поля выбрасываются. Так читаются
 * сохранения, где у пунктов была вложенность (`depth`, `collapsed`) из версии, которую мы убрали: все пункты ложатся на
 * один уровень в прежнем порядке, ничего не пропадает.
 * The list as it is shown and written: only `id`, `text`, `done`. Extra fields are dropped. So saves where items had
 * nesting (`depth`, `collapsed`) from a version we removed are read as they are: every item goes on one level in the same
 * order, nothing is lost.
 */
export function flatten(items: readonly ChecklistItem[]): ChecklistItem[] {
    return items.map((i) => ('depth' in i || 'collapsed' in i ? { id: i.id, text: i.text, done: i.done } : i));
}

/** Вставляет пункт после `afterId` (или в конец). Возвращает новый список и вставленный пункт. */
export function insertItem(items: readonly ChecklistItem[], afterId: string | null, text = ''): { items: ChecklistItem[]; item: ChecklistItem } {
    const item = { ...emptyItem(items), text };
    const found = afterId === null ? -1 : items.findIndex((i) => i.id === afterId);
    const at = found < 0 ? items.length : found + 1;
    const next = [...items];
    next.splice(at, 0, item);
    return { items: next, item };
}

/** Строка вставки: текст без маркера списка (`-`, `*`, `•`) и отметка `[x]` / `[ ]`; пустая строка это null. */
function readLine(raw: string): { text: string; done: boolean } | null {
    const m = /^(?:[-*•]\s+)?(?:\[([ xX])\]\s+)?([\s\S]*)$/.exec(raw.trim())!;
    const text = (m[2] ?? '').trim();
    return text === '' ? null : { text, done: m[1] === 'x' || m[1] === 'X' };
}

/**
 * Вставка многострочного текста: первая строка идёт в пункт `id`, остальные становятся новыми пунктами под ним. Маркеры
 * списка (`-`, `*`, `•`) и `[ ]` / `[x]` понимаются, отступы игнорируются (вложенности нет). Одна строка не в счёт (null):
 * её вставит само поле.
 * Pasting multi-line text: the first line goes into item `id`, the rest become new items under it. List markers (`-`,
 * `*`, `•`) and `[ ]` / `[x]` are understood, indentation is ignored (there is no nesting). A single line does not count
 * (null): the field pastes it itself.
 */
export function pasteLines(items: readonly ChecklistItem[], id: string, text: string): { items: ChecklistItem[]; focus: string } | null {
    const lines = text
        .split(/\r?\n/)
        .map(readLine)
        .filter((l): l is NonNullable<typeof l> => l !== null);
    if (lines.length < 2) return null;

    const at = items.findIndex((i) => i.id === id);
    if (at < 0) return null;

    let next = items.map((i) => (i.id === id ? { ...i, text: lines[0]!.text, done: lines[0]!.done || i.done } : i));
    let last = id;
    let place = at + 1;
    for (const line of lines.slice(1)) {
        const item = { ...emptyItem(next), text: line.text, done: line.done };
        next = [...next.slice(0, place), item, ...next.slice(place)];
        place++;
        last = item.id;
    }
    return { items: next, focus: last };
}

/** Убирает пункт; последний оставшийся только очищается: список без пунктов нечем править. */
export function removeItem(items: readonly ChecklistItem[], id: string): ChecklistItem[] {
    if (items.length <= 1) return items.map((i) => ({ ...i, text: '', done: false }));
    return items.filter((i) => i.id !== id);
}

/**
 * Перестановка по номерам в видимом списке. Видимый список может быть короче полного (выполненные спрятаны), поэтому
 * номера `from` и `to` переводятся в места в полном списке по id: пункт встаёт на место того, на чьё место его тащили,
 * а спрятанные пункты остаются при своих соседях.
 * Reordering by positions in the visible list. The visible list may be shorter than the full one (completed items are
 * hidden), so `from` and `to` are turned into places of the full list by id: the item takes the place of the one it was
 * dragged to, and hidden items stay with their neighbours.
 */
export function reorder(items: readonly ChecklistItem[], shown: readonly ChecklistItem[], from: number, to: number): ChecklistItem[] {
    const a = shown[from]?.id;
    const b = shown[to]?.id;
    if (a === undefined || b === undefined || a === b) return [...items];
    // Итоговое место равно прежнему месту целевого пункта: и вниз (встаёт после него), и вверх (встаёт перед ним).
    return moveItem(
        items,
        items.findIndex((i) => i.id === a),
        items.findIndex((i) => i.id === b),
    );
}

export const progress = (items: readonly ChecklistItem[]) => ({
    done: items.filter((i) => i.done).length,
    total: items.length,
});
