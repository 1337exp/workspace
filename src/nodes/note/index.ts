import { defineNode } from '@/core/define';
import NoteNode from './NoteNode.vue';

export default defineNode({
    id: 'note',
    title: 'Note',
    icon: 'icon-pencil',
    size: { w: 240, h: 160, minW: 120, minH: 80 },
    create: () => ({ text: '' }),
    component: NoteNode,
});
