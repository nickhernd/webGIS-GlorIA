import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Helper para ejecutar consultas SQL con manejo de errores
async function queryDB(sql, params = []) {
  try {
    const result = await pool.query(sql, params);
    return { success: true, data: result.rows };
  } catch (error) {
    console.error('Error en consulta a la base de datos:', error.message);
    return { success: false, error: error.message };
  }
}

// Ruta base para proporcionar información sobre la API
router.get('/', (req, res) => {
  res.json({
    message: 'API de GlorIA funcionando correctamente',
    endpoints: [
      '/piscifactorias',
      '/piscifactorias/:id',
      '/datos-ambientales',
      '/alertas',
      '/alertas/piscifactoria/:id',
      '/predicciones/piscifactoria/:id',
      '/historico/:variable',
      '/exportar',
      '/datasets',
      '/copernicus/ejecutar'
    ]
  });
});

// Ruta para obtener listado de piscifactorías
router.get('/piscifactorias', async (req, res) => {
  // Obtener datos de la base de datos
  const result = await queryDB(`
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
    FROM gloria.piscifactorias 
    WHERE activo = true
    ORDER BY nombre
  `);
  
  // Si la consulta ok y hay datos
  if (result.success && result.data.length > 0) {
    // Transformar datos para mantener compatibilidad con el frontend
    const piscifactorias = result.data.map(row => ({
      id: row.id,
      name: row.name,
      location: `${row.city || ''}, ${row.province || ''}`.trim().replace(/^,\s*/, '').replace(/,\s*$/, ''),
      coordinates: [row.latitude || 0, row.longitude || 0],
      type: row.type || '',
      species: row.species || [],
      description: row.description || '',
      // Incluir --> mas campos
      production_capacity: row.production_capacity,
      area: row.area,
      average_depth: row.average_depth,
      active: row.active,
      geometry: row.geometry
    }));
    
    return res.json(piscifactorias);
  }
  
  // Si no hay datos o hay un error, devolver array vacío
  console.log('No hay datos de piscifactorías en la base de datos');
  res.json([]);
});

