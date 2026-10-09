<script lang="ts" setup>
/** Иконка «распределить»: две крайние планки и одна между ними на равных промежутках. Нарисована тут, а не в fontello, где такой нет. */
defineProps<{ axis: 'x' | 'y' }>();
</script>

<template>
    <svg class="distribute" :class="axis" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="1" y="2" width="2" height="12" rx="0.5" />
        <rect x="7" y="4.5" width="2" height="7" rx="0.5" />
        <rect x="13" y="2" width="2" height="12" rx="0.5" />
    </svg>
</template>

<style scoped>
.distribute {
    display: block;
    fill: currentColor;
}

/* Вертикальное распределение: тот же рисунок, повёрнутый на 90°. */
.distribute.y {
    transform: rotate(90deg);
}
</style>
