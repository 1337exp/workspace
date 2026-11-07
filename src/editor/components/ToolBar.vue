<script lang="ts" setup>
import { TaoButton, TaoSegmented, TaoSegmentedOption } from '@1337exp/taoui';
import { LOCALE_CODES, LOCALE_NAMES, isLocaleCode, setLocale, useI18n } from '@/i18n';
import { coarse } from '@1337exp/taoux/touch';
import { useCommands } from '../commands';
import { useEditor } from '../store';

const editor = useEditor();
const cmd = useCommands();
const { t, locale } = useI18n();

/** Выбранный вид связи (радио-команды `link.*`): без выбора это вид новых связей. */
const arrow = () => (cmd.checked('link.arrow') ? 'end' : 'none');

function setArrow(value: unknown) {
    if (value === 'none') cmd.run('link.line');
    else if (value === 'end') cmd.run('link.arrow');
}

function setLang(value: unknown) {
    if (isLocaleCode(value)) setLocale(value);
}
</script>

<template>
    <div class="toolbar" @pointerdown.stop @wheel.stop>
        <TaoButton variant="secondary" size="small" icon="tao-plus" @click="cmd.run('file.new')">{{ cmd.label('file.new') }}</TaoButton>
        <TaoButton variant="secondary" size="small" icon="tao-folder" :title="cmd.hint('file.open')" @click="cmd.run('file.open')">{{ cmd.label('file.open') }}</TaoButton>
        <TaoButton variant="secondary" size="small" icon="file-save" :title="cmd.hint('file.save')" @click="cmd.run('file.save')">{{ cmd.label('file.save') }}</TaoButton>

        <span class="sep" />

        <TaoButton variant="secondary" size="small" icon="tao-undo" :aria-label="cmd.label('edit.undo')" :disabled="!cmd.enabled('edit.undo')" :title="cmd.hint('edit.undo')" @click="cmd.run('edit.undo')" />
        <TaoButton variant="secondary" size="small" icon="tao-redo" :aria-label="cmd.label('edit.redo')" :disabled="!cmd.enabled('edit.redo')" :title="cmd.hint('edit.redo')" @click="cmd.run('edit.redo')" />
        <TaoButton :variant="cmd.checked('view.grid') ? 'primary' : 'secondary'" size="small" icon="view-grid" :title="t('grid.hint')" @click="cmd.run('view.grid')">{{ cmd.label('view.grid') }}</TaoButton>

        <span class="sep" />

        <TaoButton
            v-for="def in editor.registry.all().filter((d) => !d.point)"
            :key="def.id"
            variant="secondary"
            size="small"
            :icon="def.icon"
            @click="cmd.run('node.add.' + def.id)"
        >
            {{ cmd.label('node.add.' + def.id) }}
        </TaoButton>

        <span class="sep" />

        <TaoSegmented :model-value="arrow()" size="small" @update:model-value="setArrow">
            <TaoSegmentedOption value="none">{{ cmd.label('link.line') }}</TaoSegmentedOption>
            <TaoSegmentedOption value="end">{{ cmd.label('link.arrow') }} →</TaoSegmentedOption>
        </TaoSegmented>
        <TaoButton variant="secondary" size="small" :disabled="!cmd.enabled('link.reverse')" icon="link-reverse" @click="cmd.run('link.reverse')">{{ cmd.label('link.reverse') }}</TaoButton>

        <template v-if="coarse">
            <span class="sep" />
            <TaoButton
                :variant="editor.selectMode ? 'primary' : 'secondary'"
                size="small"
                icon="touch-select"
                :title="t('touch.selectHint')"
                @click="editor.selectMode = !editor.selectMode"
            >
                {{ t('touch.select') }}
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
