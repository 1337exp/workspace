<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { Anchor, Side } from '@/core/types';
import type { Rect, ResizeEdge } from '@/core/workspace';
import { panBy, screenToWorld, zoomAt } from '@1337exp/taoux/camera';
import { edgeScrollVelocity } from '@1337exp/taoux/edgescroll';
import { GRID } from '@1337exp/taoux/snap';
import { LONG_PRESS_MS, PinchTracker, TapRecognizer, pinchOf, type Sample } from '@1337exp/taoux/gestures';
import { wheelIntent } from '@1337exp/taoux/wheel';
import { useEditor } from '../store';
import ConnectionsLayer from './ConnectionsLayer.vue';
import NodeView from './NodeView.vue';

const editor = useEditor();
const root = ref<HTMLElement | null>(null);

const PAN_CLICK_THRESHOLD = 4; // ПКМ, сдвинутая меньше, — это клик (открывает палитру)

/** Всё, что нужно знать о положении указателя: годится и настоящее событие, и последнее известное положение. */
type Pointer = Pick<MouseEvent, 'clientX' | 'clientY'>;

type Mode = 'idle' | 'pan' | 'drag' | 'marquee' | 'connect' | 'resize' | 'pinch';
let mode: Mode = 'idle';
let lastX = 0;
let lastY = 0;
let baseSelection: string[] = [];
let panDistance = 0;
/** Alt зажат: привязка к сетке временно отключена. Запоминаем, чтобы автопрокрутка (без события) тоже знала. */
let altDown = false;
const snapNow = () => editor.snapEnabled && !altDown;
let resizeId = '';
let resizeEdge: ResizeEdge = 'se';
let resizeStart: Rect = { x: 0, y: 0, w: 0, h: 0 };
/** Сдвиг мыши с начала изменения размера, мировые единицы. */
let resizeDx = 0;
let resizeDy = 0;

// Сенсор: пальцы на холсте, распознавание тапов и долгого нажатия, состояние щипка.
const touches = new Map<number, { x: number; y: number }>();
const taps = new TapRecognizer();
let longPressTimer: ReturnType<typeof setTimeout> | undefined;
let lastTouchAt = 0;
const pinch = new PinchTracker();
/**
 * Нода, на которую лёг палец: её выделение и подъём откладываются, пока не ясно намерение. Касание ещё может
 * оказаться началом жеста двумя пальцами, и тогда выделение, которое было у пользователя, не должно слететь.
 * Выделяем, когда палец пошёл тянуть (вышел за допуск) или поднят (тап, удержание).
 */
let armed: string | null = null;
/** Связь, на которую лёг палец: как с нодой, выбираем её только если это тап (палец не пошёл двигать холст). */
let armedConn: string | null = null;

/** `?debug=touch`: в углу видно последний распознанный жест и число пальцев. */
const debug = typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === 'touch';
const debugText = ref('');
const note = (label: string) => {
    if (debug) debugText.value = `${label} · пальцев: ${touches.size}`;
};

/** Рамка выделения в клиентских координатах. */
const marquee = ref<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

//--------------------------------------------------

// Контейнеры (группы) лежат под связями и остальными нодами; крупные ниже мелких, чтобы вложенные были сверху.
const isContainer = (type: string) => !!editor.registry.find(type)?.container;
const containers = computed(() =>
    Object.values(editor.workspace.nodes)
        .filter((n) => isContainer(n.type))
        .sort((a, b) => b.w * b.h - a.w * a.h),
);
const plainNodes = computed(() => Object.values(editor.workspace.nodes).filter((n) => !isContainer(n.type)));

const world = computed(() => {
    const { x, y, z } = editor.camera;
    return { transform: `translate(${x}px, ${y}px) scale(${z})` };
});

const gridStyle = computed(() => {
    const { x, y, z } = editor.camera;
    const small = GRID * z;
    const big = small * 5;
    return {
        backgroundSize: `${small}px ${small}px, ${small}px ${small}px, ${big}px ${big}px, ${big}px ${big}px`,
        backgroundPosition: `${x}px ${y}px`,
    };
});

