<script lang="ts" setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { TaoButton, TaoCheckbox, TaoIcon } from '@1337exp/taoui';
import { sortableTextsEn, sortableTextsRu, useSortable } from '@1337exp/taoux/sortable';
import { useI18n } from '@/i18n';
import { emptyItem, insertItem, pasteLines, progress, removeItem, reorder, type ChecklistData, type ChecklistItem } from './items';

/**
 * Чеклист: пункты с галочкой и текстом. Enter добавляет пункт ниже, Backspace в пустом убирает его, стрелки ходят по
 * пунктам, вставка многострочного текста раскладывается по пунктам. «Скрыть выполненные» включается в панели над нодой.
 * A checklist: items with a tick and text. Enter adds an item below, Backspace in an empty one removes it, arrows walk
 * the items, pasting multi-line text spreads it over items. "Hide completed" is switched on in the bar over the node.
 */
const props = defineProps<{ data: ChecklistData; selected: boolean }>();
const emit = defineEmits<{ change: [patch: Partial<ChecklistData>] }>();

const { t, locale } = useI18n();

const items = computed<ChecklistItem[]>(() => (props.data.items?.length ? props.data.items : [emptyItem([])]));
const shown = computed(() => (props.data.hideDone ? items.value.filter((i) => !i.done) : items.value));
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

function setDone(id: string, done: boolean) {
    commit(items.value.map((i) => (i.id === id ? { ...i, done } : i)));
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
            <li v-for="item in shown" :key="item.id" class="item" data-sortable-item>
                <button class="grip" type="button" data-sortable-handle :aria-label="t('nodes.checklist.move')" :title="t('nodes.checklist.move')">
                    <TaoIcon name="tao-grip" />
                </button>
                <TaoCheckbox :model-value="item.done" :aria-label="item.text || t('nodes.checklist.item')" @update:model-value="setDone(item.id, $event)" />
                <input
                    :ref="(el) => setInput(item.id, el)"
                    class="text"
                    :class="{ done: item.done }"
                    :value="item.text"
                    :placeholder="t('nodes.checklist.item')"
                    spellcheck="false"
                    @input="setText(item.id, ($event.target as HTMLInputElement).value)"
                    @keydown.enter.prevent="addAfter(item.id)"
                    @keydown.backspace="onBackspace($event, item)"
                    @keydown.up="onArrow($event, item, -1)"
                    @keydown.down="onArrow($event, item, 1)"
                    @paste="onPaste($event, item)"
                />
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
