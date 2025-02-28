// backend/src/routes/api.js (versión con ES Modules)
import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

// Obtener __dirname equivalente en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Ruta para obtener listado de piscifactorías
router.get('/piscifactorias', (req, res) => {
  const piscifactorias = [
    {
      id: 1,
      name: "Centro de Investigación Piscícola de El Palmar",
      location: "El Palmar, Valencia",
      coordinates: [39.4167, -0.3333],
      type: "Investigación",
      species: ["especies dulceacuícolas amenazadas"],
      description: "Gestionado por VAERSA, enfocado en conservación mediante programas de producción y cría en cautividad."
    },
    {
      id: 2,
      name: "Centro de Cultivo de Peces de Tuéjar",
      location: "Tuéjar, Valencia",
      coordinates: [39.8833, -1.0167],
      type: "Producción",
      species: ["trucha arcoíris", "madrilla del Turia"],
      description: "Especializado en trucha arcoíris y madrilla del Turia, con planes para otras especies."
    },
    {
      id: 3,
      name: "Centro de Cultivo de Peces de Aguas Templadas",
      location: "Polinyà del Xúquer, Valencia",
      coordinates: [39.1833, -0.4167],
      type: "Reproducción y Engorde",
      species: ["anguila", "fartet"],
      description: "Dedicado a reproducción y engorde de diversas especies, incluyendo anguila y fartet."
    },
    {
      id: 4,
      name: "Polígono de Acuicultura de San Pedro del Pinatar",
      location: "San Pedro del Pinatar, Murcia",
      coordinates: [37.8667, -0.7833],
      type: "Producción Comercial",
      species: ["dorada", "lubina"],
      description: "El polígono de acuicultura más grande de la Región de Murcia."
    },
    {
      id: 5,
      name: "Piscifactorías de Mazarrón",
      location: "Mazarrón, Murcia",
      coordinates: [37.5667, -1.6000],
      type: "Producción Comercial",
      species: ["dorada", "lubina"],
      description: "Instalaciones dedicadas al cultivo de dorada y lubina."
    }
  ];
  
  res.json(piscifactorias);
});

// Ruta para obtener detalles de una piscifactoría específica
router.get('/piscifactorias/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const piscifactorias = [
    {
      id: 1,
      name: "Centro de Investigación Piscícola de El Palmar",
      location: "El Palmar, Valencia",
      coordinates: [39.4167, -0.3333],
      type: "Investigación",
      species: ["especies dulceacuícolas amenazadas"],
      description: "Gestionado por VAERSA, enfocado en conservación mediante programas de producción y cría en cautividad."
    },
    {
      id: 2,
      name: "Centro de Cultivo de Peces de Tuéjar",
      location: "Tuéjar, Valencia",
      coordinates: [39.8833, -1.0167],
      type: "Producción",
      species: ["trucha arcoíris", "madrilla del Turia"],
      description: "Especializado en trucha arcoíris y madrilla del Turia, con planes para otras especies."
    },
    {
      id: 3,
      name: "Centro de Cultivo de Peces de Aguas Templadas",
      location: "Polinyà del Xúquer, Valencia",
      coordinates: [39.1833, -0.4167],
      type: "Reproducción y Engorde",
      species: ["anguila", "fartet"],
      description: "Dedicado a reproducción y engorde de diversas especies, incluyendo anguila y fartet."
    },
    {
      id: 4,
      name: "Polígono de Acuicultura de San Pedro del Pinatar",
      location: "San Pedro del Pinatar, Murcia",
      coordinates: [37.8667, -0.7833],
      type: "Producción Comercial",
      species: ["dorada", "lubina"],
      description: "El polígono de acuicultura más grande de la Región de Murcia."
    },
    {
      id: 5,
      name: "Piscifactorías de Mazarrón",
      location: "Mazarrón, Murcia",
      coordinates: [37.5667, -1.6000],
      type: "Producción Comercial",
      species: ["dorada", "lubina"],
      description: "Instalaciones dedicadas al cultivo de dorada y lubina."
    }
  ];
  
  const piscifactoria = piscifactorias.find(p => p.id === id);
  
  if (piscifactoria) {
    // Añadir información adicional detallada
    piscifactoria.indicadoresAmbientales = {
      temperatura: {
        valor: 22.4,
        unidad: '°C',
        tendencia: 'up',
        valorTendencia: 0.8,
        umbralMin: 18,
        umbralMax: 26,
        estado: 'normal'
      },
      oxigenoDisuelto: {
        valor: 5.8,
        unidad: 'mg/L',
        tendencia: 'down',
        valorTendencia: 0.3,
        umbralMin: 5,
        umbralMax: 12,
        estado: 'warning'
      },
      corrientes: {
        valor: 0.35,
        unidad: 'm/s',
        tendencia: 'stable',
        valorTendencia: 0.02,
        umbralMin: 0,
        umbralMax: 0.8,
        estado: 'normal'
      },
      salinidad: {
        valor: 36.2,
        unidad: 'ppt',
        tendencia: 'up',
        valorTendencia: 0.5,
        umbralMin: 34,
        umbralMax: 38,
        estado: 'normal'
      }
    };
    
    res.json(piscifactoria);
  } else {
    res.status(404).json({ error: 'Piscifactoría no encontrada' });
  }
});

