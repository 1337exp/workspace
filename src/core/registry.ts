import type { AnyNodeDef, NodeData, NodeDef } from './types';

export class Registry {
    private readonly defs = new Map<string, AnyNodeDef>();

    register<D extends NodeData>(def: NodeDef<D>): this {
        if (this.defs.has(def.id)) throw new Error(`Нода "${def.id}" уже зарегистрирована`);
        this.defs.set(def.id, def);
        return this;
    }

    /** Определение или undefined: неизвестный тип — не ошибка, такая нода рисуется заглушкой. */
    find(id: string): AnyNodeDef | undefined {
        return this.defs.get(id);
    }

    get(id: string): AnyNodeDef {
        const def = this.defs.get(id);
        if (!def) throw new Error(`Неизвестный тип ноды "${id}"`);
        return def;
    }

    all(): AnyNodeDef[] {
        return [...this.defs.values()];
    }
}
