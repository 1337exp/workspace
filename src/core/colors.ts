/**
 * Цвета нод: в данных хранится имя, а сам цвет лежит в CSS (`--tint-<имя>` в styles/colors.css).
 * Так цвета согласованы с темой и их можно поменять, не трогая сохранения.
 */
export const NODE_COLORS = ['red', 'yellow', 'green', 'cyan', 'blue', 'purple'] as const;

export type NodeColor = (typeof NODE_COLORS)[number];

export const isNodeColor = (value: unknown): value is NodeColor => typeof value === 'string' && (NODE_COLORS as readonly string[]).includes(value);
