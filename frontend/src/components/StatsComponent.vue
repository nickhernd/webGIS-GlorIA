<template>
  <div class="stats-dashboard">
    <div class="stats-header">
      <h2>{{ selectedFarm ? selectedFarm.name : 'Estadísticas Generales' }}</h2>
      <div v-if="selectedFarm" class="farm-info">
        <span><strong>Ubicación:</strong> {{ selectedFarm.location }}</span>
        <span><strong>Tipo:</strong> {{ selectedFarm.type }}</span>
      </div>
    </div>
    
    <!-- Error Message -->
    <div v-if="errorMessage" class="error-notification">
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <span>{{ errorMessage }}</span>
        <button class="error-close" @click="clearError">&times;</button>
      </div>
    </div>
    
    <!-- Dashboard Controls -->
    <DashboardControls
      :initial-variables="[selectedVariable]"
      :initial-chart-type="chartType"
      @config-changed="handleConfigChange"
      @refresh-data="loadHistoricalData"
      @export-data="exportData"
      @auto-refresh-changed="handleAutoRefreshChange"
      @refresh-interval-changed="handleRefreshIntervalChange"
    />

    <!-- Control de fechas personalizado -->
    <DateRangePicker 
      :initial-start-date="startDate"
      :initial-end-date="endDate"
      @date-range-changed="handleDateRangeChange"
    />
    
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

    <!-- Loading Indicator -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <div class="loading-text">Cargando datos...</div>
    </div>

    <!-- Contenido de las pestañas -->
    <div class="tab-content" v-if="!isLoading">
      <!-- Panel de resumen -->
      <div v-if="activeTab === 'summary'" class="tab-pane">
        <div v-if="noDataAvailable" class="no-data-message">
          <div class="no-data-icon">📊</div>
          <h3>No hay datos disponibles</h3>
          <p>No se encontraron datos para la piscifactoría y variable seleccionadas. Por favor, intente con otra selección o contacte con soporte técnico.</p>
          <button class="refresh-btn" @click="loadHistoricalData">
            <span class="refresh-icon">🔄</span> Reintentar
          </button>
        </div>
        
        <template v-else>
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
          
          <!-- Gráfico principal con canvas para Chart.js -->
          <div class="main-chart-section">
            <h3>Serie Temporal - {{ getVariableName(selectedVariable) }}</h3>
            <div class="chart-container">
              <ChartComponent 
                v-if="historicalData.length > 0" 
                :chartData="historicalData" 
                :chartType="chartType" 
                :chartLabel="getVariableName(selectedVariable)"
              />
              <div v-else class="no-data-message">
                No hay datos disponibles para mostrar en el gráfico.
              </div>
            </div>
            <div class="chart-controls">
              <div class="chart-control-item">
                <label for="variable-select">Variable:</label>
                <select id="variable-select" v-model="selectedVariable" @change="loadHistoricalData">
                  <option value="o2">Oxígeno (O2)</option>
                  <option value="CHL">Clorofila (CHL)</option>
                  <option value="TUR">Turbidez (TUR)</option>
                  <option value="no3">Nitrato (NO3)</option>
                  <option value="po4">Fosfato (PO4)</option>
                  <option value="uo">Corriente U (UO)</option>
                  <option value="vo">Corriente V (VO)</option>
                  <option value="nppv">Productividad (NPPV)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Heatmap Temporal -->
          <TemporalHeatmap 
            v-if="dailyHeatmapData.length > 0"
            :variable="selectedVariable"
            :variable-name="getVariableName(selectedVariable)"
            :data="dailyHeatmapData"
            :loading="isLoading"
            @cell-click="handleHeatmapCellClick"
          />
          
          <!-- Resumen de alertas -->
          <div class="alerts-summary-section">
            <h3>Resumen de Alertas</h3>
            <div v-if="alerts.length === 0" class="no-alerts">
              No hay alertas activas para esta piscifactoría.
            </div>
            <div v-else class="alerts-list">
              <div v-for="(alert, index) in alerts" :key="index" 
                  class="alert-item" 
                  :class="alert.nivel">
                <div class="alert-title">
                  <span class="alert-icon">
                    {{ alert.nivel === 'alta' ? '⚠️' : alert.nivel === 'media' ? '⚠' : 'ℹ️' }}
                  </span>
                  {{ alert.titulo }}
                </div>
                <div class="alert-message">{{ alert.mensaje }}</div>
                <div class="alert-time">{{ alert.tiempoRelativo }}</div>
              </div>
            </div>
          </div>
        </template>
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
               :class="alert.nivel">
            <div class="alert-header">
              <div class="alert-title">
                <span class="alert-icon">
                  {{ alert.nivel === 'alta' ? '⚠️' : alert.nivel === 'media' ? '⚠' : 'ℹ️' }}
                </span>
                {{ alert.titulo }}
              </div>
              <div class="alert-time">{{ alert.tiempoRelativo }}</div>
            </div>
            <div class="alert-message">{{ alert.mensaje }}</div>
            <div class="alert-actions">
              <button class="action-btn resolve" @click="resolveAlert(alert.id)">Marcar como resuelta</button>
              <button class="action-btn details" @click="viewAlertDetails(alert.id)">Ver detalles</button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Panel de predicciones -->
      <div v-if="activeTab === 'predictions'" class="tab-pane">
        <h3>Predicciones y Análisis</h3>
        
        <div v-if="noDataAvailable" class="no-data-message">
          <div class="no-data-icon">📈</div>
          <h3>No hay datos para realizar predicciones</h3>
          <p>Se necesitan datos históricos suficientes para generar predicciones. Por favor, seleccione otra variable o contacte con soporte técnico.</p>
          <button class="refresh-btn" @click="loadHistoricalData">
            <span class="refresh-icon">🔄</span> Reintentar
          </button>
        </div>
        
        <!-- Gráfico de predicción mejorado -->
        <PredictionChart 
          v-else
          :variable="selectedVariable"
          :variable-name="getVariableName(selectedVariable)"
          :historical-data="historicalData"
          :predicted-data="predictedData"
          :loading="isLoading"
          :thresholds="getThresholds(selectedVariable)"
        />
      </div>
      
      <!-- Panel de datos ambientales -->
      <div v-if="activeTab === 'environment'" class="tab-pane">
        <h3>Datos Ambientales</h3>
        
        <div v-if="noDataAvailable" class="no-data-message">
          <div class="no-data-icon">🌊</div>
          <h3>No hay datos ambientales disponibles</h3>
          <p>No se encontraron datos ambientales para la piscifactoría seleccionada. Por favor, intente más tarde o contacte con soporte técnico.</p>
          <button class="refresh-btn" @click="loadEnvironmentalData">
            <span class="refresh-icon">🔄</span> Reintentar
          </button>
        </div>
        
        <div v-else class="environment-grid">
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
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import Chart from 'chart.js/auto';
import DataService from '../services/DataService';
import DateRangePicker from './DateRangePicker.vue';
import TemporalHeatmap from './TemporalHeatmap.vue';
import PredictionChart from './PredictionChart.vue';
import DashboardControls from './DashboardControls.vue';
import 'chartjs-plugin-annotation'; 
import ChartComponent from './ChartComponent.vue';

