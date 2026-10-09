import { defineNode } from '@/core/define';
import RerouteNode from './RerouteNode.vue';

// Точка на связи: создаётся двойным кликом по линии, в палитре не показывается.
export default defineNode({
    id: 'reroute',
    title: 'Reroute',
    size: { w: 20, h: 20 },
    create: () => ({}),
    point: true,
    component: RerouteNode,
});
