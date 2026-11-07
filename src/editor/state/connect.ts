import { ref, type Ref } from 'vue';
import type { Registry } from '@/core/registry';
import type { Anchor, Arrow, Workspace } from '@/core/types';
import { anchorPoint, canConnect, connect, fitAnchor } from '@/core/workspace';
import type { SelectionSlice } from './selection';

/** Связь, которую пользователь сейчас протягивает. / A link the user is dragging out right now. */
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

interface Deps {
    workspace: Ref<Workspace>;
    registry: Registry;
    selection: SelectionSlice;
    defaultArrow: Ref<Arrow>;
}

/**
 * Протягивание связи от пина к пину. Сама связь создаётся в `finishConnect`.
 * Dragging a link from pin to pin. The link itself is created in `finishConnect`.
 */
export function useConnect({ workspace, registry, selection, defaultArrow }: Deps) {
    const pending = ref<PendingConnection | null>(null);

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
        selection.selectOnlyConnection(created.id);
        return true;
    }

    return { pending, startConnect, updateConnect, cancelConnect, finishConnect };
}
