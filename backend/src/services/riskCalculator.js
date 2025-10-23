/**
 * @fileoverview Módulo de cálculo de riesgo de escapes en piscifactorías
 * @description Implementa algoritmos de análisis de riesgo basados en variables ambientales.
 * Separa la lógica de negocio de las rutas API para mejor mantenibilidad.
 *
 * @module services/riskCalculator
 * @author GlorIA Team
 * @version 1.0.0
 *
 * @requires ../config/constants
 */

import {
  CORRIENTES_UMBRALES,
  OLAS_UMBRALES,
  PESOS_RIESGO,
  NIVELES_RIESGO,
  FACTORES_CONVERSION,
  RANGOS_CONTRIBUCION
} from '../config/constants.js';

/**
 * Calcula la contribución de la altura de olas al índice de riesgo
 *
 * @param {number} alturaOlas - Altura de olas en metros
 * @returns {number} Contribución al índice de riesgo (0-10)
 *
 * @example
 * const contribucion = calcularContribucionOlas(2.5);
 * // Retorna: 4.5 (riesgo medio)
 */
export function calcularContribucionOlas(alturaOlas) {
  if (alturaOlas < OLAS_UMBRALES.OLAS_PEQUENAS) {
    // Olas pequeñas: contribución 0-3
    return (alturaOlas / OLAS_UMBRALES.OLAS_PEQUENAS) * RANGOS_CONTRIBUCION.BAJO.MAX;
  } else if (alturaOlas < OLAS_UMBRALES.OLAS_MEDIANAS) {
    // Olas medianas: contribución 3-6
    const rango = OLAS_UMBRALES.OLAS_MEDIANAS - OLAS_UMBRALES.OLAS_PEQUENAS;
    const posicion = alturaOlas - OLAS_UMBRALES.OLAS_PEQUENAS;
    return RANGOS_CONTRIBUCION.BAJO.MAX + (posicion / rango) * (RANGOS_CONTRIBUCION.MEDIO.MAX - RANGOS_CONTRIBUCION.BAJO.MAX);
  } else {
    // Olas grandes: contribución 6-10
    const excesoFactor = Math.min((alturaOlas - OLAS_UMBRALES.OLAS_GRANDES) / OLAS_UMBRALES.OLAS_PEQUENAS, 1);
    return RANGOS_CONTRIBUCION.MEDIO.MAX + excesoFactor * (RANGOS_CONTRIBUCION.ALTO.MAX - RANGOS_CONTRIBUCION.MEDIO.MAX);
  }
}

/**
 * Calcula la contribución de la velocidad de corriente al índice de riesgo
 *
 * @param {number} velocidadCorriente - Velocidad de corriente en m/s
 * @returns {number} Contribución al índice de riesgo (0-10)
 *
 * @example
 * const contribucion = calcularContribucionCorriente(0.6);
 * // Retorna: 5.4 (riesgo medio-alto)
 */
export function calcularContribucionCorriente(velocidadCorriente) {
  if (velocidadCorriente < CORRIENTES_UMBRALES.VELOCIDAD_BAJA) {
    // Corriente baja: contribución 0-3
    return (velocidadCorriente / CORRIENTES_UMBRALES.VELOCIDAD_BAJA) * RANGOS_CONTRIBUCION.BAJO.MAX;
  } else if (velocidadCorriente < CORRIENTES_UMBRALES.UMBRAL_PELIGRO) {
    // Corriente media: contribución 3-7
    const rango = CORRIENTES_UMBRALES.UMBRAL_PELIGRO - CORRIENTES_UMBRALES.VELOCIDAD_BAJA;
    const posicion = velocidadCorriente - CORRIENTES_UMBRALES.VELOCIDAD_BAJA;
    return RANGOS_CONTRIBUCION.BAJO.MAX + (posicion / rango) * 4;
  } else {
    // Corriente fuerte: contribución 7-10
    const excesoFactor = Math.min((velocidadCorriente - CORRIENTES_UMBRALES.UMBRAL_PELIGRO) * 5, 1);
    return 7 + excesoFactor * RANGOS_CONTRIBUCION.BAJO.MAX;
  }
}

/**
 * Calcula el índice de riesgo combinado basado en múltiples factores
 *
 * @param {Object} factores - Factores ambientales
 * @param {number} factores.alturaActual - Altura de olas actual en metros
 * @param {number} factores.alturaPrevia - Altura de olas del día anterior en metros
 * @param {number} factores.velocidadCorriente - Velocidad de corriente en m/s
 * @returns {number} Índice de riesgo (0-10)
 *
 * @example
 * const indice = calcularIndiceRiesgo({
 *   alturaActual: 2.0,
 *   alturaPrevia: 2.5,
 *   velocidadCorriente: 0.6
 * });
 * // Retorna: 5.8
 */
