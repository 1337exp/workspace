<script lang="ts" setup>
import { computed, ref } from 'vue';
import { TaoButton, TaoSegmented, TaoSegmentedOption } from '@1337exp/taoui';
import type { Arrow } from '@/core/types';
import { LOCALE_CODES, LOCALE_NAMES, isLocaleCode, setLocale, useI18n } from '@/i18n';
import { downloadText, FILE_NAME, MAX_FILE_BYTES } from '../file';
import { coarse } from '../touch';
import { useEditor } from '../store';

const editor = useEditor();
const { t, nodeTitle, locale } = useI18n();

const fileInput = ref<HTMLInputElement | null>(null);

const selectedLink = computed(() => editor.workspace.connections.find((c) => c.id === editor.selectedConnection));
/** Показываем вид выбранной связи, а без выбора — вид новых связей. */
const arrow = computed<Arrow>(() => selectedLink.value?.arrow ?? editor.defaultArrow);

function setArrow(value: unknown) {
    if (value === 'none' || value === 'end') editor.setArrowStyle(value);
}

function setLang(value: unknown) {
    if (isLocaleCode(value)) setLocale(value);
}

function save() {
    editor.flushSave();
    downloadText(FILE_NAME, editor.exportText());
}

async function onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // тот же файл можно будет выбрать ещё раз
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
        editor.showNotice('error', 'file.error.tooLarge');
        return;
    }
    editor.importText(await file.text());
}
</script>

<template>
    <div class="toolbar" @pointerdown.stop @wheel.stop>
        <TaoButton variant="secondary" size="small" @click="editor.newWorkspace()"><i class="icon-plus" />{{ t('file.new') }}</TaoButton>
        <TaoButton variant="secondary" size="small" @click="fileInput?.click()"><i class="icon-docs" />{{ t('file.open') }}</TaoButton>
        <TaoButton variant="secondary" size="small" @click="save"><i class="icon-download" />{{ t('file.save') }}</TaoButton>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onFile" />

        <span class="sep" />

        <TaoButton variant="secondary" size="small" :disabled="!editor.canUndo" :title="t('history.undo')" @click="editor.undo()">↶</TaoButton>
        <TaoButton variant="secondary" size="small" :disabled="!editor.canRedo" :title="t('history.redo')" @click="editor.redo()">↷</TaoButton>

        <span class="sep" />

        <TaoButton v-for="def in editor.registry.all().filter((d) => !d.point)" :key="def.id" variant="secondary" size="small" @click="editor.addNodeAtCenter(def.id)">
            <i v-if="def.icon" :class="def.icon" />{{ nodeTitle(def) }}
        </TaoButton>

        <span class="sep" />

        <TaoSegmented :model-value="arrow" size="small" @update:model-value="setArrow">
            <TaoSegmentedOption value="none">{{ t('link.line') }}</TaoSegmentedOption>
            <TaoSegmentedOption value="end">{{ t('link.arrow') }} →</TaoSegmentedOption>
        </TaoSegmented>
        <TaoButton variant="secondary" size="small" :disabled="!selectedLink" @click="editor.reverseSelected()"><i class="icon-shuffle" />{{ t('link.reverse') }}</TaoButton>

        <template v-if="coarse">
            <span class="sep" />
            <TaoButton
                :variant="editor.selectMode ? 'primary' : 'secondary'"
                size="small"
                :title="t('touch.selectHint')"
                @click="editor.selectMode = !editor.selectMode"
            >
                <i class="icon-dot-circled" />{{ t('touch.select') }}
            </TaoButton>
        </template>

        <span class="sep" />

        <TaoSegmented :model-value="locale" size="small" @update:model-value="setLang">
            <TaoSegmentedOption v-for="code in LOCALE_CODES" :key="code" :value="code">{{ LOCALE_NAMES[code] }}</TaoSegmentedOption>
        </TaoSegmented>
    </div>
</template>

<style scoped>
.toolbar {
    position: absolute;
    top: 12px;
    /* По центру без transform: при left: 50% доступная ширина всего половина контейнера. */
    left: 16px;
    right: 16px;
    margin-inline: auto;
    width: max-content;
    max-width: calc(100% - 32px);
    z-index: 10;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border: 1px solid var(--tao-color-border-strong, #4b5563);
    border-radius: 10px;
    background: color-mix(in srgb, var(--tao-color-surface-raised, #1f2937) 96%, transparent);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}

.sep {
    width: 1px;
    height: 20px;
    margin: 0 4px;
    background: var(--tao-color-border-strong, #4b5563);
}
</style>
