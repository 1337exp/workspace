import { dataVersionOf } from './define';
import { uid } from './ids';
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
 * Противоположная грань стоит на месте.
 */
export function resizeRect(start: Rect, edge: ResizeEdge, dx: number, dy: number, min: { w: number; h: number }): Rect {
    const r = { ...start };
    if (edge.includes('e')) r.w = Math.max(min.w, start.w + dx);
    if (edge.includes('w')) {
        r.w = Math.max(min.w, start.w - dx);
        r.x = start.x + start.w - r.w;
    }
    if (edge.includes('s')) r.h = Math.max(min.h, start.h + dy);
    if (edge.includes('n')) {
        r.h = Math.max(min.h, start.h - dy);
        r.y = start.y + start.h - r.h;
    }
    return r;
}
