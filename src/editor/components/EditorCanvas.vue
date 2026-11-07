<script lang="ts" setup>
import { computed } from 'vue';
import { TaoxCanvas } from '@1337exp/taoux/canvas';
import '@1337exp/taoux/canvas.css';
import { workspaceCanvasHost, workspaceCanvasOptions } from '../canvasHost';
import { useCommands } from '../commands';
import { useEditor } from '../store';
import ConnectionsLayer from './ConnectionsLayer.vue';
import NodeView from './NodeView.vue';

const editor = useEditor();
const { claimsKey } = useCommands();
const host = workspaceCanvasHost(editor, claimsKey);

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
    <TaoxCanvas :class="{ placing: editor.placing }" :host="host" :options="workspaceCanvasOptions">
        <NodeView v-for="node in containers" :key="node.id" :node="node" :selected="editor.selection.has(node.id)" />
        <ConnectionsLayer />
        <NodeView v-for="node in plainNodes" :key="node.id" :node="node" :selected="editor.selection.has(node.id)" />
    </TaoxCanvas>
</template>

<style scoped>
/* Инструмент «поставить» включён: везде, где нажатие поставит ноду, курсор-прицел. */
.placing,
.placing :deep(*) {
    cursor: crosshair;
}
</style>
