const express = require('express');
const { Pool } = require('pg');
const router = express.Router();

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

// Obtener todos los datasets
router.get('/datasets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM datasets');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener datasets:', error);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
});

// Obtener variables para un dataset específico
router.get('/datasets/:id/variables', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM variables WHERE dataset_id = $1',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener variables:', error);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
});

// Obtener datos marinos con filtros
router.get('/datos-marinos', async (req, res) => {
  const {
    dataset_id,
    variable_id,
    fecha_inicio,
    fecha_fin,
    min_lon,
    max_lon,
    min_lat,
    max_lat,
    profundidad
  } = req.query;

  let query = `
    SELECT id, dataset_id, variable_id, fecha_hora, latitud, longitud, profundidad, valor
    FROM datos_marinos
    WHERE dataset_id = $1
  `;

  const params = [dataset_id];
  let paramCount = 1;

  if (variable_id) {
    paramCount++;
    query += ` AND variable_id = $${paramCount}`;
    params.push(variable_id);
  }

  if (fecha_inicio) {
    paramCount++;
    query += ` AND fecha_hora >= $${paramCount}`;
    params.push(fecha_inicio);
  }

  if (fecha_fin) {
    paramCount++;
    query += ` AND fecha_hora <= $${paramCount}`;
    params.push(fecha_fin);
  }

  if (min_lon && max_lon) {
    paramCount++;
    query += ` AND longitud >= $${paramCount}`;
    params.push(min_lon);
    
    paramCount++;
    query += ` AND longitud <= $${paramCount}`;
    params.push(max_lon);
  }

  if (min_lat && max_lat) {
    paramCount++;
    query += ` AND latitud >= $${paramCount}`;
    params.push(min_lat);
    
    paramCount++;
    query += ` AND latitud <= $${paramCount}`;
    params.push(max_lat);
  }

  if (profundidad) {
    paramCount++;
    query += ` AND profundidad = $${paramCount}`;
    params.push(profundidad);
  }

  query += ' ORDER BY fecha_hora LIMIT 10000'; // Limitar resultados para rendimiento

  try {
    const result = await pool.query(query, params);
    
    // Convertir a GeoJSON para visualización en mapas
    const geoJson = {
      type: 'FeatureCollection',
      features: result.rows.map(row => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [row.longitud, row.latitud]
        },
        properties: {
          id: row.id,
          dataset_id: row.dataset_id,
          variable_id: row.variable_id,
          fecha_hora: row.fecha_hora,
          profundidad: row.profundidad,
          valor: row.valor
        }
      }))
    };
    
    res.json(geoJson);
  } catch (error) {
    console.error('Error al obtener datos marinos:', error);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
});

// Endpoint para actualizar datos de Copernicus
router.post('/update-copernicus-data', async (req, res) => {
  try {
    // Aquí ejecutaríamos los scripts de Python
    const { exec } = require('child_process');
    
    exec('python ./src/scripts/get_data_copernicus_and_openwather.py', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error ejecutando script de descarga: ${error.message}`);
        return res.status(500).json({ error: 'Error al descargar datos' });
      }
      
      exec('python ./src/scripts/process_data.py', (error2, stdout2, stderr2) => {
        if (error2) {
          console.error(`Error ejecutando script de procesamiento: ${error2.message}`);
          return res.status(500).json({ error: 'Error al procesar datos' });
        }
        
        res.json({ 
          message: 'Datos actualizados correctamente',
          download_log: stdout,
          process_log: stdout2
        });
      });
    });
  } catch (error) {
    console.error('Error en actualización de datos:', error);
    res.status(500).json({ error: 'Error al actualizar datos' });
  }
});

module.exports = router;