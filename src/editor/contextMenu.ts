import { computed } from 'vue';
import type { TaoMenuItem } from '@1337exp/taoui';
import { formatHotkey } from '@1337exp/taoux/hotkeys';
import { NODE_COLORS, type NodeColor } from '@/core/colors';
import { useI18n, type MessageKey } from '@/i18n';
import { clipboardActions } from './clipboard';
import { ALIGN_COMMANDS, useCommands } from './commands';
import { useEditor } from './store';

const SEP: TaoMenuItem = { type: 'separator' };

/**
 * Пункты контекстного меню для того, на что нажали: нода (или все выделенные) или связь. Пункты, у которых есть
 * команда, берутся из реестра команд (подпись, сочетание, «можно ли»); переключатели типа ноды и цвета строятся здесь
 * по состоянию выделения. Выбор разбирает `runContextItem`.
 * Items of the context menu for what was pressed: a node (or everything selected) or a link. Items that have a command
 * come from the command registry (label, shortcut, "can it run"); the toggles of the node type and the colours are
 * built here from the state of the selection. A pick is handled by `runContextItem`.
 */
export function useContextMenu() {
    const editor = useEditor();
    const cmd = useCommands();
    const { t } = useI18n();

    const clip = clipboardActions(editor);

    // Буфер идёт нативными событиями, поэтому у команд нет сочетаний; в меню их подпись добавляем сами.
    const NATIVE_KEYS: Record<string, string> = { 'edit.copy': 'Mod+C', 'edit.cut': 'Mod+X', 'edit.paste': 'Mod+V' };
    const menu = (layout: Parameters<typeof cmd.commands.toMenu>[0]) =>
        (cmd.commands.toMenu(layout) as TaoMenuItem[]).map((item) =>
            'id' in item && item.id in NATIVE_KEYS && (item.type === undefined || item.type === 'item') ? { ...item, shortcut: formatHotkey(NATIVE_KEYS[item.id]!) } : item,
        );

    const items = computed<TaoMenuItem[]>(() => {
        const target = editor.contextMenu?.target;
        if (!target) return [];

        if (target.kind === 'empty') {
            return [...menu(['edit.paste', 'edit.selectAll']), SEP, { id: 'palette', label: t('context.addNode'), icon: 'tao-plus' }, ...menu(['view.fit'])];
        }

        if (target.kind === 'link') {
            return menu(['link.label', '-', 'link.line', 'link.arrow', 'link.reverse', 'link.straighten', '-', 'edit.delete']);
        }

        const out: TaoMenuItem[] = menu(['edit.copy', 'edit.cut', 'edit.duplicate', '-', 'node.front', 'node.back']);

        // Переключатели типа ноды («Скрыть выполненные», «Крупный текст»): галочки.
        if (editor.nodeActions.length) {
            out.push(SEP);
            for (const a of editor.nodeActions) {
                out.push({ type: 'checkbox', id: `action:${a.id}`, label: t(`nodes.${a.type}.action.${a.id}` as MessageKey), checked: a.checked });
            }
        }

        // Цвет: радио «без цвета» и шесть цветов.
        if (editor.colorable.length) {
            out.push(SEP, {
                id: 'color',
                label: t('context.color'),
                items: [
                    { type: 'radio', id: 'color:none', group: 'color', label: t('context.noColor'), checked: editor.selectionColor === null },
                    ...NODE_COLORS.map(
                        (c): TaoMenuItem => ({ type: 'radio', id: `color:${c}`, group: 'color', label: t(`context.colors.${c}` as MessageKey), checked: editor.selectionColor === c }),
                    ),
                ],
            });
        }

        if (editor.selection.size > 1) {
            out.push({
                id: 'align',
                label: t('context.align.title'),
                items: menu([...ALIGN_COMMANDS.map((a) => `align.${a.kind}`), '-', 'align.distributeX', 'align.distributeY']),
            });
        }

        out.push(SEP, ...menu(['edit.delete']));
        return out;
    });

    /** Выбор пункта: цвет, переключатель типа ноды или команда реестра. */
    function runContextItem(id: string) {
        if (id.startsWith('color:')) {
            const name = id.slice('color:'.length);
            editor.setColor(name === 'none' ? null : (name as NodeColor));
        } else if (id === 'palette') {
            const m = editor.contextMenu;
            if (m) editor.openPalette(m.screen, m.world);
        } else if (id === 'edit.paste') {
            // Меню у курсора: вставляемое встаёт центром в точку нажатия.
            void clip.paste(editor.contextMenu?.world);
        } else if (id.startsWith('action:')) {
            editor.runNodeAction(id.slice('action:'.length));
        } else {
            cmd.run(id);
        }
    }

    return { items, runContextItem };
}
