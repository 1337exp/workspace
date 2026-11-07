import { computed, type Ref } from 'vue';
import { alignNodes, distributeNodes, straightenLink, type AlignKind, type DistributeAxis } from '@/core/align';
import { isNodeColor, type NodeColor } from '@/core/colors';
import type { Registry } from '@/core/registry';
import type { Arrow, NodeData, Workspace } from '@/core/types';
import { disconnect, dissolveNode, setLabel, duplicateNodes, lowerToBack, raiseToFront, removeNode, reverseConnection, setArrow, splitConnection as split } from '@/core/workspace';
import { copyText, insertNodes, pasteOffset, readClipboard } from '@/core/clipboard';
import { addNode } from '@/core/workspace';
import { isLinkUrl } from '@/nodes/link/url';
import type { SelectionSlice } from './selection';
import type { ViewSlice } from './view';

interface Deps {
    workspace: Ref<Workspace>;
    registry: Registry;
    selection: SelectionSlice;
    defaultArrow: Ref<Arrow>;
    view: ViewSlice;
}

/**
 * Правки содержимого: удаление, цвет, связи, выравнивание, данные ноды. Всё это меняет пространство, поэтому
 * стор оборачивает их в `recorded` (шаг истории); здесь они «голые».
 * Content edits: delete, colour, links, alignment, node data. All of them change the workspace, so the store wraps
 * them in `recorded` (a history step); here they are bare.
 */
