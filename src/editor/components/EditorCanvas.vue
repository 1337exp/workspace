<script lang="ts" setup>
import { computed } from 'vue';
import { TaoxCanvas } from '@1337exp/taoux/canvas';
import '@1337exp/taoux/canvas.css';
import { workspaceCanvasHost, workspaceCanvasOptions } from '../canvasHost';
import { useEditor } from '../store';
import ConnectionsLayer from './ConnectionsLayer.vue';
import NodeView from './NodeView.vue';

const editor = useEditor();
const host = workspaceCanvasHost(editor);

// Контейнеры (группы) лежат под связями и остальными нодами; крупные ниже мелких, чтобы вложенные были сверху.
const isContainer = (type: string) => !!editor.registry.find(type)?.container;
const containers = computed(() =>
    Object.values(editor.workspace.nodes)
        .filter((n) => isContainer(n.type))
        .sort((a, b) => b.w * b.h - a.w * a.h),
);
const plainNodes = computed(() => Object.values(editor.workspace.nodes).filter((n) => !isContainer(n.type)));
</script>

<template>
    <TaoxCanvas class="canvas" :host="host" :options="workspaceCanvasOptions">
        <NodeView v-for="node in containers" :key="node.id" :node="node" :selected="editor.selection.has(node.id)" />
        <ConnectionsLayer />
        <NodeView v-for="node in plainNodes" :key="node.id" :node="node" :selected="editor.selection.has(node.id)" />
    </TaoxCanvas>
</template>

<style scoped>
.canvas {
    --tx-canvas-bg: var(--tao-color-bg, #1b1d21);
    --tx-canvas-accent: var(--tao-color-accent, #f59e0b);
    --tx-canvas-accent-subtle: var(--tao-color-accent-subtle, rgba(245, 158, 11, 0.1));
}
</style>
