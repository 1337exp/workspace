import { describe, expect, it } from 'vitest';
import {
    depthOf,
    hasChildren,
    indent,
    insertItem,
    isPartial,
    MAX_DEPTH,
    normalize,
    outdent,
    pasteLines,
    progress,
    removeItem,
    reorder,
    setDone,
    subtreeEnd,
    type ChecklistItem,
} from '@/nodes/checklist/items';
import { useEditor } from '@/editor/store';
import { createPinia, setActivePinia } from 'pinia';

/** Список из строки: «a b1 b2 c» где число после буквы это глубина (a0 b1 c2 ...), `!` в конце это выполнено. */
function list(spec: string): ChecklistItem[] {
    return spec.split(' ').map((token) => {
        const done = token.endsWith('!');
        const body = done ? token.slice(0, -1) : token;
        const depth = Number(body.slice(1) || 0);
        return { id: body[0]!, text: body[0]!, done, ...(depth > 0 ? { depth } : {}) };
    });
}
/** Обратно: id и глубина (и `!`). */
const show = (items: readonly ChecklistItem[]) => items.map((i) => `${i.id}${depthOf(i)}${i.done ? '!' : ''}`).join(' ');

describe('нормализация', () => {
    it('первый пункт на нуле, каждый не глубже предыдущего больше чем на 1, не глубже MAX_DEPTH', () => {
        const raw: ChecklistItem[] = [
            { id: 'a', text: '', done: false, depth: 2 },
            { id: 'b', text: '', done: false, depth: 5 },
            { id: 'c', text: '', done: false, depth: -3 },
            { id: 'd', text: '', done: false, depth: 1.4 },
            { id: 'e', text: '', done: false, depth: Number.NaN },
        ];
        expect(show(normalize(raw))).toBe('a0 b1 c0 d1 e0');
        const deep = normalize(Array.from({ length: 8 }, (_, i) => ({ id: String(i), text: '', done: false, depth: i })));
        expect(Math.max(...deep.map(depthOf))).toBe(MAX_DEPTH);
    });

    it('у нулевой глубины поля depth нет (данные старого вида не раздуваются)', () => {
        const out = normalize([{ id: 'a', text: '', done: false, depth: 0 }]);
        expect('depth' in out[0]!).toBe(false);
    });

    it('родитель выполнен, только если выполнены все его подпункты', () => {
        expect(show(normalize(list('a b1 c1')))).toBe('a0 b1 c1');
        expect(show(normalize(list('a b1! c1')))).toBe('a0 b1! c1');
        expect(show(normalize(list('a b1! c1!')))).toBe('a0! b1! c1!');
        expect(show(normalize(list('a! b1 c1!')))).toBe('a0 b1 c1!'); // отметка родителя не переживает невыполненного подпункта
        // вложенные родители: выводятся снизу вверх
        expect(show(normalize(list('a b1 c2! d1!')))).toBe('a0! b1! c2! d1!');
    });
});