export function useEdit({ workspace, registry, selection: sel, defaultArrow, view }: Deps) {
    const { selection } = sel;

    /**
     * Нода, за которую взялись мышью, ложится поверх остальных. Группы остаются подложкой.
     * В историю не пишется (иначе каждый клик был бы шагом Ctrl+Z): порядок сохранится с ближайшей правкой.
     */
    function raise(id: string) {
        const type = workspace.value.nodes[id]?.type;
        if (type !== undefined && !registry.find(type)?.container) raiseToFront(workspace.value, id);
    }

    /** Выравнивание, распределение и выпрямление связи: сами операции в core/align. */
    const alignSelected = (kind: AlignKind) => alignNodes(workspace.value, registry, selection, kind);
    const distributeSelected = (axis: DistributeAxis) => distributeNodes(workspace.value, registry, selection, axis);
    const straightenSelectedLink = () => (sel.selectedConnection.value ? straightenLink(workspace.value, registry, sel.selectedConnection.value) : false);

    /** Удаляет выделенную связь или выделенные ноды. */
    function removeSelected() {
        if (sel.selectedConnection.value) {
            disconnect(workspace.value, sel.selectedConnection.value);
            sel.selectedConnection.value = null;
            return;
        }
        for (const id of selection) {
            // Точка растворяется (соседи соединяются напрямую), остальные ноды удаляются со связями.
            if (registry.find(workspace.value.nodes[id]?.type ?? '')?.point) dissolveNode(workspace.value, id);
            else removeNode(workspace.value, id);
        }
        selection.clear();
    }

    /** Выделенные ноды, которые можно красить (точки на связи нет: у них нет рамки и полосы). */
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
        sel.selectOnly(node.id);
        return node;
    }

    function patchData(nodeId: string, patch: NodeData) {
        const node = workspace.value.nodes[nodeId];
        if (node) Object.assign(node.data, patch);
    }

    /** Вид выбранной связи или, если связь не выбрана, вид новых связей. */
    function setArrowStyle(arrow: Arrow) {
        if (sel.selectedConnection.value) setArrow(workspace.value, sel.selectedConnection.value, arrow);
        else defaultArrow.value = arrow;
    }

    /**
     * После правки на месте: пустая нода (по `isEmpty` её определения) удаляется. Возвращает, удалена ли.
     * After in-place editing: an empty node (by its definition's `isEmpty`) is removed. Returns whether it was.
     */
    function dropIfEmpty(nodeId: string): boolean {
        const node = workspace.value.nodes[nodeId];
        if (!node || !registry.find(node.type)?.isEmpty?.(node.data)) return false;
        removeNode(workspace.value, nodeId);
        selection.delete(nodeId);
        return true;
    }

    /**
     * Высота ноды следует за содержимым (текст): не меньше минимума типа. В историю не пишется: это следствие текста,
     * а не отдельная правка.
     * The node height follows its content (text): not below the type's minimum. Not recorded in history: it follows from
     * the text, it is not an edit of its own.
     */
    function fitHeight(nodeId: string, height: number) {
        const node = workspace.value.nodes[nodeId];
        if (!node) return;
        const min = registry.find(node.type)?.size.minH ?? 0;
        const next = Math.max(min, Math.ceil(height));
        if (node.h !== next) node.h = next;
    }

    /**
     * Переключатели, общие для выделения: показываются, когда выделены ноды одного типа, у которого они есть.
     * `checked` — включён у всех выделенных.
     */
    const nodeActions = computed(() => {
        const nodes = [...selection].map((id) => workspace.value.nodes[id]).filter((n) => n !== undefined);
        const types = new Set(nodes.map((n) => n.type));
        const def = types.size === 1 ? registry.find([...types][0]!) : undefined;
        return (def?.actions ?? []).map((a) => ({ id: a.id, icon: a.icon, type: def!.id, checked: nodes.every((n) => a.get(n.data)) }));
    });

    /** Нажатие на переключатель: если он включён у всех, выключает у всех, иначе включает у всех. */
    function runNodeAction(actionId: string) {
        const current = nodeActions.value.find((a) => a.id === actionId);
        if (!current) return;
        const action = registry.get(current.type).actions?.find((a) => a.id === actionId);
        if (!action) return;
        for (const id of selection) {
            const node = workspace.value.nodes[id];
            if (node) Object.assign(node.data, action.set(node.data, !current.checked));
        }
    }

    /** Копирует выделенные ноды (с вложенным в группы и связями между ними) со сдвигом и выделяет копии. */
    function duplicateSelected() {
        const copies = duplicateNodes(workspace.value, registry, selection);
        if (copies.length === 0) return;
        sel.setSelection(copies.map((n) => n.id));
        sel.selectedConnection.value = null;
    }

    // Группы всегда лежат подложкой (так рисует холст), их порядок ничего не меняет: пропускаем.
    const plainSelected = () =>
        Object.keys(workspace.value.nodes).filter((id) => selection.has(id) && !registry.find(workspace.value.nodes[id]!.type)?.container);

    /** Выделенные ноды поверх остальных, друг над другом в прежнем порядке. */
    function bringSelectedToFront() {
        for (const id of plainSelected()) raiseToFront(workspace.value, id);
    }

    /** Выделенные ноды под остальные, друг над другом в прежнем порядке. */
    function sendSelectedToBack() {
        for (const id of plainSelected().reverse()) lowerToBack(workspace.value, id);
    }

    //--------------------------------------------------
    // Буфер обмена: сам обмен с браузером в editor/clipboard.ts, здесь только содержимое и вставка.

    /** Текст для буфера: выбранные ноды с вложенным и связями между ними; `null`, если копировать нечего. */
    const copySelected = (): string | null => copyText(workspace.value, registry, selection);

    /** Вырезать: возвращает текст для буфера и удаляет скопированное. */
    function cutSelected(): string | null {
        const text = copySelected();
        if (text !== null) removeSelected();
        return text;
    }

    /** Сколько раз подряд вставили один и тот же текст: каждая следующая копия сдвигается, чтобы не слипаться. */
    let lastPaste: { text: string; count: number } = { text: '', count: 0 };

    /** Видимая область холста в мировых координатах. */
    function visibleWorld() {
        const { x, y, z } = view.camera.value;
        const { w, h } = view.viewport.value;
        return { x: -x / z, y: -y / z, w: w / z, h: h / z };
    }

    /**
     * Вставка текста из буфера. Ноды из нашего формата вставляются с новыми id и выделяются; адрес становится нодой
     * «Ссылка», прочий текст нодой «Текст». `at` — мировая точка (меню у курсора), без неё считается по видимой области.
     * Возвращает вставленные ноды; пустой массив, если вставлять нечего.
     */
    function pasteText(text: string, at?: readonly [number, number]) {
        const content = readClipboard(text, registry);
        if (!content) return [];

        const repeat = lastPaste.text === text ? lastPaste.count : 0;
        lastPaste = { text, count: repeat + 1 };

        let created;
        if (content.kind === 'nodes') {
            const [dx, dy] = pasteOffset(content.workspace, visibleWorld(), repeat, at);
            created = insertNodes(workspace.value, content.workspace, Math.round(dx), Math.round(dy));
        } else {
            const v = visibleWorld();
            const center = at ?? ([v.x + v.w / 2 + 24 * repeat, v.y + v.h / 2 + 24 * repeat] as const);
            const link = !/\s/.test(content.text) && isLinkUrl(content.text);
            const type = link ? 'link' : 'text';
            const def = registry.get(type);
            created = [
                addNode(workspace.value, registry, type, {
                    x: Math.round(center[0] - def.size.w / 2),
                    y: Math.round(center[1] - def.size.h / 2),
                    data: link ? { url: content.text } : { text: content.text },
                }),
            ];
        }
        sel.setSelection(created.map((n) => n.id));
        sel.selectedConnection.value = null;
        return created;
    }

    /** Выбрать все ноды. */
    function selectAll() {
        sel.setSelection(Object.keys(workspace.value.nodes));
        sel.selectedConnection.value = null;
    }

    /** Подпись связи; пустая убирает подпись. */
    const setLinkLabel = (connectionId: string, text: string) => setLabel(workspace.value, connectionId, text);

    function reverseSelected() {
        if (sel.selectedConnection.value) reverseConnection(workspace.value, sel.selectedConnection.value);
    }

    return {
        raise,
        alignSelected,
        distributeSelected,
        straightenSelectedLink,
        removeSelected,
        colorable,
        selectionColor,
        setColor,
        splitConnection,
        patchData,
        setArrowStyle,
        reverseSelected,
        duplicateSelected,
        setLinkLabel,
        copySelected,
        cutSelected,
        pasteText,
        selectAll,
        bringSelectedToFront,
        sendSelectedToBack,
        dropIfEmpty,
        fitHeight,
        nodeActions,
        runNodeAction,
    };
}
