import { Registry } from '@/core/registry';
import type { AnyNodeDef } from '@/core/types';

// Каждая папка в nodes/: `index.ts` с `export default defineNode(...)`. Положил папку — нода в реестре.
const modules = import.meta.glob<{ default: AnyNodeDef }>('./*/index.ts', { eager: true });

export function createDefaultRegistry(): Registry {
    const registry = new Registry();
    for (const mod of Object.values(modules)) registry.register(mod.default);
    return registry;
}
