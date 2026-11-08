import type { Component } from 'vue';

// Определение ноды (живёт в реестре) и экземпляры (чистые данные, сериализуются в JSON).

export type NodeData = Record<string, unknown>;

/**
 * Переключатель типа ноды в панели над выделением («Скрыть выполненные», «Крупный текст»). Панель показывает его, когда
 * выделены ноды только этого типа; нажатие включает или выключает его у всех. Подпись в словаре:
 * `nodes.<тип>.action.<id>`.
 * A node type's toggle in the bar over the selection. The bar shows it when only nodes of this type are selected; a
 * press switches it on or off for all of them. The label is in the dictionary: `nodes.<type>.action.<id>`.
 */
export interface NodeAction<D extends NodeData = NodeData> {
    id: string;
    /** Имя иконки (см. `src/icons.ts`). */
    icon: string;
    /** Включён ли у этой ноды. */
    get(data: D): boolean;
    /** Патч данных, который включает (`on`) или выключает переключатель. */
    set(data: D, on: boolean): Partial<D>;
}

/**
 * Компонент содержимого ноды получает props `data` и `selected`
 * и сообщает об изменении событием `change` с частичным патчем данных.
 */
/** Заготовка размера ноды. / A node size preset. */
export interface NodePreset {
    id: string;
    w: number;
    h: number;
}

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
    /** Переключатели в панели над выделением. */
    actions?: NodeAction<D>[];
    /** Клавиша инструмента в панели слева (`N`). Не задана — без клавиши. */
    hotkey?: string;
    /**
     * Место в панели слева, в палитре и в справке: по возрастанию; без поля после всех пронумерованных, в порядке регистрации.
     * Числа идут с запасом (10, 20, ...), чтобы новая нода встала между существующими, не трогая их.
     */
    order?: number;
    /**
     * Рисуется поверх остальных нод и связей (стикер), а не вместе с ними. Порядок среди таких нод тот же, что у остальных:
     * по порядку создания, нода, за которую взялись, поднимается.
     */
    overlay?: boolean;
    /** Ноду можно красить цветом из панели. По умолчанию да; у стикера нет. */
    colorable?: boolean;
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
     * Заготовки размера: у кнопки инструмента в панели слева открывается окошко с ними, выбранная ставится следующим кликом
     * по холсту (группа: A4, 16:9, телефон…). Название берётся из `preset.<id>` в словаре.
     * Size presets: the tool's dock button opens a popover with them, the picked one is placed by the next click on the canvas.
     */
    presets?: readonly NodePreset[];
    /** Рисуется цветной заливкой с тенью (стикер); цвет ноды красит заливку, без цвета заливка жёлтая. Нужен `bare`. */
    sticker?: boolean;
    /** Настройки текста в панели над нодой: размер шрифта («Авто» или число), жирный, выравнивание (`size`, `bold`, `align` в данных). */
    textStyle?: boolean;
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
    /**
     * Контейнер (группа, фрейм), в который нода явно помещена; у ноды он один. Состав задаётся не геометрией: нода попадает
     * в контейнер, только когда её выбрали и перетащили в него, и выходит, когда выбрали и вытащили.
     * The container (group, frame) the node was explicitly put into; a node has at most one. Membership is not geometric:
     * a node enters a container only when it is picked and dragged into it, and leaves when picked and dragged out.
     */
    parent?: string;
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
    /** Подпись посередине связи. Нет поля: подписи нет (пустая строка не хранится). */
    label?: string;
}

export interface Workspace {
    nodes: Record<string, NodeInstance>;
    connections: Connection[];
}
