import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import {
  generarDatosTemperatura,
  generarDatosCorrientes,
  generarPiscifactorias,
  generarAlertas,
  generarDatosCorrientesVectoriales,
  generarAnalisisRiesgo,
  generarPrediccionRiesgo,
  generarResumenRiesgo
} from '../services/mockDataService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Flag para detectar si la DB está disponible
let dbDisponible = true;

// Helper para ejecutar consultas SQL con manejo de errores
async function queryDB(sql, params = []) {
  try {
    const result = await pool.query(sql, params);
    dbDisponible = true;
    return { success: true, data: result.rows };
  } catch (error) {
    console.error('Error en consulta a la base de datos:', error.message);
    dbDisponible = false;
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
      '/copernicus/ejecutar',
      '/corrientes',
      '/corrientes/riesgo/:id',
      '/corrientes/prediccion/:id',
      '/predicciones/escapes/:id',
      '/predicciones/escapes/:id/historial',
      '/riesgo/resumen'
    ]
  });
});

// Obtener datos de corrientes (vo) para visualización vectorial
router.get('/corrientes', async (req, res) => {
  const { fecha } = req.query;
  
  // Usar la fecha proporcionada o la fecha actual
  const fechaConsulta = fecha || new Date().toISOString().split('T')[0];
  
  try {
    const result = await queryDB(`
      SELECT 
        va.id,
        va.variable_nombre,
        va.fecha_tiempo,
        va.valor,
        ST_X(va.geometria) as lng,
        ST_Y(va.geometria) as lat,
        va.profundidad
      FROM gloria.variables_ambientales va
      WHERE va.variable_nombre = 'vo'
      AND DATE(va.fecha_tiempo) = DATE($1)
      ORDER BY va.fecha_tiempo DESC
    `, [fechaConsulta]);
    
    if (result.success && result.data.length > 0) {
      // Transformar a formato más adecuado para visualización vectorial
      const datos = result.data.map(row => ({
        lat: row.lat || 0,
        lng: row.lng || 0,
        valor: parseFloat((row.valor || 0).toFixed(2)),
        direccion: Math.random() * 360, // Esto debería venir de tus datos reales
        profundidad: row.profundidad || 0,
        fecha: row.fecha_tiempo
      }));
      
      res.json({
        fecha: fechaConsulta,
        variable: 'vo',
        datos
      });
    } else {
      // Si no hay datos, generar datos simulados
      console.log('⚠️  No hay datos de corrientes en DB, generando datos simulados');
      const datosSimulados = generarDatosCorrientesVectoriales(new Date(fechaConsulta));
      res.json(datosSimulados);
    }
  } catch (error) {
    console.error('Error al obtener datos de corrientes:', error);
    // En caso de error, generar datos simulados
    console.log('⚠️  Error en DB, generando datos simulados de corrientes');
    const datosSimulados = generarDatosCorrientesVectoriales(new Date(fechaConsulta || new Date()));
    res.json(datosSimulados);
  }
});

// Obtener análisis de riesgo de corrientes para una piscifactoría específica
router.get('/corrientes/riesgo/:id', async (req, res) => {
  const piscifactoriaId = parseInt(req.params.id, 10);
  
  try {
    // Obtener los datos de corrientes más recientes para esta piscifactoría
    const result = await queryDB(`
      SELECT 
        va.valor,
        va.fecha_tiempo,
        p.nombre,
        p.tipo
      FROM gloria.variables_ambientales va
      JOIN gloria.piscifactorias p ON va.piscifactoria_id = p.id
      WHERE va.variable_nombre = 'vo'
      AND va.piscifactoria_id = $1
      ORDER BY va.fecha_tiempo DESC
      LIMIT 1
    `, [piscifactoriaId]);
    
    if (result.success && result.data.length > 0) {
      const dato = result.data[0];
      
      // Calcular índice de riesgo basado en velocidad de corriente
      // Esto es una simplificación - en un sistema real sería más complejo
      const velocidad = dato.valor || 0;
      let indiceRiesgo = 0;
      let nivelRiesgo = 'bajo';
      
      // Umbrales de velocidad para riesgo
      const umbralAdvertencia = 0.5; // m/s
      const umbralPeligro = 0.8;     // m/s
      
      if (velocidad < umbralAdvertencia) {
        // Riesgo bajo (0-3)
        indiceRiesgo = (velocidad / umbralAdvertencia) * 3;
      } else if (velocidad < umbralPeligro) {
        // Riesgo medio (3-7)
        const rango = umbralPeligro - umbralAdvertencia;
        const posicion = velocidad - umbralAdvertencia;
        indiceRiesgo = 3 + (posicion / rango) * 4;
      } else {
        // Riesgo alto (7-10)
        const excesoFactor = Math.min((velocidad - umbralPeligro) / 0.5, 1);
        indiceRiesgo = 7 + excesoFactor * 3;
      }
      
      if (indiceRiesgo < 3.5) {
        nivelRiesgo = 'bajo';
      } else if (indiceRiesgo < 7) {
        nivelRiesgo = 'medio';
      } else {
        nivelRiesgo = 'alto';
      }
      
      // Crear respuesta
      res.json({
        piscifactoria: {
          id: piscifactoriaId,
          nombre: dato.nombre,
          tipo: dato.tipo
        },
        analisisRiesgo: {
          indice: parseFloat(indiceRiesgo.toFixed(1)),
          nivel: nivelRiesgo,
          velocidadActual: parseFloat(velocidad.toFixed(2)),
          umbralAdvertencia,
          umbralPeligro,
          fechaAnalisis: dato.fecha_tiempo,
          factores: [
            {
              nombre: 'Velocidad de corriente',
              valor: parseFloat(velocidad.toFixed(2)),
              unidad: 'm/s',
              contribucion: parseFloat((velocidad / umbralPeligro * 5).toFixed(1))
            }
            // Aquí podrías añadir más factores
          ]
        }
      });
    } else {
      // Si no hay datos, generar análisis simulado
      console.log('⚠️  No hay datos para análisis de riesgo, generando simulado');
      const analisisSimulado = generarAnalisisRiesgo(piscifactoriaId);
      res.json(analisisSimulado);
    }
  } catch (error) {
    console.error('Error al obtener análisis de riesgo:', error);
    // En caso de error, generar análisis simulado
    console.log('⚠️  Error en DB, generando análisis de riesgo simulado');
    const analisisSimulado = generarAnalisisRiesgo(piscifactoriaId);
    res.json(analisisSimulado);
  }
});

