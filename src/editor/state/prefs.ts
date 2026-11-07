import { ref, watch } from 'vue';
import { createSavedStorage } from '@1337exp/taoux/storage';
import type { Arrow } from '@/core/types';

/**
 * Настройки интерфейса. Привязка к сетке запоминается в браузере (это не часть пространства, в файл она не
 * попадает); вид новых связей и сенсорный режим «Выделение» живут только до перезагрузки.
 * UI preferences. Grid snapping is remembered in the browser (it is not part of the workspace and is not
 * written to the file); the look of new links and the touch "Select" mode last until a reload.
 */
const prefsStorage = createSavedStorage('workspace.prefs');

interface Saved {
    snap?: boolean;
}

function readSaved(): Saved {
    try {
        const parsed: unknown = JSON.parse(prefsStorage.read() ?? '{}');
        return typeof parsed === 'object' && parsed !== null ? (parsed as Saved) : {};
    } catch {
        return {};
    }
}

export function usePrefs() {
    const saved = readSaved();

    const snapEnabled = ref(saved.snap !== false);
    watch(snapEnabled, (snap) => prefsStorage.write(JSON.stringify({ snap } satisfies Saved)));

    /** Вид новых связей. Пока выбрана связь, переключатель меняет её, а не это значение. */
    const defaultArrow = ref<Arrow>('none');

    /** Сенсорный режим «Выделение»: один палец рисует рамку, тап по ноде добавляет или снимает её (роль Ctrl+клика). */
    const selectMode = ref(false);

    return { snapEnabled, defaultArrow, selectMode };
}

export type PrefsSlice = ReturnType<typeof usePrefs>;
