import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { copyText, insertNodes, pasteOffset, readClipboard } from '@/core/clipboard';
import { parse } from '@/core/serialize';
import { addNode, connect, createWorkspace } from '@/core/workspace';
import { createDefaultRegistry } from '@/nodes';
import { bindClipboardEvents } from '@/editor/clipboard';
import { useContextMenu } from '@/editor/contextMenu';
import { useEditor } from '@/editor/store';

const registry = createDefaultRegistry();

describe('буфер: текст и разбор', () => {
    function sample() {
        const ws = createWorkspace();
        addNode(ws, registry, 'group', { id: 'g', x: 0, y: 0, w: 400, h: 300 });
        addNode(ws, registry, 'note', { id: 'inside', x: 20, y: 40, w: 100, h: 80, data: { text: 'внутри' }, parent: 'g' });
        addNode(ws, registry, 'note', { id: 'a', x: 600, y: 0 });
        addNode(ws, registry, 'note', { id: 'b', x: 900, y: 0 });
        connect(ws, { node: 'a', side: 'right' }, { node: 'b', side: 'left' }, 'end');
        connect(ws, { node: 'inside', side: 'right' }, { node: 'a', side: 'left' });
        return ws;
    }

    it('copyText: выбранные ноды и вложенное в группу, связи только между скопированными; без выбора null', () => {
        const ws = sample();
        expect(copyText(ws, registry, [])).toBeNull();
        expect(copyText(ws, registry, ['нет'])).toBeNull();

        const text = copyText(ws, registry, ['g'])!;
        const back = parse(text, registry);
        expect(back.ok).toBe(true);
        if (!back.ok) return;
        expect(Object.keys(back.workspace.nodes).sort()).toEqual(['g', 'inside']);
        expect(back.workspace.connections).toEqual([]); // связь inside→a уходит наружу

        const both = parse(copyText(ws, registry, ['a', 'b'])!, registry);
        expect(both.ok && both.workspace.connections).toHaveLength(1);
    });

    it('readClipboard: наш формат, чужой текст, пустое и слишком большое', () => {
        const ws = sample();
        const ours = readClipboard(copyText(ws, registry, ['a'])!, registry);
        expect(ours).toMatchObject({ kind: 'nodes' });

        expect(readClipboard('Купить молоко\nи хлеб', registry)).toEqual({ kind: 'text', text: 'Купить молоко\nи хлеб' });
        expect(readClipboard('   \n ', registry)).toBeNull();
        expect(readClipboard('x'.repeat(10_001), registry)).toBeNull();
        // Файл без нод ничего не вставляет.
        expect(readClipboard('{"format":"workspace","version":1,"nodes":[],"connections":[]}', registry)).toBeNull();
        // Чужой JSON это просто текст.
        expect(readClipboard('{"a":1}', registry)).toEqual({ kind: 'text', text: '{"a":1}' });
    });

    it('insertNodes: новые id, сдвиг, связи переносятся, данные не общие', () => {
        const ws = createWorkspace();
        addNode(ws, registry, 'note', { id: 'a', x: 10, y: 20, data: { text: 'один' } });
        addNode(ws, registry, 'note', { id: 'b', x: 300, y: 20 });
        connect(ws, { node: 'a', side: 'right' }, { node: 'b', side: 'left' }, 'end');

        const source = (parse(copyText(ws, registry, ['a', 'b'])!, registry) as { ok: true; workspace: typeof ws }).workspace;
        const made = insertNodes(ws, source, 50, 60);
        expect(made).toHaveLength(2);
        expect(Object.keys(ws.nodes)).toHaveLength(4);
        expect(made.map((n) => n.id)).not.toContain('a');
        expect(made[0]).toMatchObject({ x: 60, y: 80 });
        expect(ws.connections).toHaveLength(2);
        expect(ws.connections.at(-1)!.arrow).toBe('end');

        made[0]!.data.text = 'изменено';
        expect(ws.nodes.a!.data.text).toBe('один');
    });

    it('pasteOffset: в видимой области на прежнее место со сдвигом, вне её в центр, с точкой центром в точку', () => {
        const ws = createWorkspace();
        addNode(ws, registry, 'note', { id: 'a', x: 100, y: 100, w: 200, h: 100 });
        const view = { x: 0, y: 0, w: 1000, h: 600 };
        expect(pasteOffset(ws, view, 0)).toEqual([24, 24]);
        expect(pasteOffset(ws, view, 2)).toEqual([72, 72]); // третья вставка подряд
        expect(pasteOffset(ws, { x: 5000, y: 5000, w: 1000, h: 600 }, 0)).toEqual([5500 - 200, 5300 - 150]);
        expect(pasteOffset(ws, view, 0, [400, 300])).toEqual([400 - 200, 300 - 150]);
        expect(pasteOffset(createWorkspace(), view, 0)).toEqual([0, 0]);
    });
});

