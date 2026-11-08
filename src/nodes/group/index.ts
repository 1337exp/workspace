import { defineNode } from '@/core/define';
import GroupNode from './GroupNode.vue';

// Рамка для группировки: ноды внутри неё едут вместе с ней. Название правится двойным кликом по полосе.
export default defineNode({
    id: 'group',
    title: 'Group',
    icon: 'node-group',
    hotkey: 'G',
    order: 60,
    size: { w: 480, h: 320, minW: 160, minH: 120 },
    create: () => ({ title: '' }),
    titleKey: 'title',
    container: true,
    // Размеры в единицах холста (при 100% это пиксели экрана).
    presets: [
        { id: 'custom', w: 480, h: 320 },
        { id: 'a4', w: 595, h: 842 },
        { id: 'letter', w: 612, h: 792 },
        { id: 'r16x9', w: 960, h: 540 },
        { id: 'r4x3', w: 800, h: 600 },
        { id: 'r1x1', w: 600, h: 600 },
        { id: 'phone', w: 390, h: 844 },
        { id: 'tablet', w: 768, h: 1024 },
        { id: 'browser', w: 1280, h: 800 },
    ],
    component: GroupNode,
});
