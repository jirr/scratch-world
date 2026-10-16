import { mount } from 'svelte';
import App from './App.svelte';
import { initUpdateService } from './app/update-service.svelte';
import './ui/theme.css';

const target = document.getElementById('app');
if (!target) throw new Error('#app introuvable');

mount(App, { target });
initUpdateService();
