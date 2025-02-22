<!-- MapComponent.vue -->
<template>
  <div class="map-container bg-gray-900 relative flex-1">
    <!-- Mapa principal -->
    <div id="map" class="w-full h-full"></div>

    <!-- Controles superiores -->
    <div class="absolute top-4 right-4 flex gap-2">
      <button 
        v-for="tool in tools" 
        :key="tool.name"
        class="bg-white px-4 py-2 rounded shadow hover:bg-gray-100 flex items-center gap-2"
      >
        <span>{{ tool.name }}</span>
      </button>
    </div>

    <!-- Escala de profundidad -->
    <div class="absolute right-4 bottom-24 bg-white rounded p-2">
      <div class="flex items-center gap-4">
        <div class="w-6 h-64 bg-gradient-to-b from-gray-100 to-gray-900"></div>
        <div class="text-sm">
          <div>0 m</div>
          <div class="mt-24">-2,000</div>
          <div class="mt-24">-4,000</div>
        </div>
      </div>
    </div>

    <!-- Leyenda de temperatura -->
    <div class="absolute left-4 bottom-24 bg-white rounded p-2">
      <div class="mb-2 text-sm font-medium">Temperatura del agua (°C)</div>
      <div class="flex items-center gap-2">
        <div class="h-4 w-48 bg-gradient-to-r from-purple-500 via-red-500 to-yellow-500"></div>
        <div class="flex justify-between w-full text-xs">
          <span>0</span>
          <span>15</span>
          <span>30</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';

export default {
  name: 'MapComponent',
  
  data() {
    return {
      map: null,
      tools: [
        { name: 'Points', icon: 'location_on' },
        { name: 'Lines', icon: 'timeline' },
        { name: 'Areas', icon: 'category' },
        { name: 'Import', icon: 'upload' },
        { name: 'Settings', icon: 'settings' }
      ]
    };
  },

  mounted() {
    // Inicializar el mapa
    mapboxgl.accessToken = 'your_mapbox_token';
    this.map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/dark-v10',
      center: [-0.37739, 39.47019], // Valencia
      zoom: 7
    });

    // Añadir controles de navegación
    this.map.addControl(new mapboxgl.NavigationControl());

    // Eventos del mapa
    this.map.on('load', () => {
      // Aquí añadiremos las capas de datos
      this.addTemperatureLayer();
    });
  },

  methods: {
    addTemperatureLayer() {
      // Añadir capa de temperatura cuando tengamos los datos
      // Este es un placeholder para la implementación real
      if (this.map.getSource('temperature')) return;
      
      this.map.addSource('temperature', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      this.map.addLayer({
        id: 'temperature-layer',
        type: 'heatmap',
        source: 'temperature',
        paint: {
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
          ]
        }
      });
    }
  }
};
</script>

<style scoped>
.map-container {
  height: calc(100vh - 64px); /* Ajustar según el header */
}
</style>