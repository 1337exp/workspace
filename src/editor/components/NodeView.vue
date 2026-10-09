<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue';
import type { NodeData, NodeInstance } from '@/core/types';
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
        :style="{ transform: `translate(${node.x}px, ${node.y}px)`, width: `${node.w}px`, height: `${node.h}px` }"
    >
        <span class="ring" data-pin="auto" />
        <span class="knob" />
    </div>

    <div
        v-else
        class="node"
        :class="{ selected, unknown: !def, container: def?.container }"
        :data-node-id="node.id"
        :style="{ transform: `translate(${node.x}px, ${node.y}px)`, width: `${node.w}px`, height: `${node.h}px` }"
    >
        <div class="frame">
            <header class="bar">
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

        <span v-if="selected && def" class="resize" data-resize="se" />
    </div>
</template>

<style scoped>
.node {
    position: absolute;
    top: 0;
    left: 0;
    box-sizing: border-box;
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
    color: var(--tao-color-text-muted, #9ca3af);
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
    transition: background 0.12s;
}

.node:hover .grip,
.node.selected .grip {
    background: var(--tao-color-accent, #f59e0b);
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

/* У рамки полоса полупрозрачная, поэтому точка и название белые: иначе их плохо видно. */
.node.container .bar {
    color: var(--tao-color-text-strong, #fff);
}

.node.container .grip {
    background: var(--tao-color-text-strong, #fff);
}

.node.container:hover .grip,
.node.container.selected .grip {
    background: var(--tao-color-accent, #f59e0b);
}

/* Контейнер (группа): полупрозрачная рамка под всем остальным; тело пропускает клики, ловят только полоса, пины и угол. */
.node.container {
    pointer-events: none;
}

.node.container .bar,
.node.container .pin,
.node.container .edge,
.node.container .resize {
    pointer-events: auto;
}

.node.container .frame {
    border: 1px dashed color-mix(in srgb, var(--tao-color-accent, #f59e0b) 55%, transparent);
    background: color-mix(in srgb, var(--tao-color-accent, #f59e0b) 5%, transparent);
    box-shadow: none;
}

.node.container.selected .frame {
    border-style: solid;
    border-color: var(--tao-color-accent, #f59e0b);
}

.node.container .bar {
    background: color-mix(in srgb, var(--tao-color-accent, #f59e0b) 14%, var(--tao-color-surface-raised, #1f2937));
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

/* Зоны захвата граней ноды: полоса 10 px, половина снаружи рамки; углы чуть больше. */
.edge {
    position: absolute;
}

.edge.n,
.edge.s {
    left: 8px;
    right: 8px;
    height: 10px;
    cursor: ns-resize;
}

.edge.e,
.edge.w {
    top: 8px;
    bottom: 8px;
    width: 10px;
    cursor: ew-resize;
}

.edge.n { top: -5px; }
.edge.s { bottom: -5px; }
.edge.e { right: -5px; }
.edge.w { left: -5px; }

.edge.ne,
.edge.nw,
.edge.se,
.edge.sw {
    width: 14px;
    height: 14px;
}

.edge.ne { top: -6px; right: -6px; cursor: nesw-resize; }
.edge.sw { bottom: -6px; left: -6px; cursor: nesw-resize; }
.edge.nw { top: -6px; left: -6px; cursor: nwse-resize; }
.edge.se { bottom: -6px; right: -6px; cursor: nwse-resize; }

/* Область пина шире точки, чтобы в него было легко попасть. Точка видна у наведённой/выбранной ноды. */
.pin {
    position: absolute;
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: crosshair;
}

.pin.left,
.pin.right {
    top: 50%;
    margin-top: -13px;
}

.pin.left {
    left: -13px;
}

.pin.right {
    right: -13px;
}

.pin.top,
.pin.bottom {
    left: 50%;
    margin-left: -13px;
}

.pin.top {
    top: -13px;
}

.pin.bottom {
    bottom: -13px;
}

.dot {
    box-sizing: border-box;
    width: 12px;
    height: 12px;
    border: 2px solid var(--tao-color-accent, #f59e0b);
    border-radius: 50%;
    background: var(--tao-color-bg, #111827);
    opacity: 0;
    transition: opacity 0.12s, transform 0.12s;
}

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
:global(.canvas.connecting) .dot {
    opacity: 1;
}

.resize {
    position: absolute;
    right: -2px;
    bottom: -2px;
    width: 16px;
    height: 16px;
    cursor: nwse-resize;
    background: linear-gradient(
        135deg,
        transparent 50%,
        var(--tao-color-accent, #f59e0b) 50%,
        var(--tao-color-accent, #f59e0b) 58%,
        transparent 58%,
        transparent 70%,
        var(--tao-color-accent, #f59e0b) 70%,
        var(--tao-color-accent, #f59e0b) 78%,
        transparent 78%
    );
    border-bottom-right-radius: 8px;
}

/* Нода-точка */
.node.point .ring {
    position: absolute;
    inset: -12px;
    border-radius: 50%;
    cursor: crosshair;
}

.node.point .ring:hover,
:global(.canvas.connecting) .node.point .ring {
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
</style>
