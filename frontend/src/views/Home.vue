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
          <MapComponent 
            :selectedLayer="selectedLayer"
            :selectedDate="selectedDate"
            :selectedDepth="selectedDepth"
          />
          
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
import MapComponent from '../components/MapComponent.vue';

export default {
  name: 'HomeView',
  components: {
    MapComponent
  },
  data() {
    return {
      selectedLayer: null,
      selectedDate: '2025-03-02',
      selectedDepth: -0.5,
      timelinePosition: 75, // Posición en la línea de tiempo (0-100)
      timelineYear: '2025',
      isPlaying: false,
      playbackInterval: null,
      isDragging: false,
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
    // Seleccionar la primera capa por defecto
    if (this.availableLayers.length > 0) {
      this.selectLayer(this.availableLayers[0]);
    }
  },
  methods: {
    selectLayer(layer) {
      this.selectedLayer = layer;
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
};
</script>