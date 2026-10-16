import { dataVersionOf } from './define';
import { uid } from '@1337exp/taoux/ids';
import type { Registry } from './registry';
import type { Anchor, Arrow, Connection, NodeInstance, Side, Workspace } from './types';

export function createWorkspace(): Workspace {
    return { nodes: {}, connections: [] };
}

export function addNode(
    ws: Workspace,
    registry: Registry,
    type: string,
    init: Partial<Omit<NodeInstance, 'type' | 'dataVersion'>> = {},
): NodeInstance {
    const def = registry.get(type); // бросит ошибку, если типа нет

    const node: NodeInstance = {
        id: init.id ?? uid('n', (id) => id in ws.nodes),
        type,
        x: init.x ?? 0,
        y: init.y ?? 0,
        w: init.w ?? def.size.w,
        h: init.h ?? def.size.h,
        dataVersion: dataVersionOf(def),
        data: { ...def.create(), ...init.data },
        ...(init.color ? { color: init.color } : {}),
    };
    if (ws.nodes[node.id]) throw new Error(`Нода с id "${node.id}" уже есть`);

    ws.nodes[node.id] = node;
    return node;
}

export function removeNode(ws: Workspace, nodeId: string): void {
    delete ws.nodes[nodeId];
    ws.connections = ws.connections.filter((c) => c.from.node !== nodeId && c.to.node !== nodeId);
}

const sameAnchor = (a: Anchor, b: Anchor) => a.node === b.node && a.side === b.side;

export type ConnectCheck = { ok: true } | { ok: false; reason: 'missingNode' | 'sameNode' | 'duplicate' };

export function canConnect(ws: Workspace, from: Anchor, to: Anchor): ConnectCheck {
    if (!ws.nodes[from.node] || !ws.nodes[to.node]) return { ok: false, reason: 'missingNode' };
    if (from.node === to.node) return { ok: false, reason: 'sameNode' };

    // Та же пара пинов в любом направлении — это та же связь.
    const duplicate = ws.connections.some(
        (c) => (sameAnchor(c.from, from) && sameAnchor(c.to, to)) || (sameAnchor(c.from, to) && sameAnchor(c.to, from)),
    );
    return duplicate ? { ok: false, reason: 'duplicate' } : { ok: true };
}

/** Соединяет пины. Типов у пинов нет, так что соединить можно любые два пина разных нод. Бросает ошибку, если нельзя. */
export function connect(ws: Workspace, from: Anchor, to: Anchor, arrow: Arrow = 'none'): Connection {
    const check = canConnect(ws, from, to);
    if (!check.ok) throw new Error(`Нельзя соединить: ${check.reason}`);

    const connection: Connection = {
        id: uid('c', (id) => ws.connections.some((c) => c.id === id)),
        from: { ...from },
        to: { ...to },
        arrow,
    };
    ws.connections.push(connection);
    return connection;
}

export function disconnect(ws: Workspace, connectionId: string): void {
    ws.connections = ws.connections.filter((c) => c.id !== connectionId);
}

export function setArrow(ws: Workspace, connectionId: string, arrow: Arrow): void {
    const c = ws.connections.find((x) => x.id === connectionId);
    if (c) c.arrow = arrow;
}

/** Меняет направление связи: стрелка теперь смотрит на другую ноду. */
export function reverseConnection(ws: Workspace, connectionId: string): void {
    const c = ws.connections.find((x) => x.id === connectionId);
    if (c) [c.from, c.to] = [c.to, c.from];
}

/**
 * Ноды, которые едут вместе с выбранными контейнерами: лежат целиком внутри контейнера (и контейнеров внутри него).
 * Сами выбранные ноды в результат не входят: их двигают и так.
 */
export function carriedBy(ws: Workspace, registry: Registry, selected: Iterable<string>): Set<string> {
    const picked = new Set(selected);
    const carried = new Set<string>();
    const queue = [...picked];

    for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
        const box = ws.nodes[id];
        if (!box || !registry.find(box.type)?.container) continue;

        for (const n of Object.values(ws.nodes)) {
            if (n.id === id || picked.has(n.id) || carried.has(n.id)) continue;
            const inside = n.x >= box.x && n.y >= box.y && n.x + n.w <= box.x + box.w && n.y + n.h <= box.y + box.h;
            if (inside) {
                carried.add(n.id);
                queue.push(n.id); // вложенный контейнер тянет своё содержимое
            }
        }
    }
    return carried;
}

export const SIDES: readonly Side[] = ['left', 'right', 'top', 'bottom'];

const OPPOSITE: Record<Side, Side> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
export const oppositeSide = (side: Side): Side => OPPOSITE[side];

/** Мировые координаты пина: середина соответствующей грани ноды. */
export function anchorPoint(ws: Workspace, anchor: Anchor): [number, number] | null {
    const n = ws.nodes[anchor.node];
    if (!n) return null;
    switch (anchor.side) {
        case 'left':
            return [n.x, n.y + n.h / 2];
        case 'right':
            return [n.x + n.w, n.y + n.h / 2];
        case 'top':
            return [n.x + n.w / 2, n.y];
        case 'bottom':
            return [n.x + n.w / 2, n.y + n.h];
    }
}

/** За какую грань или угол тянут: стороны света (n — верх, e — право, ...). */
export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * Прямоугольник после того, как грань `edge` сдвинули на (dx, dy) от стартового `start`.
 * Считаем от старта, а не накапливаем приращения: упёрлись в минимум и вернули мышь, грань идёт за курсором.
 * Противоположная грань стоит на месте. Если передан `snap`, двигаемая грань привязывается через него
 * (до проверки минимума, поэтому минимальный размер он не нарушит).
 */
