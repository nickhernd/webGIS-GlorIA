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
          <div class="indicator" v-for="(indicator, key) in indicators" :key="key">
            <div class="indicator-title">{{ indicator.name }}</div>
            <div class="indicator-value" :class="indicator.status + '-value'">
              {{ indicator.value }}{{ indicator.unit }}
            </div>
            <div class="indicator-trend">
              <span :class="indicator.trend === 'up' ? 'trend-up' : indicator.trend === 'down' ? 'trend-down' : ''">
                {{ indicator.trend === 'up' ? '↑' : indicator.trend === 'down' ? '↓' : '→' }}
                {{ indicator.min }} - {{ indicator.max }}{{ indicator.unit }}
              </span>
            </div>
          </div>
        </div>
        
        <!-- Gráfico principal (simulado) -->
        <div class="main-chart-section">
          <h3>Serie Temporal - {{ getVariableName(selectedVariable) }}</h3>
          <div class="chart-container">
            <div class="chart-placeholder">
              <div class="chart-line" :class="selectedVariable"></div>
            </div>
          </div>
          <div class="chart-controls">
            <div class="chart-control-item">
              <label for="variable-select">Variable:</label>
              <select id="variable-select" v-model="selectedVariable" @change="updateChart">
                <option value="temperature">Temperatura</option>
                <option value="oxygen">Oxígeno Disuelto</option>
                <option value="currents">Corrientes</option>
                <option value="salinity">Salinidad</option>
                <option value="nutrientes">Nutrientes</option>
              </select>
            </div>
            <div class="chart-control-item">
              <label for="timeframe-select">Período:</label>
              <select id="timeframe-select" v-model="selectedTimeframe" @change="updateChart">
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
          <div v-if="alerts.length === 0" class="no-alerts">
            No hay alertas activas para esta piscifactoría.
          </div>
          <div v-else class="alerts-list">
            <div v-for="(alert, index) in alerts" :key="index" 
                class="alert-item" 
                :class="alert.level">
              <div class="alert-title">
                <span class="alert-icon">
                  {{ alert.level === 'alta' ? '⚠️' : alert.level === 'media' ? '⚠' : 'ℹ️' }}
                </span>
                {{ alert.title }}
              </div>
              <div class="alert-message">{{ alert.message }}</div>
              <div class="alert-time">{{ alert.time }}</div>
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
               :class="alert.level">
            <div class="alert-header">
              <div class="alert-title">
                <span class="alert-icon">
                  {{ alert.level === 'alta' ? '⚠️' : alert.level === 'media' ? '⚠' : 'ℹ️' }}
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
        
        <!-- Gráfico de predicción (simulado) -->
        <div class="prediction-chart-section">
          <div class="prediction-chart-container">
            <div class="chart-placeholder">
              <div class="chart-line prediction-line"></div>
              <div class="prediction-threshold"></div>
            </div>
          </div>
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
            <div class="prediction-value" :class="prediction.status + '-value'">
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
          <div class="env-panel" v-for="(data, key) in environmentalData" :key="key">
            <h4>{{ getVariableName(key) }}</h4>
            <div class="gauge-container">
              <div class="gauge">
                <div class="gauge-fill" :style="{
                  transform: `rotate(${calculateRotation(data.current, data.min, data.max)}deg)`,
                  backgroundColor: getStatusColor(data.status)
                }"></div>
                <div class="gauge-center">
                  <div class="gauge-value">{{ data.current }}{{ data.unit }}</div>
                </div>
              </div>
            </div>
            <div class="env-stats">
              <div class="env-stat">
                <span class="label">Min:</span>
                <span class="value">{{ data.min }}{{ data.unit }}</span>
              </div>
              <div class="env-stat">
                <span class="label">Promedio:</span>
                <span class="value">{{ data.avg }}{{ data.unit }}</span>
              </div>
              <div class="env-stat">
                <span class="label">Max:</span>
                <span class="value">{{ data.max }}{{ data.unit }}</span>
              </div>
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
import { ref, computed, onMounted, watch } from 'vue';

