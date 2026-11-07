import { ref, type Ref } from 'vue';
import type { Registry } from '@/core/registry';
import type { Anchor, Arrow, Workspace } from '@/core/types';
import { addNode, connect, oppositeSide } from '@/core/workspace';
import type { SelectionSlice } from './selection';
import type { ViewSlice } from './view';

/** Открытая палитра нод. / The open node palette. */
export interface PaletteState {
    /** Позиция окна относительно холста, px. */
    screen: [number, number];
    /** Куда поставить новую ноду, мировые координаты. */
    world: [number, number];
    /** Если палитру открыли протягиванием связи — пин, от которого тянули. */
    origin: Anchor | null;
}

interface Deps {
    workspace: Ref<Workspace>;
    registry: Registry;
    selection: SelectionSlice;
    view: ViewSlice;
    defaultArrow: Ref<Arrow>;
}

/**
 * Создание нод: в центр экрана и из палитры (правый клик по пустому месту или связь, отпущенная над пустым).
 * Creating nodes: at the screen centre and from the palette (a right click on empty space, or a link released over it).
 */
export function usePlace({ workspace, registry, selection, view, defaultArrow }: Deps) {
    const palette = ref<PaletteState | null>(null);

    function openPalette(screen: [number, number], world: [number, number], origin: Anchor | null = null) {
        palette.value = { screen, world, origin };
    }

    function closePalette() {
        palette.value = null;
    }

    /** Ставит ноду в центр видимой области и выделяет её. */
    function addNodeAtCenter(type: string) {
        const def = registry.get(type);
        const [cx, cy] = view.centerWorld();
        const node = addNode(workspace.value, registry, type, {
            x: Math.round(cx - def.size.w / 2),
            y: Math.round(cy - def.size.h / 2),
        });
        selection.selectOnly(node.id);
        return node;
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

        selection.selectOnly(node.id);
        palette.value = null;
    }

    return { palette, openPalette, closePalette, addNodeAtCenter, createFromPalette };
}

export type PlaceSlice = ReturnType<typeof usePlace>;
