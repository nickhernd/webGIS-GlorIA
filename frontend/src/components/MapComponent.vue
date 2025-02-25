<template>
  <div class="relative w-full h-full">
    <div id="map" class="absolute inset-0"></div>
    
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
    <div class="absolute bottom-4 left-4 bg-white p-2 rounded shadow z-10" v-if="currentLayer">
      <h3 class="text-sm font-medium">{{ currentLayer.variable_name }}</h3>
      <div class="h-2 w-40 mt-1" :style="getGradientStyle(currentLayer.variable_name)"></div>
      <div class="flex justify-between text-xs mt-1">
        <span>{{ currentLayerMinValue }} {{ currentLayer.unit }}</span>
        <span>{{ currentLayerMaxValue }} {{ currentLayer.unit }}</span>
      </div>
    </div>

    <!-- Indicador de carga -->
    <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-20" v-if="isLoading">
      <div class="text-white">Cargando datos...</div>
    </div>
  </div>
</template>

<script>
import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';
import CopertnicusService from '../services/CopertnicusService';

export default {
  name: 'MapComponent',
  props: {
    selectedDatasetId: {
      type: Number,
      default: null
    },
    selectedVariableId: {
      type: Number,
      default: null
    },
    selectedDate: {
      type: String,
      default: () => new Date().toISOString().split('T')[0]
    },
    selectedDepth: {
      type: Number,
      default: -0.5
    }
  },
  data() {
    return {
      map: null,
      currentLayer: null,
      currentLayerMinValue: 0,
      currentLayerMaxValue: 30,
      isLoading: false,
      mapViews: [
        { id: 'valencia', name: 'Valencia' },
        { id: 'mediterraneo', name: 'Mediterráneo' },
        { id: 'global', name: 'Global' }
      ]
    };
  },
  watch: {
    async selectedDatasetId() {
      if (this.selectedDatasetId && this.selectedVariableId && this.map) {
        await this.loadLayerData();
      }
    },
    async selectedVariableId() {
      if (this.selectedDatasetId && this.selectedVariableId && this.map) {
        await this.loadLayerData();
      }
    },
    async selectedDate() {
      if (this.selectedDatasetId && this.selectedVariableId && this.map) {
        await this.loadLayerData();
      }
    },
    async selectedDepth() {
      if (this.selectedDatasetId && this.selectedVariableId && this.map) {
        await this.loadLayerData();
      }
    }
  },
  mounted() {
    this.initMap();
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
      
      this.map.on('load', async () => {
        // Cargar datasets disponibles y seleccionar el primero por defecto
        try {
          const datasets = await CopertnicusService.getDatasets();
          if (datasets.length > 0) {
            const firstDataset = datasets[0];
            const variables = await CopertnicusService.getVariables(firstDataset.id);
            
            if (variables.length > 0) {
              this.currentLayer = variables[0];
              this.$emit('dataset-selected', firstDataset.id);
              this.$emit('variable-selected', variables[0].id);
              
              await this.loadLayerData();
            }
          }
        } catch (error) {
          console.error('Error al cargar datos iniciales:', error);
        }
      });
    },
    
    async loadLayerData() {
      try {
        this.isLoading = true;
        
        // Obtener información de la variable seleccionada
        const variables = await CopertnicusService.getVariables(this.selectedDatasetId);
        this.currentLayer = variables.find(v => v.id === this.selectedVariableId);
        
        if (!this.currentLayer) {
          console.error(`Variable no encontrada: ${this.selectedVariableId}`);
          this.isLoading = false;
          return;
        }
        
        // Obtener el área visible del mapa para filtrar datos
        const bounds = this.map.getBounds();
        
        // Obtener datos filtrados
        const geojsonData = await CopertnicusService.getMarineData(
          this.selectedDatasetId,
          this.selectedVariableId,
          {
            startDate: this.selectedDate,
            endDate: this.selectedDate,
            minLon: bounds._sw.lng,
            maxLon: bounds._ne.lng,
            minLat: bounds._sw.lat,
            maxLat: bounds._ne.lat,
            depth: this.selectedDepth
          }
        );
        
        // Calcular rango de valores para la leyenda
        if (geojsonData.features.length > 0) {
          const values = geojsonData.features.map(f => f.properties.valor);
          this.currentLayerMinValue = Math.min(...values);
          this.currentLayerMaxValue = Math.max(...values);
        }
        
        // Eliminar capas/fuentes existentes si existen
        if (this.map.getLayer('ocean-data-layer')) {
          this.map.removeLayer('ocean-data-layer');
        }
        if (this.map.getSource('ocean-data')) {
          this.map.removeSource('ocean-data');
        }
        
        // Añadir nueva fuente y capa
        this.map.addSource('ocean-data', {
          type: 'geojson',
          data: geojsonData
        });
        
        // Visualización según el tipo de variable
        const variableName = this.currentLayer.variable_name.toLowerCase();
        
        if (variableName.includes('temp') || variableName === 'thetao') {
          this.addTemperatureLayer();
        } else if (variableName.includes('vel') || variableName === 'uo' || variableName === 'vo') {
          this.addCurrentsLayer();
        } else if (variableName.includes('nutrient') || variableName === 'no3') {
          this.addNutrientsLayer();
        } else {
          this.addGenericLayer();
        }
        
        this.isLoading = false;
      } catch (error) {
        console.error('Error al cargar datos de la capa:', error);
        this.isLoading = false;
      }
    },
    
    addTemperatureLayer() {
      this.map.addLayer({
        id: 'ocean-data-layer',
        type: 'heatmap',
        source: 'ocean-data',
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'valor'],
            this.currentLayerMinValue, 0,
            this.currentLayerMaxValue, 1
          ],
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
            ['get', 'valor'],
            this.currentLayerMinValue, '#0571b0',
            (this.currentLayerMinValue + this.currentLayerMaxValue) / 3, '#92c5de',
            (this.currentLayerMinValue + this.currentLayerMaxValue) * 2 / 3, '#f7f7f7',
            this.currentLayerMaxValue, '#f4a582'
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
            ['get', 'valor'],
            this.currentLayerMinValue, '#eff3ff',
            (this.currentLayerMinValue + this.currentLayerMaxValue) / 3, '#bdd7e7',
            (this.currentLayerMinValue + this.currentLayerMaxValue) * 2 / 3, '#6baed6',
            this.currentLayerMaxValue, '#08519c'
          ],
          'circle-opacity': 0.8
        }
      });
    },
    
    addGenericLayer() {
      this.map.addLayer({
        id: 'ocean-data-layer',
        type: 'circle',
        source: 'ocean-data',
        paint: {
          'circle-radius': 4,
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'valor'],
            this.currentLayerMinValue, '#edf8e9',
            (this.currentLayerMinValue + this.currentLayerMaxValue) / 3, '#bae4b3',
            (this.currentLayerMinValue + this.currentLayerMaxValue) * 2 / 3, '#74c476',
            this.currentLayerMaxValue, '#238b45'
          ],
          'circle-opacity': 0.8
        }
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
    
    getGradientStyle(variableName) {
      variableName = variableName.toLowerCase();
      let gradient = '';
      
      if (variableName.includes('temp') || variableName === 'thetao') {
        gradient = 'background: linear-gradient(to right, blue, cyan, green, yellow, red)';
      } else if (variableName.includes('vel') || variableName === 'uo' || variableName === 'vo') {
        gradient = 'background: linear-gradient(to right, #0571b0, #92c5de, #f7f7f7, #f4a582)';
      } else if (variableName.includes('nutrient') || variableName === 'no3') {
        gradient = 'background: linear-gradient(to right, #eff3ff, #bdd7e7, #6baed6, #08519c)';
      } else {
        gradient = 'background: linear-gradient(to right, #edf8e9, #bae4b3, #74c476, #238b45)';
      }
      
      return gradient;
    }
  }
};
</script>

<style scoped>
.mapboxgl-canvas {
  outline: none;
}
</style>