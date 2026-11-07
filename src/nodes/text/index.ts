import { defineNode } from '@/core/define';
import TextNode from './TextNode.vue';

// Просто текст на холсте, без рамки и полосы. Двойной клик правит его на месте; высота следует за содержимым.
// Пустой текст после правки удаляется: невидимая нода никому не нужна.
export default defineNode({
    id: 'text',
    title: 'Text',
    icon: 'node-text',
    hotkey: 'T',
    size: { w: 220, h: 36, minW: 60, minH: 32 },
    create: () => ({ text: '', large: false }),
    bare: true,
    inlineEdit: true,
    actions: [{ id: 'large', icon: 'text-large', get: (data) => data.large === true, set: (_data, on) => ({ large: on }) }],
    isEmpty: (data) => typeof data.text !== 'string' || data.text.trim() === '',
    component: TextNode,
});
