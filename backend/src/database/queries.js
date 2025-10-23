/**
 * @fileoverview Módulo de consultas SQL centralizadas
 * @description Contiene todas las queries SQL del sistema organizadas por dominio.
 * Facilita el mantenimiento, testing y reutilización de consultas.
 *
 * @module database/queries
 * @author GlorIA Team
 * @version 1.0.0
 */

import { DB_CONFIG } from '../config/constants.js';

const { SCHEMA, TABLAS } = DB_CONFIG;

/**
 * @namespace PiscifactoriasQueries
 * @description Consultas relacionadas con piscifactorías
 */
export const PiscifactoriasQueries = {
  /**
   * Query para obtener todas las piscifactorías activas
   * @type {string}
   */
  getAllActive: `
    SELECT
      id,
      nombre as name,
      descripcion as description,
      tipo as type,
      especies as species,
      ciudad as city,
      provincia as province,
      comunidad_autonoma as region,
      capacidad_produccion as production_capacity,
      area,
      profundidad_media as average_depth,
      activo as active,
      ST_X(geometria) as longitude,
      ST_Y(geometria) as latitude,
      ST_AsGeoJSON(geometria)::json as geometry
    FROM ${SCHEMA}.${TABLAS.PISCIFACTORIAS}
    WHERE activo = true
    ORDER BY nombre
  `,

  /**
   * Query para obtener una piscifactoría por ID
   * @param {number} id - ID de la piscifactoría
   * @type {string}
   */
  getById: `
    SELECT
      p.id,
      p.nombre as name,
      p.descripcion as description,
      p.tipo as type,
      p.especies as species,
      p.ciudad as city,
      p.provincia as province,
      p.comunidad_autonoma as region,
      p.capacidad_produccion as production_capacity,
      p.area,
      p.profundidad_media as average_depth,
      p.activo as active,
      p.fecha_registro as registration_date,
      p.fecha_actualizacion as update_date,
      ST_X(p.geometria) as longitude,
      ST_Y(p.geometria) as latitude,
      ST_AsGeoJSON(p.geometria)::json as geometry,
      ST_AsGeoJSON(p.geom_area)::json as area_geometry
    FROM ${SCHEMA}.${TABLAS.PISCIFACTORIAS} p
    WHERE p.id = $1
  `
};

/**
 * @namespace VariablesAmbientalesQueries
 * @description Consultas relacionadas con variables ambientales
 */
