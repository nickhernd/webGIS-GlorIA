<template>
  <div class="app-container">
    <!-- Header minimalista -->
    <header class="header">
      <div class="header-content">
        <h1>GlorIA</h1>
        <div class="header-actions">
          <select v-model="selectedFarmId" @change="onFarmChange" class="select-minimal">
            <option value="">Todas las piscifactorías</option>
            <option v-for="farm in piscifactorias" :key="farm.id" :value="farm.id">
              {{ farm.name }}
            </option>
          </select>
          <button @click="refreshData" class="btn-icon" title="Actualizar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Contenido principal -->
    <main class="main-content">
      <!-- Sidebar lateral -->
      <aside class="sidebar">
        <!-- Selector de fechas -->
        <section class="card">
          <h2>Período</h2>
          <date-range-picker
            v-model="dateRange"
            :format="'dd/MM/yyyy'"
            range
            class="date-input"
            @update:model-value="onDateChange"
          />
        </section>

        <!-- Alertas -->
        <section class="card">
          <h2>Alertas</h2>
          <div v-if="alertas.length > 0" class="alerts">
            <div v-for="alerta in alertas.slice(0, 3)" :key="alerta.id" :class="['alert', `alert-${alerta.nivel}`]">
              <strong>{{ alerta.titulo }}</strong>
              <p>{{ alerta.mensaje }}</p>
            </div>
          </div>
          <p v-else class="empty-state">Sin alertas activas</p>
        </section>

        <!-- Nivel de riesgo -->
        <section class="card">
          <h2>Riesgo</h2>
          <div class="risk-display">
            <div class="risk-value" :style="{ color: riskColor }">{{ riskLevel }}%</div>
            <div class="risk-bar">
              <div class="risk-fill" :style="{ width: `${riskPercent}%`, backgroundColor: riskColor }"></div>
            </div>
            <p class="risk-label">{{ riskText }}</p>
          </div>
        </section>

        <!-- Estadísticas -->
        <statistics-panel
          :piscifactoria-id="selectedFarmId"
          :date-range="dateRange"
        />
      </aside>

      <!-- Área principal con mapa y gráficos -->
      <div class="content-area">
        <!-- Mapa -->
        <section class="card map-card">
          <div class="map-container">
            <div id="map" ref="mapContainer"></div>
            <div class="map-controls">
              <button @click="zoomIn" class="map-btn">+</button>
              <button @click="zoomOut" class="map-btn">−</button>
            </div>
          </div>
        </section>

        <!-- Gráficos -->
        <div class="charts-grid">
          <section class="card chart-card">
            <div class="card-header">
              <h2>Temperatura</h2>
              <select v-model="tempChartPeriod" @change="updateTempChart" class="select-small">
                <option value="day">24h</option>
                <option value="week">7d</option>
                <option value="month">30d</option>
              </select>
            </div>
            <div class="chart-wrapper">
              <canvas ref="tempChart"></canvas>
              <div v-if="!tempData || tempData.length === 0" class="empty-chart">Sin datos</div>
            </div>
          </section>

          <section class="card chart-card">
            <div class="card-header">
              <h2>Corrientes</h2>
              <select v-model="currentChartPeriod" @change="updateCurrentChart" class="select-small">
                <option value="day">24h</option>
                <option value="week">7d</option>
                <option value="month">30d</option>
              </select>
            </div>
            <div class="chart-wrapper">
              <canvas ref="currentChart"></canvas>
              <div v-if="!currentData || currentData.length === 0" class="empty-chart">Sin datos</div>
            </div>
          </section>
        </div>
      </div>
    </main>

    <!-- Loading overlay -->
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
    </div>
  </div>
</template>

<script>
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import DataService from '../services/DataService';
import Chart from 'chart.js/auto';
import DateRangePicker from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css';
import StatisticsPanel from '../components/StatisticsPanel.vue';

