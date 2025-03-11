import axios from 'axios';

// URL de la API
const API_URL = 'http://localhost:3000/api';

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
        
        // Temperatura
        if (indicadores.temperatura) {
          stats.temperature = {
            current: indicadores.temperatura.valor,
            min: indicadores.temperatura.umbralMin,
            max: indicadores.temperatura.umbralMax,
            avg: (indicadores.temperatura.umbralMin + indicadores.temperatura.umbralMax) / 2,
            trend: indicadores.temperatura.tendencia,
            status: indicadores.temperatura.estado
          };
        }
        
        // Oxígeno disuelto
        if (indicadores.oxigenoDisuelto) {
          stats.oxygen = {
            current: indicadores.oxigenoDisuelto.valor,
            min: indicadores.oxigenoDisuelto.umbralMin,
            max: indicadores.oxigenoDisuelto.umbralMax,
            avg: (indicadores.oxigenoDisuelto.umbralMin + indicadores.oxigenoDisuelto.umbralMax) / 2,
            trend: indicadores.oxigenoDisuelto.tendencia,
            status: indicadores.oxigenoDisuelto.estado
          };
        }
        
        // Salinidad
        if (indicadores.salinidad) {
          stats.salinity = {
            current: indicadores.salinidad.valor,
            min: indicadores.salinidad.umbralMin,
            max: indicadores.salinidad.umbralMax,
            avg: (indicadores.salinidad.umbralMin + indicadores.salinidad.umbralMax) / 2,
            trend: indicadores.salinidad.tendencia,
            status: indicadores.salinidad.estado
          };
        }
        
        // Corrientes
        if (indicadores.corrientes) {
          stats.currents = {
            current: indicadores.corrientes.valor,
            min: indicadores.corrientes.umbralMin,
            max: indicadores.corrientes.umbralMax,
            avg: (indicadores.corrientes.umbralMin + indicadores.corrientes.umbralMax) / 2,
            trend: indicadores.corrientes.tendencia,
            status: indicadores.corrientes.estado
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
      
      const response = await axios.get(url);
      
      return {
        data: response.data,
        status: response.status
      };
    } catch (error) {
      console.error('Error al obtener datos ambientales:', error);
      return {
        data: { datos: [] },
        status: error.response?.status || 500
      };
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
      
      let url = `${API_URL}/historico/${variable}?periodo=${periodo || 'week'}`;
      
      if (piscifactoriaId) {
        url += `&piscifactoriaId=${piscifactoriaId}`;
      }
      
      if (fechaInicio) {
        url += `&fechaInicio=${fechaInicio}`;
      }
      
      if (fechaFin) {
        url += `&fechaFin=${fechaFin}`;
      }
      
      console.log("Llamando a API:", url);
      const response = await axios.get(url);
      console.log("Respuesta recibida:", response.data);
      
      return {
        data: response.data,
        status: response.status
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
  }
};