// frontend/src/services/DataService.js
import axios from 'axios';

// Configuración base para axios
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 10000 // 10 segundos
});

// Interceptor para manejar errores globalmente
apiClient.interceptors.response.use(
  response => response,
  error => {
    console.error('Error en petición API:', error);
    
    // Podemos manejar diferentes tipos de errores aquí
    if (error.response) {
      // El servidor respondió con un código de estado fuera del rango 2xx
      console.error('Error de respuesta:', error.response.status, error.response.data);
    } else if (error.request) {
      // La petición fue realizada pero no se recibió respuesta
      console.error('Error de solicitud (sin respuesta):', error.request);
    } else {
      // Ocurrió un error al configurar la petición
      console.error('Error de configuración:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default {
  // Métodos para piscifactorías
  getPiscifactorias() {
    return apiClient.get('/piscifactorias');
  },
  
  getPiscifactoria(id) {
    return apiClient.get(`/piscifactorias/${id}`);
  },
  
  // Métodos para datos ambientales
  getDatosAmbientales(parametros) {
    return apiClient.get('/datos-ambientales', { params: parametros });
  },
  
  getDatosAmbientalesPorFecha(fecha, variable) {
    return apiClient.get('/datos-ambientales/fecha', { 
      params: { 
        fecha: fecha, 
        variable: variable 
      } 
    });
  },
  
  getDatosAmbientalesPorPiscifactoria(idPiscifactoria, parametros) {
    return apiClient.get(`/datos-ambientales/piscifactoria/${idPiscifactoria}`, {
      params: parametros
    });
  },
  
  // Métodos para alertas
  getAlertas() {
    return apiClient.get('/alertas');
  },
  
  getAlertasPorPiscifactoria(idPiscifactoria) {
    return apiClient.get(`/alertas/piscifactoria/${idPiscifactoria}`);
  },
  
  marcarAlertaComoResuelta(idAlerta, datos) {
    return apiClient.put(`/alertas/${idAlerta}/resolver`, datos);
  },
  
  // Métodos para exportación de datos
  exportarDatos(parametros) {
    return apiClient.get('/exportar', { 
      params: parametros,
      responseType: 'blob' // Importante para descargar archivos
    });
  },
  
  // Método genérico para cualquier endpoint de la API
  get(endpoint, parametros = {}) {
    return apiClient.get(endpoint, { params: parametros });
  },
  
  post(endpoint, datos = {}) {
    return apiClient.post(endpoint, datos);
  },
  
  put(endpoint, datos = {}) {
    return apiClient.put(endpoint, datos);
  },
  
  delete(endpoint) {
    return apiClient.delete(endpoint);
  }
};