// Obtener predicción de corrientes para una piscifactoría específica
router.get('/corrientes/prediccion/:id', async (req, res) => {
  const piscifactoriaId = parseInt(req.params.id, 10);
  const { dias = 1 } = req.query; // Por defecto, predicción para 1 día
  
  try {
    // Obtener datos históricos recientes para usar en la predicción
    const result = await queryDB(`
      SELECT 
        va.valor,
        va.fecha_tiempo
      FROM gloria.variables_ambientales va
      WHERE va.variable_nombre = 'vo'
      AND va.piscifactoria_id = $1
      AND va.fecha_tiempo > NOW() - INTERVAL '7 days'
      ORDER BY va.fecha_tiempo DESC
      LIMIT 48
    `, [piscifactoriaId]);
    
    if (result.success && result.data.length > 0) {
      // En un sistema real, aquí usarías los datos históricos para generar
      // una predicción más precisa. Como simplificación, generaremos datos
      // basados en los últimos valores disponibles.
      
      const datosHistoricos = result.data;
      const ultimoValor = datosHistoricos[0].valor || 0;
      const prediccion = [];
      
      // Generar predicción para los próximos días
      const ahora = new Date();
      const numPredicciones = parseInt(dias) * 8; // 8 predicciones por día
      
      for (let i = 0; i < numPredicciones; i++) {
        const horaPrediccion = new Date(ahora.getTime() + i * 3 * 60 * 60 * 1000); // cada 3 horas
        
        // Generar valor con variación aleatoria basada en el último valor
        const variacion = (Math.random() - 0.5) * 0.2; // +/- 10% de variación
        const valorPrediccion = Math.max(0, ultimoValor + variacion);
        
        prediccion.push({
          fecha: horaPrediccion.toISOString(),
          valor: parseFloat(valorPrediccion.toFixed(2))
        });
      }
      
      res.json({
        piscifactoriaId,
        variable: 'vo',
        diasPrediccion: parseInt(dias),
        prediccion
      });
    } else {
      res.status(404).json({ 
        error: 'No hay suficientes datos históricos para generar una predicción',
        piscifactoriaId
      });
    }
  } catch (error) {
    console.error('Error al generar predicción de corrientes:', error);
    res.status(500).json({ 
      error: 'Error al generar predicción de corrientes',
      details: error.message
    });
  }
});

