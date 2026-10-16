<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue';
import type { NodeData, NodeInstance } from '@/core/types';
import { isNodeColor } from '@/core/colors';
import { SIDES, type ResizeEdge } from '@/core/workspace';

const EDGES: readonly ResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
import { useI18n } from '@/i18n';
import { useEditor } from '../store';

const props = defineProps<{ node: NodeInstance; selected: boolean }>();

const editor = useEditor();
const { t, nodeTitle } = useI18n();

// Неизвестный тип — не ошибка: рисуем заглушку, а данные сохраняются как есть.
const def = computed(() => editor.registry.find(props.node.type));

/** Сторона, на которую сейчас целится протягиваемая связь. */
const targetSide = computed(() => {
    const target = editor.pending?.target;
    return target?.node === props.node.id ? target.side : null;
});
const targetValid = computed(() => editor.pending?.valid !== false);

const onChange = (patch: NodeData) => editor.patchData(props.node.id, patch);

/** Цвет ноды (если известный): CSS-переменная `--tint` тонирует рамку и полосу (у группы ещё и заливку). */
const tint = computed(() => (isNodeColor(props.node.color) ? props.node.color : null));
const nodeStyle = computed(() => ({
    transform: `translate(${props.node.x}px, ${props.node.y}px)`,
    width: `${props.node.w}px`,
    height: `${props.node.h}px`,
    ...(tint.value ? { '--tint': `var(--tint-${tint.value})` } : {}),
}));

//--------------------------------------------------
// Название в полосе: берётся из поля data (если нода его объявила) и правится двойным кликом по полосе.

const customTitle = computed(() => {
    const key = def.value?.titleKey;
    const value = key ? props.node.data[key] : undefined;
    return typeof value === 'string' && value !== '' ? value : null;
});
const title = computed(() => customTitle.value ?? (def.value ? nodeTitle(def.value) : t('nodes.unknown', [props.node.type])));

const editing = computed(() => editor.titleEditing === props.node.id && !!def.value?.titleKey);
const titleInput = ref<HTMLInputElement | null>(null);

watch(editing, async (on) => {
    if (!on) return;
    await nextTick();
    titleInput.value?.focus();
    titleInput.value?.select();
});

function finishTitle(save: boolean) {
    const key = def.value?.titleKey;
    if (editor.titleEditing !== props.node.id) return; // уже закончили (Enter, затем blur)
    editor.titleEditing = null;
    if (save && key && titleInput.value) editor.patchData(props.node.id, { [key]: titleInput.value.value.trim() });
}
</script>

<template>
    <!-- Нода-точка: кружок, за который двигают; кольцо вокруг него — пин, от него тянут связь. -->
    <div
        v-if="def?.point"
        class="node point"
        :class="{ selected }"
        :data-node-id="node.id"
        :style="nodeStyle"
    >
        <span class="ring" data-pin="auto" />
        <span class="knob" />
    </div>

    <div
        v-else
        class="node"
        :class="{ selected, unknown: !def, container: def?.container, tinted: tint }"
        :data-node-id="node.id"
        :data-node-container="def?.container ? '' : undefined"
        :style="nodeStyle"
    >
        <div class="frame">
            <header class="bar" data-node-handle>
                <i class="grip" />
                <input
                    v-if="editing"
                    ref="titleInput"
                    class="title-input"
                    :value="customTitle ?? ''"
                    :placeholder="title"
                    spellcheck="false"
                    @keydown.enter="finishTitle(true)"
                    @keydown.esc.stop="finishTitle(false)"
                    @blur="finishTitle(true)"
                />
                <span v-else class="title">{{ title }}</span>
            </header>
            <div class="content">
                <component :is="def.component" v-if="def" :data="node.data" :selected="selected" @change="onChange" />
            </div>
        </div>

        <!-- Нода тянется за любую грань и угол; тонкие зоны лежат под пинами, чтобы пины оставались доступны. -->
        <template v-if="def">
            <span v-for="edge in EDGES" :key="edge" class="edge" :class="edge" :data-resize="edge" />
        </template>

        <span
            v-for="side in SIDES"
            :key="side"
            class="pin"
            :class="[side, { target: targetSide === side, invalid: targetSide === side && !targetValid }]"
            :data-pin="side"
        >
            <i class="dot" />
        </span>
    </div>
</template>

