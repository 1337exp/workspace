import { describe, expect, it } from 'vitest';
import { defineNode } from '@/core/define';
import { Registry } from '@/core/registry';
import { parse, serialize } from '@/core/serialize';
import { addNode, anchorPoint, carriedBy, dissolveNode, resizeRect, resolveLink, sideToward, splitConnection, canConnect, connect, createWorkspace, removeNode, reverseConnection, setArrow } from '@/core/workspace';
import { createDefaultRegistry } from '@/nodes';

const L = (node: string) => ({ node, side: 'left' as const });
const R = (node: string) => ({ node, side: 'right' as const });

describe('workspace', () => {
    const registry = createDefaultRegistry();

    function two() {
        const ws = createWorkspace();
        addNode(ws, registry, 'note', { id: 'a', x: 0, y: 0 });
        addNode(ws, registry, 'image', { id: 'b', x: 400, y: 0 });
        return ws;
    }

    it('реестр подхватывает ноды из папок nodes/', () => {
        expect(registry.all().map((d) => d.id).sort()).toEqual(['group', 'image', 'note', 'reroute']);
    });

    it('новая нода получает размер и данные из определения', () => {
        const ws = createWorkspace();
        const n = addNode(ws, registry, 'note');
        expect(n).toMatchObject({ w: 240, h: 160, dataVersion: 1, data: { text: '' } });
    });

    it('соединяет любые пины разных нод, без типов', () => {
        const ws = two();
        expect(() => connect(ws, R('a'), L('b'))).not.toThrow();
        expect(() => connect(ws, L('a'), L('b'))).not.toThrow();
        expect(ws.connections).toHaveLength(2);
    });

    it('не даёт соединить ноду с собой и повторить связь (в том числе в обратную сторону)', () => {
        const ws = two();
        connect(ws, R('a'), L('b'));
        expect(canConnect(ws, R('a'), L('a'))).toEqual({ ok: false, reason: 'sameNode' });
        expect(canConnect(ws, R('a'), L('b'))).toEqual({ ok: false, reason: 'duplicate' });
        expect(canConnect(ws, L('b'), R('a'))).toEqual({ ok: false, reason: 'duplicate' });
        expect(canConnect(ws, R('a'), L('zzz'))).toEqual({ ok: false, reason: 'missingNode' });
    });

    it('стрелку можно включить, выключить и развернуть связь', () => {
        const ws = two();
        const c = connect(ws, R('a'), L('b'));
        expect(c.arrow).toBe('none');

        setArrow(ws, c.id, 'end');
        reverseConnection(ws, c.id);
        expect(ws.connections[0]).toMatchObject({ arrow: 'end', from: L('b'), to: R('a') });
    });

    it('удаление ноды убирает её связи', () => {
        const ws = two();
        connect(ws, R('a'), L('b'));
        removeNode(ws, 'a');
        expect(ws.connections).toEqual([]);
    });

    it('пины лежат на середине левой и правой граней', () => {
        const ws = two();
        expect(anchorPoint(ws, L('a'))).toEqual([0, 80]);
        expect(anchorPoint(ws, R('a'))).toEqual([240, 80]);
    });
});

describe('serialize', () => {
    const registry = createDefaultRegistry();

    it('туда и обратно без потерь, включая стрелки и вид', () => {
        const ws = createWorkspace();
        addNode(ws, registry, 'note', { id: 'a', data: { text: 'привет' } });
        addNode(ws, registry, 'image', { id: 'b', x: 300, data: { url: 'https://example.com/x.png' } });
        connect(ws, R('a'), L('b'), 'end');

        const result = parse(serialize(ws, { x: 5, y: 6, z: 1.5 }), registry);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.workspace).toEqual(ws);
        expect(result.view).toEqual({ x: 5, y: 6, z: 1.5 });
        expect(result.droppedConnections).toBe(0);
    });

    it('неизвестный тип ноды не ломает загрузку, а данные сохраняются как есть', () => {
        const text = JSON.stringify({
            format: 'workspace',
            version: 1,
            nodes: [{ id: 'x', type: 'from-future', x: 0, y: 0, w: 100, h: 80, dataVersion: 7, data: { secret: 42 } }],
            connections: [],
        });
        const result = parse(text, registry);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.workspace.nodes.x).toMatchObject({ type: 'from-future', dataVersion: 7, data: { secret: 42 } });
        expect(JSON.parse(serialize(result.workspace)).nodes[0].data).toEqual({ secret: 42 });
    });

    it('старые данные ноды проходят через migrate', () => {
        const v2 = new Registry().register(
            defineNode({
                id: 'card',
                title: 'Card',
                size: { w: 100, h: 100 },
                version: 2,
                create: () => ({ title: '', body: '' }),
                // v1 хранил один `text`
                migrate: (data, from) => (from < 2 ? { title: String(data.text ?? ''), body: '' } : { title: '', body: '', ...data }),
                component: {},
            }),
        );
        const text = JSON.stringify({
            format: 'workspace',
            version: 1,
            nodes: [{ id: 'c', type: 'card', x: 0, y: 0, w: 100, h: 100, dataVersion: 1, data: { text: 'старое' } }],
            connections: [],
        });
        const result = parse(text, v2);
        expect(result.ok && result.workspace.nodes.c).toMatchObject({ dataVersion: 2, data: { title: 'старое', body: '' } });
    });

    it('битые связи отбрасываются и считаются', () => {
        const ws = createWorkspace();
        addNode(ws, registry, 'note', { id: 'a' });
        addNode(ws, registry, 'note', { id: 'b' });
        connect(ws, R('a'), L('b'));
        const file = JSON.parse(serialize(ws));
        file.connections.push({ id: 'bad', from: { node: 'a', side: 'right' }, to: { node: 'ghost', side: 'left' } });

        const result = parse(JSON.stringify(file), registry);
        expect(result.ok && [result.workspace.connections.length, result.droppedConnections]).toEqual([1, 1]);
    });

    it('сообщает об ошибках кодом, не бросая', () => {
        expect(parse('{', registry)).toEqual({ ok: false, error: { code: 'invalidJson' } });
        expect(parse('{"a":1}', registry)).toEqual({ ok: false, error: { code: 'notWorkspaceFile' } });
        expect(parse('{"format":"workspace","version":99,"nodes":[],"connections":[]}', registry)).toEqual({
            ok: false,
            error: { code: 'newerVersion', detail: 99 },
        });
    });
});

