/** Показываем только http(s) и встроенные картинки: остальные схемы (file:, javascript:) не нужны. */
export function isImageUrl(url: string): boolean {
    return /^(https?:\/\/|data:image\/|blob:)/i.test(url.trim());
}
