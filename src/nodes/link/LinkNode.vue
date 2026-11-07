<script lang="ts" setup>
import { computed, ref } from 'vue';
import { TaoButton } from '@1337exp/taoui';
import { useI18n } from '@/i18n';
import { hostOf, isLinkUrl, normalizeUrl } from './url';

/**
 * Ссылка: карточка с адресом. Крупно имя узла, мелко весь адрес, кнопка «Открыть» (новая вкладка, без доступа к
 * нашему окну). Адрес правится в поле внизу: оно видно, пока ссылка пустая, нода выделена или поле в фокусе.
 * Страницу мы не запрашиваем: ни заголовка, ни значка, чтобы не отправлять чужим сервисам адреса из чьих-то заметок.
 *
 * A link: a card with an address. The host big, the whole address small, an "Open" button (a new tab, with no access to
 * our window). The address is edited in the field at the bottom: it is shown while the link is empty, the node is
 * selected or the field has the focus. We do not fetch the page: no title, no icon, so that the addresses from
 * somebody's notes are not sent to third-party services.
 */
const props = defineProps<{ data: { url: string }; selected: boolean }>();
const emit = defineEmits<{ change: [patch: { url: string }] }>();

const { t } = useI18n();

const valid = computed(() => isLinkUrl(props.data.url));
const host = computed(() => hostOf(props.data.url));

const editing = ref(false);
const showInput = computed(() => !props.data.url || props.selected || editing.value);

// Пока печатают, храним как есть; нормализуем, когда поле отпустили (example.com → https://example.com).
function onInput(e: Event) {
    emit('change', { url: (e.target as HTMLInputElement).value });
}

function onBlur(e: Event) {
    editing.value = false;
    const normalized = normalizeUrl((e.target as HTMLInputElement).value);
    if (normalized !== props.data.url) emit('change', { url: normalized });
}

function open() {
    if (valid.value) window.open(props.data.url.trim(), '_blank', 'noopener,noreferrer');
}
</script>

<template>
    <div class="link">
        <div class="card">
            <template v-if="valid">
                <div class="names">
                    <div class="host" :title="host">{{ host }}</div>
                    <div class="full" :title="data.url">{{ data.url }}</div>
                </div>
                <TaoButton variant="secondary" icon="link-open" :aria-label="t('nodes.link.open')" :title="t('nodes.link.open')" @click="open" />
            </template>
            <div v-else class="hint">{{ data.url ? t('nodes.link.invalid') : t('nodes.link.empty') }}</div>
        </div>

        <input
            v-if="showInput"
            class="url"
            :value="data.url"
            :placeholder="t('nodes.link.placeholder')"
            spellcheck="false"
            @input="onInput"
            @focus="editing = true"
            @blur="onBlur"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        />
    </div>
</template>

<style scoped>
.link {
    display: flex;
    flex-direction: column;
    gap: 6px;
    box-sizing: border-box;
    height: 100%;
    padding: 8px;
}

.card {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-height: 0;
    padding: 0 4px;
}

.names {
    flex: 1;
    min-width: 0;
}

.host {
    overflow: hidden;
    color: var(--tao-color-text-strong);
    font-size: 18px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.full {
    overflow: hidden;
    color: var(--tao-color-text-muted);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.hint {
    color: var(--tao-color-text-muted);
    font-size: 13px;
}

.url {
    flex: none;
    box-sizing: border-box;
    padding: 4px 8px;
    border: 1px solid var(--tao-color-border-strong);
    border-radius: var(--tao-radius-control);
    background: var(--tao-color-bg);
    color: var(--tao-color-text);
    font: inherit;
    font-size: 12px;
    outline: none;
}

.url:focus {
    border-color: var(--tao-color-accent);
}
</style>
