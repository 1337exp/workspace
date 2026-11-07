import { ref, watch } from 'vue';
import { applyTaoMode, type TaoMode } from '@1337exp/taoui';
import { createSavedStorage } from '@1337exp/taoux/storage';
import type { Arrow } from '@/core/types';

/**
 * Настройки интерфейса. Привязка к сетке и тема запоминаются в браузере (это не часть пространства, в файл они не
 * попадают); вид новых связей и сенсорный режим «Выделение» живут только до перезагрузки.
 * UI preferences. Grid snapping and the theme are remembered in the browser (not part of the workspace, not written
 * to the file); the look of new links and the touch "Select" mode last until a reload.
 */
const prefsStorage = createSavedStorage('workspace.prefs');

interface Saved {
    snap?: boolean;
    theme?: TaoMode;
}

function readSaved(): Saved {
    try {
        const parsed: unknown = JSON.parse(prefsStorage.read() ?? '{}');
        return typeof parsed === 'object' && parsed !== null ? (parsed as Saved) : {};
    } catch {
        return {};
    }
}

/** Тема по умолчанию: как у системы, а если не определить, тёмная. */
const systemTheme = (): TaoMode => (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

export function usePrefs() {
    const saved = readSaved();

    const snapEnabled = ref(saved.snap !== false);
    const theme = ref<TaoMode>(saved.theme === 'light' || saved.theme === 'dark' ? saved.theme : systemTheme());

    // Тема применяется к <html> сразу и при каждой смене.
    watch(theme, (mode) => applyTaoMode(document.documentElement, mode), { immediate: true });
    watch([snapEnabled, theme], () => prefsStorage.write(JSON.stringify({ snap: snapEnabled.value, theme: theme.value } satisfies Saved)));

    /** Вид новых связей. Пока выбрана связь, переключатель меняет её, а не это значение. */
    const defaultArrow = ref<Arrow>('none');

    /** Сенсорный режим «Выделение»: один палец рисует рамку, тап по ноде добавляет или снимает её (роль Ctrl+клика). */
    const selectMode = ref(false);

    return { snapEnabled, theme, defaultArrow, selectMode };
}

export type PrefsSlice = ReturnType<typeof usePrefs>;
