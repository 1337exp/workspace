<script lang="ts" setup>
import { useEditor } from '../store';

/**
 * Направляющие, которые видны, пока тянут ноды: тонкие линии через совпавшие края и центры. Лежат в мировых
 * координатах поверх нод; толщина в экранных пикселях не зависит от масштаба. Клики пропускают.
 * The guides shown while nodes are dragged: thin lines through the coinciding edges and centres. They lie in world
 * coordinates over the nodes; the thickness is in screen pixels whatever the zoom. Clicks pass through.
 */
const editor = useEditor();
</script>

<template>
    <svg v-if="editor.guides.length" class="guides" width="1" height="1" aria-hidden="true">
        <line
            v-for="(line, i) in editor.guides"
            :key="i"
            :x1="line.axis === 'x' ? line.at : line.from"
            :y1="line.axis === 'x' ? line.from : line.at"
            :x2="line.axis === 'x' ? line.at : line.to"
            :y2="line.axis === 'x' ? line.to : line.at"
        />
    </svg>
</template>

<style scoped>
.guides {
    position: absolute;
    top: 0;
    left: 0;
    overflow: visible;
    pointer-events: none;
}

.guides line {
    stroke: var(--tao-color-info);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
}
</style>