describe('четыре стороны', () => {
    const registry = createDefaultRegistry();

    it('верхний и нижний пины лежат на серединах верхней и нижней граней', () => {
        const ws = createWorkspace();
        addNode(ws, registry, 'note', { id: 'a', x: 10, y: 20 }); // 240 x 160
        expect(anchorPoint(ws, { node: 'a', side: 'top' })).toEqual([130, 20]);
        expect(anchorPoint(ws, { node: 'a', side: 'bottom' })).toEqual([130, 180]);
    });

    it('связь сверху вниз сохраняется и читается обратно', () => {
        const ws = createWorkspace();
        addNode(ws, registry, 'note', { id: 'a' });
        addNode(ws, registry, 'note', { id: 'b', y: 300 });
        connect(ws, { node: 'a', side: 'bottom' }, { node: 'b', side: 'top' }, 'end');

        const result = parse(serialize(ws), registry);
        expect(result.ok && result.workspace.connections[0]).toMatchObject({ from: { side: 'bottom' }, to: { side: 'top' } });
    });

    it('неизвестная сторона в файле отбрасывает связь', () => {
        const ws = createWorkspace();
        addNode(ws, registry, 'note', { id: 'a' });
        addNode(ws, registry, 'note', { id: 'b' });
        const file = JSON.parse(serialize(ws));
        file.connections.push({ id: 'x', from: { node: 'a', side: 'middle' }, to: { node: 'b', side: 'top' }, arrow: 'none' });
        const result = parse(JSON.stringify(file), registry);
        expect(result.ok && result.droppedConnections).toBe(1);
    });
});

describe('группа (контейнер)', () => {
    const registry = createDefaultRegistry();

    function scene() {
        const ws = createWorkspace();
        addNode(ws, registry, 'group', { id: 'g', x: 0, y: 0, w: 500, h: 400 });
        addNode(ws, registry, 'note', { id: 'in', x: 20, y: 20 }); // целиком внутри
        addNode(ws, registry, 'note', { id: 'half', x: 400, y: 20 }); // выступает за край
        addNode(ws, registry, 'note', { id: 'out', x: 900, y: 900 });
        return ws;
    }

    it('вместе с группой едут только ноды, лежащие целиком внутри', () => {
        expect([...carriedBy(scene(), registry, ['g'])]).toEqual(['in']);
    });

    it('вложенная группа тянет своё содержимое, а выбранные ноды не дублируются', () => {
        const ws = scene();
        addNode(ws, registry, 'group', { id: 'g2', x: 10, y: 150, w: 300, h: 200 });
        addNode(ws, registry, 'note', { id: 'deep', x: 20, y: 200, w: 120, h: 80 });

        expect([...carriedBy(ws, registry, ['g'])].sort()).toEqual(['deep', 'g2', 'in']);
        expect([...carriedBy(ws, registry, ['g', 'in'])].sort()).toEqual(['deep', 'g2']);
    });

    it('обычная нода никого не несёт', () => {
        expect(carriedBy(scene(), registry, ['in']).size).toBe(0);
    });
});