const marqueeStyle = computed(() => {
    const m = marquee.value;
    const rect = root.value?.getBoundingClientRect();
    if (!m || !rect) return {};
    return {
        left: `${Math.min(m.x0, m.x1) - rect.left}px`,
        top: `${Math.min(m.y0, m.y1) - rect.top}px`,
        width: `${Math.abs(m.x1 - m.x0)}px`,
        height: `${Math.abs(m.y1 - m.y0)}px`,
    };
});

//--------------------------------------------------

const nodeIdAt = (target: EventTarget | null) =>
    (target as HTMLElement | null)?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId ?? null;

const connIdAt = (target: EventTarget | null) =>
    (target as Element | null)?.closest<HTMLElement>('[data-conn-id]')?.dataset.connId ?? null;

/** Поля ввода внутри нод: клик по ним выделяет ноду, но не тащит её и не отбирает фокус. */
const isEditable = (target: EventTarget | null) =>
    !!(target as Element | null)?.closest('input, textarea, select, button, [contenteditable="true"]');

function pinAt(target: EventTarget | null): Anchor | null {
    const pin = (target as Element | null)?.closest<HTMLElement>('[data-pin]');
    const node = pin?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId;
    // У ноды-точки пин «auto» (кольцо вокруг неё): конкретную сторону выберет стор по направлению связи.
    return pin && node ? { node, side: pin.dataset.pin === 'auto' ? 'right' : (pin.dataset.pin as Side) } : null;
}

/** Пин под курсором, а если курсор над телом ноды — пин той стороны, к которой курсор ближе (деление по диагоналям). */
function anchorAt(e: Pointer): Anchor | null {
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const pin = pinAt(under);
    if (pin) return pin;

    const el = under?.closest<HTMLElement>('[data-node-id]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    // Смещение от центра в долях размера ноды: так диагонали идут по углам, а не под 45°.
    const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
    const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
    const side: Side = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'top' : 'bottom';
    return { node: el.dataset.nodeId!, side };
}

function cursorWorld(e: Pointer): [number, number] {
    const rect = root.value!.getBoundingClientRect();
    return screenToWorld(editor.camera, e.clientX - rect.left, e.clientY - rect.top);
}

function openPaletteAt(e: Pointer, origin: Anchor | null) {
    const rect = root.value!.getBoundingClientRect();
    editor.openPalette([e.clientX - rect.left, e.clientY - rect.top], cursorWorld(e), origin);
}

function nodesInMarquee(): string[] {
    const m = marquee.value;
    if (!m || !root.value) return [];

    const left = Math.min(m.x0, m.x1);
    const right = Math.max(m.x0, m.x1);
    const top = Math.min(m.y0, m.y1);
    const bottom = Math.max(m.y0, m.y1);

    const ids: string[] = [];
    for (const el of root.value.querySelectorAll<HTMLElement>('[data-node-id]')) {
        // Контейнер выделяется только за полосу: иначе любая рамка выбирала бы всю группу целиком.
        const r = (el.classList.contains('container') ? el.querySelector('.bar') ?? el : el).getBoundingClientRect();
        if (r.left < right && r.right > left && r.top < bottom && r.bottom > top) ids.push(el.dataset.nodeId!);
    }
    return ids;
}

//--------------------------------------------------

const sampleOf = (e: PointerEvent): Sample => ({ x: e.clientX, y: e.clientY, t: performance.now() });

function capture(e: PointerEvent) {
    try {
        root.value?.setPointerCapture(e.pointerId);
    } catch {
        // указатель уже ушёл: захватывать нечего
    }
}

function releaseCapture(e: { pointerId: number }) {
    try {
        root.value?.releasePointerCapture(e.pointerId);
    } catch {
        // захвата уже нет
    }
}

function clearLongPress() {
    clearTimeout(longPressTimer);
    longPressTimer = undefined;
}

//--------------------------------------------------
// Сенсор

/** Второй палец лёг на холст: начатый жест отменяется, начинается щипок. Возвращает true, если событие обработано. */
function touchDown(e: PointerEvent): boolean {
    // Первичный палец это начало нового касания: других пальцев на экране сейчас нет. Всё, что мы помним, зависло
    // (pointerup ушёл мимо холста, например на палитру, открытую долгим нажатием), и его надо забыть, иначе
    // следующий тап посчитается вторым пальцем и включит щипок насовсем.
    if (e.isPrimary) {
        touches.clear();
        armed = null;
        armedConn = null;
        if (mode !== 'idle') abortGesture();
    }

    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size < 2) return false;

    editor.closePalette();
    abortGesture();
    mode = 'pinch';
    rebasePinch();
    capture(e);
    e.preventDefault();
    note('щипок');
    return true;
}

