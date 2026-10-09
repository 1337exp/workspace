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
        undo: 'Undo (Ctrl+Z)',
        redo: 'Redo (Ctrl+Y)',
    },

    link: {
        line: 'Line',
        arrow: 'Arrow',
        reverse: 'Reverse',
        style: 'Link style',
    },

    palette: {
        add: 'Add node',
        connect: 'New node for the link',
        search: 'Search…',
        empty: 'Nothing found',
    },

    touch: {
        select: 'Select',
        selectHint: 'Select mode: one finger draws a box, tapping a node adds it to the selection',
        delete: 'Delete',
    },

    nodes: {
        note: { placeholder: 'Note text…' },
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
