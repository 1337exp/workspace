import { defineNode } from '@/core/define';
import LinkNode from './LinkNode.vue';

// Ссылка на страницу: карточка с адресом и кнопкой «Открыть». Заголовок в полосе правится двойным кликом.
export default defineNode({
    id: 'link',
    title: 'Link',
    icon: 'node-link',
    hotkey: 'K',
    order: 90,
    size: { w: 280, h: 120, minW: 200, minH: 100 },
    create: () => ({ title: '', url: '' }),
    titleKey: 'title',
    component: LinkNode,
});
