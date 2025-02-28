<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <h2>Filtros</h2>
      <button class="btn-collapse" @click="toggleSidebar">
        <i :class="isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'"></i>
      </button>
    </div>

    <div class="sidebar-content" :class="{ 'collapsed': isCollapsed }">
      <!-- Piscifactorías Section -->
      <div class="filter-section">
        <h3>Piscifactorías</h3>
        <div class="search-box">
          <input 
            type="text" 
            placeholder="Buscar piscifactoría..." 
            v-model="searchTerm"
            @input="filterPiscifactorias"
          />
          <i class="fas fa-search"></i>
        </div>

        <div class="piscifactorias-list">
          <div 
            v-for="piscifactoria in filteredPiscifactorias" 
            :key="piscifactoria.id"
            class="piscifactoria-item"
            :class="{ 'active': selectedPiscifactoria && selectedPiscifactoria.id === piscifactoria.id }"
            @click="selectPiscifactoria(piscifactoria)"
          >
            <div class="piscifactoria-marker" :class="piscifactoria.tipo"></div>
            <div class="piscifactoria-details">
              <div class="piscifactoria-name">{{ piscifactoria.nombre }}</div>
              <div class="piscifactoria-location">{{ piscifactoria.ciudad }}, {{ piscifactoria.provincia }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Variables Section -->
      <div class="filter-section">
        <h3>Variables</h3>
        <div class="variables-list">
          <div 
            v-for="variable in variables" 
            :key="variable.id"
            class="variable-item"
            :class="{ 'active': selectedVariable && selectedVariable.id === variable.id }"
            @click="selectVariable(variable)"
          >
            <div class="variable-color" :style="{ backgroundColor: variable.color }"></div>
            <div class="variable-details">
              <div class="variable-name">{{ variable.nombre }}</div>
              <div class="variable-unit" v-if="variable.unidad">{{ variable.unidad }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Date Range Section -->
      <div class="filter-section">
        <h3>Rango de Fechas</h3>
        <DateRangePicker 
          :dateRange="dateRange"
          @update:dateRange="updateDateRange"
        />
      </div>

      <!-- Statistics Section -->
      <div class="filter-section" v-if="selectedPiscifactoria && selectedVariable">
        <h3>Estadísticas</h3>
        <div class="stats-summary">
          <div class="stat-item">
            <div class="stat-label">Promedio</div>
            <div class="stat-value">{{ calculateAverage() }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Mínimo</div>
            <div class="stat-value">{{ calculateMin() }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Máximo</div>
            <div class="stat-value">{{ calculateMax() }}</div>
          </div>
        </div>
      </div>

      <!-- Actions Section -->
      <div class="filter-section actions-section">
        <button class="btn btn-primary btn-block">
          <i class="fas fa-file-download"></i> Descargar Datos
        </button>
        <button class="btn btn-secondary btn-block">
          <i class="fas fa-cog"></i> Configurar
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import DateRangePicker from './DateRangePicker.vue';
import { ref, computed, watch } from 'vue';

export default {
  name: 'Sidebar',
  components: {
    DateRangePicker
  },
  props: {
    piscifactorias: {
      type: Array,
      required: true
    },
    selectedPiscifactoria: {
      type: Object,
      default: null
    },
    variables: {
      type: Array,
      required: true
    },
    selectedVariable: {
      type: Object,
      default: null
    },
    dateRange: {
      type: Object,
      required: true
    },
    variablesData: {
      type: Array,
      default: () => []
    }
  },
  emits: [
    'piscifactoria-selected',
    'variable-selected',
    'date-range-changed'
  ],
  setup(props, { emit }) {
    const isCollapsed = ref(false);
    const searchTerm = ref('');
    const filteredPiscifactorias = ref([...props.piscifactorias]);

    // Watch for changes in piscifactorias prop
    watch(() => props.piscifactorias, (newPiscifactorias) => {
      filterPiscifactorias();
    });

    const toggleSidebar = () => {
      isCollapsed.value = !isCollapsed.value;
    };

    const filterPiscifactorias = () => {
      if (!searchTerm.value.trim()) {
        filteredPiscifactorias.value = [...props.piscifactorias];
        return;
      }

      const term = searchTerm.value.toLowerCase();
      filteredPiscifactorias.value = props.piscifactorias.filter(piscifactoria => 
        piscifactoria.nombre.toLowerCase().includes(term) ||
        piscifactoria.ciudad.toLowerCase().includes(term) ||
        piscifactoria.provincia.toLowerCase().includes(term)
      );
    };

    const selectPiscifactoria = (piscifactoria) => {
      emit('piscifactoria-selected', piscifactoria);
    };

    const selectVariable = (variable) => {
      emit('variable-selected', variable);
    };

    const updateDateRange = (newRange) => {
      emit('date-range-changed', newRange);
    };

    // Helper methods for statistics
    const getFilteredData = () => {
      if (!props.selectedPiscifactoria || !props.selectedVariable || !props.variablesData) {
        return [];
      }

      return props.variablesData.filter(data => 
        data.piscifactoria_id === props.selectedPiscifactoria.id &&
        data.variable_nombre === props.selectedVariable.nombre &&
        new Date(data.fecha_tiempo) >= props.dateRange.start &&
        new Date(data.fecha_tiempo) <= props.dateRange.end
      );
    };

    const calculateAverage = () => {
      const data = getFilteredData();
      if (!data.length) return 'N/A';

      const sum = data.reduce((acc, curr) => acc + curr.valor, 0);
      const avg = sum / data.length;
      return avg.toFixed(2) + (props.selectedVariable?.unidad ? ` ${props.selectedVariable.unidad}` : '');
    };

    const calculateMin = () => {
      const data = getFilteredData();
      if (!data.length) return 'N/A';

      const min = Math.min(...data.map(item => item.valor));
      return min.toFixed(2) + (props.selectedVariable?.unidad ? ` ${props.selectedVariable.unidad}` : '');
    };

    const calculateMax = () => {
      const data = getFilteredData();
      if (!data.length) return 'N/A';

      const max = Math.max(...data.map(item => item.valor));
      return max.toFixed(2) + (props.selectedVariable?.unidad ? ` ${props.selectedVariable.unidad}` : '');
    };

    return {
      isCollapsed,
      searchTerm,
      filteredPiscifactorias,
      toggleSidebar,
      filterPiscifactorias,
      selectPiscifactoria,
      selectVariable,
      updateDateRange,
      calculateAverage,
      calculateMin,
      calculateMax
    };
  }
};
</script>

<style scoped>
.sidebar {
  width: 300px;
  background-color: white;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  position: relative;
  z-index: 10;
}

.sidebar.collapsed {
  width: 50px;
}

.sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.btn-collapse {
  background: none;
  border: none;
  cursor: pointer;
  color: #607d8b;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.btn-collapse:hover {
  background-color: #f5f7f9;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.sidebar-content.collapsed {
  display: none;
}

.filter-section {
  margin-bottom: 1.5rem;
}

.filter-section h3 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #2c3e50;
}

.search-box {
  position: relative;
  margin-bottom: 1rem;
}

.search-box input {
  width: 100%;
  padding: 0.5rem 2rem 0.5rem 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

.search-box i {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  color: #90a4ae;
}

.piscifactorias-list, .variables-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 4px;
}

.piscifactoria-item, .variable-item {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.piscifactoria-item:hover, .variable-item:hover {
  background-color: #f5f7f9;
}

.piscifactoria-item.active, .variable-item.active {
  background-color: #e3f2fd;
}

.piscifactoria-marker {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 0.75rem;
}

.piscifactoria-details, .variable-details {
  flex: 1;
}

.piscifactoria-name, .variable-name {
  font-weight: 500;
  color: #2c3e50;
}

.piscifactoria-location {
  font-size: 0.85rem;
  color: #90a4ae;
}

.variable-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 0.75rem;
}

.variable-unit {
  font-size: 0.85rem;
  color: #90a4ae;
}

.stats-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  padding: 0.5rem;
  background-color: #f5f7f9;
  border-radius: 4px;
}

.stat-item {
  text-align: center;
}

.stat-label {
  font-size: 0.85rem;
  color: #607d8b;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-weight: 600;
  color: #2c3e50;
}

.actions-section {
  margin-top: auto;
}

.btn {
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.btn-primary {
  background-color: #1976d2;
  color: white;
}

.btn-primary:hover {
  background-color: #1565c0;
}

.btn-secondary {
  background-color: #f5f7f9;
  color: #607d8b;
}

.btn-secondary:hover {
  background-color: #eceff1;
}
</style>