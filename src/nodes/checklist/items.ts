import { uid } from '@1337exp/taoux/ids';

/**
 * Пункт чеклиста. Вложенность плоская: у пункта есть `depth` (нет поля: 0), а его подпункты это идущие следом пункты
 * глубже. Так старые данные остаются верными, а перестановка, вставка и счёт это простые функции над массивом.
 * A checklist item. Nesting is flat: an item has a `depth` (no field: 0), and its subitems are the items that follow it
 * and are deeper. So old data stays valid, and reordering, inserting and counting are plain functions over an array.
 */
export interface ChecklistItem {
    id: string;
    text: string;
    done: boolean;
    depth?: number;
    /** Подпункты свёрнуты (скрыты, но на месте и в счёте). Имеет смысл только у пункта с подпунктами. */
    collapsed?: boolean;
}

// type, а не interface: у данных ноды должна быть индексная подпись (`NodeData`).
export type ChecklistData = {
    items: ChecklistItem[];
    /** Прятать выполненные пункты (они остаются в данных и считаются в счётчике). */
    hideDone?: boolean;
};

/** Насколько глубоко можно вкладывать: больше трёх уровней в заметке на холсте уже не читается. */
export const MAX_DEPTH = 3;

export const depthOf = (item: ChecklistItem) => item.depth ?? 0;

/** Свободный id пункта внутри этого списка. / A free item id inside this list. */
export const newId = (items: readonly ChecklistItem[]) => uid('i', (id) => items.some((i) => i.id === id));

export const emptyItem = (items: readonly ChecklistItem[]): ChecklistItem => ({ id: newId(items), text: '', done: false });

/** Где кончается поддерево пункта `index`: номер первого пункта после него. */
export function subtreeEnd(items: readonly ChecklistItem[], index: number): number {
    const d = depthOf(items[index]!);
    let j = index + 1;
    while (j < items.length && depthOf(items[j]!) > d) j++;
    return j;
}

const withDepth = (item: ChecklistItem, depth: number): ChecklistItem => {
    const { depth: _old, ...rest } = item;
    return depth > 0 ? { ...rest, depth } : rest;
};

/**
 * Приводит список к допустимому виду: глубина от 0 до `MAX_DEPTH`, первый пункт на нулевой глубине, каждый не глубже
 * предыдущего больше чем на единицу; пункт с подпунктами выполнен, только если выполнены все его подпункты. Вызывается после
 * любой правки структуры (и при чтении данных, написанных вручную или старой версией).
 * Brings a list to a valid shape: depth from 0 to `MAX_DEPTH`, the first item at depth 0, none deeper than the previous
 * one by more than one; an item with subitems is done only when all its subitems are. It runs after every structural edit
 * (and when reading data written by hand or by an older version).
 */
export function normalize(items: readonly ChecklistItem[]): ChecklistItem[] {
    let prev = -1;
    const out = items.map((item) => {
        const raw = Number.isFinite(item.depth) ? Math.round(item.depth!) : 0;
        const depth = Math.min(Math.max(raw, 0), MAX_DEPTH, prev + 1);
        prev = depth;
        return depth === depthOf(item) && (depth > 0 || item.depth === undefined) ? item : withDepth(item, depth);
    });

    // Свёрнутость нужна только родителям: у пункта без подпунктов её убираем.
    for (let i = 0; i < out.length; i++) {
        if (out[i]!.collapsed && !hasChildren(out, i)) {
            const { collapsed: _c, ...rest } = out[i]!;
            out[i] = rest;
        }
    }

    // С конца: к моменту, когда дошли до родителя, его подпункты уже окончательные.
    for (let i = out.length - 1; i >= 0; i--) {
        const d = depthOf(out[i]!);
        const kids: ChecklistItem[] = [];
        for (let j = i + 1; j < out.length && depthOf(out[j]!) > d; j++) if (depthOf(out[j]!) === d + 1) kids.push(out[j]!);
        if (kids.length > 0) {
            const done = kids.every((k) => k.done);
            if (out[i]!.done !== done) out[i] = { ...out[i]!, done };
        }
    }
    return out;
}

/** Есть ли у пункта подпункты. / Does the item have subitems. */
export function hasChildren (items: readonly ChecklistItem[], index: number): boolean {
    return index + 1 < items.length && depthOf(items[index + 1]!) > depthOf(items[index]!);
}

/** Индексы строк, которые видны: подпункты свёрнутого родителя скрыты (на любой глубине). */
export function visibleIndexes(items: readonly ChecklistItem[]): number[] {
    const out: number[] = [];
    for (let i = 0; i < items.length; i++) {
        out.push(i);
        if (items[i]!.collapsed) i = subtreeEnd(items, i) - 1;
    }
    return out;
}