describe('resizeRect', () => {
    const start = { x: 100, y: 100, w: 400, h: 300 };
    const min = { w: 160, h: 120 };

    it('восточная и южная грани двигают размер, не трогая положение', () => {
        expect(resizeRect(start, 'e', 50, 999, min)).toEqual({ x: 100, y: 100, w: 450, h: 300 });
        expect(resizeRect(start, 's', 999, -40, min)).toEqual({ x: 100, y: 100, w: 400, h: 260 });
    });

    it('западная и северная грани двигают и положение: противоположный край стоит на месте', () => {
        const r = resizeRect(start, 'w', -60, 0, min);
        expect(r).toMatchObject({ x: 40, w: 460 });
        expect(r.x + r.w).toBe(500);

        const n = resizeRect(start, 'n', 0, 30, min);
        expect(n).toMatchObject({ y: 130, h: 270 });
        expect(n.y + n.h).toBe(400);
    });

    it('угол тянет сразу две грани', () => {
        expect(resizeRect(start, 'nw', -20, -10, min)).toEqual({ x: 80, y: 90, w: 420, h: 310 });
        expect(resizeRect(start, 'se', 20, 10, min)).toEqual({ x: 100, y: 100, w: 420, h: 310 });
    });

    it('упор в минимум не сдвигает противоположный край, и грань возвращается за курсором', () => {
        const squeezed = resizeRect(start, 'w', 5000, 0, min);
        expect(squeezed).toMatchObject({ w: 160 });
        expect(squeezed.x + squeezed.w).toBe(500);

        // мышь вернулась: считаем от старта, а не от «упёртого» состояния
        expect(resizeRect(start, 'w', 100, 0, min)).toMatchObject({ x: 200, w: 300 });
    });
});

describe('нода-точка (reroute)', () => {
    const registry = createDefaultRegistry();

    function chain(arrow: 'none' | 'end' = 'end') {
        const ws = createWorkspace();
        addNode(ws, registry, 'note', { id: 'a', x: 0, y: 0 }); // правый пин (240, 80)
        addNode(ws, registry, 'note', { id: 'b', x: 600, y: 0 }); // левый пин (600, 80)
        const c = connect(ws, R('a'), L('b'), arrow);
        return { ws, c };
    }

    it('сторона «в сторону соседа» выбирается по большей оси', () => {
        expect(sideToward([0, 0], [10, 3])).toBe('right');
        expect(sideToward([0, 0], [-10, 3])).toBe('left');
        expect(sideToward([0, 0], [2, -9])).toBe('top');
        expect(sideToward([0, 0], [2, 9])).toBe('bottom');
    });

    it('двойной клик делит связь: точка на месте клика, стрелка остаётся на второй половине', () => {
        const { ws, c } = chain('end');
        const point = splitConnection(ws, registry, c.id, [400, 200])!;

        expect(point).toMatchObject({ type: 'reroute', x: 390, y: 190, w: 20, h: 20 });
        expect(ws.connections).toHaveLength(2);
        const [first, second] = ws.connections;
        expect(first).toMatchObject({ from: R('a'), to: { node: point.id }, arrow: 'none' });
        expect(second).toMatchObject({ from: { node: point.id }, to: L('b'), arrow: 'end' });
    });

    it('удаление точки растворяет её: соседи соединяются напрямую, стрелка сохраняется', () => {
        const { ws, c } = chain('end');
        const point = splitConnection(ws, registry, c.id, [400, 200])!;
        dissolveNode(ws, point.id);

        expect(Object.keys(ws.nodes).sort()).toEqual(['a', 'b']);
        expect(ws.connections).toHaveLength(1);
        expect(ws.connections[0]).toMatchObject({ from: R('a'), to: L('b'), arrow: 'end' });
    });

    it('точка-разветвитель: один вход и два выхода дают две прямые связи', () => {
        const { ws, c } = chain('none');
        addNode(ws, registry, 'note', { id: 'c', x: 600, y: 400 });
        const point = splitConnection(ws, registry, c.id, [400, 200])!;
        connect(ws, { node: point.id, side: 'right' }, L('c'));

        dissolveNode(ws, point.id);
        expect(ws.connections.map((x) => `${x.from.node}->${x.to.node}`).sort()).toEqual(['a->b', 'a->c']);
    });

    it('растворение не создаёт дубликатов и связей ноды с собой', () => {
        const { ws, c } = chain('none');
        const point = splitConnection(ws, registry, c.id, [400, 200])!;
        connect(ws, R('a'), L('b'), 'none'); // a→b уже есть напрямую
        dissolveNode(ws, point.id);
        expect(ws.connections).toHaveLength(1);
    });

    it('линия подходит к точке с той стороны, где сейчас сосед, даже после перемещения точки', () => {
        const { ws, c } = chain('none');
        const point = splitConnection(ws, registry, c.id, [400, 200])!;
        const toPoint = ws.connections[0]!;

        // сосед слева-сверху от точки
        expect(resolveLink(ws, registry, toPoint)).toMatchObject({ bSide: 'left' });

        // утащили точку левее ноды a: теперь сосед справа
        point.x = -300;
        point.y = 60;
        expect(resolveLink(ws, registry, toPoint)).toMatchObject({ bSide: 'right' });
    });
});
