import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { copyText, insertNodes } from '@/core/clipboard';
import { parse, serialize } from '@/core/serialize';
import { addNode, cleanLabel, connect, createWorkspace, dissolveNode, duplicateNodes, MAX_LABEL, setLabel, splitConnection } from '@/core/workspace';
import { createDefaultRegistry } from '@/nodes';
import { createEditorCommands } from '@/editor/commands';
import { workspaceCanvasHost } from '@/editor/canvasHost';
import { useContextMenu } from '@/editor/contextMenu';
import { useEditor } from '@/editor/store';

const registry = createDefaultRegistry();

function pair() {
    const ws = createWorkspace();
    addNode(ws, registry, 'note', { id: 'a', x: 0, y: 0 });
    addNode(ws, registry, 'note', { id: 'b', x: 400, y: 0 });
    const c = connect(ws, { node: 'a', side: 'right' }, { node: 'b', side: 'left' }, 'end');
    return { ws, c };
}

describe('подпись связи: модель', () => {
    it('cleanLabel: пробелы по краям и переводы строк, длина, пустое это undefined', () => {
        expect(cleanLabel('  да  ')).toBe('да');
        expect(cleanLabel('строка\n  вторая\r\nтретья')).toBe('строка вторая третья');
        expect(cleanLabel('   \n ')).toBeUndefined();
        expect(cleanLabel('x'.repeat(500))).toHaveLength(MAX_LABEL);
    });

    it('setLabel ставит, меняет и убирает подпись; возвращает, изменилось ли', () => {
        const { ws, c } = pair();
        expect(setLabel(ws, c.id, ' зависит от ')).toBe(true);
        expect(c.label).toBe('зависит от');
        expect(setLabel(ws, c.id, 'зависит от')).toBe(false); // то же самое
        expect(setLabel(ws, c.id, '  ')).toBe(true); // пустая убирает
        expect('label' in c).toBe(false);
        expect(setLabel(ws, c.id, '')).toBe(false);
        expect(setLabel(ws, 'нет', 'x')).toBe(false);
    });

    it('сохраняется в файле и читается обратно; в файле пустая и неверная подпись отбрасываются', () => {
        const { ws, c } = pair();
        setLabel(ws, c.id, 'после');
        const back = parse(serialize(ws), registry);
        expect(back.ok && back.workspace.connections[0]!.label).toBe('после');

        const text = serialize(ws).replace('"label": "после"', '"label": 42');
        const bad = parse(text, registry);
        expect(bad.ok && 'label' in bad.workspace.connections[0]!).toBe(false);
        const old = { ...JSON.parse(serialize(ws)), connections: [{ ...JSON.parse(serialize(ws)).connections[0], label: undefined }] };
        expect(parse(JSON.stringify(old), registry).ok).toBe(true); // файл без подписи читается как раньше
    });

    it('точка на связи оставляет подпись на первой половине; растворение точки возвращает её целой связи', () => {
        const { ws, c } = pair();
        setLabel(ws, c.id, 'через точку');
        const point = splitConnection(ws, registry, c.id, [200, 20])!;
        expect(ws.connections.map((x) => x.label)).toEqual(['через точку', undefined]);

        dissolveNode(ws, point.id);
        expect(ws.connections).toHaveLength(1);
        expect(ws.connections[0]!.label).toBe('через точку');
    });

    it('дублирование и вставка переносят подпись вместе со связью', () => {
        const { ws, c } = pair();
        setLabel(ws, c.id, 'копия');
        duplicateNodes(ws, registry, ['a', 'b']);
        expect(ws.connections.map((x) => x.label)).toEqual(['копия', 'копия']);

        const text = copyText(ws, registry, ['a', 'b'])!;
        const source = (parse(text, registry) as { ok: true; workspace: typeof ws }).workspace;
        insertNodes(ws, source, 10, 10);
        expect(ws.connections.at(-1)!.label).toBe('копия');
    });
});

describe('подпись связи: редактор', () => {
    beforeEach(() => {
        localStorage.clear();
        setActivePinia(createPinia());
    });

    function setup() {
        const editor = useEditor();
        editor.loadWorkspace({ nodes: {}, connections: [] }, undefined, true);
        const a = editor.addNodeAtCenter('note');
        const b = editor.addNodeAtCenter('note');
        editor.workspace.nodes[b.id]!.x += 400;
        editor.startConnect({ node: a.id, side: 'right' }, [0, 0]);
        editor.finishConnect({ node: b.id, side: 'left' });
        return { editor, link: editor.selectedConnection!, ...createEditorCommands(editor) };
    }

    it('F2 и команда: правка начинается у выбранной связи, подпись пишется шагом истории, пустая убирает', () => {
        const { editor, link, commands } = setup();
        expect(commands.shortcutLabel('link.label')).toBe('F2');
        expect(commands.check()).toEqual([]);
        expect(commands.label('link.label')).toBe('Add a label');

        commands.run('link.label');
        expect(editor.labelEditing).toBe(link);

        editor.endLabelEdit(link, 'питает');
        expect(editor.labelEditing).toBeNull();
        expect(editor.workspace.connections[0]!.label).toBe('питает');
        expect(commands.label('link.label')).toBe('Edit the label');

        editor.undo();
        expect(editor.workspace.connections[0]!.label).toBeUndefined();

        editor.redo();
        editor.endLabelEdit(link, '   ');
        expect(editor.workspace.connections[0]!.label).toBeUndefined();
    });

    it('отмена правки (null) подпись не меняет; команда без выбранной связи недоступна', () => {
        const { editor, link, commands } = setup();
        editor.endLabelEdit(link, 'раз');
        editor.startLabelEdit(link);
        editor.endLabelEdit(link, null);
        expect(editor.workspace.connections[0]!.label).toBe('раз');
        expect(editor.labelEditing).toBeNull();

        editor.selectConnection(null);
        expect(commands.isEnabled('link.label')).toBe(false);
        editor.startLabelEdit(); // нечего править
        expect(editor.labelEditing).toBeNull();
        editor.startLabelEdit('нет такой');
        expect(editor.labelEditing).toBeNull();
    });

    it('двойной клик по подписи правит её, по самой линии ставит точку', () => {
        const { editor, link } = setup();
        editor.endLabelEdit(link, 'метка');
        const host = workspaceCanvasHost(editor, () => false);

        const onLabel = document.createElement('div');
        onLabel.setAttribute('data-link-label', '');
        host.activate!({ kind: 'link', id: link, at: [200, 50], element: onLabel });
        expect(editor.labelEditing).toBe(link);
        expect(Object.values(editor.workspace.nodes).some((n) => n.type === 'reroute')).toBe(false);

        editor.endLabelEdit(link, null);
        host.activate!({ kind: 'link', id: link, at: [200, 50], element: document.createElement('div') });
        expect(editor.labelEditing).toBeNull();
        expect(Object.values(editor.workspace.nodes).some((n) => n.type === 'reroute')).toBe(true);
    });

    it('в меню связи первым пунктом подпись', () => {
        const { editor, link } = setup();
        const { items } = useContextMenu();
        editor.openContext([0, 0], { kind: 'link', id: link });
        const first = items.value[0] as { id: string };
        expect(first.id).toBe('link.label');
    });
});
