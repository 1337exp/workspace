import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createEditorCommands } from '@/editor/commands';
import { useEditor } from '@/editor/store';

describe('заготовки размера у инструмента', () => {
    beforeEach(() => {
        localStorage.clear();
        setActivePinia(createPinia());
    });

    function setup() {
        const editor = useEditor();
        editor.loadWorkspace({ nodes: {}, connections: [] }, undefined, true);
        return { editor, ...createEditorCommands(editor) };
    }

    it('у группы есть заготовки без повторов, первая это размер по умолчанию', () => {
        const { editor } = setup();
        const def = editor.registry.get('group');
        const ids = def.presets!.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(def.presets![0]).toMatchObject({ id: 'custom', w: def.size.w, h: def.size.h });
        expect(def.presets!.every((p) => p.w >= (def.size.minW ?? 0) && p.h >= (def.size.minH ?? 0))).toBe(true);
    });

    it('выбранная заготовка ставит ноду этого размера центром в точку клика; размер одноразовый', () => {
        const { editor } = setup();
        editor.snapEnabled = false;
        editor.setTool('group', undefined, { w: 960, h: 540 });
        expect(editor.placeSize).toEqual({ w: 960, h: 540 });
        const g = editor.placeAt([1000, 500])!;
        expect([g.w, g.h]).toEqual([960, 540]);
        expect([g.x, g.y]).toEqual([520, 230]);
        expect(editor.placeSize).toBeNull();

        editor.setTool('group');
        const d = editor.placeAt([0, 0])!;
        expect([d.w, d.h]).toEqual([480, 320]); // без заготовки размер по умолчанию
    });

    it('клавиша ставит размер по умолчанию, Esc снимает выбранную заготовку', () => {
        const { editor, commands } = setup();
        editor.setTool('group', undefined, { w: 600, h: 600 });
        editor.cancelTool();
        expect(editor.placeSize).toBeNull();
        commands.run('tool.place.group');
        expect(editor.placeSize).toBeNull();
        const g = editor.placeAt([0, 0])!;
        expect([g.w, g.h]).toEqual([480, 320]);
    });
});
