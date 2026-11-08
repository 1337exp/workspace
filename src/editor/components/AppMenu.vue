<script lang="ts" setup>
import { TaoDropdownMenu, TaoIcon, TaoThemeToggle, TaoToolbar, TaoToolbarGroup } from '@1337exp/taoui';
import { useI18n } from '@/i18n';
import { useCommands, useMenu } from '../commands';
import { useEditor } from '../store';

/**
 * Главное меню в левом верхнем углу: файл, тема, язык. Пункты строит реестр команд (подписи, сочетания, радио),
 * здесь только раскладка. Рядом быстрый переключатель темы.
 * The main menu in the top left corner: file, theme, language. The command registry builds the entries (labels,
 * shortcuts, radios); only the layout is here. A quick theme switch sits next to it.
 */
const editor = useEditor();
const cmd = useCommands();
const { t } = useI18n();

const items = useMenu([
    'file.new',
    'file.open',
    'file.save',
    '-',
    { id: 'theme', label: () => t('app.theme'), items: ['app.theme.dark', 'app.theme.light'] },
    { id: 'background', label: () => t('app.background'), items: ['app.bg.grid', 'app.bg.dots', 'app.bg.none'] },
    { id: 'language', label: () => t('ui.language'), items: ['app.lang.ru', 'app.lang.en'] },
]);
</script>

<template>
    <div class="app-menu" @pointerdown.stop @wheel.stop @contextmenu.prevent>
        <TaoToolbar :label="t('app.menu')">
            <TaoToolbarGroup>
                <TaoDropdownMenu :items="items" placement="bottom-start" :menu-label="t('app.menu')" @select="cmd.run">
                    <template #icon><TaoIcon name="menu" /></template>
                </TaoDropdownMenu>
                <TaoThemeToggle v-model="editor.theme" :apply="false" tone="neutral" :to-light-label="t('app.light')" :to-dark-label="t('app.dark')" />
            </TaoToolbarGroup>
        </TaoToolbar>
    </div>
</template>

<style scoped>
.app-menu {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: max(12px, env(safe-area-inset-left));
    z-index: 10;
}
</style>