// Obtener analisis de riesgo de una piscifactoría específica
router.get('/riesgo/escapes/:id', async (req, res) => {
  const piscifactoriaId = parseInt(req.params.id, 10);
  
  try {
    // Obtener los datos de olas más recientes para esta piscifactoría
    const result = await queryDB(`
      SELECT 
        va.valor as altura_olas,
        va.fecha_tiempo,
        p.nombre,
        p.tipo
      FROM gloria.variables_ambientales va
      JOIN gloria.piscifactorias p ON va.piscifactoria_id = p.id
      WHERE va.variable_nombre = 'wave_height'
      AND va.piscifactoria_id = $1
      ORDER BY va.fecha_tiempo DESC
      LIMIT 2
    `, [piscifactoriaId]);
    
    if (result.success && result.data.length > 0) {
      const dato = result.data[0];
      const datoPrevio = result.data.length > 1 ? result.data[1] : null;
      
      // Obtener datos de corrientes
      const corrientesResult = await queryDB(`
        SELECT 
          va.valor
        FROM gloria.variables_ambientales va
        WHERE va.variable_nombre IN ('uo', 'vo')
        AND va.piscifactoria_id = $1
        ORDER BY va.fecha_tiempo DESC
        LIMIT 2
      `, [piscifactoriaId]);
      
      // Calcular velocidad de corriente
      let velocidadCorriente = 0;
      if (corrientesResult.success && corrientesResult.data.length > 0) {
        // Si hay datos de ambas componentes, calcular magnitud
        if (corrientesResult.data.length >= 2) {
          const uo = corrientesResult.data[0].valor || 0;
          const vo = corrientesResult.data[1].valor || 0;
          velocidadCorriente = Math.sqrt(uo*uo + vo*vo);
        } else {
          velocidadCorriente = corrientesResult.data[0].valor || 0;
        }
      }
      
      // Calcular índice de riesgo basado en altura de olas actual y del día anterior
      // Según el paper, el día anterior tiene mayor impacto
      const alturaActual = dato.altura_olas || 0;
      const alturaPrevia = datoPrevio ? datoPrevio.altura_olas || 0 : 0;
      
      // Pesos basados en el paper: mayor peso al día anterior
      const pesoActual = 0.3;
      const pesoPrevio = 0.7;
      const pesoCorriente = 0.2;
      
      // Cálculo básico del índice (0-10)
      let indiceRiesgo = 0;
      
      // Contribución de altura actual
      let contribucionActual = 0;
      if (alturaActual < 1.5) {
        contribucionActual = alturaActual / 1.5 * 3; // 0-3 para olas pequeñas
      } else if (alturaActual < 3) {
        contribucionActual = 3 + (alturaActual - 1.5) / 1.5 * 3; // 3-6 para olas medianas
      } else {
        contribucionActual = 6 + Math.min(4, (alturaActual - 3) * 2); // 6-10 para olas grandes
      }
      
      // Contribución de altura previa (mayor peso según el paper)
      let contribucionPrevia = 0;
      if (alturaPrevia < 1.5) {
        contribucionPrevia = alturaPrevia / 1.5 * 3;
      } else if (alturaPrevia < 3) {
        contribucionPrevia = 3 + (alturaPrevia - 1.5) / 1.5 * 3;
      } else {
        contribucionPrevia = 6 + Math.min(4, (alturaPrevia - 3) * 2);
      }
      
      // Contribución de corrientes
      let contribucionCorriente = 0;
      if (velocidadCorriente < 0.3) {
        contribucionCorriente = velocidadCorriente / 0.3 * 3;
      } else if (velocidadCorriente < 0.8) {
        contribucionCorriente = 3 + (velocidadCorriente - 0.3) / 0.5 * 4;
      } else {
        contribucionCorriente = 7 + Math.min(3, (velocidadCorriente - 0.8) * 5);
      }
      
      // Índice combinado
      indiceRiesgo = (
        pesoActual * contribucionActual + 
        pesoPrevio * contribucionPrevia + 
        pesoCorriente * contribucionCorriente
      ) / (pesoActual + pesoPrevio + pesoCorriente);
      
      // Limitar a 10
      indiceRiesgo = Math.min(10, indiceRiesgo);
      
      // Determinar nivel de riesgo
      let nivelRiesgo = 'bajo';
      if (indiceRiesgo >= 7) {
        nivelRiesgo = 'alto';
      } else if (indiceRiesgo >= 3.5) {
        nivelRiesgo = 'medio';
      }
      
      // Calcular probabilidad de escape
      const probabilidadEscape = indiceRiesgo / 10;
      
      // Crear respuesta
      res.json({
        piscifactoria: {
          id: piscifactoriaId,
          nombre: dato.nombre,
          tipo: dato.tipo
        },
        analisisRiesgo: {
          indice: parseFloat(indiceRiesgo.toFixed(1)),
          nivel: nivelRiesgo,
          probabilidad: parseFloat(probabilidadEscape.toFixed(2)),
          factores: [
            {
              nombre: "Altura de olas (día anterior)",
              valor: parseFloat(alturaPrevia.toFixed(2)),
              unidad: "m",
              contribucion: parseFloat(contribucionPrevia.toFixed(1)),
              umbral: 3.0
            },
            {
              nombre: "Altura de olas actual",
              valor: parseFloat(alturaActual.toFixed(2)),
              unidad: "m",
              contribucion: parseFloat(contribucionActual.toFixed(1)),
              umbral: 3.0
            },
            {
              nombre: "Velocidad de corriente",
              valor: parseFloat(velocidadCorriente.toFixed(2)),
              unidad: "m/s",
              contribucion: parseFloat(contribucionCorriente.toFixed(1)),
              umbral: 0.8
            }
          ],
          fechaAnalisis: dato.fecha_tiempo
        }
      });
    } else {
      res.status(404).json({ 
        error: 'No se encontraron datos suficientes para esta piscifactoría',
        piscifactoriaId
      });
    }
  } catch (error) {
    console.error('Error al obtener análisis de riesgo:', error);
    res.status(500).json({ 
      error: 'Error al obtener análisis de riesgo',
      details: error.message
    });
  }
});

