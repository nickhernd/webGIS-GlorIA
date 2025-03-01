// src/services/DataService.js
/**
 * Servicio para gestionar datos de piscifactorías y variables ambientales
 */

// Datos estáticos para la demostración
const FARMS_DATA = [
  {
    id: 1,
    name: "Centro de Investigación Piscícola de El Palmar",
    location: "El Palmar, Valencia",
    coordinates: [39.4167, -0.3333],
    type: "Investigación",
    species: ["especies dulceacuícolas amenazadas"],
    description: "Gestionado por VAERSA, enfocado en conservación mediante programas de producción y cría en cautividad.",
    stats: {
      temperature: {
        current: 22.4,
        min: 21.2,
        max: 23.8,
        avg: 22.6,
        trend: "up",
        status: "normal"
      },
      oxygen: {
        current: 5.8,
        min: 5.2,
        max: 6.5,
        avg: 5.9,
        trend: "down",
        status: "warning"
      },
      salinity: {
        current: 36.2,
        min: 35.8,
        max: 36.7,
        avg: 36.3,
        trend: "stable",
        status: "normal"
      },
      currents: {
        current: 0.35,
        min: 0.12,
        max: 0.58,
        avg: 0.34,
        trend: "up",
        status: "normal"
      },
      nutrientes: {
        current: 0.42,
        min: 0.38,
        max: 0.55,
        avg: 0.44,
        trend: "down",
        status: "normal"
      }
    },
    alerts: [
      {
        title: "Nivel de oxígeno bajo",
        message: "El nivel de oxígeno está por debajo del umbral óptimo",
        level: "media",
        time: "Hace 35 minutos"
      }
    ],
    infrastructure: {
      status: "good",
      nextMaintenance: "15/03/2025",
      components: [
        {
          name: "Sistema de Jaulas",
          status: "good",
          lastCheck: "15/02/2025",
          nextCheck: "15/03/2025",
          statusText: "Óptimo"
        },
        {
          name: "Sistema de Alimentación",
          status: "warning",
          lastCheck: "20/02/2025",
          nextCheck: "10/03/2025",
          statusText: "Requiere revisión"
        },
        {
          name: "Sistema de Monitorización",
          status: "good",
          lastCheck: "22/02/2025",
          nextCheck: "22/03/2025",
          statusText: "Óptimo"
        }
      ]
    }
  },
  {
    id: 2,
    name: "Centro de Cultivo de Peces de Tuéjar",
    location: "Tuéjar, Valencia",
    coordinates: [39.8833, -1.0167],
    type: "Producción",
    species: ["trucha arcoíris", "madrilla del Turia"],
    description: "Especializado en trucha arcoíris y madrilla del Turia, con planes para otras especies.",
    stats: {
      temperature: {
        current: 19.8,
        min: 18.5,
        max: 21.2,
        avg: 19.6,
        trend: "stable",
        status: "normal"
      },
      oxygen: {
        current: 6.7,
        min: 6.4,
        max: 7.2,
        avg: 6.8,
        trend: "up",
        status: "normal"
      },
      salinity: {
        current: 0.2,
        min: 0.1,
        max: 0.3,
        avg: 0.2,
        trend: "stable",
        status: "normal"
      },
      currents: {
        current: 0.42,
        min: 0.28,
        max: 0.65,
        avg: 0.44,
        trend: "down",
        status: "normal"
      },
      nutrientes: {
        current: 0.35,
        min: 0.28,
        max: 0.48,
        avg: 0.36,
        trend: "stable",
        status: "normal"
      }
    },
    alerts: [],
    infrastructure: {
      status: "warning",
      nextMaintenance: "05/03/2025",
      components: [
        {
          name: "Sistema de Jaulas",
          status: "warning",
          lastCheck: "10/02/2025",
          nextCheck: "10/03/2025",
          statusText: "Requiere revisión"
        },
        {
          name: "Sistema de Alimentación",
          status: "good",
          lastCheck: "12/02/2025",
          nextCheck: "12/03/2025",
          statusText: "Óptimo"
        },
        {
          name: "Sistema de Monitorización",
          status: "good",
          lastCheck: "15/02/2025",
          nextCheck: "15/03/2025",
          statusText: "Óptimo"
        }
      ]
    }
  },
  {
    id: 3,
    name: "Centro de Cultivo de Peces de Aguas Templadas",
    location: "Polinyà del Xúquer, Valencia",
    coordinates: [39.1833, -0.4167],
    type: "Reproducción y Engorde",
    species: ["anguila", "fartet"],
    description: "Dedicado a reproducción y engorde de diversas especies, incluyendo anguila y fartet.",
    stats: {
      temperature: {
        current: 23.1,
        min: 21.8,
        max: 24.5,
        avg: 23.0,
        trend: "up",
        status: "normal"
      },
      oxygen: {
        current: 5.4,
        min: 5.1,
        max: 6.0,
        avg: 5.5,
        trend: "stable",
        status: "warning"
      },
      salinity: {
        current: 12.5,
        min: 11.8,
        max: 13.2,
        avg: 12.4,
        trend: "up",
        status: "normal"
      },
      currents: {
        current: 0.28,
        min: 0.15,
        max: 0.45,
        avg: 0.29,
        trend: "down",
        status: "normal"
      },
      nutrientes: {
        current: 0.55,
        min: 0.48,
        max: 0.68,
        avg: 0.57,
        trend: "up",
        status: "warning"
      }
    },
    alerts: [
      {
        title: "Nivel de oxígeno bajo",
        message: "El nivel de oxígeno está por debajo del umbral óptimo",
        level: "media",
        time: "Hace 1 hora"
      },
      {
        title: "Mantenimiento programado",
        message: "Revisión de sistemas de aireación programada para mañana",
        level: "baja",
        time: "Hace 5 horas"
      }
    ],
    infrastructure: {
      status: "good",
      nextMaintenance: "20/03/2025",
      components: [
        {
          name: "Sistema de Jaulas",
          status: "good",
          lastCheck: "18/02/2025",
          nextCheck: "18/03/2025",
          statusText: "Óptimo"
        },
        {
          name: "Sistema de Alimentación",
          status: "good",
          lastCheck: "19/02/2025",
          nextCheck: "19/03/2025",
          statusText: "Óptimo"
        },
        {
          name: "Sistema de Monitorización",
          status: "good",
          lastCheck: "20/02/2025",
          nextCheck: "20/03/2025",
          statusText: "Óptimo"
        }
      ]
    }
  },
  {
    id: 4,
    name: "Polígono de Acuicultura de San Pedro del Pinatar",
    location: "San Pedro del Pinatar, Murcia",
    coordinates: [37.8667, -0.7833],
    type: "Producción Comercial",
    species: ["dorada", "lubina"],
    description: "El polígono de acuicultura más grande de la Región de Murcia.",
    stats: {
      temperature: {
        current: 22.8,
        min: 21.5,
        max: 24.0,
        avg: 22.7,
        trend: "stable",
        status: "normal"
      },
      oxygen: {
        current: 6.2,
        min: 5.9,
        max: 6.8,
        avg: 6.3,
        trend: "up",
        status: "normal"
      },
      salinity: {
        current: 37.5,
        min: 37.0,
        max: 38.1,
        avg: 37.6,
        trend: "stable",
        status: "warning"
      },
      currents: {
        current: 0.48,
        min: 0.32,
        max: 0.75,
        avg: 0.49,
        trend: "up",
        status: "warning"
      },
      nutrientes: {
        current: 0.38,
        min: 0.32,
        max: 0.45,
        avg: 0.39,
        trend: "stable",
        status: "normal"
      }
    },
    alerts: [
      {
        title: "Corrientes fuertes",
        message: "Se prevén corrientes por encima del umbral recomendado",
        level: "alta",
        time: "Hace 2 horas"
      },
      {
        title: "Salinidad elevada",
        message: "La salinidad se está acercando al límite superior recomendado",
        level: "media",
        time: "Hace 4 horas"
      }
    ],
    infrastructure: {
      status: "good",
      nextMaintenance: "12/03/2025",
      components: [
        {
          name: "Sistema de Jaulas",
          status: "good",
          lastCheck: "15/02/2025",
          nextCheck: "15/03/2025",
          statusText: "Óptimo"
        },
        {
          name: "Sistema de Alimentación",
          status: "good",
          lastCheck: "14/02/2025",
          nextCheck: "14/03/2025",
          statusText: "Óptimo"
        },
        {
          name: "Sistema de Monitorización",
          status: "good",
          lastCheck: "16/02/2025",
          nextCheck: "16/03/2025",
          statusText: "Óptimo"
        }
      ]
    }
  },
  {
    id: 5,
    name: "Piscifactorías de Mazarrón",
    location: "Mazarrón, Murcia",
    coordinates: [37.5667, -1.6000],
    type: "Producción Comercial",
    species: ["dorada", "lubina"],
    description: "Instalaciones dedicadas al cultivo de dorada y lubina.",
    stats: {
      temperature: {
        current: 23.5,
        min: 22.2,
        max: 24.8,
        avg: 23.4,
        trend: "up",
        status: "normal"
      },
      oxygen: {
        current: 5.9,
        min: 5.6,
        max: 6.4,
        avg: 6.0,
        trend: "stable",
        status: "normal"
      },
      salinity: {
        current: 37.2,
        min: 36.5,
        max: 37.9,
        avg: 37.1,
        trend: "up",
        status: "normal"
      },
      currents: {
        current: 0.52,
        min: 0.38,
        max: 0.75,
        avg: 0.54,
        trend: "down",
        status: "warning"
      },
      nutrientes: {
        current: 0.42,
        min: 0.36,
        max: 0.58,
        avg: 0.43,
        trend: "up",
        status: "normal"
      }
    },
    alerts: [
      {
        title: "Corrientes fuertes",
        message: "Se prevén corrientes por encima del umbral recomendado",
        level: "media",
        time: "Hace 3 horas"
      }
    ],
    infrastructure: {
      status: "danger",
      nextMaintenance: "01/03/2025",
      components: [
        {
          name: "Sistema de Jaulas",
          status: "good",
          lastCheck: "20/02/2025",
          nextCheck: "20/03/2025",
          statusText: "Óptimo"
        },
        {
          name: "Sistema de Alimentación",
          status: "danger",
          lastCheck: "01/02/2025",
          nextCheck: "01/03/2025",
          statusText: "Requiere mantenimiento urgente"
        },
        {
          name: "Sistema de Monitorización",
          status: "warning",
          lastCheck: "05/02/2025",
          nextCheck: "05/03/2025",
          statusText: "Requiere revisión"
        }
      ]
    }
  }
];

