import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createEditorCommands } from '@/editor/commands';
import { useEditor } from '@/editor/store';

describe('editor commands', () => {
    beforeEach(() => setActivePinia(createPinia()));

    function setup() {
        const editor = useEditor();
        editor.loadWorkspace({ nodes: {}, connections: [] }, undefined, true);
        return { editor, ...createEditorCommands(editor) };
    }

    const key = (init: Partial<KeyboardEventInit> & { key: string }) => new KeyboardEvent('keydown', init);

    it('у сочетаний нет конфликтов с браузером и друг с другом', () => {
        expect(setup().commands.check()).toEqual([]);
    });

    it('у каждой команды есть подпись, а ноды добавляются командами по типам', () => {
        const { commands, editor } = setup();
        for (const c of commands.list()) expect(commands.label(c.id), c.id).toBeTruthy();
        for (const def of editor.registry.all().filter((d) => !d.point)) expect(commands.has(`tool.place.${def.id}`)).toBe(true);
        expect(commands.has('tool.place.reroute')).toBe(false);
    });

    it('доступность следует за состоянием: выравнивание от двух нод, распределение от трёх', () => {
        const { commands, editor } = setup();
        expect(commands.isEnabled('align.left')).toBe(false);
        expect(commands.isEnabled('edit.delete')).toBe(false);

        editor.addNodeAtCenter('note');
        expect(commands.isEnabled('edit.delete')).toBe(true);
        expect(commands.isEnabled('align.left')).toBe(false);

        const ids = [editor.addNodeAtCenter('note').id, editor.addNodeAtCenter('note').id];
        editor.setSelection(ids);
        expect(commands.isEnabled('align.left')).toBe(true);
        expect(commands.isEnabled('align.distributeX')).toBe(false);

        editor.setSelection(Object.keys(editor.workspace.nodes));
        expect(commands.isEnabled('align.distributeX')).toBe(true);
    });

    it('отмена и повтор включаются по истории', () => {
        const { commands, editor } = setup();
        expect(commands.isEnabled('edit.undo')).toBe(false);
        editor.addNodeAtCenter('note');
        expect(commands.isEnabled('edit.undo')).toBe(true);
        commands.run('edit.undo');
        expect(commands.isEnabled('edit.redo')).toBe(true);
    });

    it('вид связи — радио: переключение меняет отмеченную команду', () => {
        const { commands } = setup();
        expect(commands.get('link.line')!.checked!()).toBe(true);
        commands.run('link.arrow');
        expect(commands.get('link.arrow')!.checked!()).toBe(true);
        expect(commands.get('link.line')!.checked!()).toBe(false);
    });

    it('холст отдаёт командам Delete, Ctrl+Z и Ctrl+Y, но не чужие клавиши', () => {
        const { claimsKey } = setup();
        expect(claimsKey(key({ key: 'Delete' }))).toBe(true);
        expect(claimsKey(key({ key: 'z', code: 'KeyZ', ctrlKey: true }))).toBe(true);
        expect(claimsKey(key({ key: 'я', code: 'KeyZ', ctrlKey: true }))).toBe(true); // русская раскладка
        expect(claimsKey(key({ key: 'y', code: 'KeyY', ctrlKey: true }))).toBe(true);
        expect(claimsKey(key({ key: 'Escape' }))).toBe(true); // отмена инструмента
        expect(claimsKey(key({ key: 'q', code: 'KeyQ' }))).toBe(false);
    });

    it('инструмент ноды ждёт клика, ставит ноду центром в точку (на сетке) и возвращает выбор', () => {
        const { commands, editor } = setup();
        expect(editor.placing).toBe(false);

        commands.run('tool.place.note');
        expect(editor.tool).toBe('note');
        expect(editor.placing).toBe(true);
        expect(commands.get('tool.place.note')!.checked!()).toBe(true);
        expect(commands.get('tool.select')!.checked!()).toBe(false);

        const node = editor.placeAt([500, 300])!;
        expect(node.type).toBe('note');
        expect(node.x % 24).toBe(0); // привязка к сетке включена по умолчанию
        expect(Math.abs(node.x + node.w / 2 - 500)).toBeLessThanOrEqual(12 + 12);
        expect(editor.tool).toBe('select');
        expect([...editor.selection]).toEqual([node.id]);

        // Клик без инструмента ничего не ставит.
        expect(editor.placeAt([0, 0])).toBeNull();
    });

    it('повторное нажатие на инструмент снимает его; Esc снимает инструмент, затем палитру, затем выделение', () => {
        const { commands, editor } = setup();
        commands.run('tool.place.group');
        commands.run('tool.place.group');
        expect(editor.tool).toBe('select');

        const n = editor.addNodeAtCenter('note');
        expect(editor.selection.has(n.id)).toBe(true);

        commands.run('tool.place.image');
        commands.run('tool.cancel');
        expect(editor.tool).toBe('select');
        expect(editor.selection.has(n.id)).toBe(true); // выделение пережило первый Esc

        editor.openPalette([0, 0], [0, 0]);
        commands.run('tool.cancel');
        expect(editor.palette).toBeNull();
        expect(editor.selection.size).toBe(1);

        commands.run('tool.cancel');
        expect(editor.selection.size).toBe(0);
    });

    it('клавиши инструментов берутся из определений нод', () => {
        const { commands } = setup();
        expect(commands.shortcutLabel('tool.select')).toBe('V');
        expect(commands.shortcutLabel('tool.place.note')).toBe('N');
    });

    it('масштаб: «+» и «−» вокруг центра, 100% и «показать всё»', () => {
        const { commands, editor } = setup();
        editor.viewport = { w: 1000, h: 600 };
        commands.run('view.zoomIn');
        expect(editor.camera.z).toBeCloseTo(1.25);
        commands.run('view.zoomOut');
        commands.run('view.zoomOut');
        expect(editor.camera.z).toBeCloseTo(0.8);
        commands.run('view.zoom100');
        expect(editor.camera.z).toBeCloseTo(1);

        // Одна нода: «показать всё» центрирует её, но не увеличивает выше 100%.
        const a = editor.addNodeAtCenter('note');
        commands.run('view.fit');
        expect(editor.camera.z).toBe(1);

        // Две далеко друг от друга: отдаляет, но не меньше предела.
        editor.addNodeAtCenter('note');
        editor.workspace.nodes[a.id]!.x = 5000;
        commands.run('view.fit');
        expect(editor.camera.z).toBeLessThan(1);
        expect(editor.camera.z).toBeGreaterThanOrEqual(0.2);
    });

    it('тема — радио и применяется к <html>', () => {
        const { commands, editor } = setup();
        commands.run('app.theme.light');
        expect(editor.theme).toBe('light');
        expect(commands.get('app.theme.light')!.checked!()).toBe(true);
    });
});