/** Палец лёг на холст (первый): запоминаем для тапа и ставим таймер долгого нажатия. Возвращает true для второго тапа подряд. */
function beginTouch(e: PointerEvent): boolean {
    clearLongPress();
    const doubleDown = taps.down(sampleOf(e));
    longPressTimer = setTimeout(onLongPress, LONG_PRESS_MS);
    return doubleDown;
}

/** Палец лежит на пустом месте и не двигается: это правый клик сенсора, открываем палитру. */
function onLongPress() {
    longPressTimer = undefined;
    if (mode !== 'pan' || !taps.longPressDue(performance.now() + 50)) return;

    // Захват не отпускаем: палитра открывается под пальцем, и без захвата pointerup ушёл бы на неё, а не на холст.
    taps.cancel();
    mode = 'idle';
    navigator.vibrate?.(15);
    openPaletteAt({ clientX: lastX, clientY: lastY }, null);
    note('долгое нажатие');
}

/**
 * Палец поднят или отменён где угодно в окне, а не только над холстом: например, над палитрой, которая открылась
 * под ним. Холст должен перестать считать этот палец лежащим, иначе он останется «вторым» навсегда.
 */
function purgeTouch(e: PointerEvent) {
    if (e.pointerType !== 'touch' || !touches.delete(e.pointerId)) return;
    if (mode !== 'pinch') return;
    if (touches.size === 0) mode = 'idle';
    else rebasePinch();
}

/** Намерение стало ясно (палец пошёл тянуть или поднят): выделяем и поднимаем ноду, на которую он лёг. */
function commitArmed() {
    const id = armed;
    armed = null;
    if (!id || !editor.workspace.nodes[id]) return;

    editor.selectConnection(null);
    // Изменение размера выделяет только свою ноду; перетаскивание сохраняет выделение, если нода уже в нём.
    if (mode === 'resize' || !editor.selection.has(id)) editor.setSelection([id]);
    editor.raise(id);
    if (mode === 'drag') editor.beginDrag(id);
}

/** Палец поднят. Возвращает true, если событие обработано целиком (идёт щипок). */
function touchUp(e: PointerEvent): boolean {
    touches.delete(e.pointerId);

    if (mode === 'pinch') {
        if (touches.size === 0) {
            mode = 'idle';
            note('щипок закончен');
        } else {
            rebasePinch();
        }
        releaseCapture(e);
        return true;
    }

    clearLongPress();
    lastTouchAt = Date.now();
    const result = taps.up(sampleOf(e));
    commitArmed(); // тап или удержание без сдвига
    const onLine = armedConn !== null; // палец лёг на связь (тап по ней не «пустое место»)
    if (armedConn) {
        const id = armedConn;
        armedConn = null;
        if (!taps.isMoved) {
            editor.setSelection([]);
            editor.selectConnection(id);
        }
    }
    if (result === 'double') {
        activateAt(e);
        note('двойной тап');
    } else if (result === 'tap') {
        // Тап по пустому месту снимает выделение (мы не трогали его при касании: палец мог пойти двигать холст).
        if (mode === 'pan' && !onLine) {
            editor.setSelection([]);
            editor.selectConnection(null);
        }
        note('тап');
    }
    return false;
}

/** Набор пальцев изменился (лёг второй, подняли один): отсчёт жеста начинается заново, скачка нет. */
function rebasePinch() {
    const [a, b] = [...touches.values()];
    if (a) pinch.begin(pinchOf(a, b));
}

