/**
 * @fileoverview Servicio de generación de datos simulados para demo
 * @description Genera datos aleatorios realistas cuando la base de datos no está disponible
 * @module mockDataService
 */

/**
 * Genera datos históricos de temperatura para una piscifactoría
 * @param {number} piscifactoriaId - ID de la piscifactoría
 * @param {Date} fechaInicio - Fecha de inicio del rango
 * @param {Date} fechaFin - Fecha de fin del rango
 * @returns {Array} Array de objetos con fecha y valor
 */
export function generarDatosTemperatura(piscifactoriaId, fechaInicio, fechaFin) {
  const datos = [];
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);

  // Cada piscifactoría tiene características únicas de temperatura
  const caracteristicas = {
    1: { base: 20, amplitud: 2.5, estabilidad: 0.8 },  // Guardamar - más estable
    2: { base: 19, amplitud: 3.0, estabilidad: 0.6 },  // San Pedro - más variable
    3: { base: 21, amplitud: 2.0, estabilidad: 0.9 },  // Cullera - muy estable y cálida
    4: { base: 18, amplitud: 3.5, estabilidad: 0.5 }   // Águilas - más fría y variable
  };

  const config = caracteristicas[piscifactoriaId] || caracteristicas[1];
  let temperaturaBase = config.base;

  // Generar datos cada 3 horas
  for (let fecha = new Date(inicio); fecha <= fin; fecha.setHours(fecha.getHours() + 3)) {
    // Variación diurna (más calor al mediodía)
    const hora = fecha.getHours();
    const variacionDiurna = Math.sin((hora - 6) / 24 * Math.PI * 2) * config.amplitud;

    // Variación aleatoria según estabilidad de la piscifactoría
    const ruido = (Math.random() - 0.5) * (1 - config.estabilidad);

    // Tendencia lenta (cambio gradual de temperatura base)
    temperaturaBase += (Math.random() - 0.5) * 0.1 * (1 - config.estabilidad);
    temperaturaBase = Math.max(config.base - 3, Math.min(config.base + 3, temperaturaBase));

    const temperatura = temperaturaBase + variacionDiurna + ruido;

    datos.push({
      fecha: new Date(fecha).toISOString(),
      valor: parseFloat(temperatura.toFixed(2))
    });
  }

  return datos;
}

/**
 * Genera datos históricos de corrientes para una piscifactoría
 * @param {number} piscifactoriaId - ID de la piscifactoría
 * @param {Date} fechaInicio - Fecha de inicio del rango
 * @param {Date} fechaFin - Fecha de fin del rango
 * @returns {Array} Array de objetos con fecha y valor
 */
export function generarDatosCorrientes(piscifactoriaId, fechaInicio, fechaFin) {
  const datos = [];
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);

  // Cada piscifactoría tiene características únicas de corrientes
  const caracteristicas = {
    1: { base: 0.35, intensidadMareas: 0.20, variabilidad: 0.08 },  // Guardamar - corrientes moderadas
    2: { base: 0.50, intensidadMareas: 0.30, variabilidad: 0.15 },  // San Pedro - corrientes más fuertes
    3: { base: 0.25, intensidadMareas: 0.15, variabilidad: 0.05 },  // Cullera - corrientes suaves
    4: { base: 0.60, intensidadMareas: 0.35, variabilidad: 0.20 }   // Águilas - corrientes muy fuertes
  };

  const config = caracteristicas[piscifactoriaId] || caracteristicas[1];
  let velocidadBase = config.base;

  // Generar datos cada 3 horas
  for (let fecha = new Date(inicio); fecha <= fin; fecha.setHours(fecha.getHours() + 3)) {
    // Variación según hora del día (mareas)
    const hora = fecha.getHours();
    const variacionMareas = Math.sin(hora / 12 * Math.PI * 2) * config.intensidadMareas;

    // Variación aleatoria según características de la ubicación
    const ruido = (Math.random() - 0.5) * config.variabilidad;

    // Tendencia lenta
    velocidadBase += (Math.random() - 0.5) * 0.02;
    velocidadBase = Math.max(config.base * 0.5, Math.min(config.base * 1.5, velocidadBase));

    const velocidad = Math.max(0, velocidadBase + variacionMareas + ruido);

    datos.push({
      fecha: new Date(fecha).toISOString(),
      valor: parseFloat(velocidad.toFixed(3))
    });
  }

  return datos;
}

