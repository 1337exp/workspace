/**
 * Приводит введённое к адресу: пустое остаётся пустым, `example.com/path` получает `https://`, всё, у чего уже есть
 * схема (в том числе чужая), остаётся как есть: решение, можно ли это открыть, принимает `isLinkUrl`.
 * Turns what was typed into an address: empty stays empty, `example.com/path` gets `https://`, anything that already has
 * a scheme (a foreign one too) stays as it is: whether it may be opened is decided by `isLinkUrl`.
 */
export function normalizeUrl(raw: string): string {
    const text = raw.trim();
    if (text === '') return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return text;
    return /^[^\s/]+\.[^\s/]+/.test(text) ? `https://${text}` : text;
}

/** Можно ли открыть: только http(s) с настоящим именем узла. javascript:, data:, file: и прочее нет. */
export function isLinkUrl(url: string): boolean {
    if (!/^https?:\/\//i.test(url.trim())) return false;
    try {
        return new URL(url.trim()).hostname !== '';
    } catch {
        return false;
    }
}

/** Имя узла без `www.` для крупной подписи; для неадресов пустая строка. */
export function hostOf(url: string): string {
    if (!isLinkUrl(url)) return '';
    return new URL(url.trim()).hostname.replace(/^www\./i, '');
}