export default {
  name: 'StatsComponent',
  emits: ['variable-changed'],
  props: {
    selectedFarmId: {
      type: Number,
      default: null
    },
    selectedFarm: {
      type: Object,
      default: null
    },
    date: {
      type: Date,
      default: () => new Date()
    }
  },
  
  setup(props, { emit }) {
    // Variables de estado
    const selectedVariable = ref('temperature');
    const selectedTimeframe = ref('week');
    const activeTab = ref('summary');
    
    // Pestañas disponibles
    const tabs = [
      { id: 'summary', name: 'Resumen' },
      { id: 'alerts', name: 'Alertas' },
      { id: 'predictions', name: 'Predicciones' },
      { id: 'environment', name: 'Datos Ambientales' },
      { id: 'infrastructure', name: 'Infraestructura' }
    ];
    
    // Indicadores clave calculados a partir de la piscifactoría seleccionada
    const indicators = computed(() => {
      if (!props.selectedFarm || !props.selectedFarm.stats) {
        return defaultIndicators;
      }
      
      const stats = props.selectedFarm.stats;
      const result = {};
      
      // Convertir los datos de stats en el formato para los indicadores
      Object.keys(stats).forEach(key => {
        const data = stats[key];
        result[key] = {
          name: getVariableName(key),
          value: data.current,
          unit: getUnitByVariable(key),
          trend: data.trend,
          status: data.status,
          min: data.min,
          max: data.max
        };
      });
      
      return result;
    });
    
    // Datos por defecto para indicadores
    const defaultIndicators = {
      temperature: {
        name: 'Temperatura',
        value: '22.4',
        unit: '°C',
        trend: 'up',
        status: 'normal',
        min: 21.2,
        max: 23.8
      },
      oxygen: {
        name: 'Oxígeno Disuelto',
        value: '5.8',
        unit: 'mg/L',
        trend: 'down',
        status: 'warning',
        min: 5.2,
        max: 6.5
      },
      salinity: {
        name: 'Salinidad',
        value: '36.2',
        unit: 'ppt',
        trend: 'stable',
        status: 'normal',
        min: 35.8,
        max: 36.7
      },
      currents: {
        name: 'Corrientes',
        value: '0.35',
        unit: 'm/s',
        trend: 'stable',
        status: 'normal',
        min: 0.12,
        max: 0.58
      }
    };
    
    // Alertas de la piscifactoría seleccionada
    const alerts = computed(() => {
      if (!props.selectedFarm || !props.selectedFarm.alerts) {
        return [];
      }
      
      return props.selectedFarm.alerts;
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
    
    // Datos ambientales para gráficos y medidores
    const environmentalData = computed(() => {
      if (!props.selectedFarm || !props.selectedFarm.stats) {
        return defaultEnvironmentalData;
      }
      
      const stats = props.selectedFarm.stats;
      const result = {};
      
      // Convertir los datos de stats en el formato para los datos ambientales
      Object.keys(stats).forEach(key => {
        const data = stats[key];
        result[key] = {
          current: data.current,
          min: data.min,
          max: data.max,
          avg: data.avg,
          status: data.status,
          unit: getUnitByVariable(key)
        };
      });
      
      return result;
    });
    
    // Datos ambientales por defecto
    const defaultEnvironmentalData = {
      temperature: {
        current: 22.4,
        min: 21.2,
        max: 23.8,
        avg: 22.6,
        status: 'normal',
        unit: '°C'
      },
      oxygen: {
        current: 5.8,
        min: 5.2,
        max: 6.5,
        avg: 5.9,
        status: 'warning',
        unit: 'mg/L'
      },
      salinity: {
        current: 36.2,
        min: 35.8,
        max: 36.7,
        avg: 36.3,
        status: 'normal',
        unit: 'ppt'
      },
      currents: {
        current: 0.35,
        min: 0.12,
        max: 0.58,
        avg: 0.34,
        status: 'normal',
        unit: 'm/s'
      }
    };
    
    // Items de infraestructura
    const infrastructureItems = computed(() => {
      if (!props.selectedFarm || !props.selectedFarm.infrastructure || !props.selectedFarm.infrastructure.components) {
        return defaultInfrastructureItems;
      }
      
      return props.selectedFarm.infrastructure.components;
    });
    
    // Items de infraestructura por defecto
    const defaultInfrastructureItems = [
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
      }
    ];
    
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
    
    // Métodos
    
    // Actualizar el gráfico
    const updateChart = () => {
      emit('variable-changed', selectedVariable.value);
    };
    
    // Calcular la rotación para el medidor
    const calculateRotation = (value, min, max) => {
      const range = max - min;
      const normalized = (value - min) / range;
      const degrees = -90 + (normalized * 180); // -90 a 90 grados
      
      return Math.min(90, Math.max(-90, degrees));
    };
    
    // Obtener el color basado en el estado
    const getStatusColor = (status) => {
      switch (status) {
        case 'danger': return '#e74c3c';
        case 'warning': return '#f39c12';
        default: return '#2ecc71';
      }
    };
    
    // Función auxiliar para obtener nombre legible de variables
    const getVariableName = (variableKey) => {
      const names = {
        'temperature': 'Temperatura',
        'oxygen': 'Oxígeno disuelto',
        'salinity': 'Salinidad',
        'currents': 'Corrientes',
        'nutrientes': 'Nutrientes'
      };
      return names[variableKey] || variableKey;
    };
    
    // Función auxiliar para obtener unidades según la variable
    const getUnitByVariable = (variable) => {
      const units = {
        'temperature': '°C',
        'oxygen': 'mg/L',
        'salinity': 'ppt',
        'currents': 'm/s',
        'nutrientes': 'mg/L'
      };
      return units[variable] || '';
    };
    
    // Actualizar la pestaña activa si es la primera vez que se selecciona una piscifactoría
    watch(() => props.selectedFarmId, (newVal, oldVal) => {
      if (newVal && !oldVal) {
        activeTab.value = 'summary';
      }
    });
    
    // Actualizar las predicciones según la piscifactoría seleccionada
    watch(() => props.selectedFarm, (newFarm) => {
      if (newFarm) {
        // Ajustar predicciones según la piscifactoría
        // Este es solo un ejemplo de cómo podrías personalizar datos según la piscifactoría seleccionada
        
        if (newFarm.id % 2 === 0) {
          predictions.value[0].value = '24.2';
          predictions.value[0].status = 'warning';
        } else {
          predictions.value[0].value = '23.8';
          predictions.value[0].status = 'normal';
        }
        
        if (newFarm.id === 4 || newFarm.id === 5) {
          predictions.value[1].value = '0.8';
          predictions.value[1].status = 'danger';
          predictions.value[1].confidence = 90;
        } else {
          predictions.value[1].value = '0.7';
          predictions.value[1].status = 'warning';
          predictions.value[1].confidence = 85;
        }
      }
    });
    
    // Ciclo de vida
    onMounted(() => {
      // Podrías inicializar aquí componentes de gráficos en una versión no estática
    });
    
    return {
      // Estado
      selectedVariable,
      selectedTimeframe,
      activeTab,
      tabs,
      indicators,
      alerts,
      predictions,
      environmentalData,
      infrastructureItems,
      maintenanceTasks,
      
      // Métodos
      updateChart,
      calculateRotation,
      getStatusColor,
      getVariableName,
      getUnitByVariable
    };
  }
};
</script>

<style scoped>
.stats-dashboard {
  padding: 15px;
  height: 100%;
  overflow-y: auto;
  background-color: #f8f9fa;
  color: #333;
  display: flex;
  flex-direction: column;
}

.stats-header {
  margin-bottom: 20px;
  border-bottom: 1px solid #e1e4e8;
  padding-bottom: 10px;
}

.stats-header h2 {
  margin: 0 0 10px 0;
  font-size: 1.5rem;
  color: #2c3e50;
}

.farm-info {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
  color: #6c757d;
}

.farm-info span {
  margin-bottom: 5px;
}

.stats-tabs {
  display: flex;
  border-bottom: 1px solid #e1e4e8;
  margin-bottom: 20px;
}

.tab {
  padding: 10px 15px;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  font-weight: 500;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.tab:hover {
  background-color: #f1f1f1;
}

.tab.active {
  border-bottom-color: #3498db;
  color: #3498db;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
}

.tab-pane {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Indicadores */
.indicators-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
}

.indicator {
  background-color: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.indicator-title {
  font-size: 0.85rem;
  color: #6c757d;
  margin-bottom: 5px;
}

.indicator-value {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 5px;
}

.normal-value {
  color: #2ecc71;
}

.warning-value {
  color: #f39c12;
}

.danger-value {
  color: #e74c3c;
}

.indicator-trend {
  font-size: 0.8rem;
  color: #6c757d;
}

.trend-up {
  color: #2ecc71;
}

.trend-down {
  color: #e74c3c;
}

/* Gráfico principal */
.main-chart-section {
  background-color: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.main-chart-section h3 {
  margin-top: 0;
  font-size: 1rem;
  color: #2c3e50;
  margin-bottom: 15px;
}

.chart-container,
.prediction-chart-container {
  height: 200px;
  margin-bottom: 15px;
}

.chart-placeholder {
  height: 100%;
  width: 100%;
  background-color: #f8f9fa;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

.chart-line {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  mask-image: linear-gradient(90deg, transparent, black 10%, black 90%, transparent);
  mask-size: 100% 100%;
  mask-position: center;
}

.chart-line.temperature {
  background: linear-gradient(180deg, rgba(231, 76, 60, 0.1) 0%, rgba(231, 76, 60, 0.5) 100%);
  border-bottom: 2px solid #e74c3c;
  clip-path: path('M0,100 C50,70 100,90 150,60 C200,30 250,50 300,40 C350,30 400,50 450,30 C500,10 550,50 600,30 L600,200 L0,200 Z');
}

.chart-line.oxygen {
  background: linear-gradient(180deg, rgba(52, 152, 219, 0.1) 0%, rgba(52, 152, 219, 0.5) 100%);
  border-bottom: 2px solid #3498db;
  clip-path: path('M0,120 C50,100 100,70 150,90 C200,110 250,90 300,100 C350,110 400,90 450,80 C500,70 550,90 600,70 L600,200 L0,200 Z');
}

.chart-line.salinity {
  background: linear-gradient(180deg, rgba(155, 89, 182, 0.1) 0%, rgba(155, 89, 182, 0.5) 100%);
  border-bottom: 2px solid #9b59b6;
  clip-path: path('M0,80 C50,100 100,90 150,70 C200,50 250,60 300,80 C350,100 400,90 450,110 C500,130 550,120 600,100 L600,200 L0,200 Z');
}

.chart-line.currents {
  background: linear-gradient(180deg, rgba(46, 204, 113, 0.1) 0%, rgba(46, 204, 113, 0.5) 100%);
  border-bottom: 2px solid #2ecc71;
  clip-path: path('M0,150 C50,130 100,150 150,120 C200,90 250,110 300,130 C350,150 400,140 450,120 C500,100 550,130 600,100 L600,200 L0,200 Z');
}

.chart-line.nutrientes {
  background: linear-gradient(180deg, rgba(241, 196, 15, 0.1) 0%, rgba(241, 196, 15, 0.5) 100%);
  border-bottom: 2px solid #f1c40f;
  clip-path: path('M0,110 C50,90 100,100 150,80 C200,60 250,70 300,60 C350,50 400,70 450,50 C500,30 550,60 600,40 L600,200 L0,200 Z');
}

/* Agrega este CSS al final del <style> en StatsComponent.vue */

.chart-control-item {
  flex: 1;
}

.chart-control-item label {
  display: block;
  font-size: 0.85rem;
  margin-bottom: 5px;
  color: #6c757d;
}

.chart-control-item select {
  width: 100%;
  padding: 8px 10px;
  border-radius: 4px;
  border: 1px solid #ced4da;
  background-color: white;
  font-size: 0.9rem;
}

/* Alertas */
.alerts-summary-section {
  background-color: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.alerts-summary-section h3 {
  margin-top: 0;
  font-size: 1rem;
  color: #2c3e50;
  margin-bottom: 15px;
}

.no-alerts {
  text-align: center;
  padding: 20px;
  color: #6c757d;
  font-style: italic;
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alert-item {
  padding: 12px 15px;
  border-radius: 6px;
  border-left: 4px solid;
  background-color: #f8f9fa;
}

.alert-item.alta {
  border-left-color: #e74c3c;
  background-color: rgba(231, 76, 60, 0.1);
}

.alert-item.media {
  border-left-color: #f39c12;
  background-color: rgba(243, 156, 18, 0.1);
}

.alert-item.baja {
  border-left-color: #3498db;
  background-color: rgba(52, 152, 219, 0.1);
}

.alert-title {
  font-weight: 600;
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.alert-icon {
  margin-right: 8px;
}

.alert-message {
  font-size: 0.9rem;
  margin-bottom: 5px;
}

.alert-time {
  font-size: 0.8rem;
  color: #6c757d;
  text-align: right;
}

/* Alertas detalladas */
.alerts-list-detailed {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.alert-item-detailed {
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  background-color: white;
  border-left: 4px solid;
}

.alert-item-detailed.alta {
  border-left-color: #e74c3c;
}

.alert-item-detailed.media {
  border-left-color: #f39c12;
}

.alert-item-detailed.baja {
  border-left-color: #3498db;
}

.alert-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #f1f1f1;
}

.alert-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 15px;
}

.action-btn {
  padding: 6px 12px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background-color 0.2s;
}

.action-btn.resolve {
  background-color: #2ecc71;
  color: white;
}

.action-btn.details {
  background-color: #f1f1f1;
  color: #333;
}

.action-btn.resolve:hover {
  background-color: #27ae60;
}

.action-btn.details:hover {
  background-color: #e5e5e5;
}

/* Predicciones */
.prediction-chart-section {
  background-color: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 15px;
}

.prediction-chart-container {
  margin-bottom: 10px;
}

.prediction-line {
  background: linear-gradient(180deg, rgba(52, 152, 219, 0.1) 0%, rgba(52, 152, 219, 0.5) 100%);
  border-bottom: 2px solid #3498db;
  clip-path: path('M0,100 C50,80 100,90 150,70 C180,60 200,50 250,40 L250,40 L280,70 L310,60 L340,80 L370,65 L400,85 L430,75 L460,90 L490,70 L520,85 L550,60 L600,50 L600,200 L0,200 Z');
}

.prediction-threshold {
  position: absolute;
  top: 40%;
  left: 0;
  width: 100%;
  border-top: 2px dashed #e74c3c;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-bottom: 5px;
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  font-size: 0.85rem;
}

.color-box {
  width: 14px;
  height: 14px;
  margin-right: 6px;
  border-radius: 3px;
}

.color-box.dashed {
  border: 2px dashed;
  background-color: transparent !important;
}

.prediction-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
}

.prediction-item {
  background-color: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.prediction-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.prediction-title {
  font-weight: 600;
}

.prediction-time {
  font-size: 0.8rem;
  color: #6c757d;
}

.prediction-value {
  font-size: 1.8rem;
  font-weight: bold;
  margin-bottom: 10px;
}

.prediction-confidence {
  font-size: 0.85rem;
  color: #6c757d;
}

.confidence-bar {
  height: 6px;
  background-color: #f1f1f1;
  border-radius: 3px;
  margin-top: 5px;
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  background-color: #3498db;
  border-radius: 3px;
}

/* Datos ambientales */
.environment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
}

.env-panel {
  background-color: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.env-panel h4 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1rem;
  color: #2c3e50;
  text-align: center;
}

.gauge-container {
  width: 100%;
  height: 120px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 15px;
}

.gauge {
  width: 150px;
  height: 75px;
  position: relative;
  overflow: hidden;
  border-bottom: 6px solid #f1f1f1;
  border-radius: 80px 80px 0 0;
}

.gauge-fill {
  position: absolute;
  top: 0;
  left: 0;
  width: 150px;
  height: 75px;
  background-color: #3498db;
  transform-origin: bottom center;
  transform: rotate(-90deg);
  transition: transform 0.5s;
}

.gauge-center {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
}

.gauge-value {
  font-size: 1.2rem;
  font-weight: bold;
  background-color: white;
  padding: 5px 10px;
  border-radius: 15px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.env-stats {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  text-align: center;
}

.env-stat {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
}

.env-stat .label {
  color: #6c757d;
  margin-bottom: 3px;
}

.env-stat .value {
  font-weight: 600;
}

/* Infraestructura */
.infrastructure-status {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.status-item {
  background-color: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #f1f1f1;
}

.status-title {
  font-weight: 600;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.status-indicator.good {
  background-color: #2ecc71;
}

.status-indicator.warning {
  background-color: #f39c12;
}

.status-indicator.danger {
  background-color: #e74c3c;
}

.status-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
}

.detail-label {
  color: #6c757d;
}

.maintenance-schedule {
  background-color: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.maintenance-schedule h4 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1rem;
  color: #2c3e50;
}

.schedule-item {
  display: flex;
  padding: 12px 0;
  border-bottom: 1px solid #f1f1f1;
}

.schedule-item:last-child {
  border-bottom: none;
}

.task-date {
  width: 90px;
  font-weight: 600;
  font-size: 0.85rem;
}

.task-content {
  flex: 1;
  padding: 0 15px;
}

.task-title {
  font-weight: 600;
  margin-bottom: 5px;
}

.task-description {
  font-size: 0.85rem;
  color: #6c757d;
}

.task-status {
  width: 100px;
  text-align: center;
  font-size: 0.85rem;
  padding: 3px 8px;
  border-radius: 12px;
  height: fit-content;
}

.task-status.pending {
  background-color: #f8f9fa;
  color: #6c757d;
}

.task-status.urgent {
  background-color: rgba(231, 76, 60, 0.1);
  color: #e74c3c;
}

.task-status.completed {
  background-color: rgba(46, 204, 113, 0.1);
  color: #2ecc71;
}

/* Media Queries para responsividad */
@media (max-width: 768px) {
  .stats-tabs {
    overflow-x: auto;
    padding-bottom: 5px;
  }
  
  .tab {
    white-space: nowrap;
    padding: 10px 12px;
    font-size: 0.8rem;
  }
  
  .indicators-grid,
  .environment-grid,
  .prediction-metrics,
  .infrastructure-status {
    grid-template-columns: 1fr;
  }
  
  .schedule-item {
    flex-direction: column;
  }
  
  .task-date {
    width: 100%;
    margin-bottom: 5px;
  }
  
  .task-content {
    padding: 0;
    margin-bottom: 10px;
  }
  
  .task-status {
    width: auto;
  }
}
</style>