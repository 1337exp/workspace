<script lang="ts" setup>
import { computed, nextTick, type CSSProperties, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { TaoButton, TaoPopover, TaoSegmented, TaoSegmentedOption, TaoToolbar, TaoToolbarGroup, TaoToolbarSeparator } from '@1337exp/taoui';
import { worldToScreen } from '@1337exp/taoux/camera';
import { coarse } from '@1337exp/taoux/touch';
import { selectionBounds } from '@/core/bounds';
import { NODE_COLORS, type NodeColor } from '@/core/colors';
import type { Arrow } from '@/core/types';
import { useI18n, type MessageKey } from '@/i18n';
import { ALIGN_COMMANDS, useCommands } from '../commands';
import { floatingPosition } from '../floating';
import { rememberEmoji } from '@/nodes/emoji';
import { fittedSizes } from '@/nodes/note/fit';
import FontSizeField from './FontSizeField.vue';
import { useEditor } from '../store';
import EmojiPicker from './EmojiPicker.vue';

/**
 * Панель действий над выделенным: цвет, выравнивание, вид связи, удаление. Действие применяется ко всем выделенным.
 * Мышью панель висит над выделением (под ним, если сверху нет места) и едет за ним; на сенсоре и на узком экране она
 * закреплена внизу, чтобы палец её не заслонял и она не прыгала. Показывается, пока выделена нода или связь.
 *
 * The action bar over the selection: colour, alignment, link style, delete. An action applies to everything selected.
 * With a mouse the bar hangs over the selection (under it when there is no room above) and follows it; on touch and
 * on a narrow screen it is pinned at the bottom, so a finger does not cover it and it does not jump.
 */
const editor = useEditor();
const cmd = useCommands();
const { t } = useI18n();

/** Уже этого экран считается узким: панель закрепляется внизу. */
const NARROW = 640;

const link = computed(() => editor.workspace.connections.find((c) => c.id === editor.selectedConnection) ?? null);
const nodeCount = computed(() => editor.selection.size);
const hasSelection = computed(() => nodeCount.value > 0 || link.value !== null);
const canColor = computed(() => editor.colorable.length > 0);
const arrow = computed<Arrow>(() => link.value?.arrow ?? 'none');

/** Выделены одни стикеры: в панели кнопка замены эмодзи (показывает текущий, если он у всех один). */
const stickers = computed(() => {
    const nodes = [...editor.selection].map((id) => editor.workspace.nodes[id]).filter((n) => n !== undefined);
    return nodes.length > 0 && nodes.every((n) => n.type === 'emoji') ? nodes : [];
});
const stickerEmoji = computed(() => {
    const set = new Set(stickers.value.map((n) => n.data.emoji));
    return set.size === 1 ? String([...set][0]) : undefined;
});
const emojiOpen = ref(false);

function changeEmoji(emoji: string) {
    rememberEmoji(emoji);
    for (const n of stickers.value) editor.patchData(n.id, { emoji });
    emojiOpen.value = false;
}

/** Выделены одни ноды с настройками текста (стикеры): размер шрифта, жирный, выравнивание. */
const texty = computed(() => {
    const nodes = [...editor.selection].map((id) => editor.workspace.nodes[id]).filter((n) => n !== undefined);
    return nodes.length > 0 && nodes.every((n) => editor.registry.find(n.type)?.textStyle) ? nodes : [];
});
const common = <T,>(pick: (d: Record<string, unknown>) => T): T | undefined => {
    const set = new Set(texty.value.map((n) => pick(n.data)));
    return set.size === 1 ? [...set][0] : undefined;
};
const fontSize = computed(() => common((d) => (typeof d.size === 'number' ? d.size : 0)) ?? 0);
const isBold = computed(() => common((d) => d.bold === true) === true);
const textAlign = computed<'left' | 'center' | 'right'>(() => common((d) => (d.align === 'left' || d.align === 'right' ? d.align : 'center')) ?? 'center');
const ALIGNS = ['left', 'center', 'right'] as const;

function patchTexts(patch: Record<string, unknown>) {
    for (const n of texty.value) editor.patchData(n.id, patch);
}
/** Число в поле: заданный размер, а при «Авто» тот, с которым стикер рисуется сейчас. */
const shownSize = computed(() => fontSize.value || fittedSizes[texty.value[0]?.id ?? '']?.size || null);
/** Самый крупный размер, который влезает во все выделенные стикеры. */
const maxSize = computed(() => Math.min(...texty.value.map((n) => fittedSizes[n.id]?.max ?? Infinity)));
const textVAlign = computed<'top' | 'middle' | 'bottom'>(() => common((d) => (d.valign === 'top' || d.valign === 'bottom' ? d.valign : 'middle')) ?? 'middle');
const VALIGNS = ['top', 'middle', 'bottom'] as const;
const cycleVAlign = () => patchTexts({ valign: VALIGNS[(VALIGNS.indexOf(textVAlign.value) + 1) % VALIGNS.length] });
const cycleAlign = () => patchTexts({ align: ALIGNS[(ALIGNS.indexOf(textAlign.value) + 1) % ALIGNS.length] });

/** Цвет одной точкой: окошко с палитрой открывается по нажатию на неё. */
const colorOpen = ref(false);
function pickColor(color: NodeColor | null) {
    editor.setColor(color);
    colorOpen.value = false;
}
/** Цвет точки: выбранный; у стикера без цвета жёлтый (он так и рисуется). */
const dotColor = computed(() => {
    const c = editor.selectionColor;
    if (c) return `var(--tint-${c})`;
    const allSticker = editor.colorable.every((id) => editor.registry.find(editor.workspace.nodes[id]?.type ?? '')?.sticker);
    return allSticker ? 'var(--sticker-default)' : null;
});

const bar = ref<HTMLElement | null>(null);

// Экранная клавиатура на сенсоре закрыла бы панель, поэтому на время набора текста она прячется.
const typing = ref(false);
function onFocusChange() {
    const el = document.activeElement;
    const field = el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;
    typing.value = field && !bar.value?.contains(el);
}

//--------------------------------------------------
// Положение: плавающее (мышь, широкий экран) или внизу.

const floating = computed(() => !coarse.value && editor.viewport.w >= NARROW);

const size = ref({ w: 0, h: 0 });
let observer: ResizeObserver | null = null;
function measure() {
    const el = bar.value;
    if (el) size.value = { w: el.offsetWidth, h: el.offsetHeight };
}

onMounted(() => {
    window.addEventListener('focusin', onFocusChange);
    window.addEventListener('focusout', onFocusChange);
    observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
});
onBeforeUnmount(() => {
    window.removeEventListener('focusin', onFocusChange);
    window.removeEventListener('focusout', onFocusChange);
    observer?.disconnect();
});

// Панель появляется и исчезает вместе с выделением: следим за новым элементом и меряем его сразу.
watch(bar, async (el, old) => {
    if (old) observer?.unobserve(old);
    if (!el) return;
    observer?.observe(el);
    await nextTick();
    measure();
});

const style = computed<CSSProperties>(() => {
    if (!floating.value) return {};
    const rect = selectionBounds(editor.workspace, editor.selection, editor.selectedConnection);
    if (!rect) return {};

    const [x0, y0] = worldToScreen(editor.camera, rect.x, rect.y);
    const [x1, y1] = worldToScreen(editor.camera, rect.x + rect.w, rect.y + rect.h);
    const { left, top } = floatingPosition({ x0, y0, x1, y1 }, size.value, editor.viewport);
    // Пока размер не измерен, панель не показываем: иначе она мигнёт в неверном месте.
    return { left: `${left}px`, top: `${top}px`, visibility: size.value.w > 0 ? 'visible' : 'hidden' } as const;
});

const visible = computed(() => hasSelection.value && !(coarse.value && typing.value));

const active = (color: NodeColor | null) => editor.selectionColor === color;

/** Подпись переключателя типа ноды: `nodes.<тип>.action.<id>` в словаре. */
const actionLabel = (a: { type: string; id: string }) => t(`nodes.${a.type}.action.${a.id}` as MessageKey);

function setArrow(value: unknown) {
    if (value === 'none') cmd.run('link.line');
    else if (value === 'end') cmd.run('link.arrow');
}
</script>

<template>
    <div v-if="visible" ref="bar" class="context" :class="{ floating }" :style="style" @pointerdown.stop @wheel.stop @contextmenu.prevent>
        <TaoToolbar :label="t('context.title')">
            <TaoToolbarGroup v-if="canColor" :label="t('context.color')">
                <span v-if="nodeCount > 1" class="count">{{ t('context.selected', [nodeCount]) }}</span>
                <TaoPopover v-model="colorOpen" placement="top">
                    <template #trigger>
                        <button class="swatch dot" :class="{ none: !dotColor }" :style="{ '--swatch': dotColor ?? 'transparent' }" :title="t('context.color')" :aria-label="t('context.color')" />
                    </template>
                    <div class="swatches palette" role="group" :aria-label="t('context.color')">
                        <button class="swatch none" :class="{ active: active(null) }" :title="t('context.noColor')" :aria-label="t('context.noColor')" @click="pickColor(null)" />
                        <button
                            v-for="color in NODE_COLORS"
                            :key="color"
                            class="swatch"
                            :class="{ active: active(color) }"
                            :style="{ '--swatch': `var(--tint-${color})` }"
                            :title="t(`context.colors.${color}`)"
                            :aria-label="t(`context.colors.${color}`)"
                            @click="pickColor(color)"
                        />
                    </div>
                </TaoPopover>
            </TaoToolbarGroup>

            <template v-if="texty.length">
                <TaoToolbarSeparator v-if="canColor" />
                <TaoToolbarGroup :label="t('context.text')">
                    <FontSizeField :size="shownSize" :auto="fontSize === 0" :max="Number.isFinite(maxSize) ? maxSize : undefined" :title="t('context.fontAuto')" @set="(n) => patchTexts({ size: n })" @auto="patchTexts({ size: 0 })" />
                    <TaoButton variant="ghost" tone="neutral" icon="text-bold" :pressed="isBold" :aria-label="t('context.bold')" :title="t('context.bold')" @click="patchTexts({ bold: !isBold })" />
                    <TaoButton variant="ghost" tone="neutral" :icon="`text-align-${textAlign}`" :aria-label="t('context.textAlign')" :title="t('context.textAlign')" @click="cycleAlign" />
                    <TaoButton variant="ghost" tone="neutral" :icon="`text-valign-${textVAlign}`" :aria-label="t('context.textVAlign')" :title="t('context.textVAlign')" @click="cycleVAlign" />
                </TaoToolbarGroup>
            </template>

            <template v-if="stickers.length">
                <TaoToolbarSeparator v-if="canColor || texty.length" />
                <TaoToolbarGroup :label="t('emoji.change')">
                    <TaoPopover placement="top" v-model="emojiOpen">
                        <template #trigger>
                            <TaoButton variant="ghost" tone="neutral" :aria-label="t('emoji.change')" :title="t('emoji.change')">{{ stickerEmoji ?? '🙂' }}</TaoButton>
                        </template>
                        <EmojiPicker :current="stickerEmoji" @pick="changeEmoji" />
                    </TaoPopover>
                </TaoToolbarGroup>
            </template>

            <template v-if="editor.nodeActions.length">
                <TaoToolbarSeparator v-if="canColor" />
                <TaoToolbarGroup :label="t('context.nodeActions')">
                    <TaoButton
                        v-for="a in editor.nodeActions"
                        :key="a.id"
                        variant="ghost"
                        tone="neutral"
                        :icon="a.icon"
                        :pressed="a.checked"
                        :aria-label="actionLabel(a)"
                        :title="actionLabel(a)"
                        @click="editor.runNodeAction(a.id)"
                    />
                </TaoToolbarGroup>
            </template>

            <template v-if="nodeCount > 1">
                <TaoToolbarSeparator v-if="canColor || editor.nodeActions.length" />
                <TaoToolbarGroup :label="t('context.align.title')">
                    <TaoButton
                        v-for="a in ALIGN_COMMANDS"
                        :key="a.kind"
                        variant="ghost"
                        tone="neutral"
                        :icon="cmd.icon('align.' + a.kind)"
                        :aria-label="cmd.label('align.' + a.kind)"
                        @click="cmd.run('align.' + a.kind)"
                    />
                </TaoToolbarGroup>
                <TaoToolbarGroup :label="t('context.align.distribute')">
                    <TaoButton
                        v-for="id in ['align.distributeX', 'align.distributeY']"
                        :key="id"
                        variant="ghost"
                        tone="neutral"
                        :icon="cmd.icon(id)"
                        :disabled="!cmd.enabled(id)"
                        :aria-label="cmd.label(id)"
                        @click="cmd.run(id)"
                    />
                </TaoToolbarGroup>
            </template>

            <template v-if="link">
                <TaoToolbarSeparator v-if="canColor" />
                <TaoToolbarGroup :label="t('link.label')">
                    <TaoButton variant="ghost" tone="neutral" :icon="cmd.icon('link.label')" :pressed="!!link?.label" :aria-label="cmd.label('link.label')" :title="cmd.hint('link.label')" @click="cmd.run('link.label')" />
                </TaoToolbarGroup>
                <TaoToolbarGroup :label="t('link.style')">
                    <TaoSegmented :model-value="arrow" :aria-label="t('link.style')" @update:model-value="setArrow">
                        <TaoSegmentedOption value="none">{{ t('link.line') }}</TaoSegmentedOption>
                        <TaoSegmentedOption value="end">{{ t('link.arrow') }} →</TaoSegmentedOption>
                    </TaoSegmented>
                    <TaoButton variant="ghost" tone="neutral" :icon="cmd.icon('link.reverse')" :aria-label="cmd.label('link.reverse')" :title="cmd.label('link.reverse')" @click="cmd.run('link.reverse')" />
                    <TaoButton variant="ghost" tone="neutral" :icon="cmd.icon('link.straighten')" :aria-label="cmd.label('link.straighten')" :title="t('context.straightenHint')" @click="cmd.run('link.straighten')" />
                </TaoToolbarGroup>
            </template>

            <!-- Разделитель нужен, только если слева от «Удалить» что-то есть (у точки на связи там пусто). -->
            <TaoToolbarSeparator v-if="canColor || editor.nodeActions.length || stickers.length || texty.length || nodeCount > 1 || link" />
            <TaoToolbarGroup>
                <TaoButton variant="ghost" tone="danger" :icon="cmd.icon('edit.delete')" :aria-label="cmd.label('edit.delete')" :shortcut="cmd.shortcutLabel('edit.delete')" @click="cmd.run('edit.delete')" />
            </TaoToolbarGroup>
        </TaoToolbar>
    </div>
</template>

<style scoped>
.context {
    position: absolute;
    z-index: 10;
    /* Внизу (сенсор, узкий экран): по центру, над зум-баром. По центру без transform: при left: 50% доступная ширина
       всего половина контейнера, и панель сворачивалась бы в несколько рядов. */
    bottom: calc(max(12px, env(safe-area-inset-bottom)) + 60px);
    left: 12px;
    right: 12px;
    margin-inline: auto;
    width: max-content;
    max-width: calc(100% - 24px);
}

/* Плавающая: left и top задаёт положение у выделения. */
.context.floating {
    right: auto;
    bottom: auto;
    margin-inline: 0;
    max-width: calc(100% - 88px);
}

.count {
    padding-inline: 4px;
    color: var(--tao-color-text-muted);
    font-size: 12px;
    white-space: nowrap;
}

/* Точка цвета занимает место кнопки панели (36 px), поэтому от краёв такой же отступ, как у соседних кнопок. */
.dot {
    margin: 7px;
}

.palette {
    padding: 8px;
}

.swatches {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-inline: 4px;
}

.swatch {
    position: relative;
    box-sizing: border-box;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 50%;
    background: var(--swatch);
    cursor: pointer;
    transition: transform 0.1s;
}

.swatch:hover {
    transform: scale(1.12);
}

.swatch.active {
    border-color: var(--tao-color-text-strong);
    box-shadow: 0 0 0 2px var(--tao-color-accent);
}

/* «Без цвета»: пустой кружок с чертой. */
.swatch.none {
    border-color: var(--tao-color-text-muted);
    background: transparent;
}

.swatch.none::after {
    content: '';
    position: absolute;
    inset: 50% 2px auto 2px;
    height: 2px;
    background: var(--tao-color-text-muted);
    transform: rotate(-45deg);
}

.swatch.none.active {
    border-color: var(--tao-color-text-strong);
}

/* Палец крупнее курсора. */
@media (pointer: coarse) {
    .swatch {
        width: 32px;
        height: 32px;
    }

    .swatches {
        gap: 8px;
    }

    .dot {
        margin: 2px;
    }
}
</style>
