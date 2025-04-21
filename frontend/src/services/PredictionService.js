import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

class PredictionService {
  /**
   * Obtener predicción de escape para una piscifactoría específica
   * @param {Number} piscifactoriaId - ID de la piscifactoría
   * @returns {Promise} - Promesa con los datos de predicción
   */
  getEscapePrediction(piscifactoriaId) {
    return axios.get(`${API_URL}/predicciones/escapes/${piscifactoriaId}`);
  }

  /**
   * Obtener historial de predicciones de escape
   * @param {Number} piscifactoriaId - ID de la piscifactoría
   * @param {Number} days - Número de días para el historial (por defecto 30)
   * @returns {Promise} - Promesa con los datos del historial
   */
  getEscapePredictionHistory(piscifactoriaId, days = 30) {
    return axios.get(`${API_URL}/predicciones/escapes/${piscifactoriaId}/historial`, {
      params: { dias: days }
    });
  }

  /**
   * Obtener resumen de riesgo de todas las piscifactorías
   * @returns {Promise} - Promesa con el resumen de riesgos
   */
  getRiskSummary() {
    return axios.get(`${API_URL}/riesgo/resumen`);
  }

  /**
   * Obtener nivel de riesgo actual
   * @returns {Promise} - Promesa con los datos de riesgo actual
   */
  getCurrentRisk() {
    return axios.get(`${API_URL}/riesgo/actual`);
  }

  /**
   * Obtener predicción de riesgo para una piscifactoría específica
   * @param {Number} piscifactoriaId - ID de la piscifactoría
   * @returns {Promise} - Promesa con los datos de predicción de riesgo
   */
  getRiskPrediction(piscifactoriaId) {
    return axios.get(`${API_URL}/riesgo/prediccion/${piscifactoriaId}`);
  }
}

export default new PredictionService();