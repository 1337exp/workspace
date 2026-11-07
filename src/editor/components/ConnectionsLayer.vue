<script lang="ts" setup>
import { computed } from 'vue';
import { anchorPoint, resolveLink, sideToward } from '@/core/workspace';
import type { Side } from '@/core/types';
import { linkShape } from '@1337exp/taoux/curve';
import { TaoxLinks, type LinkLine, type LinkPreview } from '@1337exp/taoux/links';
import '@1337exp/taoux/links.css';
import { useEditor } from '../store';

const editor = useEditor();

const lines = computed<LinkLine[]>(() => {
    const out: LinkLine[] = [];
    const z = editor.camera.z;
    for (const c of editor.workspace.connections) {
        const link = resolveLink(editor.workspace, editor.registry, c);
        if (link) out.push({ id: c.id, ...linkShape(link.a, link.aSide, link.b, link.bSide, c.arrow, z) });
    }
    return out;
});

const preview = computed<LinkPreview | null>(() => {
    const p = editor.pending;
    if (!p) return null;

    const a = anchorPoint(editor.workspace, p.origin);
    if (!a) return null;

    const end = p.target ? anchorPoint(editor.workspace, p.target) : null;
    const b: [number, number] = end ?? p.cursor;
    // Свободный конец подходит к курсору со стороны исходного пина: линия «входит» в точку курсора по направлению движения.
    const bSide: Side = p.target ? p.target.side : sideToward(b, a);
    return { id: 'preview', ...linkShape(a, p.origin.side, b, bSide, editor.defaultArrow, editor.camera.z), invalid: p.valid === false };
});
</script>

<template>
    <TaoxLinks :lines="lines" :selected-id="editor.selectedConnection" :preview="preview" />
</template>

