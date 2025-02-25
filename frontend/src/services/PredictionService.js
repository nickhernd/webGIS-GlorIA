import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default {
  // Obtener predicciones de riesgo
  async getPredictions(params) {
    try {
      const response = await apiClient.get('/predictions', { params });
      return response.data;
    } catch (error) {
      console.error('Error obteniendo predicciones:', error);
      throw error;
    }
  },
  
  // Para desarrollo, generamos predicciones simuladas
  getSimulatedPredictions() {
    // Ubicaciones de piscifactorías en la Comunidad Valenciana
    const farms = [
      { id: 1, name: 'Piscifactoría Sagunto', lat: 39.6766, lon: -0.2026 },
      { id: 2, name: 'Piscifactoría Burriana', lat: 39.8573, lon: 0.0522 },
      { id: 3, name: 'Piscifactoría Calpe', lat: 38.6333, lon: 0.0714 },
      { id: 4, name: 'Piscifactoría Guardamar', lat: 38.1063, lon: -0.6408 }
    ];
    
    // Generar riesgos simulados
    return farms.map(farm => {
      // Simular nivel de riesgo basado en un valor aleatorio
      const riskValue = Math.random();
      let riskLevel;
      
      if (riskValue < 0.6) {
        riskLevel = 'low';
      } else if (riskValue < 0.85) {
        riskLevel = 'medium';
      } else {
        riskLevel = 'high';
      }
      
      return {
        ...farm,
        risk: riskLevel,
        riskValue: riskValue,
        factors: {
          waterTemperature: 15 + Math.random() * 10,
          currentSpeed: 0.2 + Math.random() * 0.8,
          windSpeed: 5 + Math.random() * 15,
          waveHeight: 0.5 + Math.random() * 2
        }
      };
    });
  }
};