export default {
  name: 'Home',
  components: {
    DateRangePicker,
    StatisticsPanel
  },
  data() {
    return {
      map: null,
      markersLayer: null,
      piscifactorias: [],
      selectedFarmId: '',
      loading: true,
      alertas: [],
      tempData: [],
      currentData: [],
      tempChart: null,
      currentChart: null,
      riskLevel: 30,
      tempChartPeriod: 'week',
      currentChartPeriod: 'week',
      dateRange: {
        start: new Date(new Date().setDate(new Date().getDate() - 14)),
        end: new Date()
      }
    };
  },
  computed: {
    riskPercent() {
      return this.riskLevel;
    },
    riskColor() {
      if (this.riskLevel >= 70) return '#ef4444';
      if (this.riskLevel >= 40) return '#f59e0b';
      return '#10b981';
    },
    riskText() {
      if (this.riskLevel >= 70) return 'Alto';
      if (this.riskLevel >= 40) return 'Medio';
      return 'Bajo';
    }
  },
  async mounted() {
    await this.initMap();
    await this.loadPiscifactorias();
    await this.onFarmChange();
    this.loading = false;
  },
  beforeUnmount() {
    if (this.map) this.map.remove();
    if (this.tempChart) this.tempChart.destroy();
    if (this.currentChart) this.currentChart.destroy();
  },
  methods: {
    async initMap() {
      this.map = L.map(this.$refs.mapContainer, {
        center: [39.5, -0.5],
        zoom: 7,
        minZoom: 5,
        maxZoom: 15,
        zoomControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(this.map);

      this.markersLayer = L.layerGroup().addTo(this.map);
    },

    zoomIn() {
      if (this.map) this.map.zoomIn();
    },

    zoomOut() {
      if (this.map) this.map.zoomOut();
    },

    async loadPiscifactorias() {
      try {
        const response = await DataService.getPiscifactorias();
        if (response.status === 200) {
          this.piscifactorias = response.data;
          this.addFarmsToMap();
        }
      } catch (error) {
        console.error('Error al cargar piscifactorías:', error);
      }
    },

    addFarmsToMap() {
      this.markersLayer.clearLayers();

      this.piscifactorias.forEach(farm => {
        if (farm.coordinates && farm.coordinates.length === 2) {
          const marker = L.marker(farm.coordinates, {
            title: farm.name
          });

          marker.bindTooltip(farm.name, {
            permanent: false,
            direction: 'top'
          });

          marker.on('click', () => {
            this.selectedFarmId = farm.id;
            this.onFarmChange();
          });

          this.markersLayer.addLayer(marker);
        }
      });
    },

    async onFarmChange() {
      this.loading = true;

      if (this.selectedFarmId) {
        try {
          const response = await DataService.getPiscifactoria(this.selectedFarmId);

          if (response.status === 200 && response.data) {
            if (response.data.coordinates && response.data.coordinates.length === 2) {
              this.map.setView(response.data.coordinates, 10);
            }

            await Promise.all([
              this.loadAlertas(this.selectedFarmId),
              this.loadHistoricalData()
            ]);

            this.calculateRiskLevel();
          }
        } catch (error) {
          console.error('Error al cargar piscifactoría:', error);
        }
      } else {
        this.alertas = [];
        this.tempData = [];
        this.currentData = [];
        this.riskLevel = 30;

        const bounds = this.getBoundsFarms();
        if (bounds) this.map.fitBounds(bounds);

        await this.loadAlertas();
      }

      this.loading = false;
    },

    onDateChange() {
      this.loadHistoricalData();
    },

    getBoundsFarms() {
      if (this.piscifactorias.length === 0) return null;

      const points = this.piscifactorias
        .filter(farm => farm.coordinates && farm.coordinates.length === 2)
        .map(farm => farm.coordinates);

      if (points.length === 0) return null;

      return L.latLngBounds(points);
    },

    async loadAlertas(farmId) {
      try {
        const response = await DataService.getAlertas(farmId);
        if (response.status === 200) {
          this.alertas = response.data;
        }
      } catch (error) {
        console.error('Error al cargar alertas:', error);
        this.alertas = [];
      }
    },

    async loadHistoricalData() {
      if (!this.selectedFarmId) return;

      try {
        const fechaInicio = this.dateRange.start.toISOString().split('T')[0];
        const fechaFin = this.dateRange.end.toISOString().split('T')[0];

        const tempResponse = await DataService.getDatosHistoricos('temperatura', {
          fechaInicio,
          fechaFin,
          piscifactoriaId: this.selectedFarmId
        });

        if (tempResponse.status === 200 && tempResponse.data.datos) {
          this.tempData = tempResponse.data.datos;
          this.updateTempChart();
        }

        const currentResponse = await DataService.getDatosHistoricos('uo', {
          fechaInicio,
          fechaFin,
          piscifactoriaId: this.selectedFarmId
        });

        if (currentResponse.status === 200 && currentResponse.data.datos) {
          this.currentData = currentResponse.data.datos;
          this.updateCurrentChart();
        }
      } catch (error) {
        console.error('Error al cargar datos históricos:', error);
      }
    },

    updateTempChart() {
      if (this.tempChart) this.tempChart.destroy();

      if (this.tempData.length === 0 || !this.$refs.tempChart) return;

      const ctx = this.$refs.tempChart.getContext('2d');

      const labels = this.tempData.map(item => {
        const date = new Date(item.fecha);
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
      });

      const data = this.tempData.map(item => parseFloat(item.valor) || 0);

      this.tempChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Temperatura (°C)',
            data,
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            tension: 0.4,
            fill: true,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: false,
              grid: {
                color: '#e5e7eb',
                drawBorder: false
              },
              ticks: {
                color: '#6b7280'
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: '#6b7280'
              }
            }
          }
        }
      });
    },

    updateCurrentChart() {
      if (this.currentChart) this.currentChart.destroy();

      if (this.currentData.length === 0 || !this.$refs.currentChart) return;

      const ctx = this.$refs.currentChart.getContext('2d');

      const labels = this.currentData.map(item => {
        const date = new Date(item.fecha);
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
      });

      const data = this.currentData.map(item => Math.abs(parseFloat(item.valor) || 0));

      this.currentChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Corrientes (m/s)',
            data,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            tension: 0.4,
            fill: true,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: '#e5e7eb',
                drawBorder: false
              },
              ticks: {
                color: '#6b7280'
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: '#6b7280'
              }
            }
          }
        }
      });
    },

    refreshData() {
      this.loading = true;

      Promise.all([
        this.selectedFarmId ? this.loadAlertas(this.selectedFarmId) : this.loadAlertas(),
        this.selectedFarmId ? this.loadHistoricalData() : Promise.resolve()
      ]).then(() => {
        this.loading = false;
      }).catch(error => {
        console.error('Error al actualizar datos:', error);
        this.loading = false;
      });
    },

    calculateRiskLevel() {
      if (this.selectedFarmId) {
        DataService.getRiskData(this.selectedFarmId)
          .then(response => {
            if (response.data && response.data.analisisRiesgo) {
              if (response.data.analisisRiesgo.porcentaje !== undefined) {
                this.riskLevel = response.data.analisisRiesgo.porcentaje;
              } else if (response.data.analisisRiesgo.indice !== undefined) {
                this.riskLevel = Math.min(100, Math.round(response.data.analisisRiesgo.indice * 10));
              }
            }
          })
          .catch(error => {
            console.error("Error al obtener datos de riesgo:", error);
            this.riskLevel = 30;
          });
      } else {
        this.riskLevel = 30;
      }
    }
  }
};
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app-container {
  min-height: 100vh;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
}

