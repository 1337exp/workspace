<script lang="ts" setup>
import { computed } from 'vue';
import { TaoButton, TaoDropdownMenu, TaoIcon, TaoPopover, TaoToolbar, TaoToolbarGroup } from '@1337exp/taoui';
import { useI18n } from '@/i18n';
import { useCommands, useMenu } from '../commands';
import { useEditor } from '../store';
import HelpPanel from './HelpPanel.vue';

/**
 * Панель масштаба внизу слева: меню «Вид», «−», процент (клик = 100%), «+» и справка. Всё из реестра команд.
 * The zoom bar at the bottom left: the "View" menu, "−", the percentage (a click = 100%), "+" and help.
 * All of it comes from the command registry.
 */
const editor = useEditor();
const cmd = useCommands();
const { t } = useI18n();

const percent = computed(() => `${Math.round(editor.camera.z * 100)}%`);

const viewMenu = useMenu(['view.fit', 'view.zoom100', '-', 'view.grid']);
</script>

<template>
    <div class="zoom" @pointerdown.stop @wheel.stop @contextmenu.prevent>
        <TaoToolbar :label="t('view.zoomBar')">
            <TaoToolbarGroup>
                <TaoDropdownMenu :items="viewMenu" placement="top-start" :menu-label="t('view.options')" @select="cmd.run">
                    <template #icon><TaoIcon name="view-list" /></template>
                </TaoDropdownMenu>
            </TaoToolbarGroup>
            <TaoToolbarGroup>
                <TaoButton variant="ghost" tone="neutral" icon="tao-minus" :aria-label="cmd.label('view.zoomOut')" :shortcut="cmd.shortcutLabel('view.zoomOut')" @click="cmd.run('view.zoomOut')" />
                <TaoButton variant="ghost" tone="neutral" :min-width="64" :title="cmd.hint('view.zoom100')" @click="cmd.run('view.zoom100')">{{ percent }}</TaoButton>
                <TaoButton variant="ghost" tone="neutral" icon="tao-plus" :aria-label="cmd.label('view.zoomIn')" :shortcut="cmd.shortcutLabel('view.zoomIn')" @click="cmd.run('view.zoomIn')" />
            </TaoToolbarGroup>
            <TaoToolbarGroup>
                <TaoPopover placement="top-end">
                    <template #trigger>
                        <TaoButton variant="ghost" tone="neutral" icon="help" :aria-label="t('app.help')" />
                    </template>
                    <HelpPanel />
                </TaoPopover>
            </TaoToolbarGroup>
        </TaoToolbar>
    </div>
</template>

<style scoped>
.zoom {
    position: absolute;
    bottom: max(12px, env(safe-area-inset-bottom));
    left: max(12px, env(safe-area-inset-left));
    z-index: 10;
}
</style>
