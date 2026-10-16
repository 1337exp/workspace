import { defineStore } from 'pinia';
import { computed, markRaw, reactive, ref, watch } from 'vue';
import { alignNodes, distributeNodes, straightenLink, type AlignKind, type DistributeAxis } from '@/core/align';
import { isNodeColor, type NodeColor } from '@/core/colors';
import { parse, serialize } from '@/core/serialize';
import type { Anchor, Arrow, NodeData, Workspace } from '@/core/types';
import type { Rect, ResizeEdge } from '@/core/workspace';
import {
    addNode,
    anchorPoint,
    canConnect,
    carriedBy,
    connect,
    createWorkspace,
    disconnect,
    dissolveNode,
    fitAnchor,
    oppositeSide,
    raiseToFront,
    removeNode,
    resizeRect,
    reverseConnection,
    setArrow,
    splitConnection as split,
} from '@/core/workspace';
import type { MessageKey } from '@/i18n';
import { createDefaultRegistry } from '@/nodes';
import { createCamera, screenToWorld, type Camera } from '@1337exp/taoux/camera';
import { GRID, snapThreshold, softSnap } from '@1337exp/taoux/snap';
import { createDemo } from './demo';
import { createDocumentSession, type SessionNotice } from '@1337exp/taoux/session';
import { storage } from './persistence';

/** Короткое сообщение пользователю (результат открытия файла и т.п.). Хранит ключ перевода. */
export type Notice = SessionNotice<MessageKey>;

const FALLBACK_MIN = { w: 100, h: 60 };

/** Связь, которую пользователь сейчас протягивает. */
export interface PendingConnection {
    /** Пин, с которого начали. */
    origin: Anchor;
    /** Курсор в мировых координатах. */
    cursor: [number, number];
    /** Пин под курсором (или ближайший к курсору пин ноды под ним). */
    target: Anchor | null;
    /** Цель допустима (true), недопустима (false) или цели нет (null). */
    valid: boolean | null;
}

/** Открытая палитра нод. */
export interface PaletteState {
    /** Позиция окна относительно холста, px. */
    screen: [number, number];
    /** Куда поставить новую ноду, мировые координаты. */
    world: [number, number];
    /** Если палитру открыли протягиванием связи — пин, от которого тянули. */
    origin: Anchor | null;
}