/* Header */
.header {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 1rem 2rem;
  position: sticky;
  top: 0;
  z-index: 50;
}

.header-content {
  max-width: 1920px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  letter-spacing: -0.02em;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.select-minimal {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: white;
  color: #374151;
  font-size: 0.875rem;
  min-width: 200px;
  cursor: pointer;
  transition: all 0.2s;
}

.select-minimal:hover {
  border-color: #9ca3af;
}

.select-minimal:focus {
  outline: none;
  border-color: #06b6d4;
  box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1);
}

.btn-icon {
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: white;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: #f9fafb;
  color: #111827;
}

/* Main content */
.main-content {
  flex: 1;
  max-width: 1920px;
  margin: 0 auto;
  width: 100%;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 1.5rem;
  padding: 1.5rem 2rem;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.content-area {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Cards */
.card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  overflow: hidden;
}

.card h2 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
}

.card-header h2 {
  padding: 0;
  border: none;
}

.select-small {
  padding: 0.25rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  color: #374151;
  font-size: 0.75rem;
  cursor: pointer;
}

/* Date picker */
.date-input {
  padding: 1rem;
}

/* Alerts */
.alerts {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.alert {
  padding: 0.75rem;
  border-radius: 0.5rem;
  border-left: 3px solid;
  background: #f9fafb;
}

.alert-crítico {
  border-color: #ef4444;
  background: #fef2f2;
}

.alert-advertencia {
  border-color: #f59e0b;
  background: #fffbeb;
}

.alert-informativo {
  border-color: #06b6d4;
  background: #f0f9ff;
}

.alert strong {
  display: block;
  font-size: 0.875rem;
  color: #111827;
  margin-bottom: 0.25rem;
}

.alert p {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0;
}

.empty-state {
  padding: 2rem 1rem;
  text-align: center;
  color: #9ca3af;
  font-size: 0.875rem;
}

/* Risk display */
.risk-display {
  padding: 1.5rem;
  text-align: center;
}

.risk-value {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.risk-bar {
  width: 100%;
  height: 8px;
  background: #f3f4f6;
  border-radius: 9999px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.risk-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.3s ease;
}

.risk-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

/* Map */
.map-card {
  height: 500px;
}

.map-container {
  position: relative;
  height: 100%;
}

#map {
  width: 100%;
  height: 100%;
}

.map-controls {
  position: absolute;
  top: 1rem;
  left: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 1000;
}

.map-btn {
  width: 2rem;
  height: 2rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: #374151;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.map-btn:hover {
  background: #f9fafb;
}

/* Charts */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.chart-card {
  height: 300px;
  display: flex;
  flex-direction: column;
}

.chart-wrapper {
  flex: 1;
  padding: 1rem;
  position: relative;
  min-height: 0;
}

.empty-chart {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 0.875rem;
  background: rgba(249, 250, 251, 0.5);
}

/* Loading */
.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.spinner {
  width: 3rem;
  height: 3rem;
  border: 3px solid #e5e7eb;
  border-top-color: #06b6d4;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 1024px) {
  .main-content {
    grid-template-columns: 1fr;
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .header {
    padding: 1rem;
  }

  .header-content {
    flex-direction: column;
    gap: 1rem;
  }

  .header-actions {
    width: 100%;
  }

  .select-minimal {
    flex: 1;
    min-width: 0;
  }

  .main-content {
    padding: 1rem;
  }
}
</style>
