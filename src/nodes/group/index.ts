import { defineNode } from '@/core/define';
import GroupNode from './GroupNode.vue';

// Рамка для группировки: ноды внутри неё едут вместе с ней. Название правится двойным кликом по полосе.
export default defineNode({
    id: 'group',
    title: 'Group',
    icon: 'icon-minus-squared-alt',
    size: { w: 480, h: 320, minW: 160, minH: 120 },
    create: () => ({ title: '' }),
    titleKey: 'title',
    container: true,
    component: GroupNode,
});
