import type { Ref } from 'vue';
import type { Workspace } from '@/core/types';
import type { Registry } from '@/core/registry';
import { carriedBy, resizeRect, type Rect, type ResizeEdge } from '@/core/workspace';
import { GRID, snapThreshold, softSnap } from '@1337exp/taoux/snap';
import type { SelectionSlice } from './selection';
import type { ViewSlice } from './view';

const FALLBACK_MIN = { w: 100, h: 60 };

interface Deps {
    workspace: Ref<Workspace>;
    registry: Registry;
    selection: SelectionSlice['selection'];
    view: ViewSlice;
}

/**
 * Перетаскивание нод и изменение их размера, с мягкой привязкой к сетке.
 * Dragging nodes and resizing them, with soft grid snapping.
 */
export function useDrag({ workspace, registry, selection, view }: Deps) {
    /**
     * Состояние перетаскивания: стартовые положения всех двигающихся нод (выделенные и едущие с контейнерами),
     * захваченная нода, за левый верхний угол которой работает привязка, и накопленный «сырой» сдвиг мыши.
     * Положение считается от старта, а не накоплением приращений: иначе привязка «залипала» бы.
     */
    let drag: { start: Map<string, [number, number]>; primary: string | null; rx: number; ry: number } | null = null;
    /** Ноды, едущие вместе с перетаскиваемыми контейнерами. */
    let carried = new Set<string>();

    function beginDrag(primary?: string) {
        carried = carriedBy(workspace.value, registry, selection);
        const start = new Map<string, [number, number]>();
        for (const id of [...selection, ...carried]) {
            const node = workspace.value.nodes[id];
            if (node) start.set(id, [node.x, node.y]);
        }
        drag = { start, primary: primary !== undefined && start.has(primary) ? primary : ([...start.keys()][0] ?? null), rx: 0, ry: 0 };
    }

    function endDrag() {
        carried = new Set();
        drag = null;
    }

    /** Двигает выделенные ноды (и едущие с ними) на (dx, dy). С `snap` левый верхний угол захваченной ноды липнет к сетке. */
    function moveSelected(dx: number, dy: number, snap = false) {
        if (!drag) {
            // Без захвата (прямой вызов): простое смещение.
            for (const id of [...selection, ...carried]) {
                const node = workspace.value.nodes[id];
                if (node) {
                    node.x += dx;
                    node.y += dy;
                }
            }
            return;
        }

        drag.rx += dx;
        drag.ry += dy;
        let ox = drag.rx;
        let oy = drag.ry;

        const anchor = drag.primary ? drag.start.get(drag.primary) : undefined;
        if (snap && anchor) {
            const t = snapThreshold(view.camera.value.z);
            ox = softSnap(anchor[0] + ox, GRID, t) - anchor[0];
            oy = softSnap(anchor[1] + oy, GRID, t) - anchor[1];
        }

        for (const [id, [x, y]] of drag.start) {
            const node = workspace.value.nodes[id];
            if (node) {
                node.x = x + ox;
                node.y = y + oy;
            }
        }
    }

    function minSizeOf(type: string) {
        const size = registry.find(type)?.size;
        return { w: size?.minW ?? FALLBACK_MIN.w, h: size?.minH ?? FALLBACK_MIN.h };
    }

    /**
     * Тянет грань или угол ноды: `start` — прямоугольник в момент захвата, (dx, dy) — сдвиг мыши с тех пор
     * (мировые единицы). Размер не меньше минимума типа ноды.
     */
    function resizeFrom(id: string, edge: ResizeEdge, start: Rect, dx: number, dy: number, snap = false) {
        const node = workspace.value.nodes[id];
        if (!node) return;
        const t = snapThreshold(view.camera.value.z);
        Object.assign(node, resizeRect(start, edge, dx, dy, minSizeOf(node.type), snap ? (v) => softSnap(v, GRID, t) : undefined));
    }

    return { beginDrag, endDrag, moveSelected, resizeFrom };
}