// Alertas globales
const GLOBAL_ALERTS = [
  {
    title: "Corrientes fuertes",
    message: "Se prevén corrientes por encima del umbral recomendado en la zona de Murcia",
    level: "alta",
    time: "Hace 2 horas",
    affectedFarms: [4, 5]
  },
  {
    title: "Nivel de oxígeno bajo",
    message: "El nivel de oxígeno está por debajo del umbral óptimo en varias instalaciones",
    level: "media",
    time: "Hace 1 hora",
    affectedFarms: [1, 3]
  },
  {
    title: "Mantenimiento programado",
    message: "Revisión de sistemas programada para el próximo fin de semana",
    level: "baja",
    time: "Hace 5 horas",
    affectedFarms: [2, 3, 5]
  }
];

// Datos ambientales simulados
const ENVIRONMENTAL_DATA = {
  temperature: {
    min: 18.5,
    max: 24.8,
    avg: 22.1,
    trend: "stable"
  },
  oxygen: {
    min: 5.1,
    max: 7.2,
    avg: 6.0,
    trend: "stable"
  },
  salinity: {
    min: 0.1,
    max: 38.1,
    avg: 24.8,
    trend: "up"
  },
  currents: {
    min: 0.12,
    max: 0.75,
    avg: 0.42,
    trend: "up"
  },
  nutrientes: {
    min: 0.28,
    max: 0.68,
    avg: 0.44,
    trend: "stable"
  }
};

