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
        for (const def of editor.registry.all().filter((d) => !d.point)) expect(commands.has(`node.add.${def.id}`)).toBe(true);
        expect(commands.has('node.add.reroute')).toBe(false);
    });

    it('доступность следует за состоянием: выравнивание от двух нод, распределение от трёх', () => {
        const { commands, editor } = setup();
        expect(commands.isEnabled('align.left')).toBe(false);
        expect(commands.isEnabled('edit.delete')).toBe(false);

        commands.run('node.add.note');
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
        const { commands } = setup();
        expect(commands.isEnabled('edit.undo')).toBe(false);
        commands.run('node.add.note');
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
        expect(claimsKey(key({ key: 'Escape' }))).toBe(false);
        expect(claimsKey(key({ key: 'q', code: 'KeyQ' }))).toBe(false);
    });
});
