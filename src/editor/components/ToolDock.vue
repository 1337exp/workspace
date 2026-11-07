<script lang="ts" setup>
import { computed } from 'vue';
import { TaoButton, TaoToolbar, TaoToolbarGroup } from '@1337exp/taoui';
import { coarse } from '@1337exp/taoux/touch';
import { useI18n } from '@/i18n';
import { useCommands } from '../commands';
import { useEditor } from '../store';

/**
 * Панель инструментов у левого края: «Выбор», по инструменту на каждый тип ноды, затем отмена и повтор.
 * Инструмент ноды ждёт клика по холсту; всё, что здесь есть, это команды из реестра, поэтому подписи, клавиши и
 * доступность не расходятся с горячими клавишами и меню.
 * The tool dock at the left edge: "Select", a tool for every node type, then undo and redo. A node tool waits for a
 * click on the canvas; everything here is a command of the registry, so labels, keys and availability agree with
 * hotkeys and menus.
 */
const editor = useEditor();
const cmd = useCommands();
const { t } = useI18n();

const toolIds = computed(() => ['tool.select', ...editor.registry.all().filter((d) => !d.point).map((d) => `tool.place.${d.id}`)]);
</script>

<template>
    <div class="dock" @pointerdown.stop @wheel.stop @contextmenu.prevent>
        <TaoToolbar orientation="vertical" :label="t('tool.dock')">
            <TaoToolbarGroup>
                <TaoButton
                    v-for="id in toolIds"
                    :key="id"
                    variant="ghost"
                    tone="neutral"
                    :icon="cmd.icon(id)"
                    :pressed="cmd.checked(id)"
                    :aria-label="cmd.label(id)"
                    :shortcut="cmd.shortcutLabel(id)"
                    @click="cmd.run(id)"
                />
                <TaoButton
                    v-if="coarse"
                    variant="ghost"
                    tone="neutral"
                    :icon="cmd.icon('touch.select')"
                    :pressed="cmd.checked('touch.select')"
                    :aria-label="t('touch.select')"
                    :title="t('touch.selectHint')"
                    @click="cmd.run('touch.select')"
                />
            </TaoToolbarGroup>
        </TaoToolbar>

        <TaoToolbar orientation="vertical" :label="t('history.undo') + ' / ' + t('history.redo')">
            <TaoToolbarGroup>
                <TaoButton
                    v-for="id in ['edit.undo', 'edit.redo']"
                    :key="id"
                    variant="ghost"
                    tone="neutral"
                    :icon="cmd.icon(id)"
                    :disabled="!cmd.enabled(id)"
                    :aria-label="cmd.label(id)"
                    :shortcut="cmd.shortcutLabel(id)"
                    @click="cmd.run(id)"
                />
            </TaoToolbarGroup>
        </TaoToolbar>
    </div>
</template>

<style scoped>
.dock {
    position: absolute;
    top: 0;
    bottom: 0;
    left: max(12px, env(safe-area-inset-left));
    z-index: 10;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 12px;
    /* Сама колонка не ловит клики мимо панелей: холст под ней остаётся живым. */
    pointer-events: none;
}

.dock > * {
    pointer-events: auto;
}
</style>
