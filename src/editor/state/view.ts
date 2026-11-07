import { ref } from 'vue';
import { createCamera, fitCamera, screenToWorld, zoomAt, type Camera } from '@1337exp/taoux/camera';
import type { Rect } from '@/core/workspace';

/** Во сколько раз меняет масштаб одно нажатие «+» или «−». / The factor of one press of "+" or "−". */
export const ZOOM_STEP = 1.25;

/**
 * Вид холста: камера и размер видимой области (px). Размер нужен, чтобы ставить новые ноды в центр экрана и
 * приближать вокруг центра; обновляет его холст.
 * The canvas view: the camera and the size of the visible area (px). The size is needed to put new nodes at the
 * screen centre and to zoom around it; the canvas keeps it up to date.
 */
export function useView() {
    const camera = ref<Camera>(createCamera());
    const viewport = ref({ w: 800, h: 600 });

    /** Центр видимой области в мировых координатах. / The centre of the visible area in world coordinates. */
    const centerWorld = (): [number, number] => screenToWorld(camera.value, viewport.value.w / 2, viewport.value.h / 2);

    /** Масштаб в `factor` раз вокруг центра экрана. / Zoom by `factor` around the screen centre. */
    function zoomBy(factor: number) {
        camera.value = zoomAt(camera.value, viewport.value.w / 2, viewport.value.h / 2, factor);
    }

    /** Масштаб ровно 100% вокруг центра экрана. / Exactly 100% around the screen centre. */
    function zoomReset() {
        zoomBy(1 / camera.value.z);
    }

    /** Показать прямоугольник целиком (не увеличивая выше 100%); без него камера по умолчанию. */
    function fitTo(rect: Rect | null) {
        camera.value = fitCamera(rect, viewport.value, 64, { min: 0.2, max: 1 });
    }

    return { camera, viewport, centerWorld, zoomBy, zoomReset, fitTo };
}

export type ViewSlice = ReturnType<typeof useView>;
