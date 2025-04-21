<template>
  <div class="dashboard-container">
    <header class="header">
      <h1>GlorIA - Monitoreo de Piscifactorías</h1>
      <div class="header-controls">
        <select v-model="selectedFarmId" @change="onFarmChange" class="farm-selector">
          <option value="">Todas las piscifactorías</option>
          <option v-for="farm in piscifactorias" :key="farm.id" :value="farm.id">
            {{ farm.name }}
          </option>
        </select>
        <button @click="refreshData" class="refresh-btn" aria-label="Actualizar datos">
          <i class="reload-icon"></i>
        </button>
      </div>
    </header>

    <!-- Selector de Rango de Fechas -->
    <section class="date-range-section">
      <date-range-picker
        v-model="dateRange"
        :format="'dd/MM/yyyy'"
        :preview-format="'dd/MM/yyyy'"
        :placeholder="'Seleccionar rango de fechas'"
        :locale="'es'"
        range
        class="date-picker"
        @update:model-value="onDateChange"
      />
    </section>
    
    <div class="dashboard-main">
      <!-- Panel Izquierdo -->
      <div class="left-panel">
        <!-- Panel de Alertas -->
        <section class="panel alerts-panel">
          <h2>Alertas activas</h2>
          <div class="alerts-content">
            <div v-if="alertas.length > 0" class="alerts-list">
              <div v-for="alerta in alertas.slice(0, 4)" :key="alerta.id" :class="['alert-item', `alert-${alerta.nivel}`]">
                <div class="alert-title">{{ alerta.titulo }}</div>
                <div class="alert-message">{{ alerta.mensaje }}</div>
              </div>
            </div>
            <div v-else class="no-data-message">
              No hay alertas activas
            </div>
          </div>
        </section>
        
        <!-- Panel de Temperatura Histórica -->
        <section class="panel chart-panel">
          <div class="panel-header">
            <h2>Temperatura histórica</h2>
            <select v-model="tempChartPeriod" @change="updateTempChart" class="period-select">
              <option value="day">24 horas</option>
              <option value="week">7 días</option>
              <option value="month">30 días</option>
            </select>
          </div>
          <div class="chart-container">
            <canvas ref="tempChart"></canvas>
            <div class="no-data-overlay" v-if="!tempData || tempData.length === 0">
              No hay datos disponibles
            </div>
          </div>
        </section>
        
        <!-- Panel de Estadísticas -->
        <statistics-panel 
          :piscifactoria-id="selectedFarmId" 
          :date-range="dateRange"
        />
      </div>
      
      <!-- Panel Central y Derecho -->
      <div class="right-panel">
        <!-- Panel del Mapa -->
        <section class="panel map-panel">
          <h2>Ubicación geográfica</h2>
          <div class="map-container">
            <div id="map" ref="mapContainer"></div>

            <!-- Controles de zoom -->
            <div class="map-controls">
              <button @click="zoomIn" class="map-btn">+</button>
              <button @click="zoomOut" class="map-btn">−</button>
            </div>



            <!-- Control de animación temporal para el riesgo -->
            <div class="timeline-control" v-if="showRiskLayer && riskData.length > 0">
              <div class="timeline-header">
                <h3>Evolución del riesgo</h3>
                <div class="timeline-buttons">
                  <button @click="playPauseTimeline" class="timeline-btn">
                    <i :class="isTimelinePlaying ? 'pause-icon' : 'play-icon'"></i>
                  </button>
                  <button @click="resetTimeline" class="timeline-btn">
                    <i class="reset-icon"></i>
                  </button>
                </div>
              </div>
              <div class="timeline-slider-container">
                <input 
                  type="range" 
                  class="timeline-slider" 
                  min="0" 
                  :max="riskPredictionDays.length - 1" 
                  v-model="currentTimelineIndex"
                  @input="onTimelineSliderChange">
                <div class="timeline-date">{{ currentTimelineDate }}</div>
              </div>
            </div>

            <!-- Leyendas para cada capa -->
            <div 
              class="map-legend temperature-legend" 
              :class="{ 'active': showTemperatureLayer }"
              v-if="temperatureLayer">
              <div class="legend-title">Temperatura (°C)</div>
              <div class="legend-scale temperature-scale">
                <div class="legend-scale-item"></div>
                <div class="legend-scale-item"></div>
                <div class="legend-scale-item"></div>
                <div class="legend-scale-item"></div>
                <div class="legend-scale-item"></div>
                <div class="legend-scale-item"></div>
              </div>
              <div class="legend-labels">
                <span>12°C</span>
                <span>30°C</span>
              </div>
            </div>

            <div 
              class="map-legend risk-legend" 
              :class="{ 'active': showRiskLayer }"
              v-if="riskLayer">
              <div class="legend-title">Nivel de riesgo</div>
              <div class="legend-scale risk-scale">
                <div class="legend-scale-item"></div>
                <div class="legend-scale-item"></div>
                <div class="legend-scale-item"></div>
                <div class="legend-scale-item"></div>
              </div>
              <div class="legend-labels">
                <span>Bajo</span>
                <span>Alto</span>
              </div>
            </div>

            <div 
              class="map-legend currents-legend" 
              :class="{ 'active': showCorrientsLayer }"
              v-if="arrowsLayer">
              <div class="legend-title">Corrientes marinas</div>
              <div class="current-arrow-legend">
                <svg class="arrow-reference" viewBox="0 0 50 50">
                  <polygon points="0,20 40,20 40,10 50,25 40,40 40,30 0,30"
                           fill="#4a6bff" stroke="#000" stroke-width="1" />
                </svg>
                <span class="arrow-label">Dirección y fuerza</span>
              </div>
            </div>
          </div>
        </section>
        
        <!-- Panel de Nivel de Riesgo -->
        <section class="panel risk-panel">
          <h2>Nivel de riesgo</h2>
          <div class="risk-content">
            <div class="risk-value" :style="{ color: riskColor }">{{ riskLevel }}%</div>
            <div class="risk-bar-container">
              <div class="risk-bar">
                <div class="risk-fill" :style="{ width: `${riskPercent}%`, backgroundColor: riskColor }"></div>
              </div>
            </div>
            <div class="risk-label">{{ riskText }}</div>
            <div class="risk-updated">Última actualización: {{ riskLastUpdated }}</div>
          </div>
        </section>
        
        <!-- Panel de Corrientes Históricas -->
        <section class="panel chart-panel">
          <div class="panel-header">
            <h2>Corrientes históricas</h2>
            <select v-model="currentChartPeriod" @change="updateCurrentChart" class="period-select">
              <option value="day">24 horas</option>
              <option value="week">7 días</option>
              <option value="month">30 días</option>
            </select>
          </div>
          <div class="chart-container">
            <canvas ref="currentChart"></canvas>
            <div class="no-data-overlay" v-if="!currentData || currentData.length === 0">
              No hay datos disponibles
            </div>
          </div>
        </section>

        <!--
        <section class="panel chart-panel">
          <div class="panel-header">
            <h2>Evolución del Nivel de Riesgo</h2>
          </div>
          <div class="chart-container">
            <canvas ref="riskChart"></canvas>
            <div class="no-data-overlay" v-if="riskHistory.length === 0">
              No hay datos disponibles
            </div>
          </div>
        </section>
        
        <section class="panel escape-probability-panel">
          <h2>Probabilidad de Escape</h2>
          <div class="escape-probability-content">
            <div class="probability-value" :style="{ color: escapeProbabilityColor }">{{ escapeProbability }}%</div>
            <div class="probability-description">{{ escapeProbabilityText }}</div>
          </div>
        </section>
          -->
      </div>
    </div>

    <div class="loading-overlay" v-if="loading">
      <div class="loader"></div>
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
  props: {
    id: {
      type: [String, Number],
      default: null
    }
  },
  data() {
    return {
      map: null,
      heatLayer: null,
      markersLayer: null,
      farmAreaLayer: null,
      piscifactorias: [],
      selectedFarmId: '',
      loading: true,
      alertas: [],
      selectedFarmStats: null,
      tempData: [],
      currentData: [],
      variableData: {},
      tempChart: null,
      currentChart: null,
      riskLevel: 30, // Ahora representa el porcentaje directamente (0-100)
      riskHistory: [], // Historial de riesgo para la gráfica (ahora en porcentaje)
      environmentalData: [],
      tempChartPeriod: 'month',
      currentChartPeriod: 'week',
      corrientesLayer: null,
      temperatureLayer: null,
      riskLayer: null,
      showCorrientsLayer: false,
      showTemperatureLayer: false, 
      showRiskLayer: false,
      corrientesData: [],
      temperatureData: [],
      riskData: [],
      arrowsLayer: null,
      // Nuevas propiedades para la línea de tiempo
      riskPredictionDays: [],
      currentTimelineIndex: 0,
      isTimelinePlaying: false,
      timelineInterval: null,
      dateRange: {
        start: new Date(new Date().setDate(new Date().getDate() - 30)),
        end: new Date()
      },
      riskLastUpdated: null,      // Fecha de última actualización del riesgo
      escapeProbability: 0,       // Probabilidad de escape en porcentaje
      escapeProbabilityText: 'Sin datos suficientes para calcular',
      escapeProbabilityColor: '#4a6bff',
    };
  },
  computed: {
    // riskPercent ya no es necesario si riskLevel ya es un porcentaje
    // Deja este método para compatibilidad, pero ahora solo devuelve el valor
    riskPercent() {
      return this.riskLevel;
    },
    riskColor() {
      if (this.riskLevel >= 70) return '#e74c3c';
      if (this.riskLevel >= 40) return '#f39c12';
      return '#2ecc71';
    },
    riskText() {
      if (this.riskLevel >= 70) return 'Alto';
      if (this.riskLevel >= 40) return 'Medio';
      return 'Bajo';
    },
    currentTimelineDate() {
      if (this.riskPredictionDays.length === 0) return '';
      const currentDay = this.riskPredictionDays[this.currentTimelineIndex];
      if (!currentDay) return '';
      return new Date(currentDay.fecha).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    },
    escapeProbabilityColor() {
      if (this.escapeProbability >= 50) return '#e74c3c';
      if (this.escapeProbability >= 20) return '#f39c12';
      return '#4a6bff';
    },
  },
  watch: {
    id: {
      immediate: true,
      handler(newId) {
        if (newId) {
          this.selectedFarmId = newId;
          this.onFarmChange();
        }
      }
    },
    showRiskLayer(newVal) {
      // Si se desactiva la capa de riesgo, detener la animación
      if (!newVal && this.isTimelinePlaying) {
        this.stopTimeline();
      }
    }
  },
  async mounted() {
    await this.initMap();
    await this.loadPiscifactorias();
    
    if (this.id) {
      this.selectedFarmId = this.id;
    }
    
    await this.onFarmChange();
    
    // Cargar capas del mapa
    await this.loadMapLayers();
    
    this.loading = false;
  },
  beforeUnmount() {
    if (this.map) {
      this.map.remove();
    }
    if (this.tempChart) {
      this.tempChart.destroy();
    }
    if (this.currentChart) {
      this.currentChart.destroy();
    }
    // Asegurarse de detener el intervalo al desmontar
    this.stopTimeline();
  },
  methods: {
    async initMap() {
      // Inicializar mapa centrado en España/Mediterráneo
      this.map = L.map(this.$refs.mapContainer, {
        center: [39.5, -0.5], // Valencia, aproximadamente
        zoom: 7,
        minZoom: 5,
        maxZoom: 15,
        zoomControl: false
      });
      
      // Añadir capa base de OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(this.map);
      
      // Inicializar capa para marcadores
      this.markersLayer = L.layerGroup().addTo(this.map);
    },
    
    zoomIn() {
      if (this.map) {
        this.map.zoomIn();
      }
    },
    
    zoomOut() {
      if (this.map) {
        this.map.zoomOut();
      }
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
            title: farm.name,
            riseOnHover: true
          });
          
          marker.bindTooltip(farm.name, {
            permanent: false,
            direction: 'top',
            className: 'farm-tooltip'
          });
          
          marker.on('click', () => {
            this.selectedFarmId = farm.id;
            this.onFarmChange();
          });
          
          this.markersLayer.addLayer(marker);
        }
      });
    },
    
    async loadMapLayers() {
      if (!this.map) {
        console.warn("Mapa no inicializado, no se pueden cargar capas");
        return;
      }

      this.clearMapLayers();

      console.log("Cargando capas de datos para el mapa...");

      try {
        await this.loadCorrientesData();
        console.log("Datos de corrientes cargados:", this.corrientesData.length, "puntos");

        await this.loadTemperatureData();
        console.log("Datos de temperatura cargados:", this.temperatureData.length, "puntos");

        await this.loadRiskData();
        console.log("Datos de riesgo cargados:", this.riskData.length, "puntos");

        console.log("Inicializando capas de datos...");
        this.initializeLayers();

        console.log("Capas del mapa cargadas correctamente");
      } catch (error) {
        console.error("Error al cargar capas de datos:", error);
      }
    },
    
    async loadCorrientesData() {
      // Solo cargar si es necesario y no tenemos datos ya
      if (this.corrientesData.length > 0) return;
      
      try {
        // Obtener la última fecha disponible
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        
        // Intentar cargar datos de corrientes (componentes uo y vo)
        const uoResponse = await DataService.getDatosAmbientales({
          fecha: formattedDate,
          variable: 'uo'
        });
        
        const voResponse = await DataService.getDatosAmbientales({
          fecha: formattedDate,
          variable: 'vo'
        });
        
        if (uoResponse.status === 200 && voResponse.status === 200) {
          const uoData = uoResponse.data.datos || [];
          const voData = voResponse.data.datos || [];
          
          // Combinar datos de uo y vo para crear vectores de corriente
          if (uoData.length > 0 && voData.length > 0) {
            // Crear un mapa para combinar fácilmente por coordenadas
            const corrientesMap = new Map();
            
            // Procesar datos uo
            uoData.forEach(item => {
              if (item.geometria && item.valor !== null) {
                const key = `${item.geometria.coordinates[0]},${item.geometria.coordinates[1]}`;
                corrientesMap.set(key, {
                  lon: item.geometria.coordinates[0],
                  lat: item.geometria.coordinates[1],
                  u: parseFloat(item.valor) || 0,
                  v: 0
                });
              }
            });
            
            // Procesar datos vo y combinar con uo
            voData.forEach(item => {
              if (item.geometria && item.valor !== null) {
                const key = `${item.geometria.coordinates[0]},${item.geometria.coordinates[1]}`;
                if (corrientesMap.has(key)) {
                  const corrienteItem = corrientesMap.get(key);
                  corrienteItem.v = parseFloat(item.valor) || 0;
                } else {
                  corrientesMap.set(key, {
                    lon: item.geometria.coordinates[0],
                    lat: item.geometria.coordinates[1],
                    u: 0,
                    v: parseFloat(item.valor) || 0
                  });
                }
              }
            });
            
            // Convertir el mapa a array
            this.corrientesData = Array.from(corrientesMap.values());
            
            // Realizar un muestreo para reducir la cantidad de flechas si hay demasiadas
            if (this.corrientesData.length > 200) {
              const step = Math.ceil(this.corrientesData.length / 200);
              this.corrientesData = this.corrientesData.filter((_, index) => index % step === 0);
            }
          }
        }
      } catch (error) {
        console.error('Error al cargar datos de corrientes:', error);
        this.corrientesData = [];
      }
    },
    
    async loadTemperatureData() {
      if (this.temperatureData.length > 0) return;

      console.log("Cargando datos de temperatura...");

      try {
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        const tempVariables = ['temperatura', 'temperature', 'temp', 'sst'];
        let dataLoaded = false;

        for (const variable of tempVariables) {
          if (dataLoaded) break;

          try {
            console.log(`Intentando cargar datos de: ${variable}`);
            const response = await DataService.getDatosAmbientales({
              fecha: formattedDate,
              variable
            });

            if (response.status === 200 && response.data && response.data.datos) {
              console.log(`Datos obtenidos para ${variable}:`, response.data.datos.length);

              const validData = response.data.datos
                .filter(item => item.geometria && item.valor !== null && !isNaN(item.valor))
                .map(item => {
                  let coords;
                  if (typeof item.geometria === 'string') {
                    try {
                      coords = JSON.parse(item.geometria).coordinates;
                    } catch (e) {
                      console.warn("No se pudo analizar geometría:", item.geometria);
                      return null;
                    }
                  } else if (item.geometria && item.geometria.coordinates) {
                    coords = item.geometria.coordinates;
                  } else if (item.lng && item.lat) {
                    coords = [item.lng, item.lat];
                  } else if (item.geometria && item.geometria.lat && item.geometria.lng) {
                    coords = [item.geometria.lng, item.geometria.lat];
                  } else {
                    return null;
                  }

                  return {
                    lat: coords[1],
                    lng: coords[0],
                    value: parseFloat(item.valor)
                  };
                })
                .filter(item => item !== null);

              if (validData.length > 0) {
                this.temperatureData = validData;
                dataLoaded = true;
                console.log(`Datos válidos cargados: ${validData.length} puntos`);
              }
            }
          } catch (error) {
            console.warn(`Error al cargar ${variable}:`, error);
          }
        }

        if (!dataLoaded) {
          console.warn("No se pudieron cargar datos.");
        }
      } catch (error) {
        console.error('Error general al cargar datos de temperatura:', error);
      }
    },
    
    async loadRiskData() {
      // Solo cargar si es necesario
      if (this.riskData.length > 0) return;
      
      try {
        // Obtener predicciones de riesgo de escape (7 días)
        const response = await DataService.getRiesgoPrediccion(this.selectedFarmId);
        
        if (response.status === 200 && response.data && response.data.predicciones && response.data.predicciones.length > 0) {
          // Guardar las predicciones para la línea de tiempo
          this.riskPredictionDays = response.data.predicciones;
          
          // Inicialmente mostrar el primer día
          this.currentTimelineIndex = 0;
          
          // Transformar los datos para el heatmap
          this.updateRiskDataForDay(0);
        } else {
          logger.warn("No se encontraron predicciones de riesgo");
        }
      } catch (error) {
        console.error('Error al cargar datos de predicción de riesgo:', error);
      }
    },
    
    
    updateRiskDataForDay(dayIndex) {
      // Actualiza los datos de riesgo según el día seleccionado
      if (!this.riskPredictionDays[dayIndex]) return;
      
      // Obtener valor de riesgo para este día
      const riskValue = this.riskPredictionDays[dayIndex].indice;
      
      // Crear datos para heatmap basados en las piscifactorias
      this.riskData = this.piscifactorias
        .filter(farm => farm.coordinates && farm.coordinates.length === 2)
        .map(farm => {
          // Variar un poco el riesgo para cada piscifactoría
          const farmRisk = Math.min(10, Math.max(1, riskValue + (Math.random() - 0.5) * 2));
          
          return {
            lat: farm.coordinates[1],
            lng: farm.coordinates[0],
            value: farmRisk
          };
        });
      
      // Actualizar la capa de riesgo si ya existe
      if (this.riskLayer && this.showRiskLayer) {
        // Eliminar capa anterior
        if (this.map.hasLayer(this.riskLayer)) {
          this.map.removeLayer(this.riskLayer);
        }
        
        // Crear nueva capa
        this.riskLayer = this.createRiskHeatLayer();
        
        // Añadir al mapa si está activa
        if (this.showRiskLayer) {
          this.riskLayer.addTo(this.map);
        }
      }
    },
    
    initializeLayers() {
      // Inicializar capa de corrientes (vectores/flechas)
      if (this.corrientesData.length > 0) {
        this.createArrowsLayer();
      }
      
      // Inicializar capa de temperatura (heatmap)
      if (this.temperatureData.length > 0) {
        this.temperatureLayer = this.createTemperatureHeatLayer();
      }
      
      // Inicializar capa de riesgo (heatmap)
      if (this.riskData.length > 0) {
        this.riskLayer = this.createRiskHeatLayer();
      }
    },
    
    createTemperatureHeatLayer() {
        // Validación inicial de datos
        if (!this.temperatureData || this.temperatureData.length === 0) {
          console.warn("No hay datos de temperatura disponibles para crear el mapa de calor");
          return null;
        }

        console.log(`Procesando ${this.temperatureData.length} puntos de datos para el mapa de calor de temperatura`);

        // Preprocesamiento de datos más robusto
        const points = this.temperatureData
          .map(item => {
            // Conversión y validación estricta
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lng);
            const value = parseFloat(item.value);

            if (isNaN(lat) || isNaN(lng) || isNaN(value) || 
                lat < -90 || lat > 90 || lng < -180 || lng > 180) {
              console.warn("Punto inválido descartado:", item);
              return null;
            }

            // Aplicar normalización para valores extremos si es necesario
            const normalizedValue = Math.min(Math.max(value, 5), 35); // Limitar entre 5°C y 35°C
            return [lat, lng, normalizedValue];
          })
          .filter(point => point !== null);

        // Verificación secundaria de datos
        if (points.length === 0) {
          console.warn("No se pudieron obtener puntos válidos para el mapa de calor");
          return null;
        } else if (points.length < this.temperatureData.length * 0.5) {
          // Advertencia si más del 50% de los puntos fueron descartados
          console.warn(`Atención: Solo ${points.length} de ${this.temperatureData.length} puntos son válidos`);
        }

        try {
          // Configuración optimizada para mejor visualización
          const heatLayer = L.heatLayer(points, {
            radius: 35,      // Radio de influencia de cada punto
            blur: 20,        // Nivel de difuminado para suavizar la visualización
            maxZoom: 10,     // Nivel de zoom máximo para renderizar el heatmap
            max: 30,         // Valor máximo para la escala (temperaturas altas)
            minOpacity: 0.4, // Opacidad mínima para mejorar visibilidad
            gradient: {      // Gradiente de color mejorado para mejor percepción
              0.3: '#1E5DB4', // Azul oscuro (temperaturas más bajas)
              0.4: '#45A3E5', // Azul claro
              0.5: '#5BC8AF', // Cyan verdoso
              0.6: '#90EB5D', // Verde lima
              0.7: '#F1DA38', // Amarillo
              0.8: '#F87D2B', // Naranja
              0.9: '#EB3323', // Rojo
              1.0: '#BD1410'  // Rojo oscuro (temperaturas más altas)
            }
          });

          console.log(`Mapa de calor de temperatura creado con éxito (${points.length} puntos)`);
          return heatLayer;
        } catch (error) {
          console.error("Error al crear el mapa de calor de temperatura:", error);
          // Proporcionar más contexto para ayudar en depuración
          console.error("Verificar disponibilidad de la biblioteca L.heatLayer y formato de los datos");
          return null;
        }
      },
    
    createRiskHeatLayer() {
      // Crear capa de riesgo con parámetros mejorados
      return L.heatLayer(
        this.riskData.map(item => [item.lat, item.lng, item.value]),
        {
          radius: 50,  // Más grande para enfatizar
          blur: 30,    // Mayor difuminado
          maxZoom: 10,
          max: 10,     // Valor máximo para la escala
          minOpacity: 0.6, // Mayor opacidad mínima
          gradient: {
            0.4: 'green',
            0.6: 'yellow',
            0.8: 'orange',
            1.0: 'red'
          }
        }
      );
    },
    
    createArrowsLayer() {
      // Crear un SVG icon para las flechas de corriente
      const createCurrentArrow = (angle, magnitude) => {
        const size = Math.min(15 + magnitude * 10, 35); // Tamaño basado en la magnitud (aumentado)
        
        // Crear un ícono SVG para representar la flecha
        return L.divIcon({
          html: `<svg width="${size}" height="${size}" viewBox="0 0 50 50">
            <polygon points="0,20 40,20 40,10 50,25 40,40 40,30 0,30"
                     transform="rotate(${angle}, 25, 25)"
                     fill="#4a6bff" stroke="#000" stroke-width="1" />
          </svg>`,
          className: 'current-arrow-icon',
          iconSize: [size, size],
          iconAnchor: [size/2, size/2]
        });
      };
      
      // Crear capa de marcadores para las flechas
      if (this.arrowsLayer) {
        this.map.removeLayer(this.arrowsLayer);
      }
      
      this.arrowsLayer = L.layerGroup();
      
      // Añadir marcadores con flechas para cada punto de datos
      this.corrientesData.forEach(point => {
        // Calcular ángulo y magnitud
        const angle = (Math.atan2(point.v, point.u) * 180 / Math.PI);
        const magnitude = Math.sqrt(point.u * point.u + point.v * point.v);
        
        if (magnitude > 0.01) { // Solo mostrar flechas para corrientes significativas
          const marker = L.marker([point.lat, point.lon], {
            icon: createCurrentArrow(angle, magnitude),
            interactive: false // No interactivo para mejorar rendimiento
          });
          
          this.arrowsLayer.addLayer(marker);
        }
      });
    },
    
    updateLayers() {
      this.clearVisibleLayers();

      if (this.showCorrientsLayer && this.arrowsLayer) {
        console.log("Mostrando capa de corrientes");
        this.arrowsLayer.addTo(this.map);
      }

      if (this.showTemperatureLayer) {
        console.log("Mostrando capa de temperatura");

        // Recrear la capa si no existe o si está vacía
        if (!this.temperatureLayer || !this.map.hasLayer(this.temperatureLayer)) {
          console.log("Recreando capa de temperatura...");
          this.temperatureLayer = this.createTemperatureHeatLayer();
        }

        if (this.temperatureLayer) {
          console.log("Añadiendo capa de temperatura al mapa");
          this.temperatureLayer.addTo(this.map);

          // Forzar redibujado del mapa
          this.map.invalidateSize();
        } else {
          console.warn("No se puede mostrar capa de temperatura: layer no inicializado");
        }
      }


      if (this.showRiskLayer) {
        console.log("Mostrando capa de riesgo");

        if (!this.riskLayer && this.riskData.length > 0) {
          this.riskLayer = this.createRiskHeatLayer();
        }

        if (this.riskLayer) {
          this.riskLayer.addTo(this.map);
        } else {
          console.warn("No se puede mostrar capa de riesgo: layer no inicializado");
        }
      }
    },
    
    clearVisibleLayers() {
      // Eliminar capas visibles pero mantener la estructura
      if (this.arrowsLayer && this.map.hasLayer(this.arrowsLayer)) {
        this.map.removeLayer(this.arrowsLayer);
      }
      
      if (this.temperatureLayer && this.map.hasLayer(this.temperatureLayer)) {
        this.map.removeLayer(this.temperatureLayer);
      }
      
      if (this.riskLayer && this.map.hasLayer(this.riskLayer)) {
        this.map.removeLayer(this.riskLayer);
      }
    },
    
    clearMapLayers() {
      // Limpia completamente las capas y sus datos
      this.clearVisibleLayers();
      
      this.arrowsLayer = null;
      this.temperatureLayer = null;
      this.riskLayer = null;
    },
    
    // Métodos para la línea de tiempo
    playPauseTimeline() {
      if (this.isTimelinePlaying) {
        this.stopTimeline();
      } else {
        this.startTimeline();
      }
    },
    
    startTimeline() {
      if (!this.riskPredictionDays.length) return;
      
      this.isTimelinePlaying = true;
      // Avanzar la línea de tiempo cada 1.5 segundos
      this.timelineInterval = setInterval(() => {
        this.currentTimelineIndex = (this.currentTimelineIndex + 1) % this.riskPredictionDays.length;
        this.updateRiskDataForDay(this.currentTimelineIndex);
      }, 1500);
    },
    
    stopTimeline() {
      if (this.timelineInterval) {
        clearInterval(this.timelineInterval);
        this.timelineInterval = null;
      }
      this.isTimelinePlaying = false;
    },
    
    resetTimeline() {
      this.stopTimeline();
      this.currentTimelineIndex = 0;
      this.updateRiskDataForDay(0);
    },
    
    onTimelineSliderChange() {
      // Detener la reproducción automática si está activa
      if (this.isTimelinePlaying) {
        this.stopTimeline();
      }
      
      // Actualizar los datos según el día seleccionado
      this.updateRiskDataForDay(this.currentTimelineIndex);
    },
    
    async onFarmChange() {
      this.loading = true;
      
      if (this.selectedFarmId) {
        try {
          // Obtener datos de la piscifactoría seleccionada
          const response = await DataService.getPiscifactoria(this.selectedFarmId);
          
          if (response.status === 200 && response.data) {
            this.selectedFarmStats = response.data.stats || {};
            
            // Centrar mapa en la piscifactoría seleccionada
            if (response.data.coordinates && response.data.coordinates.length === 2) {
              this.map.setView(response.data.coordinates, 10);
              
              // Si tiene geometría de área, mostrarla en el mapa
              if (response.data.area_geometry) {
                this.showFarmArea(response.data.area_geometry);
              }
            }
            
            // Cargar datos específicos para esta piscifactoría
            document.title = `GlorIA - ${response.data.name}`;
            
            // Cargar alertas y datos históricos
            await Promise.all([
              this.loadAlertas(this.selectedFarmId),
              this.loadHistoricalData(),
              this.loadVariableData()
            ]);
            
            // Calcular nivel de riesgo
            this.calculateRiskLevel();

            // Cargar datos de predicciones de escape
            await this.loadEscapePrediction(this.selectedFarmId);
          }
        } catch (error) {
          console.error('Error al cargar detalles de piscifactoría:', error);
          this.selectedFarmStats = null;
        }
      } else {
        // Resetear datos
        document.title = "GlorIA - Monitoreo de Piscifactorías";
        this.selectedFarmStats = null;
        this.alertas = [];
        this.tempData = [];
        this.currentData = [];
        this.variableData = {};
        
        // Resetear gráficos
        if (this.tempChart) {
          this.tempChart.destroy();
          this.tempChart = null;
        }
        
        if (this.currentChart) {
          this.currentChart.destroy();
          this.currentChart = null;
        }
        
        // Ajustar vista para mostrar todas las piscifactorías
        const bounds = this.getBoundsFarms();
        if (bounds) {
          this.map.fitBounds(bounds);
        }
        
        // Limpiar capas específicas de piscifactoría
        this.clearFarmLayers();
        
        // Establecer nivel de riesgo predeterminado
        this.riskLevel = 30;
        this.escapeProbability = 0;
        this.escapeProbabilityText = 'Sin datos suficientes para calcular';
        this.riskLastUpdated = null;
        
        // Cargar alertas generales
        await this.loadAlertas();
      }
      
      // Cargar datos ambientales para el mapa
      await this.loadEnvironmentalData();
      
      // Refrescar las capas del mapa cuando cambie la piscifactoría seleccionada
      await this.loadMapLayers();
      
      this.loading = false;
    },
    
    async loadEscapePrediction(piscifactoriaId) {
      try {
        const response = await DataService.getEscapePrediction(piscifactoriaId);
        
        if (response.status === 200 && response.data) {
          const prediccion = response.data;
          
          // Actualizar nivel de riesgo
          if (prediccion.riesgo && prediccion.riesgo.porcentaje !== undefined) {
            this.riskLevel = prediccion.riesgo.porcentaje;
          } else if (prediccion.riesgo && prediccion.riesgo.indice !== undefined) {
            // Convertir índice (0-10) a porcentaje (0-100)
            this.riskLevel = Math.min(100, Math.round(prediccion.riesgo.indice * 100));
          }
          
          // Actualizar probabilidad de escape
          if (prediccion.riesgo && prediccion.riesgo.probabilidad !== undefined) {
            this.escapeProbability = Math.round(prediccion.riesgo.probabilidad * 100);
            
            // Actualizar texto descriptivo basado en la probabilidad
            if (this.escapeProbability < 10) {
              this.escapeProbabilityText = 'Muy baja probabilidad de escape en las condiciones actuales';
            } else if (this.escapeProbability < 30) {
              this.escapeProbabilityText = 'Probabilidad baja. Mantener vigilancia normal';
            } else if (this.escapeProbability < 50) {
              this.escapeProbabilityText = 'Probabilidad media. Se recomienda comprobar sistemas de anclaje';
            } else if (this.escapeProbability < 70) {
              this.escapeProbabilityText = 'Probabilidad alta. Revisar y reforzar jaulas y estructuras';
            } else {
              this.escapeProbabilityText = 'Probabilidad muy alta. Acción inmediata requerida';
            }
          }
          
          // Actualizar fecha de última actualización
          if (prediccion.fecha_actualizacion) {
            const fecha = new Date(prediccion.fecha_actualizacion);
            this.riskLastUpdated = fecha.toLocaleDateString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          }
          
          // Añadir al historial
          const now = new Date();
          this.riskHistory.push({
            date: now,
            value: this.riskLevel
          });
          
          // Limitar historial a 30 días
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          this.riskHistory = this.riskHistory.filter(entry => 
            new Date(entry.date) >= thirtyDaysAgo
          );
          
          // Actualizar gráfica
          this.updateRiskChart();
          
          console.log('Datos de predicción cargados:', prediccion);
          return true;
        }
      } catch (error) {
        console.error('Error al cargar predicción de escape:', error);
        
        // Intentar cargar datos por el endpoint antiguo como fallback
        await this.calculateRiskLevel();
      }
      
      return false;
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
    
    showFarmArea(areaGeometry) {
      if (this.farmAreaLayer) {
        this.map.removeLayer(this.farmAreaLayer);
      }
      
      try {
        const geojson = typeof areaGeometry === 'string' ? JSON.parse(areaGeometry) : areaGeometry;
        this.farmAreaLayer = L.geoJSON(geojson, {
          style: {
            color: '#4a6bff',
            weight: 2,
            opacity: 0.7,
            fillColor: '#4a6bff',
            fillOpacity: 0.1
          }
        }).addTo(this.map);
      } catch (error) {
        console.error('Error al mostrar área de la piscifactoría:', error);
      }
    },
    
    clearFarmLayers() {
      if (this.farmAreaLayer) {
        this.map.removeLayer(this.farmAreaLayer);
        this.farmAreaLayer = null;
      }
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
    
    async loadEnvironmentalData() {
      try {
        const fecha = new Date().toISOString().split('T')[0];
        let variable = 'temperatura';
        
        // Intentar usar variables presentes en la base de datos
        if (this.selectedFarmId) {
          // Si hay una piscifactoría seleccionada, podemos intentar cargar datos más específicos
          const variables = ['temperatura', 'temperature', 'temp'];
          
          // Intentar con diferentes nombres de variables
          for (const v of variables) {
            const params = {
              fecha,
              variable: v,
              piscifactoriaId: this.selectedFarmId
            };
            
            const response = await DataService.getDatosAmbientales(params);
            if (response.status === 200 && response.data.datos && response.data.datos.length > 0) {
              variable = v;
              this.environmentalData = response.data.datos;
              break;
            }
          }
        } else {
          // Si no hay piscifactoría seleccionada, cargar datos generales
          const params = {
            fecha,
            variable: 'temperatura'
          };
          
          const response = await DataService.getDatosAmbientales(params);
          if (response.status === 200 && response.data.datos) {
            this.environmentalData = response.data.datos;
          }
        }
      } catch (error) {
        console.error('Error al cargar datos ambientales:', error);
        this.environmentalData = [];
      }
    },
    
    async loadHistoricalData() {
      if (!this.selectedFarmId) return;
      
      try {
        // Obtener fechas del rango
        const fechaInicio = this.dateRange.start.toISOString().split('T')[0];
        const fechaFin = this.dateRange.end.toISOString().split('T')[0];
        
        // Cargar datos históricos de temperatura (intentar con diferentes nombres)
        const tempVariables = ['temperatura', 'temperature', 'temp'];
        let tempDataLoaded = false;
        
        for (const variable of tempVariables) {
          if (tempDataLoaded) break;
          
          const tempResponse = await DataService.getDatosHistoricos(variable, {
            fechaInicio,
            fechaFin,
            piscifactoriaId: this.selectedFarmId
          });
          
          if (tempResponse.status === 200 && tempResponse.data.datos && tempResponse.data.datos.length > 0) {
            this.tempData = tempResponse.data.datos;
            tempDataLoaded = true;
            this.updateTempChart();
          }
        }
        
        // Si no se cargaron datos de temperatura, intentar con otras variables ambientales
        if (!tempDataLoaded) {
          console.log("No se encontraron datos de temperatura, intentando con otras variables");
          
          // Variables alternativas para temperatura (por ejemplo, sensación térmica)
          const altTempVariables = ['temperatura_agua', 'temp_feel'];
          
          for (const variable of altTempVariables) {
            if (tempDataLoaded) break;
            
            const tempResponse = await DataService.getDatosHistoricos(variable, {
              fechaInicio,
              fechaFin,
              piscifactoriaId: this.selectedFarmId
            });
            
            if (tempResponse.status === 200 && tempResponse.data.datos && tempResponse.data.datos.length > 0) {
              this.tempData = tempResponse.data.datos;
              tempDataLoaded = true;
              this.updateTempChart();
            }
          }
        }
        
        // Cargar datos históricos de corrientes (intentar con diferentes nombres)
        const currentVariables = ['uo', 'vo', 'current', 'currents', 'velocidad_corriente'];
        let currentDataLoaded = false;
        
        for (const variable of currentVariables) {
          if (currentDataLoaded) break;
          
          const currentResponse = await DataService.getDatosHistoricos(variable, {
            fechaInicio,
            fechaFin,
            piscifactoriaId: this.selectedFarmId
          });
          
          if (currentResponse.status === 200 && currentResponse.data.datos && currentResponse.data.datos.length > 0) {
            this.currentData = currentResponse.data.datos;
            currentDataLoaded = true;
            this.updateCurrentChart();
          }
        }
      } catch (error) {
        console.error('Error al cargar datos históricos:', error);
        this.tempData = [];
        this.currentData = [];
      }
    },
    
    async loadVariableData() {
      if (!this.selectedFarmId) return;
      
      this.variableData = {};
      
      // Lista de variables a cargar
      const variables = ['so', 'ph', 'evs', 'pr'];
      
      for (const variable of variables) {
        try {
          const fechaInicio = this.dateRange.start.toISOString().split('T')[0];
          const fechaFin = this.dateRange.end.toISOString().split('T')[0];
          
          const response = await DataService.getDatosHistoricos(variable, {
            fechaInicio,
            fechaFin,
            piscifactoriaId: this.selectedFarmId
          });
          
          if (response.status === 200 && response.data.datos && response.data.datos.length > 0) {
            this.variableData[variable] = response.data.datos;
          }
        } catch (error) {
          console.error(`Error al cargar datos de ${variable}:`, error);
        }
      }
    },
    
    updateTempChart() {
      if (this.tempChart) {
        this.tempChart.destroy();
      }
      
      if (this.tempData.length === 0 || !this.$refs.tempChart) {
        return;
      }
      
      const ctx = this.$refs.tempChart.getContext('2d');
      
      // Reducir el número de puntos para un gráfico más claro
      let dataPoints = this.tempData;
      if (dataPoints.length > 12) {
        const step = Math.ceil(dataPoints.length / 12);
        dataPoints = dataPoints.filter((_, index) => index % step === 0);
      }
      
      const labels = dataPoints.map(item => {
        const date = new Date(item.fecha);
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      });
      
      const data = dataPoints.map(item => parseFloat(item.valor) || 0);
      
      this.tempChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Temperatura (°C)',
            data,
            borderColor: '#e74c3c',
            backgroundColor: 'rgba(231, 76, 60, 0.2)',
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
                color: 'rgba(255, 255, 255, 0.1)'
              },
              ticks: {
                color: '#ddd',
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
                color: '#ddd',
                maxRotation: 45,
                minRotation: 45
              }
            }
          }
        }
      });
    },
    
    updateCurrentChart() {
      if (this.currentChart) {
        this.currentChart.destroy();
      }
      
      if (this.currentData.length === 0 || !this.$refs.currentChart) {
        return;
      }
      
      const ctx = this.$refs.currentChart.getContext('2d');
      
      // Reducir el número de puntos para un gráfico más claro
      let dataPoints = this.currentData;
      if (dataPoints.length > 12) {
        const step = Math.ceil(dataPoints.length / 12);
        dataPoints = dataPoints.filter((_, index) => index % step === 0);
      }
      
      const labels = dataPoints.map(item => {
        const date = new Date(item.fecha);
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      });
      
      const data = dataPoints.map(item => Math.abs(parseFloat(item.valor) || 0));
      
      this.currentChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Corrientes (m/s)',
            data,
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.2)',
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
                color: 'rgba(255, 255, 255, 0.1)'
              },
              ticks: {
                color: '#ddd',
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
                color: '#ddd',
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
      
      // Recargar todos los datos
      Promise.all([
        this.loadEnvironmentalData(),
        this.selectedFarmId ? this.loadAlertas(this.selectedFarmId) : this.loadAlertas(),
        this.selectedFarmId ? this.loadHistoricalData() : Promise.resolve(),
        this.selectedFarmId ? this.loadVariableData() : Promise.resolve(),
        this.loadMapLayers(),
        this.selectedFarmId ? this.loadEscapePrediction(this.selectedFarmId) : Promise.resolve()
      ]).then(() => {
        this.loading = false;
      }).catch(error => {
        console.error('Error al actualizar datos:', error);
        this.loading = false;
      });
    },
    
    getMetricValue(metric) {
      if (!this.selectedFarmStats) {
        return 'N/A';
      }
      
      switch (metric) {
        case 'temperature':
          if (!this.selectedFarmStats.temperature) return 'N/A';
          return this.selectedFarmStats.temperature.current !== undefined ? 
                 this.selectedFarmStats.temperature.current.toFixed(1) : 'N/A';
        case 'salinity': // Nuevo caso para salinidad en lugar de oxígeno
          if (!this.selectedFarmStats.salinity) return 'N/A';
          return this.selectedFarmStats.salinity.current !== undefined ? 
                 this.selectedFarmStats.salinity.current.toFixed(1) : 'N/A';
        case 'currents':
          if (!this.selectedFarmStats.currents) return 'N/A';
          return this.selectedFarmStats.currents.current !== undefined ? 
                 this.selectedFarmStats.currents.current.toFixed(2) : 'N/A';
        default:
          return 'N/A';
      }
    },
    
    getMetricStatusClass(metric) {
      if (!this.selectedFarmStats) return '';
      
      const statData = this.selectedFarmStats[metric];
      if (!statData) return '';
      
      return statData.status === 'warning' ? 'warning' : 
             statData.status === 'critical' ? 'critical' : 'normal';
    },
    
    calculateRiskLevel() {
      // Si tenemos datos de la API con el porcentaje, usarlos directamente
      if (this.selectedFarmId) {
        // Llamar al endpoint actualizado que retorna el riesgo como porcentaje
        DataService.getRiskData(this.selectedFarmId)
          .then(response => {
            if (response.data && response.data.analisisRiesgo) {
              // Usar el porcentaje directamente si está disponible
              if (response.data.analisisRiesgo.porcentaje !== undefined) {
                this.riskLevel = response.data.analisisRiesgo.porcentaje;
              } 
              // Retrocompatibilidad: si solo tenemos índice, convertir a porcentaje
              else if (response.data.analisisRiesgo.indice !== undefined) {
                this.riskLevel = Math.min(100, Math.round(response.data.analisisRiesgo.indice * 10));
              }
              
              // Almacenar nivel de riesgo actual para historial
              const now = new Date();
              this.riskHistory.push({ 
                date: now, 
                value: this.riskLevel 
              });
              
              // Limitar historial a últimos 30 días
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              this.riskHistory = this.riskHistory.filter(entry => 
                new Date(entry.date) >= thirtyDaysAgo
              );
              
              // Actualizar gráfica
              this.updateRiskChart();
            }
          })
          .catch(error => {
            console.error("Error al obtener datos de riesgo:", error);
            // Usar valor por defecto de 30% si hay error
            this.riskLevel = 30;
            this.updateRiskChart();
          });
      } else {
        // Si no hay piscifactoría seleccionada, usar valor por defecto
        this.riskLevel = 30;
        this.updateRiskChart();
      }
    },

    updateRiskChart() {
      if (this.riskChart) {
        this.riskChart.destroy();
      }

      if (!this.$refs.riskChart) return;
      
      const ctx = this.$refs.riskChart.getContext('2d');

      const labels = this.riskHistory.map((entry) =>
        new Date(entry.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
      );
      const data = this.riskHistory.map((entry) => entry.value);

      this.riskChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Nivel de Riesgo (%)',
              data,
              borderColor: '#e74c3c',
              backgroundColor: 'rgba(231, 76, 60, 0.2)',
              tension: 0.4,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  return `Riesgo: ${context.parsed.y}%`;
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              grid: {
                color: 'rgba(255, 255, 255, 0.1)',
              },
              ticks: {
                color: '#ddd',
                callback: function (value) {
                  return value + '%';
                },
              },
            },
            x: {
              grid: {
                display: false,
              },
              ticks: {
                color: '#ddd',
                maxRotation: 45,
                minRotation: 45,
              },
            },
          },
        },
      });
    }
  }
};
</script>

