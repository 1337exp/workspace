<script lang="ts" setup>
import { computed, ref } from 'vue';
import { TaoInputNumber } from '@1337exp/taoui';
import { useI18n } from '@/i18n';
import { FONT_INPUT_MAX, FONT_INPUT_MIN, FONT_PRESETS } from '@/nodes/note/fit';

/**
 * Размер шрифта: поле с числом и стрелками, а под ним меню быстрых вариантов («Авто» и ряд размеров). Меню открывается,
 * когда фокус в поле, и закрывается выбором или уходом из поля. В «Авто» поле пустое с приглушённой подсказкой «Авто»
 * (размер «теневой»), а число появляется, когда размер задан; пункт «Авто» в меню отмечен.
 * Font size: a number field with arrows and a menu of quick choices under it ("Auto" and a row of sizes). The menu opens
 * while the field has the focus and closes on a pick or on leaving the field. In "Auto" the field is empty with a muted
 * "Auto" hint (the size is "shadow"), and the number appears once a size is set; the "Auto" row is marked.
 */
const props = defineProps<{
    /** Размер, с которым рисуется текст. / The size the text is drawn with. */
    size: number | null;
    /** Размер подбирается автоматически. / The size is fitted automatically. */
    auto: boolean;
    /** Самый крупный размер, который влезает: больше выбрать нельзя. / The largest size that fits: no larger one can be picked. */
    max?: number;
}>();
const emit = defineEmits<{ set: [size: number]; auto: [] }>();

const { t } = useI18n();
const open = ref(false);

const limit = computed(() => Math.min(FONT_INPUT_MAX, props.max ?? FONT_INPUT_MAX));
const fits = (n: number) => n <= limit.value;

function onCommit(value: number | null) {
    // Уход из поля тоже «завершает правку»: без этой проверки он записал бы показанное число поверх «Авто».
    if (value === null) return;
    if (props.auto) {
        // Стрелка из «Авто» даёт минимум: вместо него фиксируем размер, с которым текст рисуется сейчас.
        emit('set', Math.min(value === FONT_INPUT_MIN && props.size ? props.size : value, limit.value));
        return;
    }
    if (value !== props.size) emit('set', Math.min(value, limit.value));
}
function pick(size: number | null) {
    if (size === null) emit('auto');
    else if (fits(size)) emit('set', size);
    else return;
    open.value = false;
}
</script>

<template>
    <div class="size-field" @focusin="open = true" @focusout="(e) => !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null) && (open = false)" @keydown.esc.stop="open = false">
        <TaoInputNumber
            class="size-input"
            :model-value="auto ? null : size"
            :placeholder="t('context.auto')"
            :min="FONT_INPUT_MIN"
            :max="limit"
            :aria-label="t('context.fontSize')"
            @commit="onCommit"
        />
        <!-- mousedown.prevent: поле не теряет фокус до клика, иначе меню закрылось бы раньше выбора. -->
        <ul v-if="open" class="menu" role="listbox" :aria-label="t('context.fontSize')" @mousedown.prevent>
            <li role="option" :aria-selected="auto" :class="{ on: auto }" @click="pick(null)">{{ t('context.auto') }}</li>
            <li v-for="n in FONT_PRESETS" :key="n" role="option" :aria-selected="!auto && size === n" :aria-disabled="!fits(n)" :class="{ on: !auto && size === n, off: !fits(n) }" @click="pick(n)">{{ n }}</li>
        </ul>
    </div>
</template>

<style scoped>
.size-field {
    position: relative;
}

.size-input {
    width: 80px;
}

.menu {
    position: absolute;
    z-index: 20;
    top: calc(100% + 6px);
    left: 0;
    min-width: 100%;
    margin: 0;
    padding: 6px 4px;
    list-style: none;
    border: 1px solid var(--tao-color-border);
    border-radius: var(--tao-radius-md, 8px);
    background: var(--tao-color-surface-raised);
    box-shadow: var(--tao-shadow-panel);
}

.menu li {
    padding: 6px 10px;
    border-radius: 6px;
    color: var(--tao-color-text);
    font-size: 13px;
    text-align: center;
    cursor: pointer;
}

.menu li:hover {
    background: var(--tao-color-surface-hover);
}

.menu li.off {
    color: var(--tao-color-text-muted);
    opacity: 0.45;
    cursor: default;
}

.menu li.off:hover {
    background: none;
}

.menu li.on {
    color: var(--tao-color-accent);
    font-weight: 600;
}
</style>
