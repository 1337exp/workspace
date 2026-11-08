import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createEditorCommands } from '@/editor/commands';
import { useEditor } from '@/editor/store';
import { DEFAULT_EMOJI, EMOJIS } from '@/nodes/emoji/emojis';
import { rememberEmoji } from '@/nodes/emoji';

describe('стикер из эмодзи', () => {
    beforeEach(() => {
        localStorage.clear();
        setActivePinia(createPinia());
        rememberEmoji(DEFAULT_EMOJI);
    });

    function setup() {
        const editor = useEditor();
        editor.loadWorkspace({ nodes: {}, connections: [] }, undefined, true);
        return { editor, ...createEditorCommands(editor) };
    }

    it('набор без повторов и пустых, по умолчанию улыбка; нода голая, поверх остальных, без цвета, клавиша E', () => {
        expect(new Set(EMOJIS).size).toBe(EMOJIS.length);
        expect(EMOJIS.every((e) => e.trim() !== '')).toBe(true);
        expect(EMOJIS).toContain(DEFAULT_EMOJI);

        const { editor, commands } = setup();
        expect(editor.registry.get('emoji')).toMatchObject({ bare: true, overlay: true, colorable: false, hotkey: 'E' });
        expect(commands.shortcutLabel('tool.place.emoji')).toBe('E');
        expect(commands.check()).toEqual([]);
    });

    it('клавиша ставит последний выбранный эмодзи, выбор из окошка ставит выбранный и запоминается', () => {
        const { editor, commands } = setup();
        commands.run('tool.place.emoji');
        expect(editor.placeAt([300, 200])!.data.emoji).toBe(DEFAULT_EMOJI);

        rememberEmoji('🔥');
        editor.setTool('emoji', { emoji: '🚀' });
        expect(editor.placeData).toEqual({ emoji: '🚀' });
        const rocket = editor.placeAt([100, 100])!;
        expect(rocket.data.emoji).toBe('🚀');
        expect(editor.placeData).toBeNull(); // данные одноразовые

        commands.run('tool.place.emoji'); // по клавише: последний запомненный
        expect(editor.placeAt([0, 0])!.data.emoji).toBe('🔥');
    });

    it('Esc снимает выбранный эмодзи вместе с инструментом', () => {
        const { editor } = setup();
        editor.setTool('emoji', { emoji: '🎯' });
        editor.cancelTool();
        expect(editor.placeData).toBeNull();
        expect(editor.tool).toBe('select');
    });

    it('красить стикер нельзя: он не попадает в список красимых, цвет не пишется', () => {
        const { editor } = setup();
        const sticker = editor.addNodeAtCenter('emoji');
        const note = editor.addNodeAtCenter('note');
        editor.setSelection([sticker.id]);
        expect(editor.colorable).toEqual([]);

        editor.setSelection([sticker.id, note.id]);
        expect(editor.colorable).toEqual([note.id]);
        editor.setColor('red');
        expect(editor.workspace.nodes[sticker.id]!.color).toBeUndefined();
        expect(editor.workspace.nodes[note.id]!.color).toBe('red');
    });

    it('замена эмодзи у выделенных, копирование и вставка сохраняют знак', () => {
        const { editor } = setup();
        const a = editor.addNodeAtCenter('emoji');
        editor.patchData(a.id, { emoji: '✅' });
        editor.setSelection([a.id]);
        const text = editor.copySelected()!;
        const [pasted] = editor.pasteText(text);
        expect(pasted!.type).toBe('emoji');
        expect(pasted!.data.emoji).toBe('✅');
    });
});
