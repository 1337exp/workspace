import { describe, expect, it } from 'vitest';
import { floatingPosition } from '@/editor/floating';

const view = { w: 1000, h: 700 };
const bar = { w: 300, h: 48 };

describe('floatingPosition', () => {
    it('по центру над выделением', () => {
        const p = floatingPosition({ x0: 400, y0: 300, x1: 600, y1: 400 }, bar, view);
        expect(p).toEqual({ left: 350, top: 300 - 48 - 12 });
    });

    it('сверху нет места — под выделением', () => {
        const p = floatingPosition({ x0: 400, y0: 80, x1: 600, y1: 200 }, bar, view);
        expect(p.top).toBe(200 + 12);
    });

    it('выделение во весь экран — у верхнего края, под меню', () => {
        const p = floatingPosition({ x0: 0, y0: 0, x1: 1000, y1: 700 }, bar, view);
        expect(p.top).toBe(64);
    });

    it('не выходит за экран по бокам и не заезжает на панель слева', () => {
        expect(floatingPosition({ x0: -500, y0: 300, x1: -400, y1: 400 }, bar, view).left).toBe(76);
        expect(floatingPosition({ x0: 1500, y0: 300, x1: 1600, y1: 400 }, bar, view).left).toBe(1000 - 300 - 12);
    });

    it('панель шире экрана прижимается влево, а не уезжает в минус', () => {
        const p = floatingPosition({ x0: 100, y0: 300, x1: 200, y1: 400 }, { w: 900, h: 48 }, { w: 500, h: 700 });
        expect(p.left).toBeGreaterThanOrEqual(12);
    });

    it('выделение ниже экрана: панель остаётся на экране', () => {
        const p = floatingPosition({ x0: 400, y0: 900, x1: 600, y1: 1000 }, bar, view);
        expect(p.top).toBeLessThanOrEqual(700 - 48 - 12);
        expect(p.top).toBeGreaterThanOrEqual(12);
    });
});
