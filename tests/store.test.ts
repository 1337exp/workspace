import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { linkShape } from '@/editor/curve';
import { useEditor } from '@/editor/store';
import { isImageUrl } from '@/nodes/image/url';

describe('editor store', () => {
    beforeEach(() => setActivePinia(createPinia()));

    function empty() {
        const editor = useEditor();
        editor.loadWorkspace({ nodes: {}, connections: [] }, undefined, true);
        return editor;
    }

    it('протягивание связи создаёт её с видом по умолчанию', () => {
        const editor = empty();
        const a = editor.addNodeAtCenter('note');
        const b = editor.addNodeAtCenter('note');

        editor.setArrowStyle('end'); // связь не выбрана: меняется вид новых связей
        editor.startConnect({ node: a.id, side: 'right' }, [0, 0]);
        expect(editor.finishConnect({ node: b.id, side: 'left' })).toBe(true);

        expect(editor.workspace.connections[0]).toMatchObject({ arrow: 'end' });
        expect(editor.selectedConnection).toBe(editor.workspace.connections[0]!.id);
    });

    it('при выбранной связи переключатель меняет её, а не значение по умолчанию', () => {
        const editor = empty();
        const a = editor.addNodeAtCenter('note');
        const b = editor.addNodeAtCenter('note');
        editor.startConnect({ node: a.id, side: 'right' }, [0, 0]);
        editor.finishConnect({ node: b.id, side: 'left' });

        editor.setArrowStyle('end');
        expect(editor.workspace.connections[0]!.arrow).toBe('end');
        expect(editor.defaultArrow).toBe('none');
    });

    it('связь на ту же ноду отвергается', () => {
        const editor = empty();
        const a = editor.addNodeAtCenter('note');
        editor.startConnect({ node: a.id, side: 'right' }, [0, 0]);
        expect(editor.finishConnect({ node: a.id, side: 'left' })).toBe(false);
        expect(editor.workspace.connections).toEqual([]);
    });

    it('правки текста склеиваются в один шаг undo, resize тоже откатывается', () => {
        const editor = empty();
        const n = editor.addNodeAtCenter('note');

        editor.patchData(n.id, { text: 'п' });
        editor.patchData(n.id, { text: 'пр' });
        editor.patchData(n.id, { text: 'при' });
        expect(editor.workspace.nodes[n.id]!.data.text).toBe('при');

        editor.undo();
        expect(editor.workspace.nodes[n.id]!.data.text).toBe('');

        const start = { x: n.x, y: n.y, w: n.w, h: n.h };
        editor.resizeFrom(n.id, 'se', start, -1000, -1000); // не меньше минимума типа
        expect(editor.workspace.nodes[n.id]).toMatchObject({ w: 120, h: 80 });
    });

    it('палитра по связи ставит ноду так, чтобы её пин оказался под курсором, и подключает', () => {
        const editor = empty();
        const a = editor.addNodeAtCenter('note');
        editor.openPalette([0, 0], [500, 300], { node: a.id, side: 'right' });
        editor.createFromPalette('image');

        const image = Object.values(editor.workspace.nodes).find((n) => n.type === 'image')!;
        expect(image).toMatchObject({ x: 500, y: 300 - image.h / 2 });
        expect(editor.workspace.connections[0]).toMatchObject({ from: { node: a.id, side: 'right' }, to: { node: image.id, side: 'left' } });
    });

    it('удаление выделенной связи не трогает ноды', () => {
        const editor = empty();
        const a = editor.addNodeAtCenter('note');
        const b = editor.addNodeAtCenter('note');
        editor.startConnect({ node: a.id, side: 'right' }, [0, 0]);
        editor.finishConnect({ node: b.id, side: 'left' });

        editor.removeSelected();
        expect(editor.workspace.connections).toEqual([]);
        expect(Object.keys(editor.workspace.nodes)).toHaveLength(2);
    });
});

describe('linkShape', () => {
    it('без стрелки наконечника нет', () => {
        expect(linkShape([0, 0], 'right', [200, 0], 'left', 'none', 1).head).toBeNull();
    });

    it('наконечник упирается в пин и смотрит в ноду, линия кончается внутри него', () => {
        const left = linkShape([0, 0], 'right', [200, 0], 'left', 'end', 1);
        expect(left.head).toMatch(/^M 200 0 L 186 /); // с левой грани стрелка идёт вправо
        expect(left.d).toMatch(/188\.8 0$/);

        const right = linkShape([300, 0], 'left', [200, 0], 'right', 'end', 1);
        expect(right.head).toMatch(/^M 200 0 L 214 /);
    });

    it('размер наконечника на экране не зависит от масштаба', () => {
        const head = linkShape([0, 0], 'right', [200, 0], 'left', 'end', 2).head!;
        expect(head).toMatch(/^M 200 0 L 193 /); // 14px экрана = 7 мировых единиц при zoom 2
    });
});

describe('isImageUrl', () => {
    it('пропускает http(s), data:image и blob, остальное нет', () => {
        expect(isImageUrl('https://a.b/c.png')).toBe(true);
        expect(isImageUrl('data:image/svg+xml;utf8,<svg/>')).toBe(true);
        expect(isImageUrl('javascript:alert(1)')).toBe(false);
        expect(isImageUrl('file:///c:/x.png')).toBe(false);
        expect(isImageUrl('')).toBe(false);
    });
});

