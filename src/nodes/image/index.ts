import { defineNode } from '@/core/define';
import ImageNode from './ImageNode.vue';

// Картинка хранится ссылкой: файлов и хранилища пока нет.
export default defineNode({
    id: 'image',
    title: 'Image',
    icon: 'icon-color-adjust',
    size: { w: 260, h: 200, minW: 120, minH: 90 },
    create: () => ({ url: '' }),
    component: ImageNode,
});
