// src/main.js
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './assets/main.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

const app = createApp(App);
app.use(router);
app.mount('#app');