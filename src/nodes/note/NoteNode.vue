<script lang="ts" setup>
import { useI18n } from '@/i18n';

defineProps<{ data: { text: string }; selected: boolean }>();
const emit = defineEmits<{ change: [patch: { text: string }] }>();

const { t } = useI18n();
</script>

<template>
    <textarea
        class="note"
        :value="data.text"
        :placeholder="t('nodes.note.placeholder')"
        spellcheck="false"
        @input="emit('change', { text: ($event.target as HTMLTextAreaElement).value })"
    />
</template>

<style scoped>
.note {
    display: block;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: 10px 12px;
    border: 0;
    border-radius: inherit;
    background: var(--nextup-bg-card);
    color: var(--tao-color-text, #e5e7eb);
    font: inherit;
    font-size: 14px;
    line-height: 1.4;
    resize: none;
    outline: none;
}
</style>
