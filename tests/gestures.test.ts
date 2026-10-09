import { describe, expect, it } from 'vitest';
import {
    DOUBLE_TAP_MS,
    DOUBLE_TAP_RADIUS_PX,
    LONG_PRESS_MS,
    TAP_MAX_MS,
    TAP_SLOP_PX,
    TapRecognizer,
    pinchOf,
    pinchStep,
} from '@/editor/gestures';

const at = (x: number, y: number, t: number) => ({ x, y, t });

describe('TapRecognizer', () => {
    it('короткое касание на месте это тап', () => {
        const r = new TapRecognizer();
        expect(r.down(at(100, 100, 0))).toBe(false);
        expect(r.up(at(101, 100, 120))).toBe('tap');
    });

    it('дрожание в пределах допуска не мешает тапу, выход за допуск мешает', () => {
        const ok = new TapRecognizer();
        ok.down(at(0, 0, 0));
        expect(ok.move(at(TAP_SLOP_PX - 1, 0, 50))).toBe(false);
        expect(ok.up(at(TAP_SLOP_PX - 1, 0, 100))).toBe('tap');

        const far = new TapRecognizer();
        far.down(at(0, 0, 0));
        expect(far.move(at(TAP_SLOP_PX + 1, 0, 50))).toBe(true);
        expect(far.isMoved).toBe(true);
        expect(far.up(at(0, 0, 100))).toBeNull(); // вернулся на место, но уже тащил
    });

    it('долгое касание это не тап', () => {
        const r = new TapRecognizer();
        r.down(at(0, 0, 0));
        expect(r.up(at(0, 0, TAP_MAX_MS + 1))).toBeNull();
    });

    it('два тапа подряд рядом это двойной тап; третий снова одиночный', () => {
        const r = new TapRecognizer();
        r.down(at(50, 50, 0));
        expect(r.up(at(50, 50, 80))).toBe('tap');

        expect(r.down(at(60, 55, 200))).toBe(true); // второе касание уже известно как «двойное»
        expect(r.up(at(60, 55, 260))).toBe('double');

        expect(r.down(at(60, 55, 400))).toBe(false);
        expect(r.up(at(60, 55, 450))).toBe('tap');
    });

    it('второй тап слишком поздно или слишком далеко не двойной', () => {
        const late = new TapRecognizer();
        late.down(at(0, 0, 0));
        late.up(at(0, 0, 50));
        expect(late.down(at(0, 0, 50 + DOUBLE_TAP_MS + 1))).toBe(false);

        const far = new TapRecognizer();
        far.down(at(0, 0, 0));
        far.up(at(0, 0, 50));
        expect(far.down(at(DOUBLE_TAP_RADIUS_PX + 1, 0, 100))).toBe(false);
    });

    it('двойной тап с протяжкой не становится ни тапом, ни двойным тапом', () => {
        const r = new TapRecognizer();
        r.down(at(0, 0, 0));
        r.up(at(0, 0, 50));
        expect(r.down(at(2, 2, 150))).toBe(true); // можно начинать рамку
        r.move(at(80, 2, 200));
        expect(r.up(at(80, 2, 400))).toBeNull();
        expect(r.down(at(80, 2, 450))).toBe(false); // после протяжки двойной тап не продолжается
    });

    it('долгое нажатие: палец лежит на месте дольше порога', () => {
        const r = new TapRecognizer();
        r.down(at(0, 0, 1000));
        expect(r.longPressDue(1000 + LONG_PRESS_MS - 1)).toBe(false);
        expect(r.longPressDue(1000 + LONG_PRESS_MS)).toBe(true);

        r.move(at(TAP_SLOP_PX + 5, 0, 1200)); // сдвинулся: уже не долгое нажатие
        expect(r.longPressDue(5000)).toBe(false);
    });

    it('cancel забывает и касание, и прошлый тап', () => {
        const r = new TapRecognizer();
        r.down(at(0, 0, 0));
        r.up(at(0, 0, 50));
        r.cancel();
        expect(r.down(at(0, 0, 100))).toBe(false);
        r.cancel();
        expect(r.up(at(0, 0, 120))).toBeNull();
        expect(r.longPressDue(99999)).toBe(false);
    });
});

describe('pinch', () => {
    it('считает центр и расстояние; один палец даёт расстояние 0', () => {
        expect(pinchOf({ x: 0, y: 0 }, { x: 6, y: 8 })).toEqual({ cx: 3, cy: 4, dist: 10 });
        expect(pinchOf({ x: 5, y: 7 })).toEqual({ cx: 5, cy: 7, dist: 0 });
    });

    it('разведение пальцев увеличивает, сведение уменьшает, центр сдвигает камеру', () => {
        const a = pinchOf({ x: 0, y: 0 }, { x: 100, y: 0 });
        const out = pinchStep(a, pinchOf({ x: -50, y: 0 }, { x: 150, y: 0 }));
        expect(out.factor).toBe(2);
        expect(out.pivot).toEqual([50, 0]);
        expect(out.pan).toEqual([0, 0]);

        expect(pinchStep(a, pinchOf({ x: 25, y: 0 }, { x: 75, y: 0 })).factor).toBe(0.5);
        expect(pinchStep(a, pinchOf({ x: 10, y: 20 }, { x: 110, y: 20 })).pan).toEqual([10, 20]);
    });

    it('если пальцев не два (подняли один), масштаб не меняется, а сдвиг остаётся', () => {
        const two = pinchOf({ x: 0, y: 0 }, { x: 100, y: 0 });
        const one = pinchOf({ x: 30, y: 10 });
        expect(pinchStep(two, one).factor).toBe(1);
        expect(pinchStep(one, pinchOf({ x: 35, y: 12 })).pan).toEqual([5, 2]);
        expect(pinchStep(one, pinchOf({ x: 0, y: 0 }, { x: 10, y: 0 })).factor).toBe(1);
    });
});
