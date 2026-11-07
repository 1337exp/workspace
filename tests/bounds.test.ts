import { describe, expect, it } from 'vitest';
import { nodesBounds, selectionBounds } from '@/core/bounds';
import type { NodeInstance, Workspace } from '@/core/types';
import { connect } from '@/core/workspace';

const node = (id: string, x: number, y: number, w = 100, h = 50): NodeInstance => ({ id, type: 'note', x, y, w, h, dataVersion: 1, data: {} });

function ws(): Workspace {
    return { nodes: { a: node('a', 0, 0), b: node('b', 300, 200, 40, 40) }, connections: [] };
}

describe('nodesBounds', () => {
    it('охватывает все ноды или только перечисленные', () => {
        expect(nodesBounds(ws())).toEqual({ x: 0, y: 0, w: 340, h: 240 });
        expect(nodesBounds(ws(), ['b'])).toEqual({ x: 300, y: 200, w: 40, h: 40 });
    });

    it('нет нод — null; неизвестные id пропускаются', () => {
        expect(nodesBounds({ nodes: {}, connections: [] })).toBeNull();
        expect(nodesBounds(ws(), ['nope'])).toBeNull();
        expect(nodesBounds(ws(), ['a', 'nope'])).toEqual({ x: 0, y: 0, w: 100, h: 50 });
    });
});

describe('selectionBounds', () => {
    it('ноды главнее связи; без нод берётся охват концов связи', () => {
        const w = ws();
        const link = connect(w, { node: 'a', side: 'right' }, { node: 'b', side: 'left' });
        expect(selectionBounds(w, ['a'], link.id)).toEqual({ x: 0, y: 0, w: 100, h: 50 });
        expect(selectionBounds(w, [], link.id)).toEqual({ x: 100, y: 25, w: 200, h: 195 });
        expect(selectionBounds(w, [], null)).toBeNull();
        expect(selectionBounds(w, [], 'missing')).toBeNull();
    });
});
