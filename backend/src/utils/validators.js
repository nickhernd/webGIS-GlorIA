/**
 * @fileoverview Validadores de entrada para las rutas API
 * @description Contiene funciones de validación para asegurar la integridad
 * de los datos de entrada en todas las rutas de la API.
 *
 * @module utils/validators
 * @author GlorIA Team
 * @version 1.0.0
 */

import { MAPEO_VARIABLES, PERIODOS_CONSULTA } from '../config/constants.js';

/**
 * Resultado de validación
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Si los datos son válidos
 * @property {string[]} errors - Array de mensajes de error
 * @property {*} [sanitized] - Datos sanitizados (si son válidos)
 */

/**
 * Valida que un valor sea un número positivo
 *
 * @param {*} value - Valor a validar
 * @param {string} fieldName - Nombre del campo para mensajes de error
 * @returns {ValidationResult}
 *
 * @example
 * const result = validatePositiveNumber('5', 'id');
 * // { valid: true, sanitized: 5 }
 */
export function validatePositiveNumber(value, fieldName = 'valor') {
  const errors = [];

  if (value === undefined || value === null || value === '') {
    errors.push(`${fieldName} es requerido`);
    return { valid: false, errors };
  }

  const num = Number(value);

  if (isNaN(num)) {
    errors.push(`${fieldName} debe ser un número válido`);
    return { valid: false, errors };
  }

  if (num < 0) {
    errors.push(`${fieldName} debe ser un número positivo`);
    return { valid: false, errors };
  }

  if (!Number.isFinite(num)) {
    errors.push(`${fieldName} debe ser un número finito`);
    return { valid: false, errors };
  }

  return { valid: true, errors: [], sanitized: num };
}

/**
 * Valida que un valor sea un ID válido (entero positivo)
 *
 * @param {*} value - Valor a validar
 * @param {string} fieldName - Nombre del campo para mensajes de error
 * @returns {ValidationResult}
 *
 * @example
 * const result = validateId('10', 'piscifactoriaId');
 * // { valid: true, sanitized: 10 }
 */
export function validateId(value, fieldName = 'id') {
  const numberResult = validatePositiveNumber(value, fieldName);

  if (!numberResult.valid) {
    return numberResult;
  }

  const id = numberResult.sanitized;

  if (!Number.isInteger(id)) {
    return {
      valid: false,
      errors: [`${fieldName} debe ser un número entero`]
    };
  }

  if (id === 0) {
    return {
      valid: false,
      errors: [`${fieldName} debe ser mayor que 0`]
    };
  }

  return { valid: true, errors: [], sanitized: id };
}

/**
 * Valida que una fecha sea válida
 *
 * @param {*} value - Valor a validar
 * @param {string} fieldName - Nombre del campo para mensajes de error
 * @returns {ValidationResult}
 *
 * @example
 * const result = validateDate('2024-01-15');
 * // { valid: true, sanitized: Date object }
 */
export function validateDate(value, fieldName = 'fecha') {
  const errors = [];

  if (!value) {
    errors.push(`${fieldName} es requerida`);
    return { valid: false, errors };
  }

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    errors.push(`${fieldName} no es una fecha válida`);
    return { valid: false, errors };
  }

  // Validar que no sea una fecha muy futura (más de 1 año)
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  if (date > oneYearFromNow) {
    errors.push(`${fieldName} no puede ser más de 1 año en el futuro`);
    return { valid: false, errors };
  }

  // Validar que no sea muy antigua (más de 10 años)
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

  if (date < tenYearsAgo) {
    errors.push(`${fieldName} no puede ser más de 10 años en el pasado`);
    return { valid: false, errors };
  }

  return { valid: true, errors: [], sanitized: date };
}

/**
 * Valida un rango de fechas
 *
 * @param {*} fechaInicio - Fecha de inicio
 * @param {*} fechaFin - Fecha de fin
 * @returns {ValidationResult}
 *
 * @example
 * const result = validateDateRange('2024-01-01', '2024-01-31');
 * // { valid: true, sanitized: { fechaInicio: Date, fechaFin: Date } }
 */
