#!/usr/bin/env node
/**
 * Screenshots of the app for the README (both languages share the same files).
 * Скриншоты приложения для README (оба языка используют одни и те же файлы).
 *
 *   npm run screenshot                                         starts its own dev server on a spare port
 *   SCREENSHOT_URL=http://localhost:5173 npm run screenshot    use a server that is already running
 *
 * Needs Chrome or Edge installed (driven through playwright-core, nothing is downloaded). Output: docs/media/*.png.
 * The scene is drawn by code and put into the autosave, so every run gives the same pictures.
 * Нужен установленный Chrome или Edge. Сцена рисуется кодом и кладётся в автосохранение, поэтому каждый запуск даёт те же картинки.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const PORT = 5196;
const VIEWPORT = { width: 1280, height: 760 };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'media');
mkdirSync(OUT, { recursive: true });

//--------------------------------------------------
// The scene: a small trip plan (English: the interface is shot in English too).
// Сцена: маленький план поездки.

const svg = (label) =>
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
            `<stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs>` +
            `<rect width="300" height="200" fill="url(#g)"/><text x="150" y="108" font-size="30" text-anchor="middle" fill="#fff" font-family="sans-serif">${label}</text></svg>`,
    );

const node = (id, type, x, y, w, h, data, color) => ({ id, type, x, y, w, h, dataVersion: 1, data, ...(color ? { color } : {}) });
const item = (id, text, done = false) => ({ id, text, done });

const SCENE = {
    format: 'workspace',
    version: 1,
    view: { x: 96, y: 24, z: 1 },
    nodes: [
        node('day', 'group', 40, 100, 640, 380, { title: 'Day one' }, 'blue'),
        node('head', 'text', 40, 28, 460, 48, { text: 'Lisbon, long weekend', large: true }),
        node(
            'todo',
            'checklist',
            64,
            140,
            260,
            250,
            {
                title: 'Before leaving',
                items: [item('i1', 'Book the tickets', true), item('i2', 'Pack the bag', true), item('i3', 'Charge the camera'), item('i4', 'Buy a SIM card')],
                hideDone: false,
            },
        ),
        node('idea', 'note', 400, 140, 250, 150, { text: 'Start with the old town, then the harbour at sunset.' }, 'yellow'),
        node('fc', 'link', 400, 320, 250, 120, { title: 'Forecast', url: 'https://www.example.com/forecast' }),
        node('pic', 'image', 740, 140, 300, 200, { url: svg('Harbour') }),
    ],
    connections: [
        { id: 'c1', from: { node: 'todo', side: 'right' }, to: { node: 'idea', side: 'left' }, arrow: 'none' },
        { id: 'c2', from: { node: 'idea', side: 'right' }, to: { node: 'pic', side: 'left' }, arrow: 'end' },
    ],
};

//--------------------------------------------------

async function waitFor(url, ms = 30000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        try {
            if ((await fetch(url)).ok) return;
        } catch {
            // not up yet
        }
        await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error(`The dev server did not come up at ${url}`);
}

async function startServer() {
    if (process.env.SCREENSHOT_URL) return { url: process.env.SCREENSHOT_URL, stop() {} };
    const vite = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
    const child = spawn(process.execPath, [vite, '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
    const url = `http://localhost:${PORT}`;
    await waitFor(url);
    return { url, stop: () => child.kill() };
}

async function launch() {
    for (const channel of ['chrome', 'msedge']) {
        try {
            return await chromium.launch({ channel });
        } catch {
            // try the next one
        }
    }
    throw new Error('Neither Chrome nor Edge could be launched');
}

const server = await startServer();
const browser = await launch();
try {
    const shot = async (page, name) => {
        await page.screenshot({ path: join(OUT, `${name}.png`) });
        console.log(`docs/media/${name}.png`);
    };

    /** A fresh page: the scene in the autosave, English, the chosen theme. */
    const open = async (scheme) => {
        const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: scheme, locale: 'en-US' });
        const page = await context.newPage();
        await page.addInitScript((scene) => {
            localStorage.clear();
            localStorage.setItem('workspace.state', JSON.stringify(scene));
        }, SCENE);
        await page.goto(server.url);
        await page.locator('[data-node-id="todo"]').waitFor();
        await page.waitForTimeout(600);
        return page;
    };

    /** Press a node by its strip (the part you drag it by), with Ctrl to add to the selection. */
    const pick = (page, id, ctrl = false) => page.locator(`[data-node-id="${id}"] [data-node-handle]`).first().click({ modifiers: ctrl ? ['Control'] : [] });

    // 1. Dark: a note picked, the colour bar floats over it.
    {
        const page = await open('dark');
        await pick(page, 'idea');
        await page.mouse.move(1000, 600);
        await page.waitForTimeout(400);
        await shot(page, 'workspace');
        await page.context().close();
    }

    // 2. Light: two nodes picked, the alignment tools join the bar.
    {
        const page = await open('light');
        await pick(page, 'idea');
        await pick(page, 'fc', true);
        await page.mouse.move(1000, 600);
        await page.waitForTimeout(400);
        await shot(page, 'light');
        await page.context().close();
    }
} finally {
    await browser.close();
    server.stop();
}