describe('структура', () => {
    const items = list('a b1 c2 d1 e');

    it('subtreeEnd и hasChildren', () => {
        expect(subtreeEnd(items, 0)).toBe(4); // a: b c d
        expect(subtreeEnd(items, 1)).toBe(3); // b: c
        expect(subtreeEnd(items, 4)).toBe(5);
        expect(hasChildren(items, 0)).toBe(true);
        expect(hasChildren(items, 2)).toBe(false);
    });

    it('Tab вкладывает вместе с подпунктами и только под предыдущий; первый и слишком глубокий нельзя', () => {
        const flat = list('a b c');
        expect(show(indent(flat, 'b')!)).toBe('a0 b1 c0');
        expect(indent(flat, 'a')).toBeNull(); // первый
        const nested = indent(list('a b c1'), 'b')!; // b с подпунктом c: оба глубже
        expect(show(nested)).toBe('a0 b1 c2');
        expect(indent(list('a b1'), 'b')).toBeNull(); // уже глубже предыдущего на 1
        const deepest = list('a b1 c2 d3 e');
        expect(indent(deepest, 'd')).toBeNull(); // выше MAX_DEPTH
        expect(indent(list('a b c1 d2 e3'), 'b')).toBeNull(); // поддерево упёрлось бы в MAX_DEPTH
    });

    it('Shift+Tab выносит вместе с подпунктами; на нулевом нельзя', () => {
        expect(show(outdent(list('a b1 c2'), 'b')!)).toBe('a0 b0 c1');
        expect(outdent(list('a b'), 'b')).toBeNull();
        expect(outdent(list('a'), 'нет')).toBeNull();
    });

    it('отметка пункта ложится на всё его поддерево, отметка подпункта выводит родителя', () => {
        const t = list('a b1 c1 d');
        expect(show(setDone(t, 'a', true))).toBe('a0! b1! c1! d0');
        expect(show(setDone(setDone(t, 'a', true), 'b', false))).toBe('a0 b1 c1! d0'); // снят подпункт: родитель больше не выполнен
        expect(show(setDone(t, 'b', true))).toBe('a0 b1! c1 d0');
        expect(show(setDone(setDone(t, 'b', true), 'c', true))).toBe('a0! b1! c1! d0');
        expect(show(setDone(t, 'нет', true))).toBe(show(t));
    });

    it('«не до конца»: родитель не выполнен, но что-то в подпунктах выполнено', () => {
        const t = normalize(list('a b1! c1 d'));
        expect(isPartial(t, 0)).toBe(true);
        expect(isPartial(t, 1)).toBe(false); // у b нет подпунктов
        expect(isPartial(setDone(t, 'c', true), 0)).toBe(false); // всё выполнено
        expect(isPartial(normalize(list('a b1 c1')), 0)).toBe(false); // ничего не выполнено
    });

    it('счёт идёт по пунктам без подпунктов, родитель отдельно не считается', () => {
        expect(progress(normalize(list('a b1! c1 d!')))).toEqual({ done: 2, total: 3 }); // листья b, c, d
        expect(progress(list('a b c'))).toEqual({ done: 0, total: 3 });
    });
});

describe('вставка и удаление', () => {
    it('Enter у пункта без подпунктов даёт пункт той же глубины, у родителя первый подпункт', () => {
        const flat = insertItem(list('a b1 c'), 'b', 'x');
        expect(show(flat.items).replace(flat.item.id, 'N')).toBe('a0 b1 N1 c0'); // та же глубина, что у b
        expect(flat.item.text).toBe('x');

        const parent = insertItem(list('a b1 c'), 'a');
        expect(parent.items[1]!.id).toBe(parent.item.id);
        expect(depthOf(parent.item)).toBe(1);
        expect(show(parent.items).replace(parent.item.id, 'N')).toBe('a0 N1 b1 c0');

        expect(depthOf(insertItem(list('a b1'), null).item)).toBe(0); // в конец: верхний уровень
    });

    it('удаление пункта поднимает его подпункты на уровень; последний только очищается', () => {
        expect(show(removeItem(list('a b1 c2 d1 e'), 'a'))).toBe('b0 c1 d0 e0');
        expect(show(removeItem(list('a b1 c2 d'), 'b'))).toBe('a0 c1 d0');
        expect(removeItem([{ id: 'a', text: 'x', done: true, depth: 1 }], 'a')).toEqual([{ id: 'a', text: '', done: false }]);
    });
});

