<!-- frontend/src/components/StatsComponent.vue -->
<template>
  <div class="stats-dashboard">
    <div class="stats-header">
      <h2>{{ selectedFarm ? selectedFarm.name : 'Estadísticas Generales' }}</h2>
      <div v-if="selectedFarm" class="farm-info">
        <span><strong>Ubicación:</strong> {{ selectedFarm.location }}</span>
        <span><strong>Tipo:</strong> {{ selectedFarm.type }}</span>
      </div>
    </div>
    
    <!-- Tabs de navegación -->
    <div class="stats-tabs">
      <div 
        v-for="tab in tabs" 
        :key="tab.id" 
        class="tab" 
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.name }}
      </div>
    </div>

    <!-- Contenido de las pestañas -->
    <div class="tab-content">
      <!-- Panel de resumen -->
      <div v-if="activeTab === 'summary'" class="tab-pane">
        <div class="indicators-grid">
          <div class="indicator" v-for="(indicator, index) in keyIndicators" :key="index">
            <div class="indicator-title">{{ indicator.name }}</div>
            <div class="indicator-value" :class="getValueClass(indicator)">
              {{ indicator.value }}{{ indicator.unit }}
            </div>
            <div class="indicator-trend">
              <span :class="indicator.trend === 'up' ? 'trend-up' : indicator.trend === 'down' ? 'trend-down' : ''">
                {{ indicator.trend === 'up' ? '↑' : indicator.trend === 'down' ? '↓' : '→' }}
                {{ indicator.trendValue }}{{ indicator.unit }}
              </span>
            </div>
          </div>
        </div>
        
        <!-- Gráfico principal -->
        <div class="main-chart-section">
          <h3>Serie Temporal - {{ getVariableName(selectedVariable) }}</h3>
          <div ref="mainChartContainer" class="chart-container"></div>
          <div class="chart-controls">
            <div class="chart-control-item">
              <label for="variable-select">Variable:</label>
              <select id="variable-select" v-model="selectedVariable" @change="updateMainChart">
                <option value="temperature">Temperatura</option>
                <option value="oxygen">Oxígeno Disuelto</option>
                <option value="currents">Corrientes</option>
                <option value="salinity">Salinidad</option>
              </select>
            </div>
            <div class="chart-control-item">
              <label for="timeframe-select">Período:</label>
              <select id="timeframe-select" v-model="selectedTimeframe" @change="updateMainChart">
                <option value="day">Últimas 24h</option>
                <option value="week">Última semana</option>
                <option value="month">Último mes</option>
                <option value="year">Último año</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Resumen de alertas -->
        <div class="alerts-summary-section">
          <h3>Resumen de Alertas</h3>
          <div class="alerts-boxes">
            <div class="alert-box high">
              <div class="alert-count">{{ alertsCount.high }}</div>
              <div class="alert-label">Alta Prioridad</div>
            </div>
            <div class="alert-box medium">
              <div class="alert-count">{{ alertsCount.medium }}</div>
              <div class="alert-label">Media Prioridad</div>
            </div>
            <div class="alert-box low">
              <div class="alert-count">{{ alertsCount.low }}</div>
              <div class="alert-label">Baja Prioridad</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Panel de alertas detalladas -->
      <div v-if="activeTab === 'alerts'" class="tab-pane">
        <h3>Alertas Activas</h3>
        <div class="alerts-list-detailed">
          <div v-if="alerts.length === 0" class="no-alerts">
            No hay alertas activas en este momento.
          </div>
          <div v-for="(alert, index) in alerts" :key="index" 
               class="alert-item-detailed" 
               :class="{ 'high': alert.level === 'alta', 'medium': alert.level === 'media', 'low': alert.level === 'baja' }">
            <div class="alert-header">
              <div class="alert-title">
                <span class="alert-icon">
                  <span v-if="alert.level === 'alta'">⚠️</span>
                  <span v-else-if="alert.level === 'media'">⚠</span>
                  <span v-else>ℹ️</span>
                </span>
                {{ alert.title }}
              </div>
              <div class="alert-time">{{ alert.time }}</div>
            </div>
            <div class="alert-message">{{ alert.message }}</div>
            <div class="alert-actions">
              <button class="action-btn resolve">Marcar como resuelta</button>
              <button class="action-btn details">Ver detalles</button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Panel de predicciones -->
      <div v-if="activeTab === 'predictions'" class="tab-pane">
        <h3>Predicciones y Análisis</h3>
        
        <!-- Gráfico de predicción -->
        <div class="prediction-chart-section">
          <div ref="predictionChartContainer" class="prediction-chart-container"></div>
          <div class="chart-legend">
            <div class="legend-item">
              <span class="color-box" style="background-color: #3498db;"></span>
              <span>Datos históricos</span>
            </div>
            <div class="legend-item">
              <span class="color-box" style="background-color: #f39c12;"></span>
              <span>Predicción</span>
            </div>
            <div class="legend-item">
              <span class="color-box dashed" style="background-color: #e74c3c;"></span>
              <span>Umbral crítico</span>
            </div>
          </div>
        </div>
        
        <!-- Métricas de predicción -->
        <div class="prediction-metrics">
          <div class="prediction-item" v-for="(prediction, index) in predictions" :key="index">
            <div class="prediction-header">
              <span class="prediction-title">{{ prediction.title }}</span>
              <span class="prediction-time">{{ prediction.timeframe }}</span>
            </div>
            <div class="prediction-value" :class="getPredictionClass(prediction)">
              {{ prediction.value }}{{ prediction.unit }}
            </div>
            <div class="prediction-confidence">
              Confianza: {{ prediction.confidence }}%
              <div class="confidence-bar">
                <div class="confidence-fill" :style="{ width: prediction.confidence + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Panel de datos ambientales -->
      <div v-if="activeTab === 'environment'" class="tab-pane">
        <h3>Datos Ambientales</h3>
        
        <div class="environment-grid">
          <div class="env-panel">
            <h4>Temperatura del Agua</h4>
            <div ref="tempGaugeContainer" class="gauge-container"></div>
            <div class="env-stats">
              <div class="env-stat">
                <span class="label">Min:</span>
                <span class="value">21.2 °C</span>
              </div>
              <div class="env-stat">
                <span class="label">Promedio:</span>
                <span class="value">22.4 °C</span>
              </div>
              <div class="env-stat">
                <span class="label">Max:</span>
                <span class="value">23.8 °C</span>
              </div>
            </div>
          </div>
          
          <div class="env-panel">
            <h4>Oxígeno Disuelto</h4>
            <div ref="oxygenGaugeContainer" class="gauge-container"></div>
            <div class="env-stats">
              <div class="env-stat">
                <span class="label">Min:</span>
                <span class="value">5.2 mg/L</span>
              </div>
              <div class="env-stat">
                <span class="label">Promedio:</span>
                <span class="value">5.8 mg/L</span>
              </div>
              <div class="env-stat">
                <span class="label">Max:</span>
                <span class="value">6.5 mg/L</span>
              </div>
            </div>
          </div>
          
          <div class="env-panel">
            <h4>Corrientes</h4>
            <div ref="currentsGaugeContainer" class="gauge-container"></div>
            <div class="env-stats">
              <div class="env-stat">
                <span class="label">Min:</span>
                <span class="value">0.12 m/s</span>
              </div>
              <div class="env-stat">
                <span class="label">Promedio:</span>
                <span class="value">0.35 m/s</span>
              </div>
              <div class="env-stat">
                <span class="label">Max:</span>
                <span class="value">0.58 m/s</span>
              </div>
            </div>
          </div>
          
          <div class="env-panel">
            <h4>Salinidad</h4>
            <div ref="salinityGaugeContainer" class="gauge-container"></div>
            <div class="env-stats">
              <div class="env-stat">
                <span class="label">Min:</span>
                <span class="value">35.8 ppt</span>
              </div>
              <div class="env-stat">
                <span class="label">Promedio:</span>
                <span class="value">36.2 ppt</span>
              </div>
              <div class="env-stat">
                <span class="label">Max:</span>
                <span class="value">36.7 ppt</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="historical-data-section">
          <h4>Tendencias Históricas</h4>
          <div ref="historicalChartContainer" class="historical-chart-container"></div>
          <div class="chart-controls">
            <div class="chart-control-item">
              <label for="historical-variable">Variable:</label>
              <select id="historical-variable" v-model="historicalVariable" @change="updateHistoricalChart">
                <option value="temperature">Temperatura</option>
                <option value="oxygen">Oxígeno Disuelto</option>
                <option value="currents">Corrientes</option>
                <option value="salinity">Salinidad</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Panel de infraestructura -->
      <div v-if="activeTab === 'infrastructure'" class="tab-pane">
        <h3>Estado de Infraestructura</h3>
        
        <div class="infrastructure-status">
          <div class="status-item" v-for="(item, index) in infrastructureItems" :key="index">
            <div class="status-header">
              <span class="status-title">{{ item.name }}</span>
              <span class="status-indicator" :class="item.status"></span>
            </div>
            <div class="status-details">
              <div class="detail-row">
                <span class="detail-label">Última revisión:</span>
                <span class="detail-value">{{ item.lastCheck }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Próxima revisión:</span>
                <span class="detail-value">{{ item.nextCheck }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Estado:</span>
                <span class="detail-value">{{ item.statusText }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="maintenance-schedule">
          <h4>Calendario de Mantenimiento</h4>
          <div class="schedule-item" v-for="(task, index) in maintenanceTasks" :key="index">
            <div class="task-date">{{ task.date }}</div>
            <div class="task-content">
              <div class="task-title">{{ task.title }}</div>
              <div class="task-description">{{ task.description }}</div>
            </div>
            <div class="task-status" :class="task.status">{{ task.statusText }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch, computed } from 'vue';
import { useStore } from 'vuex';
import * as d3 from 'd3';

export default {
  name: 'StatsComponent',
  emits: ['variable-changed'],
  props: {
    selectedFarmId: {
      type: Number,
      default: null
    },
    fishFarms: {
      type: Array,
      default: () => []
    },
    date: {
      type: Date,
      default: () => new Date()
    }
  },
  
  setup(props, { emit }) {
    // Referencias para gráficos
    const mainChartContainer = ref(null);
    const predictionChartContainer = ref(null);
    const tempGaugeContainer = ref(null);
    const oxygenGaugeContainer = ref(null);
    const currentsGaugeContainer = ref(null);
    const salinityGaugeContainer = ref(null);
    const historicalChartContainer = ref(null);
    
    // Variables de estado
    const selectedVariable = ref('temperature');
    const selectedTimeframe = ref('week');
    const historicalVariable = ref('temperature');
    const activeTab = ref('summary');
    
    // Pestañas disponibles
    const tabs = [
      { id: 'summary', name: 'Resumen' },
      { id: 'alerts', name: 'Alertas' },
      { id: 'predictions', name: 'Predicciones' },
      { id: 'environment', name: 'Datos Ambientales' },
      { id: 'infrastructure', name: 'Infraestructura' }
    ];
    
    // Información de la piscifactoría seleccionada
    const selectedFarm = computed(() => {
      if (!props.selectedFarmId) return null;
      return props.fishFarms.find(farm => farm.id === props.selectedFarmId);
    });
    
    // Indicadores clave simulados
    const keyIndicators = ref([
      {
        name: 'Temperatura',
        value: '22.4',
        unit: '°C',
        trend: 'up',
        trendValue: '0.8',
        threshold: { min: 18, max: 26 },
        status: 'normal'
      },
      {
        name: 'Oxígeno Disuelto',
        value: '5.8',
        unit: 'mg/L',
        trend: 'down',
        trendValue: '0.3',
        threshold: { min: 5, max: 12 },
        status: 'warning'
      },
      {
        name: 'Corrientes',
        value: '0.35',
        unit: 'm/s',
        trend: 'stable',
        trendValue: '0.02',
        threshold: { min: 0, max: 0.8 },
        status: 'normal'
      },
      {
        name: 'Salinidad',
        value: '36.2',
        unit: 'ppt',
        trend: 'up',
        trendValue: '0.5',
        threshold: { min: 34, max: 38 },
        status: 'normal'
      }
    ]);
    
    // Alertas simuladas
    const alerts = ref([
      {
        title: 'Nivel de oxígeno bajo',
        message: 'El nivel de oxígeno disuelto está por debajo del umbral óptimo. Se recomienda revisar sistemas de aireación.',
        level: 'media',
        time: 'Hace 35 minutos'
      },
      {
        title: 'Predicción de temporal',
        message: 'Se prevén fuertes vientos y oleaje para los próximos 2 días. Reforzar sistemas de anclaje.',
        level: 'alta',
        time: 'Hace 2 horas'
      },
      {
        title: 'Mantenimiento programado',
        message: 'Inspección rutinaria de redes programada para mañana a las 10:00h.',
        level: 'baja',
        time: 'Hace 5 horas'
      }
    ]);
    
    // Conteo de alertas por nivel
    const alertsCount = computed(() => {
      const count = { high: 0, medium: 0, low: 0 };
      alerts.value.forEach(alert => {
        if (alert.level === 'alta') count.high++;
        else if (alert.level === 'media') count.medium++;
        else count.low++;
      });
      return count;
    });
    
    // Predicciones simuladas
    const predictions = ref([
      {
        title: 'Temperatura',
        value: '23.8',
        unit: '°C',
        timeframe: 'Próximas 48h',
        confidence: 95,
        status: 'normal'
      },
      {
        title: 'Velocidad Máx. Corrientes',
        value: '0.7',
        unit: 'm/s',
        timeframe: 'Próximas 72h',
        confidence: 85,
        status: 'warning'
      },
      {
        title: 'Nivel de Riesgo',
        value: 'Moderado',
        unit: '',
        timeframe: 'Próxima semana',
        confidence: 80,
        status: 'warning'
      }
    ]);
    
    // Items de infraestructura
    const infrastructureItems = ref([
      {
        name: 'Sistema de Jaulas',
        status: 'good',
        lastCheck: '15/02/2025',
        nextCheck: '15/03/2025',
        statusText: 'Óptimo'
      },
      {
        name: 'Sistema de Anclaje',
        status: 'warning',
        lastCheck: '10/02/2025',
        nextCheck: '10/03/2025',
        statusText: 'Requiere revisión'
      },
      {
        name: 'Redes',
        status: 'good',
        lastCheck: '20/02/2025',
        nextCheck: '20/03/2025',
        statusText: 'Óptimo'
      },
      {
        name: 'Sistema de Monitorización',
        status: 'good',
        lastCheck: '18/02/2025',
        nextCheck: '18/03/2025',
        statusText: 'Óptimo'
      },
      {
        name: 'Sistemas de Alimentación',
        status: 'danger',
        lastCheck: '05/02/2025',
        nextCheck: '05/03/2025',
        statusText: 'Requiere mantenimiento urgente'
      }
    ]);
    
    // Tareas de mantenimiento
    const maintenanceTasks = ref([
      {
        date: '01/03/2025',
        title: 'Revisión de Redes',
        description: 'Inspección de integridad y limpieza de redes en todas las jaulas.',
        status: 'pending',
        statusText: 'Pendiente'
      },
      {
        date: '05/03/2025',
        title: 'Mantenimiento Sistema de Alimentación',
        description: 'Reparación del sistema automático de dosificación.',
        status: 'urgent',
        statusText: 'Urgente'
      },
      {
        date: '12/03/2025',
        title: 'Calibración de Sensores',
        description: 'Calibración periódica de sensores de temperatura y oxígeno.',
        status: 'pending',
        statusText: 'Pendiente'
      },
      {
        date: '20/02/2025',
        title: 'Inspección de Anclajes',
        description: 'Revisión completa del sistema de anclaje y tensores.',
        status: 'completed',
        statusText: 'Completado'
      }
    ]);
    
    // Métodos para clases CSS condicionales
    const getValueClass = (indicator) => {
      if (indicator.status === 'warning') return 'warning-value';
      if (indicator.status === 'danger') return 'danger-value';
      return 'normal-value';
    };
    
    const getPredictionClass = (prediction) => {
      if (prediction.status === 'warning') return 'warning-value';
      if (prediction.status === 'danger') return 'danger-value';
      return 'normal-value';
    };
    
    // Métodos para el gráfico principal
    const createMainChart = () => {
      if (!mainChartContainer.value) return;
      
      // Limpiar gráfico anterior si existe
      d3.select(mainChartContainer.value).selectAll("*").remove();
      
      // Dimensiones
      const margin = {top: 20, right: 30, bottom: 40, left: 50};
      const width = mainChartContainer.value.clientWidth - margin.left - margin.right;
      const height = 280 - margin.top - margin.bottom;
      
      // Datos simulados para diferentes variables y timeframes
      const data = generateChartData();
      
      // Crear SVG
      const svg = d3.select(mainChartContainer.value)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
        
      // Escalas
      const x = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([0, width]);
        
      const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value) * 1.1])
        .range([height, 0]);
        
      // Ejes
      svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));
        
      svg.append("g")
        .call(d3.axisLeft(y));
        
      // Línea
      const line = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);
        
      svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#3498db")
        .attr("stroke-width", 2)
        .attr("d", line);
        
      // Puntos
      svg.selectAll(".dot")
        .data(data)
        .enter().append("circle")
        .attr("class", "dot")
        .attr("cx", d => x(d.date))
        .attr("cy", d => y(d.value))
        .attr("r", 4)
        .attr("fill", "#3498db");
        
      // Tooltip
      const tooltip = d3.select(mainChartContainer.value)
        .append("div")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("background", "white")
        .style("border", "1px solid #ddd")
        .style("border-radius", "3px")
        .style("padding", "5px")
        .style("pointer-events", "none");
        
      svg.selectAll(".dot")
        .on("mouseover", function(event, d) {
          d3.select(this).attr("r", 6);
          tooltip
            .style("visibility", "visible")
            .html(`<strong>${d3.timeFormat("%d/%m/%Y %H:%M")(d.date)}</strong><br>${d.value}${getUnitByVariable(selectedVariable.value)}`);
        })
        .on("mousemove", function(event) {
          tooltip
            .style("top", (event.pageY - 10) + "px")
            .style("left", (event.pageX + 10) + "px");
        })
        .on("mouseout", function() {
          d3.select(this).attr("r", 4);
          tooltip.style("visibility", "hidden");
        });
    };
    
    // Crear gráfico de predicción
    const createPredictionChart = () => {
      if (!predictionChartContainer.value) return;
      
      // Limpiar gráfico anterior si existe
      d3.select(predictionChartContainer.value).selectAll("*").remove();
      
      // Dimensiones
      const margin = {top: 20, right: 30, bottom: 40, left: 50};
      const width = predictionChartContainer.value.clientWidth - margin.left - margin.right;
      const height = 280 - margin.top - margin.bottom;
      
      // Datos históricos y de predicción
      const historicalData = generateChartData().slice(-10);
      const now = new Date();
      
      // Generar datos de predicción (5 días futuros)
      const predictionData = [];
      for (let i = 1; i <= 5; i++) {
        const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
        
        // Valor con tendencia ascendente y algo de ruido
        const baseValue = parseFloat(historicalData[historicalData.length - 1].value);
        const trend = i * 0.2;
        const noise = (Math.random() - 0.5) * 0.3;
        
        const value = baseValue + trend + noise;
        
        predictionData.push({
          date,
          value: Math.max(0, value) // Asegurar valores no negativos
        });
      }
      
      // Crear SVG
      const svg = d3.select(predictionChartContainer.value)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
        
      // Escalas
      const x = d3.scaleTime()
        .domain([
          d3.min(historicalData, d => d.date),
          d3.max(predictionData, d => d.date)
        ])
        .range([0, width]);
        
      const y = d3.scaleLinear()
        .domain([
          0,
          d3.max([...historicalData, ...predictionData], d => d.value) * 1.2
        ])
        .range([height, 0]);
        
      // Ejes
      svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));
        
      svg.append("g")
        .call(d3.axisLeft(y));
        
      // Línea para datos históricos
      const historicalLine = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);
        
      svg.append("path")
        .datum(historicalData)
        .attr("fill", "none")
        .attr("stroke", "#3498db")
        .attr("stroke-width", 2)
        .attr("d", historicalLine);
      
      // Línea para predicción
      const predictionLine = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);
        
      svg.append("path")
        .datum(predictionData)
        .attr("fill", "none")
        .attr("stroke", "#f39c12")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5")
        .attr("d", predictionLine);
        
      // Línea de umbral
      const thresholdValue = getThresholdByVariable();
      
      svg.append("line")
        .attr("x1", 0)
        .attr("y1", y(thresholdValue))
        .attr("x2", width)
        .attr("y2", y(thresholdValue))
        .attr("stroke", "#e74c3c")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "5,5");
      
      // Puntos históricos
      svg.selectAll(".historical-dot")
        .data(historicalData)
        .enter().append("circle")
        .attr("class", "historical-dot")
        .attr("cx", d => x(d.date))
        .attr("cy", d => y(d.value))
        .attr("r", 4)
        .attr("fill", "#3498db");
        
      // Puntos de predicción
      svg.selectAll(".prediction-dot")
        .data(predictionData)
        .enter().append("circle")
        .attr("class", "prediction-dot")
        .attr("cx", d => x(d.date))
        .attr("cy", d => y(d.value))
        .attr("r", 4)
        .attr("fill", "#f39c12");
        
      // Añadir etiqueta para el umbral
      svg.append("text")
        .attr("x", width)
        .attr("y", y(thresholdValue) - 5)
        .attr("text-anchor", "end")
        .attr("font-size", "12px")
        .attr("fill", "#e74c3c")
        .text(`Umbral: ${thresholdValue}${getUnitByVariable(selectedVariable.value)}`);
    };
    
    // Crear medidores para variables ambientales
    const createGauges = () => {
      createGauge(tempGaugeContainer.value, 22.4, [18, 26], '°C', 'temperature');
      createGauge(oxygenGaugeContainer.value, 5.8, [5, 12], 'mg/L', 'oxygen');
      createGauge(currentsGaugeContainer.value, 0.35, [0, 0.8], 'm/s', 'currents');
      createGauge(salinityGaugeContainer.value, 36.2, [34, 38], 'ppt', 'salinity');
    };
    
    const createGauge = (container, value, range, unit, type) => {
      if (!container) return;
      
      // Limpiar contenedor
      d3.select(container).selectAll("*").remove();
      
      // Dimensiones
      const width = container.clientWidth;
      const height = 150;
      const radius = Math.min(width, height) / 2 * 0.8;
      
      // Crear SVG
      const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);
      
      // Escala para el medidor
      const scale = d3.scaleLinear()
        .domain([0, range[1] * 1.2])
        .range([-Math.PI * 0.75, Math.PI * 0.75]);
      
      // Arco de fondo
      const backgroundArc = d3.arc()
        .innerRadius(radius * 0.7)
        .outerRadius(radius)
        .startAngle(-Math.PI * 0.75)
        .endAngle(Math.PI * 0.75);
      
      svg.append("path")
        .attr("d", backgroundArc)
        .style("fill", "#ecf0f1");
      
      // Determinar color según el valor
      let color = "#2ecc71"; // Normal (verde)
      if (value < range[0]) {
        color = "#e74c3c"; // Bajo el umbral (rojo)
      } else if (value > range[1]) {
        color = "#e74c3c"; // Sobre el umbral (rojo)
      } else if (value < range[0] * 1.1 || value > range[1] * 0.9) {
        color = "#f39c12"; // Cerca del umbral (amarillo)
      }
      
      // Arco del valor
      const valueArc = d3.arc()
        .innerRadius(radius * 0.7)
        .outerRadius(radius)
        .startAngle(-Math.PI * 0.75)
        .endAngle(scale(value));
      
      svg.append("path")
        .attr("d", valueArc)
        .style("fill", color);
      
      // Texto del valor
      svg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.3em")
        .style("font-size", "24px")
        .style("font-weight", "bold")
        .style("fill", color)
        .text(value);
      
      // Unidad
      svg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "2em")
        .style("font-size", "12px")
        .text(unit);
      
      // Marcas de umbral
      // Umbral mínimo
      const minAngle = scale(range[0]);
      svg.append("line")
        .attr("x1", (radius + 10) * Math.cos(minAngle))
        .attr("y1", (radius + 10) * Math.sin(minAngle))
        .attr("x2", (radius - 10) * Math.cos(minAngle))
        .attr("y2", (radius - 10) * Math.sin(minAngle))
        .style("stroke", "#e74c3c")
        .style("stroke-width", 2);
      
      // Umbral máximo
      const maxAngle = scale(range[1]);
      svg.append("line")
        .attr("x1", (radius + 10) * Math.cos(maxAngle))
        .attr("y1", (radius + 10) * Math.sin(maxAngle))
        .attr("x2", (radius - 10) * Math.cos(maxAngle))
        .attr("y2", (radius - 10) * Math.sin(maxAngle))
        .style("stroke", "#e74c3c")
        .style("stroke-width", 2);
    };
    
    // Crear gráfico histórico
    const createHistoricalChart = () => {
      if (!historicalChartContainer.value) return;
      
      // Limpiar gráfico anterior
      d3.select(historicalChartContainer.value).selectAll("*").remove();
      
      // Dimensiones
      const margin = {top: 20, right: 30, bottom: 40, left: 50};
      const width = historicalChartContainer.value.clientWidth - margin.left - margin.right;
      const height = 300 - margin.top - margin.bottom;
      
      // Datos históricos simulados por mes
      const monthlyData = generateMonthlyData();
      
      // Crear SVG
      const svg = d3.select(historicalChartContainer.value)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
        
      // Escalas
      const x = d3.scaleBand()
        .domain(monthlyData.map(d => d.month))
        .range([0, width])
        .padding(0.1);
        
      const y = d3.scaleLinear()
        .domain([0, d3.max(monthlyData, d => d.value) * 1.1])
        .range([height, 0]);
        
      // Ejes
      svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));
        
      svg.append("g")
        .call(d3.axisLeft(y));
      
      // Barras
      svg.selectAll(".bar")
        .data(monthlyData)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.month))
        .attr("y", d => y(d.value))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.value))
        .attr("fill", "#3498db");
      
      // Línea de tendencia
      const lineData = monthlyData.map(d => ({
        month: d.month,
        value: d.trend
      }));
      
      const line = d3.line()
        .x(d => x(d.month) + x.bandwidth() / 2)
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);
        
      svg.append("path")
        .datum(lineData)
        .attr("fill", "none")
        .attr("stroke", "#e74c3c")
        .attr("stroke-width", 2)
        .attr("d", line);
      
      // Título
      svg.append("text")
        .attr("x", width / 2)
        .attr("y", 0 - (margin.top / 2))
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text(`${getVariableName(historicalVariable.value)} - Promedio Mensual`);
    };
    
    // Función para actualizar todos los gráficos
    const updateCharts = () => {
      createMainChart();
      if (activeTab.value === 'predictions') {
        createPredictionChart();
      } else if (activeTab.value === 'environment') {
        createGauges();
        createHistoricalChart();
      }
    };
    
    // Actualizar datos cuando cambia la piscifactoría seleccionada
    watch(() => props.selectedFarmId, () => {
      // Simular actualización de datos para la nueva piscifactoría
      if (props.selectedFarmId) {
        // Actualizar indicadores
        keyIndicators.value = keyIndicators.value.map(indicator => {
          // Variar ligeramente los valores según la granja
          const variationFactor = (props.selectedFarmId % 3 + 1) * 0.1;
          const baseValue = parseFloat(indicator.value);
          const newValue = (baseValue * (1 + variationFactor * (Math.random() - 0.5))).toFixed(1);
          
          return {
            ...indicator,
            value: newValue,
          };
        });
        
        // Actualizar alertas (más o menos según el ID)
        if (props.selectedFarmId % 2 === 0) {
          // Añadir una alerta específica para granjas pares
          alerts.value.unshift({
            title: 'Mantenimiento de equipos',
            message: `Se requiere revisión de equipos en ${selectedFarm.value.name}`,
            level: 'baja',
            time: 'Hace 1 día'
          });
        } else {
          // Eliminar una alerta para granjas impares
          if (alerts.value.length > 1) {
            alerts.value.pop();
          }
        }
        
        // Actualizar todos los gráficos
        updateCharts();
      }
    });
    
    // Watch para cambios de pestañas
    watch(activeTab, (newTab) => {
      // Actualizar gráficos según la pestaña activa
      setTimeout(() => {
        if (newTab === 'summary') {
          createMainChart();
        } else if (newTab === 'predictions') {
          createPredictionChart();
        } else if (newTab === 'environment') {
          createGauges();
          createHistoricalChart();
        }
      }, 50); // Pequeño delay para asegurar que los contenedores estén disponibles
    });
    
    // Eventos del ciclo de vida
    onMounted(() => {
      // Inicializar gráficos
      setTimeout(() => {
        updateCharts();
      }, 100);
      
      // Manejar resize para responsividad
      window.addEventListener('resize', () => {
        updateCharts();
      });
    });
    
    return {
      // Referencias
      mainChartContainer,
      predictionChartContainer,
      tempGaugeContainer,
      oxygenGaugeContainer,
      currentsGaugeContainer,
      salinityGaugeContainer,
      historicalChartContainer,
      
      // Estado
      selectedVariable,
      selectedTimeframe,
      historicalVariable,
      activeTab,
      tabs,
      selectedFarm,
      keyIndicators,
      alerts,
      alertsCount,
      predictions,
      infrastructureItems,
      maintenanceTasks,
      
      // Métodos
      getValueClass,
      getPredictionClass,
      updateMainChart,
      updateHistoricalChart,
      getVariableName
    };
    
    // Funciones específicas de actualización
    const updateMainChart = () => {
      createMainChart();
      emit('variable-changed', selectedVariable.value);
    };
    
    const updateHistoricalChart = () => {
      createHistoricalChart();
    };
    
    // Funciones auxiliares para generación de datos
    const generateChartData = () => {
      const now = new Date();
      const data = [];
      
      // Número de puntos basado en timeframe
      let numPoints = 24;
      let step = 60 * 60 * 1000; // 1 hora en ms
      
      if (selectedTimeframe.value === 'week') {
        numPoints = 168; // 24 * 7
      } else if (selectedTimeframe.value === 'month') {
        numPoints = 30;
        step = 24 * 60 * 60 * 1000; // 1 día
      } else if (selectedTimeframe.value === 'year') {
        numPoints = 52;
        step = 7 * 24 * 60 * 60 * 1000; // 1 semana
      }
      
      // Base para las curvas
      const baseValue = getBaseValueByVariable();
      const amplitude = getAmplitudeByVariable();
      const frequency = 0.2;
      
      for (let i = 0; i < numPoints; i++) {
        const date = new Date(now.getTime() - (numPoints - i) * step);
        
        // Valor con componente sinusoidal + tendencia + ruido
        const sinComponent = Math.sin(i * frequency) * amplitude;
        const trendComponent = (i / numPoints) * amplitude * 0.5;
        const noiseComponent = (Math.random() - 0.5) * amplitude * 0.3;
        
        const value = baseValue + sinComponent + trendComponent + noiseComponent;
        
        data.push({
          date,
          value: Math.max(0, value.toFixed(2)) // Asegurar valores no negativos
        });
      }
      
      return data;
    };
    
    const generateMonthlyData = () => {
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const data = [];
      
      // Base para los valores
      const baseValue = getBaseValueByVariable();
      const amplitude = getAmplitudeByVariable();
      
      // Componente de tendencia anual (por ejemplo, incremento en verano para temperatura)
      let trendPattern;
      if (historicalVariable.value === 'temperature') {
        trendPattern = [0.7, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 1.7, 1.5, 1.2, 0.9, 0.7];
      } else if (historicalVariable.value === 'oxygen') {
        trendPattern = [1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1];
      } else if (historicalVariable.value === 'currents') {
        trendPattern = [1.3, 1.2, 1.1, 1.0, 0.9, 0.8, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3];
      } else {
        trendPattern = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
      }
      
      for (let i = 0; i < months.length; i++) {
        const trend = baseValue * trendPattern[i];
        const randomFactor = 1 + (Math.random() - 0.5) * 0.1;
        data.push({
          month: months[i],
          value: (trend * randomFactor).toFixed(2),
          trend: trend.toFixed(2)
        });
      }
      
      return data;
    };
    
    const getBaseValueByVariable = () => {
      switch (selectedVariable.value) {
        case 'temperature': return 22;
        case 'oxygen': return 6;
        case 'currents': return 0.3;
        case 'salinity': return 36;
        default: return 20;
      }
    };
    
    const getAmplitudeByVariable = () => {
      switch (selectedVariable.value) {
        case 'temperature': return 1.5;
        case 'oxygen': return 0.8;
        case 'currents': return 0.15;
        case 'salinity': return 1.2;
        default: return 1;
      }
    };
    
    const getThresholdByVariable = () => {
      switch (selectedVariable.value) {
        case 'temperature': return 26;
        case 'oxygen': return 5;
        case 'currents': return 0.8;
        case 'salinity': return 38;
        default: return 20;
      }
    };
    
    const getUnitByVariable = (variable) => {
      switch (variable) {
        case 'temperature': return '°C';
        case 'oxygen': return 'mg/L';
        case 'currents': return 'm/s';
        case 'salinity': return 'ppt';
        default: return '';
      }
    };
    
      const getVariableName = (variable) => {
        switch (variable) {
          case 'temperature': return 'Temperatura';
          case 'oxygen': return 'Oxígeno Disuelto';
          case 'currents': return 'Velocidad de Corrientes';
          case 'salinity': return 'Salinidad';
            default: return variable;
          }
      };
  }
};
</script>