<style scoped>
/* Estilos generales */
.dashboard-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #1a1f3d;
  color: #e9ecef;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  overflow: hidden;
  padding: 0;
  margin: 0;
}

/* Cabecera */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background-color: #141832;
  height: 60px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
  z-index: 10;
}

.header h1 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: bold;
  color: #e9ecef;
}

.header-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.farm-selector {
  background-color: #212850;
  color: white;
  border: 1px solid #4a6bff;
  border-radius: 4px;
  padding: 8px 12px;
  min-width: 250px;
  font-size: 0.9rem;
}

.refresh-btn {
  background-color: #3a4ca1;
  color: white;
  border: none;
  border-radius: 4px;
  width: 32px;
  height: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

.reload-icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>');
  background-size: contain;
  background-repeat: no-repeat;
}

/* Selector de rango de fechas */
.date-range-section {
  padding: 10px 20px;
  background-color: #1a1f3d;
}

.date-picker {
  width: 100%;
  background-color: #212850;
  border-radius: 6px;
  color: white;
}

.date-picker :deep(.dp__theme_dark) {
  --dp-background-color: #212850;
  --dp-text-color: #e9ecef;
  --dp-hover-color: #3a4ca1;
  --dp-hover-text-color: #e9ecef;
  --dp-hover-icon-color: #e9ecef;
  --dp-primary-color: #4a6bff;
  --dp-primary-text-color: #e9ecef;
  --dp-secondary-color: #141832;
  --dp-border-color: #3a4ca1;
  --dp-menu-border-color: #3a4ca1;
}

