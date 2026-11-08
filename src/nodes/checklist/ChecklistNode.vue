<script lang="ts" setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { TaoButton, TaoCheckbox, TaoIcon } from '@1337exp/taoui';
import { sortableTextsEn, sortableTextsRu, useSortable } from '@1337exp/taoux/sortable';
import { useI18n } from '@/i18n';
import {
    depthOf,
    emptyItem,
    indent,
    insertItem,
    isPartial,
    normalize,
    outdent,
    pasteLines,
    progress,
    removeItem,
    reorder,
    setDone,
    toggleCollapsed,
    visibleIndexes,
    hasChildren,
    type ChecklistData,
    type ChecklistItem,
} from './items';

/**
 * Чеклист: пункты с галочкой и текстом, вложенные до трёх уровней. Enter добавляет пункт ниже (у родителя первым
 * подпунктом), Tab вкладывает пункт в предыдущий, Shift+Tab выносит; Backspace и Enter в пустом вложенном сначала выносят,
 * в пустом верхнем Backspace убирает; стрелки ходят по пунктам, вставка многострочного текста раскладывается по пунктам
 * (отступы дают вложенность). Отметка родителя это отметка всех его подпунктов. «Скрыть выполненные» включается в панели
 * над нодой.
 * A checklist: items with a tick and text, nested up to three levels. Enter adds an item below (the first subitem of a
 * parent), Tab nests an item into the previous one, Shift+Tab lifts it; Backspace and Enter in an empty nested one lift
 * it first, Backspace in an empty top-level one removes it; arrows walk the items, pasting multi-line text spreads it
 * over items (indentation gives nesting). The tick of a parent is the tick of all its subitems. "Hide completed" is
 * switched on in the bar over the node.
 */
const props = defineProps<{ data: ChecklistData; selected: boolean }>();
const emit = defineEmits<{ change: [patch: Partial<ChecklistData>] }>();

const { t, locale } = useI18n();

// Нормализуем при чтении: данные могли быть написаны вручную или старой версией (без вложенности).
const items = computed<ChecklistItem[]>(() => normalize(props.data.items?.length ? props.data.items : [emptyItem([])]));
/** Видимые строки с номером в полном списке (нужен, чтобы знать, есть ли у строки подпункты). */
const rows = computed(() =>
    visibleIndexes(items.value)
        .map((index) => ({ item: items.value[index]!, index }))
        .filter((r) => !props.data.hideDone || !r.item.done),
);
const shown = computed(() => rows.value.map((r) => r.item));
const stat = computed(() => progress(items.value));

const inputs = new Map<string, HTMLInputElement>();
const setInput = (id: string, el: unknown) => {
    if (el instanceof HTMLInputElement) inputs.set(id, el);
    else inputs.delete(id);
};

async function focusItem(id: string) {
    await nextTick();
    const el = inputs.get(id);
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
}

// Только что созданный чеклист (выделен, один пустой пункт) сразу ждёт ввода.
onMounted(() => {
    const only = items.value.length === 1 ? items.value[0] : undefined;
    if (props.selected && only && only.text === '') void focusItem(only.id);
});

const commit = (next: ChecklistItem[]) => emit('change', { items: next });

// Перестановка за ручку слева (и с клавиатуры: Пробел поднимает, стрелки двигают). Списком управляет TaoUX, мы только
// говорим, куда встал пункт.
const list = ref<HTMLElement | null>(null);
useSortable(list, {
    onMove: (from, to) => commit(reorder(items.value, shown.value, from, to)),
    texts: () => (locale.value === 'ru' ? sortableTextsRu : sortableTextsEn),
    itemLabel: (el) => el.querySelector<HTMLInputElement>('input.text')?.value || t('nodes.checklist.item'),
});

function setText(id: string, text: string) {
    commit(items.value.map((i) => (i.id === id ? { ...i, text } : i)));
}

const toggle = (id: string, done: boolean) => commit(setDone(items.value, id, done));

/** Вложить (`in`) или вынести (`out`) пункт с подпунктами. Возвращает, получилось ли. */
function nest(item: ChecklistItem, dir: 'in' | 'out'): boolean {
    const next = dir === 'in' ? indent(items.value, item.id) : outdent(items.value, item.id);
    if (!next) return false;
    commit(next);
    void focusItem(item.id);
    return true;
}

