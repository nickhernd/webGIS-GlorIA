/**
 * @fileoverview Módulo de conexión a la base de datos PostgreSQL
 * @description Gestiona el pool de conexiones y proporciona funciones
 * para verificar la conectividad y estructura de la base de datos.
 *
 * @module db
 * @author GlorIA Team
 * @version 2.0.0
 *
 * @requires pg
 * @requires ./config/config
 * @requires ./config/constants
 */

import pkg from 'pg';
import { databaseConfig } from './config/config.js';
import { DB_CONFIG, MENSAJES_ERROR } from './config/constants.js';

const { Pool } = pkg;

/**
 * Pool de conexiones a PostgreSQL
 * @type {Pool}
 * @constant
 */
const pool = new Pool({
  user: databaseConfig.user,
  password: databaseConfig.password,
  host: databaseConfig.host,
  port: databaseConfig.port,
  database: databaseConfig.database,

  // Configuración avanzada del pool
  max: databaseConfig.max,
  idleTimeoutMillis: databaseConfig.idleTimeoutMillis,
  connectionTimeoutMillis: databaseConfig.connectionTimeoutMillis
});

/**
 * Verifica que el esquema especificado existe en la base de datos
 *
 * @private
 * @param {Object} client - Cliente de PostgreSQL
 * @param {string} schemaName - Nombre del esquema
 * @returns {Promise<boolean>} true si el esquema existe
 */
async function verificarEsquema(client, schemaName) {
  const schemaResult = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.schemata WHERE schema_name = $1
    );
  `, [schemaName]);

  return schemaResult.rows[0].exists;
}

/**
 * Verifica que las tablas requeridas existan en el esquema
 *
 * @private
 * @param {Object} client - Cliente de PostgreSQL
 * @param {string} schemaName - Nombre del esquema
 * @param {string[]} tablasRequeridas - Lista de nombres de tablas requeridas
 * @returns {Promise<string[]>} Array de tablas faltantes (vacío si todas existen)
 */
async function verificarTablas(client, schemaName, tablasRequeridas) {
  const placeholders = tablasRequeridas.map((_, i) => `$${i + 2}`).join(',');

  const tablesResult = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1
    AND table_name IN (${placeholders})
  `, [schemaName, ...tablasRequeridas]);

  const tablasEncontradas = tablesResult.rows.map(row => row.table_name);
  return tablasRequeridas.filter(tabla => !tablasEncontradas.includes(tabla));
}

/**
 * Prueba la conexión a la base de datos y verifica la estructura
 *
 * @async
 * @returns {Promise<boolean>} true si la conexión es exitosa y la estructura es válida
 *
 * @example
 * const conectado = await testConnection();
 * if (conectado) {
 *   console.log('Base de datos lista');
 * }
 */
const testConnection = async () => {
  let client;

  try {
    // Intentar obtener una conexión del pool
    client = await pool.connect();
    console.log('✅ Conexión al servidor PostgreSQL establecida');

    // Verificar que el esquema existe
    const schemaExists = await verificarEsquema(client, DB_CONFIG.SCHEMA);

    if (!schemaExists) {
      console.error(`❌ El esquema "${DB_CONFIG.SCHEMA}" no existe en la base de datos`);
      return false;
    }

    console.log(`✅ Esquema "${DB_CONFIG.SCHEMA}" encontrado`);

    // Verificar que las tablas necesarias existen
    const tablasRequeridas = Object.values(DB_CONFIG.TABLAS);
    const tablasFaltantes = await verificarTablas(client, DB_CONFIG.SCHEMA, tablasRequeridas);

    if (tablasFaltantes.length > 0) {
      console.error(`❌ Faltan las siguientes tablas en el esquema: ${tablasFaltantes.join(', ')}`);
      return false;
    }

    console.log(`✅ Todas las tablas requeridas están presentes (${tablasRequeridas.length})`);

    return true;

  } catch (error) {
    console.error(`❌ ${MENSAJES_ERROR.DB_CONNECTION}:`, error.message);

    // Proporcionar ayuda contextual según el tipo de error
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Verifica que PostgreSQL esté ejecutándose y que el host/puerto sean correctos');
    } else if (error.code === '28P01') {
      console.error('💡 Verifica que el usuario y contraseña en .env sean correctos');
    } else if (error.code === '3D000') {
      console.error(`💡 La base de datos "${databaseConfig.database}" no existe. Créala primero.`);
    }

    return false;

  } finally {
    // Asegurarse de liberar el cliente
    if (client) {
      client.release();
    }
  }
};

/**
 * Realiza una consulta parametrizada a la base de datos
 *
 * @async
 * @param {string} text - Query SQL
 * @param {Array} [params=[]] - Parámetros de la query
 * @returns {Promise<Object>} Resultado de la query
 * @throws {Error} Si hay un error en la consulta
 *
 * @example
 * const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
 */
export async function query(text, params = []) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log de queries lentas (más de 1 segundo)
    if (duration > 1000) {
      console.warn(`⚠️  Query lenta (${duration}ms): ${text.substring(0, 100)}...`);
    }

    return res;
  } catch (error) {
    console.error(`❌ Error en query: ${error.message}`);
    console.error(`Query: ${text.substring(0, 100)}...`);
    throw error;
  }
}

/**
 * Obtiene un cliente del pool para transacciones
 *
 * @async
 * @returns {Promise<Object>} Cliente de PostgreSQL
 *
 * @example
 * const client = await getClient();
 * try {
 *   await client.query('BEGIN');
 *   await client.query('INSERT ...');
 *   await client.query('COMMIT');
 * } finally {
 *   client.release();
 * }
 */
export async function getClient() {
  return await pool.connect();
}

/**
 * Cierra todas las conexiones del pool
 * Útil para shutdown graceful
 *
 * @async
 * @returns {Promise<void>}
 */
export async function closePool() {
  try {
    await pool.end();
    console.log('✅ Pool de conexiones cerrado correctamente');
  } catch (error) {
    console.error('❌ Error al cerrar el pool de conexiones:', error);
    throw error;
  }
}

// Handler para errores inesperados del pool
pool.on('error', (err, client) => {
  console.error('❌ Error inesperado en el pool de conexiones:', err.message);
  // No finalizar el proceso, permitir recuperación
});

// Handler para evento de conexión
pool.on('connect', (client) => {
  console.log('🔌 Nueva conexión establecida en el pool');
});

// Handler para evento de adquisición
pool.on('acquire', (client) => {
  console.log('📥 Cliente adquirido del pool');
});

// Handler para evento de liberación
pool.on('release', (err, client) => {
  if (err) {
    console.error('❌ Error al liberar cliente:', err.message);
  } else {
    console.log('📤 Cliente liberado al pool');
  }
});

export { pool, testConnection };