<script lang="ts" setup>
import { useI18n } from '@/i18n';
import { EMOJIS } from '@/nodes/emoji/emojis';

/**
 * Сетка эмодзи для выбора: в окошке у кнопки панели слева (выбранный ставится следующим кликом по холсту) и в панели над
 * выделенным стикером (заменяет эмодзи).
 * A grid of emoji to pick: in the popover of the left dock button (the picked one is placed by the next click on the
 * canvas) and in the bar over a picked sticker (replaces its emoji).
 */
defineProps<{ current?: string }>();
const emit = defineEmits<{ pick: [emoji: string] }>();

const { t } = useI18n();
</script>

<template>
    <div class="picker" role="listbox" :aria-label="t('emoji.pick')">
        <button
            v-for="emoji in EMOJIS"
            :key="emoji"
            type="button"
            role="option"
            class="cell"
            :class="{ current: emoji === current }"
            :aria-selected="emoji === current"
            :aria-label="emoji"
            @click="emit('pick', emoji)"
        >
            {{ emoji }}
        </button>
    </div>
</template>

<style scoped>
.picker {
    display: grid;
    grid-template-columns: repeat(8, 36px);
    gap: 2px;
}

.cell {
    width: 36px;
    height: 36px;
    padding: 0;
    border: 0;
    border-radius: var(--tao-radius-control);
    background: transparent;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
}

.cell:hover {
    background: var(--tao-color-surface-hover);
}

.cell.current {
    background: var(--tao-color-surface-hover);
    box-shadow: inset 0 0 0 1px var(--tao-color-accent);
}

@media (pointer: coarse) {
    .picker {
        grid-template-columns: repeat(6, 44px);
    }

    .cell {
        width: 44px;
        height: 44px;
        font-size: 26px;
    }
}
</style>
