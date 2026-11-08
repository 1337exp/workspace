import { reactive } from 'vue';

/**
 * Подбор размера шрифта стикера: самый крупный размер из диапазона, при котором текст влезает по высоте.
 * Высота при данном размере приходит от вызывающего (`heightAt`), поэтому функция не зависит от DOM и проверяется тестом.
 * Picks the sticker font size: the largest size in the range whose text still fits the height. The height at a given
 * size comes from the caller (`heightAt`), so the function does not depend on the DOM and is unit-tested.
 */
export const FONT_MIN = 10;
export const FONT_MAX = 48;
/** Границы ручного ввода в панели. / Limits of the manual input in the bar. */
export const FONT_INPUT_MIN = 4;
export const FONT_INPUT_MAX = 200;
/** Размеры в списке поля (кроме «Авто»). / Sizes in the field's list (besides "Auto"). */
/**
 * Размер шрифта, с которым стикер рисуется сейчас (по id ноды): панель показывает его и при «Авто».
 * The font size a sticker is drawn with now (by node id): the bar shows it also in "Auto".
 */
export const fittedSizes = reactive<Record<string, number>>({});
/** Размеры в меню поля. */
export const FONT_PRESETS: readonly number[] = [4, 8, 10, 12, 14, 18, 24, 32, 48, 64];

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
