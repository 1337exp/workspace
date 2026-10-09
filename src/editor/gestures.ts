/**
 * Распознавание сенсорных жестов. Чистая логика без DOM и таймеров: время и координаты приходят снаружи,
 * поэтому всё проверяется тестами. События и таймеры (долгое нажатие) живут в EditorCanvas.
 */

/** На сколько px палец может сместиться и всё ещё считаться «стоящим на месте». */
export const TAP_SLOP_PX = 8;
/** Дольше этого касание уже не тап. */
export const TAP_MAX_MS = 300;
/** Сколько надо держать палец неподвижно для долгого нажатия. */
export const LONG_PRESS_MS = 500;
/** Второй тап должен прийти не позже и не дальше этого от первого. */
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_RADIUS_PX = 30;

export interface Sample {
    x: number;
    y: number;
    /** Время, мс (любая монотонная шкала). */
    t: number;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export type TapResult = 'tap' | 'double' | null;

/** Разбирает касание одним пальцем: тап, двойной тап, сдвиг, готовность долгого нажатия. */
export class TapRecognizer {
    private start: Sample | null = null;
    private moved = false;
    private lastTap: Sample | null = null;
    private doubleDown = false;

    /**
     * Палец лёг. Возвращает true, если это второе касание двойного тапа (оно ещё не закончено:
     * дальше может быть протяжка, как «двойной тап и тянуть»).
     */
    down(s: Sample): boolean {
        this.start = s;
        this.moved = false;
        const prev = this.lastTap;
        this.doubleDown = prev !== null && s.t - prev.t <= DOUBLE_TAP_MS && dist(s, prev) <= DOUBLE_TAP_RADIUS_PX;
        return this.doubleDown;
    }

    /** Палец сдвинулся. Возвращает true, если он уже ушёл дальше допуска (не тап и не долгое нажатие). */
    move(s: Sample): boolean {
        if (this.start && !this.moved && dist(s, this.start) > TAP_SLOP_PX) this.moved = true;
        return this.moved;
    }

    get isMoved(): boolean {
        return this.moved;
    }

    /** Пора ли считать касание долгим нажатием: палец лежит на месте дольше `LONG_PRESS_MS`. */
    longPressDue(now: number): boolean {
        return this.start !== null && !this.moved && now - this.start.t >= LONG_PRESS_MS;
    }

    /** Палец поднят: что это было. После `double` следующий тап снова считается одиночным. */
    up(s: Sample): TapResult {
        const start = this.start;
        this.start = null;
        if (!start) return null;

        this.move(s);
        if (this.moved || s.t - start.t > TAP_MAX_MS) {
            this.lastTap = null;
            return null;
        }
        if (this.doubleDown) {
            this.lastTap = null;
            return 'double';
        }
        this.lastTap = s;
        return 'tap';
    }

    /** Жест оказался чем-то другим (долгое нажатие, щипок, прерывание): забываем и текущее касание, и предыдущий тап. */
    cancel(): void {
        this.start = null;
        this.lastTap = null;
        this.doubleDown = false;
    }
}

//--------------------------------------------------
// Щипок и жест двумя пальцами

type Point = { x: number; y: number };

export interface Pinch {
    /** Центр между пальцами. */
    cx: number;
    cy: number;
    /** Расстояние между пальцами; 0, если палец один (тогда только сдвиг). */
    dist: number;
}

export function pinchOf(a: Point, b?: Point): Pinch {
    if (!b) return { cx: a.x, cy: a.y, dist: 0 };
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dist: dist(a, b) };
}

export interface PinchStep {
    /** Во сколько раз изменить масштаб. */
    factor: number;
    /** Вокруг какой точки (центр до шага). */
    pivot: [number, number];
    /** На сколько сдвинуть камеру после масштаба. */
    pan: [number, number];
}

/**
 * Шаг жеста: масштаб вокруг прежнего центра, потом сдвиг центра. Так точка мира под пальцами остаётся под ними.
 * Без второго пальца (расстояние 0 с любой стороны) масштаб не меняется, остаётся только сдвиг.
 */
export function pinchStep(prev: Pinch, next: Pinch): PinchStep {
    const factor = prev.dist > 0 && next.dist > 0 ? next.dist / prev.dist : 1;
    return { factor, pivot: [prev.cx, prev.cy], pan: [next.cx - prev.cx, next.cy - prev.cy] };
}
