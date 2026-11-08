import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createDefaultRegistry } from '@/nodes';
import { addNode, connect, createWorkspace, duplicateNodes, lowerToBack } from '@/core/workspace';
import { createEditorCommands } from '@/editor/commands';
import { useContextMenu } from '@/editor/contextMenu';
import { useEditor } from '@/editor/store';

const registry = createDefaultRegistry();

describe('lowerToBack', () => {
    it('кладёт ноду в начало порядка отрисовки, остальных не перемешивает', () => {
        const ws = createWorkspace();
        for (const id of ['a', 'b', 'c']) addNode(ws, registry, 'note', { id });
        expect(lowerToBack(ws, 'c')).toBe(true);
        expect(Object.keys(ws.nodes)).toEqual(['c', 'a', 'b']);
        expect(lowerToBack(ws, 'c')).toBe(false); // уже внизу
        expect(lowerToBack(ws, 'нет')).toBe(false);
    });
});

describe('duplicateNodes', () => {
    it('копирует со сдвигом и новыми id, данные не делятся с оригиналом', () => {
        const ws = createWorkspace();
        addNode(ws, registry, 'checklist', { id: 'a', x: 10, y: 20, color: 'red', data: { items: [{ id: 'i1', text: 'x', done: false }] } });
        const [copy] = duplicateNodes(ws, registry, ['a'], [24, 24]);

        expect(copy!.id).not.toBe('a');
        expect(copy).toMatchObject({ type: 'checklist', x: 34, y: 44, color: 'red' });
        expect(Object.keys(ws.nodes).at(-1)).toBe(copy!.id); // сверху

        (copy!.data.items as { text: string }[])[0]!.text = 'изменено';
        expect((ws.nodes.a!.data.items as { text: string }[])[0]!.text).toBe('x');
    });

    it('копирует связи между скопированными нодами, но не наружу', () => {
        const ws = createWorkspace();
        for (const id of ['a', 'b', 'c']) addNode(ws, registry, 'note', { id });
        connect(ws, { node: 'a', side: 'right' }, { node: 'b', side: 'left' }, 'end');
        connect(ws, { node: 'b', side: 'right' }, { node: 'c', side: 'left' });

        const copies = duplicateNodes(ws, registry, ['a', 'b']);
        expect(copies).toHaveLength(2);
        expect(ws.connections).toHaveLength(3); // одна новая: a→b; b→c наружу не копируется
        const fresh = ws.connections.at(-1)!;
        expect(fresh.arrow).toBe('end');
        expect(new Set([fresh.from.node, fresh.to.node])).toEqual(new Set(copies.map((n) => n.id)));
    });

    it('группа копируется вместе с тем, что лежит внутри, а возвращаются только выбранные', () => {
        const ws = createWorkspace();
        addNode(ws, registry, 'group', { id: 'g', x: 0, y: 0, w: 400, h: 300 });
        addNode(ws, registry, 'note', { id: 'inside', x: 20, y: 40, w: 100, h: 80, parent: 'g' });
        addNode(ws, registry, 'note', { id: 'outside', x: 600, y: 0 });

        const copies = duplicateNodes(ws, registry, ['g']);
        expect(copies.map((n) => n.type)).toEqual(['group']);
        expect(Object.keys(ws.nodes)).toHaveLength(5); // +группа +вложенная заметка
        const innerCopy = Object.values(ws.nodes).find((n) => n.id !== 'inside' && n.type === 'note' && n.x === 44);
        expect(innerCopy).toBeDefined();
    });

    it('неизвестные id пропускаются, пустой выбор ничего не делает', () => {
        const ws = createWorkspace();
        expect(duplicateNodes(ws, registry, ['нет'])).toEqual([]);
        expect(Object.keys(ws.nodes)).toHaveLength(0);
    });
});