/** Свернуть или развернуть подпункты. */
export function toggleCollapsed(items: readonly ChecklistItem[], id: string): ChecklistItem[] {
    return normalize(items.map((i, k) => (i.id === id && hasChildren(items, k) ? (i.collapsed ? withoutCollapsed(i) : { ...i, collapsed: true }) : i)));
}

function withoutCollapsed(item: ChecklistItem): ChecklistItem {
    const { collapsed: _c, ...rest } = item;
    return rest;
}

/** Не выполнен, но что-то из подпунктов выполнено: галочка «не до конца». */
export function isPartial(items: readonly ChecklistItem[], index: number): boolean {
    if (!hasChildren(items, index) || items[index]!.done) return false;
    const end = subtreeEnd(items, index);
    return items.slice(index + 1, end).some((i) => i.done);
}

/**
 * Вставляет пункт после `afterId` (или в конец). Если у пункта есть подпункты, новый встаёт первым подпунктом, иначе на
 * той же глубине. Возвращает новый список и вставленный пункт.
 * Inserts an item after `afterId` (or at the end). If that item has subitems, the new one becomes the first subitem,
 * otherwise it goes at the same depth. Returns the new list and the inserted item.
 */
export function insertItem(items: readonly ChecklistItem[], afterId: string | null, text = ''): { items: ChecklistItem[]; item: ChecklistItem } {
    const found = afterId === null ? -1 : items.findIndex((i) => i.id === afterId);
    // У развёрнутого родителя новый пункт становится первым подпунктом; у свёрнутого (подпункты не видны) встаёт после них.
    const folded = found >= 0 && !!items[found]!.collapsed && hasChildren(items, found);
    const at = found < 0 ? items.length : folded ? subtreeEnd(items, found) : found + 1;
    const depth = found < 0 ? 0 : depthOf(items[found]!) + (hasChildren(items, found) && !folded ? 1 : 0);
    const item = withDepth({ ...emptyItem(items), text }, depth);
    const next = [...items];
    next.splice(at, 0, item);
    return { items: normalize(next), item };
}

/** Сдвиг пункта с его поддеревом на `delta` уровней. `null`, если выйдет за допустимое. */
function shift(items: readonly ChecklistItem[], id: string, delta: 1 | -1): ChecklistItem[] | null {
    const i = items.findIndex((x) => x.id === id);
    if (i < 0) return null;
    const end = subtreeEnd(items, i);
    const block = items.slice(i, end);
    const deepest = Math.max(...block.map(depthOf));
    if (delta > 0 && (i === 0 || depthOf(items[i]!) + 1 > depthOf(items[i - 1]!) + 1 || deepest + 1 > MAX_DEPTH)) return null;
    if (delta < 0 && depthOf(items[i]!) === 0) return null;

    const next = [...items];
    for (let k = i; k < end; k++) next[k] = withDepth(items[k]!, depthOf(items[k]!) + delta);
    // Вложенный пункт не должен исчезнуть: вся цепочка его новых родителей разворачивается.
    if (delta > 0) {
        let want = depthOf(next[i]!) - 1;
        for (let k = i - 1; k >= 0 && want >= 0; k--) {
            if (depthOf(next[k]!) !== want) continue;
            if (next[k]!.collapsed) next[k] = withoutCollapsed(next[k]!);
            want--;
        }
    }
    return normalize(next);
}

/** Вложить пункт (Tab): становится подпунктом предыдущего вместе со своими подпунктами. `null`, если нельзя. */
export const indent = (items: readonly ChecklistItem[], id: string) => shift(items, id, 1);

/** Вынести пункт (Shift+Tab) на уровень выше вместе с подпунктами. `null`, если он уже на нулевом. */
export const outdent = (items: readonly ChecklistItem[], id: string) => shift(items, id, -1);

/** Отметить пункт и всё его поддерево; родитель выведет свою отметку из подпунктов. */
export function setDone(items: readonly ChecklistItem[], id: string, done: boolean): ChecklistItem[] {
    const i = items.findIndex((x) => x.id === id);
    if (i < 0) return [...items];
    const end = subtreeEnd(items, i);
    return normalize(items.map((item, k) => (k >= i && k < end ? { ...item, done } : item)));
}

/** Строка вставки: уровень отступа, текст без маркера списка и отметка `[x]`. */
function readLine(raw: string): { level: number; text: string; done: boolean } | null {
    const lead = /^[\t ]*/.exec(raw)![0];
    const tabs = (lead.match(/\t/g) ?? []).length;
    const level = tabs + Math.floor((lead.length - tabs) / 2);
    const body = raw.slice(lead.length).trimEnd();
    const m = /^(?:[-*•]\s+)?(?:\[([ xX])\]\s+)?([\s\S]*)$/.exec(body)!;
    const text = (m[2] ?? '').trim();
    return text === '' ? null : { level, text, done: m[1] === 'x' || m[1] === 'X' };
}

