<script lang="ts" setup>
import { useI18n } from '@/i18n';
import EditorCanvas from '@/editor/components/EditorCanvas.vue';
import NodePalette from '@/editor/components/NodePalette.vue';
import ToolBar from '@/editor/components/ToolBar.vue';
import { useEditor } from '@/editor/store';

const editor = useEditor();
const { t } = useI18n();
</script>

<template>
    <div class="app">
        <EditorCanvas />
        <ToolBar />
        <NodePalette />
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
    bottom: 16px;
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