/** Tab вкладывает, Shift+Tab выносит; если нельзя, клавиша делает своё обычное (уводит фокус). */
function onTab(e: KeyboardEvent, item: ChecklistItem) {
    if (nest(item, e.shiftKey ? 'out' : 'in')) e.preventDefault();
}

/** Enter: в пустом вложенном пункте выносит его на уровень, иначе добавляет пункт. */
function onEnter(item: ChecklistItem) {
    if (item.text === '' && depthOf(item) > 0) {
        const next = outdent(items.value, item.id);
        if (next) {
            commit(next);
            void focusItem(item.id);
            return;
        }
    }
    addAfter(item.id);
}

function addAfter(id: string | null) {
    const r = insertItem(items.value, id);
    commit(r.items);
    void focusItem(r.item.id);
}

function neighbour(id: string, step: -1 | 1) {
    const list = shown.value;
    const at = list.findIndex((i) => i.id === id);
    return list[at + step];
}

function onBackspace(e: KeyboardEvent, item: ChecklistItem) {
    if (item.text !== '') return;
    e.preventDefault();
    // В пустом вложенном пункте Backspace сначала выносит его, как во всех списках дел.
    if (depthOf(item) > 0) {
        const lifted = outdent(items.value, item.id);
        if (lifted) {
            commit(lifted);
            void focusItem(item.id);
            return;
        }
    }
    const prev = neighbour(item.id, -1) ?? neighbour(item.id, 1);
    commit(removeItem(items.value, item.id));
    if (prev) void focusItem(prev.id);
}

function onArrow(e: KeyboardEvent, item: ChecklistItem, step: -1 | 1) {
    const to = neighbour(item.id, step);
    if (!to) return;
    e.preventDefault();
    void focusItem(to.id);
}

function onPaste(e: ClipboardEvent, item: ChecklistItem) {
    const r = pasteLines(items.value, item.id, e.clipboardData?.getData('text') ?? '');
    if (!r) return;
    e.preventDefault();
    commit(r.items);
    void focusItem(r.focus);
}
</script>

<template>
    <div class="checklist">
        <ul ref="list" class="items">
            <li v-for="{ item, index } in rows" :key="item.id" class="item" :style="{ paddingLeft: `${depthOf(item) * 22}px` }" data-sortable-item>
                <button class="grip" type="button" data-sortable-handle :aria-label="t('nodes.checklist.move')" :title="t('nodes.checklist.move')">
                    <TaoIcon name="tao-grip" />
                </button>
                <button
                    v-if="hasChildren(items, index)"
                    class="fold"
                    type="button"
                    :aria-expanded="!item.collapsed"
                    :aria-label="item.collapsed ? t('nodes.checklist.expand') : t('nodes.checklist.collapse')"
                    :title="item.collapsed ? t('nodes.checklist.expand') : t('nodes.checklist.collapse')"
                    @click="commit(toggleCollapsed(items, item.id))"
                >
                    <TaoIcon :name="item.collapsed ? 'tao-chevron-right' : 'tao-chevron-down'" />
                </button>
                <span v-else class="fold" aria-hidden="true" />
                <TaoCheckbox
                    :model-value="item.done"
                    :indeterminate="isPartial(items, index)"
                    :aria-label="item.text || t('nodes.checklist.item')"
                    @update:model-value="toggle(item.id, $event)"
                />
                <input
                    :ref="(el) => setInput(item.id, el)"
                    class="text"
                    :class="{ done: item.done }"
                    :value="item.text"
                    :placeholder="t('nodes.checklist.item')"
                    spellcheck="false"
                    @input="setText(item.id, ($event.target as HTMLInputElement).value)"
                    @keydown.enter.prevent="onEnter(item)"
                    @keydown.tab="onTab($event, item)"
                    @keydown.backspace="onBackspace($event, item)"
                    @keydown.up="onArrow($event, item, -1)"
                    @keydown.down="onArrow($event, item, 1)"
                    @paste="onPaste($event, item)"
                />
                <!-- Пальцем Tab нет: две кнопки у пункта в фокусе. pointerdown.prevent оставляет фокус в поле, клавиатура не прячется. -->
                <span class="nest">
                    <button type="button" tabindex="-1" :aria-label="t('nodes.checklist.outdent')" :title="t('nodes.checklist.outdent') + ' (Shift+Tab)'" @pointerdown.prevent @click="nest(item, 'out')">
                        <TaoIcon name="tao-chevron-left" />
                    </button>
                    <button type="button" tabindex="-1" :aria-label="t('nodes.checklist.indent')" :title="t('nodes.checklist.indent') + ' (Tab)'" @pointerdown.prevent @click="nest(item, 'in')">
                        <TaoIcon name="tao-chevron-right" />
                    </button>
                </span>
            </li>
        </ul>

        <div class="foot">
            <TaoButton variant="text" tone="neutral" icon="tao-plus" @click="addAfter(null)">{{ t('nodes.checklist.add') }}</TaoButton>
            <span class="count">{{ t('nodes.checklist.progress', [stat.done, stat.total]) }}</span>
        </div>
        <div class="bar" role="progressbar" :aria-valuenow="stat.done" :aria-valuemax="stat.total" :aria-label="t('nodes.checklist.progress', [stat.done, stat.total])">
            <i :style="{ width: stat.total ? `${(stat.done / stat.total) * 100}%` : '0' }" />
        </div>
    </div>
