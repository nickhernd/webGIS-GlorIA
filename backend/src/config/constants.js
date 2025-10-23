/**
 * @fileoverview Constantes globales del sistema
 * @description Centraliza todos los valores mágicos, umbrales y configuraciones
 * del sistema para facilitar el mantenimiento y evitar código espagueti.
 *
 * @module config/constants
 * @author GlorIA Team
 * @version 1.0.0
 */

/**
 * Umbrales para el cálculo de riesgo de corrientes
 * @const {Object}
 * @property {number} UMBRAL_ADVERTENCIA - Velocidad de corriente en m/s que genera advertencia
 * @property {number} UMBRAL_PELIGRO - Velocidad de corriente en m/s que indica peligro
 */
export const CORRIENTES_UMBRALES = {
  UMBRAL_ADVERTENCIA: 0.5,  // m/s
  UMBRAL_PELIGRO: 0.8,       // m/s
  VELOCIDAD_BAJA: 0.3        // m/s
};

/**
 * Umbrales para el análisis de altura de olas
 * @const {Object}
 * @property {number} OLAS_PEQUENAS - Altura en metros considerada pequeña
 * @property {number} OLAS_MEDIANAS - Altura en metros considerada mediana
 * @property {number} OLAS_GRANDES - Altura en metros considerada grande
 */
export const OLAS_UMBRALES = {
  OLAS_PEQUENAS: 1.5,   // metros
  OLAS_MEDIANAS: 3.0,   // metros
  OLAS_GRANDES: 3.0     // metros (umbral crítico)
};

/**
 * Umbrales para variables ambientales de piscifactorías
 * @const {Object}
 */
export const VARIABLES_AMBIENTALES_UMBRALES = {
  TEMPERATURA: {
    MIN: 18,      // °C
    MAX: 26,      // °C
    UNIDAD: '°C'
  },
  OXIGENO: {
    MIN: 5,       // mg/L
    MAX: 12,      // mg/L
    UNIDAD: 'mg/L'
  },
  SALINIDAD: {
    MIN: 34,      // ppt
    MAX: 38,      // ppt
    UNIDAD: 'ppt'
  },
  CORRIENTES: {
    MIN: 0,       // m/s
    MAX: 0.8,     // m/s
    UNIDAD: 'm/s'
  }
};

/**
 * Pesos para el cálculo del índice de riesgo de escapes
 * Basados en estudios científicos donde el día anterior tiene mayor impacto
 *
 * @const {Object}
 * @property {number} PESO_ACTUAL - Peso de la altura de olas actual
 * @property {number} PESO_PREVIO - Peso de la altura de olas del día anterior
 * @property {number} PESO_CORRIENTE - Peso de la velocidad de corriente
 */
export const PESOS_RIESGO = {
  PESO_ACTUAL: 0.3,
  PESO_PREVIO: 0.7,      // Mayor peso según literatura científica
  PESO_CORRIENTE: 0.2
};

/**
 * Niveles de riesgo según el índice calculado
 * @const {Object}
 */
export const NIVELES_RIESGO = {
  BAJO: {
    NOMBRE: 'bajo',
    UMBRAL_MIN: 0,
    UMBRAL_MAX: 3.5
  },
  MEDIO: {
    NOMBRE: 'medio',
    UMBRAL_MIN: 3.5,
    UMBRAL_MAX: 7
  },
  ALTO: {
    NOMBRE: 'alto',
    UMBRAL_MIN: 7,
    UMBRAL_MAX: 10
  }
};

/**
 * Configuración de intervalos de tiempo
 * @const {Object}
 */
export const INTERVALOS_TIEMPO = {
  PREDICCION_HORAS: 3,           // Intervalo entre predicciones en horas
  PREDICCIONES_POR_DIA: 8,       // Número de predicciones por día
  DIAS_HISTORICO_DEFECTO: 7,     // Días de histórico por defecto
  HORAS_DATOS_RECIENTES: 24      // Horas para considerar datos recientes
};

/**
 * Límites de consulta y rendimiento
 * @const {Object}
 */
export const LIMITES_CONSULTA = {
  MAX_DATOS_AMBIENTALES: 500,    // Máximo de registros en consultas ambientales
  MAX_ALERTAS_DASHBOARD: 4,       // Máximo de alertas mostradas en dashboard
  MAX_PREDICCIONES_HISTORICAS: 50 // Máximo de predicciones históricas
};

/**
 * Factores de conversión y normalización
 * @const {Object}
 */
export const FACTORES_CONVERSION = {
  INDICE_A_PORCENTAJE: 10,       // Factor para convertir índice (0-10) a porcentaje (0-100)
  MAX_INDICE_RIESGO: 10,         // Valor máximo del índice de riesgo
  MIN_INDICE_RIESGO: 0           // Valor mínimo del índice de riesgo
};