export function calcularIndiceRiesgo({ alturaActual, alturaPrevia, velocidadCorriente }) {
  // Calcular contribuciones individuales
  const contribucionActual = calcularContribucionOlas(alturaActual);
  const contribucionPrevia = calcularContribucionOlas(alturaPrevia);
  const contribucionCorriente = calcularContribucionCorriente(velocidadCorriente);

  // Calcular índice ponderado
  const { PESO_ACTUAL, PESO_PREVIO, PESO_CORRIENTE } = PESOS_RIESGO;
  const sumaPesos = PESO_ACTUAL + PESO_PREVIO + PESO_CORRIENTE;

  const indiceRiesgo = (
    PESO_ACTUAL * contribucionActual +
    PESO_PREVIO * contribucionPrevia +
    PESO_CORRIENTE * contribucionCorriente
  ) / sumaPesos;

  // Limitar al rango válido
  return Math.min(FACTORES_CONVERSION.MAX_INDICE_RIESGO, Math.max(FACTORES_CONVERSION.MIN_INDICE_RIESGO, indiceRiesgo));
}

/**
 * Determina el nivel de riesgo basado en el índice
 *
 * @param {number} indiceRiesgo - Índice de riesgo (0-10)
 * @returns {string} Nivel de riesgo ('bajo', 'medio', 'alto')
 *
 * @example
 * const nivel = determinarNivelRiesgo(7.5);
 * // Retorna: 'alto'
 */
export function determinarNivelRiesgo(indiceRiesgo) {
  if (indiceRiesgo < NIVELES_RIESGO.MEDIO.UMBRAL_MIN) {
    return NIVELES_RIESGO.BAJO.NOMBRE;
  } else if (indiceRiesgo < NIVELES_RIESGO.ALTO.UMBRAL_MIN) {
    return NIVELES_RIESGO.MEDIO.NOMBRE;
  } else {
    return NIVELES_RIESGO.ALTO.NOMBRE;
  }
}

/**
 * Calcula la probabilidad de escape basada en el índice de riesgo
 *
 * @param {number} indiceRiesgo - Índice de riesgo (0-10)
 * @returns {number} Probabilidad de escape (0-1)
 *
 * @example
 * const probabilidad = calcularProbabilidadEscape(8.5);
 * // Retorna: 0.85
 */
export function calcularProbabilidadEscape(indiceRiesgo) {
  return indiceRiesgo / FACTORES_CONVERSION.MAX_INDICE_RIESGO;
}

/**
 * Convierte el índice de riesgo a porcentaje
 *
 * @param {number} indiceRiesgo - Índice de riesgo (0-10)
 * @returns {number} Porcentaje de riesgo (0-100)
 *
 * @example
 * const porcentaje = convertirIndiceAPorcentaje(7.2);
 * // Retorna: 72
 */
export function convertirIndiceAPorcentaje(indiceRiesgo) {
  return Math.min(100, Math.round(indiceRiesgo * FACTORES_CONVERSION.INDICE_A_PORCENTAJE));
}

/**
 * Genera un análisis completo de riesgo
 *
 * @param {Object} datos - Datos ambientales
 * @param {number} datos.alturaActual - Altura de olas actual en metros
 * @param {number} datos.alturaPrevia - Altura de olas del día anterior en metros
 * @param {number} datos.velocidadCorriente - Velocidad de corriente en m/s
 * @param {Date} [datos.fechaAnalisis] - Fecha del análisis (opcional)
 * @returns {Object} Análisis completo de riesgo
 *
 * @example
 * const analisis = generarAnalisisRiesgo({
 *   alturaActual: 2.5,
 *   alturaPrevia: 3.0,
 *   velocidadCorriente: 0.7,
 *   fechaAnalisis: new Date()
 * });
 */
export function generarAnalisisRiesgo({
  alturaActual = 0,
  alturaPrevia = 0,
  velocidadCorriente = 0,
  fechaAnalisis = new Date()
}) {
  // Calcular contribuciones individuales
  const contribucionActual = calcularContribucionOlas(alturaActual);
  const contribucionPrevia = calcularContribucionOlas(alturaPrevia);
  const contribucionCorriente = calcularContribucionCorriente(velocidadCorriente);

  // Calcular índice de riesgo
  const indiceRiesgo = calcularIndiceRiesgo({
    alturaActual,
    alturaPrevia,
    velocidadCorriente
  });

  // Determinar nivel
  const nivelRiesgo = determinarNivelRiesgo(indiceRiesgo);

  // Calcular probabilidad
  const probabilidadEscape = calcularProbabilidadEscape(indiceRiesgo);

  // Generar factores detallados
  const factores = [
    {
      nombre: 'Altura de olas (día anterior)',
      valor: parseFloat(alturaPrevia.toFixed(2)),
      unidad: 'm',
      contribucion: parseFloat(contribucionPrevia.toFixed(1)),
      umbral: OLAS_UMBRALES.OLAS_GRANDES
    },
    {
      nombre: 'Altura de olas actual',
      valor: parseFloat(alturaActual.toFixed(2)),
      unidad: 'm',
      contribucion: parseFloat(contribucionActual.toFixed(1)),
      umbral: OLAS_UMBRALES.OLAS_GRANDES
    },
    {
      nombre: 'Velocidad de corriente',
      valor: parseFloat(velocidadCorriente.toFixed(2)),
      unidad: 'm/s',
      contribucion: parseFloat(contribucionCorriente.toFixed(1)),
      umbral: CORRIENTES_UMBRALES.UMBRAL_PELIGRO
    }
  ];

  return {
    indice: parseFloat(indiceRiesgo.toFixed(1)),
    nivel: nivelRiesgo,
    probabilidad: parseFloat(probabilidadEscape.toFixed(2)),
    porcentaje: convertirIndiceAPorcentaje(indiceRiesgo),
    factores,
    fechaAnalisis
  };
}

