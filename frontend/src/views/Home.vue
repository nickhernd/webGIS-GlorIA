<template>
  <div class="app-container">
    <!-- Header -->
    <header class="app-header">
      <div class="logo">
        <img src="../assets/logo-gloria.png" alt="GlorIA Logo" v-if="false" />
        <h1>WebGIS GlorIA</h1>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary">
          <i class="fas fa-user"></i> Login
        </button>
        <button class="btn btn-info">
          <i class="fas fa-info-circle"></i> Ayuda
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Sidebar -->
      <Sidebar 
        :piscifactorias="piscifactorias" 
        :selectedPiscifactoria="selectedPiscifactoria"
        :variables="variables"
        :selectedVariable="selectedVariable"
        :dateRange="dateRange"
        @piscifactoria-selected="handlePiscifactoriaSelected"
        @variable-selected="handleVariableSelected"
        @date-range-changed="handleDateRangeChanged"
      />

      <!-- Map and visualizations container -->
      <div class="content-wrapper">
        <!-- Map component takes most of the space -->
        <div class="map-container">
          <LeafletMap 
            :piscifactorias="piscifactorias"
            :selectedPiscifactoria="selectedPiscifactoria"
            :variablesData="filteredVariablesData"
            :selectedVariable="selectedVariable"
            @piscifactoria-clicked="handlePiscifactoriaSelected"
          />
        </div>

        <!-- Statistics and visualizations -->
        <div class="stats-container" v-if="selectedPiscifactoria">
          <div class="stats-header">
            <h2>{{ selectedPiscifactoria.nombre }}</h2>
            <div class="stats-controls">
              <button class="btn btn-sm btn-primary" @click="toggleStatsView">
                <i :class="showChart ? 'fas fa-table' : 'fas fa-chart-line'"></i>
                {{ showChart ? 'Ver tabla' : 'Ver gráfico' }}
              </button>
              <button class="btn btn-sm btn-secondary" @click="exportData">
                <i class="fas fa-download"></i> Exportar
              </button>
            </div>
          </div>

          <!-- Charts or Tables based on view mode -->
          <div class="stats-content">
            <StatsComponent 
              v-if="showChart"
              :piscifactoria="selectedPiscifactoria"
              :variable="selectedVariable"
              :variablesData="filteredVariablesData"
              :dateRange="dateRange"
            />
            <div v-else class="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>{{ selectedVariable.nombre }}</th>
                    <th>Unidad</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(data, index) in filteredVariablesData.slice(0, 10)" :key="index">
                    <td>{{ formatDate(data.fecha_tiempo) }}</td>
                    <td>{{ data.valor.toFixed(2) }}</td>
                    <td>{{ selectedVariable.unidad }}</td>
                  </tr>
                </tbody>
              </table>
              <div class="table-pagination" v-if="filteredVariablesData.length > 10">
                <span>Mostrando 1-10 de {{ filteredVariablesData.length }} resultados</span>
                <button class="btn btn-sm btn-secondary">Ver más</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Alert for no selection -->
        <div class="no-data-message" v-if="!selectedPiscifactoria">
          <div class="alert alert-info">
            <i class="fas fa-info-circle"></i>
            Selecciona una piscifactoría en el mapa o en el panel lateral para ver sus datos
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="app-footer">
      <div>WebGIS GlorIA &copy; 2025</div>
      <div>Versión 1.0.0</div>
    </footer>
  </div>
</template>

<script>
import Sidebar from '../components/Sidebar.vue';
import LeafletMap from '../components/LeafletMap.vue';
import StatsComponent from '../components/StatsComponent.vue';
import DataService from '../services/DataService';
import { ref, reactive, computed, onMounted } from 'vue';

