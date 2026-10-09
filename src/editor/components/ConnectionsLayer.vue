<script lang="ts" setup>
import { computed } from 'vue';
import { anchorPoint, resolveLink, sideToward } from '@/core/workspace';
import type { Side } from '@/core/types';
import { linkShape, type LinkShape } from '../curve';
import { useEditor } from '../store';

const editor = useEditor();

interface Line extends LinkShape {
    id: string;
}

const lines = computed<Line[]>(() => {
    const out: Line[] = [];
    const z = editor.camera.z;
    for (const c of editor.workspace.connections) {
        const link = resolveLink(editor.workspace, editor.registry, c);
        if (link) out.push({ id: c.id, ...linkShape(link.a, link.aSide, link.b, link.bSide, c.arrow, z) });
    }
    return out;
});

const preview = computed(() => {
    const p = editor.pending;
    if (!p) return null;

    const a = anchorPoint(editor.workspace, p.origin);
    if (!a) return null;

    const end = p.target ? anchorPoint(editor.workspace, p.target) : null;
    const b: [number, number] = end ?? p.cursor;
    // Свободный конец подходит к курсору со стороны исходного пина: линия «входит» в точку курсора по направлению движения.
    const bSide: Side = p.target ? p.target.side : sideToward(b, a);
    return { ...linkShape(a, p.origin.side, b, bSide, editor.defaultArrow, editor.camera.z), invalid: p.valid === false };
});
</script>

<template>
    <svg class="connections" width="1" height="1">
        <g
            v-for="line in lines"
            :key="line.id"
            class="conn"
            :class="{ selected: editor.selectedConnection === line.id }"
            :data-conn-id="line.id"
        >
            <path class="line" :d="line.d" />
            <path v-if="line.head" class="head" :d="line.head" />
            <path class="hit" :d="line.d" />
        </g>

        <g v-if="preview" class="preview" :class="{ invalid: preview.invalid }">
            <path class="line" :d="preview.d" />
            <path v-if="preview.head" class="head" :d="preview.head" />
        </g>
    </svg>
</template>

<style scoped>
.connections {
    position: absolute;
    top: 0;
    left: 0;
    overflow: visible;
    pointer-events: none;
    --link: var(--tao-color-text-muted, #9ca3af);
}

path {
    fill: none;
    stroke-linecap: round;
    /* толщина в экранных пикселях, не зависит от зума */
    vector-effect: non-scaling-stroke;
}

.line {
    stroke: var(--link);
    stroke-width: 2;
    pointer-events: none;
}

.head {
    fill: var(--link);
    stroke: none;
    pointer-events: none;
}

.hit {
    stroke: transparent;
    stroke-width: 14;
    pointer-events: stroke;
    cursor: pointer;
}

.conn:hover {
    --link: var(--tao-color-text-strong, #fff);
}

.conn.selected {
    --link: var(--tao-color-accent, #f59e0b);
}

.conn:hover .line,
.conn.selected .line {
    stroke-width: 3;
}

.preview {
    --link: var(--tao-color-accent, #f59e0b);
    opacity: 0.85;
}

.preview .line {
    stroke-dasharray: 6 4;
}

.preview.invalid {
    --link: var(--tao-color-danger, #ef4444);
}
</style>
