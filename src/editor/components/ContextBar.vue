<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { TaoButton, TaoSegmented, TaoSegmentedOption } from '@1337exp/taoui';
import { NODE_COLORS, type NodeColor } from '@/core/colors';
import type { Arrow } from '@/core/types';
import { useI18n } from '@/i18n';
import { useEditor } from '../store';
import DistributeIcon from './DistributeIcon.vue';
import { coarse } from '../touch';

/**
 * Панель действий над выделенным, закреплённая у нижнего края экрана. Не привязана к ноде и не зависит от
 * масштаба, одинаково работает мышью и пальцем, действие применяется ко всем выделенным. Показывается, пока
 * выделена хотя бы нода или связь.
 */
const editor = useEditor();
const { t } = useI18n();

const link = computed(() => editor.workspace.connections.find((c) => c.id === editor.selectedConnection) ?? null);
const nodeCount = computed(() => editor.selection.size);
const hasSelection = computed(() => nodeCount.value > 0 || link.value !== null);
const canColor = computed(() => editor.colorable.length > 0);
const arrow = computed<Arrow>(() => link.value?.arrow ?? 'none');

// Экранная клавиатура на сенсоре закрыла бы панель, поэтому на время набора текста она прячется.
const bar = ref<HTMLElement | null>(null);
const typing = ref(false);
function onFocusChange() {
    const el = document.activeElement;
    const field = el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;
    typing.value = field && !bar.value?.contains(el);
}
onMounted(() => {
    window.addEventListener('focusin', onFocusChange);
    window.addEventListener('focusout', onFocusChange);
});
onUnmounted(() => {
    window.removeEventListener('focusin', onFocusChange);
    window.removeEventListener('focusout', onFocusChange);
});

const visible = computed(() => hasSelection.value && !(coarse.value && typing.value));

const active = (color: NodeColor | null) => editor.selectionColor === color;

/**
 * Выравнивание. Иконки по горизонтали это «прижатые линии» из fontello (align-left/center/right),
 * по вертикали те же иконки, повёрнутые на 90°: левый край становится верхним.
 */
const ALIGN = [
    { kind: 'left', icon: 'icon-align-left', rot: false },
    { kind: 'hcenter', icon: 'icon-align-center', rot: false },
    { kind: 'right', icon: 'icon-align-right', rot: false },
    { kind: 'top', icon: 'icon-align-left', rot: true },
    { kind: 'vmiddle', icon: 'icon-align-center', rot: true },
    { kind: 'bottom', icon: 'icon-align-right', rot: true },
] as const;

function setArrow(value: unknown) {
    if (value === 'none' || value === 'end') editor.setArrowStyle(value);
}
</script>