/**
 * Genera datos históricos de profundidad para una piscifactoría
 * @param {number} piscifactoriaId - ID de la piscifactoría
 * @param {Date} fechaInicio - Fecha de inicio del rango
 * @param {Date} fechaFin - Fecha de fin del rango
 * @returns {Array} Array de objetos con fecha y valor
 */
export function generarDatosProfundidad(piscifactoriaId, fechaInicio, fechaFin) {
  const datos = [];
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);

  // Cada piscifactoría tiene profundidades características según su ubicación
  const caracteristicas = {
    1: { base: 15, variacion: 2.5, estabilidad: 0.85 },  // Guardamar - profundidad media, estable
    2: { base: 12, variacion: 3.0, estabilidad: 0.75 },  // San Pedro - menor profundidad, más variable (Mar Menor)
    3: { base: 20, variacion: 3.5, estabilidad: 0.80 },  // Cullera - mayor profundidad, moderadamente estable
    4: { base: 18, variacion: 4.0, estabilidad: 0.70 }   // Águilas - profundidad alta, más variable (zona expuesta)
  };

  const config = caracteristicas[piscifactoriaId] || caracteristicas[1];
  let profundidadBase = config.base;

  // Generar datos cada 6 horas (las mareas afectan la profundidad efectiva)
  for (let fecha = new Date(inicio); fecha <= fin; fecha.setHours(fecha.getHours() + 6)) {
    // Variación por mareas (ciclo de ~12 horas)
    const hora = fecha.getHours();
    const variacionMareas = Math.sin(hora / 12 * Math.PI * 2) * config.variacion;

    // Variación aleatoria por oleaje
    const ruido = (Math.random() - 0.5) * (1 - config.estabilidad) * 1.5;

    // Pequeña tendencia estacional
    profundidadBase += (Math.random() - 0.5) * 0.05 * (1 - config.estabilidad);
    profundidadBase = Math.max(config.base - 2, Math.min(config.base + 2, profundidadBase));

    const profundidad = profundidadBase + variacionMareas + ruido;

    datos.push({
      fecha: new Date(fecha).toISOString(),
      valor: parseFloat(profundidad.toFixed(2))
    });
  }

  return datos;
}

/**
 * Genera datos históricos de salinidad para una piscifactoría
 * @param {number} piscifactoriaId - ID de la piscifactoría
 * @param {Date} fechaInicio - Fecha de inicio del rango
 * @param {Date} fechaFin - Fecha de fin del rango
 * @returns {Array} Array de objetos con fecha y valor
 */
export function generarDatosSalinidad(piscifactoriaId, fechaInicio, fechaFin) {
  const datos = [];
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);

  // Cada piscifactoría tiene niveles de salinidad característicos
  const caracteristicas = {
    1: { base: 36.5, amplitud: 1.2, estabilidad: 0.80 },  // Guardamar - salinidad normal mediterránea
    2: { base: 38.0, amplitud: 2.5, estabilidad: 0.60 },  // San Pedro - mayor salinidad (Mar Menor)
    3: { base: 36.0, amplitud: 1.0, estabilidad: 0.85 },  // Cullera - muy estable, influencia río
    4: { base: 37.0, amplitud: 1.8, estabilidad: 0.70 }   // Águilas - salinidad variable
  };

  const config = caracteristicas[piscifactoriaId] || caracteristicas[1];
  let salinidadBase = config.base;

  // Generar datos cada 3 horas
  for (let fecha = new Date(inicio); fecha <= fin; fecha.setHours(fecha.getHours() + 3)) {
    // Variación por evaporación y mezcla con agua dulce
    const hora = fecha.getHours();
    const variacionDiaria = Math.sin((hora - 12) / 24 * Math.PI * 2) * config.amplitud * 0.5;

    // Variación aleatoria por corrientes y mezcla
    const ruido = (Math.random() - 0.5) * (1 - config.estabilidad) * 0.8;

    // Tendencia lenta (cambios estacionales)
    salinidadBase += (Math.random() - 0.5) * 0.05 * (1 - config.estabilidad);
    salinidadBase = Math.max(config.base - 2, Math.min(config.base + 2, salinidadBase));

    const salinidad = salinidadBase + variacionDiaria + ruido;

    datos.push({
      fecha: new Date(fecha).toISOString(),
      valor: parseFloat(salinidad.toFixed(2))
    });
  }

  return datos;
}

