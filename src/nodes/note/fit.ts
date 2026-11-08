import { reactive } from 'vue';

/**
 * Размер шрифта стикера. Число в панели логическое: сам стикер работает как зум, то есть при растягивании текст растёт
 * вместе с ним, а число не меняется. «Авто» подбирает самый крупный размер, при котором текст влезает; вручную нельзя
 * выбрать размер больше, чем влезает.
 * The sticker font size. The number in the bar is logical: the sticker itself works as a zoom, so when it is stretched the
 * text grows with it and the number does not change. "Auto" picks the largest size at which the text fits; by hand one
 * cannot pick a size larger than fits.
 */
export const FONT_MIN = 10;
/** Самый крупный размер, который подбирает «Авто». / The largest size "Auto" picks. */
export const FONT_MAX = 48;
/** Границы ручного ввода в панели. / Limits of the manual input in the bar. */
export const FONT_INPUT_MIN = 4;
export const FONT_INPUT_MAX = 200;
/** Размеры в меню поля. / Sizes in the field's menu. */
export const FONT_PRESETS: readonly number[] = [4, 8, 10, 12, 14, 18, 24, 32, 48, 64];

/** Размер стикера, при котором масштаб равен 1 (размер новой ноды). / The sticker size at which the scale is 1. */
export const STICKER_BASE = { w: 240, h: 160 } as const;

/** Масштаб содержимого: по меньшему из отношений сторон к базовому размеру. / Content scale: by the smaller side ratio. */
export function stickerScale(w: number, h: number): number {
    const s = Math.min(w / STICKER_BASE.w, h / STICKER_BASE.h);
    return Number.isFinite(s) && s > 0 ? s : 1;
}

/**
 * Что показывает панель для стикера (по id ноды): размер, с которым текст рисуется (логический), и самый крупный, который
 * ещё влезает.
 * What the bar shows for a sticker (by node id): the size the text is drawn with (logical) and the largest that still fits.
 */
export const fittedSizes = reactive<Record<string, { size: number; max: number }>>({});

/**
 * Самый крупный размер из диапазона, при котором текст влезает по высоте. Высота при данном размере приходит от
 * вызывающего (`heightAt`), поэтому функция не зависит от DOM и проверяется тестом.
 * The largest size in the range whose text still fits the height. The height at a given size comes from the caller
 * (`heightAt`), so the function does not depend on the DOM and is unit-tested.
 */
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
