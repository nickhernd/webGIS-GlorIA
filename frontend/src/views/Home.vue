<template>
  <div class="flex flex-col h-screen bg-gray-900">
    <!-- Header/Navbar -->
    <header class="bg-gray-800 text-white p-2 flex items-center justify-between">
      <h1 class="text-xl font-bold">WebGIS GLORiA - Monitorización Piscifactorías</h1>
      <div class="flex items-center gap-2">
        <span class="text-sm">{{ formattedDate }}</span>
      </div>
    </header>

    <!-- Main content -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Sidebar -->
      <div class="w-64 bg-gray-800 text-white p-4 overflow-y-auto">
        <h2 class="text-xl font-bold mb-4">Capas</h2>
        
        <!-- Selector de capas -->
        <div 
          v-for="layer in availableLayers" 
          :key="layer.id"
          class="bg-white rounded p-4 text-gray-900 mb-4 cursor-pointer hover:shadow-lg transition-shadow"
          @click="selectLayer(layer)"
          :class="{'ring-2 ring-blue-500': selectedLayer?.id === layer.id}"
        >
          <h3 class="text-blue-600 font-medium">{{ layer.title }}</h3>
          <p class="text-gray-600 text-sm">{{ layer.variable }}</p>
          <p class="text-gray-600 text-sm">{{ layer.date }} • {{ layer.depth }} • {{ layer.resolution }}</p>
          <div class="mt-2">
            <div class="h-2 bg-gradient-to-r" :class="getGradientClass(layer.id)"></div>
            <div class="flex justify-between text-xs mt-1">
              <span>{{ layer.min }}{{ layer.unit }}</span>
              <span>{{ layer.max }}{{ layer.unit }}</span>
            </div>
          </div>
        </div>
        
        <!-- Selector de fecha -->
        <div class="mt-6">
          <h3 class="text-lg font-medium mb-2">Fecha</h3>
          <input 
            type="date" 
            class="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
            v-model="selectedDate"
            @change="updateDate"
          />
        </div>
        
        <!-- Filtros adicionales -->
        <div class="mt-6">
          <h3 class="text-lg font-medium mb-2">Filtros</h3>
          
          <div class="mb-2">
            <label class="block text-sm mb-1">Profundidad</label>
            <select 
              class="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
              v-model="selectedDepth"
              @change="updateDepth"
            >
              <option value="-0.5">-0.5m (Superficie)</option>
              <option value="-10">-10m</option>
              <option value="-50">-50m</option>
              <option value="-100">-100m</option>
            </select>
          </div>
          
          <div class="mb-2">
            <label class="block text-sm mb-1">Resolución</label>
            <select class="w-full p-2 rounded bg-gray-700 text-white border border-gray-600">
              <option value="daily">Diaria</option>
              <option value="monthly">Mensual</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Mapa y contenido principal -->
      <div class="flex-1 flex flex-col relative">
        <!-- Componente de mapa -->
        <div class="flex-1 relative">
          <div id="map" class="absolute inset-0 bg-gray-700"></div>
          
          <!-- Controles superiores -->
          <div class="absolute top-4 right-4 flex gap-2 z-10">
            <button 
              v-for="view in mapViews" 
              :key="view.id"
              class="bg-white px-3 py-1 rounded shadow hover:bg-gray-100"
              @click="changeMapView(view.id)"
            >
              {{ view.name }}
            </button>
          </div>

          <!-- Leyenda -->
          <div class="absolute bottom-4 left-4 bg-white p-2 rounded shadow z-10" v-if="selectedLayer">
            <h3 class="text-sm font-medium">{{ selectedLayer.title }}</h3>
            <div class="h-2 w-40 mt-1 bg-gradient-to-r" :class="getGradientClass(selectedLayer.id)"></div>
            <div class="flex justify-between text-xs mt-1">
              <span>{{ selectedLayer.min }}{{ selectedLayer.unit }}</span>
              <span>{{ selectedLayer.max }}{{ selectedLayer.unit }}</span>
            </div>
          </div>

          <!-- Indicador de carga -->
          <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-20" v-if="isLoading">
            <div class="text-white">Cargando datos...</div>
          </div>
        </div>
        
        <!-- Predicción de riesgo -->
        <div class="absolute top-20 right-4 bg-white p-3 rounded shadow z-10 max-w-xs">
          <h3 class="text-lg font-bold mb-2">Predicción de Riesgo</h3>
          
          <div v-if="predictions.length > 0" class="space-y-3">
            <div 
              v-for="pred in predictions" 
              :key="pred.id"
              class="p-2 rounded border"
              :class="getRiskClass(pred.risk)"
            >
              <div class="font-medium">{{ pred.name }}</div>
              <div class="flex justify-between text-sm">
                <span>Nivel de riesgo:</span>
                <span class="font-bold">{{ getRiskLabel(pred.risk) }}</span>
              </div>
              <div class="mt-2 text-xs">
                <div>Temp. agua: {{ pred.factors.waterTemperature.toFixed(1) }}°C</div>
                <div>Vel. corriente: {{ pred.factors.currentSpeed.toFixed(1) }} m/s</div>
                <div>Vel. viento: {{ pred.factors.windSpeed.toFixed(1) }} km/h</div>
              </div>
            </div>
          </div>
          
          <div v-else class="text-gray-500">
            No hay predicciones disponibles
          </div>
        </div>
        
        <!-- Timeline -->
        <div class="h-20 bg-gray-800 p-2">
          <div class="flex items-center gap-2">
            <button 
              class="text-white bg-gray-700 p-1 rounded hover:bg-gray-600" 
              @click="togglePlayback"
            >
              {{ isPlaying ? '⏸' : '▶' }}
            </button>
            <div class="flex-1 h-2 bg-gray-700 rounded-full relative cursor-pointer" @click="handleTimelineClick">
              <div 
                class="absolute w-4 h-4 bg-blue-500 rounded-full top-1/2 transform -translate-y-1/2 cursor-pointer"
                :style="{ left: timelinePosition + '%' }"
                @mousedown="startDragging"
              ></div>
            </div>
            <span class="text-white text-sm">{{ timelineYear }}</span>
          </div>
          <div class="flex justify-between mt-2 text-gray-400 text-xs px-8">
            <span>Ene</span>
            <span>Feb</span>
            <span>Mar</span>
            <span>Abr</span>
            <span>May</span>
            <span>Jun</span>
            <span>Jul</span>
            <span>Ago</span>
            <span>Sep</span>
            <span>Oct</span>
            <span>Nov</span>
            <span>Dic</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';

