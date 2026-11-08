<script lang="ts" setup>
import type { NodePreset } from '@/core/types';
import { useI18n, type MessageKey } from '@/i18n';

/**
 * Сетка заготовок размера в окошке у кнопки панели слева: контур с пропорциями заготовки и подпись.
 * A grid of size presets in the popover of a left dock button: an outline with the preset's proportions and a label.
 */
defineProps<{ presets: readonly NodePreset[] }>();
const emit = defineEmits<{ pick: [preset: NodePreset] }>();

const { t } = useI18n();

/** Контур вписывается в квадрат 36×36 с теми же пропорциями. */
const BOX = 36;
const shape = (p: NodePreset) => {
    const k = BOX / Math.max(p.w, p.h);
    return { width: `${Math.round(p.w * k)}px`, height: `${Math.round(p.h * k)}px` };
};
</script>

<template>
    <div class="presets" role="listbox" :aria-label="t('preset.pick')">
        <button v-for="p in presets" :key="p.id" type="button" role="option" class="preset" :aria-label="t(`preset.${p.id}` as MessageKey)" @click="emit('pick', p)">
            <span class="cell"><i class="shape" :style="shape(p)" /></span>
            <span class="label">{{ t(`preset.${p.id}` as MessageKey) }}</span>
        </button>
    </div>
</template>

<style scoped>
.presets {
    display: grid;
    grid-template-columns: repeat(3, 84px);
    gap: 4px;
}

.preset {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 4px 6px;
    border: 0;
    border-radius: var(--tao-radius-control);
    background: transparent;
    color: var(--tao-color-text);
    font-size: 12px;
    cursor: pointer;
}

.preset:hover {
    background: var(--tao-color-surface-hover);
}

.cell {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
}

.shape {
    display: block;
    box-sizing: border-box;
    border: 2px solid currentColor;
    border-radius: 3px;
}
</style>
