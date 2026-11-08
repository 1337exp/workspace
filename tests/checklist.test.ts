import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { emptyItem, flatten, insertItem, newId, pasteLines, progress, removeItem, reorder, type ChecklistItem } from '@/nodes/checklist/items';
import { useEditor } from '@/editor/store';
import { parse, serialize } from '@/core/serialize';

const item = (id: string, text = '', done = false): ChecklistItem => ({ id, text, done });

describe('пункты чеклиста', () => {
    it('id пункта не повторяет занятые', () => {
        const items = [item('i1'), item('i2')];
        const id = newId(items);
        expect(items.some((i) => i.id === id)).toBe(false);
        expect(emptyItem(items).done).toBe(false);
    });

    it('insertItem вставляет после нужного пункта или в конец', () => {
        const items = [item('a', 'a'), item('b', 'b')];
        const mid = insertItem(items, 'a', 'x');
        expect(mid.items.map((i) => i.text)).toEqual(['a', 'x', 'b']);
        expect(mid.item.text).toBe('x');

        expect(insertItem(items, null).items.map((i) => i.text)).toEqual(['a', 'b', '']);
        expect(insertItem(items, 'нет такого').items).toHaveLength(3); // неизвестный id: в конец
        expect(items).toHaveLength(2); // исходный список не тронут
    });

    it('pasteLines: первая строка в текущий пункт, остальные пунктами под ним; одна строка не считается', () => {
        const items = [item('a', ''), item('b', 'b')];
        const r = pasteLines(items, 'a', 'молоко\r\n\r\n хлеб \nяйца')!;
        expect(r.items.map((i) => i.text)).toEqual(['молоко', 'хлеб', 'яйца', 'b']);
        expect(r.items.find((i) => i.id === r.focus)!.text).toBe('яйца');
        expect(new Set(r.items.map((i) => i.id)).size).toBe(4);

        expect(pasteLines(items, 'a', 'одна строка')).toBeNull();
        expect(pasteLines(items, 'a', '\n  \n')).toBeNull();
    });

    it('removeItem убирает пункт, а последний только очищает', () => {
        expect(removeItem([item('a'), item('b')], 'a').map((i) => i.id)).toEqual(['b']);
        expect(removeItem([item('a', 'текст', true)], 'a')).toEqual([item('a', '', false)]);
    });

    it('progress считает выполненные', () => {
        expect(progress([item('a', '', true), item('b'), item('c', '', true)])).toEqual({ done: 2, total: 3 });
        expect(progress([])).toEqual({ done: 0, total: 0 });
    });
});

describe('нода «Чеклист» и переключатели типов нод', () => {
    beforeEach(() => setActivePinia(createPinia()));

    function setup() {
        const editor = useEditor();
        editor.loadWorkspace({ nodes: {}, connections: [] }, undefined, true);
        return editor;
    }

    it('новая нода с одним пустым пунктом и клавишей L', () => {
        const editor = setup();
        const n = editor.addNodeAtCenter('checklist');
        const items = n.data.items as ChecklistItem[];
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({ text: '', done: false });
        expect(editor.registry.get('checklist').hotkey).toBe('L');
    });

    it('«Скрыть выполненные» видно только когда выделен чеклист, и оно включается у всех выделенных', () => {
        const editor = setup();
        const a = editor.addNodeAtCenter('checklist');
        expect(editor.nodeActions.map((x) => x.id)).toEqual(['hideDone']);
        expect(editor.nodeActions[0]).toMatchObject({ type: 'checklist', checked: false });

        const b = editor.addNodeAtCenter('checklist');
        editor.setSelection([a.id, b.id]);
        editor.runNodeAction('hideDone');
        expect(editor.workspace.nodes[a.id]!.data.hideDone).toBe(true);
        expect(editor.workspace.nodes[b.id]!.data.hideDone).toBe(true);
        expect(editor.nodeActions[0]!.checked).toBe(true);

        editor.runNodeAction('hideDone');
        expect(editor.workspace.nodes[a.id]!.data.hideDone).toBe(false);
    });

    it('если включено не у всех, нажатие включает у всех; смесь типов переключателей не показывает', () => {
        const editor = setup();
        const a = editor.addNodeAtCenter('checklist');
        const b = editor.addNodeAtCenter('checklist');
        editor.workspace.nodes[a.id]!.data.hideDone = true;
        editor.setSelection([a.id, b.id]);
        expect(editor.nodeActions[0]!.checked).toBe(false);
        editor.runNodeAction('hideDone');
        expect(editor.workspace.nodes[b.id]!.data.hideDone).toBe(true);

        const t = editor.addNodeAtCenter('text');
        editor.setSelection([a.id, t.id]);
        expect(editor.nodeActions).toEqual([]);
        editor.setSelection([]);
        expect(editor.nodeActions).toEqual([]);
    });

    it('у текста переключатель «Крупный текст» и откат одним шагом', () => {
        const editor = setup();
        const t = editor.addNodeAtCenter('text');
        expect(editor.nodeActions.map((x) => x.id)).toEqual(['large']);
        editor.runNodeAction('large');
        expect(editor.workspace.nodes[t.id]!.data.large).toBe(true);
        editor.undo();
        expect(editor.workspace.nodes[t.id]!.data.large).toBeFalsy();
    });

    it('чеклист переживает сохранение и чтение', () => {
        const editor = setup();
        const n = editor.addNodeAtCenter('checklist');
        editor.patchData(n.id, { items: [item('i1', 'молоко', true), item('i2', 'хлеб')], hideDone: true });

        const back = parse(serialize(editor.workspace), editor.registry);
        expect(back.ok).toBe(true);
        if (back.ok) expect(back.workspace.nodes[n.id]!.data).toMatchObject({ hideDone: true, items: [{ text: 'молоко', done: true }, { text: 'хлеб' }] });
    });
});

