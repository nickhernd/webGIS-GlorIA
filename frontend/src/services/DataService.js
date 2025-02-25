import axios from 'axios';

// Constantes para las URLs de los datos
const API_BASE_URL = '/api';  // Ajustar según tu configuración de backend

class DataService {
  // Obtener lista de capas disponibles
  async getAvailableLayers() {
    try {
      // En un entorno real, esto vendría del backend
      return [
        {
          id: 'temperature',
          title: 'Temperatura del agua',
          variable: 'thetao',
          date: '2025-03-02',
          depth: '-0.5m',
          resolution: 'Global daily',
          min: 0,
          max: 30,
          unit: '°C',
          source: 'cmems_mod_med_phy-cur_anfc_4.2km_P1D-m'
        },
        {
          id: 'currents',
          title: 'Corrientes marinas',
          variable: 'uo-vo',
          date: '2025-03-02',
          depth: '-0.5m',
          resolution: 'Global daily',
          min: 0,
          max: 1.5,
          unit: 'm/s',
          source: 'cmems_mod_med_phy-cur_anfc_4.2km_P1D-m'
        },
        {
          id: 'nutrients',
          title: 'Nutrientes',
          variable: 'no3',
          date: '2025-03-02',
          depth: '-0.5m',
          resolution: 'Global daily',
          min: 0,
          max: 5,
          unit: 'mmol/m³',
          source: 'cmems_mod_med_bgc-nut_anfc_4.2km_P1D-m'
        }
      ];
    } catch (error) {
      console.error('Error al obtener capas disponibles:', error);
      return [];
    }
  }

  // Obtener datos GeoJSON para una capa específica
  async getLayerData(layerId, date, depth) {
    try {
      // En producción, esto sería una llamada real a la API
      // return await axios.get(`${API_BASE_URL}/layers/${layerId}?date=${date}&depth=${depth}`);
      
      // Para desarrollo, devolvemos datos simulados
      return this.getSimulatedData(layerId);
    } catch (error) {
      console.error(`Error al obtener datos para la capa ${layerId}:`, error);
      throw error;
    }
  }

  // Datos simulados para desarrollo
  getSimulatedData(layerId) {
    const valenciaCoast = {
      type: 'FeatureCollection',
      features: []
    };

    // Crear una grid de puntos en la costa valenciana
    for (let lon = -0.5; lon <= 1.0; lon += 0.1) {
      for (let lat = 38.0; lat <= 40.5; lat += 0.1) {
        // Solo incluir puntos que están en el "mar" (simplificado para demo)
        if (this.isInSea(lon, lat)) {
          let value;
          
          if (layerId === 'temperature') {
            // Valores de temperatura que varían según la localización
            value = 15 + Math.sin(lat * 10) * 3 + Math.cos(lon * 5) * 2;
          } else if (layerId === 'currents') {
            // Velocidad de corrientes
            value = 0.2 + Math.sin(lat * 8) * 0.15 + Math.cos(lon * 6) * 0.1;
          } else {
            // Nutrientes u otros
            value = 1 + Math.sin(lat * 12) * 0.8 + Math.cos(lon * 7) * 0.5;
          }

          valenciaCoast.features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [lon, lat]
            },
            properties: {
              value: value
            }
          });
        }
      }
    }

    return valenciaCoast;
  }

  // Función simplificada para determinar si un punto está en el "mar"
  isInSea(lon, lat) {
    // Simplificación: suponemos que puntos al este de cierta línea están en el mar
    // En un caso real, usaríamos polígonos o datos más precisos
    return true; // Para desarrollo, todos los puntos están "en el mar"
  }

  // Convertir fechas al formato requerido
  formatDate(date) {
    return new Date(date).toISOString().split('T')[0];
  }
}

export default new DataService();