</template>

<style scoped>
.checklist {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.items {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: 6px 8px 0;
    overflow-y: auto;
    list-style: none;
}

.item {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 30px;
}

/* Ручка перестановки: бледная, ярче при наведении на пункт и всегда видна под пальцем. */
.grip {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 24px;
    margin-left: -4px;
    padding: 0;
    border: 0;
    border-radius: var(--tao-radius-control);
    background: transparent;
    color: var(--tao-color-text-muted);
    cursor: grab;
    opacity: 0;
    touch-action: none;
}

.item:hover .grip,
.grip:focus-visible,
.item[data-sortable-lifted] .grip {
    opacity: 0.8;
}

.item[data-sortable-dragging] .grip {
    cursor: grabbing;
}

@media (pointer: coarse) {
    .grip {
        width: 24px;
        opacity: 0.6;
    }
}

/* Поднятый пункт: на своём фоне и с тенью, остальные расступаются. */
.item[data-sortable-dragging],
.item[data-sortable-lifted] {
    border-radius: var(--tao-radius-control);
    background: var(--tao-color-surface-hover);
    box-shadow: var(--tao-shadow-panel);
}

/* Стрелка сворачивания: у пункта без подпунктов пустое место того же размера, чтобы галочки стояли ровно. */
.fold {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: var(--tao-radius-control);
    background: transparent;
    color: var(--tao-color-text-muted);
}

button.fold {
    cursor: pointer;
}

button.fold:hover {
    color: var(--tao-color-text);
}

/* Кнопки «вложить» и «вынести»: мышью видны при наведении на пункт, пальцем у пункта в фокусе (Tab там нет). */
.nest {
    display: none;
    flex: none;
    gap: 2px;
}

.nest button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: var(--tao-radius-control);
    background: var(--tao-color-surface-hover);
    color: var(--tao-color-text);
}

.item:hover .nest,
.item:focus-within .nest {
    display: flex;
}

/* Мышью кнопки мельче: палец крупнее курсора. */
@media (pointer: fine) {
    .nest button {
        width: 22px;
        height: 22px;
    }
}

.text {
    flex: 1;
    min-width: 0;
    padding: 4px 2px;
    border: 0;
    border-bottom: 1px solid transparent;
    background: transparent;
    color: var(--tao-color-text);
    font: inherit;
    font-size: 14px;
    outline: none;
}

.text:focus {
    border-bottom-color: var(--tao-color-border-strong);
}

.text.done {
    color: var(--tao-color-text-muted);
    text-decoration: line-through;
}

.foot {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 2px 8px 4px;
}

.count {
    color: var(--tao-color-text-muted);
    font-size: 12px;
    white-space: nowrap;
}

/* Полоса выполнения вдоль нижнего края ноды. */
.bar {
    flex: none;
    height: 3px;
    background: var(--tao-color-border);
}

.bar i {
    display: block;
    height: 100%;
    background: var(--tao-color-success, var(--tao-color-accent));
    transition: width 0.2s;
}
</style>
