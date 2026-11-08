import { describe, expect, it } from 'vitest';
import { FONT_MAX, FONT_MIN, fitFontSize } from '@/nodes/note/fit';

describe('стикер: размер шрифта', () => {
    // Модель: текст занимает высоту, пропорциональную квадрату размера.
    const heightAt = (px: number) => px * px * 0.1;

    it('влезает целиком: берётся максимум; не влезает: самый крупный подходящий', () => {
        expect(fitFontSize(heightAt, 1000)).toBe(FONT_MAX);
        const px = fitFontSize(heightAt, 100);
        expect(heightAt(px)).toBeLessThanOrEqual(100);
        expect(heightAt(px + 1)).toBeGreaterThan(100);
    });

    it('при росте стикера шрифт растёт, при нехватке места упирается в минимум', () => {
        expect(fitFontSize(heightAt, 200)).toBeGreaterThan(fitFontSize(heightAt, 100));
        expect(fitFontSize(heightAt, 1)).toBe(FONT_MIN);
        expect(fitFontSize(heightAt, 0)).toBe(FONT_MAX);
    });

});
