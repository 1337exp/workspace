import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createEditorCommands } from '@/editor/commands';
import { useEditor } from '@/editor/store';

describe('нода «Текст»', () => {
    beforeEach(() => setActivePinia(createPinia()));

    function setup() {
        const editor = useEditor();
        editor.loadWorkspace({ nodes: {}, connections: [] }, undefined, true);
        return { editor, ...createEditorCommands(editor) };
    }

    it('есть инструмент с клавишей T, без рамки и с правкой на месте', () => {
        const { editor, commands } = setup();
        const def = editor.registry.get('text');
        expect(def).toMatchObject({ bare: true, inlineEdit: true, hotkey: 'T' });
        expect(commands.shortcutLabel('tool.place.text')).toBe('T');
        expect(commands.check()).toEqual([]);
    });

    it('новый текст сразу ждёт ввода', () => {
        const { editor, commands } = setup();
        commands.run('tool.place.text');
        const node = editor.placeAt([300, 200])!;
        expect(node.type).toBe('text');
        expect(editor.editingNode).toBe(node.id);
        expect(editor.tool).toBe('select');
    });

    it('заметка при создании в правку не уходит', () => {
        const { editor, commands } = setup();
        commands.run('tool.place.note');
        editor.placeAt([300, 200]);
        expect(editor.editingNode).toBeNull();
    });

    it('конец правки с пустым текстом удаляет ноду, с текстом оставляет', () => {
        const { editor, commands } = setup();

        commands.run('tool.place.text');
        const empty = editor.placeAt([0, 0])!;
        editor.endEdit(empty.id);
        expect(editor.workspace.nodes[empty.id]).toBeUndefined();
        expect(editor.editingNode).toBeNull();

        commands.run('tool.place.text');
        const full = editor.placeAt([0, 0])!;
        editor.patchData(full.id, { text: 'привет' });
        editor.endEdit(full.id);
        expect(editor.workspace.nodes[full.id]).toBeDefined();
    });

    it('пробелы вместо текста тоже считаются пустым; удаление пустого откатывается', () => {
        const { editor, commands } = setup();
        commands.run('tool.place.text');
        const n = editor.placeAt([0, 0])!;
        editor.patchData(n.id, { text: '   \n ' });
        editor.endEdit(n.id);
        expect(editor.workspace.nodes[n.id]).toBeUndefined();

        editor.undo();
        expect(editor.workspace.nodes[n.id]).toBeDefined();
    });

    it('двойной клик включает правку у текста, а у заметки нет', () => {
        const { editor } = setup();
        const text = editor.addNodeAtCenter('text');
        const note = editor.addNodeAtCenter('note');
        editor.startEdit(note.id);
        expect(editor.editingNode).toBeNull();
        editor.startEdit(text.id);
        expect(editor.editingNode).toBe(text.id);
    });

    it('высота следует за содержимым, но не меньше минимума типа', () => {
        const { editor } = setup();
        const n = editor.addNodeAtCenter('text');
        editor.fitHeight(n.id, 120.2);
        expect(editor.workspace.nodes[n.id]!.h).toBe(121);
        editor.fitHeight(n.id, 5);
        expect(editor.workspace.nodes[n.id]!.h).toBe(32); // minH типа
    });

    it('смена пространства сбрасывает правку на месте', () => {
        const { editor } = setup();
        const n = editor.addNodeAtCenter('text');
        editor.startEdit(n.id);
        editor.newWorkspace();
        expect(editor.editingNode).toBeNull();
    });
});