describe('буфер: редактор', () => {
    beforeEach(() => {
        localStorage.clear();
        setActivePinia(createPinia());
    });

    function setup() {
        const editor = useEditor();
        editor.loadWorkspace({ nodes: {}, connections: [] }, undefined, true);
        editor.viewport = { w: 1000, h: 600 };
        return editor;
    }

    it('копирование и вставка: копия на сдвиге, выделена; повторная вставка сдвигается ещё', () => {
        const editor = setup();
        const a = editor.addNodeAtCenter('note');
        editor.patchData(a.id, { text: 'привет' });
        editor.setSelection([a.id]);

        const text = editor.copySelected()!;
        const first = editor.pasteText(text);
        const second = editor.pasteText(text);
        expect(first).toHaveLength(1);
        expect(first[0]).toMatchObject({ x: a.x + 24, y: a.y + 24, data: { text: 'привет' } });
        expect(second[0]).toMatchObject({ x: a.x + 48, y: a.y + 48 });
        expect([...editor.selection]).toEqual([second[0]!.id]);
        expect(Object.keys(editor.workspace.nodes)).toHaveLength(3);

        editor.undo();
        expect(Object.keys(editor.workspace.nodes)).toHaveLength(2); // вставка откатывается одним шагом
    });

    it('вставка из другой вкладки (другое пространство): центр видимой области', () => {
        const editor = setup();
        const text = JSON.stringify({
            format: 'workspace',
            version: 1,
            nodes: [{ id: 'x', type: 'note', x: 9000, y: 9000, w: 200, h: 100, dataVersion: 1, data: { text: 'оттуда' } }],
            connections: [],
        });
        const [n] = editor.pasteText(text);
        expect(n!.x + n!.w / 2).toBeCloseTo(500, -1);
        expect(n!.y + n!.h / 2).toBeCloseTo(300, -1);
    });

    it('вставка в точку (меню у курсора) ставит центром в точку', () => {
        const editor = setup();
        const a = editor.addNodeAtCenter('note');
        const text = editor.copySelected() ?? (editor.setSelection([a.id]), editor.copySelected()!);
        const [n] = editor.pasteText(text, [700, 50]);
        expect(n!.x + n!.w / 2).toBe(700);
        expect(n!.y + n!.h / 2).toBe(50);
    });

    it('адрес из буфера становится нодой «Ссылка», прочий текст нодой «Текст», мусор ничего', () => {
        const editor = setup();
        const [link] = editor.pasteText('  https://example.com/page  ');
        expect(link).toMatchObject({ type: 'link', data: { url: 'https://example.com/page' } });

        const [text] = editor.pasteText('Привет, мир https://example.com');
        expect(text).toMatchObject({ type: 'text', data: { text: 'Привет, мир https://example.com' } });

        const [js] = editor.pasteText('javascript:alert(1)');
        expect(js!.type).toBe('text'); // не адрес для открытия: просто текст

        expect(editor.pasteText('   ')).toEqual([]);
        expect(editor.pasteText('x'.repeat(20_000))).toEqual([]);
    });

    it('вырезать убирает ноды и возвращает текст для буфера; без выбора ничего', () => {
        const editor = setup();
        expect(editor.cutSelected()).toBeNull();
        const a = editor.addNodeAtCenter('note');
        editor.setSelection([a.id]);
        const text = editor.cutSelected()!;
        expect(editor.workspace.nodes[a.id]).toBeUndefined();
        expect(editor.pasteText(text)).toHaveLength(1);
    });

    it('«Выбрать всё» выделяет все ноды', () => {
        const editor = setup();
        editor.addNodeAtCenter('note');
        editor.addNodeAtCenter('text');
        editor.setSelection([]);
        editor.selectAll();
        expect(editor.selection.size).toBe(2);
    });

    it('нативные события: copy кладёт текст и гасит событие, в поле ввода не трогает; paste вставляет', () => {
        const editor = setup();
        const stop = bindClipboardEvents(editor);
        const a = editor.addNodeAtCenter('note');
        editor.setSelection([a.id]);

        const store: Record<string, string> = {};
        const fire = (type: string, target: EventTarget, initial?: string) => {
            const e = new Event(type, { bubbles: true, cancelable: true });
            Object.defineProperty(e, 'clipboardData', { value: { setData: (k: string, v: string) => (store[k] = v), getData: () => initial ?? store['text/plain'] ?? '' } });
            target.dispatchEvent(e);
            return e;
        };

        const copy = fire('copy', document.body);
        expect(copy.defaultPrevented).toBe(true);
        expect(store['text/plain']).toContain('"format":"workspace"');

        const field = document.createElement('textarea');
        document.body.appendChild(field);
        const inField = fire('copy', field);
        expect(inField.defaultPrevented).toBe(false); // поле: копируется текст как обычно
        field.remove();

        const before = Object.keys(editor.workspace.nodes).length;
        expect(fire('paste', document.body).defaultPrevented).toBe(true);
        expect(Object.keys(editor.workspace.nodes)).toHaveLength(before + 1);

        const cut = fire('cut', document.body);
        expect(cut.defaultPrevented).toBe(true);
        expect(editor.selection.size).toBe(0); // вырезанная вставка исчезла

        stop();
        const after = Object.keys(editor.workspace.nodes).length;
        fire('paste', document.body);
        expect(Object.keys(editor.workspace.nodes)).toHaveLength(after); // после отписки событие не слушается
    });

    it('меню пустого места: вставить, выбрать всё, добавить ноду, показать всё; у ноды копировать и вырезать', () => {
        const editor = setup();
        const a = editor.addNodeAtCenter('note');
        const { items } = useContextMenu();
        const ids = () => items.value.map((i) => ('id' in i ? i.id : i.type));

        editor.openContext([10, 10], { kind: 'empty' }, [1, 2]);
        expect(ids()).toEqual(expect.arrayContaining(['edit.paste', 'edit.selectAll', 'palette', 'view.fit']));
        const paste = items.value.find((i) => 'id' in i && i.id === 'edit.paste') as { shortcut?: string };
        expect(paste.shortcut).toMatch(/V$/); // подпись клавиши добавлена, хотя у команды сочетания нет

        editor.openContext([10, 10], { kind: 'node', nodeId: a.id });
        expect(ids()).toEqual(expect.arrayContaining(['edit.copy', 'edit.cut', 'edit.duplicate']));
    });
});
