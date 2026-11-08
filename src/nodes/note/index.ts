import { defineNode } from '@/core/define';
import NoteNode from './NoteNode.vue';

export default defineNode({
    id: 'note',
    title: 'Note',
    icon: 'node-note',
    hotkey: 'N',
    order: 10, // панель слева: Заметка, Текст, Чеклист, (фигуры 40, маркер 50), Группа, (стикеры 70), Картинка, Ссылка
    size: { w: 240, h: 160, minW: 120, minH: 80 },
    create: () => ({ text: '' }),
    component: NoteNode,
});