export const VariablesAmbientalesQueries = {
  /**
   * Query para obtener datos ambientales recientes de una piscifactoría
   * @param {number} piscifactoriaId - ID de la piscifactoría
   * @param {number} horas - Número de horas hacia atrás
   * @type {string}
   */
  getRecentByFarm: `
    SELECT
      va.variable_nombre,
      va.valor,
      va.fecha_tiempo,
      va.calidad
    FROM ${SCHEMA}.${TABLAS.VARIABLES_AMBIENTALES} va
    WHERE va.piscifactoria_id = $1
    AND va.fecha_tiempo > NOW() - INTERVAL '1 HOURS' * $2
    ORDER BY va.fecha_tiempo DESC
    LIMIT $3
  `,

  /**
   * Query para obtener datos de corrientes
   * @param {string} fecha - Fecha de consulta
   * @type {string}
   */
  getCorrientes: `
    SELECT
      va.id,
      va.variable_nombre,
      va.fecha_tiempo,
      va.valor,
      ST_X(va.geometria) as lng,
      ST_Y(va.geometria) as lat,
      va.profundidad
    FROM ${SCHEMA}.${TABLAS.VARIABLES_AMBIENTALES} va
    WHERE va.variable_nombre = 'vo'
    AND DATE(va.fecha_tiempo) = DATE($1)
    ORDER BY va.fecha_tiempo DESC
  `,

  /**
   * Query para obtener datos ambientales por variable y fecha
   * @param {string[]} variables - Array de nombres de variables
   * @param {string} fecha - Fecha de consulta
   * @param {number} [piscifactoriaId] - ID de piscifactoría (opcional)
   * @type {string}
   */
  getByVariableAndDate: `
    SELECT
      va.id,
      va.variable_nombre,
      va.fecha_tiempo,
      va.valor,
      ST_AsGeoJSON(va.geometria)::json as geometria
    FROM ${SCHEMA}.${TABLAS.VARIABLES_AMBIENTALES} va
    WHERE va.variable_nombre = ANY($1::text[])
    AND DATE(va.fecha_tiempo) = DATE($2)
  `,

  /**
   * Query para obtener histórico de una variable
   * @param {string[]} variables - Array de nombres de variables
   * @param {Date} fechaInicio - Fecha de inicio
   * @param {Date} fechaFin - Fecha de fin
   * @type {string}
   */
  getHistorico: `
    SELECT
      fecha_tiempo AS fecha,
      valor
    FROM ${SCHEMA}.${TABLAS.VARIABLES_AMBIENTALES}
    WHERE variable_nombre = ANY($1::text[])
    AND fecha_tiempo BETWEEN $2 AND $3
    AND valor IS NOT NULL
    AND valor != 'NaN'
    AND valor > -9990
    ORDER BY fecha_tiempo
  `,

  /**
   * Query para obtener la fecha más cercana con datos disponibles
   * @param {string[]} variables - Array de nombres de variables
   * @param {string} fecha - Fecha objetivo
   * @type {string}
   */
  getClosestDate: `
    SELECT DISTINCT DATE(fecha_tiempo) as fecha
    FROM ${SCHEMA}.${TABLAS.VARIABLES_AMBIENTALES}
    WHERE variable_nombre = ANY($1::text[])
    ORDER BY ABS(DATE(fecha_tiempo) - DATE($2)::date)
    LIMIT 1
  `,

  /**
   * Query para obtener rango de fechas disponibles para una variable
   * @param {string} variable - Nombre de la variable
   * @param {number} piscifactoriaId - ID de la piscifactoría
   * @type {string}
   */
  getRangoFechas: `
    SELECT
      MIN(fecha_tiempo) as fecha_min,
      MAX(fecha_tiempo) as fecha_max
    FROM ${SCHEMA}.${TABLAS.VARIABLES_AMBIENTALES}
    WHERE variable_nombre = $1
    AND piscifactoria_id = $2
  `
};

/**
 * @namespace AlertasQueries
 * @description Consultas relacionadas con alertas
 */
export const AlertasQueries = {
  /**
   * Query para obtener todas las alertas activas
   * @type {string}
   */
  getAllActive: `
    SELECT
      a.id,
      a.tipo as tipo,
      a.nivel as nivel,
      a.descripcion as mensaje,
      a.fecha_inicio as tiempo,
      a.piscifactoria_id as piscifactoriaId,
      p.nombre as piscifactoriaNombre,
      a.variable_nombre,
      a.valor_umbral,
      a.valor_actual,
      a.accion_recomendada
    FROM ${SCHEMA}.${TABLAS.ALERTAS} a
    LEFT JOIN ${SCHEMA}.${TABLAS.PISCIFACTORIAS} p ON a.piscifactoria_id = p.id
    WHERE a.activa = true
    ORDER BY a.fecha_inicio DESC
  `,

  /**
   * Query para obtener alertas por piscifactoría
   * @param {number} piscifactoriaId - ID de la piscifactoría
   * @type {string}
   */
  getByFarm: `
    SELECT
      a.id,
      a.tipo as tipo,
      a.nivel as nivel,
      a.descripcion as mensaje,
      a.fecha_inicio as tiempo,
      a.piscifactoria_id as piscifactoriaId,
      p.nombre as piscifactoriaNombre,
      a.variable_nombre,
      a.valor_umbral,
      a.valor_actual,
      a.accion_recomendada
    FROM ${SCHEMA}.${TABLAS.ALERTAS} a
    LEFT JOIN ${SCHEMA}.${TABLAS.PISCIFACTORIAS} p ON a.piscifactoria_id = p.id
    WHERE a.activa = true
    AND (a.piscifactoria_id = $1 OR a.piscifactoria_id IS NULL)
    ORDER BY a.fecha_inicio DESC
  `
};

/**
 * @namespace PrediccionesQueries
 * @description Consultas relacionadas con predicciones
 */
