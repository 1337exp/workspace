import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { emptyItem, insertItem, newId, pasteLines, progress, removeItem, type ChecklistItem } from '@/nodes/checklist/items';
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
