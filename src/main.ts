import { createApp } from 'vue';
import { createPinia } from 'pinia';
import TaoUI from '@1337exp/taoui';
import '@1337exp/taoui/styles.css';
import '@/assets/font/roboto.css';
import '@/styles/app.css';
import '@/styles/touch.css';
import '@/styles/colors.css';
import App from './App.vue';
import { useEditor } from './editor/store';
import { registerAppIcons } from './icons';
import { initLocale } from './i18n';

initLocale();
registerAppIcons();

const app = createApp(App).use(createPinia()).use(TaoUI);

// Поднимаем пространство из автосохранения и включаем запись дальнейших правок.
const editor = useEditor();
editor.restoreSaved();
editor.startAutosave();

app.mount('#app');
