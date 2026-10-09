import type { Registry } from './registry';
import type { Workspace } from './types';
import { carriedBy, resolveLink } from './workspace';

/** Выравнивание выделенных нод: по краям и центрам их общего прямоугольника. */
export type AlignKind = 'left' | 'hcenter' | 'right' | 'top' | 'vmiddle' | 'bottom';
export type DistributeAxis = 'x' | 'y';

type Delta = [number, number];

/**
 * Применяет сдвиги нод. Контейнер (группа) тянет за собой своё содержимое, как при перетаскивании: состав
 * считаем по положениям до любых сдвигов, а ноды, которые двигаются сами (выделены), в состав не входят.
 * (Контейнер, выделенный внутри другого выделенного контейнера, тут не разбирается: на практике это не встречается.)
 */
function applyMoves(ws: Workspace, registry: Registry, moves: Map<string, Delta>): boolean {
    const total = new Map<string, Delta>();
    const add = (id: string, dx: number, dy: number) => {
        const cur = total.get(id) ?? [0, 0];
        total.set(id, [cur[0] + dx, cur[1] + dy]);
    };

    for (const [id, [dx, dy]] of moves) {
        if (dx === 0 && dy === 0) continue;
        add(id, dx, dy);
        for (const child of carriedBy(ws, registry, [id])) if (!moves.has(child)) add(child, dx, dy);
    }

    for (const [id, [dx, dy]] of total) {
        const node = ws.nodes[id];
        if (node) {
            node.x += dx;
            node.y += dy;
        }
    }
    return total.size > 0;
}

/** Выравнивает ноды по краю или центру их общего прямоугольника. Меньше двух нод — ничего. Возвращает true, если что-то сдвинулось. */
export function alignNodes(ws: Workspace, registry: Registry, ids: Iterable<string>, kind: AlignKind): boolean {
    const nodes = [...ids].map((id) => ws.nodes[id]).filter((n) => n !== undefined);
    if (nodes.length < 2) return false;

    const left = Math.min(...nodes.map((n) => n.x));
    const right = Math.max(...nodes.map((n) => n.x + n.w));
    const top = Math.min(...nodes.map((n) => n.y));
    const bottom = Math.max(...nodes.map((n) => n.y + n.h));

    const moves = new Map<string, Delta>();
    for (const n of nodes) {
        let x = n.x;
        let y = n.y;
        if (kind === 'left') x = left;
        else if (kind === 'right') x = right - n.w;
        else if (kind === 'hcenter') x = (left + right) / 2 - n.w / 2;
        else if (kind === 'top') y = top;
        else if (kind === 'bottom') y = bottom - n.h;
        else y = (top + bottom) / 2 - n.h / 2;
        moves.set(n.id, [x - n.x, y - n.y]);
    }
    return applyMoves(ws, registry, moves);
}

/**
 * Раскладывает ноды с равными промежутками по оси. Крайние (по порядку вдоль оси) остаются на месте,
 * остальные встают между ними. Меньше трёх нод — ничего.
 */
export function distributeNodes(ws: Workspace, registry: Registry, ids: Iterable<string>, axis: DistributeAxis): boolean {
    const nodes = [...ids].map((id) => ws.nodes[id]).filter((n) => n !== undefined);
    if (nodes.length < 3) return false;

    const start = (n: (typeof nodes)[number]) => (axis === 'x' ? n.x : n.y);
    const size = (n: (typeof nodes)[number]) => (axis === 'x' ? n.w : n.h);
    const sorted = [...nodes].sort((a, b) => start(a) - start(b));

    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const span = start(last) + size(last) - start(first);
    const gap = (span - sorted.reduce((sum, n) => sum + size(n), 0)) / (sorted.length - 1);

    const moves = new Map<string, Delta>();
    let cursor = start(first) + size(first) + gap;
    for (const n of sorted.slice(1, -1)) {
        const delta = cursor - start(n);
        moves.set(n.id, axis === 'x' ? [delta, 0] : [0, delta]);
        cursor += size(n) + gap;
    }
    return applyMoves(ws, registry, moves);
}

/**
 * Выпрямляет связь: сдвигает одну из её нод поперёк, чтобы концы оказались на одной линии
 * (как «Straighten Connections» в Blueprint). Двигается нода-точка, если она есть, иначе та, куда ведёт связь.
 * Ось определяется стороной начала связи: у левого и правого пина совпадают высоты, у верхнего и нижнего положения по горизонтали.
 */
export function straightenLink(ws: Workspace, registry: Registry, connectionId: string): boolean {
    const c = ws.connections.find((x) => x.id === connectionId);
    const link = c && resolveLink(ws, registry, c);
    if (!c || !link) return false;

    const horizontal = link.aSide === 'left' || link.aSide === 'right';
    const delta = horizontal ? link.a[1] - link.b[1] : link.a[0] - link.b[0];
    if (delta === 0) return false;

    const isPoint = (id: string) => !!registry.find(ws.nodes[id]?.type ?? '')?.point;
    // Если у связи есть нода-точка, двигаем её (ей всё равно, где стоять), иначе ту ноду, куда ведёт связь.
    const mover = isPoint(c.from.node) && !isPoint(c.to.node) ? c.from.node : c.to.node;
    const sign = mover === c.to.node ? 1 : -1;
    return applyMoves(ws, registry, new Map([[mover, horizontal ? [0, sign * delta] : [sign * delta, 0]]]));
}
