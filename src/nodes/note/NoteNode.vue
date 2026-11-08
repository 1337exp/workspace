<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from '@/i18n';
import { fitFontSize, fittedSizes } from './fit';

/**
 * Стикер: цветной квадрат с текстом. По умолчанию текст по центру и крупный; пока печатаешь, он уменьшается, чтобы
 * влезть, а если стикер растянуть, шрифт растёт под свободное место. Размер шрифта можно задать руками (`size`).
 * Размер всегда считается по невидимому «зеркалу» с тем же текстом (при правке поле ввода лежит поверх него), поэтому
 * текст не меняется в размере при входе в правку.
 * A sticker: a coloured square with text. By default the text is centred and large; while typing it shrinks to fit, and
 * when the sticker is stretched the font grows into the free space. The size can be set by hand (`size`).
 * The size is always measured on an invisible "mirror" with the same text (while editing the field lies over it), so the
 * text does not change size when editing starts.
 */
const props = defineProps<{
    data: { text: string; size?: number; bold?: boolean; align?: 'left' | 'center' | 'right'; valign?: 'top' | 'middle' | 'bottom' };
    selected: boolean;
    editing?: boolean;
    nodeId?: string;
}>();
const emit = defineEmits<{ change: [patch: { text: string }]; 'edit-end': [] }>();

const { t } = useI18n();

const PAD = 14;
const root = ref<HTMLElement | null>(null);
const view = ref<HTMLElement | null>(null);
const field = ref<HTMLTextAreaElement | null>(null);
/** Размер, подобранный автоматически (если `size` не задан). */
const fitted = ref(24);

const manual = computed(() => (props.data.size && props.data.size > 0 ? props.data.size : 0));
const px = computed(() => manual.value || fitted.value);
const align = computed(() => props.data.align ?? 'center');
const valign = computed(() => props.data.valign ?? 'middle');
/** Что показывает зеркало: текст (с невидимым знаком в конце, чтобы последний перенос строки считался) или подсказка. */
const shown = computed(() => (props.editing ? `${props.data.text}​` : props.data.text || t('nodes.note.placeholder')));

/** Высота текста при размере шрифта `size`; если самое длинное слово не влезает по ширине, размер не подходит. */
function heightAt(size: number): number {
    const el = view.value;
    if (!el) return 0;
    el.style.fontSize = `${size}px`;
    el.style.overflowWrap = 'normal';
    const wide = el.scrollWidth > el.clientWidth + 1;
    el.style.overflowWrap = '';
    return wide ? Infinity : el.offsetHeight;
}

function refit() {
    const box = root.value;
    if (!box || manual.value) return;
    // Пустой стикер показывает подсказку обычным размером, а не огромным.
    fitted.value = props.data.text || props.editing ? fitFontSize(heightAt, box.clientHeight - PAD * 2) : 22;
    view.value?.style.removeProperty('font-size'); // дальше размер ведёт шаблон
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

// Размер для панели: там показывается число и при «Авто».
watch(px, (v) => props.nodeId && (fittedSizes[props.nodeId] = v), { immediate: true });

let observer: ResizeObserver | null = null;
onMounted(() => {
    if (root.value && typeof ResizeObserver === 'function') {
        observer = new ResizeObserver(refit);
        observer.observe(root.value);
    }
    refit();
});
onBeforeUnmount(() => {
    observer?.disconnect();
    if (props.nodeId) delete fittedSizes[props.nodeId];
});

function onInput(e: Event) {
    emit('change', { text: (e.target as HTMLTextAreaElement).value });
}
</script>

<template>
    <div ref="root" class="sticker" :class="[`a-${align}`, `v-${valign}`, { bold: data.bold }]" :style="{ '--px': `${px}px`, '--pad': `${PAD}px` }">
        <div class="slot">
            <!-- Зеркало: по нему считается размер; без правки оно же и показывает текст, его таскают за любое место. -->
            <div ref="view" class="body view" :class="{ empty: !data.text && !editing, ghost: editing }" :data-node-handle="editing ? undefined : ''">{{ shown }}</div>
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
        </div>
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

.sticker.v-top {
    align-items: flex-start;
}

.sticker.v-bottom {
    align-items: flex-end;
}

.slot {
    position: relative;
    width: 100%;
    max-height: 100%;
}

.body {
    box-sizing: border-box;
    width: 100%;
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

.ghost {
    visibility: hidden;
}

.edit {
    position: absolute;
    inset: 0;
    height: 100%;
    overflow: hidden;
}
</style>
