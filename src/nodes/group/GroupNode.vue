<script lang="ts" setup>
// Тело группы пустое: рамку, фон и полосу рисует NodeView, потому что она контейнер (`container: true`).
defineProps<{ data: { title: string }; selected: boolean }>();
</script>

<template>
    <div class="group" />
</template>

<style scoped>
.group {
    width: 100%;
    height: 100%;
}
</style>