/**
 * Calcula el índice de riesgo para corrientes específicamente
 *
 * @param {number} velocidad - Velocidad de corriente en m/s
 * @returns {Object} Análisis de riesgo de corrientes
 *
 * @example
 * const analisis = calcularRiesgoCorrientes(0.9);
 * // Retorna: { indice: 8.2, nivel: 'alto', ... }
 */
export function calcularRiesgoCorrientes(velocidad) {
  let indiceRiesgo = 0;
  let nivelRiesgo = 'bajo';

  const { UMBRAL_ADVERTENCIA, UMBRAL_PELIGRO } = CORRIENTES_UMBRALES;

  if (velocidad < UMBRAL_ADVERTENCIA) {
    // Riesgo bajo (0-3)
    indiceRiesgo = (velocidad / UMBRAL_ADVERTENCIA) * RANGOS_CONTRIBUCION.BAJO.MAX;
  } else if (velocidad < UMBRAL_PELIGRO) {
    // Riesgo medio (3-7)
    const rango = UMBRAL_PELIGRO - UMBRAL_ADVERTENCIA;
    const posicion = velocidad - UMBRAL_ADVERTENCIA;
    indiceRiesgo = RANGOS_CONTRIBUCION.BAJO.MAX + (posicion / rango) * 4;
  } else {
    // Riesgo alto (7-10)
    const excesoFactor = Math.min((velocidad - UMBRAL_PELIGRO) / 0.5, 1);
    indiceRiesgo = 7 + excesoFactor * RANGOS_CONTRIBUCION.BAJO.MAX;
  }

  nivelRiesgo = determinarNivelRiesgo(indiceRiesgo);

  return {
    indice: parseFloat(indiceRiesgo.toFixed(1)),
    nivel: nivelRiesgo,
    velocidadActual: parseFloat(velocidad.toFixed(2)),
    umbralAdvertencia: UMBRAL_ADVERTENCIA,
    umbralPeligro: UMBRAL_PELIGRO,
    factores: [
      {
        nombre: 'Velocidad de corriente',
        valor: parseFloat(velocidad.toFixed(2)),
        unidad: 'm/s',
        contribucion: parseFloat((velocity / UMBRAL_PELIGRO * 5).toFixed(1))
      }
    ]
  };
}

/**
 * Calcula la magnitud de la corriente a partir de componentes U y V
 *
 * @param {number} uo - Componente U de la corriente (este-oeste) en m/s
 * @param {number} vo - Componente V de la corriente (norte-sur) en m/s
 * @returns {number} Magnitud de la corriente en m/s
 *
 * @example
 * const magnitud = calcularMagnitudCorriente(0.3, 0.4);
 * // Retorna: 0.5
 */
export function calcularMagnitudCorriente(uo, vo) {
  return Math.sqrt(uo * uo + vo * vo);
}

/**
 * Valida que los datos de entrada sean válidos
 *
 * @param {Object} datos - Datos a validar
 * @returns {Object} Resultado de validación
 * @returns {boolean} resultado.valido - Si los datos son válidos
 * @returns {string[]} resultado.errores - Lista de errores encontrados
 *
 * @example
 * const resultado = validarDatosRiesgo({ alturaActual: -1 });
 * // Retorna: { valido: false, errores: ['Altura actual no puede ser negativa'] }
 */
export function validarDatosRiesgo(datos) {
  const errores = [];

  if (datos.alturaActual !== undefined && datos.alturaActual < 0) {
    errores.push('Altura actual no puede ser negativa');
  }

  if (datos.alturaPrevia !== undefined && datos.alturaPrevia < 0) {
    errores.push('Altura previa no puede ser negativa');
  }

  if (datos.velocidadCorriente !== undefined && datos.velocidadCorriente < 0) {
    errores.push('Velocidad de corriente no puede ser negativa');
  }

  return {
    valido: errores.length === 0,
    errores
  };
}

export default {
  calcularContribucionOlas,
  calcularContribucionCorriente,
  calcularIndiceRiesgo,
  determinarNivelRiesgo,
  calcularProbabilidadEscape,
  convertirIndiceAPorcentaje,
  generarAnalisisRiesgo,
  calcularRiesgoCorrientes,
  calcularMagnitudCorriente,
  validarDatosRiesgo
};