export function resizeRect(
    start: Rect,
    edge: ResizeEdge,
    dx: number,
    dy: number,
    min: { w: number; h: number },
    snap?: (value: number) => number,
): Rect {
    let left = start.x;
    let top = start.y;
    let right = start.x + start.w;
    let bottom = start.y + start.h;

    const s = snap ?? ((v: number) => v);
    if (edge.includes('e')) right = s(right + dx);
    if (edge.includes('w')) left = s(left + dx);
    if (edge.includes('s')) bottom = s(bottom + dy);
    if (edge.includes('n')) top = s(top + dy);

    // Минимум: двигаемая грань упирается, противоположная стоит на месте.
    if (right - left < min.w) {
        if (edge.includes('e')) right = left + min.w;
        else left = right - min.w;
    }
    if (bottom - top < min.h) {
        if (edge.includes('s')) bottom = top + min.h;
        else top = bottom - min.h;
    }
    return { x: left, y: top, w: right - left, h: bottom - top };
}

//--------------------------------------------------
// Ноды-точки (reroute)

type Point = readonly [number, number];

/** Сторона, в которую смотрит направление от `from` к `to`: по большей из осей. */
export function sideToward(from: Point, to: Point): Side {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'top' : 'bottom';
}

const isPoint = (ws: Workspace, registry: Registry, nodeId: string) => !!registry.find(ws.nodes[nodeId]?.type ?? '')?.point;
const centerOf = (n: NodeInstance): Point => [n.x + n.w / 2, n.y + n.h / 2];

/** Якорь, подогнанный под сторону, откуда идёт связь: у точки сторона всегда смотрит на `toward`, у обычной ноды якорь как есть. */
export function fitAnchor(ws: Workspace, registry: Registry, anchor: Anchor, toward: Point): Anchor {
    const node = ws.nodes[anchor.node];
    if (!node || !isPoint(ws, registry, anchor.node)) return anchor;
    return { node: anchor.node, side: sideToward(centerOf(node), toward) };
}

export interface ResolvedLink {
    a: Point;
    aSide: Side;
    b: Point;
    bSide: Side;
}

/**
 * Концы связи для рисования. Сохранённая сторона у точки не важна: точку двигают, и линия
 * должна подходить к ней с той стороны, где сейчас сосед.
 */
export function resolveLink(ws: Workspace, registry: Registry, c: Connection): ResolvedLink | null {
    const from = ws.nodes[c.from.node];
    const to = ws.nodes[c.to.node];
    if (!from || !to) return null;

    const fromEnd = anchorPoint(ws, c.from)!;
    const toEnd = anchorPoint(ws, c.to)!;
    const a = fitAnchor(ws, registry, c.from, isPoint(ws, registry, c.to.node) ? centerOf(to) : toEnd);
    const b = fitAnchor(ws, registry, c.to, isPoint(ws, registry, c.from.node) ? centerOf(from) : fromEnd);
    return { a: anchorPoint(ws, a)!, aSide: a.side, b: anchorPoint(ws, b)!, bSide: b.side };
}

/**
 * Двойной клик по связи: в точке `at` встаёт нода-точка, связь делится на две.
 * Стрелка остаётся на второй половине: она показывает направление всей цепочки.
 */
export function splitConnection(ws: Workspace, registry: Registry, connectionId: string, at: Point): NodeInstance | null {
    const c = ws.connections.find((x) => x.id === connectionId);
    const def = registry.all().find((d) => d.point);
    const a = c && anchorPoint(ws, c.from);
    const b = c && anchorPoint(ws, c.to);
    if (!c || !def || !a || !b) return null;

    const node = addNode(ws, registry, def.id, { x: at[0] - def.size.w / 2, y: at[1] - def.size.h / 2 });
    disconnect(ws, c.id);
    connect(ws, c.from, { node: node.id, side: sideToward(at, a) }, 'none');
    connect(ws, { node: node.id, side: sideToward(at, b) }, c.to, c.arrow);
    return node;
}

/**
 * Удаляет ноду-точку, соединяя её соседей напрямую: каждый вход с каждым выходом.
 * Стрелка сохраняется, если она была на любой из удалённых связей.
 */
export function dissolveNode(ws: Workspace, nodeId: string): void {
    const incoming = ws.connections.filter((c) => c.to.node === nodeId);
    const outgoing = ws.connections.filter((c) => c.from.node === nodeId);
    removeNode(ws, nodeId);

    for (const i of incoming) {
        for (const o of outgoing) {
            if (!canConnect(ws, i.from, o.to).ok) continue;
            connect(ws, i.from, o.to, i.arrow === 'end' || o.arrow === 'end' ? 'end' : 'none');
        }
    }
}

/**
 * Поднимает ноду над остальными: порядок отрисовки задаёт порядок ключей, поэтому перекладываем её в конец.
 * Возвращает false, если нода уже сверху или её нет (ничего не менялось).
 */
export function raiseToFront(ws: Workspace, nodeId: string): boolean {
    const node = ws.nodes[nodeId];
    const ids = Object.keys(ws.nodes);
    if (!node || ids[ids.length - 1] === nodeId) return false;

    delete ws.nodes[nodeId];
    ws.nodes[nodeId] = node;
    return true;
}
