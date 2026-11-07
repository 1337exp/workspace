export interface ScreenRect {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

export interface FloatOptions {
    /** Зазор между выделением и панелью. */
    gap?: number;
    /** Отступ от краёв экрана. */
    margin?: number;
    /** Сколько сверху занято (меню в углу): выше панель не поднимается. */
    top?: number;
    /** Сколько слева занято (панель инструментов): левее панель не уезжает. */
    left?: number;
}

/**
 * Где повесить плавающую панель размера `size` у выделения `anchor` (всё в px экрана): по центру над ним, а если сверху
 * нет места, то под ним; если нет и там (выделение во весь экран), у верхнего края. Не выходит за экран и не заезжает
 * на занятые углы.
 * Where to hang a floating bar of `size` at the selection `anchor` (all in screen px): centred above it, below it
 * when there is no room above, and at the top edge when there is none there either (a selection filling the screen).
 * It never leaves the screen and stays off the occupied corners.
 */
export function floatingPosition(anchor: ScreenRect, size: { w: number; h: number }, view: { w: number; h: number }, options: FloatOptions = {}) {
    const { gap = 12, margin = 12, top: reserveTop = 64, left: reserveLeft = 76 } = options;

    const minLeft = Math.min(reserveLeft, Math.max(margin, view.w - size.w - margin));
    const maxLeft = Math.max(minLeft, view.w - size.w - margin);
    const left = Math.min(maxLeft, Math.max(minLeft, (anchor.x0 + anchor.x1) / 2 - size.w / 2));

    let top = anchor.y0 - size.h - gap;
    if (top < reserveTop) {
        top = anchor.y1 + gap;
        if (top + size.h > view.h - margin) top = reserveTop;
    }
    top = Math.min(Math.max(margin, view.h - size.h - margin), Math.max(margin, top));

    return { left, top };
}