// Ruta para obtener datos ambientales
router.get('/datos-ambientales', (req, res) => {
  const { fecha, variable } = req.query;
  
  // Validar parámetros
  if (!fecha || !variable) {
    return res.status(400).json({ error: 'Se requieren los parámetros fecha y variable' });
  }
  
  // Simulación de datos según la variable solicitada
  let datos = [];
  const fechaObj = new Date(fecha);
  
  // Crear una cuadrícula de puntos sobre la zona de Valencia y Murcia
  for (let lat = 37.2; lat <= 40.2; lat += 0.1) {
    for (let lng = -1.8; lng <= 0.2; lng += 0.1) {
      // Determinar si el punto está en tierra o mar (simplificado)
      const enMar = lng < -0.2 || (lat > 38 && lat < 39.5 && lng < 0);
      
      if (enMar) {
        // Generar valor según la variable
        let valor;
        switch (variable) {
          case 'temperature':
            // Temperatura decrece con la distancia a la costa y varía según la fecha
            const distanciaCosta = Math.min(Math.abs(lng + 0.3), 0.8);
            const factorEstacional = Math.sin((fechaObj.getMonth() / 12) * Math.PI * 2) * 3 + 20;
            valor = factorEstacional + (distanciaCosta * -2) + (Math.random() * 1.5);
            break;
          case 'salinity':
            // Salinidad aumenta mar adentro
            valor = 35 + (Math.abs(lng + 0.5) * 2) + (Math.random() * 0.5);
            break;
          case 'currents':
            // Corrientes más fuertes mar adentro
            valor = 0.1 + (Math.abs(lng + 0.8) * 0.3) + (Math.random() * 0.2);
            break;
          case 'oxygen':
            // Oxígeno disuelto
            valor = 6 + (Math.random() * 1.5) - (Math.abs(lng + 0.5) * 0.5);
            break;
          default:
            valor = Math.random() * 10;
        }
        
        datos.push({
          lat,
          lng,
          valor: parseFloat(valor.toFixed(2))
        });
      }
    }
  }
  
  res.json({
    fecha,
    variable,
    datos
  });
});

// Ruta para obtener alertas
router.get('/alertas', (req, res) => {
  const alertas = [
    {
      id: 1,
      titulo: 'Nivel de oxígeno bajo',
      mensaje: 'El nivel de oxígeno disuelto está por debajo del umbral óptimo. Se recomienda revisar sistemas de aireación.',
      nivel: 'media',
      tiempo: '2023-02-28T10:25:00Z',
      tiempoRelativo: 'Hace 35 minutos',
      piscifactoriaId: 3
    },
    {
      id: 2,
      titulo: 'Predicción de temporal',
      mensaje: 'Se prevén fuertes vientos y oleaje para los próximos 2 días. Reforzar sistemas de anclaje.',
      nivel: 'alta',
      tiempo: '2023-02-28T09:00:00Z',
      tiempoRelativo: 'Hace 2 horas',
      piscifactoriaId: null // Afecta a todas
    },
    {
      id: 3,
      titulo: 'Mantenimiento programado',
      mensaje: 'Inspección rutinaria de redes programada para mañana a las 10:00h.',
      nivel: 'baja',
      tiempo: '2023-02-28T06:00:00Z',
      tiempoRelativo: 'Hace 5 horas',
      piscifactoriaId: 2
    },
    {
      id: 4,
      titulo: 'Temperatura elevada',
      mensaje: 'La temperatura del agua está acercándose al umbral máximo recomendado.',
      nivel: 'media',
      tiempo: '2023-02-28T08:30:00Z',
      tiempoRelativo: 'Hace 3 horas',
      piscifactoriaId: 5
    },
    {
      id: 5,
      titulo: 'Baja concentración de oxígeno',
      mensaje: 'Se detecta una tendencia negativa en los niveles de oxígeno disuelto.',
      nivel: 'alta',
      tiempo: '2023-02-28T11:00:00Z',
      tiempoRelativo: 'Hace 10 minutos',
      piscifactoriaId: 1
    }
  ];
  
  // Filtrar por piscifactoría si se especifica
  const piscifactoriaId = req.query.piscifactoriaId ? parseInt(req.query.piscifactoriaId) : null;
  
  let alertasFiltradas = alertas;
  if (piscifactoriaId) {
    alertasFiltradas = alertas.filter(a => a.piscifactoriaId === piscifactoriaId || a.piscifactoriaId === null);
  }
  
  res.json(alertasFiltradas);
});