/**
 * Браузер присылает движение пальцев отдельными событиями: сдвинулся один палец, потом второй. Между ними расстояние
 * между пальцами «дёргается», хотя жест один. Поэтому положение двух пальцев разбираем один раз за кадр, когда
 * оба уже пришли.
 */
let pinchFrame = 0;
function schedulePinch() {
    if (pinchFrame) return;
    pinchFrame = requestAnimationFrame(() => {
        pinchFrame = 0;
        if (mode === 'pinch') pinchMove();
    });
}

/** Щипок и жест двумя пальцами; с одним оставшимся пальцем просто двигаем холст. */
function pinchMove() {
    const [a, b] = [...touches.values()];
    const el = root.value;
    if (!a || !el) return;

    const step = pinch.update(pinchOf(a, b));
    const rect = el.getBoundingClientRect();
    editor.camera = panBy(zoomAt(editor.camera, step.pivot[0] - rect.left, step.pivot[1] - rect.top, step.factor), step.pan[0], step.pan[1]);
}

//--------------------------------------------------

function onPointerDown(e: PointerEvent) {
    const el = root.value;
    if (!el) return;
    altDown = e.altKey;

    const touch = e.pointerType === 'touch';
    if (touch && touchDown(e)) return; // второй палец: щипок

    editor.closePalette();
    lastX = e.clientX;
    lastY = e.clientY;
    panDistance = 0;
    const doubleDown = touch && beginTouch(e);

    if (e.button === 1 || e.button === 2) {
        el.focus();
        mode = 'pan';
    } else if (e.button === 0) {
        const id = nodeIdAt(e.target);

        // Поле ввода внутри ноды: выделяем ноду и отдаём событие полю (фокус, каретка, выделение текста).
        if (id && isEditable(e.target)) {
            if (touch) {
                armed = id; // выделим при отпускании: палец может оказаться началом жеста двумя пальцами
            } else {
                editor.raise(id);
                editor.selectConnection(null);
                if (!editor.selection.has(id)) editor.setSelection([id]);
            }
            return;
        }

        el.focus();

        const connId = connIdAt(e.target);
        if (connId) {
            if (touch) {
                // Линия тонкая, и палец на ней чаще начинает двигать холст, чем выбирать связь: ведём себя как на пустом месте.
                armedConn = connId;
                mode = editor.selectMode ? 'idle' : 'pan';
                e.preventDefault();
                capture(e);
                return;
            }
            editor.setSelection([]);
            editor.selectConnection(connId);
            e.preventDefault();
            return;
        }
        // На сенсоре выбор связи снимаем позже (тап по пустому месту или начало рамки), а не при касании.
        if (!touch) editor.selectConnection(null);

        const pin = pinAt(e.target);
        // На сенсоре Ctrl нет: его роль играет режим «Выделение» в тулбаре.
        const additive = e.ctrlKey || e.shiftKey || (touch && editor.selectMode);
        if (id && (!touch || additive)) editor.raise(id);

        if (pin) {
            editor.startConnect(pin, cursorWorld(e));
            mode = 'connect';
        } else if (id && (e.target as Element).closest('[data-resize]')) {
            const node = editor.workspace.nodes[id]!;
            if (touch) armed = id;
            else editor.setSelection([id]);
            resizeId = id;
            resizeEdge = (e.target as Element).closest<HTMLElement>('[data-resize]')!.dataset.resize as ResizeEdge;
            resizeStart = { x: node.x, y: node.y, w: node.w, h: node.h };
            resizeDx = 0;
            resizeDy = 0;
            mode = 'resize';
        } else if (id) {
            if (additive) {
                editor.toggleSelected(id);
                if (!editor.selection.has(id)) return;
                editor.beginDrag(id);
            } else if (touch) {
                armed = id; // выделение и beginDrag: в commitArmed, когда палец пошёл тянуть
            } else {
                if (!editor.selection.has(id)) editor.setSelection([id]);
                editor.beginDrag(id);
            }
            mode = 'drag';
        } else if (touch && !editor.selectMode && !doubleDown) {
            // Один палец по пустому месту двигает холст; выделение (если тап) снимется при отпускании.
            mode = 'pan';
            note('холст');
        } else {
            if (touch) editor.selectConnection(null);
            baseSelection = additive ? [...editor.selection] : [];
            editor.setSelection(baseSelection);
            marquee.value = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY };
            mode = 'marquee';
            if (touch) note('рамка');
        }
    } else {
        return;
    }

    e.preventDefault();
    capture(e);
}