/**
 * Genera datos de piscifactorías simuladas
 * @returns {Array} Array de piscifactorías
 */
export function generarPiscifactorias() {
  return [
    {
      id: 1,
      name: 'Acuicultura Marina Guardamar',
      location: 'Guardamar del Segura, Alicante',
      coordinates: [38.0892, -0.6547],
      type: 'marina',
      species: ['Dorada', 'Lubina'],
      description: 'Instalación de acuicultura marina especializada en dorada y lubina en la costa alicantina',
      production_capacity: 500000,
      area: 25000,
      average_depth: 15,
      active: true
    },
    {
      id: 2,
      name: 'Piscifactoría Mar Menor',
      location: 'San Pedro del Pinatar, Murcia',
      coordinates: [37.8333, -0.7833],
      type: 'marina',
      species: ['Dorada', 'Lubina', 'Corvina'],
      description: 'Producción acuícola en el entorno del Mar Menor con tecnología sostenible',
      production_capacity: 350000,
      area: 18000,
      average_depth: 12,
      active: true
    },
    {
      id: 3,
      name: 'Acuicultura Mediterráneo',
      location: 'Cullera, Valencia',
      coordinates: [39.1628, -0.2518],
      type: 'marina',
      species: ['Dorada', 'Lubina', 'Atún'],
      description: 'Granja marina de alta producción en la costa valenciana',
      production_capacity: 600000,
      area: 30000,
      average_depth: 20,
      active: true
    },
    {
      id: 4,
      name: 'Acuicultura Águilas',
      location: 'Águilas, Murcia',
      coordinates: [37.4074, -1.5831],
      type: 'marina',
      species: ['Dorada', 'Lubina', 'Rodaballo'],
      description: 'Instalación acuícola con tecnología avanzada en Águilas',
      production_capacity: 450000,
      area: 22000,
      average_depth: 18,
      active: true
    }
  ];
}

/**
 * Genera alertas simuladas específicas para cada piscifactoría
 * @param {number|null} piscifactoriaId - ID de piscifactoría (opcional)
 * @returns {Array} Array de alertas
 */
export function generarAlertas(piscifactoriaId = null) {
  // Alertas específicas por piscifactoría
  const alertasPorPiscifactoria = {
    1: [  // Guardamar - condiciones estables
      {
        tipo: 'temperature',
        nivel: 'baja',
        descripcion: 'Temperatura del agua en rango óptimo',
        variable_nombre: 'temperature',
        valor_umbral: 22,
        valor_actual: 20.5
      }
    ],
    2: [  // San Pedro - corrientes fuertes
      {
        tipo: 'currents',
        nivel: 'media',
        descripcion: 'Corrientes marinas superiores al promedio',
        variable_nombre: 'vo',
        valor_umbral: 0.6,
        valor_actual: 0.72
      },
      {
        tipo: 'temperature',
        nivel: 'baja',
        descripcion: 'Temperatura ligeramente por debajo del óptimo',
        variable_nombre: 'temperature',
        valor_umbral: 18,
        valor_actual: 17.8
      }
    ],
    3: [  // Cullera - muy estable, sin alertas significativas
      {
        tipo: 'oxygen',
        nivel: 'baja',
        descripcion: 'Nivel de oxígeno en rango óptimo',
        variable_nombre: 'oxygen',
        valor_umbral: 6,
        valor_actual: 7.2
      }
    ],
    4: [  // Águilas - condiciones más extremas
      {
        tipo: 'currents',
        nivel: 'alta',
        descripcion: 'Corrientes marinas muy fuertes, monitoreo requerido',
        variable_nombre: 'vo',
        valor_umbral: 0.8,
        valor_actual: 0.95
      },
      {
        tipo: 'waves',
        nivel: 'media',
        descripcion: 'Oleaje moderado a fuerte en la zona',
        variable_nombre: 'waves',
        valor_umbral: 2.0,
        valor_actual: 2.4
      }
    ]
  };

  const id = piscifactoriaId || 1;
  const alertas = alertasPorPiscifactoria[id] || alertasPorPiscifactoria[1];

  return alertas.map((alerta, index) => ({
    ...alerta,
    id: index + 1,
    tiempo: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    piscifactoriaId: id,
    activa: true
  }));
}

