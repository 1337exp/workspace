import type { Component } from 'vue';

// Определение ноды (живёт в реестре) и экземпляры (чистые данные, сериализуются в JSON).

export type NodeData = Record<string, unknown>;

/**
 * Компонент содержимого ноды получает props `data` и `selected`
 * и сообщает об изменении событием `change` с частичным патчем данных.
 */
export interface NodeDef<D extends NodeData = NodeData> {
    id: string;
    title: string;
    /** Размер новой ноды, мировые единицы. */
    size: { w: number; h: number; minW?: number; minH?: number };
    /** Версия формата `data`. Растёт, когда формат меняется; старые данные проходят через `migrate`. По умолчанию 1. */
    version?: number;
    /** Данные новой ноды. */
    create(): D;
    /** Приводит данные старой версии к текущей. Без неё старые данные просто дополняются значениями из `create()`. */
    migrate?(data: NodeData, from: number): D;
    /** Vue-компонент содержимого. */
    component: Component;
    /** Имя иконки для `TaoIcon` (встроенная `tao-*` или из `src/icons.ts`), например `node-note`. */
    icon?: string;
    /** Клавиша инструмента в панели слева (`N`). Не задана — без клавиши. */
    hotkey?: string;
    /** Поле `data` с названием ноды: оно показывается в полосе вместо названия типа и правится двойным кликом по полосе. */
    titleKey?: string;
    /**
     * Нода-контейнер (рамка, группа): лежит под связями и другими нодами, телом не перехватывает клики,
     * а ноды, лежащие целиком внутри, едут вместе с ней при перетаскивании.
     */
    container?: boolean;
    /**
     * Без рамки и полосы: содержимое лежит прямо на холсте (текст). Двигают за само содержимое, выделение рисуется
     * контуром вокруг. Цвет ноды красит содержимое (`--tint`).
     */
    bare?: boolean;
    /**
     * Двойной клик по ноде включает правку на месте, у новой ноды правка включается сразу. Компонент получает
     * `editing` и сообщает о конце правки событием `edit-end`, о нужной высоте событием `fit`.
     */
    inlineEdit?: boolean;
    /** Пустая ли нода: после правки на месте пустая нода удаляется. */
    isEmpty?(data: NodeData): boolean;
    /**
     * Нода-точка (reroute): крошечная, без полосы и краёв, создаётся двойным кликом по связи.
     * Её пин один: сторона связи выбирается по положению соседа, а при удалении точка «растворяется» (соседи соединяются напрямую).
     */
    point?: boolean;
}

export type AnyNodeDef = NodeDef<any>;

//--------------------------------------------------

export interface NodeInstance {
    id: string;
    /** id определения в реестре. Если определения нет, нода остаётся заглушкой и сохраняется как есть. */
    type: string;
    x: number;
    y: number;
    w: number;
    h: number;
    /** Версия формата `data`, с которой оно было записано. */
    dataVersion: number;
    data: NodeData;
    /** Цвет ноды (имя из `NODE_COLORS`). Не задан — обычный. Неизвестное имя сохраняется как есть, но не рисуется. */
    color?: string;
}

export type Side = 'left' | 'right' | 'top' | 'bottom';

/** Точка крепления связи: у каждой ноды по пину с каждой из четырёх сторон. */
export interface Anchor {
    node: string;
    side: Side;
}

export type Arrow = 'none' | 'end';

export interface Connection {
    id: string;
    from: Anchor;
    to: Anchor;
    /** `end`: стрелка на конце `to`. */
    arrow: Arrow;
}

export interface Workspace {
    nodes: Record<string, NodeInstance>;
    connections: Connection[];
}
