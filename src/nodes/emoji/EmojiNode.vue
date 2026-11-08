<script lang="ts" setup>
/**
 * Стикер из эмодзи: один знак во всю ноду, размер следует за размером ноды (единицы контейнера `cqmin`). Без рамки, без
 * текста; растягивается за грани и углы, как любая нода.
 * An emoji sticker: one glyph over the whole node, its size follows the size of the node (the `cqmin` container units).
 * No frame, no text; it is resized by its edges and corners like any node.
 */
defineProps<{ data: { emoji: string }; selected: boolean; editing?: boolean }>();
// Общий разбор «голых» нод передаёт и эти события; у стикера правки на месте нет.
defineEmits<{ change: [patch: { emoji: string }]; 'edit-end': []; fit: [height: number] }>();
</script>

<template>
    <div class="sticker">
        <span class="glyph">{{ data.emoji }}</span>
    </div>
</template>

<style scoped>
.sticker {
    container-type: size;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    cursor: default;
    user-select: none;
}

.glyph {
    font-size: 76cqmin;
    line-height: 1;
}
</style>
