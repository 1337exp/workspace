import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useEditor } from '@/editor/store';
import { createEditorCommands } from '@/editor/commands';

describe('умные направляющие при перетаскивании', () => {
    beforeEach(() => {
        localStorage.clear(); // настройки (направляющие, сетка) запоминаются: между тестами они не должны утекать
        setActivePinia(createPinia());
    });

    /** Две заметки 240x160: `still` стоит на месте, `drag` перетаскиваем. */
    function setup() {
        const editor = useEditor();
        editor.loadWorkspace({ nodes: {}, connections: [] }, undefined, true);
        const still = editor.addNodeAtCenter('note');
        const drag = editor.addNodeAtCenter('note');
        Object.assign(editor.workspace.nodes[still.id]!, { x: 100, y: 100 });
        Object.assign(editor.workspace.nodes[drag.id]!, { x: 500, y: 400 });
        editor.setSelection([drag.id]);
        editor.snapEnabled = false; // сетка мешала бы считать: включаем её только там, где она нужна
        return { editor, still: editor.workspace.nodes[still.id]!, node: editor.workspace.nodes[drag.id]! };
    }

    it('край притягивается к краю другой ноды, линия видна, после отпускания исчезает', () => {
        const { editor, node } = setup();
        editor.beginDrag(node.id);
        // тянем так, чтобы левый край оказался в 3 px от левого края неподвижной (x = 100): 500 - 397 = 103
        editor.moveSelected(-397, 0, true);
        expect(node.x).toBe(100);
        expect(editor.guides.some((l) => l.axis === 'x' && l.at === 100)).toBe(true);

        editor.endDrag();
        expect(editor.guides).toEqual([]);
    });

    it('центр к центру по оси y', () => {
        const { editor, node, still } = setup();
        editor.beginDrag(node.id);
        // центры по y: still 180, node 480; сдвинуть node.y на -296 → центр 184 (в 4 px)
        editor.moveSelected(0, -296, true);
        expect(node.y + node.h / 2).toBe(still.y + still.h / 2);
        expect(editor.guides.some((l) => l.axis === 'y')).toBe(true);
        editor.endDrag();
    });

    it('без snap (Alt) и с выключенными направляющими ноды движутся свободно и линий нет', () => {
        const a = setup();
        a.editor.beginDrag(a.node.id);
        a.editor.moveSelected(-397, 0, false); // Alt
        expect(a.node.x).toBe(103);
        expect(a.editor.guides).toEqual([]);
        a.editor.endDrag();

        const b = setup();
        b.editor.guidesEnabled = false;
        b.editor.beginDrag(b.node.id);
        b.editor.moveSelected(-397, 0, true);
        expect(b.node.x).toBe(103);
        expect(b.editor.guides).toEqual([]);
    });

    it('вдали от других нод ничего не притягивается', () => {
        const { editor, node } = setup();
        editor.beginDrag(node.id);
        editor.moveSelected(-250, -150, true); // x 250, y 250: ни краёв, ни центров рядом нет
        expect(node.x).toBe(250);
        expect(node.y).toBe(250);
        expect(editor.guides).toEqual([]);
    });

    it('ось на направляющей не подчиняется сетке, свободная ось ей подчиняется', () => {
        const { editor, node } = setup();
        editor.snapEnabled = true;
        editor.beginDrag(node.id);
        // x: левый край в 2 px от 100 (направляющая), y: 400 + (-263) = 137, сетка 24 → 144 (в 7: за порогом 6), берём 140 → ближе к 144 на 4
        editor.moveSelected(-398, -260, true);
        expect(node.x).toBe(100); // направляющая, а не ближайшая линия сетки 96
        expect(node.y % 24).toBe(0); // ось y прилипла к сетке
        editor.endDrag();
    });

    it('несколько двигающихся нод считаются одним прямоугольником', () => {
        const { editor, node } = setup();
        const second = editor.addNodeAtCenter('note');
        Object.assign(editor.workspace.nodes[second.id]!, { x: 760, y: 400 }); // справа от node, общий охват x 500..1000
        editor.setSelection([node.id, second.id]);
        editor.beginDrag(node.id);
        editor.moveSelected(-397, 0, true); // левый край охвата к краю 100
        expect(node.x).toBe(100);
        expect(editor.workspace.nodes[second.id]!.x).toBe(360); // едет вместе: 760 - 400
        editor.endDrag();
    });

    it('у направляющих есть команда-переключатель в меню вида, настройка запоминается', () => {
        const { editor } = setup();
        const { commands } = createEditorCommands(editor);
        expect(commands.get('view.guides')!.checked!()).toBe(true);
        commands.run('view.guides');
        expect(editor.guidesEnabled).toBe(false);
        expect(commands.get('view.guides')!.checked!()).toBe(false);
    });
});

describe('фон холста', () => {
    beforeEach(() => {
        localStorage.clear();
        setActivePinia(createPinia());
    });

    it('по умолчанию сетка; команды переключают фон, он запоминается, неверное сохранённое значение игнорируется', () => {
        const editor = useEditor();
        const { commands } = createEditorCommands(editor);
        expect(editor.background).toBe('grid');
        expect(commands.get('app.bg.grid')!.checked!()).toBe(true);

        commands.run('app.bg.dots');
        expect(editor.background).toBe('dots');
        expect(commands.get('app.bg.dots')!.checked!()).toBe(true);
        expect(commands.get('app.bg.grid')!.checked!()).toBe(false);

        commands.run('app.bg.none');
        expect(editor.background).toBe('none');
    });

    it('сохранённый фон читается при старте, мусор заменяется сеткой', async () => {
        localStorage.setItem('workspace.prefs', JSON.stringify({ background: 'dots' }));
        setActivePinia(createPinia());
        expect(useEditor().background).toBe('dots');

        localStorage.setItem('workspace.prefs', JSON.stringify({ background: 'plaid' }));
        setActivePinia(createPinia());
        expect(useEditor().background).toBe('grid');
    });

    it('привязка к сетке не зависит от вида фона', () => {
        const editor = useEditor();
        editor.background = 'none';
        expect(editor.snapEnabled).toBe(true);
    });
});
