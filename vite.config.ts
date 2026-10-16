import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    // Относительные пути: приложение можно положить в любую подпапку сайта или в WebView.
    base: './',
    plugins: [vue()],
    resolve: {
        alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
        // Пакеты, слинкованные с соседних папок (@1337exp/taoux), не должны тащить вторую копию Vue.
        dedupe: ['vue'],
    },
    test: {
        environment: 'happy-dom',
        include: ['tests/**/*.test.ts'],
    },
});