// Ruta para obtener alertas por piscifactoría
router.get('/alertas/piscifactoria/:id', (req, res) => {
  const piscifactoriaId = parseInt(req.params.id);
  
  const alertas = [
    {
      id: 1,
      titulo: 'Nivel de oxígeno bajo',
      mensaje: 'El nivel de oxígeno disuelto está por debajo del umbral óptimo. Se recomienda revisar sistemas de aireación.',
      nivel: 'media',
      tiempo: '2023-02-28T10:25:00Z',
      tiempoRelativo: 'Hace 35 minutos',
      piscifactoriaId: 3
    },
    {
      id: 2,
      titulo: 'Predicción de temporal',
      mensaje: 'Se prevén fuertes vientos y oleaje para los próximos 2 días. Reforzar sistemas de anclaje.',
      nivel: 'alta',
      tiempo: '2023-02-28T09:00:00Z',
      tiempoRelativo: 'Hace 2 horas',
      piscifactoriaId: null // Afecta a todas
    },
    {
      id: 3,
      titulo: 'Mantenimiento programado',
      mensaje: 'Inspección rutinaria de redes programada para mañana a las 10:00h.',
      nivel: 'baja',
      tiempo: '2023-02-28T06:00:00Z',
      tiempoRelativo: 'Hace 5 horas',
      piscifactoriaId: 2
    },
    {
      id: 4,
      titulo: 'Temperatura elevada',
      mensaje: 'La temperatura del agua está acercándose al umbral máximo recomendado.',
      nivel: 'media',
      tiempo: '2023-02-28T08:30:00Z',
      tiempoRelativo: 'Hace 3 horas',
      piscifactoriaId: 5
    },
    {
      id: 5,
      titulo: 'Baja concentración de oxígeno',
      mensaje: 'Se detecta una tendencia negativa en los niveles de oxígeno disuelto.',
      nivel: 'alta',
      tiempo: '2023-02-28T11:00:00Z',
      tiempoRelativo: 'Hace 10 minutos',
      piscifactoriaId: 1
    }
  ];
  
  const alertasFiltradas = alertas.filter(a => a.piscifactoriaId === piscifactoriaId || a.piscifactoriaId === null);
  
  res.json(alertasFiltradas);
});

// Ruta para obtener predicciones
router.get('/predicciones/piscifactoria/:id', (req, res) => {
  const piscifactoriaId = parseInt(req.params.id);
  
  // Simulación de datos de predicción específicos para cada piscifactoría
  const predicciones = [
    {
      id: 1,
      titulo: 'Temperatura',
      valor: (22 + (piscifactoriaId % 3) * 0.6).toFixed(1),
      unidad: '°C',
      periodoTiempo: 'Próximas 48h',
      confianza: 95 - (piscifactoriaId % 10),
      estado: piscifactoriaId % 4 === 0 ? 'warning' : 'normal'
    },
    {
      id: 2,
      titulo: 'Velocidad Máx. Corrientes',
      valor: (0.5 + (piscifactoriaId % 4) * 0.1).toFixed(1),
      unidad: 'm/s',
      periodoTiempo: 'Próximas 72h',
      confianza: 85 - (piscifactoriaId % 15),
      estado: piscifactoriaId % 3 === 0 ? 'warning' : 'normal'
    },
    {
      id: 3,
      titulo: 'Nivel de Riesgo',
      valor: piscifactoriaId % 3 === 0 ? 'Alto' : (piscifactoriaId % 3 === 1 ? 'Moderado' : 'Bajo'),
      unidad: '',
      periodoTiempo: 'Próxima semana',
      confianza: 80 - (piscifactoriaId % 20),
      estado: piscifactoriaId % 3 === 0 ? 'danger' : (piscifactoriaId % 3 === 1 ? 'warning' : 'normal')
    }
  ];
  
  res.json(predicciones);
});