<style scoped>
.node {
    position: absolute;
    top: 0;
    left: 0;
    box-sizing: border-box;
    /*
     * Зоны захвата пинов, граней и углов. *-size — размер зоны, *-in — сколько из них заходит внутрь ноды
     * (остальное снаружи). У курсора зоны симметричны относительно границы.
     */
    --pin-size: 26px;
    --pin-in: 13px;
    --edge-size: 10px;
    --edge-in: 5px;
    --corner-size: 14px;
    --corner-in: 7px;
    /* С какого расстояния от верха начинаются боковые полосы. */
    --side-start: 7px;
    --ring-size: 12px;
}

/*
 * Палец крупнее курсора, поэтому зоны больше, но почти целиком вынесены наружу: внутрь заходят единицы px.
 * Иначе они отнимали бы у содержимого полосу в пол-зоны, в том числе у шапки, за которую ноду таскают.
 * Боковые полосы начинаются под шапкой, верхней полосы нет совсем (высоту меняют за нижнюю грань или угол).
 */
@media (pointer: coarse) {
    .node {
        --pin-size: 44px;
        --pin-in: 10px;
        --edge-size: 28px;
        --edge-in: 6px;
        --corner-size: 32px;
        --corner-in: 8px;
        --side-start: 32px;
        --ring-size: 22px;
    }

    .edge.n {
        display: none;
    }
}

