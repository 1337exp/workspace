<script lang="ts" setup>
// Точка рисуется самим NodeView (она `point`), своего содержимого у неё нет.
defineProps<{ data: Record<string, never>; selected: boolean }>();
</script>

<template>
    <span />
</template>
