import { defineNode } from '@/core/define';
import EmojiNode from './EmojiNode.vue';
import { DEFAULT_EMOJI } from './emojis';

/** Последний выбранный эмодзи: им ставится стикер по клавише и из палитры. */
let lastEmoji = DEFAULT_EMOJI;
export const rememberEmoji = (emoji: string) => (lastEmoji = emoji);

// Стикер: эмодзи на холсте, без рамки и текста. Рисуется поверх остальных нод и связей (overlay), цвета не имеет.
export default defineNode({
    id: 'emoji',
    title: 'Emoji',
    icon: 'node-emoji',
    hotkey: 'E',
    order: 70,
    size: { w: 72, h: 72, minW: 24, minH: 24 },
    create: () => ({ emoji: lastEmoji }),
    bare: true,
    overlay: true,
    colorable: false,
    component: EmojiNode,
});