export default {
  name: 'StatsComponent',
  components: {
    DateRangePicker,
    TemporalHeatmap,
    PredictionChart,
    DashboardControls,
    ChartComponent 
  },
  emits: ['variable-changed', 'error', 'refresh-farm-data'],
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
    // Referencias para gráficos
    const chartCanvas = ref(null);
    let mainChart = null;
    
    // Variables de estado
    const selectedVariable = ref('o2');
    const selectedTimeframe = ref('week');
    const activeTab = ref('summary');
    const historicalData = ref([]);
    const isLoading = ref(false);
    const errorMessage = ref('');
    const noDataAvailable = ref(false);
    
    // Nuevas variables de estado
    const dailyHeatmapData = ref([]);
    const startDate = ref(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // 7 días atrás
    const endDate = ref(new Date());
    const chartType = ref('line');
    const showThresholds = ref(true);
    const autoRefreshInterval = ref(null);
    const refreshIntervalSeconds = ref(300); // 5 minutos
    const predictedData = ref([]);
    
    // Pestañas disponibles
    const tabs = [
      { id: 'summary', name: 'Resumen' },
      { id: 'alerts', name: 'Alertas' },
      { id: 'predictions', name: 'Predicciones' },
      { id: 'environment', name: 'Datos Ambientales' },
    ];
    
    // Indicadores clave calculados a partir de la piscifactoría seleccionada
    const indicators = computed(() => {
      if (!props.selectedFarm || !props.selectedFarm.stats) {
        return {};
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
    
    // Alertas de la piscifactoría seleccionada
    const alerts = computed(() => {
      if (!props.selectedFarm || !props.selectedFarm.alerts) {
        return [];
      }
      
      return props.selectedFarm.alerts;
    });
    
    // Datos ambientales para gráficos y medidores
    const environmentalData = computed(() => {
      if (!props.selectedFarm || !props.selectedFarm.stats) {
        return {};
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
    
    // Método para mostrar error
    const showError = (message) => {
      errorMessage.value = message;
      emit('error', message);
      
      // Limpiar el error automáticamente después de 10 segundos
      setTimeout(() => {
        if (errorMessage.value === message) {
          clearError();
        }
      }, 10000);
    };
    
    // Método para limpiar error
    const clearError = () => {
      errorMessage.value = '';
    };
    
    // Manejar cambios en el rango de fechas
    const handleDateRangeChange = (range) => {
      console.log('Rango de fechas cambiado:', range);
      
      // Actualizar fechas
      startDate.value = range.start;
      endDate.value = range.end;
      selectedTimeframe.value = range.preset || 'custom';
      
      // Recargar datos
      loadHistoricalData();
    };
    
    // Manejar clics en celdas del heatmap
    const handleHeatmapCellClick = (cellData) => {
      console.log('Celda seleccionada en heatmap:', cellData);
      
      if (!cellData || !cellData.date) return;
      
      // Actualizar fecha seleccionada
      const selectedDate = new Date(cellData.date);
      startDate.value = selectedDate;
      endDate.value = new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000); // +1 día
      selectedTimeframe.value = 'day';
      
      // Cargar datos para la fecha seleccionada
      loadHistoricalData();
    };
    
    // Manejar cambios en la configuración del dashboard
    const handleConfigChange = (config) => {
      console.log('Configuración cambiada:', config);
      
      // Actualizar la variable seleccionada (si ha cambiado)
      if (config.variables && config.variables.length > 0 && config.variables[0] !== selectedVariable.value) {
        selectedVariable.value = config.variables[0];
      }
      
      // Actualizar tipo de gráfico
      if (config.chartType) {
        chartType.value = config.chartType;
      }
      
      // Actualizar otras configuraciones según sea necesario
      if (config.showThresholds !== undefined) {
        showThresholds.value = config.showThresholds;
      }
      
      // Recargar datos si es necesario
      loadHistoricalData();
    };
    
    // Exportar datos
    const exportData = (format) => {
      console.log('Exportando datos en formato:', format);
      
      if (historicalData.value.length === 0) {
        showError('No hay datos disponibles para exportar');
        return;
      }
      
      let filename = `datos_${selectedVariable.value}_${new Date().toISOString().split('T')[0]}`;
      
      // Implementar según el formato
      switch (format) {
        case 'csv':
          exportAsCSV(filename);
          break;
        case 'excel':
          showError('Exportación a Excel no implementada');
          break;
        case 'json':
          exportAsJSON(filename);
          break;
        default:
          showError('Formato de exportación no soportado: ' + format);
      }
    };
    
    // Exportar como CSV
    const exportAsCSV = (filename) => {
      // Crear contenido CSV
      let csvContent = 'fecha,valor\n';
      
      historicalData.value.forEach(item => {
        csvContent += `${item.fecha},${item.valor}\n`;
      });
      
      // Crear blob y descargar
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url); // Liberar memoria
    };
    
    // Exportar como JSON
    const exportAsJSON = (filename) => {
      const jsonContent = JSON.stringify(historicalData.value, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}.json`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url); // Liberar memoria
    };
    
    // Manejar cambios en la actualización automática
    const handleAutoRefreshChange = (enabled) => {
      console.log('Actualización automática:', enabled ? 'activada' : 'desactivada');
      
      if (enabled) {
        // Iniciar temporizador para actualización automática
        autoRefreshInterval.value = setInterval(() => {
          loadHistoricalData();
        }, refreshIntervalSeconds.value * 1000);
      } else {
        // Detener temporizador
        if (autoRefreshInterval.value) {
          clearInterval(autoRefreshInterval.value);
          autoRefreshInterval.value = null;
        }
      }
    };
    
    // Manejar cambios en el intervalo de actualización
    const handleRefreshIntervalChange = (seconds) => {
      console.log('Intervalo de actualización cambiado a', seconds, 'segundos');
      
      if (!seconds || isNaN(seconds) || seconds < 10) {
        showError('El intervalo de actualización debe ser al menos 10 segundos');
        return;
      }
      
      refreshIntervalSeconds.value = seconds;
      
      // Reiniciar el intervalo si está activo
      if (autoRefreshInterval.value) {
        clearInterval(autoRefreshInterval.value);
        autoRefreshInterval.value = setInterval(() => {
          loadHistoricalData();
        }, refreshIntervalSeconds.value * 1000);
      }
    };
    
    // Obtener umbrales para predicciones
    const getThresholds = (variable) => {
      const thresholds = {
        'o2': { min: 5, max: null },
        'temperature': { min: null, max: 26 },
        'salinity': { min: 34, max: 38 },
        'currents': { min: null, max: 0.8 },
        'CHL': { min: null, max: 5 },
        'TUR': { min: null, max: 10 },
        'no3': { min: null, max: 20 },
        'po4': { min: null, max: 1.5 },
        'nh4': { min: null, max: 1 }
      };
      
      return thresholds[variable] || { min: null, max: null };
    };
    
    // Cargar datos históricos para la gráfica
    const loadHistoricalData = async () => {
      if (!props.selectedFarmId) {
        showError('No hay ninguna piscifactoría seleccionada');
        return;
      }
      
      isLoading.value = true;
      noDataAvailable.value = false;
      clearError();

      try {
        console.log('Cargando datos para:', {
          variable: selectedVariable.value,
          farmId: props.selectedFarmId,
          timeframe: selectedTimeframe.value,
          startDate: startDate.value.toISOString(),   // Asegurar formato ISO
          endDate: endDate.value.toISOString()        // Asegurar formato ISO
        });

        // Llamar a la API para obtener datos históricos
        const response = await DataService.getDatosHistoricos(
          selectedVariable.value, 
          {
            periodo: selectedTimeframe.value,
            piscifactoriaId: props.selectedFarmId,
            fechaInicio: startDate.value.toISOString(),  // Usar fechaInicio en vez de startDate
            fechaFin: endDate.value.toISOString()        // Usar fechaFin en vez de endDate
          }
        );
        
        if (response.data && response.data.datos && response.data.datos.length > 0) {
          historicalData.value = response.data.datos;
          
          console.log('Datos recibidos para gráfica:', historicalData.value);

          // Cargar datos para el heatmap
          await loadHeatmapData();
          
          console.log('Actualizando gráfico con', historicalData.value.length, 'puntos de datos');

          // Cargar datos de predicción si estamos en la pestaña de predicciones
          if (activeTab.value === 'predictions') {
            await loadPredictionData();
          }
          
          // Actualizar el gráfico
          updateChart();
          
          // Notificar al componente padre
          emit('variable-changed', selectedVariable.value);
        } else {
          throw new Error('No se encontraron datos históricos para la selección actual');
        }
      } catch (error) {
        console.error('Error al cargar datos históricos:', error);
        showError(`Error al cargar datos: ${error.message || 'Se produjo un error al obtener los datos'}`);
        historicalData.value = [];
        dailyHeatmapData.value = [];
        predictedData.value = [];
        noDataAvailable.value = true;
        
        // Destruir gráficos si no hay datos
        if (mainChart) {
          mainChart.destroy();
          mainChart = null;
        }
      } finally {
        isLoading.value = false;
      }
    };
    
    // Cargar datos para el heatmap
    const loadHeatmapData = async () => {
      try {
        // Llamar a la API para obtener datos del heatmap
        const response = await DataService.getHeatmapData(
          selectedVariable.value, 
          {
            piscifactoriaId: props.selectedFarmId,
            dias: 7 // Una semana
          }
        );
        
        if (response.data && response.data.length > 0) {
          dailyHeatmapData.value = response.data;
        } else {
          dailyHeatmapData.value = [];
          console.warn('No se encontraron datos para el heatmap');
        }
      } catch (error) {
        console.error('Error al cargar datos del heatmap:', error);
        dailyHeatmapData.value = [];
      }
    };
    
    // Cargar datos de predicción
    const loadPredictionData = async () => {
      if (historicalData.value.length === 0) {
        predictedData.value = [];
        return;
      }
      
      try {
        // Llamar a la API para obtener predicciones
        const response = await DataService.getPredicciones(
          selectedVariable.value,
          {
            piscifactoriaId: props.selectedFarmId,
            dias: 5 // Predicción para 5 días
          }
        );
        
        if (response.data && response.data.length > 0) {
          predictedData.value = response.data;
        } else {
          predictedData.value = [];
          console.warn('No se encontraron datos de predicción');
        }
      } catch (error) {
        console.error('Error al cargar datos de predicción:', error);
        predictedData.value = [];
      }
    };
    
    // Cargar datos ambientales
    const loadEnvironmentalData = async () => {
      if (!props.selectedFarmId) {
        showError('No hay ninguna piscifactoría seleccionada');
        return;
      }
      
      isLoading.value = true;
      noDataAvailable.value = false;
      clearError();
      
      try {
        // Llamar a la API para obtener datos ambientales
        const response = await DataService.getDatosAmbientales({
          piscifactoriaId: props.selectedFarmId,
          fecha: new Date().toISOString().split('T')[0]
        });
        
        if (!response.data || Object.keys(response.data).length === 0) {
          throw new Error('No se encontraron datos ambientales');
        }
        
        // Los datos se actualizarán a través del prop selectedFarm
        // Emitir evento para actualizar la piscifactoría seleccionada con los nuevos datos
        emit('refresh-farm-data', props.selectedFarmId);
      } catch (error) {
        console.error('Error al cargar datos ambientales:', error);
        showError(`Error al cargar datos ambientales: ${error.message || 'Se produjo un error inesperado'}`);
        noDataAvailable.value = true;
      } finally {
        isLoading.value = false;
      }
    };
    
    // Resolver una alerta
    const resolveAlert = async (alertId) => {
      if (!alertId) {
        showError('ID de alerta no válido');
        return;
      }
      
      try {
        isLoading.value = true;
        await DataService.resolverAlerta(alertId);
        // Recargar datos de la piscifactoría para actualizar las alertas
        emit('refresh-farm-data', props.selectedFarmId);
      } catch (error) {
        console.error('Error al resolver la alerta:', error);
        showError('No se pudo marcar la alerta como resuelta: ' + (error.message || 'Error desconocido'));
      } finally {
        isLoading.value = false;
      }
    };
    
    // Ver detalles de una alerta
    const viewAlertDetails = (alertId) => {
      if (!alertId) {
        showError('ID de alerta no válido');
        return;
      }
      
      // Aquí podrías implementar navegación a una vista de detalles
      // o mostrar un modal con información detallada de la alerta
      console.log('Ver detalles de alerta:', alertId);
      
      // Emitir un evento que podría ser capturado por un componente padre
      emit('view-alert-details', alertId);
    };
    
    // Actualizar el gráfico principal
    const updateChart = () => {
      console.log('Ejecutando updateChart, canvas existe:', !!chartCanvas.value);
      
      // Validación temprana para evitar operaciones innecesarias
      if (!chartCanvas.value) {
        console.warn('No se puede actualizar el gráfico: el elemento canvas no existe');
        return;
      }
      
      if (!historicalData.value || historicalData.value.length === 0) {
        console.warn('No se puede actualizar el gráfico: no hay datos históricos');
        noDataAvailable.value = true;
        return;
      }
      
      console.log('Actualizando gráfico con', historicalData.value.length, 'puntos de datos');
      
      try {
        // Obtener el contexto 2D del canvas
        const ctx = chartCanvas.value.getContext('2d');
        if (!ctx) {
          throw new Error('No se pudo obtener el contexto 2D del canvas');
        }
        
        // Limpiar cualquier gráfico existente
        if (mainChart) {
          console.log('Destruyendo gráfico anterior');
          mainChart.destroy();
          mainChart = null;
        }
        
        // Preparar y validar datos para Chart.js
        const dates = historicalData.value.map(d => new Date(d.fecha));
        const values = historicalData.value.map(d => {
          // Convertir NaN a null para evitar errores en la gráfica
          return isNaN(d.valor) ? null : d.valor;
        });
        
        // Verificar que tenemos datos válidos
        if (dates.length === 0 || values.every(v => v === null)) {
          throw new Error('No hay datos válidos para mostrar en el gráfico');
        }
        
        console.log('Datos procesados:', { 
          fechas: dates.length, 
          valores: values.length,
          muestra: values.slice(0, 3)
        });
        
        // Configurar datasets
        const datasets = [{
          label: getVariableName(selectedVariable.value),
          data: values,
          borderColor: getChartColorByVariable(selectedVariable.value),
          backgroundColor: getChartBgColorByVariable(selectedVariable.value),
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2
        }];
        
        // Configurar opciones del gráfico
        const options = {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 750 // Animación más rápida
          },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: getTimeUnitByPeriod(selectedTimeframe.value),
                displayFormats: {
                  hour: 'HH:mm',
                  day: 'dd MMM',
                  week: 'dd MMM',
                  month: 'MMM yyyy'
                },
                tooltipFormat: 'dd MMM yyyy HH:mm'
              },
              title: {
                display: true,
                text: 'Fecha',
                font: {
                  weight: 'bold'
                }
              },
              grid: {
                display: true,
                color: 'rgba(0, 0, 0, 0.05)'
              }
            },
            y: {
              title: {
                display: true,
                text: getUnitByVariable(selectedVariable.value),
                font: {
                  weight: 'bold'
                }
              },
              beginAtZero: getBeginAtZeroByVariable(selectedVariable.value),
              grid: {
                display: true,
                color: 'rgba(0, 0, 0, 0.05)'
              }
            }
          },
          plugins: {
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              padding: 10,
              cornerRadius: 4,
              titleFont: {
                size: 14
              },
              bodyFont: {
                size: 13
              }
            },
            legend: {
              position: 'top',
              labels: {
                padding: 15,
                usePointStyle: true,
                font: {
                  size: 12
                }
              }
            }
          },
          interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
          }
        };
        
        // Crear gráfico
        mainChart = new Chart(ctx, {
          type: chartType.value || 'line',
          data: {
            labels: dates,
            datasets: datasets
          },
          options: options
        });
        
        // Añadir líneas de umbral si showThresholds está activado
        if (showThresholds.value) {
          const thresholds = getThresholds(selectedVariable.value);
          
          if ((thresholds.min !== null || thresholds.max !== null) && mainChart) {
            // Configurar anotaciones
            const annotations = {};
            
            if (thresholds.min !== null) {
              annotations.minLine = {
                type: 'line',
                yMin: thresholds.min,
                yMax: thresholds.min,
                borderColor: '#e74c3c',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                  content: `Mínimo (${thresholds.min} ${getUnitByVariable(selectedVariable.value)})`,
                  enabled: true,
                  position: 'start',
                  backgroundColor: 'rgba(231, 76, 60, 0.8)',
                  font: {
                    size: 11
                  }
                }
              };
            }
            
            if (thresholds.max !== null) {
              annotations.maxLine = {
                type: 'line',
                yMin: thresholds.max,
                yMax: thresholds.max,
                borderColor: '#f39c12',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                  content: `Máximo (${thresholds.max} ${getUnitByVariable(selectedVariable.value)})`,
                  enabled: true,
                  position: 'start',
                  backgroundColor: 'rgba(243, 156, 18, 0.8)',
                  font: {
                    size: 11
                  }
                }
              };
            }
            
            // Asignar anotaciones y actualizar gráfico
            mainChart.options.plugins.annotation = { annotations };
            mainChart.update();
          }
        }
        
        // Marcar que hay datos disponibles
        noDataAvailable.value = false;
        console.log('Gráfico actualizado correctamente');
        
      } catch (error) {
        console.error('Error al actualizar el gráfico:', error);
        noDataAvailable.value = true;
        showError(`Error al mostrar el gráfico: ${error.message}`);
      }
    };
    
    // Calcular la rotación para el medidor
    const calculateRotation = (value, min, max) => {
      // Si no hay rango, devolver 0 (neutral)
      if (min === max) return 0;
      
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
        'o2': 'Oxígeno disuelto',
        'CHL': 'Clorofila',
        'TUR': 'Turbidez',
        'no3': 'Nitrato',
        'po4': 'Fosfato',
        'uo': 'Corriente U',
        'vo': 'Corriente V',
        'nh4': 'Amonio',
        'si': 'Silicio',
        'fgco2': 'Flujo CO2',
        'spco2': 'pCO2 superficial',
        'nppv': 'Producción primaria',
        'temperature': 'Temperatura',
        'salinity': 'Salinidad',
        'currents': 'Corrientes'
      };
      return names[variableKey] || variableKey;
    };
    
    // Función auxiliar para obtener unidades según la variable
    const getUnitByVariable = (variable) => {
      const units = {
        'o2': 'mg/L',
        'CHL': 'mg/m³',
        'TUR': 'NTU',
        'no3': 'mmol/m³',
        'po4': 'mmol/m³',
        'uo': 'm/s',
        'vo': 'm/s',
        'nh4': 'mmol/m³',
        'si': 'mmol/m³',
        'fgco2': 'mol/m²/s',
        'spco2': 'µatm',
        'nppv': 'mg C/m³/día',
        'temperature': '°C',
        'salinity': 'ppt',
        'currents': 'm/s'
      };
      return units[variable] || '';
    };
    
    // Función para obtener el color del gráfico según la variable
    const getChartColorByVariable = (variable) => {
      const colors = {
        'o2': '#3498db',        // Azul para oxígeno
        'CHL': '#2ecc71',       // Verde para clorofila
        'TUR': '#95a5a6',       // Gris para turbidez
        'no3': '#e74c3c',       // Rojo para nitrato
        'po4': '#f39c12',       // Naranja para fosfato
        'uo': '#9b59b6',        // Púrpura para corriente U
        'vo': '#1abc9c',        // Turquesa para corriente V
        'nh4': '#d35400',       // Naranja oscuro para amonio
        'si': '#34495e',        // Azul oscuro para silicio
        'fgco2': '#7f8c8d',     // Gris para flujo CO2
        'spco2': '#2c3e50',     // Azul marino para pCO2
        'nppv': '#27ae60',      // Verde oscuro para producción primaria
        'temperature': '#e67e22', // Naranja para temperatura
        'salinity': '#8e44ad',  // Púrpura para salinidad
        'currents': '#16a085'   // Verde azulado para corrientes
      };
      return colors[variable] || '#3498db';
    };
    
    // Función para obtener el color de fondo del gráfico según la variable
    const getChartBgColorByVariable = (variable) => {
      const colors = {
        'o2': 'rgba(52, 152, 219, 0.1)',
        'CHL': 'rgba(46, 204, 113, 0.1)',
        'TUR': 'rgba(149, 165, 166, 0.1)',
        'no3': 'rgba(231, 76, 60, 0.1)',
        'po4': 'rgba(243, 156, 18, 0.1)',
        'uo': 'rgba(155, 89, 182, 0.1)',
        'vo': 'rgba(26, 188, 156, 0.1)',
        'nh4': 'rgba(211, 84, 0, 0.1)',
        'si': 'rgba(52, 73, 94, 0.1)',
        'fgco2': 'rgba(127, 140, 141, 0.1)',
        'spco2': 'rgba(44, 62, 80, 0.1)',
        'nppv': 'rgba(39, 174, 96, 0.1)',
        'temperature': 'rgba(230, 126, 34, 0.1)',
        'salinity': 'rgba(142, 68, 173, 0.1)',
        'currents': 'rgba(22, 160, 133, 0.1)'
      };
      return colors[variable] || 'rgba(52, 152, 219, 0.1)';
    };
    
    // Función para obtener la unidad de tiempo para el gráfico según el período
    const getTimeUnitByPeriod = (period) => {
      switch (period) {
        case 'day': return 'hour';
        case 'week': return 'day';
        case 'month': return 'day';
        case 'year': return 'month';
        default: return 'day';
      }
    };
    
    // Función para determinar si el eje Y comienza en cero
    const getBeginAtZeroByVariable = (variable) => {
      // Para temperatura y salinidad no comenzamos en cero
      return !['temperature', 'salinity'].includes(variable);
    };
    
    // Observar cambios en props
    watch(() => props.selectedFarmId, (newVal, oldVal) => {
      if (newVal && newVal !== oldVal) {
        clearError();
        // Cargar datos al seleccionar una piscifactoría
        loadHistoricalData();
        if (activeTab.value === 'environment') {
          loadEnvironmentalData();
        }
      }
    });
    
    watch(() => activeTab.value, (newTab, oldTab) => {
      if (newTab !== oldTab) {
        clearError();
        
        // Cargar datos específicos para cada pestaña
        if (newTab === 'environment') {
          loadEnvironmentalData();
        } else if (newTab === 'predictions' && historicalData.value.length === 0) {
          loadHistoricalData();
        }
      }
    });
    
    // Ciclo de vida
    onMounted(() => {
      if (props.selectedFarmId) {
        loadHistoricalData();
        if (activeTab.value === 'environment') {
          loadEnvironmentalData();
        }
      }
    });
    
    onUnmounted(() => {
      // Limpiar gráficos para evitar fugas de memoria
      if (mainChart) {
        mainChart.destroy();
      }
      
      // Limpiar intervalo de actualización automática
      if (autoRefreshInterval.value) {
        clearInterval(autoRefreshInterval.value);
      }
    });
    
    return {
      // Estado
      chartCanvas,
      selectedVariable,
      selectedTimeframe,
      activeTab,
      tabs,
      indicators,
      alerts,
      environmentalData,
      dailyHeatmapData,
      startDate,
      endDate,
      chartType,
      showThresholds,
      predictedData,
      isLoading,
      errorMessage,
      noDataAvailable,
      historicalData,
      
      // Métodos
      loadHistoricalData,
      loadEnvironmentalData,
      calculateRotation,
      getStatusColor,
      getVariableName,
      getUnitByVariable,
      handleDateRangeChange,
      handleHeatmapCellClick,
      handleConfigChange,
      exportData,
      handleAutoRefreshChange,
      handleRefreshIntervalChange,
      getThresholds,
      clearError,
      resolveAlert,
      viewAlertDetails
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
  position: relative;
}

/* Error message styling */
.error-notification {
  margin-bottom: 15px;
  padding: 12px 15px;
  background-color: #f8d7da;
  color: #721c24;
  border-left: 4px solid #e74c3c;
  border-radius: 4px;
  display: flex;
  align-items: center;
  animation: fadeIn 0.3s ease-in-out;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.error-content {
  display: flex;
  align-items: center;
  flex: 1;
}

.error-icon {
  font-size: 20px;
  margin-right: 10px;
}

.error-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #721c24;
  padding: 0 5px;
  transition: color 0.2s;
}

.error-close:hover {
  color: #e74c3c;
}

/* Loading overlay */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  animation: spin 2s linear infinite;
  margin-bottom: 15px;
}

.loading-text {
  font-size: 16px;
  color: #333;
  font-weight: 500;
}

/* No data message */
.no-data-message {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 30px;
  text-align: center;
  margin: 20px 0;
  border: 1px dashed #ced4da;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.no-data-icon {
  font-size: 48px;
  margin-bottom: 15px;
}

.no-data-message h3 {
  font-size: 18px;
  margin-bottom: 10px;
  color: #2c3e50;
}

.no-data-message p {
  color: #6c757d;
  margin-bottom: 20px;
  line-height: 1.5;
}

.refresh-btn {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  transition: background-color 0.2s;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.refresh-btn:hover {
  background-color: #2980b9;
}

.refresh-icon {
  margin-right: 8px;
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
  background-color: white;
  border-radius: 8px 8px 0 0;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.tab {
  padding: 12px 18px;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  font-weight: 500;
  font-size: 0.9rem;
  transition: all 0.2s;
  color: #6c757d;
  text-align: center;
  flex: 1;
}

.tab:hover {
  background-color: #f1f1f1;
  color: #2980b9;
}

.tab.active {
  border-bottom-color: #3498db;
  color: #3498db;
  background-color: #f8f9fa;
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
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s, box-shadow 0.2s;
}

.indicator:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
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
  padding: 18px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.main-chart-section h3 {
  margin-top: 0;
  font-size: 1rem;
  color: #2c3e50;
  margin-bottom: 15px;
  border-bottom: 1px solid #f1f1f1;
  padding-bottom: 10px;
}

.chart-container {
  height: 300px;
  margin-bottom: 20px;
  position: relative;
}

.chart-controls {
  display: flex;
  gap: 15px;
  border-top: 1px solid #f1f1f1;
  padding-top: 15px;
}

.chart-control-item {
  flex: 1;
}

.chart-control-item label {
  display: block;
  font-size: 0.85rem;
  margin-bottom: 5px;
  color: #6c757d;
  font-weight: 500;
}

.chart-control-item select {
  width: 100%;
  padding: 8px 10px;
  border-radius: 4px;
  border: 1px solid #ced4da;
  background-color: white;
  font-size: 0.9rem;
  transition: border-color 0.2s;
  cursor: pointer;
}

.chart-control-item select:hover {
  border-color: #adb5bd;
}

.chart-control-item select:focus {
  border-color: #3498db;
  outline: none;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.2);
}

/* Alertas */
.alerts-summary-section {
  background-color: white;
  padding: 18px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.alerts-summary-section h3 {
  margin-top: 0;
  font-size: 1rem;
  color: #2c3e50;
  margin-bottom: 15px;
  border-bottom: 1px solid #f1f1f1;
  padding-bottom: 10px;
}

.no-alerts {
  text-align: center;
  padding: 30px 20px;
  color: #6c757d;
  font-style: italic;
  background-color: #f8f9fa;
  border-radius: 4px;
  border: 1px dashed #e1e4e8;
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
  transition: transform 0.2s, box-shadow 0.2s;
}

.alert-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
  line-height: 1.4;
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
  padding: 18px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  background-color: white;
  border-left: 4px solid;
  transition: transform 0.2s, box-shadow 0.2s;
}

.alert-item-detailed:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
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
  padding: 8px 15px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
  font-weight: 500;
}

.action-btn.resolve {
  background-color: #2ecc71;
  color: white;
  box-shadow: 0 2px 4px rgba(46, 204, 113, 0.3);
}

.action-btn.details {
  background-color: #f1f1f1;
  color: #333;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.action-btn.resolve:hover {
  background-color: #27ae60;
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(46, 204, 113, 0.4);
}

.action-btn.details:hover {
  background-color: #e5e5e5;
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
}

/* Datos ambientales */
.environment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
}

.env-panel {
  background-color: white;
  padding: 18px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.2s, box-shadow 0.2s;
}

.env-panel:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.env-panel h4 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1rem;
  color: #2c3e50;
  text-align: center;
  width: 100%;
  border-bottom: 1px solid #f1f1f1;
  padding-bottom: 10px;
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
  transition: transform 0.5s, background-color 0.5s;
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
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.gauge:hover .gauge-value {
  transform: translateY(-3px);
}

.env-stats {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  text-align: center;
  border-top: 1px solid #f1f1f1;
  padding-top: 15px;
}

.env-stat {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
}

.env-stat .label {
  color: #6c757d;
  margin-bottom: 3px;
  font-weight: 500;
}

.env-stat .value {
  font-weight: 600;
  color: #2c3e50;
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Media Queries para responsividad */
@media (max-width: 992px) {
  .environment-grid,
  .indicators-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }
}

@media (max-width: 768px) {
  .stats-tabs {
    overflow-x: auto;
    padding-bottom: 5px;
    flex-wrap: nowrap;
  }
  
  .tab {
    white-space: nowrap;
    padding: 10px 12px;
    font-size: 0.8rem;
    flex: none;
    min-width: 100px;
  }
  
  .indicators-grid,
  .environment-grid {
    grid-template-columns: 1fr;
  }
  
  .chart-controls {
    flex-direction: column;
  }
  
  .gauge {
    width: 120px;
    height: 60px;
  }
  
  .gauge-fill {
    width: 120px;
    height: 60px;
  }
  
  .gauge-value {
    font-size: 1rem;
    padding: 4px 8px;
  }
  
  .env-stats {
    grid-template-columns: 1fr;
    gap: 5px;
  }
  
  .env-stat {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 5px 0;
    border-bottom: 1px solid #f1f1f1;
  }
  
  .env-stat:last-child {
    border-bottom: none;
  }
}

@media (max-width: 576px) {
  .stats-dashboard {
    padding: 10px;
  }
  
  .stats-header h2 {
    font-size: 1.2rem;
  }
  
  .error-notification {
    padding: 10px;
    font-size: 0.9rem;
  }
  
  .error-icon {
    font-size: 16px;
  }
  
  .no-data-message {
    padding: 20px;
  }
  
  .no-data-icon {
    font-size: 36px;
  }
  
  .no-data-message h3 {
    font-size: 16px;
  }
  
  .no-data-message p {
    font-size: 0.9rem;
  }
  
  .action-btn {
    padding: 6px 10px;
    font-size: 0.8rem;
  }
}
</style>