import { describe, expect, it } from 'vitest';
import { alignNodes, distributeNodes, straightenLink } from '@/core/align';
import { addNode, connect, createWorkspace, splitConnection } from '@/core/workspace';
import { createDefaultRegistry } from '@/nodes';

const registry = createDefaultRegistry();

/** Три заметки разной величины (по умолчанию 240×160, переопределяем). */
function three() {
    const ws = createWorkspace();
    addNode(ws, registry, 'note', { id: 'a', x: 100, y: 50, w: 100, h: 60 });
    addNode(ws, registry, 'note', { id: 'b', x: 300, y: 200, w: 200, h: 100 });
    addNode(ws, registry, 'note', { id: 'c', x: 700, y: 120, w: 150, h: 80 });
    return ws;
}
const pos = (ws: ReturnType<typeof three>, id: string) => [ws.nodes[id]!.x, ws.nodes[id]!.y];

describe('alignNodes', () => {
    it('по левому и правому краю общего прямоугольника', () => {
        const left = three();
        expect(alignNodes(left, registry, ['a', 'b', 'c'], 'left')).toBe(true);
        expect(['a', 'b', 'c'].map((id) => left.nodes[id]!.x)).toEqual([100, 100, 100]);

        const right = three(); // правый край общего прямоугольника: 850
        alignNodes(right, registry, ['a', 'b', 'c'], 'right');
        expect(['a', 'b', 'c'].map((id) => right.nodes[id]!.x + right.nodes[id]!.w)).toEqual([850, 850, 850]);
    });

    it('по верхнему и нижнему краю', () => {
        const top = three();
        alignNodes(top, registry, ['a', 'b', 'c'], 'top');
        expect(['a', 'b', 'c'].map((id) => top.nodes[id]!.y)).toEqual([50, 50, 50]);

        const bottom = three(); // нижний край: 300
        alignNodes(bottom, registry, ['a', 'b', 'c'], 'bottom');
        expect(['a', 'b', 'c'].map((id) => bottom.nodes[id]!.y + bottom.nodes[id]!.h)).toEqual([300, 300, 300]);
    });

    it('по центрам: горизонтальному и вертикальному', () => {
        const h = three(); // центр: (100 + 850) / 2 = 475
        alignNodes(h, registry, ['a', 'b', 'c'], 'hcenter');
        expect(['a', 'b', 'c'].map((id) => h.nodes[id]!.x + h.nodes[id]!.w / 2)).toEqual([475, 475, 475]);

        const v = three(); // центр: (50 + 300) / 2 = 175
        alignNodes(v, registry, ['a', 'b', 'c'], 'vmiddle');
        expect(['a', 'b', 'c'].map((id) => v.nodes[id]!.y + v.nodes[id]!.h / 2)).toEqual([175, 175, 175]);
    });

    it('меньше двух нод ничего не делает', () => {
        const ws = three();
        expect(alignNodes(ws, registry, ['a'], 'left')).toBe(false);
        expect(pos(ws, 'a')).toEqual([100, 50]);
    });

    it('уже выровненные ноды: ничего не сдвинулось', () => {
        const ws = three();
        alignNodes(ws, registry, ['a', 'b', 'c'], 'left');
        expect(alignNodes(ws, registry, ['a', 'b', 'c'], 'left')).toBe(false);
    });

    it('группа везёт за собой своё содержимое, а выделенное внутри двигается само', () => {
        const ws = createWorkspace();
        addNode(ws, registry, 'group', { id: 'g', x: 500, y: 0, w: 400, h: 300 });
        addNode(ws, registry, 'note', { id: 'inside', x: 520, y: 40, w: 100, h: 60 }); // не выделена: едет вместе с группой
        addNode(ws, registry, 'note', { id: 'free', x: 100, y: 400, w: 100, h: 60 });

        alignNodes(ws, registry, ['g', 'free'], 'left'); // группа уходит к x = 100
        expect(pos(ws as never, 'g')).toEqual([100, 0]);
        expect(ws.nodes.inside!.x).toBe(120); // сдвиг на −400 вместе с группой
        expect(ws.nodes.free!.x).toBe(100);
    });
});