export const PrediccionesQueries = {
  /**
   * Query para obtener predicción más reciente de una piscifactoría
   * @param {number} piscifactoriaId - ID de la piscifactoría
   * @type {string}
   */
  getLatestByFarm: `
    SELECT
      pe.id,
      pe.piscifactoria_id,
      p.nombre as piscifactoria_nombre,
      pe.fecha,
      pe.altura_olas,
      pe.altura_olas_dia_anterior,
      pe.velocidad_corriente,
      pe.indice_riesgo,
      pe.nivel_riesgo,
      pe.prediccion_probabilidad,
      pe.fecha_prediccion
    FROM ${SCHEMA}.${TABLAS.PREDICCION_ESCAPES} pe
    JOIN ${SCHEMA}.${TABLAS.PISCIFACTORIAS} p ON pe.piscifactoria_id = p.id
    WHERE pe.piscifactoria_id = $1
    ORDER BY pe.fecha DESC, pe.fecha_prediccion DESC
    LIMIT 1
  `,

  /**
   * Query para obtener historial de predicciones
   * @param {number} piscifactoriaId - ID de la piscifactoría
   * @param {number} dias - Número de días hacia atrás
   * @type {string}
   */
  getHistorialByFarm: `
    SELECT
      pe.fecha,
      pe.indice_riesgo,
      pe.nivel_riesgo,
      pe.prediccion_probabilidad,
      pe.altura_olas,
      pe.altura_olas_dia_anterior,
      pe.velocidad_corriente
    FROM ${SCHEMA}.${TABLAS.PREDICCION_ESCAPES} pe
    WHERE pe.piscifactoria_id = $1
    AND pe.fecha > CURRENT_DATE - INTERVAL '1 day' * $2
    ORDER BY pe.fecha
  `,

  /**
   * Query para obtener resumen de predicciones más recientes
   * @type {string}
   */
  getResumenReciente: `
    WITH ultimas_predicciones AS (
      SELECT
        pe.piscifactoria_id,
        MAX(pe.fecha) as ultima_fecha
      FROM ${SCHEMA}.${TABLAS.PREDICCION_ESCAPES} pe
      GROUP BY pe.piscifactoria_id
    )
    SELECT
      pe.piscifactoria_id,
      p.nombre as piscifactoria_nombre,
      p.tipo as piscifactoria_tipo,
      ST_X(p.geometria) as longitud,
      ST_Y(p.geometria) as latitud,
      pe.fecha,
      pe.indice_riesgo,
      pe.nivel_riesgo,
      pe.prediccion_probabilidad,
      pe.altura_olas,
      pe.altura_olas_dia_anterior,
      pe.velocidad_corriente
    FROM ${SCHEMA}.${TABLAS.PREDICCION_ESCAPES} pe
    JOIN ultimas_predicciones up
      ON pe.piscifactoria_id = up.piscifactoria_id
      AND pe.fecha = up.ultima_fecha
    JOIN ${SCHEMA}.${TABLAS.PISCIFACTORIAS} p ON pe.piscifactoria_id = p.id
    ORDER BY pe.indice_riesgo DESC
  `
};

/**
 * @namespace RiesgoQueries
 * @description Consultas relacionadas con análisis de riesgo
 */