export default {
  name: 'HomeView',
  data() {
    return {
      map: null,
      isLoading: false,
      selectedLayer: null,
      selectedDate: '2025-03-02',
      selectedDepth: -0.5,
      timelinePosition: 75, // Posición en la línea de tiempo (0-100)
      timelineYear: '2025',
      isPlaying: false,
      playbackInterval: null,
      isDragging: false,
      mapViews: [
        { id: 'valencia', name: 'Valencia' },
        { id: 'mediterraneo', name: 'Mediterráneo' },
        { id: 'global', name: 'Global' }
      ],
      availableLayers: [
        {
          id: 'temperature',
          title: 'Temperatura del agua',
          variable: 'thetao',
          date: '02/03/2025',
          depth: '-0.5m',
          resolution: 'Global daily',
          min: 0,
          max: 30,
          unit: '°C'
        },
        {
          id: 'currents',
          title: 'Corrientes marinas',
          variable: 'uo-vo',
          date: '02/03/2025',
          depth: '-0.5m',
          resolution: 'Global daily',
          min: 0,
          max: 1.5,
          unit: 'm/s'
        },
        {
          id: 'nutrients',
          title: 'Nutrientes',
          variable: 'no3',
          date: '02/03/2025',
          depth: '-0.5m',
          resolution: 'Global daily',
          min: 0,
          max: 5,
          unit: 'mmol/m³'
        }
      ],
      predictions: [
        {
          id: 1, 
          name: 'Piscifactoría Sagunto', 
          lat: 39.6766, 
          lon: -0.2026,
          risk: 'low',
          factors: {
            waterTemperature: 16.5,
            currentSpeed: 0.3,
            windSpeed: 8.2,
            waveHeight: 0.8
          }
        },
        {
          id: 2, 
          name: 'Piscifactoría Burriana', 
          lat: 39.8573, 
          lon: 0.0522,
          risk: 'medium',
          factors: {
            waterTemperature: 18.2,
            currentSpeed: 0.7,
            windSpeed: 12.5,
            waveHeight: 1.2
          }
        },
        {
          id: 3, 
          name: 'Piscifactoría Calpe', 
          lat: 38.6333, 
          lon: 0.0714,
          risk: 'high',
          factors: {
            waterTemperature: 22.8,
            currentSpeed: 0.9,
            windSpeed: 17.3,
            waveHeight: 2.1
          }
        }
      ]
    }
  },
  computed: {
    formattedDate() {
      return new Date(this.selectedDate).toLocaleDateString('es-ES');
    }
  },
  mounted() {
    this.initMap();
    
    // Seleccionar la primera capa por defecto
    if (this.availableLayers.length > 0) {
      this.selectLayer(this.availableLayers[0]);
    }
  },
  methods: {
    initMap() {
      mapboxgl.accessToken = 'pk.eyJ1IjoibmFhaC1naXMiLCJhIjoiY2xoaHZreDFrMDJnajNjbjFseTlyaHU3diJ9.yH0W2mBAjU6GRTZlv6bVYA';
      
      this.map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [0.15, 39.5], // Costa de la Comunidad Valenciana
        zoom: 7
      });

      this.map.addControl(new mapboxgl.NavigationControl());
      
      this.map.on('load', () => {
        this.addFishFarms();
        if (this.selectedLayer) {
          this.addLayerData();
        }
      });
    },
    
    selectLayer(layer) {
      this.selectedLayer = layer;
      if (this.map && this.map.loaded()) {
        this.addLayerData();
      }
    },
    
    updateDate() {
      // Actualizar fecha y datos
      this.addLayerData();
      // Actualizar posición en la línea de tiempo basado en la fecha
      this.updateTimelineFromDate();
    },
    
    updateDepth() {
      // Actualizar datos con la nueva profundidad
      this.addLayerData();
    },
    
    addLayerData() {
      if (!this.selectedLayer || !this.map) return;
      
      this.isLoading = true;
      
      // Simular carga de datos reales (en producción, esto vendría de una API)
      setTimeout(() => {
        // Eliminar capas existentes si hay
        if (this.map.getLayer('ocean-data-layer')) {
          this.map.removeLayer('ocean-data-layer');
        }
        if (this.map.getSource('ocean-data')) {
          this.map.removeSource('ocean-data');
        }
        
        // Crear datos simulados
        const features = [];
        const layerId = this.selectedLayer.id;
        
        // Generar puntos en el área de la Comunidad Valenciana
        for (let lon = -0.5; lon <= 1.0; lon += 0.1) {
          for (let lat = 38.0; lat <= 40.5; lat += 0.1) {
            let value;
            
            if (layerId === 'temperature') {
              // Valores de temperatura que varían según la localización
              value = 15 + Math.sin(lat * 10) * 3 + Math.cos(lon * 5) * 2;
            } else if (layerId === 'currents') {
              // Velocidad de corrientes
              value = 0.2 + Math.sin(lat * 8) * 0.15 + Math.cos(lon * 6) * 0.1;
            } else {
              // Nutrientes u otros
              value = 1 + Math.sin(lat * 12) * 0.8 + Math.cos(lon * 7) * 0.5;
            }
            
            features.push({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [lon, lat]
              },
              properties: {
                value: value
              }
            });
          }
        }
        
        // Añadir fuente
        this.map.addSource('ocean-data', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: features
          }
        });
        
        // Visualización según el tipo de capa
        if (layerId === 'temperature') {
          this.addTemperatureLayer();
        } else if (layerId === 'currents') {
          this.addCurrentsLayer();
        } else {
          this.addNutrientsLayer();
        }
        
        this.isLoading = false;
      }, 500);
    },
    
    addTemperatureLayer() {
      this.map.addLayer({
        id: 'ocean-data-layer',
        type: 'heatmap',
        source: 'ocean-data',
        paint: {
          'heatmap-weight': ['get', 'value'],
          'heatmap-intensity': 1,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0,0,255,0)',
            0.2, 'rgb(0,0,255)',
            0.4, 'rgb(0,255,255)',
            0.6, 'rgb(0,255,0)',
            0.8, 'rgb(255,255,0)',
            1, 'rgb(255,0,0)'
          ],
          'heatmap-radius': 8,
          'heatmap-opacity': 0.8
        }
      });
    },
    
    addCurrentsLayer() {
      this.map.addLayer({
        id: 'ocean-data-layer',
        type: 'circle',
        source: 'ocean-data',
        paint: {
          'circle-radius': 4,
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'value'],
            0, '#0571b0',
            0.5, '#92c5de',
            1.0, '#f7f7f7',
            1.5, '#f4a582'
          ],
          'circle-opacity': 0.8
        }
      });
    },
    
    addNutrientsLayer() {
      this.map.addLayer({
        id: 'ocean-data-layer',
        type: 'circle',
        source: 'ocean-data',
        paint: {
          'circle-radius': 4,
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'value'],
            0, '#eff3ff',
            1, '#bdd7e7',
            2, '#6baed6',
            3, '#3182bd',
            5, '#08519c'
          ],
          'circle-opacity': 0.8
        }
      });
    },
    
    addFishFarms() {
      // Añadir ubicaciones de piscifactorías al mapa
      const features = this.predictions.map(farm => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [farm.lon, farm.lat]
        },
        properties: {
          id: farm.id,
          name: farm.name,
          risk: farm.risk
        }
      }));
      
      this.map.addSource('fishfarms', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: features
        }
      });
      
      // Añadir capa con colores según nivel de riesgo
      this.map.addLayer({
        id: 'fishfarms-layer',
        type: 'circle',
        source: 'fishfarms',
        paint: {
          'circle-radius': 10,
          'circle-color': [
            'match',
            ['get', 'risk'],
            'low', '#3CB043',
            'medium', '#FFA500',
            'high', '#FF0000',
            '#FFFFFF'
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF'
        }
      });
      
      // Añadir popups para mostrar información al hacer clic
      this.map.on('click', 'fishfarms-layer', (e) => {
        const props = e.features[0].properties;
        
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <h3 class="font-bold">${props.name}</h3>
            <p>Nivel de riesgo: ${this.getRiskLabel(props.risk)}</p>
          `)
          .addTo(this.map);
      });
      
      // Cambiar cursor al pasar sobre las piscifactorías
      this.map.on('mouseenter', 'fishfarms-layer', () => {
        this.map.getCanvas().style.cursor = 'pointer';
      });
      
      this.map.on('mouseleave', 'fishfarms-layer', () => {
        this.map.getCanvas().style.cursor = '';
      });
    },
    
    changeMapView(viewId) {
      if (viewId === 'valencia') {
        this.map.flyTo({ center: [0.15, 39.5], zoom: 7 });
      } else if (viewId === 'mediterraneo') {
        this.map.flyTo({ center: [10, 38], zoom: 4 });
      } else if (viewId === 'global') {
        this.map.flyTo({ center: [0, 30], zoom: 2 });
      }
    },
    
    getGradientClass(layerId) {
      if (layerId === 'temperature') {
        return 'from-blue-500 via-green-500 to-red-500';
      } else if (layerId === 'currents') {
        return 'from-blue-500 via-gray-200 to-red-300';
      } else {
        return 'from-blue-100 via-blue-300 to-blue-800';
      }
    },
    
    getRiskClass(risk) {
      const classes = {
        low: 'border-green-500 bg-green-50',
        medium: 'border-yellow-500 bg-yellow-50',
        high: 'border-red-500 bg-red-50'
      };
      
      return classes[risk] || classes.low;
    },
    
    getRiskLabel(risk) {
      const labels = {
        low: 'Bajo',
        medium: 'Medio',
        high: 'Alto'
      };
      
      return labels[risk] || 'Desconocido';
    },
    
    togglePlayback() {
      this.isPlaying = !this.isPlaying;
      
      if (this.isPlaying) {
        this.playbackInterval = setInterval(() => {
          // Avanzar un día en cada intervalo
          const date = new Date(this.selectedDate);
          date.setDate(date.getDate() + 1);
          
          if (date > new Date('2025-12-31')) {
            // Reiniciar al comienzo del rango
            date.setFullYear(2023);
            date.setMonth(0);
            date.setDate(1);
          }
          
          this.selectedDate = date.toISOString().split('T')[0];
          this.updateTimelineFromDate();
          this.addLayerData();
        }, 1000); // Actualizar cada segundo
      } else {
        clearInterval(this.playbackInterval);
      }
    },
    
    updateTimelineFromDate() {
      const date = new Date(this.selectedDate);
      this.timelineYear = date.getFullYear().toString();
      
      // Calcular posición en la línea de tiempo (simplificado)
      const startYear = 2023;
      const endYear = 2025;
      const yearRange = endYear - startYear;
      
      const yearFraction = date.getMonth() / 12;
      const yearValue = date.getFullYear() + yearFraction - startYear;
      
      this.timelinePosition = (yearValue / yearRange) * 100;
    },
    
    startDragging(event) {
      this.isDragging = true;
      
      // Si estaba reproduciendo, pausar
      if (this.isPlaying) {
        this.togglePlayback();
      }
      
      document.addEventListener('mousemove', this.handleDrag);
      document.addEventListener('mouseup', this.stopDragging);
    },
    
    handleDrag(event) {
      if (!this.isDragging) return;
      
      const timeline = event.target.parentElement;
      const rect = timeline.getBoundingClientRect();
      const position = ((event.clientX - rect.left) / rect.width) * 100;
      
      this.timelinePosition = Math.max(0, Math.min(100, position));
      this.updateDateFromTimeline();
    },
    
    handleTimelineClick(event) {
      const rect = event.currentTarget.getBoundingClientRect();
      const position = ((event.clientX - rect.left) / rect.width) * 100;
      
      this.timelinePosition = Math.max(0, Math.min(100, position));
      this.updateDateFromTimeline();
    },
    
    updateDateFromTimeline() {
      // Convertir posición a fecha (simplificado)
      const startYear = 2023;
      const endYear = 2025;
      const yearRange = endYear - startYear;
      
      const yearValue = (this.timelinePosition / 100) * yearRange + startYear;
      const year = Math.floor(yearValue);
      const monthFraction = yearValue - year;
      const month = Math.floor(monthFraction * 12);
      
      const date = new Date(year, month, 15);
      this.selectedDate = date.toISOString().split('T')[0];
      this.timelineYear = year.toString();
      
      // Actualizar la visualización
      this.addLayerData();
    },
    
    stopDragging() {
      this.isDragging = false;
      document.removeEventListener('mousemove', this.handleDrag);
      document.removeEventListener('mouseup', this.stopDragging);
    }
  },
  beforeUnmount() {
    // Limpiar interval si la vista se desmonta
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
    }
    
    // Limpiar event listeners
    if (this.isDragging) {
      document.removeEventListener('mousemove', this.handleDrag);
      document.removeEventListener('mouseup', this.stopDragging);
    }
  }
}
</script>

<style scoped>
.mapboxgl-canvas {
  outline: none;
}
</style>