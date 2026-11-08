/**
 * Цвета нод: в данных хранится имя, а сам цвет лежит в CSS (`--tint-<имя>` и `--fill-<имя>` в styles/colors.css).
 * Так цвета согласованы с темой и их можно поменять, не трогая сохранения. `--fill` светлый, им заливается стикер;
 * `--tint` насыщенный, им красятся рамка, полоса и текст остальных нод.
 * Node colours: the data holds a name, the colour itself lives in CSS (`--tint-<name>` and `--fill-<name>` in
 * styles/colors.css), so colours follow the theme and can change without touching saved data. `--fill` is light, it fills
 * a sticker; `--tint` is saturated, it colours the frame, strip and text of other nodes.
 */
export const NODE_COLORS = ['gray', 'yellow', 'orange', 'lime', 'leaf', 'green', 'mint', 'rose', 'pink', 'purple', 'red', 'ice', 'cyan', 'blue', 'black'] as const;

export type NodeColor = (typeof NODE_COLORS)[number];

/** Короткий список для контекстного меню (там 15 пунктов были бы длинным столбцом). / The short list for the context menu. */
export const QUICK_COLORS = ['red', 'yellow', 'green', 'cyan', 'blue', 'purple'] as const satisfies readonly NodeColor[];

export const isNodeColor = (value: unknown): value is NodeColor => typeof value === 'string' && (NODE_COLORS as readonly string[]).includes(value);