describe('контекстное меню и команды порядка', () => {
    beforeEach(() => setActivePinia(createPinia()));

    function setup() {
        const editor = useEditor();
        editor.loadWorkspace({ nodes: {}, connections: [] }, undefined, true);
        return { editor, ...createEditorCommands(editor) };
    }

    it('сочетания новых команд не конфликтуют, у них есть подписи и клавиши', () => {
        const { commands } = setup();
        expect(commands.check()).toEqual([]);
        expect(commands.shortcutLabel('edit.duplicate')).toMatch(/D$/);
        for (const id of ['edit.duplicate', 'node.front', 'node.back']) expect(commands.label(id)).toBeTruthy();
    });

    it('«Дублировать» выделяет копии и откатывается одним шагом', () => {
        const { editor, commands } = setup();
        const a = editor.addNodeAtCenter('note');
        commands.run('edit.duplicate');
        expect(Object.keys(editor.workspace.nodes)).toHaveLength(2);
        expect(editor.selection.size).toBe(1);
        expect(editor.selection.has(a.id)).toBe(false);

        editor.undo();
        expect(Object.keys(editor.workspace.nodes)).toEqual([a.id]);
    });

    it('«На передний / задний план» держит порядок выбранных между собой и не трогает группы', () => {
        const { editor, commands } = setup();
        const g = editor.addNodeAtCenter('group');
        const [a, b, c] = [editor.addNodeAtCenter('note'), editor.addNodeAtCenter('note'), editor.addNodeAtCenter('note')];

        editor.setSelection([a.id, b.id]);
        commands.run('node.front');
        expect(Object.keys(editor.workspace.nodes)).toEqual([g.id, c.id, a.id, b.id]);

        editor.setSelection([a.id, b.id]);
        commands.run('node.back');
        expect(Object.keys(editor.workspace.nodes)).toEqual([a.id, b.id, g.id, c.id]);

        editor.setSelection([g.id]);
        commands.run('node.back');
        expect(Object.keys(editor.workspace.nodes)).toEqual([a.id, b.id, g.id, c.id]); // группа: порядок не меняется
    });

    it('openContext: нода вне выделения становится выделением, внутри выделения оно сохраняется, пустое место открывает своё меню', () => {
        const { editor } = setup();
        const a = editor.addNodeAtCenter('note');
        const b = editor.addNodeAtCenter('note');

        editor.setSelection([a.id]);
        expect(editor.openContext([10, 10], { kind: 'node', nodeId: b.id })).toBe(true);
        expect([...editor.selection]).toEqual([b.id]);

        editor.setSelection([a.id, b.id]);
        editor.openContext([10, 10], { kind: 'node', nodeId: a.id });
        expect(editor.selection.size).toBe(2);

        editor.closeContext();
        expect(editor.contextMenu).toBeNull();

        // Пустое место: своё меню (вставить, выбрать всё), выделение остаётся.
        editor.setSelection([a.id]);
        expect(editor.openContext([0, 0], { kind: 'empty' }, [5, 6])).toBe(true);
        expect(editor.contextMenu).toMatchObject({ target: { kind: 'empty' }, world: [5, 6] });
        expect([...editor.selection]).toEqual([a.id]);
    });

    it('пункты меню зависят от того, на что нажали: у чеклиста есть «Скрыть выполненные», у связи вид и «Развернуть»', () => {
        const { editor } = setup();
        const list = editor.addNodeAtCenter('checklist');
        const other = editor.addNodeAtCenter('note');
        const { items, runContextItem } = useContextMenu();
        const ids = () => items.value.flatMap((i) => ('items' in i && i.items ? [('id' in i ? i.id : ''), ...i.items.map((x) => ('id' in x ? x.id : ''))] : ['id' in i ? i.id : '']));

        editor.openContext([0, 0], { kind: 'node', nodeId: list.id });
        expect(ids()).toEqual(expect.arrayContaining(['edit.duplicate', 'node.front', 'node.back', 'action:hideDone', 'color', 'color:none', 'color:red', 'edit.delete']));
        expect(ids()).not.toContain('align'); // выравнивание только при двух и более нодах

        runContextItem('action:hideDone');
        expect(editor.workspace.nodes[list.id]!.data.hideDone).toBe(true);
        runContextItem('color:blue');
        expect(editor.workspace.nodes[list.id]!.color).toBe('blue');
        runContextItem('color:none');
        expect(editor.workspace.nodes[list.id]!.color).toBeUndefined();

        editor.setSelection([list.id, other.id]);
        editor.openContext([0, 0], { kind: 'node', nodeId: list.id });
        expect(ids()).toContain('align');
        expect(ids()).not.toContain('action:hideDone'); // выделены ноды разных типов

        editor.startConnect({ node: list.id, side: 'right' }, [0, 0]);
        editor.finishConnect({ node: other.id, side: 'left' });
        const link = editor.selectedConnection!;
        editor.openContext([0, 0], { kind: 'link', id: link });
        expect(ids()).toEqual(expect.arrayContaining(['link.line', 'link.arrow', 'link.reverse', 'link.straighten', 'edit.delete']));
        expect(ids()).not.toContain('edit.duplicate');
    });
});
