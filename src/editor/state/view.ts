import { ref } from 'vue';
import { createCamera, screenToWorld, type Camera } from '@1337exp/taoux/camera';

/**
 * Вид холста: камера и размер видимой области (px). Размер нужен, чтобы ставить новые ноды в центр экрана;
 * обновляет его холст.
 * The canvas view: the camera and the size of the visible area (px). The size is needed to put new nodes at the
 * screen centre; the canvas keeps it up to date.
 */
export function useView() {
    const camera = ref<Camera>(createCamera());
    const viewport = ref({ w: 800, h: 600 });

    /** Центр видимой области в мировых координатах. / The centre of the visible area in world coordinates. */
    const centerWorld = (): [number, number] => screenToWorld(camera.value, viewport.value.w / 2, viewport.value.h / 2);

    return { camera, viewport, centerWorld };
}

export type ViewSlice = ReturnType<typeof useView>;
