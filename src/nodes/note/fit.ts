/**
 * Подбор размера шрифта стикера: самый крупный размер из диапазона, при котором текст влезает по высоте.
 * Высота при данном размере приходит от вызывающего (`heightAt`), поэтому функция не зависит от DOM и проверяется тестом.
 * Picks the sticker font size: the largest size in the range whose text still fits the height. The height at a given
 * size comes from the caller (`heightAt`), so the function does not depend on the DOM and is unit-tested.
 */
export const FONT_MIN = 10;
export const FONT_MAX = 48;
/** Размеры для ручного выбора в панели (кроме «Авто»). / Sizes for manual choice in the bar (besides "Auto"). */
export const FONT_STEPS: readonly number[] = [12, 14, 16, 20, 24, 32, 40, 48, 64];

export function fitFontSize(heightAt: (px: number) => number, available: number, min = FONT_MIN, max = FONT_MAX): number {
    if (available <= 0 || heightAt(max) <= available) return max;
    let lo = min;
    let hi = max;
    // Инвариант: на lo влезает (или это минимум), на hi нет.
    while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (heightAt(mid) <= available) lo = mid;
        else hi = mid;
    }
    return lo;
}

/** Следующий размер в ряду `FONT_STEPS`; из «Авто» (0) вверх идёт к 24, вниз к 14. / The next size in the row. */
export function stepFontSize(current: number, dir: 1 | -1): number {
    if (!current) return dir > 0 ? 24 : 14;
    const next = dir > 0 ? FONT_STEPS.find((s) => s > current) : [...FONT_STEPS].reverse().find((s) => s < current);
    return next ?? current;
}
