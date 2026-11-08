import { defineStore } from 'pinia';
import { markRaw, ref } from 'vue';
import { parse, serialize } from '@/core/serialize';
import type { Workspace } from '@/core/types';
import { nodesBounds } from '@/core/bounds';
import { createWorkspace } from '@/core/workspace';
import type { MessageKey } from '@/i18n';
import { createDefaultRegistry } from '@/nodes';
import { createDocumentSession, type SessionNotice } from '@1337exp/taoux/session';
import { createDemo } from './demo';
import { storage } from './persistence';
import { useConnect } from './state/connect';
import { useDrag } from './state/drag';
import { useEdit } from './state/edit';
import { usePlace } from './state/place';
import { usePrefs } from './state/prefs';
import { useSelection } from './state/selection';
import { useTool } from './state/tool';
import { useView } from './state/view';

export type { PendingConnection } from './state/connect';
export type { PaletteState } from './state/place';

/** Короткое сообщение пользователю (результат открытия файла и т.п.). Хранит ключ перевода. */
export type Notice = SessionNotice<MessageKey>;

/**
 * Стор редактора. Сам почти ничего не делает: собирает срезы из `state/` (каждый про своё и зависит только от
 * того, что ему передали), подключает к ним сессию документа (история, автосохранение, файлы) и отдаёт всё под
 * одним именем. Правки, меняющие пространство, оборачиваются в `recorded`: это и есть шаг истории.
 *
 * The editor store. It does almost nothing itself: it assembles the slices from `state/` (each is about one thing
 * and depends only on what it is given), attaches the document session (history, autosave, files) and exposes it
 * all under one name. Edits that change the workspace are wrapped in `recorded`: that is the history step.
 */
