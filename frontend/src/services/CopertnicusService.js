import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default {
  // Obtener datasets disponibles
  async getDatasets() {
    try {
      const response = await apiClient.get('/datasets');
      return response.data;
    } catch (error) {
      console.error('Error obteniendo datasets:', error);
      throw error;
    }
  },

  // Obtener variables para un dataset
  async getVariables(datasetId) {
    try {
      const response = await apiClient.get(`/datasets/${datasetId}/variables`);
      return response.data;
    } catch (error) {
      console.error(`Error obteniendo variables para dataset ${datasetId}:`, error);
      throw error;
    }
  },

  // Obtener datos marinos filtrados
  async getMarineData(datasetId, variableId, params) {
    try {
      const response = await apiClient.get(`/datos-marinos`, {
        params: {
          dataset_id: datasetId,
          variable_id: variableId,
          fecha_inicio: params.startDate,
          fecha_fin: params.endDate,
          min_lon: params.minLon,
          max_lon: params.maxLon,
          min_lat: params.minLat,
          max_lat: params.maxLat,
          profundidad: params.depth
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error obteniendo datos marinos:', error);
      throw error;
    }
  },
  
  // Actualizar datos de Copernicus
  async updateCopertnicusData() {
    try {
      const response = await apiClient.post('/update-copernicus-data');
      return response.data;
    } catch (error) {
      console.error('Error actualizando datos de Copernicus:', error);
      throw error;
    }
  }
};