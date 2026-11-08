import type { Registry } from '@/core/registry';
import { addNode, connect, createWorkspace } from '@/core/workspace';

const svg = (fill: string, label: string) =>
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="${fill}"/>` +
            `<text x="160" y="108" font-size="28" text-anchor="middle" fill="#fff" font-family="sans-serif">${label}</text></svg>`,
    );

/** Пример для первого запуска. */
export function createDemo(registry: Registry) {
    const ws = createWorkspace();

    addNode(ws, registry, 'note', {
        id: 'hello',
        x: 40,
        y: 40,
        data: { text: 'Привет! Это стикер.\n\nТяни за любое место, чтобы двигать. Правый клик по пустому месту — добавить ноду.' },
    });
    addNode(ws, registry, 'image', { id: 'pic', x: 400, y: 20, data: { url: svg('#4f8cff', 'Картинка по ссылке') } });
    addNode(ws, registry, 'note', {
        id: 'idea',
        x: 400,
        y: 280,
        data: { text: 'Потяни за пин у края ноды к другой ноде: появится связь. Выбери её, чтобы сменить линию на стрелку.' },
    });

    connect(ws, { node: 'hello', side: 'right' }, { node: 'pic', side: 'left' }, 'end');
    connect(ws, { node: 'hello', side: 'right' }, { node: 'idea', side: 'left' }, 'none');
    return ws;
}
