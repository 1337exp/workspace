import { computed } from 'vue';
import { createCommands, type Command, type Commands } from '@1337exp/taoux/commands';
import { matchHotkey } from '@1337exp/taoux/hotkeys';
import { LOCALE_CODES, LOCALE_NAMES, setLocale, useI18n } from '@/i18n';
import type { MessageKey } from '@/i18n';
import type { AlignKind } from '@/core/align';
import { openFromFile, saveToFile } from './file';
import { ZOOM_STEP } from './state/view';
import { SELECT_TOOL } from './state/tool';
import { useEditor } from './store';

type Editor = ReturnType<typeof useEditor>;

/** Выравнивание: id команды → вид и ключ перевода. / Alignment: command id → kind and translation key. */
export const ALIGN_COMMANDS: readonly { kind: AlignKind; key: MessageKey }[] = [
    { kind: 'left', key: 'context.align.left' },
    { kind: 'hcenter', key: 'context.align.hcenter' },
    { kind: 'right', key: 'context.align.right' },
    { kind: 'top', key: 'context.align.top' },
    { kind: 'vmiddle', key: 'context.align.vmiddle' },
    { kind: 'bottom', key: 'context.align.bottom' },
];

const shortcutsOf = (c: Command): string[] => (c.shortcut === undefined ? [] : typeof c.shortcut === 'string' ? [c.shortcut] : [...c.shortcut]);

/**
 * Все действия редактора в одном месте: подпись, сочетание клавиш, «можно ли сейчас», «включено ли» и само действие.
 * Кнопки, меню и горячие клавиши только показывают и вызывают их, поэтому не расходятся.
 *
 * Every editor action in one place: label, shortcut, "can it run now", "is it on" and the action itself.
 * Buttons, menus and hotkeys only show and call them, so they never drift apart.
 */
export function createEditorCommands(editor: Editor) {
    const { t, nodeTitle, locale } = useI18n();

    const link = () => editor.workspace.connections.find((c) => c.id === editor.selectedConnection);
    const nodeCount = () => editor.selection.size;
    const hasSelection = () => nodeCount() > 0 || link() !== undefined;
    const arrow = () => link()?.arrow ?? editor.defaultArrow;

    const list: Command[] = [
        { id: 'file.new', label: () => t('file.new'), icon: 'tao-plus', run: () => editor.newWorkspace() },
        { id: 'file.open', label: () => t('file.open'), icon: 'tao-folder', shortcut: 'Mod+O', run: () => openFromFile(editor) },
        { id: 'file.save', label: () => t('file.save'), icon: 'file-save', shortcut: 'Mod+S', run: () => saveToFile(editor) },

        { id: 'edit.undo', label: () => t('history.undo'), icon: 'tao-undo', shortcut: 'Mod+Z', enabled: () => editor.canUndo, run: () => editor.undo() },
        { id: 'edit.redo', label: () => t('history.redo'), icon: 'tao-redo', shortcut: ['Mod+Shift+Z', 'Mod+Y'], enabled: () => editor.canRedo, run: () => editor.redo() },
        { id: 'edit.delete', label: () => t('context.delete'), icon: 'tao-trash', shortcut: ['Delete', 'Backspace'], enabled: hasSelection, run: () => editor.removeSelected() },

        { id: 'view.grid', label: () => t('grid.label'), icon: 'view-grid', checked: () => editor.snapEnabled, run: () => (editor.snapEnabled = !editor.snapEnabled) },

        { id: 'link.line', label: () => t('link.line'), group: 'arrow', checked: () => arrow() === 'none', run: () => editor.setArrowStyle('none') },
        { id: 'link.arrow', label: () => t('link.arrow'), group: 'arrow', checked: () => arrow() === 'end', run: () => editor.setArrowStyle('end') },
        { id: 'link.reverse', label: () => t('link.reverse'), icon: 'link-reverse', enabled: () => link() !== undefined, run: () => editor.reverseSelected() },
        { id: 'link.straighten', label: () => t('context.straighten'), icon: 'link-straighten', enabled: () => link() !== undefined, run: () => editor.straightenSelectedLink() },

        ...ALIGN_COMMANDS.map(
            ({ kind, key }): Command => ({ id: `align.${kind}`, label: () => t(key), icon: `align-${kind}`, enabled: () => nodeCount() > 1, run: () => editor.alignSelected(kind) }),
        ),
        { id: 'align.distributeX', label: () => t('context.align.distributeX'), icon: 'distribute-x', enabled: () => nodeCount() > 2, run: () => editor.distributeSelected('x') },
        { id: 'align.distributeY', label: () => t('context.align.distributeY'), icon: 'distribute-y', enabled: () => nodeCount() > 2, run: () => editor.distributeSelected('y') },

        // Инструменты панели слева: «Выбор» и по инструменту на каждый тип ноды (кроме точек на связи).
        { id: 'tool.select', label: () => t('tool.select'), icon: 'tool-select', shortcut: 'V', group: 'tool', checked: () => editor.tool === SELECT_TOOL, run: () => editor.setTool(SELECT_TOOL) },
        ...editor.registry
            .all()
            .filter((def) => !def.point)
            .map(
                (def): Command => ({
                    id: `tool.place.${def.id}`,
                    label: () => nodeTitle(def),
                    icon: def.icon,
                    shortcut: def.hotkey,
                    group: 'tool',
                    checked: () => editor.tool === def.id,
                    // Повторное нажатие на включённый инструмент снимает его.
                    run: () => editor.setTool(editor.tool === def.id ? SELECT_TOOL : def.id),
                }),
            ),
        // Esc: снять инструмент, потом закрыть палитру, потом снять выделение.
        { id: 'tool.cancel', label: () => t('tool.cancel'), shortcut: 'Escape', run: () => editor.cancelTool() },

        { id: 'view.zoomIn', label: () => t('view.zoomIn'), icon: 'tao-plus', shortcut: ['=', 'plus'], run: () => editor.zoomBy(ZOOM_STEP) },
        { id: 'view.zoomOut', label: () => t('view.zoomOut'), icon: 'tao-minus', shortcut: '-', run: () => editor.zoomBy(1 / ZOOM_STEP) },
        { id: 'view.zoom100', label: () => t('view.zoom100'), shortcut: 'Shift+0', run: () => editor.zoomReset() },
        { id: 'view.fit', label: () => t('view.fit'), icon: 'view-fit', shortcut: 'Shift+1', run: () => editor.fitAll() },

        { id: 'touch.select', label: () => t('touch.select'), icon: 'touch-select', checked: () => editor.selectMode, run: () => (editor.selectMode = !editor.selectMode) },

        { id: 'app.theme.dark', label: () => t('app.dark'), icon: 'tao-moon', group: 'theme', checked: () => editor.theme === 'dark', run: () => (editor.theme = 'dark') },
        { id: 'app.theme.light', label: () => t('app.light'), icon: 'tao-sun', group: 'theme', checked: () => editor.theme === 'light', run: () => (editor.theme = 'light') },
        ...LOCALE_CODES.map(
            (code): Command => ({ id: `app.lang.${code}`, label: LOCALE_NAMES[code], group: 'lang', checked: () => locale.value === code, run: () => setLocale(code) }),
        ),
    ];

    const commands = createCommands(list);

    /**
     * Холст по умолчанию сам слушает Delete, Ctrl+Z и Ctrl+Y. Раз эти сочетания теперь у команд, отдаём их команде:
     * иначе сработали бы дважды. Совпало с сочетанием любой команды (кроме поля ввода) = ключ наш.
     */
    function claimsKey(event: KeyboardEvent): boolean {
        return commands.list().some((c) => shortcutsOf(c).some((combo) => matchHotkey(event, combo)));
    }

    return { commands, claimsKey };
}

