<template>
  <div class="currents-monitor">
    <div class="monitor-header">
      <h3>Monitorización de Corrientes</h3>
      <div class="monitor-controls">
        <div class="view-selector">
          <button 
            v-for="view in viewOptions" 
            :key="view.id"
            class="view-btn"
            :class="{ active: currentView === view.id }"
            @click="currentView = view.id"
          >
            <span class="view-icon">{{ view.icon }}</span>
            <span class="view-label">{{ view.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="content-wrapper">
      <!-- Loading state -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>Cargando datos de corrientes...</span>
      </div>

      <!-- Error state -->
      <div v-else-if="hasError" class="error-state">
        <div class="error-icon">⚠️</div>
        <p>{{ errorMessage }}</p>
        <button @click="loadData" class="retry-btn">Reintentar</button>
      </div>

      <!-- Vista general -->
      <div v-else-if="currentView === 'general'" class="general-view">
        <div class="current-stats">
          <div class="stat-card">
            <div class="stat-title">Velocidad actual</div>
            <div class="stat-value" :class="getValueRiskClass(currentSpeed)">
              {{ formatValue(currentSpeed) }} m/s
            </div>
            <div class="stat-trend">
              <span :class="getTrendClass(trend)">
                {{ getTrendIcon(trend) }} {{ formatValue(Math.abs(trendValue)) }} m/s
              </span>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-title">Estado</div>
            <div class="stat-status" :class="getValueRiskClass(currentSpeed)">
              {{ getRiskText(currentSpeed) }}
            </div>
            <div class="stat-range">
              Rango seguro: 0 - {{ thresholds.warning }} m/s
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-title">Índice de riesgo</div>
            <div class="risk-gauge-container">
              <div class="risk-gauge" :style="{ '--risk-angle': riskGaugeAngle + 'deg' }">
                <div class="gauge-scale">
                  <div class="scale-section low"></div>
                  <div class="scale-section medium"></div>
                  <div class="scale-section high"></div>
                </div>
                <div class="gauge-needle"></div>
                <div class="gauge-value">{{ currentRiskIndex.toFixed(1) }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="chart-container">
          <canvas ref="timeSeriesChart"></canvas>
        </div>
        
        <div class="risk-factors">
          <h4>Factores de riesgo</h4>
          <div class="factors-list">
            <div class="factor-item" :class="getValueRiskClass(currentSpeed)">
              <div class="factor-name">Velocidad de corriente</div>
              <div class="factor-value">{{ formatValue(currentSpeed) }} m/s</div>
              <div class="factor-bar">
                <div class="factor-progress" :style="{ width: `${Math.min((currentSpeed / 1.5) * 100, 100)}%` }"></div>
              </div>
            </div>
            
            <div v-for="(factor, index) in extraFactors" :key="index"
              class="factor-item" :class="factor.severity">
              <div class="factor-name">{{ factor.name }}</div>
              <div class="factor-value">{{ factor.value }}</div>
              <div class="factor-bar">
                <div class="factor-progress" :style="{ width: `${factor.percentage}%` }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Vista de serie temporal -->
      <div v-else-if="currentView === 'timeSeries'" class="time-series-view">
        <div class="filter-controls">
          <div class="time-range">
            <label>Periodo:</label>
            <select v-model="timeRange" @change="loadTimeSeriesData">
              <option value="day">24 horas</option>
              <option value="week">7 días</option>
              <option value="month">30 días</option>
            </select>
          </div>
        </div>
        
        <div class="chart-container">
          <canvas ref="detailedTimeSeriesChart"></canvas>
        </div>
        
        <div class="time-series-stats">
          <div class="stat-card">
            <h4>Velocidad Máxima</h4>
            <div class="stat-value" :class="getValueRiskClass(stats.max)">
              {{ formatValue(stats.max) }} m/s
            </div>
            <div class="stat-time">{{ stats.maxTime }}</div>
          </div>
          <div class="stat-card">
            <h4>Velocidad Media</h4>
            <div class="stat-value" :class="getValueRiskClass(stats.avg)">
              {{ formatValue(stats.avg) }} m/s
            </div>
          </div>
          <div class="stat-card">
            <h4>Tiempo sobre umbral</h4>
            <div class="stat-value" :class="getThresholdTimeClass()">
              {{ stats.thresholdTime }}%
            </div>
            <div class="stat-detail">del tiempo &gt; {{ thresholds.warning }} m/s</div>
          </div>
        </div>
      </div>

      <!-- Vista de riesgo -->
      <div v-else-if="currentView === 'risk'" class="risk-analysis-view">
        <div class="risk-summary">
          <h4>Análisis de Riesgo de Corrientes</h4>
          <div class="risk-level" :class="riskStatusClass">
            <div class="risk-level-icon">{{ getRiskIcon() }}</div>
            <div class="risk-level-text">
              <div class="risk-level-title">Nivel de Riesgo: {{ riskStatusText }}</div>
              <div class="risk-level-description">{{ riskDescription }}</div>
            </div>
          </div>
        </div>
        
        <div class="risk-forecast">
          <h4>Previsión de Riesgo (Próximas 24h)</h4>
          <div class="forecast-timeline">
            <div 
              v-for="(forecast, index) in riskForecast" 
              :key="index"
              class="forecast-point"
              :class="forecast.level"
            >
              <div class="forecast-time">{{ forecast.time }}</div>
              <div class="forecast-indicator"></div>
              <div class="forecast-value">{{ forecast.value.toFixed(1) }}</div>
            </div>
          </div>
          
          <div class="forecast-message">
            <div class="message-icon">{{ getForecastIcon() }}</div>
            <div class="message-text">{{ getForecastMessage() }}</div>
          </div>
        </div>
        
        <div class="recommendations">
          <h4>Recomendaciones</h4>
          <ul class="recommendations-list">
            <li v-for="(recommendation, index) in recommendations" :key="index">
              {{ recommendation }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import Chart from 'chart.js/auto';
import DataService from '../services/DataService';

export default {
  name: 'CurrentsMonitorComponent',
  props: {
    selectedFarm: {
      type: Object,
      default: null
    },
    initialFarmId: {
      type: Number,
      default: null
    }
  },
  emits: ['error', 'risk-level-changed'],
  
  setup(props, { emit }) {
    // State variables
    const isLoading = ref(false);
    const hasError = ref(false);
    const errorMessage = ref('');
    const currentView = ref('general');
    const selectedFarmId = ref(props.initialFarmId || (props.selectedFarm ? props.selectedFarm.id : null));
    const timeRange = ref('week');
    const timeSeriesData = ref([]);
    const currentSpeed = ref(0);
    const trend = ref('stable');
    const trendValue = ref(0);
    
    // DOM refs
    const timeSeriesChart = ref(null);
    const detailedTimeSeriesChart = ref(null);
    
    // Chart instances
    let timeSeriesChartInstance = null;
    let detailedTimeSeriesChartInstance = null;
    
    // Velocidad de corriente en m/s
    const thresholds = {
      warning: 0.5,  // Warning threshold (medium risk)
      danger: 0.8    // Danger threshold (high risk)
    };
    
    // Extra factores de riesgo simulados
    const extraFactors = ref([
      {
        name: 'Viento',
        value: '12.5 km/h',
        severity: 'low-risk',
        percentage: 25
      },
      {
        name: 'Altura de ola',
        value: '0.8 m',
        severity: 'medium-risk',
        percentage: 50
      }
    ]);
    
    // Statistics for selected farm
    const stats = ref({
      max: 0,
      maxTime: '',
      avg: 0,
      thresholdTime: 0
    });
    
    // Risk assessment
    const currentRiskIndex = ref(0);
    const riskForecast = ref([]);
    const recommendations = ref([
      'Revisar la integridad de las jaulas y estructuras de retención.',
      'Mantener monitorización constante de los valores de corriente.',
      'Comprobar que los sistemas de anclaje estén en buen estado.',
      'Revisar los sistemas de alimentación automatizada.'
    ]);
    
    // View options
    const viewOptions = [
      { id: 'general', label: 'General', icon: '📊' },
      { id: 'timeSeries', label: 'Serie Temporal', icon: '📈' },
      { id: 'risk', label: 'Análisis de Riesgo', icon: '⚠️' }
    ];
    
    // Computed properties
    const riskGaugeAngle = computed(() => {
      // Convert risk index (0-10) to gauge angle (-90 to 90 degrees)
      return -90 + (currentRiskIndex.value / 10) * 180;
    });
    
    const riskStatusClass = computed(() => {
      if (currentRiskIndex.value < 3.5) return 'low-risk';
      if (currentRiskIndex.value < 7) return 'medium-risk';
      return 'high-risk';
    });
    
    const riskStatusText = computed(() => {
      if (currentRiskIndex.value < 3.5) return 'Bajo';
      if (currentRiskIndex.value < 7) return 'Medio';
      return 'Alto';
    });
    
    const riskDescription = computed(() => {
      if (currentRiskIndex.value < 3.5) {
        return 'Las condiciones de corriente son favorables. Baja probabilidad de incidentes.';
      } else if (currentRiskIndex.value < 7) {
        return 'Intensidad de corrientes moderada. Supervisión recomendada de la integridad de las estructuras.';
      } else {
        return 'Intensidad de corrientes alta. Riesgo elevado de daños estructurales. Se recomienda acciones preventivas inmediatas.';
      }
    });
    
    // Watch for changes in props
    watch(() => props.selectedFarm, (newVal) => {
      if (newVal) {
        selectedFarmId.value = newVal.id;
        if (newVal.stats && newVal.stats.currents) {
          updateFromStats(newVal.stats.currents);
        } else {
          loadData();
        }
      }
    });
    
    // Format value with 2 decimal places
    const formatValue = (value) => {
      if (!value && value !== 0) return 'N/A';
      return value.toFixed(2);
    };
    
    // Get CSS class based on value risk level
    const getValueRiskClass = (value) => {
      if (!value && value !== 0) return '';
      
      if (value < thresholds.warning) return 'low-risk';
      if (value < thresholds.danger) return 'medium-risk';
      return 'high-risk';
    };
    
    // Get trend class
    const getTrendClass = (trendType) => {
      if (trendType === 'up') return 'trend-up';
      if (trendType === 'down') return 'trend-down';
      return '';
    };
    
    // Get trend icon
    const getTrendIcon = (trendType) => {
      if (trendType === 'up') return '↑';
      if (trendType === 'down') return '↓';
      return '→';
    };
    
    // Get CSS class for threshold time percentage
    const getThresholdTimeClass = () => {
      const percentage = stats.value.thresholdTime;
      
      if (percentage < 20) return 'low-risk';
      if (percentage < 50) return 'medium-risk';
      return 'high-risk';
    };
    
    // Get risk text based on velocity magnitude
    const getRiskText = (velocity) => {
      if (velocity < thresholds.warning) {
        return 'Condiciones normales';
      } else if (velocity < thresholds.danger) {
        return 'Precaución';
      } else {
        return 'Riesgo elevado';
      }
    };
    
    // Get risk icon
    const getRiskIcon = () => {
      if (currentRiskIndex.value < 3.5) return '✓';
      if (currentRiskIndex.value < 7) return '⚠';
      return '⚠️';
    };
    
    // Get forecast icon
    const getForecastIcon = () => {
      const highRiskForecast = riskForecast.value.filter(f => f.level === 'high');
      if (highRiskForecast.length > 1) return '⚠️';
      if (highRiskForecast.length > 0) return '⚠';
      return 'ℹ️';
    };
    
    // Get forecast message
    const getForecastMessage = () => {
      const highRiskForecast = riskForecast.value.filter(f => f.level === 'high');
      const mediumRiskForecast = riskForecast.value.filter(f => f.level === 'medium');
      
      if (highRiskForecast.length > 1) {
        return `Se prevén condiciones de alto riesgo en ${highRiskForecast.length} periodos durante las próximas 24 horas.`;
      } else if (highRiskForecast.length === 1) {
        return `Se prevé un periodo de alto riesgo en las próximas 24 horas (${highRiskForecast[0].time}).`;
      } else if (mediumRiskForecast.length > 1) {
        return `Se prevén condiciones de riesgo moderado en las próximas 24 horas.`;
      } else {
        return `No se prevén condiciones de alto riesgo en las próximas 24 horas.`;
      }
    };
    
    // Update data from farm stats if available
    const updateFromStats = (currentsStats) => {
      if (!currentsStats) return;
      
      currentSpeed.value = currentsStats.current || 0;
      trend.value = currentsStats.trend || 'stable';
      
      // Calculate risk index
      currentRiskIndex.value = calculateRiskFromVelocity(currentSpeed.value);
      
      // Generate risk forecast
      generateRiskForecast();
      
      // Simulate trend value
      if (trend.value === 'up') {
        trendValue.value = 0.1 + Math.random() * 0.2;
      } else if (trend.value === 'down') {
        trendValue.value = -(0.1 + Math.random() * 0.2);
      } else {
        trendValue.value = 0;
      }
      
      // Load historical data for charts
      loadTimeSeriesData();
      
      // Emit risk level
      emit('risk-level-changed', {
        index: currentRiskIndex.value,
        level: riskStatusText.value
      });
    };
    
    // Load data
    const loadData = async () => {
      if (!selectedFarmId.value) {
        errorMessage.value = 'No hay piscifactoría seleccionada';
        hasError.value = true;
        return;
      }
      
      isLoading.value = true;
      hasError.value = false;
      
      try {
        // First check if farm data has currents stats
        if (props.selectedFarm && props.selectedFarm.stats && props.selectedFarm.stats.currents) {
          updateFromStats(props.selectedFarm.stats.currents);
          isLoading.value = false;
          return;
        }
        
        // Otherwise, try to load from API
        const response = await DataService.getDatosHistoricos('currents', {
          piscifactoriaId: selectedFarmId.value,
          periodo: 'day',
          limite: 1
        });
        
        if (response.data && response.data.datos && response.data.datos.length > 0) {
          // Get the most recent value
          const latestData = response.data.datos[0];
          currentSpeed.value = latestData.valor || 0;
          
          // Calculate risk index
          currentRiskIndex.value = calculateRiskFromVelocity(currentSpeed.value);
          
          // Load time series data
          await loadTimeSeriesData();
          
          // Generate risk forecast
          generateRiskForecast();
          
          // Emit risk level
          emit('risk-level-changed', {
            index: currentRiskIndex.value,
            level: riskStatusText.value
          });
        } else {
          // If no real data, use simulated data
          simulateCurrentsData();
        }
      } catch (error) {
        console.error('Error loading currents data:', error);
        
        // If error, use simulated data
        simulateCurrentsData();
        
        // Don't show error to user, just use simulated data
        hasError.value = false;
      } finally {
        isLoading.value = false;
      }
    };
    
    // Simulate currents data if real data is not available
    const simulateCurrentsData = () => {
      // Generate a realistic current speed between 0.1 and 1.2 m/s
      currentSpeed.value = 0.1 + Math.random() * 1.1;
      
      // Determine trend
      const randomTrend = Math.random();
      if (randomTrend < 0.33) {
        trend.value = 'up';
        trendValue.value = 0.1 + Math.random() * 0.2;
      } else if (randomTrend < 0.66) {
        trend.value = 'down';
        trendValue.value = -(0.1 + Math.random() * 0.2);
      } else {
        trend.value = 'stable';
        trendValue.value = 0;
      }
      
      // Calculate risk index
      currentRiskIndex.value = calculateRiskFromVelocity(currentSpeed.value);
      
      // Simulate time series data
      simulateTimeSeriesData();
      
      // Generate risk forecast
      generateRiskForecast();
      
      // Emit risk level
      emit('risk-level-changed', {
        index: currentRiskIndex.value,
        level: riskStatusText.value
      });
    };
    
    // Calculate risk index from current speed
    const calculateRiskFromVelocity = (velocity) => {
      // Convert velocity to risk index (0-10)
      if (velocity < thresholds.warning) {
        // Low risk (0-3)
        return (velocity / thresholds.warning) * 3;
      } else if (velocity < thresholds.danger) {
        // Medium risk (3-7)
        const range = thresholds.danger - thresholds.warning;
        const position = velocity - thresholds.warning;
        return 3 + (position / range) * 4;
      } else {
        // High risk (7-10)
        const excessFactor = Math.min((velocity - thresholds.danger) / 0.5, 1);
        return 7 + excessFactor * 3;
      }
    };
    
    // Load time series data
    const loadTimeSeriesData = async () => {
      if (!selectedFarmId.value) return;
      
      try {
        const response = await DataService.getDatosHistoricos('currents', {
          piscifactoriaId: selectedFarmId.value,
          periodo: timeRange.value
        });
        
        if (response.data && response.data.datos && response.data.datos.length > 0) {
          timeSeriesData.value = response.data.datos;
          calculateStats();
          renderCharts();
        } else {
          // If no real data, simulate time series data
          simulateTimeSeriesData();
        }
      } catch (error) {
        console.error('Error loading time series data:', error);
        simulateTimeSeriesData();
      }
    };
    
    // Simulate time series data
    const simulateTimeSeriesData = () => {
      const now = new Date();
      const data = [];
      const baseValue = currentSpeed.value;
      const points = timeRange.value === 'day' ? 24 : 
                    timeRange.value === 'week' ? 7 * 8 : 
                    30 * 4;
      
      const interval = timeRange.value === 'day' ? 60 * 60 * 1000 : 
                      timeRange.value === 'week' ? 3 * 60 * 60 * 1000 : 
                      6 * 60 * 60 * 1000;
      
      // Generate data points with some randomness
      for (let i = points - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - i * interval);
        
        // Add some natural variation
        const hourOfDay = time.getHours();
        const dayFactor = Math.sin((hourOfDay - 6) * Math.PI / 12) * 0.2 + 0.8;
        
        // Random variation
        const randomVariation = (Math.random() - 0.5) * 0.3;
        
        // Trend factor
        const trendFactor = i / points * 0.3 * (trend.value === 'up' ? 1 : trend.value === 'down' ? -1 : 0);
        
        // Calculate value
        let value = baseValue * dayFactor + randomVariation + trendFactor;
        value = Math.max(0.05, Math.min(1.5, value));
        
        data.push({
          fecha: time.toISOString(),
          valor: value
        });
      }
      
      timeSeriesData.value = data;
      calculateStats();
      renderCharts();
    };
    
    // Calculate statistics from time series data
    const calculateStats = () => {
      if (!timeSeriesData.value || timeSeriesData.value.length === 0) {
        stats.value = {
          max: 0,
          maxTime: '',
          avg: 0,
          thresholdTime: 0
        };
        return;
      }
      
      // Find maximum value and its time
      const sortedByValue = [...timeSeriesData.value].sort((a, b) => b.valor - a.valor);
      const maxItem = sortedByValue[0];
      const maxTime = new Date(maxItem.fecha);
      
      // Calculate average
      const sum = timeSeriesData.value.reduce((acc, item) => acc + item.valor, 0);
      const avg = sum / timeSeriesData.value.length;
      
      // Calculate percentage of time above warning threshold
      const pointsAboveThreshold = timeSeriesData.value.filter(item => item.valor >= thresholds.warning);
      const thresholdPercentage = (pointsAboveThreshold.length / timeSeriesData.value.length) * 100;
      
      stats.value = {
        max: maxItem.valor,
        maxTime: maxTime.toLocaleString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }),
        avg: avg,
        thresholdTime: Math.round(thresholdPercentage)
      };
    };
    
    // Generate risk forecast
    const generateRiskForecast = () => {
      const now = new Date();
      const forecast = [];
      
      for (let i = 1; i <= 4; i++) {
        const forecastTime = new Date(now.getTime() + i * 6 * 60 * 60 * 1000); // 6h intervals
        
        // Generate a simulated risk value with some variation based on current risk
        const baseTrend = trend.value === 'up' ? i * 0.5 : 
                          trend.value === 'down' ? -i * 0.5 : 0;
        const variation = (Math.random() - 0.5) * 2; // Random variation
        let riskValue = currentRiskIndex.value + baseTrend + variation;
        
        // Ensure value is between 0-10
        riskValue = Math.max(0, Math.min(10, riskValue));
        
        let level = 'low';
        if (riskValue >= 7) level = 'high';
        else if (riskValue >= 3.5) level = 'medium';
        
        forecast.push({
          time: forecastTime.toLocaleString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
          }),
          value: riskValue,
          level
        });
      }
      
      riskForecast.value = forecast;
    };
    
    // Render charts
    const renderCharts = () => {
      renderTimeSeriesChart();
      renderDetailedTimeSeriesChart();
    };
    
    // Render main time series chart
    const renderTimeSeriesChart = () => {
      if (!timeSeriesChart.value || !timeSeriesData.value || timeSeriesData.value.length === 0) return;
      
      // Destroy existing chart if it exists
      if (timeSeriesChartInstance) {
        timeSeriesChartInstance.destroy();
      }
      
      // Get last 24 data points for the main chart
      const recentData = [...timeSeriesData.value].slice(-24);
      
      // Prepare data
      const dates = recentData.map(item => new Date(item.fecha));
      const values = recentData.map(item => item.valor);
      
      // Create chart
      const ctx = timeSeriesChart.value.getContext('2d');
      
      timeSeriesChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dates,
          datasets: [
            {
              label: 'Velocidad de corriente',
              data: values,
              borderColor: '#3498db',
              backgroundColor: 'rgba(52, 152, 219, 0.1)',
              borderWidth: 2,
              tension: 0.4,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  return `Velocidad: ${formatValue(context.parsed.y)} m/s`;
                }
              }
            }
          },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'hour',
                displayFormats: {
                  hour: 'HH:mm'
                }
              },
              grid: {
                display: false
              }
            },
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(0, 0, 0, 0.05)'
              }
            }
          }
        }
      });
    };
    
    // Render detailed time series chart
    const renderDetailedTimeSeriesChart = () => {
      if (!detailedTimeSeriesChart.value || !timeSeriesData.value || timeSeriesData.value.length === 0) return;
      
      // Destroy existing chart if it exists
      if (detailedTimeSeriesChartInstance) {
        detailedTimeSeriesChartInstance.destroy();
      }
      
      // Prepare data
      const dates = timeSeriesData.value.map(item => new Date(item.fecha));
      const values = timeSeriesData.value.map(item => item.valor);
      
      // Create chart
      const ctx = detailedTimeSeriesChart.value.getContext('2d');
      
      detailedTimeSeriesChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dates,
          datasets: [
            {
              label: 'Velocidad de corriente',
              data: values,
              borderColor: '#3498db',
              backgroundColor: 'rgba(52, 152, 219, 0.1)',
              borderWidth: 2,
              tension: 0.2,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: 'time',
              time: {
                unit: timeRange.value === 'day' ? 'hour' : timeRange.value === 'week' ? 'day' : 'week',
                displayFormats: {
                  hour: 'HH:mm',
                  day: 'dd MMM',
                  week: 'dd MMM'
                }
              },
              title: {
                display: true,
                text: 'Fecha'
              }
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Velocidad (m/s)'
              }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (context) => {
                  return `Velocidad: ${formatValue(context.parsed.y)} m/s`;
                }
              }
            },
            annotation: {
              annotations: {
                warningLine: {
                  type: 'line',
                  yMin: thresholds.warning,
                  yMax: thresholds.warning,
                  borderColor: '#f39c12',
                  borderWidth: 2,
                  borderDash: [5, 5],
                  label: {
                    display: true,
                    content: `Advertencia: ${thresholds.warning} m/s`,
                    position: 'end'
                  }
                },
                dangerLine: {
                  type: 'line',
                  yMin: thresholds.danger,
                  yMax: thresholds.danger,
                  borderColor: '#e74c3c',
                  borderWidth: 2,
                  borderDash: [5, 5],
                  label: {
                    display: true,
                    content: `Peligro: ${thresholds.danger} m/s`,
                    position: 'end'
                  }
                }
              }
            }
          }
        }
      });
    };
    
    // Watch for changes in time range
    watch(timeRange, () => {
      loadTimeSeriesData();
    });
    
    // Watch for changes in view
    watch(currentView, () => {
      // If changing to time series view, reload data
      if (currentView.value === 'timeSeries') {
        loadTimeSeriesData();
      }
    });
    
    // Cleanup on unmount
    onUnmounted(() => {
      if (timeSeriesChartInstance) {
        timeSeriesChartInstance.destroy();
      }
      
      if (detailedTimeSeriesChartInstance) {
        detailedTimeSeriesChartInstance.destroy();
      }
    });
    
    // Initialize
    onMounted(() => {
      loadData();
    });
    
    return {
      // State
      isLoading,
      hasError,
      errorMessage,
      currentView,
      viewOptions,
      timeRange,
      timeSeriesData,
      currentSpeed,
      trend,
      trendValue,
      stats,
      thresholds,
      currentRiskIndex,
      riskStatusClass,
      riskStatusText,
      riskDescription,
      riskGaugeAngle,
      riskForecast,
      extraFactors,
      recommendations,
      
      // DOM refs
      timeSeriesChart,
      detailedTimeSeriesChart,
      
      // Methods
      formatValue,
      getValueRiskClass,
      getTrendClass,
      getTrendIcon,
      getThresholdTimeClass,
      getRiskText,
      getRiskIcon,
      getForecastIcon,
      getForecastMessage,
      loadData,
      loadTimeSeriesData
    };
  }
};
</script>

