import { defineNode } from '@/core/define';
import NoteNode from './NoteNode.vue';

// Стикер: цветная заливка без полосы, текст по центру; шрифт сам подгоняется под размер (`size` 0 = «Авто»).
// Тип в данных остаётся `note`, чтобы старые документы читались.
export default defineNode({
    id: 'note',
    title: 'Sticker',
    icon: 'node-note',
    hotkey: 'N',
    order: 10, // панель слева: Стикер, Текст, Чеклист, (фигуры 40, маркер 50), Группа, (эмодзи 70), Картинка, Ссылка
    size: { w: 240, h: 160, minW: 120, minH: 80 },
    create: () => ({ text: '', size: 0, bold: false, align: 'center' }),
    bare: true,
    sticker: true,
    textStyle: true,
    inlineEdit: true,
    component: NoteNode,
});
