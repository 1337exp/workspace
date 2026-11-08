<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from '@/i18n';
import { FONT_INPUT_MAX, FONT_MAX, FONT_MIN, fitFontSize, fittedSizes, stickerScale } from './fit';

/**
 * Стикер: цветной квадрат с текстом. Размер стикера работает как зум: текст растёт и уменьшается вместе с ним, а число
 * размера шрифта (логическое) не меняется. «Авто» (`size` 0) подбирает самый крупный размер, при котором текст влезает,
 * и пересчитывает его при наборе. Заданный руками размер не может не влезать: если перестал (стикер сузили, текста
 * прибавилось), включается «Авто».
 * Содержимое лежит в логической рамке (размер стикера, делённый на масштаб) и масштабируется `transform`; размер
 * считается по невидимому «зеркалу» с тем же текстом, при правке поле ввода лежит поверх него.
 * A sticker: a coloured square with text. Its size works as a zoom: the text grows and shrinks with it, while the font
 * size number (logical) stays. "Auto" (`size` 0) picks the largest size at which the text fits and recomputes it while
 * typing. A size set by hand cannot overflow: if it stops fitting (the sticker was narrowed, text was added), "Auto" turns on.
 * The content lies in a logical frame (the sticker size divided by the scale) scaled by `transform`; the size is measured
 * on an invisible "mirror" with the same text, and while editing the input field lies over it.
 */
const props = defineProps<{
    data: { text: string; size?: number; bold?: boolean; align?: 'left' | 'center' | 'right'; valign?: 'top' | 'middle' | 'bottom' };
    selected: boolean;
    editing?: boolean;
    nodeId?: string;
}>();
const emit = defineEmits<{ change: [patch: { text?: string; size?: number }]; 'edit-end': [] }>();

const { t } = useI18n();

const PAD = 14;
const root = ref<HTMLElement | null>(null);
const view = ref<HTMLElement | null>(null);
const field = ref<HTMLTextAreaElement | null>(null);

/** Размер стикера на экране (без учёта зума холста) и масштаб содержимого. */
const box = ref({ w: 240, h: 160 });
const scale = computed(() => stickerScale(box.value.w, box.value.h));
const logical = computed(() => ({ w: box.value.w / scale.value, h: box.value.h / scale.value }));

/** Размер, подобранный автоматически, и самый крупный, который влезает (логические). */
const fitted = ref(24);
const maxFit = ref(FONT_MAX);

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
    if (!root.value) return;
    const hasText = !!props.data.text || !!props.editing;
    if (hasText) {
        maxFit.value = fitFontSize(heightAt, logical.value.h - PAD * 2, FONT_MIN, FONT_INPUT_MAX);
        fitted.value = Math.min(maxFit.value, FONT_MAX);
    } else {
        // Пустой стикер показывает подсказку обычным размером, а не огромным.
        maxFit.value = FONT_MAX;
        fitted.value = 22;
    }
    view.value?.style.removeProperty('font-size'); // дальше размер ведёт шаблон
    // Заданный размер, который перестал влезать, уступает «Авто».
    if (hasText && manual.value && manual.value > maxFit.value) emit('change', { size: 0 });
    if (props.nodeId) fittedSizes[props.nodeId] = { size: px.value, max: maxFit.value };
}

function measure() {
    const el = root.value;
    if (el) box.value = { w: el.clientWidth || box.value.w, h: el.clientHeight || box.value.h };
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
watch(px, (v) => props.nodeId && (fittedSizes[props.nodeId] = { size: v, max: maxFit.value }));

let observer: ResizeObserver | null = null;
async function onResize() {
    measure();
    await nextTick();
    refit();
}
onMounted(async () => {
    measure();
    if (root.value && typeof ResizeObserver === 'function') {
        observer = new ResizeObserver(onResize);
        observer.observe(root.value);
    }
    await nextTick();
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
    <div ref="root" class="sticker-box">
        <div
            class="sticker"
            :class="[`a-${align}`, `v-${valign}`, { bold: data.bold }]"
            :style="{ '--px': `${px}px`, '--pad': `${PAD}px`, width: `${logical.w}px`, height: `${logical.h}px`, transform: `scale(${scale})` }"
        >
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
    </div>
</template>

<style scoped>
.sticker-box {
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: inherit;
}

.sticker {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    padding: var(--pad);
    overflow: hidden;
    transform-origin: 0 0;
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