describe('distributeNodes', () => {
    it('равные промежутки по горизонтали, крайние остаются на месте', () => {
        const ws = three(); // a: 100..200, b: 300..500, c: 700..850
        expect(distributeNodes(ws, registry, ['c', 'a', 'b'], 'x')).toBe(true);

        // общий размах 100..850 = 750, ширины 100+200+150 = 450, промежуток (750−450)/2 = 150
        expect(ws.nodes.a!.x).toBe(100);
        expect(ws.nodes.b!.x).toBe(350);
        expect(ws.nodes.c!.x).toBe(700);
        expect(ws.nodes.b!.x - (ws.nodes.a!.x + ws.nodes.a!.w)).toBe(ws.nodes.c!.x - (ws.nodes.b!.x + ws.nodes.b!.w));
    });

    it('по вертикали', () => {
        const ws = three(); // по верхнему краю: a 50, c 120, b 200
        distributeNodes(ws, registry, ['a', 'b', 'c'], 'y');
        // порядок по y: a(50..110), c(120..200), b(200..300); размах 50..300, высоты 60+80+100 = 240, промежуток 5
        expect(ws.nodes.a!.y).toBe(50);
        expect(ws.nodes.c!.y).toBe(115);
        expect(ws.nodes.b!.y).toBe(200);
    });

    it('меньше трёх нод ничего не делает', () => {
        const ws = three();
        expect(distributeNodes(ws, registry, ['a', 'b'], 'x')).toBe(false);
    });
});

describe('straightenLink', () => {
    it('двигает ноду, куда ведёт связь, чтобы концы оказались на одной высоте', () => {
        const ws = createWorkspace();
        addNode(ws, registry, 'note', { id: 'a', x: 0, y: 0, w: 200, h: 100 }); // правый пин: (200, 50)
        addNode(ws, registry, 'note', { id: 'b', x: 500, y: 130, w: 200, h: 100 }); // левый пин: (500, 180)
        const c = connect(ws, { node: 'a', side: 'right' }, { node: 'b', side: 'left' });

        expect(straightenLink(ws, registry, c.id)).toBe(true);
        expect(ws.nodes.b!.y).toBe(0); // центр b теперь на высоте центра a
        expect(ws.nodes.a!.y).toBe(0);
        expect(straightenLink(ws, registry, c.id)).toBe(false); // уже прямая
    });

    it('по вертикальным пинам выравнивает по горизонтали', () => {
        const ws = createWorkspace();
        addNode(ws, registry, 'note', { id: 'a', x: 0, y: 0, w: 200, h: 100 }); // нижний пин: (100, 100)
        addNode(ws, registry, 'note', { id: 'b', x: 60, y: 300, w: 100, h: 100 }); // верхний пин: (110, 300)
        const c = connect(ws, { node: 'a', side: 'bottom' }, { node: 'b', side: 'top' });

        straightenLink(ws, registry, c.id);
        expect(ws.nodes.b!.x + ws.nodes.b!.w / 2).toBe(100);
    });

    it('если у связи есть нода-точка, двигается она', () => {
        const ws = createWorkspace();
        addNode(ws, registry, 'note', { id: 'a', x: 0, y: 0, w: 200, h: 100 });
        addNode(ws, registry, 'note', { id: 'b', x: 600, y: 0, w: 200, h: 100 });
        const c = connect(ws, { node: 'a', side: 'right' }, { node: 'b', side: 'left' });
        const point = splitConnection(ws, registry, c.id, [400, 140])!;

        const first = ws.connections[0]!; // a → точка
        expect(straightenLink(ws, registry, first.id)).toBe(true);
        expect(ws.nodes.a!.y).toBe(0); // обычная нода на месте
        expect(point.y + point.h / 2).toBe(50); // точка встала на высоту пина a
    });
});