export function validateDateRange(fechaInicio, fechaFin) {
  const errors = [];

  const inicioResult = validateDate(fechaInicio, 'fechaInicio');
  const finResult = validateDate(fechaFin, 'fechaFin');

  if (!inicioResult.valid) {
    errors.push(...inicioResult.errors);
  }

  if (!finResult.valid) {
    errors.push(...finResult.errors);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  if (inicioResult.sanitized > finResult.sanitized) {
    errors.push('fechaInicio no puede ser posterior a fechaFin');
    return { valid: false, errors };
  }

  // Validar que el rango no sea muy grande (máximo 1 año)
  const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
  const rangeDiff = finResult.sanitized - inicioResult.sanitized;

  if (rangeDiff > oneYearInMs) {
    errors.push('El rango de fechas no puede ser mayor a 1 año');
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    sanitized: {
      fechaInicio: inicioResult.sanitized,
      fechaFin: finResult.sanitized
    }
  };
}

/**
 * Valida un nombre de variable ambiental
 *
 * @param {*} value - Valor a validar
 * @returns {ValidationResult}
 *
 * @example
 * const result = validateVariable('temperatura');
 * // { valid: true, sanitized: 'temperatura' }
 */
export function validateVariable(value) {
  const errors = [];

  if (!value || typeof value !== 'string') {
    errors.push('variable es requerida y debe ser una cadena de texto');
    return { valid: false, errors };
  }

  const variable = value.trim().toLowerCase();

  if (variable.length === 0) {
    errors.push('variable no puede estar vacía');
    return { valid: false, errors };
  }

  // Verificar si la variable está en el mapeo
  const variableExiste = Object.keys(MAPEO_VARIABLES).some(key =>
    MAPEO_VARIABLES[key].includes(variable) || key === variable
  );

  if (!variableExiste) {
    errors.push(`variable '${variable}' no es reconocida. Variables válidas: ${Object.keys(MAPEO_VARIABLES).join(', ')}`);
    return { valid: false, errors };
  }

  return { valid: true, errors: [], sanitized: variable };
}

/**
 * Valida un período de consulta
 *
 * @param {*} value - Valor a validar
 * @returns {ValidationResult}
 *
 * @example
 * const result = validatePeriod('week');
 * // { valid: true, sanitized: 'week' }
 */
export function validatePeriod(value) {
  const errors = [];

  if (!value) {
    // Período por defecto si no se proporciona
    return { valid: true, errors: [], sanitized: PERIODOS_CONSULTA.SEMANA };
  }

  if (typeof value !== 'string') {
    errors.push('periodo debe ser una cadena de texto');
    return { valid: false, errors };
  }

  const periodo = value.trim().toLowerCase();

  const periodosValidos = Object.values(PERIODOS_CONSULTA);

  if (!periodosValidos.includes(periodo)) {
    errors.push(`periodo '${periodo}' no es válido. Períodos válidos: ${periodosValidos.join(', ')}`);
    return { valid: false, errors };
  }

  return { valid: true, errors: [], sanitized: periodo };
}

/**
 * Valida parámetros de consulta de datos ambientales
 *
 * @param {Object} params - Parámetros a validar
 * @param {string} params.fecha - Fecha de consulta
 * @param {string} params.variable - Variable ambiental
 * @param {number} [params.piscifactoriaId] - ID de piscifactoría (opcional)
 * @returns {ValidationResult}
 *
 * @example
 * const result = validateDatosAmbientalesParams({
 *   fecha: '2024-01-15',
 *   variable: 'temperatura',
 *   piscifactoriaId: 5
 * });
 */
export function validateDatosAmbientalesParams(params) {
  const errors = [];
  const sanitized = {};

  // Validar fecha
  const fechaResult = validateDate(params.fecha, 'fecha');
  if (!fechaResult.valid) {
    errors.push(...fechaResult.errors);
  } else {
    sanitized.fecha = fechaResult.sanitized;
  }

  // Validar variable
  const variableResult = validateVariable(params.variable);
  if (!variableResult.valid) {
    errors.push(...variableResult.errors);
  } else {
    sanitized.variable = variableResult.sanitized;
  }

  // Validar piscifactoriaId si está presente
  if (params.piscifactoriaId !== undefined) {
    const idResult = validateId(params.piscifactoriaId, 'piscifactoriaId');
    if (!idResult.valid) {
      errors.push(...idResult.errors);
    } else {
      sanitized.piscifactoriaId = idResult.sanitized;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], sanitized };
}

/**
 * Valida parámetros de consulta histórica
 *
 * @param {Object} params - Parámetros a validar
 * @param {string} params.variable - Variable ambiental
 * @param {string} [params.periodo] - Período de consulta
 * @param {number} [params.piscifactoriaId] - ID de piscifactoría
 * @param {string} [params.fechaInicio] - Fecha de inicio
 * @param {string} [params.fechaFin] - Fecha de fin
 * @returns {ValidationResult}
 */
export function validateHistoricoParams(params) {
  const errors = [];
  const sanitized = {};

  // Validar variable
  const variableResult = validateVariable(params.variable);
  if (!variableResult.valid) {
    errors.push(...variableResult.errors);
  } else {
    sanitized.variable = variableResult.sanitized;
  }

  // Validar período
  const periodoResult = validatePeriod(params.periodo);
  if (!periodoResult.valid) {
    errors.push(...periodoResult.errors);
  } else {
    sanitized.periodo = periodoResult.sanitized;
  }

  // Validar rango de fechas si ambas están presentes
  if (params.fechaInicio && params.fechaFin) {
    const rangoResult = validateDateRange(params.fechaInicio, params.fechaFin);
    if (!rangoResult.valid) {
      errors.push(...rangoResult.errors);
    } else {
      sanitized.fechaInicio = rangoResult.sanitized.fechaInicio;
      sanitized.fechaFin = rangoResult.sanitized.fechaFin;
    }
  }

  // Validar piscifactoriaId si está presente
  if (params.piscifactoriaId !== undefined) {
    const idResult = validateId(params.piscifactoriaId, 'piscifactoriaId');
    if (!idResult.valid) {
      errors.push(...idResult.errors);
    } else {
      sanitized.piscifactoriaId = idResult.sanitized;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], sanitized };
}

/**
 * Sanitiza una cadena de texto para prevenir inyección
 *
 * @param {string} value - Valor a sanitizar
 * @param {number} [maxLength=255] - Longitud máxima permitida
 * @returns {string} Cadena sanitizada
 *
 * @example
 * const safe = sanitizeString('<script>alert("xss")</script>');
 * // Retorna: 'scriptalert("xss")/script' (sin < >)
 */
export function sanitizeString(value, maxLength = 255) {
  if (!value || typeof value !== 'string') {
    return '';
  }

  return value
    .trim()
    .replace(/[<>]/g, '') // Remover caracteres peligrosos
    .substring(0, maxLength);
}

/**
 * Valida y sanitiza parámetros de query string
 *
 * @param {Object} query - Objeto de query params
 * @param {Object} schema - Esquema de validación
 * @returns {ValidationResult}
 *
 * @example
 * const result = validateQueryParams(
 *   { id: '5', nombre: 'Test' },
 *   {
 *     id: { type: 'id', required: true },
 *     nombre: { type: 'string', required: false }
 *   }
 * );
 */
export function validateQueryParams(query, schema) {
  const errors = [];
  const sanitized = {};

  for (const [key, rules] of Object.entries(schema)) {
    const value = query[key];

    // Verificar si es requerido
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${key} es requerido`);
      continue;
    }

    // Si no es requerido y no está presente, continuar
    if (!rules.required && (value === undefined || value === null || value === '')) {
      continue;
    }

    // Validar según el tipo
    let result;
    switch (rules.type) {
      case 'id':
        result = validateId(value, key);
        break;
      case 'number':
        result = validatePositiveNumber(value, key);
        break;
      case 'date':
        result = validateDate(value, key);
        break;
      case 'string':
        sanitized[key] = sanitizeString(value, rules.maxLength);
        continue;
      case 'variable':
        result = validateVariable(value);
        break;
      case 'period':
        result = validatePeriod(value);
        break;
      default:
        errors.push(`Tipo de validación desconocido para ${key}: ${rules.type}`);
        continue;
    }

    if (result && !result.valid) {
      errors.push(...result.errors);
    } else if (result) {
      sanitized[key] = result.sanitized;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], sanitized };
}

export default {
  validatePositiveNumber,
  validateId,
  validateDate,
  validateDateRange,
  validateVariable,
  validatePeriod,
  validateDatosAmbientalesParams,
  validateHistoricoParams,
  sanitizeString,
  validateQueryParams
};