// Obtener predicción de riesgo de escapes para una piscifactoría
router.get('/riesgo/prediccion/:id', async (req, res) => {
  const piscifactoriaId = parseInt(req.params.id, 10);
  const { dias = 7 } = req.query; // Por defecto, predicción para 7 días
  
  try {
    // Obtener datos históricos recientes para usar en la predicción
    const result = await queryDB(`
      SELECT 
        va.variable_nombre,
        va.valor,
        va.fecha_tiempo
      FROM gloria.variables_ambientales va
      WHERE va.variable_nombre IN ('wave_height', 'uo', 'vo')
      AND va.piscifactoria_id = $1
      AND va.fecha_tiempo > NOW() - INTERVAL '7 days'
      ORDER BY va.fecha_tiempo DESC
      LIMIT 50
    `, [piscifactoriaId]);
    
    if (result.success && result.data.length > 0) {
      // Agrupar datos por variable
      const groupedData = result.data.reduce((acc, item) => {
        if (!acc[item.variable_nombre]) {
          acc[item.variable_nombre] = [];
        }
        acc[item.variable_nombre].push(item);
        return acc;
      }, {});
      
      // Obtener últimos valores conocidos
      const lastWaveHeight = groupedData.wave_height && groupedData.wave_height.length > 0 
        ? groupedData.wave_height[0].valor : 1.5;
      
      // Calcular últimas corrientes
      let lastCurrents = 0.3;
      if (groupedData.uo && groupedData.uo.length > 0 && groupedData.vo && groupedData.vo.length > 0) {
        const uo = groupedData.uo[0].valor || 0;
        const vo = groupedData.vo[0].valor || 0;
        lastCurrents = Math.sqrt(uo*uo + vo*vo);
      }
      
      // Generar predicción para los próximos días
      const predicciones = [];
      const ahora = new Date();
      const numPredicciones = parseInt(dias);
      
      // Simular una posible tormenta en los próximos días para ilustrar cambios en el riesgo
      for (let i = 0; i < numPredicciones; i++) {
        const fecha = new Date(ahora);
        fecha.setDate(fecha.getDate() + i);
        
        // Simular un escenario de tormenta que llega en 3 días, alcanza su pico, y luego baja
        let factorOlas = 1.0;
        if (i >= 3 && i <= 5) {
          // La tormenta llega en día 3 y alcanza su pico en día 5
          factorOlas = 1.0 + (i - 2) * 0.4;
        } else if (i > 5) {
          // La tormenta disminuye después del día 5
          factorOlas = 2.2 - (i - 5) * 0.3;
          factorOlas = Math.max(1.0, factorOlas);
        }
        
        // Simular alturas de ola basadas en último valor conocido y factor de tormenta
        const alturaOla = lastWaveHeight * factorOlas;
        const alturaOlaPrevia = i > 0 ? predicciones[i-1].wave_height : lastWaveHeight;
        
        // Simular corrientes
        const corrientes = lastCurrents * (0.8 + 0.4 * factorOlas);
        
        // Calcular índice de riesgo siguiendo la misma lógica que en el endpoint anterior
        const pesoActual = 0.3;
        const pesoPrevio = 0.7;
        const pesoCorriente = 0.2;
        
        let contribucionActual = 0;
        if (alturaOla < 1.5) {
          contribucionActual = alturaOla / 1.5 * 3;
        } else if (alturaOla < 3) {
          contribucionActual = 3 + (alturaOla - 1.5) / 1.5 * 3;
        } else {
          contribucionActual = 6 + Math.min(4, (alturaOla - 3) * 2);
        }
        
        let contribucionPrevia = 0;
        if (alturaOlaPrevia < 1.5) {
          contribucionPrevia = alturaOlaPrevia / 1.5 * 3;
        } else if (alturaOlaPrevia < 3) {
          contribucionPrevia = 3 + (alturaOlaPrevia - 1.5) / 1.5 * 3;
        } else {
          contribucionPrevia = 6 + Math.min(4, (alturaOlaPrevia - 3) * 2);
        }
        
        let contribucionCorriente = 0;
        if (corrientes < 0.3) {
          contribucionCorriente = corrientes / 0.3 * 3;
        } else if (corrientes < 0.8) {
          contribucionCorriente = 3 + (corrientes - 0.3) / 0.5 * 4;
        } else {
          contribucionCorriente = 7 + Math.min(3, (corrientes - 0.8) * 5);
        }
        
        const indiceRiesgo = Math.min(10, (
          pesoActual * contribucionActual + 
          pesoPrevio * contribucionPrevia + 
          pesoCorriente * contribucionCorriente
        ) / (pesoActual + pesoPrevio + pesoCorriente));
        
        let nivelRiesgo = 'bajo';
        if (indiceRiesgo >= 7) {
          nivelRiesgo = 'alto';
        } else if (indiceRiesgo >= 3.5) {
          nivelRiesgo = 'medio';
        }
        
        const probabilidadEscape = indiceRiesgo / 10;
        
        predicciones.push({
          fecha: fecha.toISOString(),
          wave_height: parseFloat(alturaOla.toFixed(2)),
          prev_day_wave: parseFloat(alturaOlaPrevia.toFixed(2)),
          current: parseFloat(corrientes.toFixed(2)),
          indice: parseFloat(indiceRiesgo.toFixed(1)),
          nivel: nivelRiesgo,
          probabilidad: parseFloat(probabilidadEscape.toFixed(2))
        });
      }
      
      res.json({
        piscifactoriaId,
        predicciones
      });
    } else {
      // Si no hay datos, generar predicción simulada
      console.log('⚠️  No hay datos para predicción, generando simulado');
      const prediccionSimulada = generarPrediccionRiesgo(piscifactoriaId, parseInt(dias));
      res.json(prediccionSimulada);
    }
  } catch (error) {
    console.error('Error al generar predicción de riesgo:', error);
    // En caso de error, generar predicción simulada
    console.log('⚠️  Error en DB, generando predicción simulada');
    const prediccionSimulada = generarPrediccionRiesgo(piscifactoriaId, parseInt(dias || 7));
    res.json(prediccionSimulada);
  }
});

