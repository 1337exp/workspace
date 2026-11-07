import { ref, type Ref } from 'vue';
import type { Workspace } from '@/core/types';
import type { Registry } from '@/core/registry';
import { carriedBy, resizeRect, type Rect, type ResizeEdge } from '@/core/workspace';
import { GRID, SNAP_PX, snapThreshold, softSnap } from '@1337exp/taoux/snap';
import { snapToGuides, type GuideLine, type GuideRect } from '@1337exp/taoux/guides';
import type { SelectionSlice } from './selection';
import type { ViewSlice } from './view';

const FALLBACK_MIN = { w: 100, h: 60 };

interface Deps {
    workspace: Ref<Workspace>;
    registry: Registry;
    selection: SelectionSlice['selection'];
    view: ViewSlice;
    /** Привязка к сетке и направляющие: каждая включается своей настройкой, `Alt` отключает обе на время. */
    snapEnabled: Ref<boolean>;
    guidesEnabled: Ref<boolean>;
}

/**
 * Перетаскивание нод и изменение их размера, с мягкой привязкой к сетке.
 * Dragging nodes and resizing them, with soft grid snapping.
 */
export function useDrag({ workspace, registry, selection, view, snapEnabled, guidesEnabled }: Deps) {
    /** Направляющие, которые видны прямо сейчас (мировые координаты); пусто вне перетаскивания. */
    const guides = ref<GuideLine[]>([]);
    /**
     * Состояние перетаскивания: стартовые положения всех двигающихся нод (выделенные и едущие с контейнерами),
     * захваченная нода, за левый верхний угол которой работает привязка, и накопленный «сырой» сдвиг мыши.
     * Положение считается от старта, а не накоплением приращений: иначе привязка «залипала» бы.
     */
    let drag: {
        start: Map<string, [number, number]>;
        primary: string | null;
        rx: number;
        ry: number;
        /** Прямоугольник всех двигающихся нод на старте и прямоугольники остальных (кроме точек на связях). */
        box: GuideRect;
        others: GuideRect[];
    } | null = null;
    /** Ноды, едущие вместе с перетаскиваемыми контейнерами. */
    let carried = new Set<string>();

    function beginDrag(primary?: string) {
        carried = carriedBy(workspace.value, registry, selection);
        const start = new Map<string, [number, number]>();
        for (const id of [...selection, ...carried]) {
            const node = workspace.value.nodes[id];
            if (node) start.set(id, [node.x, node.y]);
        }
        drag = {
            start,
            primary: primary !== undefined && start.has(primary) ? primary : ([...start.keys()][0] ?? null),
            rx: 0,
            ry: 0,
            ...guideRects(start),
        };
    }

    /** Для направляющих: охват двигающихся нод и прямоугольники всех остальных. */
    function guideRects(moving: Map<string, [number, number]>): { box: GuideRect; others: GuideRect[] } {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        const others: GuideRect[] = [];
        for (const n of Object.values(workspace.value.nodes)) {
            if (moving.has(n.id)) {
                x0 = Math.min(x0, n.x);
                y0 = Math.min(y0, n.y);
                x1 = Math.max(x1, n.x + n.w);
                y1 = Math.max(y1, n.y + n.h);
            } else if (!registry.find(n.type)?.point) {
                others.push({ x: n.x, y: n.y, w: n.w, h: n.h });
            }
        }
        const box = Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 0, h: 0 };
        return { box, others };
    }

    function endDrag() {
        carried = new Set();
        drag = null;
        guides.value = [];
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

        // Направляющие главнее сетки: ось, которая встала на направляющую, сетке не подчиняется.
        let guidedX = false;
        let guidedY = false;
        const z = view.camera.value.z;
        if (snap && guidesEnabled.value && drag.others.length) {
            const moving = { ...drag.box, x: drag.box.x + ox, y: drag.box.y + oy };
            const res = snapToGuides(moving, drag.others, SNAP_PX / z);
            guidedX = res.lines.some((l) => l.axis === 'x');
            guidedY = res.lines.some((l) => l.axis === 'y');
            if (guidedX) ox += res.dx;
            if (guidedY) oy += res.dy;
        }

        const anchor = drag.primary ? drag.start.get(drag.primary) : undefined;
        if (snap && snapEnabled.value && anchor) {
            const t = snapThreshold(z);
            if (!guidedX) ox = softSnap(anchor[0] + ox, GRID, t) - anchor[0];
            if (!guidedY) oy = softSnap(anchor[1] + oy, GRID, t) - anchor[1];
        }

        // Линии строим по итоговому положению (сетка по другой оси могла его чуть сдвинуть).
        guides.value =
            snap && guidesEnabled.value && drag.others.length
                ? snapToGuides({ ...drag.box, x: drag.box.x + ox, y: drag.box.y + oy }, drag.others, 1e-3).lines
                : [];

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
        snap = snap && snapEnabled.value; // направляющие размера не касаются: только сетка
        const t = snapThreshold(view.camera.value.z);
        Object.assign(node, resizeRect(start, edge, dx, dy, minSizeOf(node.type), snap ? (v) => softSnap(v, GRID, t) : undefined));
    }

    return { guides, beginDrag, endDrag, moveSelected, resizeFrom };
}
