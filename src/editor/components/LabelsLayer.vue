<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { linkPointAt } from '@1337exp/taoux/curve';
import { resolveLink } from '@/core/workspace';
import { useI18n } from '@/i18n';
import { useEditor } from '../store';

/**
 * Подписи на связях: плашка посередине линии, которую можно выбрать кликом (как саму связь) и править на месте. Лежат в
 * мировых координатах над линиями и под нодами, поэтому масштабируются вместе с холстом. У плашки тот же
 * `data-conn-id`, что у линии: холст видит в ней связь (выбор, контекстное меню), а двойной клик по ней правит подпись.
 *
 * Labels on links: a pill in the middle of the line, which can be picked with a click (like the link itself) and edited in
 * place. They lie in world coordinates over the lines and under the nodes, so they scale with the canvas. The pill has
 * the same `data-conn-id` as the line: the canvas sees a link in it (picking, the context menu), and a double click on
 * it edits the label.
 */
const editor = useEditor();
const { t } = useI18n();

const items = computed(() => {
    const out: { id: string; label: string; x: number; y: number; selected: boolean; editing: boolean }[] = [];
    for (const c of editor.workspace.connections) {
        const editing = editor.labelEditing === c.id;
        if (c.label === undefined && !editing) continue;
        const link = resolveLink(editor.workspace, editor.registry, c);
        if (!link) continue;
        const [x, y] = linkPointAt(link.a, link.aSide, link.b, link.bSide);
        out.push({ id: c.id, label: c.label ?? '', x, y, selected: editor.selectedConnection === c.id, editing });
    }
    return out;
});

// Черновик правки живёт здесь; в данные он попадает по Enter или когда поле потеряло фокус.
const draft = ref('');
watch(
    () => editor.labelEditing,
    (id) => {
        if (id) draft.value = editor.workspace.connections.find((c) => c.id === id)?.label ?? '';
    },
    { immediate: true },
);

/**
 * Поле появляется и сразу в фокусе с выделенным текстом. Функция в `ref` вызывается при каждой перерисовке, а не только
 * при появлении поля: без проверки каждая набранная буква снова выделяла бы весь текст и следующая затирала его.
 * The field appears focused with its text selected. A function `ref` runs on every re-render, not only when the field
 * appears: without the check each typed letter would select the whole text again and the next one would overwrite it.
 */
let focused: HTMLInputElement | null = null;
function focusField(el: unknown) {
    if (!(el instanceof HTMLInputElement)) {
        focused = null;
        return;
    }
    if (el === focused) return;
    focused = el;
    el.focus();
    el.select();
}

function commit(id: string) {
    if (editor.labelEditing !== id) return; // уже закончили (Enter, затем blur)
    editor.endLabelEdit(id, draft.value);
}

function cancel(id: string) {
    if (editor.labelEditing === id) editor.endLabelEdit(id, null);
}
</script>

<template>
    <div class="labels">
        <template v-for="item in items" :key="item.id">
            <!-- pointerdown.stop: нажатие внутри поля не должно доходить до холста, иначе он заберёт фокус и закончит правку -->
            <input
                v-if="item.editing"
                :ref="focusField"
                v-model="draft"
                class="label edit"
                :style="{ left: `${item.x}px`, top: `${item.y}px`, width: `${Math.max(8, draft.length + 2)}ch` }"
                :placeholder="t('link.labelPlaceholder')"
                :aria-label="t('link.label')"
                maxlength="120"
                spellcheck="false"
                @pointerdown.stop
                @keydown.enter.prevent="commit(item.id)"
                @keydown.esc.stop.prevent="cancel(item.id)"
                @blur="commit(item.id)"
            />
            <div
                v-else
                class="label"
                :class="{ selected: item.selected }"
                :style="{ left: `${item.x}px`, top: `${item.y}px` }"
                :data-conn-id="item.id"
                data-link-label
                :title="item.label"
            >
                {{ item.label }}
            </div>
        </template>
    </div>
</template>

<style scoped>
.labels {
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
}

.label {
    position: absolute;
    box-sizing: border-box;
    max-width: 240px;
    padding: 2px 8px;
    overflow: hidden;
    border: 1px solid var(--tao-color-border-strong);
    border-radius: 999px;
    background: var(--tao-color-bg);
    color: var(--tao-color-text-muted);
    font: inherit;
    font-size: 12px;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
    transform: translate(-50%, -50%);
    user-select: none;
}

.label.selected {
    border-color: var(--tao-color-accent);
    color: var(--tao-color-text-strong);
}

.label.edit {
    min-width: 0;
    border-color: var(--tao-color-accent);
    color: var(--tao-color-text-strong);
    text-align: center;
    outline: none;
    user-select: text;
}
</style>
