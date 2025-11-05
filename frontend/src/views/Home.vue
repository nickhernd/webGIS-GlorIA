<template>
  <div class="app-container">
    <!-- Header minimalista -->
    <header class="header">
      <div class="header-content">
        <h1>GlorIA</h1>
        <div class="header-actions">
          <div class="period-selector-compact">
            <label class="period-label">Período:</label>
            <div class="period-buttons">
              <button @click="setDateRange(1)" :class="['period-btn', activePeriod === 1 ? 'active' : '']">24h</button>
              <button @click="setDateRange(7)" :class="['period-btn', activePeriod === 7 ? 'active' : '']">7d</button>
              <button @click="setDateRange(14)" :class="['period-btn', activePeriod === 14 ? 'active' : '']">14d</button>
              <button @click="setDateRange(30)" :class="['period-btn', activePeriod === 30 ? 'active' : '']">30d</button>
            </div>
          </div>
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
        <!-- Alertas -->
        <!-- <section class="card">
          <h2>Alertas</h2>
          <div v-if="alertas.length > 0" class="alerts">
            <div v-for="alerta in alertas.slice(0, 3)" :key="alerta.id" :class="['alert', `alert-${alerta.nivel}`]">
              <strong>{{ alerta.titulo }}</strong>
              <p>{{ alerta.mensaje }}</p>
            </div>
          </div>
          <p v-else class="empty-state">Sin alertas activas</p>
        </section> -->

        <!-- Nivel de riesgo -->
        <!-- <section class="card">
          <h2>Riesgo</h2>
          <div class="risk-display">
            <div class="risk-value" :style="{ color: riskColor }">{{ riskLevel }}%</div>
            <div class="risk-bar">
              <div class="risk-fill" :style="{ width: `${riskPercent}%`, backgroundColor: riskColor }"></div>
            </div>
            <p class="risk-label">{{ riskText }}</p>
          </div>
        </section> -->

        <!-- Estadísticas Avanzadas de Temperatura -->
        <temperature-statistics
          v-if="realTemperatureData && realTemperatureData.statistics"
          :statistics="realTemperatureData.statistics"
          :metadata="realTemperatureData.metadata"
        />

        <!-- Estadísticas Avanzadas de Oleaje -->
        <wave-statistics
          v-if="waveData && waveData.statistics"
          :statistics="waveData.statistics"
          :metadata="waveData.metadata"
        />
      </aside>

      <!-- Área principal con mapa y gráficos -->
      <div class="content-area">
        <!-- Fila 1: Mapa y Gráfico de Temperatura -->
        <div class="row-top">
          <!-- Mapa -->
          <section class="card map-card">
            <div class="card-header">
              <h2>Mapa</h2>
              <div class="header-controls">
                <select v-model="selectedHeatmapDate" @change="updateHeatmap" class="select-small">
                  <option value="">Fecha heatmap</option>
                  <option v-for="date in availableDates" :key="date" :value="date">
                    {{ formatDate(date) }}
                  </option>
                </select>
              </div>
            </div>
            <div class="map-container">
              <div id="map" ref="mapContainer"></div>
              <div class="map-controls">
                <button @click="zoomIn" class="map-btn" title="Acercar">+</button>
                <button @click="zoomOut" class="map-btn" title="Alejar">−</button>
                <button @click="resetView" class="map-btn map-btn-reset" title="Vista general">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                  </svg>
                </button>
              </div>
              <div class="map-layers">
                <div class="layer-control">
                  <div class="layer-header">Capas de Datos Reales</div>
                  <label class="layer-label">
                    <input type="checkbox" v-model="layers.waves" @change="toggleLayer('waves')">
                    <span class="layer-dot" style="background: #0ea5e9;"></span>
                    <span>Oleaje</span>
                  </label>
                  <!-- <label class="layer-label">
                    <input type="checkbox" v-model="layers.currents" @change="toggleLayer('currents')">
                    <span class="layer-dot" style="background: #3b82f6;"></span>
                    <span>Corrientes</span>
                  </label> -->
                  <label class="layer-label">
                    <input type="checkbox" v-model="layers.temperature" @change="toggleLayer('temperature')">
                    <span class="layer-dot" style="background: #ef4444;"></span>
                    <span>Temperatura</span>
                  </label>
                  <!-- <label class="layer-label">
                    <input type="checkbox" v-model="layers.salinity" @change="toggleLayer('salinity')">
                    <span class="layer-dot" style="background: #10b981;"></span>
                    <span>Salinidad</span>
                  </label> -->
                </div>
              </div>

              <!-- Leyenda de mapas de calor -->
              <div v-if="hasActiveLayers" class="heatmap-legend">
                <div class="legend-title">Intensidad</div>
                <div class="legend-gradient" :style="{ background: activeLegendGradient }"></div>
                <div class="legend-labels">
                  <span>Baja</span>
                  <span>Alta</span>
                </div>
              </div>
            </div>
          </section>

          <!-- Gráfico de temperatura -->
          <section class="card chart-card">
            <div class="card-header">
              <h2>Temperatura</h2>
              <div class="header-info">
                <span class="data-source" v-if="realTemperatureData">Datos CMCC TEMP-MFSeas9</span>
                <span class="data-source simulated" v-else>⚠️ Datos simulados</span>
              </div>
            </div>
            <div class="chart-wrapper">
              <canvas ref="tempChart"></canvas>
              <div v-if="!tempData || tempData.length === 0" class="empty-chart">Sin datos</div>
            </div>
          </section>
        </div>

        <!-- Fila 2: Gráfico de Oleaje (ancho completo) -->
        <section class="card chart-card-wide">
          <div class="card-header">
            <h2>Altura de Oleaje</h2>
            <div class="header-info">
              <span class="data-source">Datos HCMR WAVE-MEDWAM4</span>
            </div>
          </div>
          <div class="chart-wrapper">
            <canvas ref="waveChart"></canvas>
            <div v-if="!waveData || !waveData.data || waveData.data.length === 0" class="empty-chart">Sin datos de oleaje</div>
          </div>
        </section>

        <!-- Fila 3: Gráfico de Corrientes (ancho completo) -->
        <!-- <section class="card chart-card-wide">
          <div class="card-header">
            <h2>Corrientes</h2>
            <div class="header-info">
              <span class="data-source simulated">⚠️ Datos simulados</span>
            </div>
          </div>
          <div class="chart-wrapper">
            <canvas ref="currentChart"></canvas>
            <div v-if="!currentData || currentData.length === 0" class="empty-chart">Sin datos</div>
          </div>
        </section> -->
      </div>
    </main>

    <!-- Loading overlay -->
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
    </div>

    <!-- Footer con logos -->
    <footer class="footer">
      <div class="footer-content">
        <div class="footer-logos">
          <img src="/images/gloria.png" alt="GlorIA" class="footer-logo">
          <img src="/images/universitat_alacant.png" alt="Universitat d'Alacant" class="footer-logo">
          <img src="/images/eut.jpg" alt="EUT" class="footer-logo">
          <img src="/images/fondos_europeos.jpg" alt="Fondos Europeos" class="footer-logo">
          <img src="/images/pablo_de_olivade.jpg" alt="Pablo de Olivade" class="footer-logo">
        </div>
      </div>
    </footer>
  </div>
