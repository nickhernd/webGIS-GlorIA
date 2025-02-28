// frontend/src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import 'leaflet/dist/leaflet.css'
import './assets/main.css'

// Configuración global
const app = createApp(App)

// Registrar el router
app.use(router)

// Directiva personalizada para hacer clic fuera de un elemento
app.directive('click-outside', {
  beforeMount(el, binding) {
    el.clickOutsideEvent = function(event) {
      // Comprobar si el clic fue fuera del elemento
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event);
      }
    };
    document.addEventListener('click', el.clickOutsideEvent);
  },
  unmounted(el) {
    document.removeEventListener('click', el.clickOutsideEvent);
  }
});

// Filtro para formatear fechas
app.config.globalProperties.$filters = {
  formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  },
  
  formatNumber(value, decimals = 2) {
    if (value === null || value === undefined) return '';
    return Number(value).toFixed(decimals);
  }
};

// Montaje de la aplicación
app.mount('#app');

// Gestión de errores global
app.config.errorHandler = (err, vm, info) => {
  console.error('Error global:', err);
  console.error('Info:', info);
  
  // implementar un sistema de notificación de errores
  // o enviar el error a un servicio de monitorización
};