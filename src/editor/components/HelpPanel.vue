<script lang="ts" setup>
import { useI18n } from '@/i18n';
import { useCommands } from '../commands';

/**
 * Справка: жесты мыши и тачпада (текст из словаря) и горячие клавиши (из реестра команд, поэтому всегда
 * актуальны). Показывается в окошке у кнопки «?».
 * Help: mouse and trackpad gestures (text from the dictionary) and hotkeys (from the command registry, so always
 * current). Shown in the popover of the "?" button.
 */
const cmd = useCommands();
const { t } = useI18n();

const GESTURES = ['pan', 'zoom', 'marquee', 'link', 'add', 'snap'] as const;

// Клавиши показываем у команд, у которых они есть; порядок задан здесь, подписи и сочетания берёт реестр.
const HOTKEYS = ['tool.select', 'tool.place.note', 'tool.place.image', 'tool.place.group', 'tool.cancel', 'edit.undo', 'edit.redo', 'edit.delete', 'view.zoomIn', 'view.zoomOut', 'view.zoom100', 'view.fit', 'file.open', 'file.save'];
const hotkeys = () => HOTKEYS.filter((id) => cmd.commands.has(id) && cmd.shortcutLabel(id));
</script>

<template>
    <div class="help">
        <h3 class="title">{{ t('help.title') }}</h3>
        <dl class="rows">
            <template v-for="g in GESTURES" :key="g">
                <dt>{{ t(`help.${g}.label`) }}</dt>
                <dd>{{ t(`help.${g}.how`) }}</dd>
            </template>
        </dl>

        <h3 class="title">{{ t('help.hotkeys') }}</h3>
        <dl class="rows">
            <template v-for="id in hotkeys()" :key="id">
                <dt>{{ cmd.label(id) }}</dt>
                <dd><kbd>{{ cmd.shortcutLabel(id) }}</kbd></dd>
            </template>
        </dl>
    </div>
</template>

<style scoped>
.help {
    width: 320px;
    max-width: calc(100vw - 48px);
    max-height: min(80vh, 640px);
    overflow-y: auto;
    scrollbar-width: thin;
    padding: 4px 2px;
    font-size: 13px;
}

.title {
    margin: 8px 0 6px;
    color: var(--tao-color-text-strong);
    font-size: 13px;
    font-weight: 500;
}

.title:first-child {
    margin-top: 0;
}

.rows {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    gap: 4px 12px;
    margin: 0;
}

.rows dt {
    color: var(--tao-color-text);
}

.rows dd {
    margin: 0;
    color: var(--tao-color-text-muted);
}

kbd {
    padding: 1px 6px;
    border: 1px solid var(--tao-color-border-strong);
    border-radius: var(--tao-radius-control);
    background: var(--tao-color-surface-hover);
    color: var(--tao-color-text);
    font: inherit;
    font-size: 12px;
}
</style>
