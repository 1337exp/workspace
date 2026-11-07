import type ru from './ru';
import type { NodeTexts } from './types';

// Структура ключей обязана совпадать с ru.ts, кроме `nodeTexts`.
type Dict = Omit<typeof ru, 'nodeTexts'>;
type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

const en: Shape<Dict> & { nodeTexts: NodeTexts } = {
    ui: {
        language: 'Language',
    },

    file: {
        new: 'New',
        open: 'Open',
        save: 'Save',
        newWorkspace: 'New workspace created (undo available)',
        loaded: 'Nodes opened: {0} (undo available)',
        loadedWithDropped: 'Nodes opened: {0}. Invalid links dropped: {1}',
        error: {
            invalidJson: 'Could not read the file: not JSON',
            notWorkspaceFile: 'This is not a workspace file',
            newerVersion: 'The file was made by a newer version (format {0})',
            invalidStructure: 'The file is corrupted: {0}',
            tooLarge: 'The file is too large',
            restoreFailed: 'Could not restore the autosave, showing the demo',
            saveFailed: 'Autosave unavailable: the browser refuses to store data',
        },
    },

    history: {
        undo: 'Undo',
        redo: 'Redo',
    },

    link: {
        line: 'Line',
        arrow: 'Arrow',
        reverse: 'Reverse',
        style: 'Link style',
        label: 'Label',
        addLabel: 'Add a label',
        editLabel: 'Edit the label',
        labelPlaceholder: 'Label…',
    },

    palette: {
        add: 'Add node',
        connect: 'New node for the link',
        search: 'Search…',
        empty: 'Nothing found',
    },

    context: {
        title: 'Actions on the selection',
        duplicate: 'Duplicate',
        copy: 'Copy',
        cut: 'Cut',
        paste: 'Paste',
        selectAll: 'Select all',
        addNode: 'Add node…',
        front: 'Bring to front',
        back: 'Send to back',
        nodeActions: 'Node properties',
        color: 'Color',
        noColor: 'No color',
        delete: 'Delete',
        selected: 'Selected: {0}',
        straighten: 'Straighten',
        straightenHint: 'Move a node so that the link becomes straight',
        align: {
            title: 'Alignment',
            distribute: 'Distribute',
            left: 'Align left edges',
            hcenter: 'Align horizontal centers',
            right: 'Align right edges',
            top: 'Align top edges',
            vmiddle: 'Align vertical middles',
            bottom: 'Align bottom edges',
            distributeX: 'Distribute horizontally (three or more nodes)',
            distributeY: 'Distribute vertically (three or more nodes)',
        },
        colors: {
            red: 'Red',
            yellow: 'Yellow',
            green: 'Green',
            cyan: 'Cyan',
            blue: 'Blue',
            purple: 'Purple',
        },
    },

    grid: {
        label: 'Grid',
        hint: 'Snap to grid. Hold Alt to disable temporarily',
    },

    clipboard: {
        denied: 'The browser did not allow access to the clipboard: use Ctrl+C and Ctrl+V',
        nothing: 'The clipboard holds no nodes and no text that can be pasted',
    },

    guides: {
        label: 'Guides',
        hint: 'Lines and pulling to the edges and centres of other nodes. Hold Alt to disable temporarily',
    },

    tool: {
        dock: 'Tools',
        select: 'Select',
        cancel: 'Cancel',
        place: 'Place: {0}',
    },

    view: {
        zoomIn: 'Zoom in',
        zoomOut: 'Zoom out',
        zoom100: 'Zoom to 100%',
        fit: 'Zoom to fit',
        zoomBar: 'Zoom',
        options: 'View',
    },

    app: {
        menu: 'Menu',
        theme: 'Theme',
        dark: 'Dark',
        light: 'Light',
        help: 'Help',
    },

    help: {
        title: 'Controls',
        hotkeys: 'Hotkeys',
        pan: { label: 'Move the canvas', how: 'Right or middle mouse button, the wheel' },
        zoom: { label: 'Zoom', how: 'Ctrl + wheel, pinch on a trackpad' },
        marquee: { label: 'Select with a frame', how: 'Drag over an empty place' },
        link: { label: 'Connect', how: 'Drag from a pin to another node' },
        add: { label: 'Add a node', how: 'A tool on the left, or right click on an empty place' },
        clipboard: { label: 'Copy and paste', how: 'Ctrl+C, Ctrl+X, Ctrl+V through the system clipboard: works between tabs; text and an address from the clipboard become nodes' },
        snap: { label: 'Without grid snapping', how: 'Hold Alt while dragging' },
    },

    touch: {
        select: 'Select',
        selectHint: 'Select mode: one finger draws a box, tapping a node adds it to the selection',
    },

    nodes: {
        note: { placeholder: 'Note text…' },
        text: { placeholder: 'Text', action: { large: 'Large text' } },
        link: { placeholder: 'Link address', empty: 'Paste a link address', invalid: 'Not a web address (http or https needed)', open: 'Open' },
        checklist: { item: 'Item', add: 'Add item', move: 'Move item', collapse: 'Collapse subitems', expand: 'Expand subitems', indent: 'Nest under the previous one', outdent: 'Lift one level', progress: '{0} of {1}', action: { hideDone: 'Hide completed' } },
        image: {
            placeholder: 'Image URL',
            empty: 'Paste an image URL',
            broken: 'The image failed to load',
        },
        unknown: 'Unknown node "{0}"',
    },

    nodeTexts: { nodes: {} },
};

export default en;
