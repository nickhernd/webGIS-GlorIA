<template>
  <div class="flex flex-col h-screen bg-gray-900">
    <!-- Header/Navbar -->
    <header class="bg-gray-800 text-white px-4 py-2 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold">MyOcean PRO</h1>
        <span class="text-sm text-gray-400">Monitorización de Piscifactorías CV</span>
      </div>
      <div class="flex items-center gap-4">
        <span class="text-sm">{{ currentDate }}</span>
      </div>
    </header>

    <!-- Main Content -->
    <div class="flex flex-1">
      <Sidebar 
        @select="selectPiscifactoría"
        @date-range-update="updateDateRange"
        @filter-update="applyFilter"
        :selectedPiscifactoría="selectedPiscifactoría"
      />
      <div class="flex-1 flex flex-col">
        <MapComponent 
          :piscifactoría="selectedPiscifactoría"
          :dateRange="dateRange"
          :filter="filter"
        />
        <StatsComponent 
          :piscifactoría="selectedPiscifactoría"
          :dateRange="dateRange"
          :filter="filter"
        />
      </div>
    </div>
  </div>
</template>

<script>
import Sidebar from '../components/Sidebar.vue'
import MapComponent from '../components/MapComponent.vue'
import StatsComponent from '../components/StatsComponent.vue'

export default {
  name: 'HomeView',
  components: {
    Sidebar,
    MapComponent,
    StatsComponent
  },
  data() {
    return {
      selectedPiscifactoría: null,
      dateRange: null,
      filter: {},
      currentDate: new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    }
  },
  methods: {
    selectPiscifactoría(piscifactoría) {
      this.selectedPiscifactoría = piscifactoría
    },
    updateDateRange(range) {
      this.dateRange = range
    },
    applyFilter(filter) {
      this.filter = filter
    }
  }
}
</script>