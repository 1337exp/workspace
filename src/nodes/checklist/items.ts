import { uid } from '@1337exp/taoux/ids';

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

/** Вставляет пункт после `afterId` (или в конец). Возвращает новый список и вставленный пункт. */
export function insertItem(items: readonly ChecklistItem[], afterId: string | null, text = ''): { items: ChecklistItem[]; item: ChecklistItem } {
    const item = { ...emptyItem(items), text };
    const found = afterId === null ? -1 : items.findIndex((i) => i.id === afterId);
    const at = found < 0 ? items.length : found + 1;
    const next = [...items];
    next.splice(at, 0, item);
    return { items: next, item };
}

/**
 * Вставка многострочного текста: первая строка идёт в пункт `id`, остальные становятся новыми пунктами под ним.
 * Одна строка не в счёт (null): её вставит само поле.
 * Pasting multi-line text: the first line goes into item `id`, the rest become new items under it. A single line
 * does not count (null): the field pastes it itself.
 */
export function pasteLines(items: readonly ChecklistItem[], id: string, text: string): { items: ChecklistItem[]; focus: string } | null {
    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l !== '');
    if (lines.length < 2) return null;

    let next = items.map((i) => (i.id === id ? { ...i, text: lines[0]! } : i));
    let last = id;
    for (const line of lines.slice(1)) {
        const r = insertItem(next, last, line);
        next = r.items;
        last = r.item.id;
    }
    return { items: next, focus: last };
}

/** Убирает пункт; последний оставшийся только очищается: список без пунктов нечем править. */
export function removeItem(items: readonly ChecklistItem[], id: string): ChecklistItem[] {
    if (items.length <= 1) return items.map((i) => ({ ...i, text: '', done: false }));
    return items.filter((i) => i.id !== id);
}

export const progress = (items: readonly ChecklistItem[]) => ({
    done: items.filter((i) => i.done).length,
    total: items.length,
});