export const useEditor = defineStore('editor', () => {
    const registry = markRaw(createDefaultRegistry());
    const workspace = ref<Workspace>(createDemo(registry));
    const camera = ref<Camera>(createCamera());
    const selection = reactive(new Set<string>());
    const selectedConnection = ref<string | null>(null);
    const pending = ref<PendingConnection | null>(null);
    const palette = ref<PaletteState | null>(null);
    /** Сенсорный режим «Выделение»: один палец рисует рамку, тап по ноде добавляет или снимает её (роль Ctrl+клика). */
    const selectMode = ref(false);
    /** Нода, у которой сейчас правится название (двойной клик по полосе). */
    const titleEditing = ref<string | null>(null);
    /** Вид новых связей. Пока выбрана связь, переключатель меняет её, а не это значение. */
    const defaultArrow = ref<Arrow>('none');

    /** Размер видимой области холста (px): нужен, чтобы ставить новые ноды в центр экрана. Обновляет холст. */
    const viewport = ref({ w: 800, h: 600 });

    //---]>
    // выделение и правки

    function setSelection(ids: Iterable<string>) {
        const next = new Set(ids);
        for (const id of [...selection]) if (!next.has(id)) selection.delete(id);
        for (const id of next) selection.add(id);
    }

    /**
     * Нода, за которую взялись мышью, ложится поверх остальных. Группы остаются подложкой.
     * В историю не пишется (иначе каждый клик был бы шагом Ctrl+Z): порядок сохранится с ближайшей правкой.
     */
    function raise(id: string) {
        const type = workspace.value.nodes[id]?.type;
        if (type !== undefined && !registry.find(type)?.container) raiseToFront(workspace.value, id);
    }

    function toggleSelected(id: string) {
        if (!selection.delete(id)) selection.add(id);
    }

    function selectConnection(id: string | null) {
        selectedConnection.value = id;
    }

    /**
     * Привязка к сетке при перетаскивании и изменении размера. Включена по умолчанию, запоминается в браузере
     * (это настройка интерфейса, а не часть пространства, в файл она не попадает).
     */
    const SNAP_KEY = 'workspace.snap';
    const readSnap = () => {
        try {
            return localStorage.getItem(SNAP_KEY) !== 'off';
        } catch {
            return true;
        }
    };
    const snapEnabled = ref(readSnap());
    watch(snapEnabled, (on) => {
        try {
            localStorage.setItem(SNAP_KEY, on ? 'on' : 'off');
        } catch {
            // приватный режим: настройка просто не запомнится
        }
    });

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
            const t = snapThreshold(camera.value.z);
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
        const t = snapThreshold(camera.value.z);
        Object.assign(node, resizeRect(start, edge, dx, dy, minSizeOf(node.type), snap ? (v) => softSnap(v, GRID, t) : undefined));
    }

    /** Выравнивание, распределение и выпрямление связи: сами операции в core/align. */
    const alignSelected = (kind: AlignKind) => alignNodes(workspace.value, registry, selection, kind);
    const distributeSelected = (axis: DistributeAxis) => distributeNodes(workspace.value, registry, selection, axis);
    const straightenSelectedLink = () => (selectedConnection.value ? straightenLink(workspace.value, registry, selectedConnection.value) : false);

    /** Удаляет выделенную связь или выделенные ноды. */
    function removeSelected() {
        if (selectedConnection.value) {
            disconnect(workspace.value, selectedConnection.value);
            selectedConnection.value = null;
            return;
        }
        for (const id of selection) {
            // Точка растворяется (соседи соединяются напрямую), остальные ноды удаляются со связями.
            if (registry.find(workspace.value.nodes[id]?.type ?? '')?.point) dissolveNode(workspace.value, id);
            else removeNode(workspace.value, id);
        }
        selection.clear();
    }

    /** Выделенные ноды, которые можно красить (точки на связях нет: у них нет рамки и полосы). */
    const colorable = computed(() =>
        [...selection].filter((id) => {
            const node = workspace.value.nodes[id];
            return node !== undefined && !registry.find(node.type)?.point;
        }),
    );

    /** Цвет выделенных нод: общий (`null` — обычный), либо `'mixed'`, если у них разные. */
    const selectionColor = computed<NodeColor | null | 'mixed'>(() => {
        const colors = new Set(colorable.value.map((id) => workspace.value.nodes[id]!.color).map((c) => (isNodeColor(c) ? c : null)));
        if (colors.size !== 1) return colors.size === 0 ? null : 'mixed';
        return [...colors][0]!;
    });

    /** Красит выделенные ноды; `null` возвращает обычный цвет. */
    function setColor(color: NodeColor | null) {
        for (const id of colorable.value) {
            const node = workspace.value.nodes[id]!;
            if (color) node.color = color;
            else delete node.color;
        }
    }

    /** Двойной клик по связи: ставит в эту точку ноду-точку и выделяет её. */
    function splitConnection(connectionId: string, at: readonly [number, number]) {
        const node = split(workspace.value, registry, connectionId, at);
        if (!node) return null;
        setSelection([node.id]);
        selectedConnection.value = null;
        return node;
    }

    function patchData(nodeId: string, patch: NodeData) {
        const node = workspace.value.nodes[nodeId];
        if (node) Object.assign(node.data, patch);
    }

    /** Вид выбранной связи или, если связь не выбрана, вид новых связей. */
    function setArrowStyle(arrow: Arrow) {
        if (selectedConnection.value) setArrow(workspace.value, selectedConnection.value, arrow);
        else defaultArrow.value = arrow;
    }

    function reverseSelected() {
        if (selectedConnection.value) reverseConnection(workspace.value, selectedConnection.value);
    }

    /** Ставит ноду в центр видимой области и выделяет её. */
    function addNodeAtCenter(type: string) {
        const def = registry.get(type);
        const [cx, cy] = screenToWorld(camera.value, viewport.value.w / 2, viewport.value.h / 2);
        const node = addNode(workspace.value, registry, type, {
            x: Math.round(cx - def.size.w / 2),
            y: Math.round(cy - def.size.h / 2),
        });
        setSelection([node.id]);
        selectedConnection.value = null;
        return node;
    }

    //---]>
    // протягивание связи

    // У ноды-точки пин один: её сторона всегда смотрит туда, куда тянется связь.
    const fit = (anchor: Anchor, toward: readonly [number, number]) => fitAnchor(workspace.value, registry, anchor, toward);

    function startConnect(origin: Anchor, cursor: [number, number]) {
        pending.value = { origin: fit(origin, cursor), cursor, target: null, valid: null };
    }

    function updateConnect(cursor: [number, number], target: Anchor | null) {
        const p = pending.value;
        if (!p) return;
        p.cursor = cursor;
        p.origin = fit(p.origin, cursor);
        const origin = anchorPoint(workspace.value, p.origin);
        p.target = target && origin ? fit(target, origin) : target;
        p.valid = p.target ? canConnect(workspace.value, p.origin, p.target).ok : null;
    }

    /** Бросить протягивание без связи (жест оборван). */
    function cancelConnect() {
        pending.value = null;
    }

    /** Завершить протягивание. Возвращает true, если связь создана. */
    function finishConnect(target: Anchor | null): boolean {
        const p = pending.value;
        pending.value = null;
        const origin = p && anchorPoint(workspace.value, p.origin);
        const to = target && origin ? fit(target, origin) : null;
        if (!p || !to || !canConnect(workspace.value, p.origin, to).ok) return false;

        const created = connect(workspace.value, p.origin, to, defaultArrow.value);
        selectedConnection.value = created.id;
        selection.clear();
        return true;
    }

    //---]>
    // документ: история, автосохранение, файлы (механика в taoux/session)

    const session = createDocumentSession<Workspace, MessageKey>({
        document: { get: () => workspace.value, set: (next) => (workspace.value = next) },
        camera: { get: () => camera.value, set: (next) => (camera.value = next) },
        storage,
        codec: {
            serialize,
            parse(text) {
                const result = parse(text, registry);
                return result.ok ? { ok: true, doc: result.workspace, view: result.view, dropped: result.droppedConnections } : result;
            },
        },
        empty: createWorkspace,
        countNodes: (ws) => Object.keys(ws.nodes).length,
        keys: {
            loaded: 'file.loaded',
            loadedWithDropped: 'file.loadedWithDropped',
            newDocument: 'file.newWorkspace',
            saveFailed: 'file.error.saveFailed',
            restoreFailed: 'file.error.restoreFailed',
            loadError: (code) => `file.error.${code}` as MessageKey,
        },
        onReset() {
            selection.clear();
            selectedConnection.value = null;
            pending.value = null;
            palette.value = null;
        },
        onRestore(ws) {
            // Выделение и незавершённые действия не входят в историю, но не должны ссылаться на исчезнувшее.
            for (const id of [...selection]) if (!ws.nodes[id]) selection.delete(id);
            if (selectedConnection.value && !ws.connections.some((c) => c.id === selectedConnection.value)) {
                selectedConnection.value = null;
            }
            pending.value = null;
            palette.value = null;
        },
    });

    const { notice, showNotice, canUndo, canRedo, commit, undo, redo, recorded, exportText, importText, restoreSaved, startAutosave, flushSave } = session;
    const loadWorkspace = session.load;
    const newWorkspace = session.newDocument;

    //---]>
    // палитра нод

    function openPalette(screen: [number, number], world: [number, number], origin: Anchor | null = null) {
        palette.value = { screen, world, origin };
    }

    function closePalette() {
        palette.value = null;
    }

    /** Создаёт ноду в позиции палитры; если палитру открыли связью, подключает новую ноду к её пину. */
    function createFromPalette(type: string) {
        const p = palette.value;
        if (!p) return;

        const def = registry.get(type);
        const side = p.origin ? oppositeSide(p.origin.side) : null;
        // Пин новой ноды, к которому идёт связь, оказывается под курсором.
        let [x, y] = p.world;
        if (side === 'left') y -= def.size.h / 2;
        else if (side === 'right') [x, y] = [x - def.size.w, y - def.size.h / 2];
        else if (side === 'top') x -= def.size.w / 2;
        else if (side === 'bottom') [x, y] = [x - def.size.w / 2, y - def.size.h];
        const node = addNode(workspace.value, registry, type, { x: Math.round(x), y: Math.round(y) });

        if (p.origin && side) connect(workspace.value, p.origin, { node: node.id, side }, defaultArrow.value);

        setSelection([node.id]);
        selectedConnection.value = null;
        palette.value = null;
    }

    return {
        registry,
        workspace,
        camera,
        selection,
        selectedConnection,
        pending,
        palette,
        titleEditing,
        selectMode,
        defaultArrow,
        viewport,
        notice,
        canUndo,
        canRedo,

        showNotice,
        exportText,
        importText,
        newWorkspace,
        loadWorkspace,
        restoreSaved,
        startAutosave,
        flushSave,

        commit,
        undo,
        redo,

        setSelection,
        toggleSelected,
        raise,
        selectConnection,
        snapEnabled,
        beginDrag,
        endDrag,
        moveSelected,
        alignSelected: recorded(alignSelected),
        distributeSelected: recorded(distributeSelected),
        straightenSelectedLink: recorded(straightenSelectedLink),
        resizeFrom,
        removeSelected: recorded(removeSelected),
        colorable,
        selectionColor,
        setColor: recorded(setColor),
        splitConnection: recorded(splitConnection),
        patchData: recorded(patchData, (id) => `data:${id}`),
        setArrowStyle: recorded(setArrowStyle),
        reverseSelected: recorded(reverseSelected),
        addNodeAtCenter: recorded(addNodeAtCenter),

        startConnect,
        updateConnect,
        cancelConnect,
        finishConnect: recorded(finishConnect),

        openPalette,
        closePalette,
        createFromPalette: recorded(createFromPalette),
    };
});
