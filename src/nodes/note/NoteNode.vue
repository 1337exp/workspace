<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from '@/i18n';
import { fitFontSize } from './fit';

/**
 * Стикер: цветной квадрат с текстом. По умолчанию текст по центру и крупный; пока печатаешь, он уменьшается, чтобы
 * влезть, а если стикер растянуть, шрифт растёт под свободное место. Размер шрифта можно задать руками (`size`).
 * A sticker: a coloured square with text. By default the text is centred and large; while typing it shrinks to fit, and
 * when the sticker is stretched the font grows into the free space. The size can be set by hand (`size`).
 */
const props = defineProps<{
    data: { text: string; size?: number; bold?: boolean; align?: 'left' | 'center' | 'right' };
    selected: boolean;
    editing?: boolean;
}>();
const emit = defineEmits<{ change: [patch: { text: string }]; 'edit-end': [] }>();

const { t } = useI18n();

const PAD = 14;
const root = ref<HTMLElement | null>(null);
const view = ref<HTMLElement | null>(null);
const field = ref<HTMLTextAreaElement | null>(null);
/** Размер, подобранный автоматически (если `size` не задан). */
const fitted = ref(24);

const px = computed(() => (props.data.size && props.data.size > 0 ? props.data.size : fitted.value));
const align = computed(() => props.data.align ?? 'center');

/** Высота текста при размере шрифта `size`; у поля ввода сжимаем до нуля, чтобы `scrollHeight` показал высоту текста. */
function heightAt(size: number): number {
    const el = field.value ?? view.value;
    if (!el) return 0;
    el.style.fontSize = `${size}px`;
    // Слова не режем: если самое длинное не влезает по ширине, этот размер не подходит.
    el.style.overflowWrap = 'normal';
    const wide = el.scrollWidth > el.clientWidth + 1;
    el.style.overflowWrap = '';
    if (wide) return Infinity;
    if (el === field.value) {
        el.style.height = '0px';
        const h = el.scrollHeight;
        el.style.height = '';
        return h;
    }
    return el.offsetHeight;
}

function refit() {
    const box = root.value;
    if (!box || (props.data.size && props.data.size > 0)) return;
    // Пустой стикер показывает подсказку обычным размером, а не огромным.
    fitted.value = props.data.text || props.editing ? fitFontSize(heightAt, box.clientHeight - PAD * 2) : 22;
    // Вернуть управление размером шаблону.
    (field.value ?? view.value)?.style.removeProperty('font-size');
    if (field.value) sizeField();
}

/** Поле ввода по высоте равно тексту (по центру его ставит flex у родителя). */
function sizeField() {
    const ta = field.value;
    if (!ta) return;
    ta.style.height = '0px';
    ta.style.height = `${ta.scrollHeight}px`;
}

watch(
    () => props.editing,
    async (on) => {
        await nextTick();
        if (on && field.value) {
            field.value.focus();
            field.value.setSelectionRange(field.value.value.length, field.value.value.length);
        }
        refit();
    },
    { immediate: true },
);
watch(() => [props.data.text, props.data.size, props.data.bold], () => nextTick(refit));

let observer: ResizeObserver | null = null;
onMounted(() => {
    if (root.value && typeof ResizeObserver === 'function') {
        observer = new ResizeObserver(refit);
        observer.observe(root.value);
    }
    refit();
});
onBeforeUnmount(() => observer?.disconnect());

function onInput(e: Event) {
    emit('change', { text: (e.target as HTMLTextAreaElement).value });
}
</script>

<template>
    <div ref="root" class="sticker" :class="[`a-${align}`, { bold: data.bold }]" :style="{ '--px': `${px}px`, '--pad': `${PAD}px` }">
        <textarea
            v-if="editing"
            ref="field"
            class="body edit"
            :value="data.text"
            :placeholder="t('nodes.note.placeholder')"
            spellcheck="false"
            @input="onInput"
            @blur="emit('edit-end')"
            @keydown.esc.stop.prevent="($event.target as HTMLTextAreaElement).blur()"
        />
        <!-- data-node-handle: стикер таскают за любое место, двойной клик включает правку. -->
        <div v-else ref="view" class="body view" :class="{ empty: !data.text }" data-node-handle>{{ data.text || t('nodes.note.placeholder') }}</div>
    </div>
</template>

<style scoped>
.sticker {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: var(--pad);
    overflow: hidden;
    border-radius: inherit;
}

.body {
    box-sizing: border-box;
    width: 100%;
    max-height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: var(--px);
    line-height: 1.25;
    text-align: center;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    resize: none;
    outline: none;
}

.a-left .body {
    text-align: left;
}

.a-right .body {
    text-align: right;
}

.bold .body {
    font-weight: 700;
}

.view {
    cursor: default;
    user-select: none;
}

.view.empty {
    opacity: 0.45;
}

.edit {
    overflow: hidden;
}
</style>
