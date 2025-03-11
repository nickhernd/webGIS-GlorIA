<!-- PredictionChart.vue -->
<template>
    <div class="prediction-chart-section">
      <div class="chart-header">
        <h3>{{ title || `Predicción de ${variableName}` }}</h3>
        <div class="chart-actions">
          <button 
            v-for="period in predictionPeriods" 
            :key="period.value"
            class="period-btn"
            :class="{ active: selectedPeriod === period.value }"
            @click="changePeriod(period.value)"
          >
            {{ period.label }}
          </button>
        </div>
      </div>
      
      <div class="chart-container" ref="chartContainer">
        <div v-if="loading" class="loading-overlay">
          <div class="loading-spinner"></div>
          <span>Cargando predicciones...</span>
        </div>
        <canvas ref="chartCanvas" :class="{ 'is-loading': loading }"></canvas>
      </div>
  
      <div class="prediction-metrics">
        <div class="metric-card" 
             v-for="(metric, index) in metrics" 
             :key="index"
             :class="metric.status">
          <div class="metric-icon">
            <i :class="getIconClass(metric.type)"></i>
          </div>
          <div class="metric-content">
            <div class="metric-title">{{ metric.title }}</div>
            <div class="metric-value">{{ metric.value }}</div>
            <div class="metric-description">{{ metric.description }}</div>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script>
  import Chart from 'chart.js/auto';
  
  export default {
    name: 'PredictionChart',
    props: {
      title: {
        type: String,
        default: ''
      },
      variable: {
        type: String,
        required: true
      },
      variableName: {
        type: String,
        default: ''
      },
      historicalData: {
        type: Array,
        default: () => []
      },
      predictedData: {
        type: Array,
        default: () => []
      },
      loading: {
        type: Boolean,
        default: false
      },
      thresholds: {
        type: Object,
        default: () => ({
          min: null,
          max: null
        })
      }
    },
    
    data() {
      return {
        chart: null,
        selectedPeriod: '48h',
        predictionPeriods: [
          { value: '24h', label: '24h' },
          { value: '48h', label: '48h' },
          { value: '7d', label: '7 días' }
        ],
        metrics: []
      };
    },
    
    watch: {
      historicalData() {
        this.updateChart();
      },
      predictedData() {
        this.updateChart();
      },
      variable() {
        this.updateChart();
      },
      selectedPeriod() {
        this.updateChart();
      }
    },
    
    mounted() {
      this.initChart();
      this.updateMetrics();
    },
    
    beforeUnmount() {
      if (this.chart) {
        this.chart.destroy();
      }
    },
    
    methods: {
      initChart() {
        const ctx = this.$refs.chartCanvas.getContext('2d');
        
        this.chart = new Chart(ctx, {
          type: 'line',
          data: {
            datasets: []
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              mode: 'index',
              intersect: false
            },
            scales: {
              x: {
                type: 'time',
                time: {
                  unit: 'day',
                  displayFormats: {
                    day: 'dd MMM'
                  }
                },
                title: {
                  display: true,
                  text: 'Fecha'
                }
              },
              y: {
                title: {
                  display: true,
                  text: this.getUnit()
                },
                beginAtZero: false
              }
            },
            plugins: {
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const label = context.dataset.label || '';
                    const value = context.parsed.y !== null ? context.parsed.y : 'No data';
                    const unit = this.getUnit();
                    
                    return `${label}: ${value} ${unit}`;
                  }
                }
              },
              annotation: {
                annotations: {}
              }
            }
          }
        });
        
        this.updateChart();
      },
      
      updateChart() {
        if (!this.chart) return;
        
        // Filtrar datos según el periodo seleccionado
        const filteredHistorical = this.filterDataByPeriod(this.historicalData);
        const filteredPredictions = this.filterDataByPeriod(this.predictedData);
        
        // Configurar datasets
        this.chart.data.datasets = [
          {
            label: 'Datos históricos',
            data: filteredHistorical.map(item => ({
              x: new Date(item.fecha),
              y: item.valor
            })),
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Predicción',
            data: filteredPredictions.map(item => ({
              x: new Date(item.fecha),
              y: item.valor
            })),
            borderColor: '#f39c12',
            backgroundColor: 'rgba(243, 156, 18, 0.1)',
            borderDash: [5, 5],
            tension: 0.4,
            fill: true
          }
        ];
        
        // Añadir líneas de umbral si existen
        const annotations = {};
        
        if (this.thresholds.min !== null) {
          annotations.minThreshold = {
            type: 'line',
            yMin: this.thresholds.min,
            yMax: this.thresholds.min,
            borderColor: '#e74c3c',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              content: `Umbral mínimo: ${this.thresholds.min} ${this.getUnit()}`,
              enabled: true,
              position: 'end'
            }
          };
        }
        
        if (this.thresholds.max !== null) {
          annotations.maxThreshold = {
            type: 'line',
            yMin: this.thresholds.max,
            yMax: this.thresholds.max,
            borderColor: '#e74c3c',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              content: `Umbral máximo: ${this.thresholds.max} ${this.getUnit()}`,
              enabled: true,
              position: 'end'
            }
          };
        }
        
        // Actualizar opciones
        this.chart.options.plugins.annotation = {
          annotations: annotations
        };
        
        // Actualizar título del eje Y
        this.chart.options.scales.y.title.text = this.getUnit();
        
        // Actualizar gráfico
        this.chart.update();
        
        // Actualizar métricas
        this.updateMetrics();
      },
      
      filterDataByPeriod(data) {
        if (!data || data.length === 0) return [];
        
        const now = new Date();
        let limitDate;
        
        switch (this.selectedPeriod) {
          case '24h':
            limitDate = new Date(now);
            limitDate.setHours(now.getHours() - 24);
            break;
          case '48h':
            limitDate = new Date(now);
            limitDate.setHours(now.getHours() - 48);
            break;
          case '7d':
            limitDate = new Date(now);
            limitDate.setDate(now.getDate() - 7);
            break;
          default:
            limitDate = new Date(now);
            limitDate.setHours(now.getHours() - 48);
        }
        
        return data.filter(item => new Date(item.fecha) >= limitDate);
      },
      
      changePeriod(period) {
        this.selectedPeriod = period;
      },
      
      getUnit() {
        const units = {
          o2: 'mg/L',
          CHL: 'mg/m³',
          TUR: 'NTU',
          no3: 'mmol/m³',
          po4: 'mmol/m³',
          uo: 'm/s',
          vo: 'm/s',
          temperature: '°C',
          salinity: 'ppt',
          currents: 'm/s',
          nppv: 'mg C/m³/día'
        };
        
        return units[this.variable] || '';
      },
      
      updateMetrics() {
        if (!this.predictedData || this.predictedData.length === 0) {
          this.metrics = this.getDefaultMetrics();
          return;
        }
        
        // Calcular estadísticas de las predicciones
        const values = this.predictedData.map(item => item.valor);
        const maxValue = Math.max(...values);
        const minValue = Math.min(...values);
        const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;
        
        // Determinar si hay valores fuera de los umbrales
        let exceedsThresholds = false;
        if ((this.thresholds.min !== null && minValue < this.thresholds.min) || 
            (this.thresholds.max !== null && maxValue > this.thresholds.max)) {
          exceedsThresholds = true;
        }
        
        // Calcular la tendencia
        let trend = 'stable';
        if (values.length > 1) {
          const firstHalf = values.slice(0, Math.floor(values.length / 2));
          const secondHalf = values.slice(Math.floor(values.length / 2));
          
          const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
          const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
          
          if (secondAvg > firstAvg * 1.05) {
            trend = 'increasing';
          } else if (secondAvg < firstAvg * 0.95) {
            trend = 'decreasing';
          }
        }
        
        // Generar métricas
        this.metrics = [
          {
            title: 'Valor Máximo',
            value: `${maxValue.toFixed(2)} ${this.getUnit()}`,
            description: `Predicción para ${this.getTimeDescription()}`,
            type: 'max',
            status: exceedsThresholds && maxValue > (this.thresholds.max || Infinity) ? 'warning' : 'normal'
          },
          {
            title: 'Valor Mínimo',
            value: `${minValue.toFixed(2)} ${this.getUnit()}`,
            description: `Predicción para ${this.getTimeDescription()}`,
            type: 'min',
            status: exceedsThresholds && minValue < (this.thresholds.min || -Infinity) ? 'warning' : 'normal'
          },
          {
            title: 'Tendencia',
            value: this.getTrendText(trend),
            description: `La tendencia es ${this.getTrendDescription(trend)}`,
            type: 'trend',
            status: trend === 'increasing' && this.isHighValueBad() ? 'warning' : 
                   trend === 'decreasing' && !this.isHighValueBad() ? 'warning' : 'normal'
          }
        ];
      },
      
      getDefaultMetrics() {
        return [
          {
            title: 'Valor Máximo',
            value: `- ${this.getUnit()}`,
            description: 'No hay datos suficientes',
            type: 'max',
            status: 'normal'
          },
          {
            title: 'Valor Mínimo',
            value: `- ${this.getUnit()}`,
            description: 'No hay datos suficientes',
            type: 'min',
            status: 'normal'
          },
          {
            title: 'Tendencia',
            value: 'Estable',
            description: 'No hay datos suficientes',
            type: 'trend',
            status: 'normal'
          }
        ];
      },
      
      getTrendText(trend) {
        switch (trend) {
          case 'increasing':
            return '↑ Ascendente';
          case 'decreasing':
            return '↓ Descendente';
          default:
            return '→ Estable';
        }
      },
      
      getTrendDescription(trend) {
        switch (trend) {
          case 'increasing':
            return 'ascendente';
          case 'decreasing':
            return 'descendente';
          default:
            return 'estable';
        }
      },
      
      getTimeDescription() {
        switch (this.selectedPeriod) {
          case '24h':
            return 'próximas 24 horas';
          case '48h':
            return 'próximas 48 horas';
          case '7d':
            return 'próximos 7 días';
          default:
            return 'próximas 48 horas';
        }
      },
      
      isHighValueBad() {
        // Para algunas variables, valores altos son malos
        const highIsBad = ['temperature', 'TUR', 'no3', 'po4', 'currents'];
        // Para otras, valores bajos son malos
        const lowIsBad = ['o2', 'salinity'];
        
        return highIsBad.includes(this.variable);
      },
      
      getIconClass(type) {
        switch (type) {
          case 'max':
            return 'icon-arrow-up';
          case 'min':
            return 'icon-arrow-down';
          case 'trend':
            return 'icon-chart-line';
          default:
            return 'icon-info';
        }
      }
    }
  };
  </script>
  
  <style scoped>
  .prediction-chart-section {
    background-color: white;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-bottom: 20px;
  }
  
  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }
  
  .chart-header h3 {
    margin: 0;
    font-size: 1rem;
    color: #2c3e50;
  }
  
  .chart-actions {
    display: flex;
    gap: 5px;
  }
  
  .period-btn {
    background-color: #f8f9fa;
    border: 1px solid #ced4da;
    color: #495057;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .period-btn.active {
    background-color: #3498db;
    color: white;
    border-color: #3498db;
  }
  
  .chart-container {
    position: relative;
    height: 250px;
    margin-bottom: 20px;
  }
  
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background-color: rgba(255, 255, 255, 0.7);
    z-index: 10;
  }
  
  .loading-spinner {
    width: 30px;
    height: 30px;
    border: 3px solid rgba(0, 0, 0, 0.1);
    border-top-color: #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 10px;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .is-loading {
    opacity: 0.6;
  }
  
  .prediction-metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin-top: 20px;
  }
  
  .metric-card {
    display: flex;
    gap: 10px;
    padding: 15px;
    border-radius: 6px;
    background-color: #f8f9fa;
    border-left: 3px solid transparent;
  }
  
  .metric-card.normal {
    border-left-color: #2ecc71;
  }
  
  .metric-card.warning {
    border-left-color: #f39c12;
    background-color: rgba(243, 156, 18, 0.1);
  }
  
  .metric-card.danger {
    border-left-color: #e74c3c;
    background-color: rgba(231, 76, 60, 0.1);
  }
  
  .metric-icon {
    font-size: 1.5rem;
    color: #6c757d;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .metric-content {
    flex: 1;
  }
  
  .metric-title {
    font-size: 0.85rem;
    color: #6c757d;
    margin-bottom: 5px;
  }
  
  .metric-value {
    font-size: 1.2rem;
    font-weight: bold;
    margin-bottom: 5px;
  }
  
  .metric-description {
    font-size: 0.8rem;
    color: #6c757d;
  }
  
  /* Iconos básicos */
  .icon-arrow-up:before {
    content: '↑';
  }
  
  .icon-arrow-down:before {
    content: '↓';
  }
  
  .icon-chart-line:before {
    content: '📈';
  }
  
  .icon-info:before {
    content: 'ℹ️';
  }
  </style>