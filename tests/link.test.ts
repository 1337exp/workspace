import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { hostOf, isLinkUrl, normalizeUrl } from '@/nodes/link/url';
import { createEditorCommands } from '@/editor/commands';
import { useEditor } from '@/editor/store';

describe('адреса ссылок', () => {
    it('normalizeUrl: пустое остаётся пустым, адрес без схемы получает https, схема не трогается', () => {
        expect(normalizeUrl('')).toBe('');
        expect(normalizeUrl('   ')).toBe('');
        expect(normalizeUrl(' example.com/path?q=1 ')).toBe('https://example.com/path?q=1');
        expect(normalizeUrl('http://a.b')).toBe('http://a.b');
        expect(normalizeUrl('javascript:alert(1)')).toBe('javascript:alert(1)'); // не чинится: isLinkUrl его отвергнет
        expect(normalizeUrl('просто слова')).toBe('просто слова');
        expect(normalizeUrl('localhost')).toBe('localhost'); // без точки это не адрес
    });

    it('isLinkUrl: только http(s) с именем узла', () => {
        expect(isLinkUrl('https://example.com')).toBe(true);
        expect(isLinkUrl(' http://a.b/c ')).toBe(true);
        for (const bad of ['', 'example.com', 'javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///c:/x', 'https://', 'ftp://a.b', 'mailto:a@b.c']) {
            expect(isLinkUrl(bad), bad).toBe(false);
        }
    });

    it('hostOf: имя узла без www., для неадреса пусто', () => {
        expect(hostOf('https://www.example.com/a/b')).toBe('example.com');
        expect(hostOf('https://sub.example.com:8080/')).toBe('sub.example.com');
        expect(hostOf('javascript:alert(1)')).toBe('');
        expect(hostOf('')).toBe('');
    });
});

describe('нода «Ссылка»', () => {
    beforeEach(() => setActivePinia(createPinia()));

    it('инструмент с клавишей K, новая нода пустая, данные правятся', () => {
        const editor = useEditor();
        editor.loadWorkspace({ nodes: {}, connections: [] }, undefined, true);
        const { commands } = createEditorCommands(editor);
        expect(commands.shortcutLabel('tool.place.link')).toBe('K');
        expect(commands.check()).toEqual([]);

        const n = editor.addNodeAtCenter('link');
        expect(n.data).toMatchObject({ url: '', title: '' });
        editor.patchData(n.id, { url: 'https://example.com' });
        expect(editor.workspace.nodes[n.id]!.data.url).toBe('https://example.com');
    });
});
