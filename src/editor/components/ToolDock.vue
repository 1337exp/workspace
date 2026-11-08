<script lang="ts" setup>
import { computed } from 'vue';
import { ref } from 'vue';
import { TaoButton, TaoPopover, TaoToolbar, TaoToolbarGroup } from '@1337exp/taoui';
import { coarse } from '@1337exp/taoux/touch';
import { useI18n } from '@/i18n';
import { useCommands } from '../commands';
import { rememberEmoji } from '@/nodes/emoji';
import { useEditor } from '../store';
import EmojiPicker from './EmojiPicker.vue';
import PresetPicker from './PresetPicker.vue';
import type { NodePreset } from '@/core/types';

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

/** Окошко выбора эмодзи у кнопки стикера. */
const emojiOpen = ref(false);

/** Выбрали эмодзи: он ставится следующим кликом по холсту и запоминается для клавиши `E`. */
function pickEmoji(emoji: string) {
    rememberEmoji(emoji);
    editor.setTool('emoji', { emoji });
    emojiOpen.value = false;
}

/** Окошко заготовок размера (группа) у своей кнопки. */
const presetOpen = ref(false);

/** Тип ноды по id инструмента (`tool.place.<тип>`). */
const typeOf = (toolId: string) => toolId.replace('tool.place.', '');
const presetsOf = (toolId: string) => (toolId.startsWith('tool.place.') ? editor.registry.find(typeOf(toolId))?.presets : undefined);

/** Выбрали заготовку: нода этого размера ставится следующим кликом по холсту. */
function pickPreset(toolId: string, preset: NodePreset) {
    editor.setTool(typeOf(toolId), undefined, { w: preset.w, h: preset.h });
    presetOpen.value = false;
}

const toolIds = computed(() => ['tool.select', ...editor.registry.all().filter((d) => !d.point).map((d) => `tool.place.${d.id}`)]);
</script>

<template>
    <div class="dock" @pointerdown.stop @wheel.stop @contextmenu.prevent>
        <TaoToolbar orientation="vertical" :label="t('tool.dock')">
            <TaoToolbarGroup>
                <template v-for="id in toolIds" :key="id">
                <TaoPopover v-if="id === 'tool.place.emoji'" v-model="emojiOpen" placement="right-start">
                    <template #trigger>
                        <TaoButton
                            variant="ghost"
                            tone="neutral"
                            :icon="cmd.icon(id)"
                            :pressed="cmd.checked(id)"
                            :aria-label="t('emoji.pick')"
                            :shortcut="cmd.shortcutLabel(id)"
                        />
                    </template>
                    <EmojiPicker @pick="pickEmoji" />
                </TaoPopover>
                <TaoPopover v-else-if="presetsOf(id)" v-model="presetOpen" placement="right-start">
                    <template #trigger>
                        <TaoButton
                            variant="ghost"
                            tone="neutral"
                            :icon="cmd.icon(id)"
                            :pressed="cmd.checked(id)"
                            :aria-label="t('preset.pick')"
                            :shortcut="cmd.shortcutLabel(id)"
                        />
                    </template>
                    <PresetPicker :presets="presetsOf(id)!" @pick="(p) => pickPreset(id, p)" />
                </TaoPopover>
                <TaoButton
                    v-else
                    variant="ghost"
                    tone="neutral"
                    :icon="cmd.icon(id)"
                    :pressed="cmd.checked(id)"
                    :aria-label="cmd.label(id)"
                    :shortcut="cmd.shortcutLabel(id)"
                    @click="cmd.run(id)"
                />
                </template>
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