describe('вертикальные связи', () => {
    beforeEach(() => setActivePinia(createPinia()));

    it('палитра по нижнему пину ставит новую ноду под курсор её верхним пином', () => {
        const editor = useEditor();
        editor.loadWorkspace({ nodes: {}, connections: [] }, undefined, true);
        const a = editor.addNodeAtCenter('note');
        editor.openPalette([0, 0], [500, 300], { node: a.id, side: 'bottom' });
        editor.createFromPalette('image'); // 260 x 200

        const image = Object.values(editor.workspace.nodes).find((n) => n.type === 'image')!;
        expect(image).toMatchObject({ x: 500 - 130, y: 300 });
        expect(editor.workspace.connections[0]).toMatchObject({ from: { side: 'bottom' }, to: { node: image.id, side: 'top' } });
    });

    it('стрелка сверху вниз: наконечник упирается в верхний пин и смотрит вниз', () => {
        const shape = linkShape([0, 0], 'bottom', [0, 200], 'top', 'end', 1);
        expect(shape.head).toMatch(/^M 0 200 L /);
        expect(shape.d).toMatch(/0 188\.8$/);
        const ys = [...shape.head!.matchAll(/L (-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[2]));
        expect(ys).toEqual([186, 186]); // основание выше острия
    });
});

describe('перетаскивание группы', () => {
    beforeEach(() => setActivePinia(createPinia()));

    it('двигает вложенные ноды вместе с собой, а после отпускания перестаёт', () => {
        const editor = useEditor();
        editor.loadWorkspace({ nodes: {}, connections: [] }, undefined, true);
        const g = editor.addNodeAtCenter('group');
        const n = editor.addNodeAtCenter('note'); // центр экрана: попадает внутрь группы
        const before = { x: n.x, y: n.y };

        editor.setSelection([g.id]);
        editor.beginDrag();
        editor.moveSelected(30, 10);
        editor.endDrag();
        expect(editor.workspace.nodes[n.id]).toMatchObject({ x: before.x + 30, y: before.y + 10 });

        editor.moveSelected(5, 5); // группа выбрана, но захвата нет: вложенная нода стоит
        expect(editor.workspace.nodes[n.id]).toMatchObject({ x: before.x + 30, y: before.y + 10 });
    });
});

describe('оборванный жест', () => {
    beforeEach(() => setActivePinia(createPinia()));

    it('cancelConnect снимает протягиваемую связь и ничего не создаёт', () => {
        const editor = useEditor();
        editor.loadWorkspace({ nodes: {}, connections: [] }, undefined, true);
        const a = editor.addNodeAtCenter('note');

        editor.startConnect({ node: a.id, side: 'right' }, [0, 0]);
        expect(editor.pending).not.toBeNull();

        editor.cancelConnect();
        expect(editor.pending).toBeNull();
        expect(editor.workspace.connections).toEqual([]);
    });
});

describe('точка на связи', () => {
    beforeEach(() => setActivePinia(createPinia()));

    function twoLinked() {
        const editor = useEditor();
        editor.loadWorkspace({ nodes: {}, connections: [] }, undefined, true);
        const a = editor.addNodeAtCenter('note');
        const b = editor.addNodeAtCenter('note');
        editor.startConnect({ node: a.id, side: 'right' }, [0, 0]);
        editor.finishConnect({ node: b.id, side: 'left' });
        return { editor, a, b };
    }

    it('двойной клик по связи ставит точку и выделяет её, undo возвращает прямую связь', () => {
        const { editor } = twoLinked();
        const id = editor.workspace.connections[0]!.id;

        const point = editor.splitConnection(id, [100, 100])!;
        expect(editor.workspace.connections).toHaveLength(2);
        expect([...editor.selection]).toEqual([point.id]);

        editor.undo();
        expect(editor.workspace.connections).toHaveLength(1);
        expect(editor.workspace.connections[0]!.id).toBe(id);
    });

    it('Delete на выделенной точке растворяет её', () => {
        const { editor } = twoLinked();
        editor.splitConnection(editor.workspace.connections[0]!.id, [100, 100]);

        editor.removeSelected(); // выделена точка
        expect(Object.keys(editor.workspace.nodes)).toHaveLength(2);
        expect(editor.workspace.connections).toHaveLength(1);
    });

    it('связь от точки поворачивается к курсору, а к точке — со стороны источника', () => {
        const { editor, a } = twoLinked();
        const point = editor.splitConnection(editor.workspace.connections[0]!.id, [5000, 5000])!;

        editor.startConnect({ node: point.id, side: 'right' }, [5000, 6000]);
        expect(editor.pending!.origin.side).toBe('bottom'); // курсор строго под точкой

        editor.updateConnect([4000, 5000], null);
        expect(editor.pending!.origin.side).toBe('left');

        // тянем от обычной ноды в точку: у точки сторона смотрит на источник
        editor.cancelConnect();
        point.x = 5000;
        point.y = a.y - 10; // центр точки на одной высоте с верхним пином ноды a
        editor.startConnect({ node: a.id, side: 'top' }, [0, 0]);
        editor.updateConnect([5000, a.y], { node: point.id, side: 'right' });
        expect(editor.pending!.target!.side).toBe('left'); // источник строго слева от точки
    });
});