/**
 * Вставка многострочного текста: первая строка идёт в пункт `id`, остальные становятся новыми пунктами под ним (после его
 * поддерева). Отступы строк (табы или по два пробела) задают вложенность относительно первой строки, маркеры списка
 * (`-`, `*`, `•`) и `[ ]` / `[x]` понимаются. Одна строка не в счёт (null): её вставит само поле.
 * Pasting multi-line text: the first line goes into item `id`, the rest become new items under it (after its subtree).
 * Indentation (tabs or two spaces) sets the nesting relative to the first line, list markers (`-`, `*`, `•`) and
 * `[ ]` / `[x]` are understood. A single line does not count (null): the field pastes it itself.
 */
export function pasteLines(items: readonly ChecklistItem[], id: string, text: string): { items: ChecklistItem[]; focus: string } | null {
    const lines = text
        .split(/\r?\n/)
        .map(readLine)
        .filter((l): l is NonNullable<typeof l> => l !== null);
    if (lines.length < 2) return null;

    const at = items.findIndex((i) => i.id === id);
    if (at < 0) return null;
    const base = depthOf(items[at]!);
    const level0 = lines[0]!.level;

    let next = items.map((i) => (i.id === id ? { ...i, text: lines[0]!.text, done: lines[0]!.done || i.done } : i));
    let place = subtreeEnd(next, at);
    let last = id;
    for (const line of lines.slice(1)) {
        const item = withDepth({ ...emptyItem(next), text: line.text, done: line.done }, base + Math.max(0, line.level - level0));
        next = [...next.slice(0, place), item, ...next.slice(place)];
        place++;
        last = item.id;
    }
    return { items: normalize(next), focus: last };
}

/**
 * Убирает пункт; его подпункты поднимаются на уровень. Последний оставшийся пункт только очищается: список без пунктов
 * нечем править.
 * Removes an item; its subitems rise a level. The last remaining item is only cleared: a list with no items has nothing to edit.
 */
export function removeItem(items: readonly ChecklistItem[], id: string): ChecklistItem[] {
    if (items.length <= 1) return items.map((i) => ({ id: i.id, text: '', done: false }));
    const i = items.findIndex((x) => x.id === id);
    if (i < 0) return [...items];

    const end = subtreeEnd(items, i);
    const next = items.map((item, k) => (k > i && k < end ? withDepth(item, depthOf(item) - 1) : item));
    next.splice(i, 1);
    return normalize(next);
}

/**
 * Перестановка по номерам в видимом списке. Пункт едет вместе со своим поддеревом. Видимый список может быть короче
 * полного (выполненные спрятаны), поэтому `from` и `to` переводятся в места полного списка по id. Вниз пункт встаёт после
 * поддерева целевого, вверх перед целевым, и берёт его глубину; на своё поддерево перетащить нельзя (ничего не меняется).
 * Reordering by positions in the visible list. An item travels with its subtree. The visible list may be shorter than the
 * full one (completed items are hidden), so `from` and `to` are turned into places of the full list by id. Down, the item
 * lands after the subtree of the target, up, before the target, and takes its depth; it cannot be dropped onto its own
 * subtree (nothing changes).
 */
export function reorder(items: readonly ChecklistItem[], shown: readonly ChecklistItem[], from: number, to: number): ChecklistItem[] {
    const a = shown[from];
    const b = shown[to];
    if (!a || !b || a.id === b.id) return [...items];

    const ia = items.findIndex((i) => i.id === a.id);
    const ib = items.findIndex((i) => i.id === b.id);
    if (ia < 0 || ib < 0) return [...items];

    const endA = subtreeEnd(items, ia);
    if (ib > ia && ib < endA) return [...items];

    const block = items.slice(ia, endA);
    const rest = [...items.slice(0, ia), ...items.slice(endA)];
    const insertAt = ib > ia ? subtreeEnd(items, ib) - block.length : ib;
    const delta = depthOf(b) - depthOf(a);
    rest.splice(insertAt, 0, ...block.map((i) => withDepth(i, depthOf(i) + delta)));
    return normalize(rest);
}

/**
 * Сколько сделано: считаются только пункты без подпунктов (родитель выведен из них, и считать его значило бы считать
 * дважды).
 * How much is done: only items without subitems count (a parent is derived from them, and counting it would count twice).
 */
export function progress(items: readonly ChecklistItem[]) {
    const leaves = items.filter((_, i) => !hasChildren(items, i));
    return { done: leaves.filter((i) => i.done).length, total: leaves.length };
}