describe('перестановка пунктов', () => {
    const list = [item('a', 'a'), item('b', 'b'), item('c', 'c'), item('d', 'd')];
    const ids = (items: ChecklistItem[]) => items.map((i) => i.id).join('');

    it('вниз встаёт после целевого, вверх перед ним', () => {
        expect(ids(reorder(list, list, 0, 2))).toBe('bcad');
        expect(ids(reorder(list, list, 3, 1))).toBe('adbc');
        expect(ids(reorder(list, list, 1, 1))).toBe('abcd');
    });

    it('при спрятанных выполненных номера видимого списка переводятся в полный, спрятанные остаются при соседях', () => {
        // b и c выполнены и спрятаны; видно a, d
        const full = [item('a'), item('b', '', true), item('c', '', true), item('d')];
        const shown = full.filter((i) => !i.done);
        expect(ids(reorder(full, shown, 0, 1))).toBe('bcda'); // a встал после d
        expect(ids(reorder(full, shown, 1, 0))).toBe('dabc'); // d встал перед a
    });

    it('неверные номера список не меняют, исходный не трогается', () => {
        expect(ids(reorder(list, list, 9, 0))).toBe('abcd');
        expect(ids(reorder(list, list, 0, 9))).toBe('abcd');
        expect(ids(list)).toBe('abcd');
    });
});

describe('плоский список: старые данные и вставка', () => {
    it('flatten выбрасывает вложенность прежней версии, порядок и отметки остаются; чистый список не копируется', () => {
        const legacy = [
            { id: 'a', text: 'родитель', done: true },
            { id: 'b', text: 'ребёнок', done: false, depth: 1 },
            { id: 'c', text: 'свёрнутый', done: false, depth: 2, collapsed: true },
        ] as unknown as ChecklistItem[];
        const flat = flatten(legacy);
        expect(flat).toEqual([
            { id: 'a', text: 'родитель', done: true },
            { id: 'b', text: 'ребёнок', done: false },
            { id: 'c', text: 'свёрнутый', done: false },
        ]);
        const clean = [item('x', 'x')];
        expect(flatten(clean)[0]).toBe(clean[0]); // без лишних полей тот же объект
    });

    it('вставка: маркеры списка и [x] понимаются, отступы игнорируются (вложенности нет)', () => {
        const r = pasteLines([item('a', '')], 'a', '- [ ] план\n\t- [x] сделано\n    * ещё\n• конец')!;
        expect(r.items.map((i) => `${i.text}:${i.done}`)).toEqual(['план:false', 'сделано:true', 'ещё:false', 'конец:false']);
        expect(r.items.every((i) => !('depth' in i))).toBe(true);
    });
});
