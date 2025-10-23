/**
 * @fileoverview Configuración centralizada de la aplicación
 * @description Gestiona todas las variables de entorno y configuraciones del sistema.
 * Proporciona valores por defecto seguros y valida la configuración al inicio.
 *
 * @module config/config
 * @author GlorIA Team
 * @version 1.0.0
 *
 * @requires dotenv
 */

import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

/**
 * Configuración de la base de datos PostgreSQL
 *
 * @typedef {Object} DatabaseConfig
 * @property {string} user - Usuario de la base de datos
 * @property {string} password - Contraseña (debe venir de variable de entorno)
 * @property {string} host - Host del servidor de base de datos
 * @property {number} port - Puerto de PostgreSQL
 * @property {string} database - Nombre de la base de datos
 * @property {string} schema - Esquema a utilizar
 * @property {number} max - Máximo de conexiones en el pool
 * @property {number} idleTimeoutMillis - Tiempo de inactividad antes de cerrar conexión
 * @property {number} connectionTimeoutMillis - Timeout para establecer conexión
 */
export const databaseConfig = {
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',  // IMPORTANTE: Debe configurarse en .env
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'gloria',
  schema: process.env.DB_SCHEMA || 'gloria',

  // Configuración del pool de conexiones
  max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 5000
};

/**
 * Configuración del servidor Express
 *
 * @typedef {Object} ServerConfig
 * @property {number} port - Puerto en el que escucha el servidor
 * @property {string} env - Entorno de ejecución (development, production, test)
 * @property {string} host - Host del servidor
 * @property {boolean} corsEnabled - Si CORS está habilitado
 * @property {string} corsOrigin - Origen permitido para CORS
 */
export const serverConfig = {
  port: parseInt(process.env.PORT, 10) || 3000,
  env: process.env.NODE_ENV || 'development',
  host: process.env.HOST || 'localhost',
  corsEnabled: process.env.CORS_ENABLED !== 'false',
  corsOrigin: process.env.CORS_ORIGIN || '*'
};

/**
 * Configuración de logging
 *
 * @typedef {Object} LogConfig
 * @property {string} level - Nivel de logging (error, warn, info, debug)
 * @property {boolean} prettyPrint - Si debe formatear los logs de forma legible
 * @property {boolean} timestamp - Si debe incluir timestamp
 */
export const logConfig = {
  level: process.env.LOG_LEVEL || (serverConfig.env === 'production' ? 'info' : 'debug'),
  prettyPrint: serverConfig.env !== 'production',
  timestamp: true
};

/**
 * Configuración de APIs externas
 *
 * @typedef {Object} ExternalApisConfig
 * @property {Object} copernicus - Configuración de Copernicus API
 * @property {Object} openweather - Configuración de OpenWeather API
 */
export const externalApisConfig = {
  copernicus: {
    baseUrl: process.env.COPERNICUS_API_URL || 'https://marine.copernicus.eu',
    username: process.env.COPERNICUS_USERNAME || '',
    password: process.env.COPERNICUS_PASSWORD || '',
    timeout: parseInt(process.env.COPERNICUS_TIMEOUT, 10) || 30000
  },
  openweather: {
    apiKey: process.env.OPENWEATHER_API_KEY || '',
    baseUrl: process.env.OPENWEATHER_API_URL || 'https://api.openweathermap.org/data/2.5',
    timeout: parseInt(process.env.OPENWEATHER_TIMEOUT, 10) || 10000
  }
};

/**
 * Configuración de seguridad
 *
 * @typedef {Object} SecurityConfig
 * @property {boolean} rateLimitEnabled - Si rate limiting está habilitado
 * @property {number} rateLimitWindowMs - Ventana de tiempo para rate limit
 * @property {number} rateLimitMaxRequests - Máximo de requests por ventana
 * @property {boolean} helmetEnabled - Si Helmet middleware está habilitado
 */
export const securityConfig = {
  rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutos
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  helmetEnabled: process.env.HELMET_ENABLED !== 'false'
};

/**
 * Configuración de caché
 *
 * @typedef {Object} CacheConfig
 * @property {boolean} enabled - Si el caché está habilitado
 * @property {number} ttl - Tiempo de vida por defecto en segundos
 */
export const cacheConfig = {
  enabled: process.env.CACHE_ENABLED !== 'false',
  ttl: parseInt(process.env.CACHE_TTL, 10) || 300 // 5 minutos
};

/**
 * Configuración de rutas de archivos
 *
 * @typedef {Object} PathsConfig
 * @property {string} frontend - Ruta al directorio del frontend
 * @property {string} scripts - Ruta al directorio de scripts
 * @property {string} uploads - Ruta al directorio de uploads
 * @property {string} exports - Ruta al directorio de exportaciones
 */
export const pathsConfig = {
  frontend: process.env.FRONTEND_PATH || '../../frontend',
  scripts: process.env.SCRIPTS_PATH || '../scripts',
  uploads: process.env.UPLOADS_PATH || '../uploads',
  exports: process.env.EXPORTS_PATH || '../exports'
};

/**
 * Valida que la configuración crítica esté presente
 *
 * @throws {Error} Si falta configuración crítica
 * @returns {boolean} true si la configuración es válida
 */
export function validateConfig() {
  const errors = [];

  // Validar configuración de base de datos
  if (!databaseConfig.password && serverConfig.env === 'production') {
    errors.push('DB_PASSWORD es obligatorio en producción');
  }

  if (!databaseConfig.database) {
    errors.push('DB_NAME es obligatorio');
  }

  // Validar APIs externas si están configuradas
  if (externalApisConfig.copernicus.username && !externalApisConfig.copernicus.password) {
    errors.push('COPERNICUS_PASSWORD es obligatorio si se proporciona username');
  }

  // Mostrar advertencias
  if (!databaseConfig.password && serverConfig.env !== 'production') {
    console.warn('⚠️  ADVERTENCIA: DB_PASSWORD no configurado. Usando valor por defecto (solo desarrollo).');
  }

  if (errors.length > 0) {
    throw new Error(`Errores de configuración:\n${errors.join('\n')}`);
  }

  return true;
}

/**
 * Muestra un resumen de la configuración (sin datos sensibles)
 *
 * @returns {Object} Resumen de configuración
 */
export function getConfigSummary() {
  return {
    environment: serverConfig.env,
    server: {
      host: serverConfig.host,
      port: serverConfig.port
    },
    database: {
      host: databaseConfig.host,
      port: databaseConfig.port,
      database: databaseConfig.database,
      schema: databaseConfig.schema,
      hasPassword: !!databaseConfig.password
    },
    security: {
      rateLimitEnabled: securityConfig.rateLimitEnabled,
      helmetEnabled: securityConfig.helmetEnabled
    },
    cache: {
      enabled: cacheConfig.enabled,
      ttl: cacheConfig.ttl
    }
  };
}

/**
 * Exportación por defecto con toda la configuración
 */
export default {
  database: databaseConfig,
  server: serverConfig,
  log: logConfig,
  externalApis: externalApisConfig,
  security: securityConfig,
  cache: cacheConfig,
  paths: pathsConfig,
  validate: validateConfig,
  getSummary: getConfigSummary
};
