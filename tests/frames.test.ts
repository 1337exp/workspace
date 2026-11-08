import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createDefaultRegistry } from '@/nodes';
import { parse, serialize } from '@/core/serialize';
import { copyText, insertNodes } from '@/core/clipboard';
import { addNode, carriedBy, containerAt, createWorkspace, duplicateNodes, removeNode } from '@/core/workspace';
import { useEditor } from '@/editor/store';

const registry = createDefaultRegistry();

describe('состав группы задаётся явно', () => {
    beforeEach(() => {
        localStorage.clear();
        setActivePinia(createPinia());
    });

    function setup() {
        const editor = useEditor();
        editor.loadWorkspace({ nodes: {}, connections: [] }, undefined, true);
        editor.snapEnabled = false;
        editor.guidesEnabled = false;
        const g = addNode(editor.workspace, editor.registry, 'group', { id: 'g', x: 0, y: 0, w: 400, h: 300 });
        const s = addNode(editor.workspace, editor.registry, 'note', { id: 's', x: 800, y: 100, w: 100, h: 100 });
        return { editor, g, s };
    }

    /** Взяли ноду, повели на (dx, dy) и отпустили. */
    function drag(editor: ReturnType<typeof useEditor>, id: string, dx: number, dy: number) {
        editor.setSelection([id]);
        editor.beginDrag(id);
        editor.moveSelected(dx, dy);
        return () => editor.endDrag();
    }

    it('группа, проехавшая над стикером и остановившаяся на нём, его не захватывает', () => {
        const { editor, g, s } = setup();
        s.x = 100; // стикер лежит у группы под ногами, но не помещён
        s.y = 100;
        editor.setSelection([g.id]);
        editor.beginDrag(g.id);
        editor.moveSelected(40, 40);
        expect(editor.dropTarget).toBeNull();
        editor.endDrag();
        expect(s.parent).toBeUndefined();

        editor.setSelection([g.id]);
        editor.beginDrag(g.id);
        editor.moveSelected(30, 0);
        editor.endDrag();
        expect([s.x, s.y]).toEqual([100, 100]); // стикер стоит
    });

    it('выбранную ноду ведут в группу: пока тянут, группа подсвечена (dropTarget), при отпускании нода в ней', () => {
        const { editor, g, s } = setup();
        const end = drag(editor, s.id, -600, 0); // центр 850→250, 150: внутри группы
        expect(editor.dropTarget).toBe(g.id);
        expect(s.parent).toBeUndefined(); // пока не отпустили, состав не меняется
        end();
        expect(s.parent).toBe(g.id);
        expect(editor.dropTarget).toBeNull();
        expect([...carriedBy(editor.workspace, editor.registry, [g.id])]).toEqual([s.id]);
    });

    it('внутри своей группы подсветки нет, вытащенная наружу нода выходит из группы', () => {
        const { editor, g, s } = setup();
        s.x = 100;
        s.y = 100;
        s.parent = g.id;
        drag(editor, s.id, 20, 10);
        expect(editor.dropTarget).toBeNull(); // уже в ней
        editor.endDrag();
        expect(s.parent).toBe(g.id);

        const end = drag(editor, s.id, 900, 0);
        expect(editor.dropTarget).toBeNull(); // нигде
        end();
        expect(s.parent).toBeUndefined();
    });

    it('нода одной группы: из двух пересекающих её групп берётся самая вложенная (меньшая), ни одна не тянет её дважды', () => {
        const { editor, g, s } = setup();
        const small = addNode(editor.workspace, editor.registry, 'group', { id: 'small', x: 600, y: 50, w: 400, h: 300 });
        const big = addNode(editor.workspace, editor.registry, 'group', { id: 'big', x: 500, y: 0, w: 800, h: 600 });
        expect(containerAt(editor.workspace, editor.registry, [s.id], [850, 150])).toBe(small.id);
        drag(editor, s.id, 0, 0);
        editor.endDrag(); // без движения: состав не трогаем
        expect(s.parent).toBeUndefined();

        drag(editor, s.id, 5, 5);
        editor.endDrag();
        expect(s.parent).toBe(small.id);
        expect([...carriedBy(editor.workspace, editor.registry, [big.id])]).toEqual([]);
        expect(g.parent).toBeUndefined();
    });

    it('группу можно положить в другую, но не в себя и не в своё содержимое', () => {
        const { editor, g } = setup();
        const outer = addNode(editor.workspace, editor.registry, 'group', { id: 'outer', x: -500, y: -500, w: 2000, h: 2000 });
        drag(editor, g.id, 1, 1);
        expect(editor.dropTarget).toBe(outer.id);
        editor.endDrag();
        expect(g.parent).toBe(outer.id);

        // outer несёт g, поэтому g для outer не цель
        expect(containerAt(editor.workspace, editor.registry, [outer.id], [100, 100])).toBeNull();
    });

    it('новая нода, поставленная внутри группы, становится её содержимым', () => {
        const { editor, g } = setup();
        editor.setTool('note');
        const n = editor.placeAt([200, 150])!;
        expect(n.parent).toBe(g.id);
        editor.setTool('note');
        expect(editor.placeAt([2000, 2000])!.parent).toBeUndefined();
    });

    it('удаление группы оставляет содержимое на холсте или отдаёт внешней группе', () => {
        const ws = createWorkspace();
        addNode(ws, registry, 'group', { id: 'outer', x: 0, y: 0, w: 900, h: 700 });
        addNode(ws, registry, 'group', { id: 'inner', x: 10, y: 10, w: 400, h: 300, parent: 'outer' });
        addNode(ws, registry, 'note', { id: 'n', x: 20, y: 20, parent: 'inner' });
        removeNode(ws, 'inner');
        expect(ws.nodes.n!.parent).toBe('outer');
        removeNode(ws, 'outer');
        expect(ws.nodes.n!.parent).toBeUndefined();
    });

    it('копия лежит в копии группы, если копировали вместе; одиночная копия остаётся в той же группе', () => {
        const ws = createWorkspace();
        addNode(ws, registry, 'group', { id: 'g', x: 0, y: 0, w: 400, h: 300 });
        addNode(ws, registry, 'note', { id: 'n', x: 20, y: 20, parent: 'g' });

        const [gc] = duplicateNodes(ws, registry, ['g']);
        const nc = Object.values(ws.nodes).find((x) => x.id !== 'n' && x.type === 'note')!;
        expect(nc.parent).toBe(gc!.id);

        const [alone] = duplicateNodes(ws, registry, ['n']);
        expect(alone!.parent).toBe('g');

        // через буфер: вставляется вместе с группой, иначе сама по себе
        const text = copyText(ws, registry, ['g'])!;
        const parsed = parse(text, registry);
        const target = createWorkspace();
        if (parsed.ok) insertNodes(target, parsed.workspace, 10, 10);
        const g2 = Object.values(target.nodes).find((x) => x.type === 'group')!;
        const n2 = Object.values(target.nodes).find((x) => x.type === 'note')!;
        expect(n2.parent).toBe(g2.id);

        const single = parse(copyText(ws, registry, ['n'])!, registry);
        const lone = createWorkspace();
        if (single.ok) insertNodes(lone, single.workspace, 10, 10);
        expect(Object.values(lone.nodes)[0]!.parent).toBeUndefined();
    });

    it('файл хранит состав; битые ссылки и циклы отбрасываются', () => {
        const ws = createWorkspace();
        addNode(ws, registry, 'group', { id: 'g', x: 0, y: 0, w: 400, h: 300 });
        addNode(ws, registry, 'note', { id: 'n', x: 500, y: 20, parent: 'g' }); // вне рамки, но помещена явно
        const back = parse(serialize(ws), registry);
        expect(back.ok && back.workspace.nodes.n!.parent).toBe('g');

        const raw = JSON.parse(serialize(ws));
        raw.nodes[0].parent = 'n'; // g в n: n не контейнер
        raw.nodes[1].parent = 'нет'; // такой группы нет
        const bad = parse(JSON.stringify(raw), registry);
        expect(bad.ok && [bad.workspace.nodes.g!.parent, bad.workspace.nodes.n!.parent]).toEqual([undefined, undefined]);

        const loop = JSON.parse(serialize(ws));
        loop.nodes.push({ ...loop.nodes[0], id: 'g2', parent: 'g' });
        loop.nodes[0].parent = 'g2';
        const cyc = parse(JSON.stringify(loop), registry);
        expect(cyc.ok).toBe(true);
        if (cyc.ok) {
            // от любой ноды вверх по составу доходим до корня: цикла нет
            for (const start of Object.values(cyc.workspace.nodes)) {
                let steps = 0;
                for (let n: typeof start | undefined = start; n?.parent !== undefined; n = cyc.workspace.nodes[n.parent]) expect(++steps).toBeLessThan(10);
            }
        }
    });

    it('файл старого формата: ноды целиком внутри группы кладутся в самую вложенную', () => {
        const raw = {
            format: 'workspace',
            version: 1,
            connections: [],
            nodes: [
                { id: 'outer', type: 'group', x: 0, y: 0, w: 900, h: 700, dataVersion: 1, data: { title: '' } },
                { id: 'inner', type: 'group', x: 10, y: 10, w: 400, h: 300, dataVersion: 1, data: { title: '' } },
                { id: 'a', type: 'note', x: 20, y: 40, w: 100, h: 80, dataVersion: 1, data: { text: '' } },
                { id: 'b', type: 'note', x: 500, y: 400, w: 100, h: 80, dataVersion: 1, data: { text: '' } },
                { id: 'c', type: 'note', x: 2000, y: 0, w: 100, h: 80, dataVersion: 1, data: { text: '' } },
            ],
        };
        const res = parse(JSON.stringify(raw), registry);
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        const p = (id: string) => res.workspace.nodes[id]!.parent;
        expect([p('inner'), p('a'), p('b'), p('c'), p('outer')]).toEqual(['outer', 'inner', 'outer', undefined, undefined]);
    });
});