export const useEditor = defineStore('editor', () => {
    const registry = markRaw(createDefaultRegistry());
    const workspace = ref<Workspace>(createDemo(registry));

    const view = useView();
    const sel = useSelection();
    const prefs = usePrefs();
    const drag = useDrag({ workspace, registry, selection: sel.selection, view, snapEnabled: prefs.snapEnabled, guidesEnabled: prefs.guidesEnabled });
    const edit = useEdit({ workspace, registry, selection: sel, defaultArrow: prefs.defaultArrow, view });
    const link = useConnect({ workspace, registry, selection: sel, defaultArrow: prefs.defaultArrow });
    const place = usePlace({ workspace, registry, selection: sel, view, defaultArrow: prefs.defaultArrow });

    /** Открытое контекстное меню: точка на холсте (px) и то, на что нажали. */
    const contextMenu = ref<{ screen: [number, number]; world: [number, number]; target: { kind: 'node'; nodeId: string } | { kind: 'link'; id: string } | { kind: 'empty' } } | null>(null);

    /** Связь, у которой сейчас правят подпись (поле на середине линии). */
    const labelEditing = ref<string | null>(null);

    /** Нода, которую правят на месте (текст). Двойной клик или новая нода включают, конец правки выключает. */
    const editingNode = ref<string | null>(null);
    const tool = useTool({ workspace, registry, selection: sel, place, snapEnabled: prefs.snapEnabled, editingNode });

    /** Нода, у которой сейчас правится название (двойной клик по полосе). */
    const titleEditing = ref<string | null>(null);

    // Незавершённые действия не входят в историю, но не должны ссылаться на исчезнувшее.
    const dropStale = () => {
        link.cancelConnect();
        place.closePalette();
    };

    const session = createDocumentSession<Workspace, MessageKey>({
        document: { get: () => workspace.value, set: (next) => (workspace.value = next) },
        camera: { get: () => view.camera.value, set: (next) => (view.camera.value = next) },
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
            sel.clearSelection();
            editingNode.value = null;
            labelEditing.value = null;
            contextMenu.value = null;
            dropStale();
        },
        onRestore(ws) {
            for (const id of [...sel.selection]) if (!ws.nodes[id]) sel.selection.delete(id);
            if (sel.selectedConnection.value && !ws.connections.some((c) => c.id === sel.selectedConnection.value)) sel.selectedConnection.value = null;
            dropStale();
        },
    });

    const { recorded } = session;

    /**
     * Правый клик по ноде или связи. Нода, не входящая в выделение, становится выделением (как в Figma); входящая
     * оставляет выделение как есть, и меню действует на всё выделенное. У пустого места своё меню (вставить, выбрать всё, добавить ноду).
     */
    function openContext(screen: [number, number], target: { kind: 'node'; nodeId: string } | { kind: 'link'; id: string } | { kind: 'empty' }, world: [number, number] = [0, 0]): boolean {
        if (target.kind === 'node') {
            if (!sel.selection.has(target.nodeId)) sel.selectOnly(target.nodeId);
            else sel.selectedConnection.value = null;
        } else if (target.kind === 'link') {
            sel.selectOnlyConnection(target.id);
        } // пустое место: выделение остаётся, меню про вставку и выбор
        place.closePalette();
        contextMenu.value = { screen, world, target };
        return true;
    }

    const closeContext = () => (contextMenu.value = null);

    /** Начать правку подписи связи (по умолчанию выбранной). */
    function startLabelEdit(id: string | null = sel.selectedConnection.value) {
        if (id && workspace.value.connections.some((c) => c.id === id)) labelEditing.value = id;
    }

    // Конец правки: `text` — что набрали, `null` — отмена. Подпись пишется отдельным шагом истории.
    const saveLabel = recorded((id: string, text: string) => edit.setLinkLabel(id, text));
    function endLabelEdit(id: string, text: string | null) {
        if (labelEditing.value === id) labelEditing.value = null;
        if (text !== null) saveLabel(id, text);
    }

    function startEdit(id: string) {
        if (registry.find(workspace.value.nodes[id]?.type ?? '')?.inlineEdit) editingNode.value = id;
    }

    // Пустую ноду удаляет отдельный шаг истории: появление и исчезновение пустого текста остаются отдельными правками.
    const dropEmpty = recorded((id: string) => edit.dropIfEmpty(id));
    function endEdit(id: string) {
        if (editingNode.value === id) editingNode.value = null;
        dropEmpty(id);
    }

    return {
        registry,
        workspace,
        titleEditing,
        editingNode,
        labelEditing,
        startLabelEdit,
        endLabelEdit,
        contextMenu,
        openContext,
        closeContext,
        startEdit,
        endEdit,
        fitHeight: edit.fitHeight,

        // вид
        camera: view.camera,
        viewport: view.viewport,
        zoomBy: view.zoomBy,
        zoomReset: view.zoomReset,
        fitAll: () => view.fitTo(nodesBounds(workspace.value)),

        // выделение
        selection: sel.selection,
        selectedConnection: sel.selectedConnection,
        setSelection: sel.setSelection,
        toggleSelected: sel.toggleSelected,
        selectConnection: sel.selectConnection,

        // настройки
        snapEnabled: prefs.snapEnabled,
        guidesEnabled: prefs.guidesEnabled,
        background: prefs.background,
        guides: drag.guides,
        theme: prefs.theme,
        defaultArrow: prefs.defaultArrow,
        selectMode: prefs.selectMode,

        // документ: история, автосохранение, файлы
        notice: session.notice,
        canUndo: session.canUndo,
        canRedo: session.canRedo,
        showNotice: session.showNotice,
        exportText: session.exportText,
        importText: session.importText,
        newWorkspace: session.newDocument,
        loadWorkspace: session.load,
        restoreSaved: session.restoreSaved,
        startAutosave: session.startAutosave,
        flushSave: session.flushSave,
        commit: session.commit,
        undo: session.undo,
        redo: session.redo,

        // перетаскивание и размер (шаг истории ставит холст жестом `commit`)
        beginDrag: drag.beginDrag,
        endDrag: drag.endDrag,
        moveSelected: drag.moveSelected,
        resizeFrom: drag.resizeFrom,
        raise: edit.raise,

        // правки
        colorable: edit.colorable,
        nodeActions: edit.nodeActions,
        runNodeAction: recorded(edit.runNodeAction),
        selectionColor: edit.selectionColor,
        alignSelected: recorded(edit.alignSelected),
        distributeSelected: recorded(edit.distributeSelected),
        straightenSelectedLink: recorded(edit.straightenSelectedLink),
        removeSelected: recorded(edit.removeSelected),
        duplicateSelected: recorded(edit.duplicateSelected),
        copySelected: edit.copySelected,
        cutSelected: recorded(edit.cutSelected),
        pasteText: recorded(edit.pasteText),
        selectAll: edit.selectAll,
        bringSelectedToFront: recorded(edit.bringSelectedToFront),
        sendSelectedToBack: recorded(edit.sendSelectedToBack),
        setColor: recorded(edit.setColor),
        splitConnection: recorded(edit.splitConnection),
        patchData: recorded(edit.patchData, (id) => `data:${id}`),
        setArrowStyle: recorded(edit.setArrowStyle),
        reverseSelected: recorded(edit.reverseSelected),

        // связь в процессе
        pending: link.pending,
        startConnect: link.startConnect,
        updateConnect: link.updateConnect,
        cancelConnect: link.cancelConnect,
        finishConnect: recorded(link.finishConnect),

        // инструмент панели слева
        tool: tool.tool,
        placeData: tool.placeData,
        placing: tool.placing,
        setTool: tool.setTool,
        cancelTool: tool.cancel,
        placeAt: recorded(tool.placeAt),

        // новые ноды и палитра
        palette: place.palette,
        openPalette: place.openPalette,
        closePalette: place.closePalette,
        addNodeAtCenter: recorded(place.addNodeAtCenter),
        createFromPalette: recorded(place.createFromPalette),
    };
});
