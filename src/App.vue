<script lang="ts" setup>
import { onBeforeUnmount, onMounted } from 'vue';
import { useI18n } from '@/i18n';
import EditorCanvas from '@/editor/components/EditorCanvas.vue';
import NodePalette from '@/editor/components/NodePalette.vue';
import ContextMenu from '@/editor/components/ContextMenu.vue';
import ContextBar from '@/editor/components/ContextBar.vue';
import AppMenu from '@/editor/components/AppMenu.vue';
import ToolDock from '@/editor/components/ToolDock.vue';
import ZoomBar from '@/editor/components/ZoomBar.vue';
import { useCommands } from '@/editor/commands';
import { useEditor } from '@/editor/store';

const editor = useEditor();
const { t } = useI18n();

// Горячие клавиши всех команд на всём окне. / The shortcuts of every command, on the whole window.
const { commands } = useCommands();
let unbind: (() => void) | null = null;
onMounted(() => (unbind = commands.bind(window)));
onBeforeUnmount(() => unbind?.());
</script>

<template>
    <div class="app">
        <EditorCanvas />
        <AppMenu />
        <ToolDock />
        <ZoomBar />
        <ContextBar />
        <NodePalette />
        <ContextMenu />
        <div v-if="editor.notice" class="notice" :class="editor.notice.kind">
            {{ t(editor.notice.key, editor.notice.args) }}
        </div>
    </div>
</template>

<style scoped>
.app {
    position: relative;
    width: 100%;
    height: 100%;
}

.notice {
    position: absolute;
    bottom: 84px; /* над нижней панелью действий */
    left: 50%;
    z-index: 30;
    padding: 8px 14px;
    border-radius: 8px;
    background: var(--tao-color-surface-hover, #374151);
    color: var(--tao-color-text-strong, #fff);
    font-size: 13px;
    transform: translateX(-50%);
}

.notice.error {
    background: var(--tao-color-danger, #b91c1c);
}
</style>
