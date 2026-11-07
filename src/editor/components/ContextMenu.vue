<script lang="ts" setup>
import { ref } from 'vue';
import { TaoMenu } from '@1337exp/taoui';
import { useI18n } from '@/i18n';
import { useContextMenu } from '../contextMenu';
import { useEditor } from '../store';

/**
 * Контекстное меню по правому клику на ноде или связи (по пустому месту открывается палитра нод). Меню висит у точки
 * нажатия: для этого под ней стоит невидимый якорь. Пункты и их разбор в `contextMenu.ts`.
 * The context menu on a right click over a node or a link (an empty place opens the node palette). The menu hangs at
 * the point of the press: an invisible anchor stands there for it. The items and their handling are in `contextMenu.ts`.
 */
const editor = useEditor();
const { t } = useI18n();
const { items, runContextItem } = useContextMenu();

const anchor = ref<HTMLElement | null>(null);

function onSelect(id: string) {
    runContextItem(id);
    editor.closeContext();
}
</script>

<template>
    <div v-if="editor.contextMenu" ref="anchor" class="anchor" :style="{ left: `${editor.contextMenu.screen[0]}px`, top: `${editor.contextMenu.screen[1]}px` }" />
    <TaoMenu
        v-if="editor.contextMenu"
        :open="true"
        :anchor="anchor"
        placement="bottom-start"
        :items="items"
        :label="t('context.title')"
        @select="onSelect"
        @close="editor.closeContext()"
        @pointerdown.stop
        @contextmenu.prevent
    />
</template>

<style scoped>
.anchor {
    position: absolute;
    width: 1px;
    height: 1px;
    pointer-events: none;
}
</style>