router.get('/riesgo/actual', async (req, res) => {
  try {
    const result = await queryDB(`
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
        FROM gloria.piscifactorias p
        JOIN gloria.prediccion_escapes pe ON p.id = pe.piscifactoria_id
        WHERE p.tipo = 'marina' AND p.activo = TRUE
      )
      SELECT * FROM ultimos_datos WHERE rn = 1
      ORDER BY indice_riesgo DESC
    `);
    
    res.json(result.success ? result.data : []);
  } catch (error) {
    console.error('Error al obtener datos de riesgo actual:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.get('/riesgo/historico/:id', async (req, res) => {
  const piscifactoriaId = parseInt(req.params.id, 10);
  const { desde, hasta } = req.query;
  
  try {
    const result = await queryDB(`
      SELECT 
        fecha,
        altura_olas,
        altura_olas_dia_anterior,
        velocidad_corriente,
        indice_riesgo,
        nivel_riesgo,
        prediccion_probabilidad
      FROM gloria.prediccion_escapes
      WHERE piscifactoria_id = $1
      AND fecha BETWEEN $2::date AND $3::date
      ORDER BY fecha
    `, [piscifactoriaId, desde || '2022-01-01', hasta || 'NOW()']);
    
    res.json(result.success ? result.data : []);
  } catch (error) {
    console.error('Error al obtener histórico de riesgo:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Nuevo endpoint para obtener predicciones de escapes basadas en la tabla prediccion_escapes
router.get('/predicciones/escapes/:id', async (req, res) => {
  const piscifactoriaId = parseInt(req.params.id, 10);
  
  try {
    // Obtener la predicción más reciente para esta piscifactoría
    const result = await queryDB(`
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
      FROM gloria.prediccion_escapes pe
      JOIN gloria.piscifactorias p ON pe.piscifactoria_id = p.id
      WHERE pe.piscifactoria_id = $1
      ORDER BY pe.fecha DESC, pe.fecha_prediccion DESC
      LIMIT 1
    `, [piscifactoriaId]);
    
    if (result.success && result.data.length > 0) {
      const prediccion = result.data[0];
      
      // Calcular porcentaje de riesgo basado en el índice (0-10 a 0-100%)
      const riesgoPorcentaje = Math.min(100, Math.round(prediccion.indice_riesgo * 10));
      
      // Crear respuesta con formato amigable para el frontend
      res.json({
        id: prediccion.id,
        piscifactoria: {
          id: prediccion.piscifactoria_id,
          nombre: prediccion.piscifactoria_nombre
        },
        fecha: prediccion.fecha,
        riesgo: {
          indice: parseFloat(prediccion.indice_riesgo.toFixed(1)),
          porcentaje: riesgoPorcentaje,
          nivel: prediccion.nivel_riesgo,
          probabilidad: parseFloat((prediccion.prediccion_probabilidad * 100).toFixed(1))
        },
        factores: [
          {
            nombre: "Altura de olas (día anterior)",
            valor: parseFloat(prediccion.altura_olas_dia_anterior.toFixed(2)),
            unidad: "m",
            contribucion: Math.round(prediccion.altura_olas_dia_anterior * 2) // Estimación simplificada
          },
          {
            nombre: "Altura de olas actual",
            valor: parseFloat(prediccion.altura_olas.toFixed(2)),
            unidad: "m",
            contribucion: Math.round(prediccion.altura_olas * 1.5) // Estimación simplificada
          },
          {
            nombre: "Velocidad de corriente",
            valor: parseFloat(prediccion.velocidad_corriente.toFixed(2)),
            unidad: "m/s",
            contribucion: Math.round(prediccion.velocidad_corriente * 5) // Estimación simplificada
          }
        ],
        fecha_actualizacion: prediccion.fecha_prediccion
      });
    } else {
      res.status(404).json({ 
        error: 'No se encontraron predicciones para esta piscifactoría',
        piscifactoriaId
      });
    }
  } catch (error) {
    console.error('Error al obtener predicción de escape:', error);
    res.status(500).json({ 
      error: 'Error al obtener predicción de escape',
      details: error.message
    });
  }
});

// Nuevo endpoint para obtener historial de predicciones
router.get('/predicciones/escapes/:id/historial', async (req, res) => {
  const piscifactoriaId = parseInt(req.params.id, 10);
  const { dias = 30 } = req.query; // Por defecto, mostrar últimos 30 días
  
  try {
    // Obtener predicciones para este período
    const result = await queryDB(`
      SELECT 
        pe.fecha,
        pe.indice_riesgo,
        pe.nivel_riesgo,
        pe.prediccion_probabilidad,
        pe.altura_olas,
        pe.altura_olas_dia_anterior,
        pe.velocidad_corriente
      FROM gloria.prediccion_escapes pe
      WHERE pe.piscifactoria_id = $1
      AND pe.fecha > CURRENT_DATE - INTERVAL '1 day' * $2
      ORDER BY pe.fecha
    `, [piscifactoriaId, dias]);
    
    if (result.success) {
      // Transformar datos para incluir porcentaje
      const predicciones = result.data.map(pred => ({
        fecha: pred.fecha,
        indice_riesgo: parseFloat(pred.indice_riesgo.toFixed(1)),
        porcentaje_riesgo: Math.min(100, Math.round(pred.indice_riesgo * 10)),
        nivel_riesgo: pred.nivel_riesgo,
        probabilidad: parseFloat((pred.prediccion_probabilidad * 100).toFixed(1)),
        factores: {
          altura_olas: parseFloat(pred.altura_olas.toFixed(2)),
          altura_olas_anterior: parseFloat(pred.altura_olas_dia_anterior.toFixed(2)),
          velocidad_corriente: parseFloat(pred.velocidad_corriente.toFixed(2))
        }
      }));
      
      res.json({
        piscifactoriaId,
        dias: parseInt(dias),
        predicciones
      });
    } else {
      res.json({
        piscifactoriaId,
        dias: parseInt(dias),
        predicciones: []
      });
    }
  } catch (error) {
    console.error('Error al obtener historial de predicciones:', error);
    res.status(500).json({ 
      error: 'Error al obtener historial de predicciones',
      details: error.message
    });
  }
});

// Nuevo endpoint para obtener resumen de riesgo para todas las piscifactorías
router.get('/riesgo/resumen', async (req, res) => {
  try {
    // Obtener resumen de predicciones más recientes para todas las piscifactorías
    const result = await queryDB(`
      WITH ultimas_predicciones AS (
        SELECT
          pe.piscifactoria_id,
          MAX(pe.fecha) as ultima_fecha
        FROM gloria.prediccion_escapes pe
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
      FROM gloria.prediccion_escapes pe
      JOIN ultimas_predicciones up ON pe.piscifactoria_id = up.piscifactoria_id AND pe.fecha = up.ultima_fecha
      JOIN gloria.piscifactorias p ON pe.piscifactoria_id = p.id
      ORDER BY pe.indice_riesgo DESC
    `);

    if (result.success && result.data.length > 0) {
      // Transformar resultados para incluir porcentaje
      const resumen = result.data.map(pred => ({
        piscifactoria: {
          id: pred.piscifactoria_id,
          nombre: pred.piscifactoria_nombre,
          tipo: pred.piscifactoria_tipo,
          coordenadas: [pred.latitud, pred.longitud]
        },
        riesgo: {
          indice: parseFloat(pred.indice_riesgo.toFixed(1)),
          porcentaje: Math.min(100, Math.round(pred.indice_riesgo * 10)),
          nivel: pred.nivel_riesgo,
          probabilidad: parseFloat((pred.prediccion_probabilidad * 100).toFixed(1))
        },
        fecha: pred.fecha
      }));

      res.json(resumen);
    } else {
      // Si no hay datos, generar resumen simulado
      console.log('⚠️  No hay datos de resumen de riesgo, generando simulado');
      const resumenSimulado = generarResumenRiesgo();
      res.json(resumenSimulado);
    }
  } catch (error) {
    console.error('Error al obtener resumen de riesgo:', error);
    // En caso de error, generar resumen simulado
    console.log('⚠️  Error en DB, generando resumen de riesgo simulado');
    const resumenSimulado = generarResumenRiesgo();
    res.json(resumenSimulado);
  }
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

  // Si no hay datos o hay un error, usar datos simulados
  console.log('⚠️  DB no disponible, usando datos simulados de piscifactorías');
  res.json(generarPiscifactorias());
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
  const { fecha, variable, piscifactoriaId } = req.query;

  if (!fecha || !variable) {
    return res.status(400).json({ error: 'Se requieren los parámetros fecha y variable' });
  }

  try {
    // Mapeo de variables según el tipo
    let variablesToCheck = [variable];
    
    // Añadir nombres alternativos de variables
    if (variable === 'temperatura' || variable === 'temperature' || variable === 'temp') {
      variablesToCheck = ['temperatura', 'temperature', 'temp', 'temperatura_agua'];
    } else if (variable === 'uo' || variable === 'corrientes' || variable === 'corriente_u') {
      variablesToCheck = ['uo', 'corrientes', 'current', 'corriente_u'];
    } else if (variable === 'vo' || variable === 'corriente_v') {
      variablesToCheck = ['vo', 'corriente_v'];
    } else if (variable === 'so' || variable === 'salinidad') {
      variablesToCheck = ['so', 'salinidad'];
    } else if (variable === 'hfds' || variable === 'flujo_calor') {
      variablesToCheck = ['hfds', 'hfls', 'hfss', 'flujo_calor_superficie'];
    } else if (variable === 'zos' || variable === 'altura_superficie') {
      variablesToCheck = ['zos', 'altura_superficie_mar'];
    }
    
    // Construir la consulta SQL dinámica
    const placeholders = variablesToCheck.map((_, i) => `$${i + 1}`).join(',');
    let sql = `
      SELECT 
        va.id,
        va.variable_nombre,
        va.fecha_tiempo,
        va.valor,
        ST_AsGeoJSON(va.geometria)::json as geometria
      FROM gloria.variables_ambientales va
      WHERE va.variable_nombre IN (${placeholders})
      AND DATE(va.fecha_tiempo) = DATE($${variablesToCheck.length + 1})
    `;
    
    // Parámetros iniciales
    let params = [...variablesToCheck, fecha];
    
    // Añadir filtro por piscifactoría si se proporciona
    if (piscifactoriaId) {
      sql += ` AND va.piscifactoria_id = $${params.length + 1}`;
      params.push(piscifactoriaId);
    } else {
      sql += ` AND va.piscifactoria_id IS NULL`;
    }
    
    // Limitar resultados para rendimiento
    sql += ` LIMIT 500`;

    console.log("SQL:", sql);
    console.log("Params:", params);
    
    const result = await queryDB(sql, params);

    // Si no hay resultados, probar con fechas alternativas (buscar la más cercana)
    if (!result.success || result.data.length === 0) {
      console.log(`No se encontraron datos para ${variable} en fecha ${fecha}, buscando fecha más cercana`);
      
      // Construir consulta para encontrar la fecha más cercana
      const dateQuery = `
        SELECT DISTINCT DATE(fecha_tiempo) as fecha
        FROM gloria.variables_ambientales
        WHERE variable_nombre IN (${placeholders})
        ORDER BY ABS(DATE(fecha_tiempo) - DATE($${variablesToCheck.length + 1})::date)
        LIMIT 1
      `;
      
      const dateResult = await queryDB(dateQuery, [...variablesToCheck, fecha]);
      
      if (dateResult.success && dateResult.data.length > 0) {
        const closestDate = dateResult.data[0].fecha;
        console.log(`Fecha más cercana encontrada: ${closestDate}`);
        
        // Actualizar parámetros con la nueva fecha
        params[variablesToCheck.length] = closestDate;
        
        // Ejecutar consulta con la fecha más cercana
        const newResult = await queryDB(sql, params);
        
        if (newResult.success && newResult.data.length > 0) {
          return res.json({
            fecha: closestDate,
            variable,
            nota: `No se encontraron datos para la fecha solicitada (${fecha}). Se muestran datos de la fecha más cercana (${closestDate}).`,
            datos: newResult.data
          });
        }
      }
    }

    return res.json({
      fecha,
      variable,
      datos: result.success ? result.data : []
    });
    
  } catch (error) {
    console.error(`Error al obtener datos ambientales para ${variable}:`, error);
    res.status(500).json({ error: 'Error al consultar la base de datos' });
  }
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
// Ruta para obtener datos históricos para gráficos
router.get('/historico/:variable', async (req, res) => {
  const { variable } = req.params;
  const { piscifactoriaId, periodo, fechaInicio, fechaFin } = req.query;
  
  console.log(`Solicitud de datos históricos recibida: ${variable}`);
  console.log(`Parámetros: periodo=${periodo}, piscifactoriaId=${piscifactoriaId}, fechaInicio=${fechaInicio}, fechaFin=${fechaFin}`);
  
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
  
  try {
    // Mapeo de variables según el tipo
    let variablesToCheck = [variable];
    
    // Añadir nombres alternativos de variables
    if (variable === 'temperatura' || variable === 'temperature' || variable === 'temp') {
      variablesToCheck = ['temperatura', 'temperature', 'temp', 'temperatura_agua'];
    } else if (variable === 'uo' || variable === 'corrientes' || variable === 'corriente_u') {
      variablesToCheck = ['uo', 'corrientes', 'current', 'corriente_u'];
    } else if (variable === 'vo' || variable === 'corriente_v') {
      variablesToCheck = ['vo', 'corriente_v'];
    } else if (variable === 'so' || variable === 'salinidad') {
      variablesToCheck = ['so', 'salinidad'];
    }
    
    // Construir la consulta SQL
    let query = `
      SELECT 
        fecha_tiempo AS fecha,
        valor
      FROM gloria.variables_ambientales
      WHERE variable_nombre IN (${variablesToCheck.map((_, i) => `$${i + 3}`).join(',')})
      AND fecha_tiempo BETWEEN $1 AND $2
    `;
    
    // Parámetros para la consulta
    let queryParams = [fechaInicial.toISOString(), fechaFinal.toISOString(), ...variablesToCheck];
    
    // Añadir condición para piscifactoría si se proporciona
    if (piscifactoriaId) {
      query += ` AND piscifactoria_id = $${queryParams.length + 1}`;
      queryParams.push(piscifactoriaId);
    }
    
    // Filtrar valores nulos o inválidos
    query += ` AND valor IS NOT NULL AND valor != 'NaN' AND valor > -9990`;
    
    // Ordenar por fecha
    query += ` ORDER BY fecha_tiempo`;
    
    console.log("Ejecutando consulta SQL:", query);
    console.log("Parámetros:", queryParams);
    
    const result = await pool.query(query, queryParams);
    console.log(`Resultados encontrados: ${result.rows.length}`);

    // Si no hay resultados, usar datos simulados
    if (result.rows.length === 0) {
      console.log('⚠️  No hay datos en DB, generando datos simulados');
      let datosMock = [];

      if (variable === 'temperatura' || variable === 'temperature' || variable === 'temp') {
        datosMock = generarDatosTemperatura(piscifactoriaId || 1, fechaInicial, fechaFinal);
      } else if (variable === 'corrientes' || variable === 'current' || variable === 'vo' || variable === 'uo') {
        datosMock = generarDatosCorrientes(piscifactoriaId || 1, fechaInicial, fechaFinal);
      } else {
        // Para otras variables, generar datos genéricos
        datosMock = generarDatosTemperatura(piscifactoriaId || 1, fechaInicial, fechaFinal);
      }

      return res.json({
        variable,
        piscifactoriaId: piscifactoriaId ? parseInt(piscifactoriaId, 10) : null,
        periodo,
        fechaInicio: fechaInicial.toISOString(),
        fechaFin: fechaFinal.toISOString(),
        datos: datosMock,
        mock: true
      });
    }

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
      piscifactoriaId: piscifactoriaId ? parseInt(piscifactoriaId, 10) : null,
      periodo,
      fechaInicio: fechaInicial.toISOString(),
      fechaFin: fechaFinal.toISOString(),
      datos
    });
  } catch (error) {
    console.error('Error al obtener datos históricos:', error);

    // En caso de error, también generar datos simulados
    console.log('⚠️  Error en DB, generando datos simulados');
    let datosMock = [];

    if (variable === 'temperatura' || variable === 'temperature' || variable === 'temp') {
      datosMock = generarDatosTemperatura(piscifactoriaId || 1, fechaInicial, fechaFinal);
    } else if (variable === 'corrientes' || variable === 'current' || variable === 'vo' || variable === 'uo') {
      datosMock = generarDatosCorrientes(piscifactoriaId || 1, fechaInicial, fechaFinal);
    } else {
      datosMock = generarDatosTemperatura(piscifactoriaId || 1, fechaInicial, fechaFinal);
    }

    res.json({
      variable,
      piscifactoriaId: piscifactoriaId ? parseInt(piscifactoriaId, 10) : null,
      periodo,
      fechaInicio: fechaInicial.toISOString(),
      fechaFin: fechaFinal.toISOString(),
      datos: datosMock,
      mock: true
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