/**
 * Жест оборвался, а `pointerup` не пришёл (alt-tab, окно перекрыли, система забрала указатель):
 * закрываем начатое, чтобы ничего не «зависло»: протянутая связь, рамка выделения, захваченная нода.
 * Сделанное к этому моменту (сдвиг, размер) остаётся и записывается в историю.
 */
function abortGesture() {
    clearLongPress();
    taps.cancel();
    armed = null;
    armedConn = null;
    if (mode === 'connect') {
        editor.cancelConnect();
    } else if (mode === 'drag' || mode === 'resize') {
        editor.endDrag();
        editor.commit();
    }
    mode = 'idle';
    marquee.value = null;
    stopAutoScroll();
}

/** Оборвать всё, включая пальцы на холсте (потеря фокуса окна, системная отмена). */
function cancelGesture() {
    touches.clear();
    abortGesture();
}

function onPointerCancel(e: PointerEvent) {
    touches.delete(e.pointerId);
    if (mode === 'pinch' && touches.size > 0) {
        rebasePinch();
        return;
    }
    cancelGesture();
}

/** Захват указателя пропал: если жест ещё идёт и это не щипок (там палец снимают сами), рвём его. */
function onLostCapture() {
    if (mode === 'pinch' || mode === 'idle') return;
    cancelGesture();
}

//--------------------------------------------------
// Автопрокрутка: пока тянешь ноду, рамку, связь или край и курсор у края холста, камера едет в ту сторону.
// Цикл крутится, даже когда мышь стоит; скорость считается по времени, а не по кадрам.

const SCROLL_MODES: readonly Mode[] = ['drag', 'resize', 'marquee', 'connect'];
const MAX_FRAME_S = 0.05; // после паузы (вкладка спала) камера не «прыгает»
let scrollFrame = 0;
let scrollLast = 0;

function scrollVelocity(): [number, number] {
    const el = root.value;
    if (!el || !SCROLL_MODES.includes(mode)) return [0, 0];
    const r = el.getBoundingClientRect();
    return edgeScrollVelocity(lastX - r.left, lastY - r.top, r.width, r.height);
}

function kickAutoScroll() {
    if (scrollFrame) return;
    const [vx, vy] = scrollVelocity();
    if (vx === 0 && vy === 0) return;
    scrollLast = performance.now();
    scrollFrame = requestAnimationFrame(autoScrollFrame);
}

function stopAutoScroll() {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
}

function autoScrollFrame(now: number) {
    scrollFrame = 0;
    const [vx, vy] = scrollVelocity();
    if (vx === 0 && vy === 0) return;

    const dt = Math.min((now - scrollLast) / 1000, MAX_FRAME_S);
    scrollLast = now;

    // Камера уехала на (sx, sy) экранных px, и то, что было под курсором, оказалось в стороне:
    // догоняем курсор тем, что у жеста привязано к миру.
    const sx = vx * dt;
    const sy = vy * dt;
    const z = editor.camera.z;
    editor.camera = panBy(editor.camera, -sx, -sy);

    const pointer: Pointer = { clientX: lastX, clientY: lastY };
    if (mode === 'drag') {
        editor.moveSelected(sx / z, sy / z, snapNow());
    } else if (mode === 'resize') {
        resizeDx += sx / z;
        resizeDy += sy / z;
        editor.resizeFrom(resizeId, resizeEdge, resizeStart, resizeDx, resizeDy, snapNow());
    } else if (mode === 'connect') {
        editor.updateConnect(cursorWorld(pointer), anchorAt(pointer));
    } else if (mode === 'marquee' && marquee.value) {
        // Начало рамки стоит на месте в мире, значит на экране уехало вместе с камерой.
        const m = marquee.value;
        marquee.value = { x0: m.x0 - sx, y0: m.y0 - sy, x1: lastX, y1: lastY };
        editor.setSelection([...baseSelection, ...nodesInMarquee()]);
    }

    scrollFrame = requestAnimationFrame(autoScrollFrame);
}