/**
 * Servicio para acceder a los datos de piscifactorías y variables ambientales
 */
export default {
  /**
   * Obtener todas las piscifactorías
   */
  getPiscifactorias() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          data: FARMS_DATA,
          status: 200
        });
      }, 500);
    });
  },

  /**
   * Obtener una piscifactoría por ID
   * @param {number} id - ID de la piscifactoría
   */
  getPiscifactoria(id) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const farm = FARMS_DATA.find(f => f.id === parseInt(id));
        if (farm) {
          resolve({
            data: farm,
            status: 200
          });
        } else {
          reject({
            error: 'Piscifactoría no encontrada',
            status: 404
          });
        }
      }, 300);
    });
  },

  /**
   * Obtener las alertas activas
   * @param {number} farmId - ID de la piscifactoría (opcional)
   */
  getAlertas(farmId = null) {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (farmId) {
          const farm = FARMS_DATA.find(f => f.id === parseInt(farmId));
          if (farm) {
            resolve({
              data: farm.alerts,
              status: 200
            });
          } else {
            resolve({
              data: [],
              status: 200
            });
          }
        } else {
          resolve({
            data: GLOBAL_ALERTS,
            status: 200
          });
        }
      }, 300);
    });
  },

  /**
   * Obtener datos ambientales
   * @param {Object} params - Parámetros de filtrado
   */
  getDatosAmbientales(params = {}) {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Filtrar por fecha y variable
        const { fecha, variable, piscifactoriaId } = params;
        let result = [];

        if (piscifactoriaId) {
          const farm = FARMS_DATA.find(f => f.id === parseInt(piscifactoriaId));
          if (farm && farm.stats[variable]) {
            result = [{
              variable,
              fecha: fecha || new Date().toISOString(),
              valor: farm.stats[variable].current,
              tendencia: farm.stats[variable].trend,
              min: farm.stats[variable].min,
              max: farm.stats[variable].max,
              avg: farm.stats[variable].avg
            }];
          }
        } else {
          // Datos globales
          if (ENVIRONMENTAL_DATA[variable]) {
            result = [{
              variable,
              fecha: fecha || new Date().toISOString(),
              valor: ENVIRONMENTAL_DATA[variable].avg,
              tendencia: ENVIRONMENTAL_DATA[variable].trend,
              min: ENVIRONMENTAL_DATA[variable].min,
              max: ENVIRONMENTAL_DATA[variable].max,
              avg: ENVIRONMENTAL_DATA[variable].avg
            }];
          }
        }

        resolve({
          data: result,
          status: 200
        });
      }, 700);
    });
  },

  /**
   * Exportar datos para descarga
   * @param {Object} params - Parámetros del reporte
   */
  exportarDatos(params = {}) {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simular una operación de exportación
        console.log('Exportando datos con parámetros:', params);
        
        resolve({
          data: {
            success: true,
            message: 'Datos exportados correctamente',
            downloadUrl: '#'
          },
          status: 200
        });
      }, 1500);
    });
  },

  /**
   * Obtener datos del estado de la infraestructura
   * @param {number} farmId - ID de la piscifactoría
   */
  getInfrastructureStatus(farmId) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const farm = FARMS_DATA.find(f => f.id === parseInt(farmId));
        if (farm) {
          resolve({
            data: farm.infrastructure,
            status: 200
          });
        } else {
          reject({
            error: 'Piscifactoría no encontrada',
            status: 404
          });
        }
      }, 300);
    });
  }
};