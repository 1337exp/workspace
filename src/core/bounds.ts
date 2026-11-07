import type { Workspace } from './types';
import { anchorPoint, type Rect } from './workspace';

/**
 * Прямоугольник, охватывающий ноды (все или перечисленные), в мировых координатах. `null`, если нод нет.
 * The rectangle that encloses nodes (all of them or the listed ones), in world units. `null` if there are none.
 */
export function nodesBounds(ws: Workspace, ids?: Iterable<string>): Rect | null {
    const nodes = ids ? [...ids].map((id) => ws.nodes[id]).filter((n) => n !== undefined) : Object.values(ws.nodes);
    if (nodes.length === 0) return null;

    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const n of nodes) {
        x0 = Math.min(x0, n.x);
        y0 = Math.min(y0, n.y);
        x1 = Math.max(x1, n.x + n.w);
        y1 = Math.max(y1, n.y + n.h);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Что сейчас выделено, одним прямоугольником: выделенные ноды, а если выделена связь, то охват её концов.
 * Нужен, чтобы повесить панель действий рядом с выделенным.
 * What is selected as one rectangle: the selected nodes, or, for a selected link, the span of its ends.
 * Needed to hang the action bar next to the selection.
 */
export function selectionBounds(ws: Workspace, nodeIds: Iterable<string>, connectionId: string | null): Rect | null {
    const nodes = nodesBounds(ws, nodeIds);
    if (nodes) return nodes;

    const link = connectionId ? ws.connections.find((c) => c.id === connectionId) : undefined;
    if (!link) return null;
    const a = anchorPoint(ws, link.from);
    const b = anchorPoint(ws, link.to);
    if (!a || !b) return null;
    return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]), h: Math.abs(a[1] - b[1]) };
}
