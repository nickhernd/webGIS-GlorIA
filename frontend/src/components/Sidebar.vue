<template>
  <div class="w-64 bg-gray-800 text-white p-4 overflow-y-auto">
    <h2 class="text-xl font-bold mb-4">Capas</h2>
    
    <!-- Selector de capas -->
    <div 
      v-for="layer in availableLayers" 
      :key="layer.id"
      class="bg-white rounded p-4 text-gray-900 mb-4 cursor-pointer hover:shadow-lg transition-shadow"
      @click="selectLayer(layer)"
      :class="{'ring-2 ring-blue-500': selectedLayerId === layer.id}"
    >
      <h3 class="text-blue-600 font-medium">{{ layer.title }}</h3>
      <p class="text-gray-600 text-sm">{{ layer.variable }}</p>
      <p class="text-gray-600 text-sm">{{ formatDate(layer.date) }} • {{ layer.depth }} • {{ layer.resolution }}</p>
      <div class="mt-2">
        <div class="h-2 rounded" :style="getGradientStyle(layer.id)"></div>
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
        <select class="w-full p-2 rounded bg-gray-700 text-white border border-gray-600">
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
</template>

<script>
import DataService from '../services/DataService';

export default {
  name: 'Sidebar',
  data() {
    return {
      selectedLayerId: null,
      selectedDate: new Date().toISOString().split('T')[0],
      availableLayers: []
    };
  },
  async created() {
    await this.loadLayers();
  },
  methods: {
    async loadLayers() {
      this.availableLayers = await DataService.getAvailableLayers();
      
      if (this.availableLayers.length > 0 && !this.selectedLayerId) {
        this.selectLayer(this.availableLayers[0]);
      }
    },
    
    selectLayer(layer) {
      this.selectedLayerId = layer.id;
      this.$emit('layer-selected', layer.id);
    },
    
    updateDate() {
      this.$emit('date-updated', this.selectedDate);
    },
    
    formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES');
    },
    
    getGradientStyle(layerId) {
      let gradient = '';
      
      if (layerId === 'temperature') {
        gradient = 'background: linear-gradient(to right, blue, cyan, green, yellow, red)';
      } else if (layerId === 'currents') {
        gradient = 'background: linear-gradient(to right, #0571b0, #92c5de, #f7f7f7, #f4a582)';
      } else {
        gradient = 'background: linear-gradient(to right, #eff3ff, #bdd7e7, #6baed6, #3182bd, #08519c)';
      }
      
      return gradient;
    }
  }
};
</script>