// Ruta para obtener detalles de una piscifactoría específica
router.get('/piscifactorias/:id', async (req, res) => {
  const { id } = req.params;
  const idNum = parseInt(id, 10);
  
  // Obtener datos de la base de datos
  const result = await queryDB(`
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
    FROM gloria.piscifactorias p
    WHERE p.id = $1
  `, [idNum]);
  
  // Si no hay datos en la base de datos, responder con error 404
  if (!result.success || result.data.length === 0) {
    return res.status(404).json({ error: 'Piscifactoría no encontrada en la base de datos' });
  }
  
  const piscifactoria = result.data[0];
  
  // Obtener indicadores ambientales
  const indicadoresResult = await queryDB(`
    SELECT 
      va.variable_nombre,
      va.valor,
      va.fecha_tiempo,
      va.calidad
    FROM gloria.variables_ambientales va
    WHERE va.piscifactoria_id = $1
    AND va.fecha_tiempo > NOW() - INTERVAL '24 HOURS'
    ORDER BY va.fecha_tiempo DESC
    LIMIT 20
  `, [idNum]);
  
  // Procesar indicadores si hay datos
  let indicadores = {};
  if (indicadoresResult.success && indicadoresResult.data.length > 0) {
    // Agrupamos por variable
    const agrupados = indicadoresResult.data.reduce((acc, curr) => {
      if (!acc[curr.variable_nombre]) {
        acc[curr.variable_nombre] = [];
      }
      acc[curr.variable_nombre].push(curr);
      return acc;
    }, {});
    
    // Para cada variable, tomamos el valor más reciente
    for (const [variable, valores] of Object.entries(agrupados)) {
      const valorReciente = valores[0]; // El primero es el más reciente por el ORDER BY
      
      // Configuración por defecto
      let unidad = '°C';
      let umbralMin = 0;
      let umbralMax = 100;
      let estado = 'normal';
      
      // Configurar unidades y umbrales según la variable
      switch(variable) {
        case 'temperature':
          unidad = '°C';
          umbralMin = 18;
          umbralMax = 26;
          break;
        case 'oxygen':
          unidad = 'mg/L';
          umbralMin = 5;
          umbralMax = 12;
          break;
        case 'currents':
          unidad = 'm/s';
          umbralMin = 0;
          umbralMax = 0.8;
          break;
        case 'salinity':
          unidad = 'ppt';
          umbralMin = 34;
          umbralMax = 38;
          break;
      }
      
      // Determinar estado según umbrales (con manejo de valores nulos)
      const valor = valorReciente.valor || 0;
      if (valor < umbralMin) {
        estado = 'warning';
      } else if (valor > umbralMax) {
        estado = 'warning';
      }
      
      // Calcular tendencia (con manejo de valores nulos)
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
  }
  
  // Transformar formato para mantener compatibilidad con el frontend
  const respuesta = {
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
  
  res.json(respuesta);
});

// Ruta para obtener datos ambientales
router.get('/datos-ambientales', async (req, res) => {
  const { fecha, variable } = req.query;
  
  // Validar parámetros
  if (!fecha || !variable) {
    return res.status(400).json({ error: 'Se requieren los parámetros fecha y variable' });
  }
  
  // Obtener datos de la base de datos
  const result = await queryDB(`
    SELECT 
      va.id,
      va.variable_nombre,
      va.fecha_tiempo,
      va.valor,
      ST_X(va.geometria) as lng,
      ST_Y(va.geometria) as lat
    FROM gloria.variables_ambientales va
    WHERE va.variable_nombre = $1
    AND DATE(va.fecha_tiempo) = DATE($2)
    AND va.piscifactoria_id IS NULL
  `, [variable, fecha]);
  
  // Si hay datos en la base de datos
  if (result.success && result.data.length > 0) {
    // Transformar datos al formato esperado por el frontend
    const datos = result.data.map(row => ({
      lat: row.lat || 0,
      lng: row.lng || 0,
      valor: parseFloat((row.valor || 0).toFixed(2))
    }));
    
    return res.json({
      fecha,
      variable,
      datos
    });
  }
  
  // Si no hay datos, devolver array vacío
  res.json({
    fecha,
    variable,
    datos: []
  });
});

// Ruta para obtener alertas
router.get('/alertas', async (req, res) => {
  const piscifactoriaId = req.query.piscifactoriaId ? parseInt(req.query.piscifactoriaId) : null;
  
  // Obtener datos de la base de datos
  let query = `
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
    FROM gloria.alertas a
    LEFT JOIN gloria.piscifactorias p ON a.piscifactoria_id = p.id
    WHERE a.activa = true
  `;
  
  const queryParams = [];
  
  if (piscifactoriaId) {
    query += ` AND (a.piscifactoria_id = $1 OR a.piscifactoria_id IS NULL)`;
    queryParams.push(piscifactoriaId);
  }
  
  query += ` ORDER BY a.fecha_inicio DESC`;
  
  const result = await queryDB(query, queryParams);
  
  // Si hay datos en la base de datos
  if (result.success && result.data.length > 0) {
    // Transformar resultados al formato esperado por el frontend
    const alertas = result.data.map(row => {
      const tiempoAlerta = new Date(row.tiempo || new Date());
      const ahora = new Date();
      const diferenciaMs = ahora - tiempoAlerta;
      
      // Calcular tiempo relativo
      let tiempoRelativo;
      if (diferenciaMs < 60000) { // menos de 1 minuto
        tiempoRelativo = 'Hace unos segundos';
      } else if (diferenciaMs < 3600000) { // menos de 1 hora
        const minutos = Math.floor(diferenciaMs / 60000);
        tiempoRelativo = `Hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
      } else if (diferenciaMs < 86400000) { // menos de 1 día
        const horas = Math.floor(diferenciaMs / 3600000);
        tiempoRelativo = `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
      } else {
        const dias = Math.floor(diferenciaMs / 86400000);
        tiempoRelativo = `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
      }
      
      return {
        id: row.id,
        titulo: formatearTituloAlerta(row),
        mensaje: row.mensaje || '',
        nivel: row.nivel || 'baja',
        tiempo: row.tiempo,
        tiempoRelativo,
        piscifactoriaId: row.piscifactoriaid,
        piscifactoriaNombre: row.piscifactorianombre
      };
    });
    
    return res.json(alertas);
  }
  
  // Si no hay datos, devolver array vacío
  res.json([]);
});

// Función auxiliar para formatear títulos de alertas con manejo robusto de nulos
function formatearTituloAlerta(alerta) {
  if (!alerta) return 'Alerta';
  
  const tipo = alerta.tipo || '';
  const valorActual = alerta.valor_actual || 0;
  const valorUmbral = alerta.valor_umbral || 0;
  
  if (tipo === 'temperature') {
    return 'Temperatura ' + (valorActual > valorUmbral ? 'elevada' : 'baja');
  } else if (tipo === 'oxygen') {
    return 'Nivel de oxígeno ' + (valorActual < valorUmbral ? 'bajo' : 'alto');
  } else if (tipo === 'currents') {
    return 'Corrientes ' + (valorActual > valorUmbral ? 'fuertes' : 'débiles');
  } else if (tipo === 'maintenance') {
    return 'Mantenimiento programado';
  } else if (tipo === 'weather') {
    return 'Alerta meteorológica';
  }
  
  // Capitalizar el tipo o devolver "Alerta" si no hay tipo
  return tipo ? (tipo.charAt(0).toUpperCase() + tipo.slice(1)) : 'Alerta';
}

// En el backend (api.js), añadir esta ruta
router.get('/rango-fechas', async (req, res) => {
  const { piscifactoriaId, variable } = req.query;
  
  try {
    const result = await pool.query(`
      SELECT 
        MIN(fecha_tiempo) as fecha_min,
        MAX(fecha_tiempo) as fecha_max
      FROM gloria.variables_ambientales
      WHERE variable_nombre = $1
      AND piscifactoria_id = $2
    `, [variable, piscifactoriaId]);
    
    if (result.rows.length > 0) {
      res.json({
        fecha_min: result.rows[0].fecha_min,
        fecha_max: result.rows[0].fecha_max
      });
    } else {
      res.json({
        fecha_min: null,
        fecha_max: null
      });
    }
  } catch (error) {
    console.error('Error al obtener rango de fechas:', error);
    res.status(500).json({ error: 'Error al consultar rango de fechas' });
  }
});

// Ruta para obtener alertas por piscifactoría
router.get('/alertas/piscifactoria/:id', async (req, res) => {
  const piscifactoriaId = parseInt(req.params.id, 10);
  
  // Obtener datos de la base de datos
  const query = `
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
    FROM gloria.alertas a
    LEFT JOIN gloria.piscifactorias p ON a.piscifactoria_id = p.id
    WHERE a.activa = true AND (a.piscifactoria_id = $1 OR a.piscifactoria_id IS NULL)
    ORDER BY a.fecha_inicio DESC
  `;
  
  const result = await queryDB(query, [piscifactoriaId]);
  
  // Si hay datos en la base de datos
  if (result.success && result.data.length > 0) {
    // Transformar resultados al formato esperado por el frontend
    const alertas = result.data.map(row => {
      const tiempoAlerta = new Date(row.tiempo || new Date());
      const ahora = new Date();
      const diferenciaMs = ahora - tiempoAlerta;
      
      // Calcular tiempo relativo
      let tiempoRelativo;
      if (diferenciaMs < 60000) { // menos de 1 minuto
        tiempoRelativo = 'Hace unos segundos';
      } else if (diferenciaMs < 3600000) { // menos de 1 hora
        const minutos = Math.floor(diferenciaMs / 60000);
        tiempoRelativo = `Hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
      } else if (diferenciaMs < 86400000) { // menos de 1 día
        const horas = Math.floor(diferenciaMs / 3600000);
        tiempoRelativo = `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
      } else {
        const dias = Math.floor(diferenciaMs / 86400000);
        tiempoRelativo = `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
      }
      
      return {
        id: row.id,
        titulo: formatearTituloAlerta(row),
        mensaje: row.mensaje || '',
        nivel: row.nivel || 'baja',
        tiempo: row.tiempo,
        tiempoRelativo,
        piscifactoriaId: row.piscifactoriaid
      };
    });
    
    return res.json(alertas);
  }
  
  // Si no hay datos, devolver array vacío
  res.json([]);
});

// Ruta para obtener predicciones
router.get('/predicciones/piscifactoria/:id', async (req, res) => {
  const piscifactoriaId = parseInt(req.params.id, 10);
  
  // Obtener datos reales de predicciones
  const query = `
    SELECT
      va.variable_nombre,
      AVG(va.valor) as valor_promedio,
      MAX(va.valor) as valor_maximo,
      MIN(va.valor) as valor_minimo,
      STDDEV(va.valor) as desviacion,
      COUNT(*) as total_muestras
    FROM gloria.variables_ambientales va
    WHERE va.piscifactoria_id = $1
    AND va.fecha_tiempo > NOW()
    GROUP BY va.variable_nombre
  `;
  
  const result = await queryDB(query, [piscifactoriaId]);
  
  // Si hay datos, transformarlos en predicciones
  let predicciones = [];
  if (result.success && result.data.length > 0) {
    predicciones = result.data.map(row => {
      let titulo, unidad, estado;
      
      switch (row.variable_nombre) {
        case 'temperature':
          titulo = 'Temperatura';
          unidad = '°C';
          estado = row.valor_maximo > 26 ? 'warning' : 'normal';
          break;
        case 'currents':
          titulo = 'Velocidad Máx. Corrientes';
          unidad = 'm/s';
          estado = row.valor_maximo > 0.7 ? 'warning' : 'normal';
          break;
        case 'oxygen':
          titulo = 'Oxígeno Disuelto';
          unidad = 'mg/L';
          estado = row.valor_minimo < 5 ? 'danger' : 'normal';
          break;
        default:
          titulo = row.variable_nombre ? row.variable_nombre.charAt(0).toUpperCase() + row.variable_nombre.slice(1) : 'Variable';
          unidad = '';
          estado = 'normal';
      }
      
      // Calcular confianza en base al número de muestras y desviación
      const confianza = Math.min(95, 50 + ((row.total_muestras || 0) / 2) - ((row.desviacion || 0) * 10));
      
      return {
        id: predicciones.length + 1,
        titulo,
        valor: (row.valor_maximo || 0).toFixed(1),
        unidad,
        periodoTiempo: 'Próximas 48h',
        confianza: Math.round(confianza),
        estado
      };
    });
  }
  
  // Si no hay predicciones, devolver array vacío
  res.json(predicciones);
});

// Ruta para obtener datos históricos para gráficos
router.get('/historico/:variable', async (req, res) => {
  const { variable } = req.params;
  const { piscifactoriaId, periodo, fechaInicio, fechaFin } = req.query;
  
  console.log(`Solicitud de datos históricos recibida: ${variable}`);
  console.log(`Parámetros: periodo=${periodo}, piscifactoriaId=${piscifactoriaId}`);
  
  // Validar parámetros
  if (!variable) {
    return res.status(400).json({ error: 'Se requiere la variable' });
  }
  
  // Determinar el rango de fechas
  let fechaInicial, fechaFinal;
  
  if (fechaInicio && fechaFin) {
    // Si se proporcionan ambas fechas, usar esas
    fechaInicial = new Date(fechaInicio);
    fechaFinal = new Date(fechaFin);
  } else {
    // Si no, calcular según el periodo
    fechaFinal = new Date();
    fechaInicial = new Date();
    
    switch (periodo) {
      case 'day':
        fechaInicial.setDate(fechaInicial.getDate() - 1);
        break;
      case 'week':
        fechaInicial.setDate(fechaInicial.getDate() - 7);
        break;
      case 'month':
        fechaInicial.setMonth(fechaInicial.getMonth() - 1);
        break;
      case 'year':
        fechaInicial.setFullYear(fechaInicial.getFullYear() - 1);
        break;
      default:
        fechaInicial.setDate(fechaInicial.getDate() - 7); // Por defecto: 7 días
    }
  }
  
  // Construir la consulta
  let query, queryParams;
  
  try {
    // Convertir piscifactoriaId a número si está presente
    const piscId = piscifactoriaId ? parseInt(piscifactoriaId, 10) : null;
    
    console.log(`Fechas: desde ${fechaInicial.toISOString()} hasta ${fechaFinal.toISOString()}`);
    console.log(`PiscifactoriaId (convertido): ${piscId}`);
    
    if (piscId) {
      // Consulta para una piscifactoría específica
      query = `
        SELECT 
          fecha_tiempo AS fecha,
          valor
        FROM gloria.variables_ambientales
        WHERE variable_nombre = $1
        AND fecha_tiempo BETWEEN $2 AND $3
        AND piscifactoria_id = $4
        AND valor IS NOT NULL 
        AND valor != 'NaN'
        ORDER BY fecha_tiempo
      `;
      queryParams = [variable, fechaInicial.toISOString(), fechaFinal.toISOString(), piscId];
    } else {
      // Consulta para promedios generales (sin piscifactoría específica)
      query = `
        SELECT 
          fecha_tiempo AS fecha,
          AVG(valor) AS valor
        FROM gloria.variables_ambientales
        WHERE variable_nombre = $1
        AND fecha_tiempo BETWEEN $2 AND $3
        AND valor IS NOT NULL 
        AND valor != 'NaN'
        GROUP BY fecha_tiempo
        ORDER BY fecha_tiempo
      `;
      queryParams = [variable, fechaInicial.toISOString(), fechaFinal.toISOString()];
    }
    
    console.log("Ejecutando consulta SQL:", query);
    console.log("Parámetros:", queryParams);
    
    const result = await pool.query(query, queryParams);
    console.log(`Resultados encontrados: ${result.rows.length}`);
    
    // Mostrar algunos resultados de ejemplo para depurar
    if (result.rows.length > 0) {
      console.log("Ejemplo de datos:", result.rows.slice(0, 3));
    }
    
    // Transformar los resultados
    const datos = result.rows.map(row => ({
      fecha: row.fecha,
      valor: parseFloat((row.valor || 0).toFixed(2))
    }));
    
    res.json({
      variable,
      piscifactoriaId: piscId,
      periodo,
      fechaInicio: fechaInicial.toISOString(),
      fechaFin: fechaFinal.toISOString(),
      datos
    });
  } catch (error) {
    console.error('Error al obtener datos históricos:', error);
    res.status(500).json({ 
      error: 'Error al obtener datos históricos de la base de datos',
      details: error.message
    });
  }
});

// Ruta para exportar datos
router.get('/exportar', (req, res) => {
  // Esta ruta simplemente devuelve mensaje informativo
  res.json({
    success: false,
    message: 'No hay datos disponibles para exportar'
  });
});

// Ruta para obtener datasets disponibles
router.get('/datasets', async (req, res) => {
  // Obtener datos de la base de datos
  const result = await queryDB(`
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
  
  // Si hay datos en la base de datos
  if (result.success && result.data.length > 0) {
    return res.json(result.data);
  }
  
  // Si no hay datos, devolver array vacío
  res.json([]);
});

// Ejecutar script Python de Copernicus
router.post('/copernicus/ejecutar', (req, res) => {
  const scriptPath = path.join(__dirname, '../scripts/get_data_copernicus_and_openwather.py');
  
  // Verificar que el script existe
  if (!fs.existsSync(scriptPath)) {
    return res.status(404).json({ error: 'Script no encontrado' });
  }
  
  // Ejecutar el script Python con manejo de errores
  try {
    exec(`python ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error al ejecutar el script: ${error.message}`);
        return res.status(500).json({ 
          success: false,
          error: 'Error al ejecutar el script', 
          details: error.message 
        });
      }
      
      if (stderr) {
        console.error(`Script error: ${stderr}`);
      }
      
      console.log(`Script output: ${stdout}`);
      
      res.json({
        success: true,
        output: stdout,
        message: 'Script ejecutado correctamente'
      });
    });
  } catch (error) {
    console.error('Error al intentar ejecutar el script:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al intentar ejecutar el script',
      details: error.message
    });
  }
});

export default router;