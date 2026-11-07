import { useEditor } from './store';

type Editor = ReturnType<typeof useEditor>;

/**
 * Обмен с системным буфером. Клавиши `Ctrl+C` / `Ctrl+X` / `Ctrl+V` идут нативными событиями `copy`, `cut`, `paste`:
 * они не требуют разрешений, а вставка читает буфер без запроса. Пункты меню и кнопки идут асинхронным Clipboard API
 * (он нужен там, где события нет); если браузер его не дал, показываем сообщение. В полях ввода события не трогаем:
 * там копируют и вставляют текст как обычно.
 *
 * Exchange with the system clipboard. The keys go as the native `copy`, `cut` and `paste` events: they need no
 * permission, and paste reads the clipboard without a prompt. Menu items and buttons go through the async Clipboard API
 * (needed where there is no event); if the browser did not allow it, a message is shown. Events inside input fields are
 * left alone: there the text is copied and pasted as usual.
 */

const inField = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    return !!el?.closest?.('input, textarea, select, [contenteditable="true"]');
};

/** Выделен текст на странице (справка, поле): тогда копируется он, а не ноды. */
const hasTextSelected = () => (window.getSelection()?.toString() ?? '') !== '';

/** Слушает события буфера на документе. Возвращает функцию, которая перестаёт слушать. */
export function bindClipboardEvents(editor: Editor, target: Document = document): () => void {
    const onCopy = (e: ClipboardEvent) => {
        if (inField(e.target) || hasTextSelected()) return;
        const text = editor.copySelected();
        if (text === null) return;
        e.clipboardData?.setData('text/plain', text);
        e.preventDefault();
    };

    const onCut = (e: ClipboardEvent) => {
        if (inField(e.target) || hasTextSelected()) return;
        const text = editor.cutSelected();
        if (text === null) return;
        e.clipboardData?.setData('text/plain', text);
        e.preventDefault();
    };

    const onPaste = (e: ClipboardEvent) => {
        if (inField(e.target)) return;
        const text = e.clipboardData?.getData('text/plain') ?? '';
        if (editor.pasteText(text).length > 0) e.preventDefault();
        else if (text !== '') editor.showNotice('error', 'clipboard.nothing');
    };

    target.addEventListener('copy', onCopy as EventListener);
    target.addEventListener('cut', onCut as EventListener);
    target.addEventListener('paste', onPaste as EventListener);
    return () => {
        target.removeEventListener('copy', onCopy as EventListener);
        target.removeEventListener('cut', onCut as EventListener);
        target.removeEventListener('paste', onPaste as EventListener);
    };
}

/** Запись в буфер: Clipboard API, а где его нет или он отказал, прежний способ через скрытое поле. */
async function write(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const field = document.createElement('textarea');
        field.value = text;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        try {
            return document.execCommand('copy');
        } catch {
            return false;
        } finally {
            field.remove();
        }
    }
}

/**
 * Команды буфера для меню и кнопок. `paste(at)` ставит вставляемое центром в мировую точку `at` (меню у курсора).
 * Clipboard commands for menus and buttons. `paste(at)` puts what is pasted centred on the world point `at` (a menu at
 * the cursor).
 */
export function clipboardActions(editor: Editor) {
    async function copy() {
        const text = editor.copySelected();
        if (text !== null && !(await write(text))) editor.showNotice('error', 'clipboard.denied');
    }

    async function cut() {
        const text = editor.copySelected();
        if (text === null) return;
        // Сначала в буфер: если браузер отказал, ноды не должны пропасть.
        if (await write(text)) editor.removeSelected();
        else editor.showNotice('error', 'clipboard.denied');
    }

    async function paste(at?: readonly [number, number]) {
        let text: string;
        try {
            text = await navigator.clipboard.readText();
        } catch {
            editor.showNotice('error', 'clipboard.denied');
            return;
        }
        if (editor.pasteText(text, at).length === 0) editor.showNotice('error', 'clipboard.nothing');
    }

    return { copy, cut, paste };
}
