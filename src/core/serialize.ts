import { dataVersionOf } from './define';
import type { Registry } from './registry';
import type { Anchor, Arrow, Connection, NodeData, NodeInstance, Workspace } from './types';
import { SIDES } from './workspace';

export const FORMAT = 'workspace';
/** Версия формата файла (не путать с версиями данных нод). */
export const FORMAT_VERSION = 1;

export interface SavedView {
    x: number;
    y: number;
    z: number;
}

export type LoadErrorCode = 'invalidJson' | 'notWorkspaceFile' | 'newerVersion' | 'invalidStructure';

export interface LoadError {
    code: LoadErrorCode;
    detail?: string | number;
}

export type ParseResult =
    | { ok: true; workspace: Workspace; view: SavedView | undefined; droppedConnections: number }
    | { ok: false; error: LoadError };

export function serialize(ws: Workspace, view?: SavedView, pretty = true): string {
    const file = {
        format: FORMAT,
        version: FORMAT_VERSION,
        ...(view ? { view } : {}),
        nodes: Object.values(ws.nodes),
        connections: ws.connections,
    };
    return pretty ? JSON.stringify(file, null, 2) : JSON.stringify(file);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const fail = (code: LoadErrorCode, detail?: string | number): ParseResult => ({
    ok: false,
    error: detail === undefined ? { code } : { code, detail },
});

/** Приводит данные ноды к текущей версии её определения. Неизвестный тип и более новые данные не трогаем. */
function upgrade(node: NodeInstance, registry: Registry): void {
    const def = registry.find(node.type);
    if (!def) return;

    const current = dataVersionOf(def);
    if (node.dataVersion > current) return; // записано более новой версией: не портим

    node.data = node.dataVersion < current && def.migrate ? def.migrate(node.data, node.dataVersion) : { ...def.create(), ...node.data };
    node.dataVersion = current;
}

function readNode(raw: unknown, registry: Registry): NodeInstance | string {
    if (!isObject(raw)) return 'node';
    const { id, type, x, y, w, h, dataVersion, data, color } = raw;
    if (typeof id !== 'string' || id === '') return 'node.id';
    if (typeof type !== 'string') return `${id}.type`;
    if (!isNum(x) || !isNum(y) || !isNum(w) || !isNum(h) || w <= 0 || h <= 0) return `${id}.geometry`;
    if (!isObject(data)) return `${id}.data`;

    const node: NodeInstance = {
        id,
        type,
        x,
        y,
        w,
        h,
        dataVersion: isNum(dataVersion) ? dataVersion : 1,
        data: data as NodeData,
        ...(typeof color === 'string' && color !== '' ? { color } : {}),
    };
    upgrade(node, registry);
    return node;
}

function readAnchor(raw: unknown, ws: Workspace): Anchor | null {
    if (!isObject(raw) || typeof raw.node !== 'string' || !(raw.node in ws.nodes)) return null;
    const side = SIDES.find((s) => s === raw.side);
    return side ? { node: raw.node, side } : null;
}

/** Читает текст файла. Не бросает: ошибки возвращаются результатом. Неизвестные типы нод сохраняются как заглушки. */
export function parse(text: string, registry: Registry): ParseResult {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        return fail('invalidJson');
    }

    if (!isObject(raw) || raw.format !== FORMAT) return fail('notWorkspaceFile');
    if (!isNum(raw.version)) return fail('invalidStructure', 'version');
    if (raw.version > FORMAT_VERSION) return fail('newerVersion', raw.version);
    if (!Array.isArray(raw.nodes) || !Array.isArray(raw.connections)) return fail('invalidStructure', 'nodes');

    const workspace: Workspace = { nodes: {}, connections: [] };

    for (const item of raw.nodes) {
        const node = readNode(item, registry);
        if (typeof node === 'string') return fail('invalidStructure', node);
        if (node.id in workspace.nodes) return fail('invalidStructure', `${node.id}.duplicate`);
        workspace.nodes[node.id] = node;
    }

    let dropped = 0;
    const seen = new Set<string>();
    for (const item of raw.connections) {
        const from = isObject(item) ? readAnchor(item.from, workspace) : null;
        const to = isObject(item) ? readAnchor(item.to, workspace) : null;
        const id = isObject(item) ? item.id : undefined;
        if (!from || !to || from.node === to.node || typeof id !== 'string' || seen.has(id)) {
            dropped++;
            continue;
        }
        seen.add(id);
        const arrow: Arrow = isObject(item) && item.arrow === 'end' ? 'end' : 'none';
        const connection: Connection = { id, from, to, arrow };
        workspace.connections.push(connection);
    }

    let view: SavedView | undefined;
    if (isObject(raw.view) && isNum(raw.view.x) && isNum(raw.view.y) && isNum(raw.view.z) && raw.view.z > 0) {
        view = { x: raw.view.x, y: raw.view.y, z: raw.view.z };
    }

    return { ok: true, workspace, view, droppedConnections: dropped };
}