describe('перестановка блоками', () => {
    it('пункт едет вместе с поддеревом и берёт глубину места', () => {
        const items = list('a b1 c d e1');
        // a с подпунктом b тащим вниз на d: встаёт после d (и его поддерева e) на глубину d
        expect(show(reorder(items, items, 0, 3))).toBe('c0 d0 e1 a0 b1');
        // d тащим вверх на a: встаёт перед a
        expect(show(reorder(items, items, 3, 0))).toBe('d0 e1 a0 b1 c0');
        // c тащим вверх на b: берёт глубину b (1) и встаёт перед ним
        expect(show(reorder(items, items, 2, 1))).toBe('a0 c1 b1 d0 e1');
        // b (глубина 1) тащим вниз на c: встаёт после c на глубину c (0)
        expect(show(reorder(items, items, 1, 2))).toBe('a0 c0 b0 d0 e1');
    });

    it('на своё поддерево перетащить нельзя; исходный список не меняется', () => {
        const items = list('a b1 c2 d');
        expect(show(reorder(items, items, 0, 1))).toBe(show(items));
        expect(show(reorder(items, items, 0, 2))).toBe(show(items));
        expect(show(items)).toBe('a0 b1 c2 d0');
    });

    it('при спрятанных выполненных места переводятся по id, спрятанный подпункт едет с родителем', () => {
        // c выполнен и спрятан; видны a, b, d, e
        const full = normalize(list('a b1 c1! d e1'));
        const shown = full.filter((i) => !i.done);
        expect(shown.map((i) => i.id)).toEqual(['a', 'b', 'd', 'e']);
        // a (с подпунктами b и спрятанным c) тащим на d: встаёт после d и его поддерева e, и c едет с ним
        expect(show(reorder(full, shown, 0, 2))).toBe('d0 e1 a0 b1 c1!');
        // e тащим вверх на b: берёт глубину b и встаёт перед ним
        expect(show(reorder(full, shown, 3, 1))).toBe('a0 e1 b1 c1! d0');
    });
});

describe('вставка многострочного текста', () => {
    const one = list('a b');

    it('отступы дают вложенность относительно первой строки', () => {
        const r = pasteLines(one, 'a', 'купить\n  молоко\n  хлеб\n    чёрный\nдомой')!;
        expect(r.items.map((i) => `${i.text || i.id}:${depthOf(i)}`)).toEqual(['купить:0', 'молоко:1', 'хлеб:1', 'чёрный:2', 'домой:0', 'b:0']);
        expect(r.items.find((i) => i.id === r.focus)!.text).toBe('домой');
    });

    it('табы, маркеры списка и отметки [x] понимаются', () => {
        const r = pasteLines(one, 'a', '- [ ] план\n\t- [x] сделано\n\t* ещё\n• конец')!;
        const view = r.items.slice(0, 4).map((i) => `${i.text}:${depthOf(i)}:${i.done}`);
        expect(view).toEqual(['план:0:false', 'сделано:1:true', 'ещё:1:false', 'конец:0:false']);
    });

    it('строки встают после поддерева пункта, в который вставили, на его глубине', () => {
        const nested = list('a b1 c');
        const r = pasteLines(nested, 'a', 'один\nдва')!;
        expect(r.items.map((i) => i.text || i.id)).toEqual(['один', 'b', 'два', 'c']);
        expect(depthOf(r.items[2]!)).toBe(0);
    });

    it('одна строка и пустое не в счёт; слишком глубокие отступы упираются в предел', () => {
        expect(pasteLines(one, 'a', 'одна')).toBeNull();
        expect(pasteLines(one, 'a', '\n  \n')).toBeNull();
        expect(pasteLines(one, 'нет', 'раз\nдва')).toBeNull();
        const deep = pasteLines(one, 'a', 'x\n' + ' '.repeat(40) + 'y')!;
        expect(Math.max(...deep.items.map(depthOf))).toBeLessThanOrEqual(MAX_DEPTH);
    });
});

describe('в ноде', () => {
    it('данные старого вида (без depth) читаются, а вложенность переживает правки данных', () => {
        setActivePinia(createPinia());
        const editor = useEditor();
        editor.loadWorkspace({ nodes: {}, connections: [] }, undefined, true);
        const n = editor.addNodeAtCenter('checklist');
        editor.patchData(n.id, { items: [{ id: 'x', text: 'родитель', done: false }, { id: 'y', text: 'ребёнок', done: true, depth: 1 }] });
        const items = editor.workspace.nodes[n.id]!.data.items as ChecklistItem[];
        expect(items[1]!.depth).toBe(1);
        expect(show(normalize(items))).toBe('x0! y1!'); // родитель выведен из подпункта
    });
});