/**
 * Rangos para escalas de contribución
 * @const {Object}
 */
export const RANGOS_CONTRIBUCION = {
  BAJO: { MIN: 0, MAX: 3 },
  MEDIO: { MIN: 3, MAX: 6 },
  ALTO: { MIN: 6, MAX: 10 }
};

/**
 * Configuración de tiempos de cache y actualización
 * @const {Object}
 */
export const CACHE_CONFIG = {
  TTL_DATOS_AMBIENTALES: 300,    // 5 minutos en segundos
  TTL_PREDICCIONES: 3600,        // 1 hora en segundos
  TTL_ALERTAS: 60                // 1 minuto en segundos
};

/**
 * Mapeo de nombres de variables ambientales
 * Permite flexibilidad en los nombres de variables entre diferentes fuentes
 *
 * @const {Object}
 */
export const MAPEO_VARIABLES = {
  temperatura: ['temperatura', 'temperature', 'temp', 'temperatura_agua'],
  corrientes: ['uo', 'vo', 'corrientes', 'current', 'corriente_u', 'corriente_v'],
  uo: ['uo', 'corriente_u'],
  vo: ['vo', 'corriente_v'],
  salinidad: ['so', 'salinidad'],
  flujo_calor: ['hfds', 'hfls', 'hfss', 'flujo_calor_superficie'],
  altura_superficie: ['zos', 'altura_superficie_mar'],
  altura_olas: ['wave_height', 'altura_olas']
};

/**
 * Tipos de alertas del sistema
 * @const {Object}
 */
export const TIPOS_ALERTA = {
  TEMPERATURA: 'temperature',
  OXIGENO: 'oxygen',
  CORRIENTES: 'currents',
  MANTENIMIENTO: 'maintenance',
  METEOROLOGICA: 'weather'
};

/**
 * Estados del sistema
 * @const {Object}
 */
export const ESTADOS_SISTEMA = {
  NORMAL: 'normal',
  ADVERTENCIA: 'warning',
  PELIGRO: 'danger'
};

/**
 * Configuración de períodos de consulta
 * @const {Object}
 */
export const PERIODOS_CONSULTA = {
  DIA: 'day',
  SEMANA: 'week',
  MES: 'month',
  ANIO: 'year'
};

/**
 * Configuración de días para cada período
 * @const {Object}
 */
export const DIAS_POR_PERIODO = {
  [PERIODOS_CONSULTA.DIA]: 1,
  [PERIODOS_CONSULTA.SEMANA]: 7,
  [PERIODOS_CONSULTA.MES]: 30,
  [PERIODOS_CONSULTA.ANIO]: 365
};

/**
 * Mensajes de error estandarizados
 * @const {Object}
 */
export const MENSAJES_ERROR = {
  DB_CONNECTION: 'Error al conectar con la base de datos',
  DB_QUERY: 'Error en consulta a la base de datos',
  DATOS_NO_ENCONTRADOS: 'No se encontraron datos',
  PARAMETROS_INVALIDOS: 'Parámetros inválidos o faltantes',
  SERVIDOR_INTERNO: 'Error interno del servidor',
  RECURSO_NO_ENCONTRADO: 'Recurso no encontrado',
  DATOS_INSUFICIENTES: 'Datos insuficientes para generar resultado'
};

/**
 * Configuración de formato de respuestas HTTP
 * @const {Object}
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500
};

/**
 * Configuración del esquema de base de datos
 * @const {Object}
 */
export const DB_CONFIG = {
  SCHEMA: 'gloria',
  TABLAS: {
    PISCIFACTORIAS: 'piscifactorias',
    VARIABLES_AMBIENTALES: 'variables_ambientales',
    ALERTAS: 'alertas',
    DATASETS: 'datasets',
    PREDICCION_ESCAPES: 'prediccion_escapes'
  }
};

/**
 * Configuración de formatos de fecha
 * @const {Object}
 */
export const FORMATO_FECHA = {
  ISO: 'YYYY-MM-DDTHH:mm:ssZ',
  FECHA_SIMPLE: 'YYYY-MM-DD',
  FECHA_HORA: 'YYYY-MM-DD HH:mm:ss'
};

export default {
  CORRIENTES_UMBRALES,
  OLAS_UMBRALES,
  VARIABLES_AMBIENTALES_UMBRALES,
  PESOS_RIESGO,
  NIVELES_RIESGO,
  INTERVALOS_TIEMPO,
  LIMITES_CONSULTA,
  FACTORES_CONVERSION,
  RANGOS_CONTRIBUCION,
  CACHE_CONFIG,
  MAPEO_VARIABLES,
  TIPOS_ALERTA,
  ESTADOS_SISTEMA,
  PERIODOS_CONSULTA,
  DIAS_POR_PERIODO,
  MENSAJES_ERROR,
  HTTP_STATUS,
  DB_CONFIG,
  FORMATO_FECHA
};
