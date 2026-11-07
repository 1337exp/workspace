import { defineNode } from '@/core/define';
import ChecklistNode from './ChecklistNode.vue';
import { emptyItem, type ChecklistData } from './items';

// Чеклист: заголовок в полосе (двойной клик), пункты с галочкой. Выполненные можно спрятать из панели над нодой.
export default defineNode<ChecklistData & { title: string }>({
    id: 'checklist',
    title: 'Checklist',
    icon: 'node-checklist',
    hotkey: 'L',
    size: { w: 260, h: 220, minW: 180, minH: 120 },
    create: () => ({ title: '', items: [emptyItem([])], hideDone: false }),
    titleKey: 'title',
    component: ChecklistNode,
    actions: [
        {
            id: 'hideDone',
            icon: 'tao-eye-off',
            get: (data) => data.hideDone === true,
            set: (_data, on) => ({ hideDone: on }),
        },
    ],
});
