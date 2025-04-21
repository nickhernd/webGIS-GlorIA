<template>
  <section class="panel statistics-panel">
    <div class="panel-header">
      <h2>Estadísticas avanzadas</h2>
      <select v-model="selectedVariable" class="period-select" @change="loadStats">
        <option value="temperatura">Temperatura</option>
        <option value="uo">Corrientes (U)</option>
        <option value="vo">Corrientes (V)</option>
        <!-- <option value="so">Salinidad</option> -->
      </select>
    </div>
    <div class="statistics-content">
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Promedio</h3>
          <div class="stat-value">{{ statistics.promedio || 'N/A' }}{{ getUnit() }}</div>
        </div>
        <div class="stat-card">
          <h3>Mínimo</h3>
          <div class="stat-value">{{ statistics.minimo || 'N/A' }}{{ getUnit() }}</div>
        </div>
        <div class="stat-card">
          <h3>Máximo</h3>
          <div class="stat-value">{{ statistics.maximo || 'N/A' }}{{ getUnit() }}</div>
        </div>
        <div class="stat-card">
          <h3>Desviación</h3>
          <div class="stat-value">{{ statistics.desviacion || 'N/A' }}{{ getUnit() }}</div>
        </div>
      </div>
      <div class="chart-container">
        <canvas ref="statsChart"></canvas>
        <div class="no-data-overlay" v-if="!chartData || chartData.length === 0">
          No hay datos disponibles
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import Chart from 'chart.js/auto';
import DataService from '../services/DataService';

export default {
  name: 'StatisticsPanel',
  props: {
    piscifactoriaId: {
      type: [String, Number],
      default: null
    },
    dateRange: {
      type: Object,
      default: () => ({
        start: new Date(new Date().setDate(new Date().getDate() - 30)),
        end: new Date()
      })
    }
  },
  data() {
    return {
      selectedVariable: 'uo', // Por defecto empezamos con corrientes (U)
      statistics: {
        promedio: null,
        minimo: null,
        maximo: null,
        desviacion: null
      },
      chartData: [],
      chart: null
    };
  },
  watch: {
    piscifactoriaId: {
      handler() {
        this.loadStats();
      },
      immediate: true
    },
    dateRange: {
      handler() {
        this.loadStats();
      },
      deep: true
    }
  },
  beforeUnmount() {
    if (this.chart) {
      this.chart.destroy();
    }
  },
  methods: {
    async loadStats() {
      if (!this.piscifactoriaId) {
        this.resetStats();
        return;
      }
      
      try {
        const fechaInicio = this.dateRange.start.toISOString().split('T')[0];
        const fechaFin = this.dateRange.end.toISOString().split('T')[0];
        
        const response = await DataService.getDatosHistoricos(this.selectedVariable, {
          fechaInicio,
          fechaFin,
          piscifactoriaId: this.piscifactoriaId
        });
        
        if (response.status === 200 && response.data.datos && response.data.datos.length > 0) {
          const datos = response.data.datos;
          
          // Calcular estadísticas
          const valores = datos.map(item => parseFloat(item.valor) || 0);
          
          this.statistics.promedio = this.calcularPromedio(valores).toFixed(2);
          this.statistics.minimo = Math.min(...valores).toFixed(2);
          this.statistics.maximo = Math.max(...valores).toFixed(2);
          this.statistics.desviacion = this.calcularDesviacion(valores, parseFloat(this.statistics.promedio)).toFixed(2);
          
          // Actualizar datos para el gráfico
          this.chartData = datos;
          this.updateChart();
        } else {
          this.resetStats();
        }
      } catch (error) {
        console.error('Error al cargar estadísticas:', error);
        this.resetStats();
      }
    },
    
    resetStats() {
      this.statistics = {
        promedio: null,
        minimo: null,
        maximo: null,
        desviacion: null
      };
      this.chartData = [];
      this.updateChart();
    },
    
    calcularPromedio(valores) {
      if (valores.length === 0) return 0;
      return valores.reduce((sum, val) => sum + val, 0) / valores.length;
    },
    
    calcularDesviacion(valores, promedio) {
      if (valores.length === 0) return 0;
      const sumaCuadrados = valores.reduce((sum, val) => sum + Math.pow(val - promedio, 2), 0);
      return Math.sqrt(sumaCuadrados / valores.length);
    },
    
    updateChart() {
      if (this.chart) {
        this.chart.destroy();
      }
      
      if (this.chartData.length === 0 || !this.$refs.statsChart) {
        return;
      }
      
      const ctx = this.$refs.statsChart.getContext('2d');
      
      // Configurar datos para el gráfico
      let dataPoints = this.chartData;
      if (dataPoints.length > 20) {
        const step = Math.ceil(dataPoints.length / 20);
        dataPoints = dataPoints.filter((_, index) => index % step === 0);
      }
      
      const labels = dataPoints.map(item => {
        const date = new Date(item.fecha);
        return date.toLocaleDateString('es-ES', { 
          day: '2-digit', 
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      });
      
      const data = dataPoints.map(item => parseFloat(item.valor) || 0);
      
      // Determinar color según la variable
      let colorMain = '#3498db'; // Azul por defecto (corrientes)
      let colorBg = 'rgba(52, 152, 219, 0.2)';
      
      if (this.selectedVariable === 'temperatura') {
        colorMain = '#e74c3c'; // Rojo para temperatura
        colorBg = 'rgba(231, 76, 60, 0.2)';
      } else if (this.selectedVariable === 'so') {
        colorMain = '#9b59b6'; // Morado para salinidad
        colorBg = 'rgba(155, 89, 182, 0.2)';
      }
      
      // Crear gráfico
      this.chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: this.getVariableLabel(),
            data,
            borderColor: colorMain,
            backgroundColor: colorBg,
            tension: 0.4,
            fill: true
          }]
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
                  return `${this.getVariableLabel()}: ${context.parsed.y.toFixed(2)}${this.getUnit()}`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: false,
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              },
              ticks: {
                color: '#ddd',
                callback: (value) => {
                  return value.toFixed(2) + this.getUnit();
                }
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: '#ddd',
                maxRotation: 45,
                minRotation: 45
              }
            }
          }
        }
      });
    },
    
    getVariableLabel() {
      switch (this.selectedVariable) {
        case 'temperatura': return 'Temperatura';
        case 'uo': return 'Corrientes (U)';
        case 'vo': return 'Corrientes (V)';
        // case 'so': return 'Salinidad';
        default: return this.selectedVariable;
      }
    },
    
    getUnit() {
      switch (this.selectedVariable) {
        case 'temperatura': return ' °C';
        case 'uo': 
        case 'vo': return ' m/s';
        // case 'so': return ' ppt';
        default: return '';
      }
    }
  }
};
</script>

<style scoped>
.statistics-panel {
  flex: 1;
  min-height: 350px;
}

.statistics-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 15px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}

.stat-card {
  background-color: #141832;
  border-radius: 6px;
  padding: 10px;
  text-align: center;
}

.stat-card h3 {
  font-size: 0.8rem;
  margin: 0 0 8px 0;
  color: #a8dadc;
  font-weight: normal;
}

.stat-value {
  font-size: 1.4rem;
  font-weight: bold;
  color: #e9ecef;
}

.chart-container {
  flex: 1;
  position: relative;
  min-height: 200px;
}

.no-data-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(20, 24, 50, 0.7);
  font-style: italic;
  color: #a8dadc;
}

/* Responsive para la cuadrícula de estadísticas */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>