/* Indicadores principales */
.main-indicators {
  padding: 15px 20px;
  background-color: #1a1f3d;
}

.main-indicators h2 {
  font-size: 1rem;
  margin: 0 0 10px 0;
  color: #a8dadc;
}

.indicators-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
}

.indicator-card {
  background-color: #212850;
  border-radius: 6px;
  padding: 15px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.indicator-card h3 {
  font-size: 0.9rem;
  margin: 0 0 10px 0;
  color: #a8dadc;
  font-weight: normal;
}

.indicator-value {
  font-size: 1.8rem;
  font-weight: bold;
  color: #e9ecef;
}

.indicator-value.normal {
  color: #4a6bff;
}

.indicator-value.warning {
  color: #f9c74f;
}

.indicator-value.critical {
  color: #e63946;
}

.indicator-value.alert-highlight {
  color: #e63946;
}

/* Contenido principal */
.dashboard-main {
  flex: 1;
  display: flex;
  padding: 0 20px 20px 20px;
  gap: 15px;
  overflow: hidden;
}

.left-panel, .right-panel {
  display: flex;
  flex-direction: column;
  gap: 15px;
  overflow: auto;
}

.left-panel {
  flex: 1;
  min-width: 300px;
}

.right-panel {
  flex: 1;
  min-width: 300px;
}

/* Paneles */
.panel {
  background-color: #212850;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel h2 {
  padding: 12px 15px;
  margin: 0;
  font-size: 1rem;
  background-color: #141832;
  border-bottom: 1px solid #4a6bff;
  color: #e9ecef;
  font-weight: normal;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  background-color: #141832;
  border-bottom: 1px solid #4a6bff;
}

.panel-header h2 {
  padding: 0;
  border: none;
  background: none;
}

.period-select {
  background-color: #212850;
  color: white;
  border: 1px solid #4a6bff;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 0.8rem;
}

/* Panel de Alertas */
.alerts-panel {
  flex: 1;
}

.alerts-content {
  flex: 1;
  padding: 15px;
  overflow-y: auto;
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alert-item {
  background-color: #141832;
  border-radius: 6px;
  padding: 10px;
  border-left: 4px solid;
}

.alert-item.alert-crítico {
  border-color: #e63946;
}

.alert-item.alert-advertencia {
  border-color: #f9c74f;
}

.alert-item.alert-informativo {
  border-color: #4a6bff;
}

.alert-title {
  font-weight: bold;
  margin-bottom: 5px;
  color: #e9ecef;
}

.alert-message {
  font-size: 0.85rem;
  color: #a8dadc;
}

.no-data-message {
  padding: 30px 0;
  text-align: center;
  color: #a8dadc;
  font-style: italic;
}

/* Panel de Mapa */
.map-panel {
  flex: 2;
}

.map-container {
  flex: 1;
  position: relative;
  min-height: 200px;
}

#map {
  width: 100%;
  height: 100%;
}

.map-controls {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  z-index: 1000;
}

.map-btn {
  width: 30px;
  height: 30px;
  background-color: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 18px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* Timeline control */
.timeline-control {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 500px;
  background-color: rgba(20, 24, 50, 0.9);
  padding: 10px 15px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.timeline-header h3 {
  margin: 0;
  font-size: 0.9rem;
  color: #e9ecef;
  font-weight: normal;
}

.timeline-buttons {
  display: flex;
  gap: 5px;
}

.timeline-btn {
  background-color: #4a6bff;
  color: white;
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

.timeline-slider-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.timeline-slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: #141832;
  outline: none;
  border-radius: 3px;
  margin-bottom: 8px;
}

.timeline-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #4a6bff;
  cursor: pointer;
  border: 2px solid white;
}

.timeline-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #4a6bff;
  cursor: pointer;
  border: 2px solid white;
}

.timeline-date {
  font-size: 0.8rem;
  color: #e9ecef;
  text-align: center;
}

.play-icon {
  display: inline-block;
  width: 12px;
  height: 12px;
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>');
  background-size: contain;
  background-repeat: no-repeat;
}

.pause-icon {
  display: inline-block;
  width: 12px;
  height: 12px;
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>');
  background-size: contain;
  background-repeat: no-repeat;
}

.reset-icon {
  display: inline-block;
  width: 12px;
  height: 12px;
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>');
  background-size: contain;
  background-repeat: no-repeat;
}

/* Panel de Riesgo */
.risk-panel {
  flex: 1;
}

.risk-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.risk-value {
  font-size: 2.5rem;
  font-weight: bold;
  margin-bottom: 15px;
}

.risk-bar-container {
  width: 100%;
  margin-bottom: 15px;
}

.risk-bar {
  width: 100%;
  height: 16px;
  background-color: #141832;
  border-radius: 8px;
  overflow: hidden;
}

.risk-fill {
  height: 100%;
  border-radius: 8px;
  transition: width 0.3s ease;
}

.risk-label {
  font-size: 1.2rem;
  color: #a8dadc;
}

.risk-updated {
  font-size: 0.9rem;
  color: #a8dadc;
  margin-top: 10px;
  font-style: italic;
}

/* Panel de Probabilidad de Escape */
.escape-probability-panel {
  flex: 1;
  background-color: #212850;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.escape-probability-content {
  text-align: center;
}

.probability-value {
  font-size: 2.5rem;
  font-weight: bold;
  margin-bottom: 10px;
}

.probability-description {
  font-size: 1rem;
  color: #a8dadc;
}

/* Panel de Gráficos */
.chart-panel {
  flex: 1;
  min-height: 250px;
}

.chart-container {
  flex: 1;
  padding: 15px;
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

/* Loader */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(20, 24, 50, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.loader {
  border: 5px solid #212850;
  border-top: 5px solid #4a6bff;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Tooltip */
.farm-tooltip {
  font-size: 12px;
  padding: 4px 8px;
  background-color: rgba(74, 107, 255, 0.9);
  border: 1px solid #4a6bff;
  color: white;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* Responsive */
@media (max-width: 1024px) {
  .indicators-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .dashboard-main {
    flex-direction: column;
  }
  
  .left-panel, .right-panel {
    width: 100%;
  }
  
  .map-panel {
    min-height: 300px;
  }
}

@media (max-width: 768px) {
  .header {
    flex-direction: column;
    height: auto;
    padding: 10px;
    gap: 10px;
  }
  
  .header-controls {
    width: 100%;
  }
  
  .indicators-grid {
    grid-template-columns: 1fr;
  }
  
  .panel {
    min-height: 200px;
  }
}

/* Estilos para el control de capas */
.map-layers-control {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 10px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  width: 150px;
  color: #333;
}

.layers-title {
  font-weight: bold;
  margin-bottom: 8px;
  font-size: 14px;
  color: #333;
  text-align: center;
  border-bottom: 1px solid #ccc;
  padding-bottom: 5px;
}

.layer-option {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}

.layer-option input {
  margin-right: 8px;
}

/* Estilo para las flechas de corriente */
.current-arrow-icon {
  background: none;
  border: none;
}

/* Estilos para leyendas de capas */
.map-legend {
  position: absolute;
  bottom: 20px;
  right: 10px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 10px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  width: 200px;
  display: none; /* Se mostrará cuando se active una capa */
}

.map-legend.active {
  display: block;
}

.legend-title {
  font-weight: bold;
  font-size: 12px;
  margin-bottom: 5px;
  text-align: center;
}

.legend-scale {
  display: flex;
  height: 20px;
  margin-bottom: 5px;
}

.legend-scale-item {
  flex: 1;
  height: 100%;
}

.legend-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
}

/* Escalas de colores específicas */
.temperature-scale .legend-scale-item:nth-child(1) { background-color: blue; }
.temperature-scale .legend-scale-item:nth-child(2) { background-color: cyan; }
.temperature-scale .legend-scale-item:nth-child(3) { background-color: lime; }
.temperature-scale .legend-scale-item:nth-child(4) { background-color: yellow; }
.temperature-scale .legend-scale-item:nth-child(5) { background-color: orange; }
.temperature-scale .legend-scale-item:nth-child(6) { background-color: red; }

.risk-scale .legend-scale-item:nth-child(1) { background-color: green; }
.risk-scale .legend-scale-item:nth-child(2) { background-color: yellow; }
.risk-scale .legend-scale-item:nth-child(3) { background-color: orange; }
.risk-scale .legend-scale-item:nth-child(4) { background-color: red; }

/* Estilo para flechas de referencia en la leyenda */
.current-arrow-legend {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 5px;
}

.arrow-reference {
  width: 30px;
  height: 20px;
  margin-right: 10px;
}

.arrow-label {
  font-size: 10px;
}
</style>