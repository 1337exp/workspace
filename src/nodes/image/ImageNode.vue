<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/i18n';
import { isImageUrl } from './url';

const props = defineProps<{ data: { url: string }; selected: boolean }>();
const emit = defineEmits<{ change: [patch: { url: string }] }>();

const { t } = useI18n();

const valid = computed(() => isImageUrl(props.data.url));
const failed = ref(false);
watch(() => props.data.url, () => (failed.value = false));

const editing = ref(false);
const showInput = computed(() => !props.data.url || props.selected || editing.value);

function onInput(e: Event) {
    emit('change', { url: (e.target as HTMLInputElement).value.trim() });
}
</script>

<template>
    <div class="image">
        <img v-if="valid && !failed" class="pic" :src="data.url" draggable="false" alt="" @error="failed = true" />
        <div v-else class="hint">
            {{ data.url ? t('nodes.image.broken') : t('nodes.image.empty') }}
        </div>

        <input
            v-if="showInput"
            class="url"
            :value="data.url"
            :placeholder="t('nodes.image.placeholder')"
            spellcheck="false"
            @input="onInput"
            @focus="editing = true"
            @blur="editing = false"
        />
    </div>
</template>

<style scoped>
.image {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    overflow: hidden;
    background: var(--tao-color-bg, #111827);
}

.pic {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
}

.hint {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 8px;
    box-sizing: border-box;
    color: var(--tao-color-text-muted, #9ca3af);
    font-size: 13px;
    text-align: center;
}

.url {
    position: absolute;
    left: 6px;
    right: 6px;
    bottom: 6px;
    box-sizing: border-box;
    padding: 4px 8px;
    border: 1px solid var(--tao-color-border-strong, #4b5563);
    border-radius: 4px;
    background: color-mix(in srgb, var(--tao-color-surface-raised, #1f2937) 95%, transparent);
    color: var(--tao-color-text, #e5e7eb);
    font: inherit;
    font-size: 12px;
    outline: none;
}

.url:focus {
    border-color: var(--tao-color-accent, #f59e0b);
}
</style>
