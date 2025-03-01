// backend/server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  user: 'nickhernd',
  password: 'JAHEDE11',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'gloria',
  schema: 'gloria'
});

// Middleware
app.use(cors());
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Gloria API is running' });
});

// Get all fish farms
app.get('/api/piscifactorias', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        nombre, 
        descripcion, 
        tipo, 
        especies, 
        ciudad,
        provincia,
        comunidad_autonoma,
        capacidad_produccion,
        area,
        profundidad_media,
        activo,
        ST_AsGeoJSON(geometria)::json as geometria
      FROM gloria.piscifactorias 
      WHERE activo = true
      ORDER BY nombre
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching fish farms:', error);
    res.status(500).json({ error: 'Error fetching data from database' });
  }
});

// Get specific fish farm
app.get('/api/piscifactorias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        id, 
        nombre, 
        descripcion, 
        tipo, 
        especies, 
        ciudad,
        provincia,
        comunidad_autonoma,
        capacidad_produccion,
        area,
        profundidad_media,
        activo,
        fecha_registro,
        fecha_actualizacion,
        ST_AsGeoJSON(geometria)::json as geometria,
        ST_AsGeoJSON(geom_area)::json as geom_area
      FROM gloria.piscifactorias 
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fish farm not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching fish farm:', error);
    res.status(500).json({ error: 'Error fetching data from database' });
  }
});

// Get environmental variables data
app.get('/api/variables-ambientales', async (req, res) => {
  try {
    const { variable, fecha, piscifactoria_id } = req.query;
    
    let query = `
      SELECT 
        va.id,
        va.variable_nombre,
        va.fecha_tiempo,
        va.valor,
        va.piscifactoria_id,
        va.profundidad,
        va.calidad,
        ST_AsGeoJSON(va.geometria)::json as geometria
      FROM gloria.variables_ambientales va
      JOIN gloria.datasets d ON va.dataset_id = d.id
      WHERE d.activo = true
    `;
    
    const queryParams = [];
    let paramCounter = 1;
    
    if (variable) {
      query += ` AND va.variable_nombre = $${paramCounter}`;
      queryParams.push(variable);
      paramCounter++;
    }
    
    if (fecha) {
      query += ` AND DATE(va.fecha_tiempo) = $${paramCounter}`;
      queryParams.push(fecha);
      paramCounter++;
    }
    
    if (piscifactoria_id) {
      query += ` AND va.piscifactoria_id = $${paramCounter}`;
      queryParams.push(piscifactoria_id);
    }
    
    query += ` ORDER BY va.fecha_tiempo DESC, va.valor`;
    
    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching environmental variables:', error);
    res.status(500).json({ error: 'Error fetching data from database' });
  }
});

// Get active alerts
app.get('/api/alertas/activas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        piscifactoria_id,
        tipo,
        nivel,
        descripcion,
        fecha_inicio,
        fecha_registro,
        variable_nombre,
        valor_umbral,
        valor_actual,
        accion_recomendada,
        ST_AsGeoJSON(geometria)::json as geometria,
        metadatos
      FROM gloria.alertas 
      WHERE activa = true
      ORDER BY 
        CASE 
          WHEN nivel = 'crítico' THEN 1
          WHEN nivel = 'advertencia' THEN 2
          ELSE 3
        END,
        fecha_inicio DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching active alerts:', error);
    res.status(500).json({ error: 'Error fetching data from database' });
  }
});

// Get available datasets
app.get('/api/datasets', async (req, res) => {
  try {
    const result = await pool.query(`
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
      FROM gloria.datasets 
      WHERE activo = true
      ORDER BY nombre
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching datasets:', error);
    res.status(500).json({ error: 'Error fetching data from database' });
  }
});

// Listen for requests
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;