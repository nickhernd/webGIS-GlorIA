/**
 * @fileoverview Servicio de lógica de negocio para piscifactorías
 * @description Gestiona toda la lógica relacionada con piscifactorías,
 * separando la responsabilidad de las rutas API.
 *
 * @module services/piscifactoriasService
 * @author GlorIA Team
 * @version 1.0.0
 *
 * @requires ../database/queries
 * @requires ../config/constants
 * @requires ./riskCalculator
 */

import { pool } from '../db.js';
import { PiscifactoriasQueries, VariablesAmbientalesQueries } from '../database/queries.js';
import {
  VARIABLES_AMBIENTALES_UMBRALES,
  INTERVALOS_TIEMPO,
  MENSAJES_ERROR
} from '../config/constants.js';

/**
 * Helper para ejecutar consultas SQL con manejo de errores
 *
 * @private
 * @param {string} sql - Query SQL a ejecutar
 * @param {Array} [params=[]] - Parámetros de la query
 * @returns {Promise<Object>} Resultado de la consulta
 * @throws {Error} Si hay un error en la consulta
 */
async function executeQuery(sql, params = []) {
  try {
    const result = await pool.query(sql, params);
    return { success: true, data: result.rows };
  } catch (error) {
    console.error('Error en consulta a la base de datos:', error.message);
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
}

/**
 * Obtiene todas las piscifactorías activas
 *
 * @async
 * @returns {Promise<Array>} Array de piscifactorías
 * @throws {Error} Si hay un error en la consulta
 *
 * @example
 * const piscifactorias = await getAllPiscifactorias();
 * // Retorna: [{ id: 1, name: 'Piscifactoría A', ... }, ...]
 */
export async function getAllPiscifactorias() {
  const result = await executeQuery(PiscifactoriasQueries.getAllActive);

  if (!result.success) {
    throw new Error(`${MENSAJES_ERROR.DB_QUERY}: ${result.error}`);
  }

  // Transformar datos para mantener compatibilidad con el frontend
  return result.data.map(row => ({
    id: row.id,
    name: row.name,
    location: `${row.city || ''}, ${row.province || ''}`.trim().replace(/^,\s*/, '').replace(/,\s*$/, ''),
    coordinates: [row.latitude || 0, row.longitude || 0],
    type: row.type || '',
    species: row.species || [],
    description: row.description || '',
    production_capacity: row.production_capacity,
    area: row.area,
    average_depth: row.average_depth,
    active: row.active,
    geometry: row.geometry
  }));
}

/**
 * Procesa indicadores ambientales crudos y los transforma al formato esperado
 *
 * @private
 * @param {Array} datosAmbientales - Datos crudos de variables ambientales
 * @returns {Object} Indicadores procesados por variable
 */
function procesarIndicadoresAmbientales(datosAmbientales) {
  if (!datosAmbientales || datosAmbientales.length === 0) {
    return {};
  }

  // Agrupar por variable
  const agrupados = datosAmbientales.reduce((acc, curr) => {
    if (!acc[curr.variable_nombre]) {
      acc[curr.variable_nombre] = [];
    }
    acc[curr.variable_nombre].push(curr);
    return acc;
  }, {});

  const indicadores = {};

  // Para cada variable, procesamos el valor más reciente
  for (const [variable, valores] of Object.entries(agrupados)) {
    const valorReciente = valores[0]; // El primero es el más reciente por el ORDER BY

    // Configuración por defecto
    let unidad = '°C';
    let umbralMin = 0;
    let umbralMax = 100;
    let estado = 'normal';

    // Configurar unidades y umbrales según la variable
    const config = VARIABLES_AMBIENTALES_UMBRALES[variable.toUpperCase()];
    if (config) {
      unidad = config.UNIDAD;
      umbralMin = config.MIN;
      umbralMax = config.MAX;
    }

    // Determinar estado según umbrales
    const valor = valorReciente.valor || 0;
    if (valor < umbralMin || valor > umbralMax) {
      estado = 'warning';
    }

    // Calcular tendencia
    let tendencia = 'stable';
    let valorTendencia = 0;

    if (valores.length > 1) {
      const valorAnterior = valores[1].valor || 0;
      valorTendencia = valor - valorAnterior;
      if (valorTendencia > 0.1) {
        tendencia = 'up';
      } else if (valorTendencia < -0.1) {
        tendencia = 'down';
      }
    }

    indicadores[variable] = {
      valor: valor,
      unidad,
      tendencia,
      valorTendencia: Math.abs(valorTendencia).toFixed(1),
      umbralMin,
      umbralMax,
      estado,
      calidad: valorReciente.calidad
    };
  }

  return indicadores;
}

/**
 * Obtiene una piscifactoría específica por su ID
 *
 * @async
 * @param {number} id - ID de la piscifactoría
 * @returns {Promise<Object>} Datos de la piscifactoría con indicadores ambientales
 * @throws {Error} Si la piscifactoría no existe o hay error en la consulta
 *
 * @example
 * const piscifactoria = await getPiscifactoriaById(5);
 * // Retorna: { id: 5, name: '...', indicadoresAmbientales: {...}, ... }
 */
export async function getPiscifactoriaById(id) {
  // Obtener datos básicos de la piscifactoría
  const result = await executeQuery(PiscifactoriasQueries.getById, [id]);

  if (!result.success) {
    throw new Error(`${MENSAJES_ERROR.DB_QUERY}: ${result.error}`);
  }

  if (result.data.length === 0) {
    throw new Error(`${MENSAJES_ERROR.RECURSO_NO_ENCONTRADO}: Piscifactoría con ID ${id}`);
  }

  const piscifactoria = result.data[0];

  // Obtener indicadores ambientales recientes
  const indicadoresResult = await executeQuery(
    VariablesAmbientalesQueries.getRecentByFarm,
    [id, INTERVALOS_TIEMPO.HORAS_DATOS_RECIENTES, 20]
  );

  let indicadores = {};
  if (indicadoresResult.success && indicadoresResult.data.length > 0) {
    indicadores = procesarIndicadoresAmbientales(indicadoresResult.data);
  }

  // Transformar formato para compatibilidad con el frontend
  return {
    id: piscifactoria.id,
    name: piscifactoria.name || '',
    location: `${piscifactoria.city || ''}, ${piscifactoria.province || ''}`.trim().replace(/^,\s*/, '').replace(/,\s*$/, ''),
    coordinates: [piscifactoria.latitude || 0, piscifactoria.longitude || 0],
    type: piscifactoria.type || '',
    species: piscifactoria.species || [],
    description: piscifactoria.description || '',
    production_capacity: piscifactoria.production_capacity,
    area: piscifactoria.area,
    average_depth: piscifactoria.average_depth,
    active: piscifactoria.active,
    geometry: piscifactoria.geometry,
    area_geometry: piscifactoria.area_geometry,
    indicadoresAmbientales: indicadores
  };
}

/**
 * Verifica si una piscifactoría existe y está activa
 *
 * @async
 * @param {number} id - ID de la piscifactoría
 * @returns {Promise<boolean>} true si existe y está activa
 *
 * @example
 * const existe = await piscifactoriaExists(5);
 * // Retorna: true o false
 */
export async function piscifactoriaExists(id) {
  try {
    const result = await executeQuery(
      `SELECT id FROM ${DB_CONFIG.SCHEMA}.${DB_CONFIG.TABLAS.PISCIFACTORIAS} WHERE id = $1 AND activo = true`,
      [id]
    );
    return result.success && result.data.length > 0;
  } catch (error) {
    console.error(`Error al verificar existencia de piscifactoría ${id}:`, error);
    return false;
  }
}

/**
 * Obtiene estadísticas agregadas de una piscifactoría
 *
 * @async
 * @param {number} id - ID de la piscifactoría
 * @param {Object} [options={}] - Opciones de consulta
 * @param {Date} [options.fechaInicio] - Fecha de inicio del período
 * @param {Date} [options.fechaFin] - Fecha de fin del período
 * @returns {Promise<Object>} Estadísticas agregadas
 *
 * @example
 * const stats = await getEstadisticasPiscifactoria(5, {
 *   fechaInicio: new Date('2024-01-01'),
 *   fechaFin: new Date('2024-01-31')
 * });
 */
export async function getEstadisticasPiscifactoria(id, options = {}) {
  const { fechaInicio, fechaFin } = options;

  const query = `
    SELECT
      variable_nombre,
      AVG(valor) as valor_promedio,
      MAX(valor) as valor_maximo,
      MIN(valor) as valor_minimo,
      STDDEV(valor) as desviacion,
      COUNT(*) as total_muestras
    FROM gloria.variables_ambientales
    WHERE piscifactoria_id = $1
    ${fechaInicio && fechaFin ? 'AND fecha_tiempo BETWEEN $2 AND $3' : ''}
    GROUP BY variable_nombre
  `;

  const params = fechaInicio && fechaFin
    ? [id, fechaInicio, fechaFin]
    : [id];

  const result = await executeQuery(query, params);

  if (!result.success) {
    throw new Error(`${MENSAJES_ERROR.DB_QUERY}: ${result.error}`);
  }

  // Transformar resultados
  const estadisticas = {};
  result.data.forEach(row => {
    estadisticas[row.variable_nombre] = {
      promedio: parseFloat(row.valor_promedio?.toFixed(2) || 0),
      maximo: parseFloat(row.valor_maximo?.toFixed(2) || 0),
      minimo: parseFloat(row.valor_minimo?.toFixed(2) || 0),
      desviacion: parseFloat(row.desviacion?.toFixed(2) || 0),
      muestras: parseInt(row.total_muestras, 10) || 0
    };
  });

  return estadisticas;
}

/**
 * Obtiene las coordenadas de una piscifactoría
 *
 * @async
 * @param {number} id - ID de la piscifactoría
 * @returns {Promise<Array>} Coordenadas [lat, lng]
 *
 * @example
 * const coords = await getCoordenadas(5);
 * // Retorna: [43.5, -8.2]
 */
export async function getCoordenadas(id) {
  const query = `
    SELECT
      ST_Y(geometria) as latitude,
      ST_X(geometria) as longitude
    FROM gloria.piscifactorias
    WHERE id = $1
  `;

  const result = await executeQuery(query, [id]);

  if (!result.success || result.data.length === 0) {
    throw new Error(`${MENSAJES_ERROR.RECURSO_NO_ENCONTRADO}: Coordenadas para piscifactoría ${id}`);
  }

  const { latitude, longitude } = result.data[0];
  return [latitude || 0, longitude || 0];
}

export default {
  getAllPiscifactorias,
  getPiscifactoriaById,
  piscifactoriaExists,
  getEstadisticasPiscifactoria,
  getCoordenadas
};