// Ruta para obtener datos históricos para gráficos
router.get('/historico/:variable', (req, res) => {
  const { variable } = req.params;
  const { piscifactoriaId, periodo } = req.query;
  
  // Validar parámetros
  if (!variable) {
    return res.status(400).json({ error: 'Se requiere la variable' });
  }
  
  // Definir los datos base según la variable
  let baseValue, amplitude;
  switch (variable) {
    case 'temperature':
      baseValue = 22;
      amplitude = 1.5;
      break;
    case 'oxygen':
      baseValue = 6;
      amplitude = 0.8;
      break;
    case 'currents':
      baseValue = 0.3;
      amplitude = 0.15;
      break;
    case 'salinity':
      baseValue = 36;
      amplitude = 1.2;
      break;
    default:
      baseValue = 20;
      amplitude = 1;
  }
  
  // Generar datos históricos simulados
  const now = new Date();
  const datos = [];
  
  // Determinar el número de puntos y el paso según el periodo
  let numPoints, step;
  switch (periodo) {
    case 'day':
      numPoints = 24;
      step = 60 * 60 * 1000; // 1 hora en ms
      break;
    case 'week':
      numPoints = 7 * 24;
      step = 60 * 60 * 1000; // 1 hora en ms
      break;
    case 'month':
      numPoints = 30;
      step = 24 * 60 * 60 * 1000; // 1 día en ms
      break;
    case 'year':
      numPoints = 52;
      step = 7 * 24 * 60 * 60 * 1000; // 1 semana en ms
      break;
    default:
      numPoints = 24;
      step = 60 * 60 * 1000; // Por defecto: 1 día con intervalos de 1 hora
  }
  
  // Generar datos con tendencia y componente sinusoidal
  const frequency = 0.2;
  for (let i = 0; i < numPoints; i++) {
    const date = new Date(now.getTime() - (numPoints - i) * step);
    
    // Componentes del valor
    const sinComponent = Math.sin(i * frequency) * amplitude;
    const trendComponent = (i / numPoints) * amplitude * 0.5;
    const noiseComponent = (Math.random() - 0.5) * amplitude * 0.3;
    
    // Valor final con ajuste para piscifactoría específica si se proporcionó ID
    let piscifactoriaAdjustment = 0;
    if (piscifactoriaId) {
      piscifactoriaAdjustment = (parseInt(piscifactoriaId) % 5) * 0.1 * amplitude;
    }
    
    const value = baseValue + sinComponent + trendComponent + noiseComponent + piscifactoriaAdjustment;
    
    datos.push({
      fecha: date.toISOString(),
      valor: parseFloat(Math.max(0, value).toFixed(2)) // Asegurar valores no negativos
    });
  }
  
  res.json({
    variable,
    piscifactoriaId: piscifactoriaId ? parseInt(piscifactoriaId) : null,
    periodo,
    datos
  });
});

// Ruta para exportar datos
router.get('/exportar', (req, res) => {
  // Esta sería una ruta mock que simplemente devuelve un mensaje de éxito
  res.json({
    success: true,
    message: 'Exportación simulada completada con éxito'
  });
});

// Ejecutar script Python de Copernicus
router.post('/copernicus/ejecutar', (req, res) => {
  const scriptPath = path.join(__dirname, '../scripts/get_data_copernicus_and_openwather.py');
  
  // Verificar que el script existe
  if (!fs.existsSync(scriptPath)) {
    return res.status(404).json({ error: 'Script no encontrado' });
  }
  
  // Ejecutar el script Python
  exec(`python ${scriptPath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error al ejecutar el script: ${error.message}`);
      return res.status(500).json({ error: 'Error al ejecutar el script', details: error.message });
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
});

export default router;