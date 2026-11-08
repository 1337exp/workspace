import { describe, expect, it } from 'vitest';
import { FONT_MAX, FONT_MIN, fitFontSize, stepFontSize } from '@/nodes/note/fit';

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

    it('шаги размера: из «Авто» вверх 24, вниз 14; дальше по ряду, на краях стоит', () => {
        expect(stepFontSize(0, 1)).toBe(24);
        expect(stepFontSize(0, -1)).toBe(14);
        expect(stepFontSize(24, 1)).toBe(32);
        expect(stepFontSize(24, -1)).toBe(20);
        expect(stepFontSize(12, -1)).toBe(12);
        expect(stepFontSize(64, 1)).toBe(64);
        expect(stepFontSize(18, 1)).toBe(20);
    });
});