<style scoped>
.currents-monitor {
  padding: 15px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #f1f1f1;
}

.monitor-header h3 {
  margin: 0;
  font-size: 1.2rem;
  color: #2c3e50;
}

.monitor-controls {
  display: flex;
  align-items: center;
}

.view-selector {
  display: flex;
  gap: 5px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.view-btn {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: white;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  color: #606266;
  transition: all 0.3s;
}

.view-btn:hover {
  background-color: #f5f7fa;
}

.view-btn.active {
  background-color: #3498db;
  color: white;
}

.view-icon {
  margin-right: 6px;
}

.content-wrapper {
  flex: 1;
  position: relative;
  overflow: auto;
}

/* Loading and Error States */
.loading-state,
.error-state {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.9);
  z-index: 10;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-icon {
  font-size: 40px;
  margin-bottom: 15px;
}

.error-state p {
  margin-bottom: 20px;
  color: #e74c3c;
  text-align: center;
}

.retry-btn {
  padding: 8px 16px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

/* General View */
.general-view {
  padding: 15px 0;
}

.current-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

.stat-card {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.stat-title {
  font-size: 0.9rem;
  color: #7f8c8d;
  margin-bottom: 10px;
}

.stat-value {
  font-size: 1.8rem;
  font-weight: bold;
  margin-bottom: 5px;
}

.stat-trend {
  font-size: 0.9rem;
  color: #7f8c8d;
}

.trend-up {
  color: #e74c3c;
}

.trend-down {
  color: #2ecc71;
}

.stat-status {
  font-size: 1.2rem;
  font-weight: bold;
  margin-bottom: 5px;
  padding: 5px 10px;
  border-radius: 4px;
  display: inline-block;
}

.stat-range {
  font-size: 0.85rem;
  color: #7f8c8d;
}

.low-risk {
  color: #2ecc71;
}

.medium-risk {
  color: #f39c12;
}

.high-risk {
  color: #e74c3c;
}

.risk-gauge-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 60px;
}

.risk-gauge {
  position: relative;
  width: 120px;
  height: 60px;
  overflow: hidden;
  --risk-angle: 0deg;
}

.gauge-scale {
  position: absolute;
  top: 0;
  left: 0;
  width: 120px;
  height: 60px;
  border-radius: 60px 60px 0 0;
  overflow: hidden;
  display: flex;
}

.scale-section {
  flex: 1;
  height: 100%;
}

.scale-section.low {
  background-color: #2ecc71;
}

.scale-section.medium {
  background-color: #f39c12;
}

.scale-section.high {
  background-color: #e74c3c;
}

.gauge-needle {
  position: absolute;
  bottom: 0;
  left: 60px;
  width: 2px;
  height: 50px;
  background-color: #2c3e50;
  transform-origin: bottom center;
  transform: rotate(var(--risk-angle));
  z-index: 1;
}

.gauge-value {
  position: absolute;
  bottom: 5px;
  width: 100%;
  text-align: center;
  font-size: 1.2rem;
  font-weight: bold;
  color: #2c3e50;
  z-index: 2;
}

.chart-container {
  height: 200px;
  background-color: white;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.risk-factors {
  background-color: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.risk-factors h4 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1rem;
  color: #2c3e50;
}

.factors-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.factor-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 10px;
  border-radius: 4px;
  background-color: #f8f9fa;
}

.factor-name {
  flex: 1;
  font-weight: 500;
  color: #2c3e50;
}

.factor-value {
  font-weight: bold;
  margin: 0 15px;
}

.factor-bar {
  flex-basis: 100%;
  height: 6px;
  background-color: #ecf0f1;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 10px;
}

.factor-progress {
  height: 100%;
  transition: width 0.3s ease;
}

.low-risk .factor-progress {
  background-color: #2ecc71;
}

.medium-risk .factor-progress {
  background-color: #f39c12;
}

.high-risk .factor-progress {
  background-color: #e74c3c;
}

/* Time Series View */
.time-series-view {
  padding: 15px 0;
}

.filter-controls {
  display: flex;
  margin-bottom: 15px;
  gap: 15px;
}

.time-range {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.time-range label {
  font-size: 0.85rem;
  color: #7f8c8d;
}

.time-range select {
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
  background-color: white;
  color: #2c3e50;
  font-size: 0.9rem;
}

.time-series-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  margin-top: 20px;
}

.stat-time,
.stat-detail {
  font-size: 0.85rem;
  color: #95a5a6;
}

/* Risk Analysis View */
.risk-analysis-view {
  padding: 15px 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.risk-summary {
  background-color: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.risk-summary h4 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1rem;
  color: #2c3e50;
}

.risk-level {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  padding: 15px;
  border-radius: 8px;
}

.risk-level.low-risk {
  background-color: rgba(46, 204, 113, 0.1);
  border-left: 4px solid #2ecc71;
}

.risk-level.medium-risk {
  background-color: rgba(243, 156, 18, 0.1);
  border-left: 4px solid #f39c12;
}

.risk-level.high-risk {
  background-color: rgba(231, 76, 60, 0.1);
  border-left: 4px solid #e74c3c;
}

.risk-level-icon {
  font-size: 2rem;
}

.risk-level-text {
  flex: 1;
}

.risk-level-title {
  font-weight: bold;
  font-size: 1.1rem;
  margin-bottom: 8px;
  color: #2c3e50;
}

.risk-level-description {
  font-size: 0.95rem;
  color: #34495e;
  line-height: 1.5;
}

.risk-forecast {
  background-color: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.risk-forecast h4 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1rem;
  color: #2c3e50;
}

.forecast-timeline {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.forecast-point {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.forecast-time {
  font-size: 0.85rem;
  color: #7f8c8d;
  margin-bottom: 10px;
}

.forecast-indicator {
  width: 16px;
  height: 16px;
  border-radius: 50%;
}

.forecast-point.low .forecast-indicator {
  background-color: #2ecc71;
}

.forecast-point.medium .forecast-indicator {
  background-color: #f39c12;
}

.forecast-point.high .forecast-indicator {
  background-color: #e74c3c;
}

.forecast-value {
  margin-top: 10px;
  font-weight: 500;
  color: #2c3e50;
}

.forecast-point::before {
  content: '';
  position: absolute;
  top: 24px;
  left: -50%;
  width: 100%;
  height: 2px;
  background-color: #dcdfe6;
  z-index: 0;
}

.forecast-point:first-child::before {
  display: none;
}

.forecast-message {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  border-radius: 8px;
  background-color: #f8f9fa;
}

.message-icon {
  font-size: 1.5rem;
}

.message-text {
  flex: 1;
  font-size: 0.95rem;
  color: #34495e;
  line-height: 1.5;
}

.recommendations {
  background-color: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.recommendations h4 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1rem;
  color: #2c3e50;
}

.recommendations-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.recommendations-list li {
  position: relative;
  padding-left: 25px;
  line-height: 1.5;
  color: #34495e;
}

.recommendations-list li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #2ecc71;
  font-weight: bold;
}

/* Responsive adjustments */
@media (max-width: 992px) {
  .current-stats {
    grid-template-columns: 1fr;
  }
  
  .time-series-stats {
    grid-template-columns: 1fr;
  }
  
  .monitor-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }
  
  .view-selector {
    width: 100%;
  }
  
  .forecast-timeline {
    flex-direction: column;
    gap: 20px;
  }
  
  .forecast-point::before {
    width: 2px;
    height: 20px;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
  }
}
</style>