export interface EditorCommands {
    commands: Commands;
    claimsKey(event: KeyboardEvent): boolean;
    /** Подпись, чтобы шаблон перерисовался при смене языка. */
    label(id: string): string;
    /** Имя иконки команды для `TaoIcon`. */
    icon(id: string): string | undefined;
    /** Сочетание клавиш для этой платформы (`Ctrl+Z`, `⌘Z`) или undefined. */
    shortcutLabel(id: string): string | undefined;
    /** Подпись + сочетание для подсказки: «Отменить (Ctrl+Z)». */
    hint(id: string): string;
    enabled(id: string): boolean;
    checked(id: string): boolean;
    run(id: string): void;
}

const cache = new WeakMap<object, EditorCommands>();

/**
 * Команды для компонентов. Один набор на стор. Методы читают реактивное состояние, поэтому в шаблоне и в `computed`
 * кнопка сама включается, выключается и меняет подпись.
 * Commands for components. One set per store. The methods read reactive state, so in a template or a `computed` a
 * button enables, disables and relabels itself.
 */
export function useCommands(): EditorCommands {
    const editor = useEditor();
    let made = cache.get(editor);
    if (!made) {
        const { commands, claimsKey } = createEditorCommands(editor);
        const text = (id: string) => commands.label(id) ?? id;
        made = {
            commands,
            claimsKey,
            label: text,
            icon: (id) => commands.get(id)?.icon,
            shortcutLabel: (id) => commands.shortcutLabel(id),
            hint: (id) => {
                const key = commands.shortcutLabel(id);
                return key ? `${text(id)} (${key})` : text(id);
            },
            enabled: (id) => commands.isEnabled(id),
            checked: (id) => commands.get(id)?.checked?.() ?? false,
            run: (id) => void commands.run(id),
        };
        cache.set(editor, made);
    }
    return made;
}

/** Меню «Файл» и т.п. для `TaoMenubar` и `TaoDropdownMenu`: пересобирается при смене языка и состояния. */
export function useMenu(layout: Parameters<Commands['toMenu']>[0]) {
    const api = useCommands();
    return computed(() => api.commands.toMenu(layout));
}