/**
 * Genera datos de corrientes para visualización vectorial
 * @param {Date} fecha - Fecha para la que generar datos
 * @returns {Object} Objeto con datos de corrientes
 */
export function generarDatosCorrientesVectoriales(fecha) {
  const datos = [];

  // Generar una cuadrícula de puntos alrededor de Galicia
  const latMin = 42.0;
  const latMax = 43.5;
  const lngMin = -9.3;
  const lngMax = -7.8;

  const pasoLat = 0.15;
  const pasoLng = 0.15;

  for (let lat = latMin; lat <= latMax; lat += pasoLat) {
    for (let lng = lngMin; lng <= lngMax; lng += pasoLng) {
      // Generar velocidad y dirección aleatorias pero coherentes
      const valor = 0.2 + Math.random() * 0.4;
      const direccion = Math.random() * 360;

      datos.push({
        lat: parseFloat(lat.toFixed(4)),
        lng: parseFloat(lng.toFixed(4)),
        valor: parseFloat(valor.toFixed(3)),
        direccion: parseFloat(direccion.toFixed(1)),
        profundidad: 0,
        fecha: fecha.toISOString()
      });
    }
  }

  return {
    fecha: fecha.toISOString().split('T')[0],
    variable: 'vo',
    datos
  };
}

/**
 * Genera análisis de riesgo para una piscifactoría
 * @param {number} piscifactoriaId - ID de la piscifactoría
 * @returns {Object} Análisis de riesgo
 */
export function generarAnalisisRiesgo(piscifactoriaId) {
  const piscifactorias = generarPiscifactorias();
  const pisci = piscifactorias.find(p => p.id === piscifactoriaId) || piscifactorias[0];

  // Cada piscifactoría tiene condiciones de oleaje y corrientes diferentes
  const condiciones = {
    1: { olasBase: 1.5, olasVar: 0.8, corrienteBase: 0.35 },  // Guardamar - condiciones moderadas
    2: { olasBase: 2.0, olasVar: 1.2, corrienteBase: 0.50 },  // San Pedro - más expuesto
    3: { olasBase: 1.2, olasVar: 0.5, corrienteBase: 0.25 },  // Cullera - más protegido
    4: { olasBase: 2.5, olasVar: 1.5, corrienteBase: 0.60 }   // Águilas - muy expuesto
  };

  const config = condiciones[piscifactoriaId] || condiciones[1];

  // Generar valores específicos para esta piscifactoría
  const alturaOlas = config.olasBase + Math.random() * config.olasVar;
  const alturaOlasPrevia = config.olasBase + Math.random() * config.olasVar;
  const velocidadCorriente = config.corrienteBase + (Math.random() - 0.5) * 0.2;

  // Calcular índice de riesgo simplificado
  let indiceRiesgo = 0;

  // Contribución de altura de olas
  if (alturaOlas < 1.5) {
    indiceRiesgo += alturaOlas / 1.5 * 2;
  } else if (alturaOlas < 3) {
    indiceRiesgo += 2 + (alturaOlas - 1.5) / 1.5 * 3;
  } else {
    indiceRiesgo += 5 + Math.min(3, (alturaOlas - 3) * 2);
  }

  // Contribución de olas previas (mayor peso)
  if (alturaOlasPrevia < 1.5) {
    indiceRiesgo += alturaOlasPrevia / 1.5 * 2.5;
  } else if (alturaOlasPrevia < 3) {
    indiceRiesgo += 2.5 + (alturaOlasPrevia - 1.5) / 1.5 * 3.5;
  } else {
    indiceRiesgo += 6 + Math.min(4, (alturaOlasPrevia - 3) * 2);
  }

  // Contribución de corrientes
  indiceRiesgo += (velocidadCorriente / 0.8) * 1.5;

  // Normalizar a escala 0-10
  indiceRiesgo = Math.min(10, indiceRiesgo / 1.5);

  let nivelRiesgo = 'bajo';
  if (indiceRiesgo >= 7) {
    nivelRiesgo = 'alto';
  } else if (indiceRiesgo >= 3.5) {
    nivelRiesgo = 'medio';
  }

  return {
    piscifactoria: {
      id: piscifactoriaId,
      nombre: pisci.name,
      tipo: pisci.type
    },
    analisisRiesgo: {
      indice: parseFloat(indiceRiesgo.toFixed(1)),
      nivel: nivelRiesgo,
      probabilidad: parseFloat((indiceRiesgo / 10).toFixed(2)),
      factores: [
        {
          nombre: 'Altura de olas (día anterior)',
          valor: parseFloat(alturaOlasPrevia.toFixed(2)),
          unidad: 'm',
          contribucion: parseFloat(((alturaOlasPrevia / 3) * 5).toFixed(1)),
          umbral: 3.0
        },
        {
          nombre: 'Altura de olas actual',
          valor: parseFloat(alturaOlas.toFixed(2)),
          unidad: 'm',
          contribucion: parseFloat(((alturaOlas / 3) * 4).toFixed(1)),
          umbral: 3.0
        },
        {
          nombre: 'Velocidad de corriente',
          valor: parseFloat(velocidadCorriente.toFixed(2)),
          unidad: 'm/s',
          contribucion: parseFloat(((velocidadCorriente / 0.8) * 3).toFixed(1)),
          umbral: 0.8
        }
      ],
      fechaAnalisis: new Date().toISOString()
    }
  };
}