function onPointerMove(e: PointerEvent) {
    altDown = e.altKey;
    const touch = e.pointerType === 'touch';
    if (touch) {
        if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (mode === 'pinch') {
            schedulePinch();
            return;
        }
        if (taps.move(sampleOf(e))) clearLongPress();
        // Пока палец не вышел за допуск тапа, холст и ноды стоят: дрожание не должно двигать ни то, ни другое.
        if (!taps.isMoved && (mode === 'pan' || mode === 'drag' || mode === 'resize')) return;
        if (armed && (mode === 'drag' || mode === 'resize')) commitArmed();
    } else if (mode !== 'idle' && e.buttons === 0) {
        // Кнопку отпустили где-то вне окна: событие мы не увидели, но по движению видно, что жест окончен.
        cancelGesture();
        return;
    }

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    if (mode === 'pan') {
        panDistance += Math.hypot(dx, dy);
        editor.camera = panBy(editor.camera, dx, dy);
    } else if (mode === 'drag') {
        editor.moveSelected(dx / editor.camera.z, dy / editor.camera.z, snapNow());
    } else if (mode === 'resize') {
        resizeDx += dx / editor.camera.z;
        resizeDy += dy / editor.camera.z;
        editor.resizeFrom(resizeId, resizeEdge, resizeStart, resizeDx, resizeDy, snapNow());
    } else if (mode === 'connect') {
        editor.updateConnect(cursorWorld(e), anchorAt(e));
    } else if (mode === 'marquee' && marquee.value) {
        marquee.value = { ...marquee.value, x1: e.clientX, y1: e.clientY };
        editor.setSelection([...baseSelection, ...nodesInMarquee()]);
    }

    kickAutoScroll();
}

function onPointerUp(e: PointerEvent) {
    if (e.pointerType === 'touch' && touchUp(e)) return;
    if (mode === 'idle') return;
    if (mode === 'connect') {
        const under = document.elementFromPoint(e.clientX, e.clientY);
        const origin = editor.pending?.origin ?? null;
        const connected = editor.finishConnect(anchorAt(e));

        // Отпустили связь над пустым холстом — предлагаем создать ноду и подключить её.
        if (!connected && origin && under && root.value?.contains(under) && !under.closest('[data-node-id]')) {
            openPaletteAt(e, origin);
        }
    } else if (mode === 'drag' || mode === 'resize') {
        editor.endDrag();
        editor.commit(); // перетаскивание или изменение размера целиком — один шаг истории (без сдвига ничего не запишется)
    } else if (mode === 'pan' && e.button === 2 && panDistance < PAN_CLICK_THRESHOLD) {
        openPaletteAt(e, null);
    }
    mode = 'idle';
    marquee.value = null;
    stopAutoScroll();
    releaseCapture(e);
}

// Размер холста нужен стору, чтобы ставить новые ноды в центр экрана.
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
    const el = root.value!;
    const update = () => (editor.viewport = { w: el.clientWidth, h: el.clientHeight });
    update();
    resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', cancelGesture);
    window.addEventListener('pointerup', purgeTouch);
    window.addEventListener('pointercancel', purgeTouch);
});
onUnmounted(() => {
    resizeObserver?.disconnect();
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('blur', cancelGesture);
    window.removeEventListener('pointerup', purgeTouch);
    window.removeEventListener('pointercancel', purgeTouch);
    stopAutoScroll();
    clearLongPress();
    cancelAnimationFrame(pinchFrame);
});

/**
 * Горячие клавиши на всём окне, чтобы работали и после клика по панели инструментов.
 * Смотрим на физическую клавишу (`code`), чтобы Ctrl+Z работало и в русской раскладке.
 */
function onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement | null)?.isContentEditable) return;

    if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyZ' && !e.shiftKey) editor.undo();
        else if (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey)) editor.redo();
        else return;
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
        editor.removeSelected();
    } else if (e.key === 'Escape') {
        editor.closePalette();
    } else {
        return;
    }
    e.preventDefault();
}

// После закрытия палитры возвращаем фокус на холст.
watch(
    () => editor.palette,
    (now, before) => {
        if (!now && before) root.value?.focus();
    },
);

/**
 * Двойное действие (двойной клик или двойной тап): по связи ставит ноду-точку, по полосе ноды с названием
 * включает правку названия.
 */
function activateAt(p: Pointer) {
    const under = document.elementFromPoint(p.clientX, p.clientY);
    const connId = connIdAt(under);
    if (connId) {
        editor.splitConnection(connId, cursorWorld(p));
        return;
    }

    const bar = (under as Element | null)?.closest('.bar');
    const id = bar ? nodeIdAt(bar) : null;
    if (id && editor.registry.find(editor.workspace.nodes[id]?.type ?? '')?.titleKey) editor.titleEditing = id;
}

/** Событие приходит на холст (он держит захват указателя). На сенсоре двойной тап распознаём сами, иначе действие сработало бы дважды. */
function onDblClick(e: MouseEvent) {
    if (Date.now() - lastTouchAt < 800) return;
    activateAt(e);
}

/**
 * Колесо двигает холст, а масштаб только с Ctrl/Cmd (щипок тачпада приходит как Ctrl + колесо): так колесо над
 * заметкой, которую можно прокрутить, не масштабирует холст, стоит курсору случайно выйти за её край.
 */
function onWheel(e: WheelEvent) {
    const el = root.value!;
    const zooming = e.ctrlKey || e.metaKey;

    // Колесо над прокручиваемым полем (длинная заметка) листает его, а не двигает холст.
    const field = (e.target as Element | null)?.closest('textarea');
    if (!zooming && field && field.scrollHeight > field.clientHeight) return;

    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const intent = wheelIntent(e, rect.height);
    if (intent.kind === 'zoom') {
        editor.camera = zoomAt(editor.camera, e.clientX - rect.left, e.clientY - rect.top, intent.factor);
    } else {
        editor.camera = panBy(editor.camera, intent.dx, intent.dy);
    }
}
</script>

<template>
    <div
        ref="root"
        class="canvas"
        :class="{ connecting: editor.pending }"
        tabindex="0"
        :style="gridStyle"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
        @lostpointercapture="onLostCapture"
        @wheel="onWheel"
        @contextmenu.prevent
        @dblclick="onDblClick"
    >
        <div class="world" :style="world">
            <NodeView
                v-for="node in containers"
                :key="node.id"
                :node="node"
                :selected="editor.selection.has(node.id)"
            />
            <ConnectionsLayer />
            <NodeView
                v-for="node in plainNodes"
                :key="node.id"
                :node="node"
                :selected="editor.selection.has(node.id)"
            />
        </div>

        <div v-if="marquee" class="marquee" :style="marqueeStyle" />
        <div v-if="debug" class="gesture-debug">{{ debugText }}</div>
    </div>
</template>

<style scoped>
.canvas {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    outline: none;
    background-color: var(--tao-color-bg, #1b1d21);
    background-image:
        linear-gradient(to right, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
        linear-gradient(to right, rgba(255, 255, 255, 0.07) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.07) 1px, transparent 1px);
    touch-action: none;
    /* Сенсор: без выделения текста, лупы и подсветки тапа; в полях ввода текст выделяется как обычно. */
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
}

.canvas :deep(textarea),
.canvas :deep(input) {
    -webkit-user-select: text;
    user-select: text;
}

.gesture-debug {
    position: absolute;
    left: 8px;
    bottom: 8px;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    font: 12px/1.3 monospace;
    pointer-events: none;
}

.world {
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    transform-origin: 0 0;
}

.marquee {
    position: absolute;
    border: 1px solid var(--tao-color-accent, #f59e0b);
    background: var(--tao-color-accent-subtle, rgba(245, 158, 11, 0.1));
    pointer-events: none;
}
</style>
