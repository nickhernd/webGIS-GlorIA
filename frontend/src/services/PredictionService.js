// frontend/src/services/PredictionService.js
import axios from 'axios';

// Configuración base para axios específica para predicciones
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_PREDICTION_API_URL || 'http://localhost:3000/api/predicciones',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 20000 // 20 segundos (las predicciones pueden tardar más)
});

export default {
  /**
   * Obtiene predicciones para una piscifactoría específica
   * @param {Number} idPiscifactoria - ID de la piscifactoría
   * @param {Object} parametros - Parámetros adicionales
   */
  getPrediccionesPorPiscifactoria(idPiscifactoria, parametros = {}) {
    return apiClient.get(`/piscifactoria/${idPiscifactoria}`, { params: parametros });
  },
  
  /**
   * Obtiene una predicción específica por su ID
   * @param {Number} idPrediccion - ID de la predicción
   */
  getPrediccion(idPrediccion) {
    return apiClient.get(`/${idPrediccion}`);
  },
  
  /**
   * Obtiene predicciones para una variable ambiental específica
   * @param {String} variable - Variable ambiental (temperatura, corrientes, etc.)
   * @param {Object} parametros - Parámetros adicionales
   */
  getPrediccionesPorVariable(variable, parametros = {}) {
    return apiClient.get(`/variable/${variable}`, { params: parametros });
  },
  
  /**
   * Obtiene predicciones para un rango de fechas
   * @param {Object} parametros - Parámetros de consulta
   * @param {String} parametros.fechaInicio - Fecha de inicio en formato YYYY-MM-DD
   * @param {String} parametros.fechaFin - Fecha de fin en formato YYYY-MM-DD
   */
  getPrediccionesPorRangoFechas(parametros) {
    return apiClient.get('/fecha', { params: parametros });
  },
  
  /**
   * Obtiene el nivel de riesgo actual para una piscifactoría
   * @param {Number} idPiscifactoria - ID de la piscifactoría
   */
  getNivelRiesgo(idPiscifactoria) {
    return apiClient.get(`/riesgo/${idPiscifactoria}`);
  },
  
  /**
   * Obtiene alertas basadas en predicciones
   * @param {Object} parametros - Parámetros de filtrado
   */
  getAlertas(parametros = {}) {
    return apiClient.get('/alertas', { params: parametros });
  },
  
  /**
   * Obtiene alertas para una piscifactoría específica
   * @param {Number} idPiscifactoria - ID de la piscifactoría
   */
  getAlertasPorPiscifactoria(idPiscifactoria) {
    return apiClient.get(`/alertas/piscifactoria/${idPiscifactoria}`);
  },
  
  /**
   * Genera una nueva predicción bajo demanda
   * @param {Object} datos - Datos para la predicción
   */
  generarPrediccion(datos) {
    return apiClient.post('/generar', datos);
  },
  
  /**
   * Evalúa la precisión de predicciones anteriores
   * @param {Object} parametros - Parámetros de evaluación
   */
  evaluarPrecision(parametros) {
    return apiClient.get('/evaluacion', { params: parametros });
  },
  
  /**
   * Obtiene tendencias históricas para una variable específica
   * @param {String} variable - Variable ambiental
   * @param {Object} parametros - Parámetros adicionales
   */
  getTendencias(variable, parametros = {}) {
    return apiClient.get(`/tendencias/${variable}`, { params: parametros });
  },
  
  /**
   * Obtiene umbrales de riesgo configurados para las variables
   */
  getUmbralesRiesgo() {
    return apiClient.get('/umbrales');
  },
  
  /**
   * Actualiza un umbral de riesgo para una variable específica
   * @param {String} variable - Variable ambiental
   * @param {Object} datos - Nuevos valores de umbral
   */
  actualizarUmbral(variable, datos) {
    return apiClient.put(`/umbrales/${variable}`, datos);
  }
};