/**
 * Genera predicción de riesgo para los próximos días
 * @param {number} piscifactoriaId - ID de la piscifactoría
 * @param {number} dias - Número de días a predecir
 * @returns {Object} Predicciones de riesgo
 */
export function generarPrediccionRiesgo(piscifactoriaId, dias = 7) {
  const predicciones = [];
  const ahora = new Date();

  for (let i = 0; i < dias; i++) {
    const fecha = new Date(ahora);
    fecha.setDate(fecha.getDate() + i);

    // Simular una tormenta que llega en 3 días
    let factorOlas = 1.0;
    if (i >= 3 && i <= 5) {
      factorOlas = 1.0 + (i - 2) * 0.4;
    } else if (i > 5) {
      factorOlas = 2.2 - (i - 5) * 0.3;
      factorOlas = Math.max(1.0, factorOlas);
    }

    const alturaOla = (1.2 + Math.random() * 0.8) * factorOlas;
    const alturaOlaPrevia = i > 0 ? predicciones[i - 1].wave_height : 1.2;
    const corriente = (0.3 + Math.random() * 0.2) * (0.8 + 0.4 * factorOlas);

    // Calcular índice de riesgo
    let indiceRiesgo = 0;
    indiceRiesgo += (alturaOla / 3) * 4;
    indiceRiesgo += (alturaOlaPrevia / 3) * 5;
    indiceRiesgo += (corriente / 0.8) * 1.5;
    indiceRiesgo = Math.min(10, indiceRiesgo / 1.5);

    let nivelRiesgo = 'bajo';
    if (indiceRiesgo >= 7) {
      nivelRiesgo = 'alto';
    } else if (indiceRiesgo >= 3.5) {
      nivelRiesgo = 'medio';
    }

    predicciones.push({
      fecha: fecha.toISOString(),
      wave_height: parseFloat(alturaOla.toFixed(2)),
      prev_day_wave: parseFloat(alturaOlaPrevia.toFixed(2)),
      current: parseFloat(corriente.toFixed(2)),
      indice: parseFloat(indiceRiesgo.toFixed(1)),
      nivel: nivelRiesgo,
      probabilidad: parseFloat((indiceRiesgo / 10).toFixed(2))
    });
  }

  return {
    piscifactoriaId,
    predicciones
  };
}

/**
 * Genera resumen de riesgo para todas las piscifactorías
 * @returns {Array} Resumen de riesgo
 */
export function generarResumenRiesgo() {
  const piscifactorias = generarPiscifactorias();

  return piscifactorias.map(pisci => {
    const analisis = generarAnalisisRiesgo(pisci.id);

    return {
      piscifactoria: {
        id: pisci.id,
        nombre: pisci.name,
        tipo: pisci.type,
        coordenadas: pisci.coordinates
      },
      riesgo: {
        indice: analisis.analisisRiesgo.indice,
        porcentaje: Math.min(100, Math.round(analisis.analisisRiesgo.indice * 10)),
        nivel: analisis.analisisRiesgo.nivel,
        probabilidad: parseFloat((analisis.analisisRiesgo.probabilidad * 100).toFixed(1))
      },
      fecha: new Date().toISOString()
    };
  });
}
