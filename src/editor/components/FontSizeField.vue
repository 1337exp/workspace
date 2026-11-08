<script lang="ts" setup>
import { ref } from 'vue';
import { TaoInputNumber } from '@1337exp/taoui';
import { useI18n } from '@/i18n';
import { FONT_INPUT_MAX, FONT_INPUT_MIN, FONT_PRESETS } from '@/nodes/note/fit';

/**
 * Размер шрифта: поле с числом и стрелками, а под ним меню быстрых вариантов («Авто» и ряд размеров). Меню открывается,
 * когда фокус в поле, и закрывается выбором или уходом из поля. Число показывает размер, с которым текст рисуется сейчас,
 * и при «Авто» тоже; пункт «Авто» в меню отмечен, пока размер подбирается сам.
 * Font size: a number field with arrows and a menu of quick choices under it ("Auto" and a row of sizes). The menu opens
 * while the field has the focus and closes on a pick or on leaving the field. The number is the size the text is drawn
 * with now, also in "Auto"; the "Auto" row is marked while the size is fitted.
 */
defineProps<{
    /** Размер, с которым рисуется текст. / The size the text is drawn with. */
    size: number | null;
    /** Размер подбирается автоматически. / The size is fitted automatically. */
    auto: boolean;
}>();
const emit = defineEmits<{ set: [size: number]; auto: [] }>();

const { t } = useI18n();
const open = ref(false);

function onCommit(value: number | null) {
    if (value !== null) emit('set', value);
}
function pick(size: number | null) {
    if (size === null) emit('auto');
    else emit('set', size);
    open.value = false;
}
</script>

<template>
    <div class="size-field" @focusin="open = true" @focusout="(e) => !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null) && (open = false)" @keydown.esc.stop="open = false">
        <TaoInputNumber
            class="size-input"
            :model-value="size"
            :min="FONT_INPUT_MIN"
            :max="FONT_INPUT_MAX"
            :aria-label="t('context.fontSize')"
            @commit="onCommit"
        />
        <!-- mousedown.prevent: поле не теряет фокус до клика, иначе меню закрылось бы раньше выбора. -->
        <ul v-if="open" class="menu" role="listbox" :aria-label="t('context.fontSize')" @mousedown.prevent>
            <li role="option" :aria-selected="auto" :class="{ on: auto }" @click="pick(null)">{{ t('context.auto') }}</li>
            <li v-for="n in FONT_PRESETS" :key="n" role="option" :aria-selected="!auto && size === n" :class="{ on: !auto && size === n }" @click="pick(n)">{{ n }}</li>
        </ul>
    </div>
</template>

<style scoped>
.size-field {
    position: relative;
}

.size-input {
    width: 76px;
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

.menu li.on {
    color: var(--tao-color-accent);
    font-weight: 600;
}
</style>
