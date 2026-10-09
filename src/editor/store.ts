import { defineStore } from 'pinia';
import { markRaw, reactive, ref } from 'vue';
import { parse, serialize, type LoadError, type SavedView } from '@/core/serialize';
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
import type { MessageArgs, MessageKey } from '@/i18n';
import { createDefaultRegistry } from '@/nodes';
import { createCamera, MAX_ZOOM, MIN_ZOOM, screenToWorld, type Camera } from './camera';
import { createDemo } from './demo';
import { History } from './history';
import { backupBroken, readSaved, writeSaved } from './persistence';

/** Короткое сообщение пользователю (результат открытия файла и т.п.). Хранит ключ перевода. */
export interface Notice {
    kind: 'info' | 'error';
    key: MessageKey;
    args?: MessageArgs;
}

const NOTICE_MS = 5000;
const AUTOSAVE_DELAY_MS = 400;
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

    /** Ноды, едущие вместе с перетаскиваемыми контейнерами. Считается один раз при захвате, пока тащим. */
    let carried = new Set<string>();

    function beginDrag() {
        carried = carriedBy(workspace.value, registry, selection);
    }

    function endDrag() {
        carried = new Set();
    }

    function moveSelected(dx: number, dy: number) {
        for (const id of [...selection, ...carried]) {
            const node = workspace.value.nodes[id];
            if (node) {
                node.x += dx;
                node.y += dy;
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
    function resizeFrom(id: string, edge: ResizeEdge, start: Rect, dx: number, dy: number) {
        const node = workspace.value.nodes[id];
        if (!node) return;
        Object.assign(node, resizeRect(start, edge, dx, dy, minSizeOf(node.type)));
    }

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
    // уведомления, файлы, автосохранение

    const notice = ref<Notice | null>(null);
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;

    function showNotice(kind: Notice['kind'], key: MessageKey, args?: MessageArgs) {
        notice.value = { kind, key, args };
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => (notice.value = null), NOTICE_MS);
    }

    let autosaveOn = false;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let saveFailedShown = false;

    /** Записывает пространство и положение камеры в localStorage. */
    function flushSave() {
        clearTimeout(saveTimer);
        saveTimer = undefined;
        if (!autosaveOn) return;

        if (writeSaved(serialize(workspace.value, camera.value, false))) {
            saveFailedShown = false;
        } else if (!saveFailedShown) {
            saveFailedShown = true; // сообщаем один раз, а не при каждой правке
            showNotice('error', 'file.error.saveFailed');
        }
    }

    function scheduleSave() {
        if (!autosaveOn) return;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(flushSave, AUTOSAVE_DELAY_MS);
    }

    /**
     * Включает автосохранение. Выключено по умолчанию (в тестах и до восстановления ничего не пишется).
     * Правки сохраняются с небольшой задержкой, а при скрытии вкладки и закрытии — сразу.
     * Возвращает функцию, которая всё отключает.
     */
    function startAutosave(): () => void {
        autosaveOn = true;
        const onHide = () => {
            if (document.visibilityState === 'hidden') flushSave();
        };
        window.addEventListener('pagehide', flushSave);
        document.addEventListener('visibilitychange', onHide);

        return () => {
            autosaveOn = false;
            clearTimeout(saveTimer);
            window.removeEventListener('pagehide', flushSave);
            document.removeEventListener('visibilitychange', onHide);
        };
    }

    /** Подменяет пространство целиком. Без `resetHistory` это обычная правка: её можно отменить. */
    function loadWorkspace(next: Workspace, view?: SavedView, resetHistory = false) {
        workspace.value = next;
        selection.clear();
        selectedConnection.value = null;
        pending.value = null;
        palette.value = null;
        if (view) camera.value = { x: view.x, y: view.y, z: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.z)) };

        if (resetHistory) {
            history.reset(snapshot());
            syncHistory();
        } else {
            commit();
        }
    }

    /** Текст файла для скачивания. */
    const exportText = () => serialize(workspace.value, camera.value);

    function errorNotice(error: LoadError): Notice {
        const detail = error.detail === undefined ? undefined : [error.detail];
        return { kind: 'error', key: `file.error.${error.code}`, args: detail };
    }

    /** Открывает пространство из текста файла. При ошибке ничего не меняется. Результат показывается уведомлением. */
    function importText(text: string): LoadError | null {
        const result = parse(text, registry);
        if (!result.ok) {
            const n = errorNotice(result.error);
            showNotice(n.kind, n.key, n.args);
            return result.error;
        }

        loadWorkspace(result.workspace, result.view);
        const nodes = Object.keys(result.workspace.nodes).length;
        if (result.droppedConnections > 0) showNotice('error', 'file.loadedWithDropped', [nodes, result.droppedConnections]);
        else showNotice('info', 'file.loaded', [nodes]);
        return null;
    }

    function newWorkspace() {
        loadWorkspace(createWorkspace(), { x: 0, y: 0, z: 1 });
        showNotice('info', 'file.newWorkspace');
    }

    /** При старте приложения: поднимает пространство из автосохранения. Возвращает true, если было что поднимать. */
    function restoreSaved(): boolean {
        const text = readSaved();
        if (text === null) return false;

        const result = parse(text, registry);
        if (!result.ok) {
            backupBroken(text);
            showNotice('error', 'file.error.restoreFailed');
            return false;
        }

        loadWorkspace(result.workspace, result.view, true);
        return true;
    }

    //---]>
    // undo/redo

    const snapshot = () => JSON.stringify(workspace.value);
    const history = new History(snapshot());
    const canUndo = ref(false);
    const canRedo = ref(false);

    function syncHistory() {
        canUndo.value = history.canUndo;
        canRedo.value = history.canRedo;
        scheduleSave(); // пространство изменилось (правка, undo или redo) — автосохранение подхватит
    }

    /** Запоминает текущее состояние как шаг истории. Одинаковый `key` подряд склеивает правки (набор текста). */
    function commit(key?: string) {
        history.commit(snapshot(), key);
        syncHistory();
    }

    function restore(state: string | null): boolean {
        if (state === null) return false;

        workspace.value = JSON.parse(state);
        // Выделение и незавершённые действия не входят в историю, но не должны ссылаться на исчезнувшее.
        for (const id of [...selection]) if (!workspace.value.nodes[id]) selection.delete(id);
        if (selectedConnection.value && !workspace.value.connections.some((c) => c.id === selectedConnection.value)) {
            selectedConnection.value = null;
        }
        pending.value = null;
        palette.value = null;
        syncHistory();
        return true;
    }

    const undo = () => restore(history.undo());
    const redo = () => restore(history.redo());

    /** Действие, меняющее пространство: после него состояние попадает в историю. */
    function recorded<A extends unknown[], R>(fn: (...args: A) => R, key?: (...args: A) => string): (...args: A) => R {
        return (...args) => {
            const result = fn(...args);
            commit(key?.(...args));
            return result;
        };
    }

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
        beginDrag,
        endDrag,
        moveSelected,
        resizeFrom,
        removeSelected: recorded(removeSelected),
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
