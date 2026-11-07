import type { CanvasHost, CanvasOptions } from '@1337exp/taoux/canvas';
import type { Anchor, Side } from '@/core/types';
import type { useEditor } from './store';

type Editor = ReturnType<typeof useEditor>;

/** Мост между общим холстом (taoux/canvas) и стором пространства: холст разбирает жесты, стор решает, что они значат. */
export function workspaceCanvasHost(editor: Editor, claimsKey: (event: KeyboardEvent) => boolean): CanvasHost<Anchor> {
    return {
        // Сочетания команд (Delete, Ctrl+Z, ...) обрабатывает реестр команд, холст их не трогает.
        claimsKey,

        // Инструмент «поставить» из панели слева: следующее нажатие по холсту ставит ноду.
        get placing() {
            return editor.placing;
        },
        placeAt: (_screen, world) => void editor.placeAt(world),

        get camera() {
            return editor.camera;
        },
        setCamera: (camera) => {
            editor.camera = camera;
        },
        setViewport: (size) => {
            editor.viewport = size;
        },

        get selection() {
            return editor.selection;
        },
        setSelection: (ids) => editor.setSelection(ids),
        toggleSelected: (id) => editor.toggleSelected(id),
        selectConnection: (id) => editor.selectConnection(id),

        raise: (id) => editor.raise(id),
        beginDrag: (id) => editor.beginDrag(id),
        moveSelected: (dx, dy, snap) => editor.moveSelected(dx, dy, snap),
        endDrag: () => editor.endDrag(),

        commit: () => editor.commit(),
        undo: () => editor.undo(),
        redo: () => editor.redo(),
        removeSelected: () => editor.removeSelected(),

        get paletteOpen() {
            return editor.palette !== null;
        },
        openPalette: (screen, world, origin) => editor.openPalette(screen, world, origin),
        closePalette: () => editor.closePalette(),

        connect: {
            get origin() {
                return editor.pending?.origin ?? null;
            },
            start: (pin, cursor) => editor.startConnect(pin, cursor),
            update: (cursor, target) => editor.updateConnect(cursor, target),
            finish: (target) => editor.finishConnect(target),
            cancel: () => editor.cancelConnect(),
        },
        resize: {
            rectOf(id) {
                const n = editor.workspace.nodes[id];
                return n ? { x: n.x, y: n.y, w: n.w, h: n.h } : null;
            },
            from: (id, edge, start, dx, dy, snap) => editor.resizeFrom(id, edge, start, dx, dy, snap),
        },

        activate(target) {
            if (target.kind === 'link') {
                editor.splitConnection(target.id, target.at);
            } else if (editor.registry.find(editor.workspace.nodes[target.nodeId]?.type ?? '')?.titleKey) {
                editor.titleEditing = target.nodeId;
            } else {
                editor.startEdit(target.nodeId);
            }
        },

        get snapEnabled() {
            return editor.snapEnabled;
        },
        get selectMode() {
            return editor.selectMode;
        },
    };
}

/** Пин под указателем: кружок на грани ноды или кольцо ноды-точки. */
function pinAt(target: EventTarget | null): Anchor | null {
    const pin = (target as Element | null)?.closest<HTMLElement>('[data-pin]');
    const node = pin?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId;
    // У ноды-точки пин «auto» (кольцо вокруг неё): конкретную сторону выберет стор по направлению связи.
    return pin && node ? { node, side: pin.dataset.pin === 'auto' ? 'right' : (pin.dataset.pin as Side) } : null;
}

/** Пин под курсором, а если курсор над телом ноды, то пин той стороны, к которой курсор ближе (деление по диагоналям). */
function pinNear(e: { clientX: number; clientY: number }): Anchor | null {
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const pin = pinAt(under);
    if (pin) return pin;

    const el = under?.closest<HTMLElement>('[data-node-id]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    // Смещение от центра в долях размера ноды: так диагонали идут по углам, а не под 45°.
    const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
    const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
    const side: Side = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'top' : 'bottom';
    return { node: el.dataset.nodeId!, side };
}

export const workspaceCanvasOptions: CanvasOptions<Anchor> = { pinAt, pinNear };
