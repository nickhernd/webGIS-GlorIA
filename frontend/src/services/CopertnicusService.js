import axios from 'axios';

// Configuración base para axios específica para Copernicus
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_COPERNICUS_API_URL || 'http://localhost:3000/api/copernicus',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 30000 // 30 segundos (las peticiones a Copernicus pueden tardar más)
});

export default {
  /**
   * Obtiene datos oceanográficos de Copernicus Marine Service
   * @param {Object} parametros - Parámetros de consulta
   * @param {String} parametros.fecha - Fecha en formato YYYY-MM-DD
   * @param {String} parametros.variable - Variable a consultar (temperatura, salinidad, corrientes, etc.)
   * @param {Number} parametros.latMin - Latitud mínima del área
   * @param {Number} parametros.latMax - Latitud máxima del área
   * @param {Number} parametros.lonMin - Longitud mínima del área
   * @param {Number} parametros.lonMax - Longitud máxima del área
   */
  getDatosOceanograficos(parametros) {
    return apiClient.get('/marine', { params: parametros });
  },
  
  /**
   * Obtiene datos de temperatura superficial del mar
   * @param {Object} parametros - Parámetros de consulta
   */
  getTemperaturaSuperficial(parametros) {
    return apiClient.get('/marine/temperatura', { params: parametros });
  },
  
  /**
   * Obtiene datos de salinidad del mar
   * @param {Object} parametros - Parámetros de consulta
   */
  getSalinidad(parametros) {
    return apiClient.get('/marine/salinidad', { params: parametros });
  },
  
  /**
   * Obtiene datos de corrientes marinas
   * @param {Object} parametros - Parámetros de consulta
   */
  getCorrientes(parametros) {
    return apiClient.get('/marine/corrientes', { params: parametros });
  },
  
  /**
   * Obtiene datos de oxígeno disuelto
   * @param {Object} parametros - Parámetros de consulta
   */
  getOxigenoDisuelto(parametros) {
    return apiClient.get('/marine/oxigeno', { params: parametros });
  },
  
  /**
   * Obtiene datos de clorofila
   * @param {Object} parametros - Parámetros de consulta
   */
  getClorofila(parametros) {
    return apiClient.get('/marine/clorofila', { params: parametros });
  },
  
  /**
   * Obtiene datos históricos para una variable específica
   * @param {String} variable - Variable a consultar
   * @param {Object} parametros - Parámetros adicionales
   */
  getDatosHistoricos(variable, parametros) {
    return apiClient.get(`/marine/historico/${variable}`, { params: parametros });
  },
  
  /**
   * Descarga un subconjunto de datos de Copernicus en formato NetCDF
   * @param {Object} parametros - Parámetros de consulta
   */
  descargarNetCDF(parametros) {
    return apiClient.get('/marine/descargar', { 
      params: parametros,
      responseType: 'blob' // Importante para descargar archivos
    });
  },
  
  /**
   * Verifica el estado del servicio Copernicus
   */
  verificarEstadoServicio() {
    return apiClient.get('/estado');
  },
  
  /**
   * Obtiene metadatos de un conjunto de datos específico
   * @param {String} dataset - ID del conjunto de datos
   */
  getMetadatos(dataset) {
    return apiClient.get(`/metadatos/${dataset}`);
  }
};