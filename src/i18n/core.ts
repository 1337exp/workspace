import { createI18n, type MessageArgs, type Paths } from '@1337exp/taoux/i18n';
import { FALLBACK_LOCALE, LOCALES, type LocaleCode } from './locales';
import type ru from './locales/ru';

/** Все допустимые ключи словаря: 'file.save', 'link.arrow', ... Тексты нод (`nodeTexts`) сюда не входят. */
export type MessageKey = Paths<Omit<typeof ru, 'nodeTexts'>>;
export type { MessageArgs };

/** Минимум, что нужно знать о ноде, чтобы её назвать. */
interface Titled {
    id: string;
    title: string;
}

const i18n = createI18n<typeof LOCALES, MessageKey>({
    locales: LOCALES,
    fallback: FALLBACK_LOCALE,
    storageKey: 'workspace.locale',
});

export const { applyLocale, setLocale, initLocale, translate, detectLocale } = i18n;

export function translateNodeTitle(code: LocaleCode, def: Titled): string {
    return LOCALES[code].nodeTexts.nodes[def.id]?.title ?? def.title;
}

export function useI18n() {
    const base = i18n.useI18n();
    return {
        ...base,
        nodeTitle: (def: Titled) => translateNodeTitle(base.locale.value, def),
    };
}