<template>
    <div v-if="visible" ref="bar" class="context" @pointerdown.stop @wheel.stop @contextmenu.prevent>
        <template v-if="canColor">
            <span v-if="nodeCount > 1" class="count">{{ t('context.selected', [nodeCount]) }}</span>

            <div class="swatches" role="group" :aria-label="t('context.color')">
                <button
                    class="swatch none"
                    :class="{ active: active(null) }"
                    :title="t('context.noColor')"
                    :aria-label="t('context.noColor')"
                    @click="editor.setColor(null)"
                />
                <button
                    v-for="color in NODE_COLORS"
                    :key="color"
                    class="swatch"
                    :class="{ active: active(color) }"
                    :style="{ '--swatch': `var(--tint-${color})` }"
                    :title="t(`context.colors.${color}`)"
                    :aria-label="t(`context.colors.${color}`)"
                    @click="editor.setColor(color)"
                />
            </div>
        </template>

        <div v-if="nodeCount > 1" class="tools" role="group" :aria-label="t('context.align.title')">
            <button
                v-for="a in ALIGN"
                :key="a.kind"
                class="tool"
                :title="t(`context.align.${a.kind}`)"
                :aria-label="t(`context.align.${a.kind}`)"
                @click="editor.alignSelected(a.kind)"
            >
                <i :class="[a.icon, { rot: a.rot }]" />
            </button>
            <span class="gap" />
            <button class="tool" :disabled="nodeCount < 3" :title="t('context.align.distributeX')" :aria-label="t('context.align.distributeX')" @click="editor.distributeSelected('x')">
                <DistributeIcon axis="x" />
            </button>
            <button class="tool" :disabled="nodeCount < 3" :title="t('context.align.distributeY')" :aria-label="t('context.align.distributeY')" @click="editor.distributeSelected('y')">
                <DistributeIcon axis="y" />
            </button>
        </div>

        <template v-if="link">
            <TaoSegmented :model-value="arrow" size="small" @update:model-value="setArrow">
                <TaoSegmentedOption value="none">{{ t('link.line') }}</TaoSegmentedOption>
                <TaoSegmentedOption value="end">{{ t('link.arrow') }} →</TaoSegmentedOption>
            </TaoSegmented>
            <TaoButton variant="secondary" size="small" @click="editor.reverseSelected()">
                <i class="icon-shuffle" />{{ t('link.reverse') }}
            </TaoButton>
            <TaoButton variant="secondary" size="small" :title="t('context.straightenHint')" @click="editor.straightenSelectedLink()">
                <i class="icon-minus" />{{ t('context.straighten') }}
            </TaoButton>
        </template>

        <span v-if="canColor || link || nodeCount > 1" class="sep" />

        <TaoButton variant="danger" size="small" @click="editor.removeSelected()">
            <i class="icon-trash-1" />{{ t('context.delete') }}
        </TaoButton>
    </div>
</template>

<style scoped>
.context {
    position: absolute;
    bottom: max(14px, env(safe-area-inset-bottom));
    /* По центру без transform: при left: 50% доступная ширина всего половина контейнера, и панель сворачивалась бы в несколько рядов. */
    left: 12px;
    right: 12px;
    margin-inline: auto;
    width: max-content;
    z-index: 10;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 8px;
    max-width: calc(100% - 24px);
    padding: 8px 12px;
    border: 1px solid var(--tao-color-border-strong, #4b5563);
    border-radius: 12px;
    background: color-mix(in srgb, var(--tao-color-surface-raised, #1f2937) 96%, transparent);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
}

.count {
    color: var(--tao-color-text-muted, #9ca3af);
    font-size: 12px;
    white-space: nowrap;
}

.swatches {
    display: flex;
    align-items: center;
    gap: 6px;
}

.swatch {
    position: relative;
    box-sizing: border-box;
    width: 24px;
    height: 24px;
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
    border-color: var(--tao-color-text-strong, #fff);
    box-shadow: 0 0 0 2px var(--tao-color-accent, #f59e0b);
}

/* «Без цвета»: пустой кружок с чертой. */
.swatch.none {
    border-color: var(--tao-color-text-muted, #9ca3af);
    background: transparent;
}

.swatch.none::after {
    content: '';
    position: absolute;
    inset: 50% 3px auto 3px;
    height: 2px;
    background: var(--tao-color-text-muted, #9ca3af);
    transform: rotate(-45deg);
}

.swatch.none.active {
    border-color: var(--tao-color-text-strong, #fff);
}

.tools {
    display: flex;
    align-items: center;
    gap: 2px;
}

.tool {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--tao-color-text, #e5e7eb);
    font-size: 15px;
    cursor: pointer;
}

.tool:hover:not(:disabled) {
    background: var(--tao-color-surface-hover, #374151);
}

.tool:disabled {
    opacity: 0.35;
    cursor: default;
}

.tool i {
    display: inline-block;
}

.tool i::before {
    margin: 0;
}

/* Вертикальное выравнивание: те же иконки, повёрнутые на 90°. */
.tool i.rot {
    transform: rotate(90deg);
}

.gap {
    width: 6px;
}

.sep {
    width: 1px;
    height: 22px;
    background: var(--tao-color-border-strong, #4b5563);
}

/* Палец крупнее курсора. */
@media (pointer: coarse) {
    .tool {
        width: 40px;
        height: 40px;
        font-size: 17px;
    }

    .swatch {
        width: 34px;
        height: 34px;
    }

    .swatches {
        gap: 8px;
    }
}
</style>
