import { registerTaoIcons } from '@1337exp/taoui';

/**
 * Иконки приложения для `TaoIcon` и `icon` у `TaoButton`: 24×24, обводка 2px, `currentColor`, как у встроенных
 * `tao-*` из TaoUI. Встроенных хватает не на всё, остальное рисуем здесь, в одном месте.
 * App icons for `TaoIcon` and the `icon` of `TaoButton`: 24×24, a 2px stroke, `currentColor`, like TaoUI's built-in
 * `tao-*`. The built-in set does not cover everything; the rest is drawn here, in one place.
 */
export function registerAppIcons() {
    registerTaoIcons({
        // приложение и панели
        menu: { body: '<path d="M4 7h16M4 12h16M4 17h16"/>' },
        help: { body: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>' },
        'tool-select': { body: '<path d="M5 3l14 7-6 2.2L10.8 19z"/>' },
        'view-fit': { body: '<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/>' },
        'view-list': { body: '<path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>' },

        // ноды
        'node-note': { body: '<path d="M5 4h14v10l-5 6H5z"/><path d="M14 20v-6h5"/>' },
        'node-image': { body: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M4 17l5-4 4 3 3-2 4 3"/>' },
        'node-group': { body: '<rect x="4" y="5" width="16" height="14" rx="2" stroke-dasharray="3 3"/>' },

        // связи
        'link-reverse': { body: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>' },
        'link-straighten': { body: '<path d="M6 12h12"/><circle cx="4" cy="12" r="1.5"/><circle cx="20" cy="12" r="1.5"/>' },

        // вид и файл
        'view-grid': { body: '<path d="M4 4h16v16H4zM4 12h16M12 4v16"/>' },
        'file-save': { body: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>' },
        'touch-select': { body: '<rect x="4" y="4" width="12" height="12" rx="1" stroke-dasharray="3 3"/><path d="M13 13l7 2-3 1.5L15 20z"/>' },

        // выравнивание: три по горизонтали, три по вертикали (те же рисунки, развёрнутые)
        'align-left': { body: '<path d="M4 4v16"/><rect x="7" y="6" width="12" height="4" rx="1"/><rect x="7" y="14" width="8" height="4" rx="1"/>' },
        'align-hcenter': { body: '<path d="M12 4v16"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="7" y="14" width="10" height="4" rx="1"/>' },
        'align-right': { body: '<path d="M20 4v16"/><rect x="5" y="6" width="12" height="4" rx="1"/><rect x="9" y="14" width="8" height="4" rx="1"/>' },
        'align-top': { body: '<path d="M4 4h16"/><rect x="6" y="7" width="4" height="12" rx="1"/><rect x="14" y="7" width="4" height="8" rx="1"/>' },
        'align-vmiddle': { body: '<path d="M4 12h16"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="7" width="4" height="10" rx="1"/>' },
        'align-bottom': { body: '<path d="M4 20h16"/><rect x="6" y="5" width="4" height="12" rx="1"/><rect x="14" y="9" width="4" height="8" rx="1"/>' },
        'distribute-x': { body: '<path d="M4 4v16M20 4v16"/><rect x="10" y="8" width="4" height="8" rx="1"/>' },
        'distribute-y': { body: '<path d="M4 4h16M4 20h16"/><rect x="8" y="10" width="8" height="4" rx="1"/>' },
    });
}
