<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from '@/i18n';
import { useEditor } from '../store';
import { coarse } from '@1337exp/taoux/touch';

const editor = useEditor();
const { t, nodeTitle } = useI18n();

const WIDTH = 240;
const HEIGHT = 300;

const query = ref('');
const active = ref(0);
const input = ref<HTMLInputElement | null>(null);

const items = computed(() => {
    const q = query.value.trim().toLowerCase();
    return editor.registry
        .all()
        .filter((def) => !def.point)
        .map((def) => ({ def, title: nodeTitle(def) }))
        .filter((item) => item.title.toLowerCase().includes(q) || item.def.id.includes(q));
});

const position = computed(() => {
    const p = editor.palette;
    if (!p) return {};
    // Не даём окну уехать за край экрана.
    const left = Math.max(8, Math.min(p.screen[0], window.innerWidth - WIDTH - 8));
    const top = Math.max(8, Math.min(p.screen[1], window.innerHeight - HEIGHT - 8));
    return { left: `${left}px`, top: `${top}px`, width: `${WIDTH}px`, maxHeight: `${HEIGHT}px` };
});

// Каждое открытие начинается с чистого поиска.
watch(
    () => editor.palette,
    async (now) => {
        if (!now) return;
        query.value = '';
        active.value = 0;
        await nextTick();
        // На сенсоре поле поиска не фокусируем: виртуальная клавиатура закрыла бы список.
        if (!coarse.value) input.value?.focus();
    },
);
watch(query, () => (active.value = 0));

function onKeyDown(e: KeyboardEvent) {
    const n = items.value.length;

    if (e.key === 'Escape') {
        editor.closePalette();
    } else if (e.key === 'ArrowDown' && n) {
        active.value = (active.value + 1) % n;
    } else if (e.key === 'ArrowUp' && n) {
        active.value = (active.value - 1 + n) % n;
    } else if (e.key === 'Enter') {
        const item = items.value[active.value];
        if (item) editor.createFromPalette(item.def.id);
    } else {
        return;
    }
    e.preventDefault();
}
</script>

<template>
    <div
        v-if="editor.palette"
        class="palette"
        :style="position"
        @pointerdown.stop
        @wheel.stop
        @contextmenu.prevent.stop
        @keydown="onKeyDown"
    >
        <div class="head">{{ editor.palette.origin ? t('palette.connect') : t('palette.add') }}</div>
        <input ref="input" v-model="query" class="search" :placeholder="t('palette.search')" spellcheck="false" />

        <div class="list">
            <div v-if="!items.length" class="empty">{{ t('palette.empty') }}</div>
            <button
                v-for="(item, i) in items"
                :key="item.def.id"
                class="item"
                :class="{ active: active === i }"
                @mousemove="active = i"
                @click="editor.createFromPalette(item.def.id)"
            >
                <i v-if="item.def.icon" :class="item.def.icon" />{{ item.title }}
            </button>
        </div>
    </div>
</template>

<style scoped>
.palette {
    position: absolute;
    z-index: 20;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--tao-color-border-strong, #4b5563);
    border-radius: 8px;
    background: var(--tao-color-surface-raised, #1f2937);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
    color: var(--tao-color-text, #e5e7eb);
    font-size: 13px;
}

.head {
    padding: 8px 12px 2px;
    color: var(--tao-color-text-muted, #9ca3af);
}

.search {
    margin: 6px 8px;
    padding: 6px 8px;
    border: 1px solid var(--tao-color-border-strong, #4b5563);
    border-radius: 6px;
    background: var(--tao-color-surface-raised, #1f2937);
    color: inherit;
    font: inherit;
    outline: none;
}

.search:focus {
    border-color: var(--tao-color-accent, #f59e0b);
}

.list {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 6px;
}

.item {
    display: block;
    width: 100%;
    padding: 6px 14px;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
}

.item.active {
    background: var(--tao-color-surface-hover, #374151);
}

.empty {
    padding: 8px 14px;
    color: var(--tao-color-text-muted, #9ca3af);
}
</style>
