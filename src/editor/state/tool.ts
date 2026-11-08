import { ref, computed, type Ref } from 'vue';
import type { Registry } from '@/core/registry';
import type { NodeData, Workspace } from '@/core/types';
import { addNode } from '@/core/workspace';
import { GRID } from '@1337exp/taoux/snap';
import type { PlaceSlice } from './place';
import type { SelectionSlice } from './selection';

/** Инструмент: `select` (обычная работа) или id типа ноды, которую поставит следующий клик. */
export type ToolId = string;
export const SELECT_TOOL: ToolId = 'select';

interface Deps {
    workspace: Ref<Workspace>;
    registry: Registry;
    selection: SelectionSlice;
    place: PlaceSlice;
    snapEnabled: Ref<boolean>;
    /** Нода, которую сейчас правят на месте. */
    editingNode: Ref<string | null>;
}

/**
 * Текущий инструмент панели слева. «Выбор» это обычное состояние; инструмент ноды ждёт клика по холсту, ставит ноду
 * в это место и сам возвращается к выбору (как в Figma и FigJam). Esc отменяет.
 * The current tool of the left dock. "Select" is the normal state; a node tool waits for a click on the canvas,
 * puts the node there and returns to select on its own (as in Figma and FigJam). Esc cancels.
 */
export function useTool({ workspace, registry, selection, place, snapEnabled, editingNode }: Deps) {
    const tool = ref<ToolId>(SELECT_TOOL);
    /** Данные для ноды, которую поставит следующий клик (выбранный эмодзи); без них берутся данные по умолчанию. */
    const placeData = ref<NodeData | null>(null);
    /** Включён инструмент «поставить». / A "place" tool is armed. */
    const placing = computed(() => tool.value !== SELECT_TOOL && registry.find(tool.value) !== undefined);

    function setTool(id: ToolId, data?: NodeData) {
        tool.value = id === SELECT_TOOL || registry.find(id) ? id : SELECT_TOOL;
        placeData.value = tool.value === SELECT_TOOL ? null : (data ?? null);
        if (tool.value !== SELECT_TOOL) place.closePalette();
    }

    /**
     * Клик по холсту с инструментом ноды: нода центром в точку клика (на сетке, если привязка включена), выделить,
     * вернуться к выбору.
     */
    function placeAt(world: readonly [number, number]) {
        if (!placing.value) return null;
        const def = registry.get(tool.value);
        const fit = (v: number) => (snapEnabled.value ? Math.round(v / GRID) * GRID : Math.round(v));
        const node = addNode(workspace.value, registry, def.id, { x: fit(world[0] - def.size.w / 2), y: fit(world[1] - def.size.h / 2), ...(placeData.value ? { data: placeData.value } : {}) });
        placeData.value = null;
        selection.selectOnly(node.id);
        // Текст и ему подобные сразу ждут ввода.
        if (def.inlineEdit) editingNode.value = node.id;
        tool.value = SELECT_TOOL;
        return node;
    }

    /**
     * Esc: сначала снимает инструмент, потом закрывает палитру, потом снимает выделение.
     * Esc: first drops the tool, then closes the palette, then clears the selection.
     */
    function cancel() {
        if (tool.value !== SELECT_TOOL) {
            tool.value = SELECT_TOOL;
            placeData.value = null;
        } else if (place.palette.value) place.closePalette();
        else selection.clearSelection();
    }

    return { tool, placeData, placing, setTool, placeAt, cancel };
}

export type ToolSlice = ReturnType<typeof useTool>;
