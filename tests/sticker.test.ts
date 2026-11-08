import { describe, expect, it } from 'vitest';
import { NODE_COLORS, QUICK_COLORS, isNodeColor } from '@/core/colors';
import { FONT_MAX, FONT_MIN, STICKER_BASE, fitFontSize, stickerScale } from '@/nodes/note/fit';

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


    it('стикер как зум: масштаб по меньшей стороне, у нового стикера 1', () => {
        expect(stickerScale(STICKER_BASE.w, STICKER_BASE.h)).toBe(1);
        expect(stickerScale(STICKER_BASE.w * 2, STICKER_BASE.h * 2)).toBe(2);
        expect(stickerScale(STICKER_BASE.w * 3, STICKER_BASE.h)).toBe(1); // вытянули в ширину: текст не растёт
        expect(stickerScale(STICKER_BASE.w / 2, STICKER_BASE.h)).toBe(0.5);
        expect(stickerScale(0, 0)).toBe(1);
    });

    it('палитра 15 цветов без повторов (с «по умолчанию» 16 ячеек 4×4); прежние имена сохранились, короткий список из них', () => {
        expect(NODE_COLORS).toHaveLength(15);
        expect(new Set(NODE_COLORS).size).toBe(15);
        for (const old of ['red', 'yellow', 'green', 'cyan', 'blue', 'purple']) expect(isNodeColor(old)).toBe(true);
        expect(QUICK_COLORS.every((c) => isNodeColor(c))).toBe(true);
    });
});
