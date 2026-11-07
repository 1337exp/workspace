import { computed, type Ref } from 'vue';
import { alignNodes, distributeNodes, straightenLink, type AlignKind, type DistributeAxis } from '@/core/align';
import { isNodeColor, type NodeColor } from '@/core/colors';
import type { Registry } from '@/core/registry';
import type { Arrow, NodeData, Workspace } from '@/core/types';
import { disconnect, dissolveNode, raiseToFront, removeNode, reverseConnection, setArrow, splitConnection as split } from '@/core/workspace';
import type { SelectionSlice } from './selection';

interface Deps {
    workspace: Ref<Workspace>;
    registry: Registry;
    selection: SelectionSlice;
    defaultArrow: Ref<Arrow>;
}

/**
 * Правки содержимого: удаление, цвет, связи, выравнивание, данные ноды. Всё это меняет пространство, поэтому
 * стор оборачивает их в `recorded` (шаг истории); здесь они «голые».
 * Content edits: delete, colour, links, alignment, node data. All of them change the workspace, so the store wraps
 * them in `recorded` (a history step); here they are bare.
 */
export function useEdit({ workspace, registry, selection: sel, defaultArrow }: Deps) {
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
    };
}