export default {
  name: 'HomeView',
  components: {
    Sidebar,
    LeafletMap,
    StatsComponent
  },
  setup() {
    // State
    const piscifactorias = ref([]);
    const selectedPiscifactoria = ref(null);
    const variables = ref([
      { id: 1, nombre: 'Temperatura', unidad: '°C', color: '#f44336' },
      { id: 2, nombre: 'Oxígeno', unidad: 'mg/L', color: '#2196f3' },
      { id: 3, nombre: 'pH', unidad: '', color: '#4caf50' },
      { id: 4, nombre: 'Salinidad', unidad: 'PSU', color: '#ff9800' },
      { id: 5, nombre: 'Corriente (u)', unidad: 'm/s', color: '#9c27b0' },
      { id: 6, nombre: 'Corriente (v)', unidad: 'm/s', color: '#607d8b' },
    ]);
    const selectedVariable = ref(variables.value[0]);
    const variablesData = ref([]);
    const dateRange = reactive({
      start: new Date(new Date().setMonth(new Date().getMonth() - 1)),
      end: new Date()
    });
    const showChart = ref(true);

    // Computed
    const filteredVariablesData = computed(() => {
      if (!selectedPiscifactoria.value || !selectedVariable.value) {
        return [];
      }
      
      return variablesData.value.filter(data => {
        const dataDate = new Date(data.fecha_tiempo);
        return data.piscifactoria_id === selectedPiscifactoria.value.id &&
               data.variable_nombre === selectedVariable.value.nombre &&
               dataDate >= dateRange.start &&
               dataDate <= dateRange.end;
      });
    });

    // Methods
    const loadPiscifactorias = async () => {
      try {
        const response = await DataService.getPiscifactorias();
        piscifactorias.value = response.data;
      } catch (error) {
        console.error('Error loading piscifactorias:', error);
        // Add sample data for development
        piscifactorias.value = [
          {
            id: 1,
            nombre: 'Centro de Investigación Piscícola de El Palmar',
            descripcion: 'Centro de conservación de especies dulceacuícolas amenazadas',
            tipo: 'continental',
            especies: ['especies amenazadas'],
            ciudad: 'El Palmar',
            provincia: 'Valencia',
            comunidad_autonoma: 'Comunidad Valenciana',
            geometria: [-0.3333, 39.4167]
          },
          {
            id: 2,
            nombre: 'Centro de Cultivo de Peces de Tuéjar',
            descripcion: 'Producción de trucha arcoíris y madrilla del Turia',
            tipo: 'continental',
            especies: ['trucha arcoíris', 'madrilla del Turia'],
            ciudad: 'Tuéjar',
            provincia: 'Valencia',
            comunidad_autonoma: 'Comunidad Valenciana',
            geometria: [-1.0167, 39.8833]
          },
          {
            id: 3,
            nombre: 'Polígono de Acuicultura de San Pedro del Pinatar',
            descripcion: 'Polígono de acuicultura más grande de la Región de Murcia',
            tipo: 'marina',
            especies: ['dorada', 'lubina'],
            ciudad: 'San Pedro del Pinatar',
            provincia: 'Murcia',
            comunidad_autonoma: 'Región de Murcia',
            geometria: [-0.7833, 37.8667]
          },
          {
            id: 4,
            nombre: 'Piscifactorías de Mazarrón',
            descripcion: 'Instalaciones dedicadas al cultivo de dorada y lubina',
            tipo: 'marina',
            especies: ['dorada', 'lubina'],
            ciudad: 'Mazarrón',
            provincia: 'Murcia',
            comunidad_autonoma: 'Región de Murcia',
            geometria: [-1.6000, 37.5667]
          }
        ];
      }
    };

    const loadVariablesData = async () => {
      try {
        const response = await DataService.getVariablesData();
        variablesData.value = response.data;
      } catch (error) {
        console.error('Error loading variables data:', error);
        // Add sample data for development
        const sampleData = [];
        const today = new Date();
        
        // Generate sample data for each piscifactoria and variable
        piscifactorias.value.forEach(piscifactoria => {
          variables.value.forEach(variable => {
            // Create data points for the last 30 days
            for (let i = 0; i < 30; i++) {
              const date = new Date(today);
              date.setDate(date.getDate() - i);
              
              // Generate some random value with realistic variations
              let baseValue;
              switch(variable.nombre) {
                case 'Temperatura': baseValue = 18 + Math.sin(i/5) * 4; break;
                case 'Oxígeno': baseValue = 7 + Math.sin(i/3) * 1.5; break;
                case 'pH': baseValue = 7.8 + Math.sin(i/4) * 0.4; break;
                case 'Salinidad': baseValue = 35 + Math.sin(i/6) * 1; break;
                case 'Corriente (u)': baseValue = 0.3 + Math.sin(i/2) * 0.2; break;
                case 'Corriente (v)': baseValue = 0.2 + Math.sin(i/3) * 0.15; break;
                default: baseValue = 0;
              }
              
              // Add random noise
              const value = baseValue + (Math.random() - 0.5) * 0.5;
              
              sampleData.push({
                id: sampleData.length + 1,
                piscifactoria_id: piscifactoria.id,
                variable_nombre: variable.nombre,
                fecha_tiempo: date.toISOString(),
                valor: value,
                geometria: piscifactoria.geometria
              });
            }
          });
        });
        
        variablesData.value = sampleData;
      }
    };

    const handlePiscifactoriaSelected = (piscifactoria) => {
      selectedPiscifactoria.value = piscifactoria;
    };

    const handleVariableSelected = (variable) => {
      selectedVariable.value = variable;
    };

    const handleDateRangeChanged = (newRange) => {
      dateRange.start = newRange.start;
      dateRange.end = newRange.end;
    };

    const toggleStatsView = () => {
      showChart.value = !showChart.value;
    };

    const exportData = () => {
      if (!filteredVariablesData.value.length) return;

      // Prepare CSV content
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Fecha,Valor,Unidad\n";
      
      filteredVariablesData.value.forEach(data => {
        csvContent += `${formatDate(data.fecha_tiempo)},${data.valor.toFixed(2)},${selectedVariable.value.unidad}\n`;
      });
      
      // Create download link
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${selectedPiscifactoria.value.nombre}_${selectedVariable.value.nombre}_data.csv`);
      document.body.appendChild(link);
      
      // Trigger download
      link.click();
      document.body.removeChild(link);
    };

    const formatDate = (dateString) => {
      const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
      return new Date(dateString).toLocaleDateString('es-ES', options);
    };

    // Lifecycle
    onMounted(() => {
      loadPiscifactorias();
      setTimeout(loadVariablesData, 500); // Load variables data after piscifactorias
    });

    return {
      piscifactorias,
      selectedPiscifactoria,
      variables,
      selectedVariable,
      variablesData,
      filteredVariablesData,
      dateRange,
      showChart,
      handlePiscifactoriaSelected,
      handleVariableSelected,
      handleDateRangeChanged,
      toggleStatsView,
      exportData,
      formatDate
    };
  }
};
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background-color: #f5f7f9;
}

.app-header {
  background-color: #2c3e50;
  color: white;
  padding: 0.5rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 60px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.logo {
  display: flex;
  align-items: center;
}

.logo h1 {
  font-size: 1.5rem;
  margin: 0;
  margin-left: 10px;
}

.logo img {
  height: 40px;
  margin-right: 10px;
}

.header-actions button {
  margin-left: 10px;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.map-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.stats-container {
  height: 300px;
  background-color: white;
  box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  overflow: auto;
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.stats-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.stats-controls button {
  margin-left: 0.5rem;
}

.stats-content {
  height: calc(100% - 40px);
  overflow: auto;
}

.data-table {
  width: 100%;
}

.data-table table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th, .data-table td {
  padding: 0.5rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.data-table th {
  background-color: #f5f7f9;
  font-weight: 600;
}

.table-pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
}

.no-data-message {
  padding: 2rem;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.alert {
  padding: 1rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.alert i {
  margin-right: 0.5rem;
}

.alert-info {
  background-color: #e3f2fd;
  color: #0d47a1;
}

.app-footer {
  background-color: #2c3e50;
  color: white;
  padding: 0.5rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 40px;
  font-size: 0.85rem;
}

/* Utility classes for buttons */
.btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  font-weight: 500;
}

.btn i {
  margin-right: 0.5rem;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.85rem;
}

.btn-primary {
  background-color: #1976d2;
  color: white;
}

.btn-primary:hover {
  background-color: #1565c0;
}

.btn-secondary {
  background-color: #78909c;
  color: white;
}

.btn-secondary:hover {
  background-color: #607d8b;
}

.btn-info {
  background-color: #26a69a;
  color: white;
}

.btn-info:hover {
  background-color: #00897b;
}
</style>