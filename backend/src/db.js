import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;
dotenv.config();

// Configuración de la conexión a la base de datos
const pool = new Pool({
  user: process.env.DB_USER || 'nickhernd',
  password: process.env.DB_PASSWORD || 'JAHEDE11',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'gloria',
  schema: process.env.DB_SCHEMA || 'gloria'
});

// Función para verificar la conexión a la base de datos
const testConnection = async () => {
  try {
    const client = await pool.connect();
    // Verificar que el esquema gloria existe
    const schemaResult = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata WHERE schema_name = 'gloria'
      );
    `);
    
    const schemaExists = schemaResult.rows[0].exists;
    
    if (!schemaExists) {
      console.error('El esquema "gloria" no existe en la base de datos');
      client.release();
      return false;
    }
    
    // Verificar que las tablas necesarias existen
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'gloria' 
      AND table_name IN ('piscifactorias', 'variables_ambientales', 'alertas', 'datasets');
    `);
    
    const missingTables = ['piscifactorias', 'variables_ambientales', 'alertas', 'datasets']
      .filter(table => !tablesResult.rows.some(row => row.table_name === table));
    
    if (missingTables.length > 0) {
      console.error(`Faltan las siguientes tablas en el esquema: ${missingTables.join(', ')}`);
      client.release();
      return false;
    }
    
    client.release();
    return true;
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error);
    return false;
  }
};

// Handler para evitar cerrar la aplicación en caso de error de conexión
pool.on('error', (err) => {
  console.error('Error inesperado en el pool de conexiones:', err);
});

export { pool, testConnection };