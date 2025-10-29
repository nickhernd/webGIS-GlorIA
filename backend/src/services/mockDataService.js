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

  // Temperatura base: 18-22°C con variación diaria
  let temperaturaBase = 19 + Math.random() * 3;

  // Generar datos cada 3 horas
  for (let fecha = new Date(inicio); fecha <= fin; fecha.setHours(fecha.getHours() + 3)) {
    // Variación diurna (más calor al mediodía)
    const hora = fecha.getHours();
    const variacionDiurna = Math.sin((hora - 6) / 24 * Math.PI * 2) * 2;

    // Variación aleatoria pequeña
    const ruido = (Math.random() - 0.5) * 0.5;

    // Tendencia lenta (cambio gradual de temperatura base)
    temperaturaBase += (Math.random() - 0.5) * 0.1;
    temperaturaBase = Math.max(16, Math.min(24, temperaturaBase));

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

  // Velocidad base de corriente: 0.2-0.6 m/s
  let velocidadBase = 0.3 + Math.random() * 0.2;

  // Generar datos cada 3 horas
  for (let fecha = new Date(inicio); fecha <= fin; fecha.setHours(fecha.getHours() + 3)) {
    // Variación según hora del día (mareas)
    const hora = fecha.getHours();
    const variacionMareas = Math.sin(hora / 12 * Math.PI * 2) * 0.15;

    // Variación aleatoria
    const ruido = (Math.random() - 0.5) * 0.1;

    // Tendencia lenta
    velocidadBase += (Math.random() - 0.5) * 0.02;
    velocidadBase = Math.max(0.1, Math.min(0.8, velocidadBase));

    const velocidad = Math.max(0, velocidadBase + variacionMareas + ruido);

    datos.push({
      fecha: new Date(fecha).toISOString(),
      valor: parseFloat(velocidad.toFixed(3))
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
 * Genera alertas simuladas
 * @param {number|null} piscifactoriaId - ID de piscifactoría (opcional)
 * @returns {Array} Array de alertas
 */
export function generarAlertas(piscifactoriaId = null) {
  const alertasPosibles = [
    {
      tipo: 'temperature',
      nivel: 'media',
      descripcion: 'Temperatura del agua ligeramente por encima del rango óptimo',
      variable_nombre: 'temperature',
      valor_umbral: 22,
      valor_actual: 23.5
    },
    {
      tipo: 'currents',
      nivel: 'baja',
      descripcion: 'Corrientes marinas dentro del rango normal',
      variable_nombre: 'vo',
      valor_umbral: 0.8,
      valor_actual: 0.4
    },
    {
      tipo: 'oxygen',
      nivel: 'alta',
      descripcion: 'Nivel de oxígeno disuelto por debajo del umbral recomendado',
      variable_nombre: 'oxygen',
      valor_umbral: 6,
      valor_actual: 4.8
    }
  ];

  // Seleccionar aleatoriamente 1-2 alertas
  const numAlertas = Math.floor(Math.random() * 2) + 1;
  const alertasSeleccionadas = [];

  for (let i = 0; i < numAlertas && i < alertasPosibles.length; i++) {
    const alerta = { ...alertasPosibles[i] };
    alerta.id = i + 1;
    alerta.tiempo = new Date(Date.now() - Math.random() * 3600000).toISOString(); // Última hora
    alerta.piscifactoriaId = piscifactoriaId || (Math.floor(Math.random() * 3) + 1);
    alerta.activa = true;

    alertasSeleccionadas.push(alerta);
  }

  return alertasSeleccionadas;
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

  // Generar valores aleatorios pero realistas
  const alturaOlas = 1.2 + Math.random() * 2; // 1.2 - 3.2 m
  const alturaOlasPrevia = 1.0 + Math.random() * 2;
  const velocidadCorriente = 0.3 + Math.random() * 0.4; // 0.3 - 0.7 m/s

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
