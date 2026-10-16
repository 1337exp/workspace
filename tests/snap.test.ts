import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { softSnap } from '@1337exp/taoux/snap';
import { resizeRect } from '@/core/workspace';
import { useEditor } from '@/editor/store';

describe('resizeRect с привязкой', () => {
    const start = { x: 100, y: 100, w: 400, h: 300 };
    const min = { w: 160, h: 120 };
    const snap = (v: number) => softSnap(v, 24, 8);

    it('привязывается только двигаемая грань, противоположная стоит', () => {
        const e = resizeRect(start, 'e', 21, 0, min, snap); // правая грань 521 → 528 (7 ≤ 8)
        expect(e).toMatchObject({ x: 100, w: 428 });

        const w = resizeRect(start, 'w', -3, 0, min, snap); // левая грань 97 → 96
        expect(w.x).toBe(96);
        expect(w.x + w.w).toBe(500);
    });

    it('привязка не нарушает минимальный размер', () => {
        const r = resizeRect(start, 'e', -230, 0, min, snap); // правая грань 270 → 264, ширина 164 ≥ 160
        expect(r.w).toBe(164);

        const tight = resizeRect(start, 'e', -250, 0, min, snap); // 250 → 240 дало бы ширину 140 < 160
        expect(tight.w).toBe(min.w);
    });
});

describe('привязка при перетаскивании', () => {
    beforeEach(() => setActivePinia(createPinia()));

    function scene() {
        const editor = useEditor();
        editor.loadWorkspace({ nodes: {}, connections: [] }, undefined, true);
        editor.camera = { x: 0, y: 0, z: 1 };
        const a = editor.addNodeAtCenter('note');
        const b = editor.addNodeAtCenter('note');
        a.x = 100;
        a.y = 100;
        b.x = 400;
        b.y = 130;
        return { editor, a, b };
    }

    it('захваченная нода липнет к линии, остальные выделенные едут на тот же сдвиг и сохраняют расположение', () => {
        const { editor, a, b } = scene();
        editor.setSelection([a.id, b.id]);
        editor.beginDrag(a.id);
        editor.moveSelected(21, 3, true); // a.x: 121 → 120 (рядом линия); a.y: 103 слишком далеко от 96 и 120

        expect(a.x).toBe(120);
        expect(a.y).toBe(103);
        expect(b.x - a.x).toBe(300); // расположение друг относительно друга не изменилось
        expect(b.y - a.y).toBe(30);
        editor.endDrag();
    });

    it('между линиями нода двигается свободно', () => {
        const { editor, a } = scene();
        editor.setSelection([a.id]);
        editor.beginDrag(a.id);
        editor.moveSelected(12, 12, true); // 112: до 120 восемь, порог шесть
        expect([a.x, a.y]).toEqual([112, 112]);
    });

    it('сырой сдвиг накапливается: нода не «залипает» при медленном движении', () => {
        const { editor, a } = scene();
        editor.setSelection([a.id]);
        editor.beginDrag(a.id);
        for (let i = 0; i < 20; i++) editor.moveSelected(1, 0, true); // по пикселю от 100 к 120
        expect(a.x).toBe(120);

        editor.moveSelected(-1, 0, true); // отъехали на 1 от линии: ещё в зоне притяжения
        expect(a.x).toBe(120);
        for (let i = 0; i < 15; i++) editor.moveSelected(-1, 0, true); // вышли из зоны: идёт свободно
        expect(a.x).toBe(104);
    });

    it('без привязки двигается ровно на сдвиг мыши', () => {
        const { editor, a } = scene();
        editor.setSelection([a.id]);
        editor.beginDrag(a.id);
        editor.moveSelected(21, 3, false);
        expect([a.x, a.y]).toEqual([121, 103]);
    });

    it('группа и её содержимое едут вместе, привязывается группа', () => {
        const { editor, a } = scene();
        const g = editor.addNodeAtCenter('group');
        g.x = 50;
        g.y = 50;
        g.w = 320;
        g.h = 260; // заметка a (100..340 × 100..260) целиком внутри
        editor.setSelection([g.id]);
        editor.beginDrag(g.id);
        editor.moveSelected(23, 22, true); // группа 73, 72 → 72, 72; заметка едет на тот же сдвиг (+22, +22)

        expect([g.x, g.y]).toEqual([72, 72]);
        expect([a.x, a.y]).toEqual([122, 122]);
    });

    it('переключатель сетки хранится в сторе и по умолчанию включён', () => {
        const { editor } = scene();
        expect(editor.snapEnabled).toBe(true);
        editor.snapEnabled = false;
        expect(editor.snapEnabled).toBe(false);
        editor.snapEnabled = true;
    });
});