</template>

<script>
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import DataService from '../services/DataService';
import Chart from 'chart.js/auto';
import StatisticsPanel from '../components/StatisticsPanel.vue';
import WaveStatistics from '../components/WaveStatistics.vue';
import TemperatureStatistics from '../components/TemperatureStatistics.vue';

export default {
  name: 'Home',
  components: {
    StatisticsPanel,
    WaveStatistics,
    TemperatureStatistics
  },
  data() {
    return {
      map: null,
      markersLayer: null,
      heatmapLayers: {
        temperature: null,
        currents: null,
        salinity: null
      },
      layers: {
        waves: false,
        temperature: false,
        currents: false,
        salinity: false
      },
      selectedHeatmapDate: '',
      availableDates: [],
      piscifactorias: [],
      selectedFarmId: '',
      loading: true,
      alertas: [],
      waveData: null,
      realCurrentData: null,
      realTemperatureData: null,
      tempData: [],
      currentData: [],
      tempChart: null,
      currentChart: null,
      waveChart: null,
      riskLevel: 30,
      tempChartPeriod: 'week',
      currentChartPeriod: 'week',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      activePeriod: 365
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
    },
    hasActiveLayers() {
      return this.layers.waves || this.layers.temperature || this.layers.currents || this.layers.salinity;
    },
    activeLegendGradient() {
      // Mostrar el gradiente de la primera capa activa
      if (this.layers.waves) {
        return 'linear-gradient(to right, #10b981, #fbbf24, #f97316, #ef4444, #000000)';
      } else if (this.layers.temperature) {
        return 'linear-gradient(to right, #3b82f6, #06b6d4, #10b981, #f59e0b, #ef4444)';
      } else if (this.layers.currents) {
        return 'linear-gradient(to right, #dbeafe, #93c5fd, #3b82f6, #1e40af, #1e3a8a)';
      } else if (this.layers.salinity) {
        return 'linear-gradient(to right, #d1fae5, #6ee7b7, #10b981, #059669, #047857)';
      }
      return '';
    }
  },
  async mounted() {
    await this.initMap();
    await this.loadPiscifactorias();
    await this.loadWaveData();
    await this.loadCurrentData();
    await this.loadTemperatureData();
    await this.onFarmChange();
    this.generateAvailableDates();
    this.loading = false;
  },
  beforeUnmount() {
    if (this.map) this.map.remove();
    if (this.tempChart) this.tempChart.destroy();
    if (this.currentChart) this.currentChart.destroy();
    if (this.waveChart) this.waveChart.destroy();
  },
  methods: {
    async initMap() {
      this.map = L.map(this.$refs.mapContainer, {
        center: [38.5, -0.5],  // Centrado en Comunidad Valenciana
        zoom: 8,
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

    resetView() {
      this.selectedFarmId = '';
      this.onFarmChange();
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

    async loadWaveData() {
      try {
        const response = await DataService.getWaveData();
        if (response.status === 200) {
          this.waveData = {
            data: response.data,
            statistics: response.statistics,
            metadata: response.metadata
          };
          console.log(`Datos de oleaje cargados: ${response.data.length} puntos`);
          console.log('Estadísticas de oleaje:', response.statistics);

          // Crear gráfico de oleaje
          this.$nextTick(() => {
            this.createWaveChart();
          });
        }
      } catch (error) {
        console.error('Error al cargar datos de oleaje:', error);
      }
    },

    async loadCurrentData() {
      try {
        const response = await DataService.getCurrentData();
        if (response.status === 200) {
          this.realCurrentData = {
            data: response.data,
            statistics: response.statistics,
            metadata: response.metadata
          };
          console.log(`Datos de corrientes cargados: ${response.data.length} puntos`);
          console.log('Estadísticas de corrientes:', response.statistics);
        }
      } catch (error) {
        console.error('Error al cargar datos de corrientes:', error);
      }
    },

    async loadTemperatureData() {
      try {
        const response = await DataService.getTemperatureData();
        if (response.status === 200) {
          this.realTemperatureData = {
            data: response.data,
            statistics: response.statistics,
            metadata: response.metadata
          };
          console.log(`Datos de temperatura cargados: ${response.data.length} puntos`);
          console.log('Estadísticas de temperatura:', response.statistics);
        }
      } catch (error) {
        console.error('Error al cargar datos de temperatura:', error);
      }
    },

    createWaveChart() {
      if (!this.waveData || !this.waveData.data || this.waveData.data.length === 0) {
        return;
      }

      // Agrupar datos por timestamp y calcular promedio por hora/día
      const groupedData = {};
      this.waveData.data.forEach(point => {
        const timestamp = point.timestamp;
        if (!groupedData[timestamp]) {
          groupedData[timestamp] = {
            values: [],
            timestamp: timestamp
          };
        }
        groupedData[timestamp].values.push(point.value);
      });

      // Calcular promedios y preparar datos para el gráfico
      const chartData = Object.values(groupedData)
        .map(group => ({
          timestamp: new Date(group.timestamp),
          avgValue: group.values.reduce((a, b) => a + b, 0) / group.values.length,
          minValue: Math.min(...group.values),
          maxValue: Math.max(...group.values)
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      // Crear dataset
      const labels = chartData.map(d => d.timestamp.toLocaleString('es-ES', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit'
      }));

      const avgData = chartData.map(d => d.avgValue);
      const minData = chartData.map(d => d.minValue);
      const maxData = chartData.map(d => d.maxValue);

      // Destruir gráfico anterior si existe
      if (this.waveChart) {
        this.waveChart.destroy();
      }

      // Crear nuevo gráfico
      const ctx = this.$refs.waveChart.getContext('2d');
      this.waveChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Altura Promedio (m)',
              data: avgData,
              borderColor: '#0ea5e9',
              backgroundColor: 'rgba(14, 165, 233, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.4,
              pointRadius: 4,
              pointHoverRadius: 6
            },
            {
              label: 'Altura Máxima (m)',
              data: maxData,
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              borderWidth: 1.5,
              borderDash: [5, 5],
              fill: false,
              tension: 0.4,
              pointRadius: 2,
              pointHoverRadius: 4
            },
            {
              label: 'Altura Mínima (m)',
              data: minData,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
              borderWidth: 1.5,
              borderDash: [5, 5],
              fill: false,
              tension: 0.4,
              pointRadius: 2,
              pointHoverRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            legend: {
              display: true,
              position: 'top'
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleFont: { size: 13 },
              bodyFont: { size: 12 },
              padding: 12,
              callbacks: {
                label: function(context) {
                  let label = context.dataset.label || '';
                  if (label) {
                    label += ': ';
                  }
                  label += context.parsed.y.toFixed(2) + ' m';

                  // Agregar nivel de riesgo
                  const value = context.parsed.y;
                  let risk = '';
                  if (value < 1.0) risk = ' (Bajo)';
                  else if (value < 2.2) risk = ' (Moderado)';
                  else if (value < 4.0) risk = ' (Alto)';
                  else if (value < 6.0) risk = ' (Muy Alto)';
                  else risk = ' (Extremo)';

                  return label + risk;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Altura de Ola (metros)'
              },
              ticks: {
                callback: function(value) {
                  return value.toFixed(1) + ' m';
                }
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Tiempo'
              },
              grid: {
                display: false
              },
              ticks: {
                maxRotation: 45,
                minRotation: 45
              }
            }
          }
        }
      });
    },

    addFarmsToMap() {
      this.markersLayer.clearLayers();

      this.piscifactorias.forEach((farm, index) => {
        if (farm.coordinates && farm.coordinates.length === 2) {
          const isSelected = this.selectedFarmId === farm.id;

          // Crear icono personalizado simple
          const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-container ${isSelected ? 'marker-selected' : ''}">
                     <div class="marker-dot"></div>
                   </div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
            popupAnchor: [0, -8]
          });

          const marker = L.marker(farm.coordinates, {
            icon: icon,
            title: farm.name
          });

          marker.bindTooltip(farm.name, {
            permanent: false,
            direction: 'top',
            offset: [0, -50],
            className: 'custom-tooltip'
          });

          marker.on('click', () => {
            this.selectedFarmId = farm.id;
            this.onFarmChange();
          });

          this.markersLayer.addLayer(marker);
        }
      });
    },

    highlightSelectedFarm(farmId) {
      // Redibujar marcadores para actualizar el resaltado
      this.addFarmsToMap();
    },

    async onFarmChange() {
      this.loading = true;

      if (this.selectedFarmId) {
        try {
          // Primero resaltar el marcador
          this.highlightSelectedFarm(this.selectedFarmId);

          const response = await DataService.getPiscifactoria(this.selectedFarmId);

          if (response.status === 200 && response.data) {
            if (response.data.coordinates && response.data.coordinates.length === 2) {
              // Hacer zoom y focus en la piscifactoría seleccionada con animación
              console.log('Haciendo focus en:', response.data.name, response.data.coordinates);
              this.map.flyTo(response.data.coordinates, 12, {
                duration: 2,
                easeLinearity: 0.25
              });
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
        // Restablecer vista general
        this.highlightSelectedFarm(null);
        this.alertas = [];
        this.riskLevel = 30;

        const bounds = this.getBoundsFarms();
        if (bounds) {
          this.map.flyToBounds(bounds, {
            duration: 1.5,
            padding: [50, 50]
          });
        }

        // Cargar datos incluso sin selección (usará la primera piscifactoría)
        await Promise.all([
          this.loadAlertas(),
          this.loadHistoricalData()
        ]);
      }

      this.loading = false;
    },

    onDateChange() {
      this.loadHistoricalData();
    },

    setDateRange(days) {
      this.activePeriod = days;

      const end = new Date();
      const start = new Date();

      if (days === 1) {
        // Para 24 horas, restar 1 día
        start.setDate(end.getDate() - 1);
      } else {
        // Para otros períodos
        start.setDate(end.getDate() - days);
      }

      this.endDate = end.toISOString().split('T')[0];
      this.startDate = start.toISOString().split('T')[0];

      console.log(`Período cambiado a ${days} días: desde ${this.startDate} hasta ${this.endDate}`);

      // Recargar todos los datos con el nuevo período
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
      // Si no hay piscifactoría seleccionada, usar la primera disponible
      const farmId = this.selectedFarmId || (this.piscifactorias.length > 0 ? this.piscifactorias[0].id : null);

      if (!farmId) {
        console.log('No hay piscifactorías disponibles para cargar datos');
        return;
      }

      try {
        const fechaInicio = this.startDate;
        const fechaFin = this.endDate;

        console.log(`Cargando datos históricos para piscifactoría ${farmId} desde ${fechaInicio} hasta ${fechaFin}`);

        // Usar datos reales de temperatura del JSON en lugar de datos simulados
        if (this.realTemperatureData && this.realTemperatureData.data) {
          console.log(`Usando datos reales de temperatura del JSON (${this.realTemperatureData.data.length} puntos)`);

          // Filtrar datos por rango de fechas
          const startDate = new Date(fechaInicio);
          const endDate = new Date(fechaFin);

          const filteredData = this.realTemperatureData.data.filter(point => {
            const pointDate = new Date(point.timestamp);
            return pointDate >= startDate && pointDate <= endDate;
          });

          // Si no hay datos en el rango, usar TODOS los datos disponibles en lugar de caer a datos simulados
          const dataToUse = filteredData.length > 0 ? filteredData : this.realTemperatureData.data;

          // Convertir al formato esperado por el gráfico
          this.tempData = dataToUse.map(point => ({
            fecha: point.timestamp,
            valor: point.value
          }));

          console.log(`Datos de temperatura ${filteredData.length > 0 ? 'filtrados' : 'completos (sin filtrar)'}: ${this.tempData.length} registros`);
          this.updateTempChart();
        } else {
          console.log('No hay datos reales de temperatura disponibles, usando datos simulados');
          const tempResponse = await DataService.getDatosHistoricos('temperatura', {
            fechaInicio,
            fechaFin,
            piscifactoriaId: farmId
          });

          if (tempResponse.status === 200 && tempResponse.data.datos) {
            console.log(`Datos de temperatura recibidos: ${tempResponse.data.datos.length} registros`);
            this.tempData = tempResponse.data.datos;
            this.updateTempChart();
          }
        }

        const currentResponse = await DataService.getDatosHistoricos('corrientes', {
          fechaInicio,
          fechaFin,
          piscifactoriaId: farmId
        });

        if (currentResponse.status === 200 && currentResponse.data.datos) {
          console.log(`Datos de corrientes recibidos: ${currentResponse.data.datos.length} registros`);
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
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#06b6d4',
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: 12,
              titleFont: {
                size: 14,
                weight: 'bold'
              },
              bodyFont: {
                size: 13
              },
              callbacks: {
                label: function(context) {
                  return `Temperatura: ${context.parsed.y.toFixed(1)}°C`;
                }
              }
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
                color: '#6b7280',
                callback: function(value) {
                  return value.toFixed(1) + '°C';
                }
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: '#6b7280',
                maxRotation: 45,
                minRotation: 45
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
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#8b5cf6',
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: 12,
              titleFont: {
                size: 14,
                weight: 'bold'
              },
              bodyFont: {
                size: 13
              },
              callbacks: {
                label: function(context) {
                  return `Velocidad: ${context.parsed.y.toFixed(2)} m/s`;
                }
              }
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
                color: '#6b7280',
                callback: function(value) {
                  return value.toFixed(2) + ' m/s';
                }
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: '#6b7280',
                maxRotation: 45,
                minRotation: 45
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
    },

    generateAvailableDates() {
      // Generar fechas de los últimos 14 días
      const dates = [];
      for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
      }
      this.availableDates = dates;
      this.selectedHeatmapDate = dates[0]; // Fecha más reciente por defecto
    },

    formatDate(dateStr) {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },

    async toggleLayer(layerName) {
      if (this.layers[layerName]) {
        // Activar capa
        await this.loadHeatmapData(layerName);
      } else {
        // Desactivar capa
        if (this.heatmapLayers[layerName]) {
          this.map.removeLayer(this.heatmapLayers[layerName]);
          this.heatmapLayers[layerName] = null;
        }
      }
    },

    async loadHeatmapData(layerName) {
      try {
        let heatmapData;

        if (layerName === 'waves') {
          // Usar datos reales de oleaje
          if (!this.waveData || !this.waveData.data) {
            console.error('No hay datos de oleaje disponibles');
            return;
          }

          // Convertir datos de oleaje a formato heatmap
          heatmapData = this.waveData.data.map(point => {
            // Normalizar valor entre 0 y 1 para el heatmap
            // Altura máxima ~2.5m según estadísticas
            const intensity = Math.min(1, point.value / 2.5);
            return [point.lat, point.lon, intensity];
          });

          console.log(`Usando ${heatmapData.length} puntos reales de oleaje`);
        } else if (layerName === 'currents') {
          // Usar datos reales de corrientes
          if (!this.realCurrentData || !this.realCurrentData.data) {
            console.error('No hay datos de corrientes disponibles');
            return;
          }

          // Convertir datos de corrientes a formato heatmap
          heatmapData = this.realCurrentData.data.map(point => {
            // Normalizar valor entre 0 y 1 para el heatmap
            // Velocidad máxima ~0.5 m/s según estadísticas
            const intensity = Math.min(1, point.value / 0.5);
            return [point.lat, point.lon, intensity];
          });

          console.log(`Usando ${heatmapData.length} puntos reales de corrientes`);
        } else if (layerName === 'temperature') {
          // Usar datos reales de temperatura
          if (!this.realTemperatureData || !this.realTemperatureData.data) {
            console.error('No hay datos de temperatura disponibles');
            return;
          }

          // Convertir datos de temperatura a formato heatmap
          heatmapData = this.realTemperatureData.data.map(point => {
            // Normalizar valor entre 0 y 1 para el heatmap
            // Temperatura entre 22-26°C según estadísticas
            const minTemp = 22;
            const maxTemp = 26;
            const intensity = Math.min(1, Math.max(0, (point.value - minTemp) / (maxTemp - minTemp)));
            return [point.lat, point.lon, intensity];
          });

          console.log(`Usando ${heatmapData.length} puntos reales de temperatura`);
        } else {
          // Para otras capas que no tenemos datos reales, no mostrar nada
          console.warn(`No hay datos reales para la capa ${layerName}`);
          return;
        }

        // Remover capa anterior si existe
        if (this.heatmapLayers[layerName]) {
          this.map.removeLayer(this.heatmapLayers[layerName]);
        }

        // Crear nueva capa de calor
        this.heatmapLayers[layerName] = L.heatLayer(heatmapData, {
          radius: 25,
          blur: 35,
          maxZoom: 13,
          max: 1.0,
          gradient: this.getGradientForLayer(layerName)
        }).addTo(this.map);

        console.log(`Capa de calor ${layerName} cargada con ${heatmapData.length} puntos`);
      } catch (error) {
        console.error(`Error al cargar heatmap de ${layerName}:`, error);
      }
    },

    generateHeatmapData(layerName) {
      const data = [];
      const bounds = {
        latMin: 37.0,
        latMax: 39.5,
        lngMin: -1.8,
        lngMax: 0.0
      };

      // Generar una cuadrícula de puntos con valores aleatorios
      const step = 0.08;
      for (let lat = bounds.latMin; lat <= bounds.latMax; lat += step) {
        for (let lng = bounds.lngMin; lng <= bounds.lngMax; lng += step) {
          let intensity = 0;

          if (layerName === 'temperature') {
            // Temperatura: más caliente al sur
            intensity = 0.3 + (lat - bounds.latMin) / (bounds.latMax - bounds.latMin) * 0.5 + Math.random() * 0.2;
          } else if (layerName === 'currents') {
            // Corrientes: más fuertes cerca de la costa
            const distToCoast = Math.abs(lng - bounds.lngMin);
            intensity = Math.max(0, 1 - distToCoast * 3) + Math.random() * 0.3;
          } else if (layerName === 'salinity') {
            // Salinidad: patrón más uniforme
            intensity = 0.5 + Math.random() * 0.3;
          }

          // Agregar variación cerca de las piscifactorías
          this.piscifactorias.forEach(farm => {
            const dist = Math.sqrt(
              Math.pow(lat - farm.coordinates[0], 2) +
              Math.pow(lng - farm.coordinates[1], 2)
            );
            if (dist < 0.3) {
              intensity += (0.3 - dist) * 0.5;
            }
          });

          intensity = Math.min(1, Math.max(0, intensity));
          data.push([lat, lng, intensity]);
        }
      }

      return data;
    },

    getGradientForLayer(layerName) {
      const gradients = {
        waves: {
          0.0: '#10b981',  // Verde (< 1m - bajo)
          0.4: '#fbbf24',  // Amarillo (1-2.2m - moderado)
          0.6: '#f97316',  // Naranja (2.2-4m - alto)
          0.8: '#ef4444',  // Rojo (4-6m - muy alto)
          1.0: '#000000'   // Negro (> 6m - extremo)
        },
        temperature: {
          0.0: '#3b82f6',  // Azul (frío)
          0.3: '#06b6d4',  // Cyan
          0.5: '#10b981',  // Verde
          0.7: '#f59e0b',  // Amarillo/Naranja
          1.0: '#ef4444'   // Rojo (caliente)
        },
        currents: {
          0.0: '#dbeafe',  // Azul muy claro
          0.3: '#93c5fd',  // Azul claro
          0.5: '#3b82f6',  // Azul
          0.7: '#1e40af',  // Azul oscuro
          1.0: '#1e3a8a'   // Azul muy oscuro
        },
        salinity: {
          0.0: '#d1fae5',  // Verde muy claro
          0.3: '#6ee7b7',  // Verde claro
          0.5: '#10b981',  // Verde
          0.7: '#059669',  // Verde oscuro
          1.0: '#047857'   // Verde muy oscuro
        }
      };

      return gradients[layerName];
    },

    async updateHeatmap() {
      // Recargar todas las capas activas con la nueva fecha
      for (const [layerName, isActive] of Object.entries(this.layers)) {
        if (isActive) {
          await this.loadHeatmapData(layerName);
        }
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
  max-height: 100vh;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  gap: 1rem;
  align-items: center;
}

.period-selector-compact {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #f9fafb;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}

.period-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  white-space: nowrap;
}

.period-buttons {
  display: flex;
  gap: 0.25rem;
}

.period-btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  color: #6b7280;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.period-btn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
  color: #374151;
}

.period-btn.active {
  background: #06b6d4;
  border-color: #06b6d4;
  color: white;
}

.period-btn.active:hover {
  background: #0891b2;
  border-color: #0891b2;
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
  grid-template-columns: 360px 1fr;
  gap: 1.25rem;
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: calc(100vh - 5rem);
  overflow-y: auto;
}

.content-area {
  display: flex;
  flex-direction: column;
  gap: 0;
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

.header-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.data-source {
  font-size: 0.75rem;
  color: #10b981;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  background: #d1fae5;
}

.data-source.simulated {
  color: #f59e0b;
  background: #fef3c7;
}

.select-small {
  padding: 0.4rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  color: #374151;
  font-size: 0.8rem;
  cursor: pointer;
  min-width: 140px;
  transition: all 0.2s;
}

.select-small:hover {
  border-color: #9ca3af;
}

.select-small:focus {
  outline: none;
  border-color: #06b6d4;
  box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1);
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

/* Row top: Mapa + Temperatura lado a lado */
.row-top {
  display: grid;
  grid-template-columns: 500px 1fr;
  gap: 1.25rem;
  margin-bottom: 1.25rem;
}

/* Map */
.map-card {
  height: 400px;
}

.map-container {
  position: relative;
  height: calc(100% - 2.75rem);
}

#map {
  width: 100%;
  height: 100%;
  border-radius: 0 0 0.5rem 0.5rem;
}

.map-controls {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  z-index: 1000;
}

.map-btn {
  width: 2rem;
  height: 2rem;
  background: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 1.25rem;
  font-weight: 500;
  color: #374151;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.map-btn:hover {
  background: #f3f4f6;
  transform: scale(1.05);
}

.map-btn-reset {
  padding: 0.4rem;
}

.map-btn-reset svg {
  display: block;
}

.heatmap-legend {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: white;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 150px;
}

.legend-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.legend-gradient {
  height: 12px;
  border-radius: 6px;
  margin-bottom: 0.25rem;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.legend-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  color: #6b7280;
}

.map-layers {
  position: absolute;
  bottom: 0.75rem;
  left: 0.75rem;
  background: white;
  border-radius: 0.5rem;
  padding: 0.75rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.layer-control {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.layer-header {
  font-size: 0.75rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.layer-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: #374151;
  user-select: none;
}

.layer-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #06b6d4;
}

.layer-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.layer-label:hover {
  color: #111827;
}

.chart-card {
  height: 400px;
  display: flex;
  flex-direction: column;
}

.chart-card-wide {
  height: 350px;
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
@media (max-width: 1200px) {
  .row-top {
    grid-template-columns: 1fr;
  }

  .map-card {
    height: 300px;
  }

  .chart-card {
    height: 300px;
  }

  .chart-card-wide {
    height: 260px;
  }
}

@media (max-width: 1024px) {
  .main-content {
    grid-template-columns: 1fr;
  }

  .sidebar {
    order: 2;
  }

  .content-area {
    order: 1;
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

/* Estilos para marcadores personalizados */
:deep(.custom-marker) {
  background: transparent;
  border: none;
}

:deep(.marker-container) {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.marker-dot) {
  width: 12px;
  height: 12px;
  background: #06b6d4;
  border: 2px solid white;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  cursor: pointer;
}

:deep(.marker-container):hover .marker-dot {
  transform: scale(1.3);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
}

:deep(.marker-container.marker-selected .marker-dot) {
  background: #ef4444;
  width: 16px;
  height: 16px;
  border-width: 3px;
  animation: pulseRing 2s ease-in-out infinite;
}

@keyframes pulseRing {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7), 0 2px 6px rgba(0, 0, 0, 0.3);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0), 0 3px 10px rgba(0, 0, 0, 0.4);
  }
}

/* Custom tooltip styles */
:deep(.custom-tooltip) {
  background: rgba(0, 0, 0, 0.85);
  border: none;
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

:deep(.custom-tooltip::before) {
  border-top-color: rgba(0, 0, 0, 0.85);
}

/* Footer styles */
.footer {
  background: white;
  border-top: 1px solid #e5e7eb;
  padding: 1rem 2rem;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.footer-content {
  max-width: 100%;
  margin: 0 auto;
}

.footer-logos {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.footer-logo {
  height: 40px;
  width: auto;
  object-fit: contain;
  opacity: 0.85;
  transition: opacity 0.2s ease;
}

.footer-logo:hover {
  opacity: 1;
}

/* Ajustar main-content para que no se solape con el footer */
.main-content {
  padding-bottom: 80px; /* Espacio para el footer */
}

@media (max-width: 768px) {
  .footer {
    padding: 0.75rem 1rem;
  }

  .footer-logos {
    gap: 1rem;
  }

  .footer-logo {
    height: 30px;
  }
}
</style>
