import type { NodeData, NodeDef } from './types';

/** Выводит тип данных ноды из `create()`. */
export function defineNode<D extends NodeData>(def: NodeDef<D>): NodeDef<D> {
    return def;
}

export const dataVersionOf = (def: Pick<NodeDef, 'version'>) => def.version ?? 1;
