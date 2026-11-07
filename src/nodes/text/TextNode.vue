<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from '@/i18n';

/**
 * Текст на холсте. Обычно это просто строки (их можно таскать за любое место); двойной клик, а у новой ноды сразу,
 * включает правку на месте. Высота ноды следует за текстом: компонент сообщает нужную высоту событием `fit`.
 * Text on the canvas. Normally just lines (draggable anywhere); a double click, or at once for a new node, starts
 * in-place editing. The node height follows the text: the component reports the height it needs with `fit`.
 */
const props = defineProps<{ data: { text: string; large?: boolean }; selected: boolean; editing?: boolean }>();
const emit = defineEmits<{ change: [patch: { text: string }]; 'edit-end': []; fit: [height: number] }>();

const { t } = useI18n();

const root = ref<HTMLElement | null>(null);
const view = ref<HTMLElement | null>(null);
const field = ref<HTMLTextAreaElement | null>(null);

/** Сообщает высоту, которая нужна тексту при нынешней ширине. */
function fit() {
    const ta = field.value;
    if (ta) {
        // Сжимаем до нуля, чтобы scrollHeight показал высоту текста, а не высоту поля.
        ta.style.height = '0px';
        const h = ta.scrollHeight;
        ta.style.height = '';
        emit('fit', h);
    } else if (view.value) {
        emit('fit', view.value.offsetHeight);
    }
}

watch(
    () => props.editing,
    async (on) => {
        await nextTick();
        if (on && field.value) {
            field.value.focus();
            field.value.setSelectionRange(field.value.value.length, field.value.value.length);
        }
        fit();
    },
    { immediate: true },
);
watch(() => props.data.text, () => nextTick(fit));

// Ширину меняют растягиванием: тогда строки переносятся иначе, и высота пересчитывается.
let observer: ResizeObserver | null = null;
onMounted(() => {
    if (root.value && typeof ResizeObserver === 'function') {
        observer = new ResizeObserver(fit);
        observer.observe(root.value);
    }
    fit();
});
onBeforeUnmount(() => observer?.disconnect());

function onInput(e: Event) {
    emit('change', { text: (e.target as HTMLTextAreaElement).value });
}
</script>

<template>
    <div ref="root" class="text-root" :class="{ large: data.large }">
        <textarea
            v-if="editing"
            ref="field"
            class="text edit"
            :value="data.text"
            :placeholder="t('nodes.text.placeholder')"
            spellcheck="false"
            @input="onInput"
            @blur="emit('edit-end')"
            @keydown.esc.stop.prevent="($event.target as HTMLTextAreaElement).blur()"
        />
        <!-- data-node-handle: двойной клик по тексту зовёт activate, и стор включает правку. -->
        <div v-else ref="view" class="text view" :class="{ empty: !data.text }" data-node-handle>{{ data.text || t('nodes.text.placeholder') }}</div>
    </div>
</template>

<style scoped>
.text-root {
    position: relative;
    width: 100%;
    height: 100%;
}

.text {
    box-sizing: border-box;
    width: 100%;
    margin: 0;
    padding: 4px 6px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 20px;
    line-height: 1.3;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.large .text {
    font-size: 32px;
}

.view {
    cursor: default;
    user-select: none;
}

.view.empty {
    color: var(--tao-color-text-muted);
}

.edit {
    position: absolute;
    inset: 0;
    height: 100%;
    overflow: hidden;
    resize: none;
    outline: none;
}
</style>