.frame {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border: 1px solid var(--tao-color-border-strong, #4b5563);
    border-radius: 8px;
    background: var(--tao-color-surface-raised, #1f2937);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
}

.node.selected .frame {
    border-color: var(--tao-color-accent, #f59e0b);
    box-shadow: 0 0 0 1px var(--tao-color-accent, #f59e0b), 0 4px 14px rgba(0, 0, 0, 0.55);
}

.node.unknown .frame {
    border-style: dashed;
}

/* Полоса, за которую таскают ноду. Точка слева — маркер «здесь можно тянуть». */
.bar {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 12px;
    background: var(--tao-color-surface-hover, #374151);
    color: var(--tao-color-text, #e5e7eb);
    font-size: 13px;
    cursor: grab;
    user-select: none;
}

.bar:active {
    cursor: grabbing;
}

.grip {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--tao-color-text-muted, #9ca3af);
}

.title-input {
    flex: 1;
    min-width: 0;
    padding: 2px 6px;
    border: 1px solid var(--tao-color-accent, #f59e0b);
    border-radius: 4px;
    background: var(--tao-color-bg, #111827);
    color: var(--tao-color-text, #e5e7eb);
    font: inherit;
    outline: none;
}

/* Контейнер (группа): полупрозрачная рамка под всем остальным; тело пропускает клики, ловят только полоса, пины и угол. */
.node.container {
    pointer-events: none;
}

.node.container .bar,
.node.container .pin,
.node.container .edge {
    pointer-events: auto;
}

/* Группа без цвета нейтральная, как остальные ноды: акцент занят выделением и не должен путаться с цветом из палитры. */
.node.container .frame {
    border: 1px dashed var(--tao-color-border-strong, #4b5563);
    background: color-mix(in srgb, var(--tao-color-text-strong, #fff) 3%, transparent);
    box-shadow: none;
}

.node.container.selected .frame {
    border-style: solid;
    border-color: var(--tao-color-accent, #f59e0b);
}

.title {
    overflow: hidden;
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.content {
    flex: 1;
    min-height: 0;
}

/* Зоны захвата граней ноды: полоса вдоль края, углы чуть больше. Размеры и вынос наружу: переменные выше. */
.edge {
    position: absolute;
}

.edge.n,
.edge.s {
    left: var(--corner-in);
    right: var(--corner-in);
    height: var(--edge-size);
    cursor: ns-resize;
}

.edge.e,
.edge.w {
    top: var(--side-start);
    bottom: var(--corner-in);
    width: var(--edge-size);
    cursor: ew-resize;
}

.edge.n { top: calc(var(--edge-in) - var(--edge-size)); }
.edge.s { bottom: calc(var(--edge-in) - var(--edge-size)); }
.edge.e { right: calc(var(--edge-in) - var(--edge-size)); }
.edge.w { left: calc(var(--edge-in) - var(--edge-size)); }

.edge.ne,
.edge.nw,
.edge.se,
.edge.sw {
    width: var(--corner-size);
    height: var(--corner-size);
}

.edge.ne { top: calc(var(--corner-in) - var(--corner-size)); right: calc(var(--corner-in) - var(--corner-size)); cursor: nesw-resize; }
.edge.sw { bottom: calc(var(--corner-in) - var(--corner-size)); left: calc(var(--corner-in) - var(--corner-size)); cursor: nesw-resize; }
.edge.nw { top: calc(var(--corner-in) - var(--corner-size)); left: calc(var(--corner-in) - var(--corner-size)); cursor: nwse-resize; }
.edge.se { bottom: calc(var(--corner-in) - var(--corner-size)); right: calc(var(--corner-in) - var(--corner-size)); cursor: nwse-resize; }

/*
 * Область пина шире точки, чтобы в него было легко попасть; внутрь ноды заходит только --pin-in.
 * Саму точку рисуем строго на границе: от внешнего края зоны до границы (--pin-size − --pin-in).
 */
.pin {
    position: absolute;
    width: var(--pin-size);
    height: var(--pin-size);
    cursor: crosshair;
}

.pin.left,
.pin.right {
    top: 50%;
    margin-top: calc(var(--pin-size) / -2);
}

.pin.left {
    left: calc(var(--pin-in) - var(--pin-size));
}

.pin.right {
    right: calc(var(--pin-in) - var(--pin-size));
}

.pin.top,
.pin.bottom {
    left: 50%;
    margin-left: calc(var(--pin-size) / -2);
}

.pin.top {
    top: calc(var(--pin-in) - var(--pin-size));
}

.pin.bottom {
    bottom: calc(var(--pin-in) - var(--pin-size));
}

.dot {
    position: absolute;
    box-sizing: border-box;
    width: 12px;
    height: 12px;
    border: 2px solid var(--tao-color-accent, #f59e0b);
    border-radius: 50%;
    background: var(--tao-color-bg, #111827);
    opacity: 0;
    transition: opacity 0.12s, transform 0.12s;
}

.pin.left .dot,
.pin.right .dot {
    top: calc(50% - 6px);
}

.pin.top .dot,
.pin.bottom .dot {
    left: calc(50% - 6px);
}

.pin.left .dot { left: calc(var(--pin-size) - var(--pin-in) - 6px); }
.pin.right .dot { left: calc(var(--pin-in) - 6px); }
.pin.top .dot { top: calc(var(--pin-size) - var(--pin-in) - 6px); }
.pin.bottom .dot { top: calc(var(--pin-in) - 6px); }

.node:hover .dot,
.node.selected .dot,
.pin.target .dot {
    opacity: 1;
}

.pin:hover .dot,
.pin.target .dot {
    transform: scale(1.35);
    background: var(--tao-color-accent, #f59e0b);
}

.pin.invalid .dot {
    border-color: var(--tao-color-danger, #ef4444);
    background: var(--tao-color-danger, #ef4444);
}

/* Пины всех нод видны, пока тянется связь. */
:global(.tx-canvas.connecting) .dot {
    opacity: 1;
}

/* Цвет ноды: тонирование рамки и полосы. Выделение остаётся акцентным и поверх цвета. */
.node.tinted .frame {
    border-color: color-mix(in srgb, var(--tint) 70%, transparent);
}

.node.tinted .bar {
    background: color-mix(in srgb, var(--tint) 24%, var(--tao-color-surface-hover, #374151));
}

.node.tinted .grip {
    background: var(--tint);
}

.node.tinted.selected .frame {
    border-color: var(--tao-color-accent, #f59e0b);
}

.node.container.tinted .frame {
    border-color: color-mix(in srgb, var(--tint) 65%, transparent);
    background: color-mix(in srgb, var(--tint) 6%, transparent);
}

.node.container.tinted .bar {
    background: color-mix(in srgb, var(--tint) 24%, var(--tao-color-surface-raised, #1f2937));
}

.node.container.tinted.selected .frame {
    border-color: var(--tao-color-accent, #f59e0b);
}

/* Нода-точка */
.node.point .ring {
    position: absolute;
    inset: calc(var(--ring-size) * -1);
    border-radius: 50%;
    cursor: crosshair;
}

.node.point .ring:hover,
:global(.tx-canvas.connecting) .node.point .ring {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tao-color-accent, #f59e0b) 60%, transparent);
}

.node.point .knob {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border: 2px solid var(--tao-color-text-muted, #9ca3af);
    border-radius: 50%;
    background: var(--tao-color-surface-raised, #1f2937);
    cursor: grab;
}

.node.point.selected .knob,
.node.point:hover .knob {
    border-color: var(--tao-color-accent, #f59e0b);
}
/* Нет наведения: пины видны бледно всегда, у выбранной ноды ярко (правила выше сильнее по специфичности). */
@media (pointer: coarse) {
    .dot {
        opacity: 0.45;
    }
}
</style>