export const RiesgoQueries = {
  /**
   * Query para obtener datos de olas más recientes para análisis de riesgo
   * @param {number} piscifactoriaId - ID de la piscifactoría
   * @type {string}
   */
  getOlasRecientes: `
    SELECT
      va.valor as altura_olas,
      va.fecha_tiempo,
      p.nombre,
      p.tipo
    FROM ${SCHEMA}.${TABLAS.VARIABLES_AMBIENTALES} va
    JOIN ${SCHEMA}.${TABLAS.PISCIFACTORIAS} p ON va.piscifactoria_id = p.id
    WHERE va.variable_nombre = 'wave_height'
    AND va.piscifactoria_id = $1
    ORDER BY va.fecha_tiempo DESC
    LIMIT 2
  `,

  /**
   * Query para obtener datos de corrientes más recientes
   * @param {number} piscifactoriaId - ID de la piscifactoría
   * @type {string}
   */
  getCorrientesRecientes: `
    SELECT
      va.valor
    FROM ${SCHEMA}.${TABLAS.VARIABLES_AMBIENTALES} va
    WHERE va.variable_nombre IN ('uo', 'vo')
    AND va.piscifactoria_id = $1
    ORDER BY va.fecha_tiempo DESC
    LIMIT 2
  `,

  /**
   * Query para obtener riesgo actual de todas las piscifactorías
   * @type {string}
   */
  getRiesgoActual: `
    WITH ultimos_datos AS (
      SELECT
        p.id as piscifactoria_id,
        p.nombre,
        p.provincia,
        pe.fecha,
        pe.altura_olas,
        pe.altura_olas_dia_anterior,
        pe.velocidad_corriente,
        pe.indice_riesgo,
        pe.nivel_riesgo,
        pe.prediccion_probabilidad,
        ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY pe.fecha DESC) as rn
      FROM ${SCHEMA}.${TABLAS.PISCIFACTORIAS} p
      JOIN ${SCHEMA}.${TABLAS.PREDICCION_ESCAPES} pe ON p.id = pe.piscifactoria_id
      WHERE p.tipo = 'marina' AND p.activo = TRUE
    )
    SELECT * FROM ultimos_datos WHERE rn = 1
    ORDER BY indice_riesgo DESC
  `,

  /**
   * Query para obtener histórico de riesgo
   * @param {number} piscifactoriaId - ID de la piscifactoría
   * @param {string} desde - Fecha desde
   * @param {string} hasta - Fecha hasta
   * @type {string}
   */
  getHistoricoRiesgo: `
    SELECT
      fecha,
      altura_olas,
      altura_olas_dia_anterior,
      velocidad_corriente,
      indice_riesgo,
      nivel_riesgo,
      prediccion_probabilidad
    FROM ${SCHEMA}.${TABLAS.PREDICCION_ESCAPES}
    WHERE piscifactoria_id = $1
    AND fecha BETWEEN $2::date AND $3::date
    ORDER BY fecha
  `,

  /**
   * Query para obtener datos históricos para predicción
   * @param {number} piscifactoriaId - ID de la piscifactoría
   * @type {string}
   */
  getDatosHistoricosPred: `
    SELECT
      va.variable_nombre,
      va.valor,
      va.fecha_tiempo
    FROM ${SCHEMA}.${TABLAS.VARIABLES_AMBIENTALES} va
    WHERE va.variable_nombre IN ('wave_height', 'uo', 'vo')
    AND va.piscifactoria_id = $1
    AND va.fecha_tiempo > NOW() - INTERVAL '7 days'
    ORDER BY va.fecha_tiempo DESC
    LIMIT 50
  `
};

/**
 * @namespace DatasetsQueries
 * @description Consultas relacionadas con datasets
 */
export const DatasetsQueries = {
  /**
   * Query para obtener todos los datasets activos
   * @type {string}
   */
  getAllActive: `
    SELECT
      id,
      nombre,
      descripcion,
      fuente,
      dataset_id,
      variables,
      url_base,
      formato,
      frecuencia_actualizacion,
      fecha_registro,
      fecha_ultima_actualizacion,
      activo,
      ST_AsGeoJSON(bbox_geom)::json as bbox_geom
    FROM ${SCHEMA}.${TABLAS.DATASETS}
    WHERE activo = true
    ORDER BY nombre
  `
};

/**
 * Helper para construir queries dinámicas con filtros opcionales
 *
 * @param {string} baseQuery - Query base
 * @param {Object} filters - Filtros opcionales
 * @returns {Object} Query y parámetros
 *
 * @example
 * const { query, params } = buildDynamicQuery(
 *   'SELECT * FROM tabla WHERE 1=1',
 *   { piscifactoriaId: 5, activo: true }
 * );
 */
export function buildDynamicQuery(baseQuery, filters = {}) {
  let query = baseQuery;
  const params = [];
  let paramIndex = 1;

  if (filters.piscifactoriaId !== undefined) {
    query += ` AND piscifactoria_id = $${paramIndex}`;
    params.push(filters.piscifactoriaId);
    paramIndex++;
  }

  if (filters.fechaInicio && filters.fechaFin) {
    query += ` AND fecha_tiempo BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
    params.push(filters.fechaInicio, filters.fechaFin);
    paramIndex += 2;
  }

  if (filters.limit) {
    query += ` LIMIT $${paramIndex}`;
    params.push(filters.limit);
  }

  return { query, params };
}

export default {
  PiscifactoriasQueries,
  VariablesAmbientalesQueries,
  AlertasQueries,
  PrediccionesQueries,
  RiesgoQueries,
  DatasetsQueries,
  buildDynamicQuery
};
