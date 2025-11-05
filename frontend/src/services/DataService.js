import axios from 'axios';

// URL de la API - usar /api para que pase por el proxy de Vite
const API_URL = '/api';

/**
 * Servicio para gestionar datos de piscifactorías y variables ambientales
 */
export default {
  /**
   * Obtener todas las piscifactorías
   */
  async getPiscifactorias() {
    try {
      const response = await axios.get(`${API_URL}/piscifactorias`);
      return {
        data: response.data,
        status: response.status
      };
    } catch (error) {
      console.error('Error al obtener piscifactorías:', error);
      // Devolver array vacío si hay error para evitar errores en cascada
      return {
        data: [],
        status: error.response?.status || 500
      };
    }
  },

  /**
   * Obtener una piscifactoría por ID
   * @param {number} id - ID de la piscifactoría
   */
  async getPiscifactoria(id) {
    try {
      const response = await axios.get(`${API_URL}/piscifactorias/${id}`);
      
      // Transformar los indicadores ambientales al formato esperado por el frontend
      if (response.data && response.data.indicadoresAmbientales) {
        const indicadores = response.data.indicadoresAmbientales;
        
        // Construir el objeto stats en el formato que espera el frontend
        const stats = {};
        
        // Temperatura - Buscar variaciones de nombres
        const tempVars = ['temperatura', 'temperature', 'temp'];
        for (const varName of tempVars) {
          if (indicadores[varName]) {
            stats.temperature = {
              current: indicadores[varName].valor,
              min: indicadores[varName].umbralMin,
              max: indicadores[varName].umbralMax,
              avg: (indicadores[varName].umbralMin + indicadores[varName].umbralMax) / 2,
              trend: indicadores[varName].tendencia,
              status: indicadores[varName].estado
            };
            break;
          }
        }
        
        // Oxígeno disuelto - Buscar variaciones de nombres
        const oxyVars = ['oxigenoDisuelto', 'oxygen', 'o2'];
        for (const varName of oxyVars) {
          if (indicadores[varName]) {
            stats.oxygen = {
              current: indicadores[varName].valor,
              min: indicadores[varName].umbralMin,
              max: indicadores[varName].umbralMax,
              avg: (indicadores[varName].umbralMin + indicadores[varName].umbralMax) / 2,
              trend: indicadores[varName].tendencia,
              status: indicadores[varName].estado
            };
            break;
          }
        }
        
        // Corrientes - Buscar variaciones de nombres (uo, vo)
        const currentVars = ['corrientes', 'currents', 'uo', 'vo'];
        for (const varName of currentVars) {
          if (indicadores[varName]) {
            stats.currents = {
              current: indicadores[varName].valor,
              min: indicadores[varName].umbralMin,
              max: indicadores[varName].umbralMax,
              avg: (indicadores[varName].umbralMin + indicadores[varName].umbralMax) / 2,
              trend: indicadores[varName].tendencia,
              status: indicadores[varName].estado
            };
            break;
          }
        }
        
        // Salinidad
        if (indicadores.salinidad || indicadores.so) {
          const salinityData = indicadores.salinidad || indicadores.so;
          stats.salinity = {
            current: salinityData.valor,
            min: salinityData.umbralMin,
            max: salinityData.umbralMax,
            avg: (salinityData.umbralMin + salinityData.umbralMax) / 2,
            trend: salinityData.tendencia,
            status: salinityData.estado
          };
        }
        
        // Asignar stats al objeto de respuesta
        response.data.stats = stats;
      }
      
      return {
        data: response.data,
        status: response.status
      };
    } catch (error) {
      console.error(`Error al obtener piscifactoría ${id}:`, error);
      throw error;
    }
  },

  /**
   * Obtener las alertas activas
   * @param {number} farmId - ID de la piscifactoría (opcional)
   */
  async getAlertas(farmId = null) {
    try {
      let url = `${API_URL}/alertas`;
      if (farmId) {
        url = `${API_URL}/alertas/piscifactoria/${farmId}`;
      }
      
      const response = await axios.get(url);
      
      return {
        data: response.data,
        status: response.status
      };
    } catch (error) {
      console.error('Error al obtener alertas:', error);
      return {
        data: [],
        status: error.response?.status || 500
      };
    }
  },

  /**
   * Obtener datos ambientales
   * @param {Object} params - Parámetros de filtrado
   */
  async getDatosAmbientales(params = {}) {
    try {
      const { fecha, variable, piscifactoriaId } = params;

      let url = `${API_URL}/datos-ambientales?fecha=${fecha}&variable=${variable}`;
      if (piscifactoriaId) {
        url += `&piscifactoriaId=${piscifactoriaId}`;
      }

      console.log("Llamando a API para datos ambientales:", url);
      const response = await axios.get(url);

      if (response.data && response.data.datos && response.data.datos.length > 0) {
        console.log(`Recibidos ${response.data.datos.length} registros de ${variable}`);
        return {
          data: response.data,
          status: response.status
        };
      }
    } catch (error) {
      console.error('Error al obtener datos ambientales:', error);
    }
  },

  /**
   * Obtener datos históricos para una variable
   * @param {string} variable - Nombre de la variable
   * @param {Object} params - Parámetros de filtrado
   */
  async getDatosHistoricos(variable, params = {}) {
    try {
      const { periodo, piscifactoriaId, fechaInicio, fechaFin } = params;
      
      // Mapeo de variables para normalizar nombres
      const variableMap = {
        'temperatura': ['temperature', 'temp'],
        'temperature': ['temperatura', 'temp'],
        'temp': ['temperatura', 'temperature'],
        'oxygen': ['o2', 'oxigeno'],
        'o2': ['oxygen', 'oxigeno'],
        'corrientes': ['uo', 'vo', 'current'],
        'uo': ['vo', 'currents'],
        'vo': ['uo', 'currents'],
        'so': ['salinidad'],
        'salinidad': ['so']
      };
      
      // Variable original y alternativas
      const allVariables = [variable];
      if (variableMap[variable]) {
        allVariables.push(...variableMap[variable]);
      }
      
      // Intentar con cada variable hasta encontrar datos
      for (const v of allVariables) {
        let url = `${API_URL}/historico/${v}?periodo=${periodo || 'week'}`;
        
        if (piscifactoriaId) {
          url += `&piscifactoriaId=${piscifactoriaId}`;
        }
        
        if (fechaInicio) {
          url += `&fechaInicio=${fechaInicio}`;
        }
        
        if (fechaFin) {
          url += `&fechaFin=${fechaFin}`;
        }
        
        console.log("Intentando API con variable:", v, url);
        const response = await axios.get(url);
        
        // Si hay datos, devolverlos
        if (response.data.datos && response.data.datos.length > 0) {
          console.log(`Datos encontrados para variable ${v}:`, response.data.datos.length);
          return {
            data: response.data,
            status: response.status
          };
        }
      }
      
      // Si llegamos aquí, no se encontraron datos para ninguna variable
      console.log(`No se encontraron datos para la variable ${variable} ni sus alternativas`);
      return {
        data: { datos: [] },
        status: 200
      };
    } catch (error) {
      console.error(`Error al obtener datos históricos para ${variable}:`, error);
      return {
        data: { datos: [] },
        status: error.response?.status || 500
      };
    }
  },

  /**
   * Obtener predicciones para una piscifactoría
   * @param {number} farmId - ID de la piscifactoría
   */
  async getPredicciones(farmId) {
    try {
      const response = await axios.get(`${API_URL}/predicciones/piscifactoria/${farmId}`);
      
      return {
        data: response.data,
        status: response.status
      };
    } catch (error) {
      console.error(`Error al obtener predicciones para piscifactoría ${farmId}:`, error);
      return {
        data: [],
        status: error.response?.status || 500
      };
    }
  },

  /**
   * Obtener datos de predicción de riesgo para todas las piscifactorías o una específica
   * @param {Object} params - Parámetros opcionales (fecha, piscifactoriaId)
   * @returns {Promise} - Promesa con los datos de predicción
   */
  async getPrediccionRiesgo(params = {}) {
    try {
      // Construir la URL base
      let url = `${API_URL}/prediccion-riesgo`;
      
      // Añadir parámetros si existen
      if (params.fecha) {
        url += `?fecha=${params.fecha}`;
      }
      
      if (params.piscifactoriaId) {
        // Añadir & si ya hay un parámetro
        url += url.includes('?') ? '&' : '?';
        url += `piscifactoriaId=${params.piscifactoriaId}`;
      }
      
      console.log("Obteniendo datos de predicción de riesgo:", url);
      const response = await axios.get(url);
      
      return {
        data: response.data,
        status: response.status
      };
    } catch (error) {
      console.error('Error al obtener datos de predicción de riesgo:', error);
    }
  },

  /**
   * Obtener predicción de riesgo de escapes para una piscifactoría
   * @param {number} farmId - ID de la piscifactoría (opcional)
   * @returns {Promise} - Promesa con los datos de predicción de riesgo
   */
  async getRiesgoPrediccion(farmId = null) {
    try {
      let url = `${API_URL}/riesgo/prediccion`;
      if (farmId) {
        url = `${API_URL}/riesgo/prediccion/${farmId}`;
      }
      
      console.log("Obteniendo predicción de riesgo desde:", url);
      const response = await axios.get(url);
      
      return {
        data: response.data,
        status: response.status
      };
    } catch (error) {
      console.error('Error al obtener predicción de riesgo:', error);
    }
  },

  /**
   * Obtener datos de riesgo actual para todas las piscifactorías
   * @returns {Promise} - Promesa con los datos actuales de riesgo
   */
  async getRiesgoActual() {
    try {
      const response = await axios.get(`${API_URL}/riesgo/actual`);
      
      return {
        data: response.data,
        status: response.status
      };
    } catch (error) {
      console.error('Error al obtener datos de riesgo actual:', error);
    }
  },

  /**
   * Obtener el histórico de riesgo para una piscifactoría específica
   * @param {number} farmId - ID de la piscifactoría
   * @param {Object} params - Parámetros de filtrado (desde, hasta)
   * @returns {Promise} - Promesa con los datos históricos de riesgo
   */
  async getRiesgoHistorico(farmId, params = {}) {
    try {
      let url = `${API_URL}/riesgo/historico/${farmId}`;
      
      // Añadir parámetros de filtrado si existen
      if (params.desde || params.hasta) {
        url += '?';
        if (params.desde) url += `desde=${params.desde}`;
        if (params.desde && params.hasta) url += '&';
        if (params.hasta) url += `hasta=${params.hasta}`;
      }
      
      const response = await axios.get(url);
      
      return {
        data: response.data,
        status: response.status
      };
    } catch (error) {
      console.error('Error al obtener histórico de riesgo:', error);
    }
  },

  /**
   * Exportar datos para descarga
   * @param {Object} params - Parámetros del reporte
   */
  async exportarDatos(params = {}) {
    try {
      const response = await axios.get(`${API_URL}/exportar`, { params });
      
      return {
        data: response.data,
        status: response.status
      };
    } catch (error) {
      console.error('Error al exportar datos:', error);
      return {
        data: {
          success: false,
          message: 'Error al exportar datos',
          downloadUrl: null
        },
        status: error.response?.status || 500
      };
    }
  },

  /**
   * Obtener datos de riesgo de una piscifactoría
   * @param {number} piscifactoriaId - ID de la piscifactoría
   * @returns {Promise} - Promesa con los datos de riesgo
   */
  getRiskData(piscifactoriaId) {
    return axios.get(`${API_URL}/riesgo/escapes/${piscifactoriaId}`);
  },

  /**
   * Obtener predicciones de escape para una piscifactoría
   * @param {number} piscifactoriaId - ID de la piscifactoría
   * @returns {Promise} - Promesa con los datos de predicción de escape
   */
  getEscapePrediction(piscifactoriaId) {
    return axios.get(`${API_URL}/predicciones/escapes/${piscifactoriaId}`);
  },

  /**
   * Obtener historial de predicciones de escape para una piscifactoría
   * @param {number} piscifactoriaId - ID de la piscifactoría
   * @param {number} days - Número de días para el historial (por defecto 30)
   * @returns {Promise} - Promesa con los datos del historial de predicciones
   */
  getEscapePredictionHistory(piscifactoriaId, days = 30) {
    return axios.get(`${API_URL}/predicciones/escapes/${piscifactoriaId}/historial`, {
      params: { dias: days }
    });
  },

  /**
   * Obtener resumen de riesgos de todas las piscifactorías
   * @returns {Promise} - Promesa con el resumen de riesgos
   */
  getAllRiskSummary() {
    return axios.get(`${API_URL}/riesgo/resumen`);
  },

  /**
   * Obtener datos actuales de riesgo
   * @returns {Promise} - Promesa con los datos actuales de riesgo
   */
  getCurrentRisk() {
    return axios.get(`${API_URL}/riesgo/actual`);
  },

  /**
   * Obtener datos de oleaje desde archivo JSON
   * @returns {Promise} - Promesa con los datos de oleaje, estadísticas y metadatos
   */
  async getWaveData() {
    try {
      const response = await axios.get(`${API_URL}/oleaje/datos`);

      return {
        data: response.data.data,
        statistics: response.data.statistics,
        metadata: response.data.metadata,
        status: response.status
      };
    } catch (error) {
      console.error('Error al obtener datos de oleaje:', error);
      return {
        data: [],
        statistics: {},
        metadata: {},
        status: error.response?.status || 500
      };
    }
  },

  /**
   * Obtener datos de corrientes desde archivo JSON
   * @returns {Promise} - Promesa con los datos de corrientes, estadísticas y metadatos
   */
  async getCurrentData() {
    try {
      const response = await axios.get(`${API_URL}/corrientes/datos`);

      return {
        data: response.data.data,
        statistics: response.data.statistics,
        metadata: response.data.metadata,
        status: response.status
      };
    } catch (error) {
      console.error('Error al obtener datos de corrientes:', error);
      return {
        data: [],
        statistics: {},
        metadata: {},
        status: error.response?.status || 500
      };
    }
  },

  /**
   * Obtener datos de temperatura desde archivo JSON
   * @returns {Promise} - Promesa con los datos de temperatura, estadísticas y metadatos
   */
  async getTemperatureData() {
    try {
      const response = await axios.get(`${API_URL}/temperatura/datos`);

      return {
        data: response.data.data,
        statistics: response.data.statistics,
        metadata: response.data.metadata,
        status: response.status
      };
    } catch (error) {
      console.error('Error al obtener datos de temperatura:', error);
      return {
        data: [],
        statistics: {},
        metadata: {},
        status: error.response?.status || 500
      };
    }
  }
};

