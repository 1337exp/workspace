import { downloadText, MAX_FILE_BYTES } from '@1337exp/taoux/file';
import type { useEditor } from './store';

type Editor = ReturnType<typeof useEditor>;

export const FILE_NAME = 'workspace.json';

/** Сохраняет пространство файлом. / Saves the workspace as a file. */
export function saveToFile(editor: Editor) {
    editor.flushSave();
    downloadText(FILE_NAME, editor.exportText());
}

/**
 * Открывает окно выбора файла и грузит выбранное. Вызывать из обработчика действия пользователя (клик, клавиша):
 * иначе браузер не покажет окно выбора.
 * Opens the file picker and loads what was chosen. Call it from a user action (a click, a key): otherwise the
 * browser will not show the picker.
 */
export function openFromFile(editor: Editor) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > MAX_FILE_BYTES) {
            editor.showNotice('error', 'file.error.tooLarge');
            return;
        }
        editor.importText(await file.text());
    });
    input.click();
}
