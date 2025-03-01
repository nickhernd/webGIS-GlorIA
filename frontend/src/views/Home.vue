<!-- src/views/Home.vue -->
<template>
  <div class="home-container">
    <div class="sidebar">
      <div class="sidebar-header">
        <div class="logo-placeholder">GIS</div>
        <h1>WebGIS GlorIA</h1>
      </div>
      <div class="sidebar-content">
        <div class="section">
          <h2>Filtros</h2>
          <div class="filter-group">
            <label for="variable-select">Variable Ambiental:</label>
            <select id="variable-select" v-model="selectedVariable" @change="updateMapLayer">
              <option value="temperature">Temperatura</option>
              <option value="currents">Corrientes</option>
              <option value="salinity">Salinidad</option>
              <option value="oxygen">Oxígeno Disuelto</option>
              <option value="nutrientes">Nutrientes</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>Fecha:</label>
            <div class="date-picker">
              <input type="date" v-model="selectedDateString" @change="updateMapLayer" />
            </div>
          </div>
        </div>
        
        <div class="section">
          <h2>Piscifactorías</h2>
          <div class="farms-list">
            <div 
              v-for="farm in farms" 
              :key="farm.id" 
              class="farm-item"
              :class="{ 'selected': selectedFarmId === farm.id }"
              @click="selectFarm(farm.id)"
            >
              <div class="farm-icon">
                <span class="icon">🔸</span>
              </div>
              <div class="farm-details">
                <div class="farm-name">{{ farm.name }}</div>
                <div class="farm-location">{{ farm.location }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="section">
          <h2>Alertas</h2>
          <div class="alerts-summary">
            <div class="alert-count high">
              <span class="count">{{ alertCounts.high }}</span>
              <span class="label">Alta</span>
            </div>
            <div class="alert-count medium">
              <span class="count">{{ alertCounts.medium }}</span>
              <span class="label">Media</span>
            </div>
            <div class="alert-count low">
              <span class="count">{{ alertCounts.low }}</span>
              <span class="label">Baja</span>
            </div>
          </div>
        </div>
        
        <div class="section">
          <h2>Leyenda</h2>
          <div class="legend">
            <div class="legend-item">
              <span class="color-box" style="background-color: red;"></span>
              <span class="legend-label">Alto riesgo</span>
            </div>
            <div class="legend-item">
              <span class="color-box" style="background-color: orange;"></span>
              <span class="legend-label">Riesgo medio</span>
            </div>
            <div class="legend-item">
              <span class="color-box" style="background-color: green;"></span>
              <span class="legend-label">Bajo riesgo</span>
            </div>
            <div class="legend-item">
              <span class="marker-box"></span>
              <span class="legend-label">Piscifactoría</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="sidebar-footer">
        <button class="export-btn" @click="exportData">
          <span class="icon">📊</span> Exportar datos
        </button>
        <button class="help-btn" @click="showHelp">
          <span class="icon">❓</span> Ayuda
        </button>
      </div>
    </div>
    
    <div class="main-content">
      <div class="content-container">
        <div class="map-wrapper">
          <LeafletMap 
            ref="mapComponent"
            :selectedDate="selectedDate"
            :selectedVariable="selectedVariable"
            @farm-selected="selectFarm"
          />
        </div>
        
        <div class="stats-wrapper" v-if="selectedFarm">
          <StatsComponent 
            :selectedFarmId="selectedFarmId"
            :selectedFarm="selectedFarm" 
            :date="selectedDate"
            @variable-changed="updateSelectedVariable"
          />
        </div>
      </div>
    </div>
    
    <!-- Modales -->
    <div class="modal" v-if="showHelpModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Ayuda - WebGIS GlorIA</h2>
          <button class="close-btn" @click="showHelpModal = false">×</button>
        </div>
        <div class="modal-body">
          <h3>Guía de uso rápido</h3>
          <p>WebGIS GlorIA es un sistema para la monitorización y predicción de riesgos en piscifactorías de la Comunidad Valenciana y Región de Murcia.</p>
          
          <h4>Funcionalidades principales:</h4>
          <ul>
            <li><strong>Visualización de mapa:</strong> Muestra las ubicaciones de piscifactorías y datos ambientales.</li>
            <li><strong>Filtros:</strong> Selecciona diferentes variables ambientales y fechas para visualizar los datos.</li>
            <li><strong>Estadísticas:</strong> Panel detallado con información sobre cada piscifactoría.</li>
            <li><strong>Alertas:</strong> Sistema de notificación para situaciones de riesgo.</li>
          </ul>
          
          <h4>Para comenzar:</h4>
          <ol>
            <li>Selecciona una variable ambiental y fecha en los filtros.</li>
            <li>Haz clic en una piscifactoría en el mapa o en la lista para ver sus detalles.</li>
            <li>Explora los diferentes paneles de estadísticas para analizar los datos.</li>
          </ol>
        </div>
        <div class="modal-footer">
          <button class="btn primary" @click="showHelpModal = false">Entendido</button>
        </div>
      </div>
    </div>
    
    <div class="toast" v-if="showToast">
      {{ toastMessage }}
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import LeafletMap from '../components/LeafletMap.vue';
import StatsComponent from '../components/StatsComponent.vue';
import DataService from '../services/DataService';

export default {
  name: 'HomeView',
  components: {
    LeafletMap,
    StatsComponent
  },
  setup() {
    // Variables de estado
    const selectedVariable = ref('temperature');
    const selectedDateString = ref(new Date().toISOString().substr(0, 10));
    const selectedFarmId = ref(null);
    const mapComponent = ref(null);
    
    // Estado para modales
    const showHelpModal = ref(false);
    
    // Toast para notificaciones
    const showToast = ref(false);
    const toastMessage = ref('');
    
    // Fecha seleccionada como objeto Date
    const selectedDate = computed(() => {
      return new Date(selectedDateString.value);
    });
    
    // Lista de piscifactorías
    const farms = ref([]);
    
    // Conteo de alertas
    const alertCounts = ref({
      high: 0,
      medium: 0,
      low: 0
    });
    
    // Piscifactoría seleccionada
    const selectedFarm = computed(() => {
      if (!selectedFarmId.value) return null;
      return farms.value.find(farm => farm.id === selectedFarmId.value);
    });
    
    // Métodos
    // Cargar datos de piscifactorías
    const loadFarms = async () => {
      try {
        showToastMessage('Cargando datos de piscifactorías...');
        const response = await DataService.getPiscifactorias();
        farms.value = response.data;
        showToastMessage('Datos cargados correctamente');
      } catch (error) {
        console.error('Error al cargar piscifactorías:', error);
        showToastMessage('Error al cargar datos de piscifactorías');
      }
    };

    // Cargar alertas
    const loadAlerts = async () => {
      try {
        const response = await DataService.getAlertas();
        
        // Actualizar conteo de alertas según nivel
        const counts = { high: 0, medium: 0, low: 0 };
        response.data.forEach(alert => {
          if (alert.level === 'alta') counts.high++;
          else if (alert.level === 'media') counts.medium++;
          else counts.low++;
        });
        
        alertCounts.value = counts;
      } catch (error) {
        console.error('Error al cargar alertas:', error);
      }
    };

    // Actualizar datos ambientales en el mapa
    const updateMapLayer = async () => {
      try {
        const params = {
          fecha: selectedDateString.value,
          variable: selectedVariable.value
        };
        
        await DataService.getDatosAmbientales(params);
        
        // Aquí se actualizaría la capa del mapa con los datos recibidos
        if (mapComponent.value) {
          // En esta versión estática simplemente actualizamos la vista
          showToastMessage(`Datos de ${getVariableName(selectedVariable.value)} actualizados`);
        }
      } catch (error) {
        console.error('Error al cargar datos ambientales:', error);
        showToastMessage('Error al cargar datos ambientales');
      }
    };

    // Seleccionar una piscifactoría
    const selectFarm = async (farmId) => {
      selectedFarmId.value = farmId;
      
      try {
        if (farmId) {
          // Cargar datos detallados de la piscifactoría
          const response = await DataService.getPiscifactoria(farmId);
          
          // Mostrar toast de confirmación
          showToastMessage(`Piscifactoría seleccionada: ${response.data.name}`);
        }
      } catch (error) {
        console.error('Error al cargar detalles de piscifactoría:', error);
      }
    };
    
    const updateSelectedVariable = (variable) => {
      selectedVariable.value = variable;
      updateMapLayer();
    };
    
    // Mostrar modal de ayuda
    const showHelp = () => {
      showHelpModal.value = true;
    };
    
    // Funcionalidad para exportar datos
    const exportData = async () => {
      showToastMessage('Exportando datos...');
      
      try {
        const params = {
          fecha: selectedDateString.value,
          variable: selectedVariable.value,
          piscifactoriaId: selectedFarmId.value || null
        };
        
        const response = await DataService.exportarDatos(params);
        showToastMessage('Datos exportados correctamente');
      } catch (error) {
        console.error('Error al exportar datos:', error);
        showToastMessage('Error al exportar datos');
      }
    };
    
    // Toast
    const showToastMessage = (message) => {
      toastMessage.value = message;
      showToast.value = true;
      
      // Ocultar toast después de 3 segundos
      setTimeout(() => {
        showToast.value = false;
      }, 3000);
    };
    
    // Función auxiliar para obtener nombre legible de variables
    const getVariableName = (variableKey) => {
      const names = {
        'temperature': 'Temperatura',
        'oxygen': 'Oxígeno disuelto',
        'salinity': 'Salinidad',
        'currents': 'Corrientes',
        'nutrientes': 'Nutrientes'
      };
      return names[variableKey] || variableKey;
    };
    
    // Ciclo de vida
    onMounted(() => {
      // Cargar datos iniciales
      loadFarms();
      loadAlerts();
      updateMapLayer();
    });
    
    // Observar cambios en el ID de la piscifactoría seleccionada
    watch(selectedFarmId, (newId) => {
      if (newId && mapComponent.value) {
        // Aquí se podría centrar el mapa en la piscifactoría seleccionada
      }
    });
    
    return {
      selectedVariable,
      selectedDateString,
      selectedDate,
      selectedFarmId,
      selectedFarm,
      farms,
      alertCounts,
      showHelpModal,
      showToast,
      toastMessage,
      mapComponent,
      updateMapLayer,
      selectFarm,
      updateSelectedVariable,
      showHelp,
      exportData
    };
  }
};
</script>

<style scoped>
.home-container {
  display: flex;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  background-color: #f5f7fa;
  position: relative;
}

/* Sidebar */
.sidebar {
  width: 300px;
  background-color: #2c3e50;
  color: white;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.sidebar-header {
  padding: 20px 15px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background-color: #1f2d3d;
}

.logo-placeholder {
  width: 40px;
  height: 40px;
  margin-right: 10px;
  background-color: #3498db;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 16px;
}

.sidebar-header h1 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 500;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
}

.section {
  margin-bottom: 25px;
}

.section h2 {
  font-size: 0.9rem;
  text-transform: uppercase;
  margin-bottom: 15px;
  color: #95a5a6;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.filter-group {
  margin-bottom: 15px;
}

.filter-group label {
  display: block;
  margin-bottom: 5px;
  font-size: 0.85rem;
}

.filter-group select,
.filter-group input {
  width: 100%;
  padding: 8px 10px;
  border-radius: 4px;
  border: none;
  background-color: #34495e;
  color: white;
  font-size: 0.9rem;
}

.farms-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
}

.farm-item {
  display: flex;
  align-items: center;
  padding: 10px;
  border-radius: 4px;
  background-color: #34495e;
  cursor: pointer;
  transition: background-color 0.2s;
}

.farm-item:hover {
  background-color: #3a536b;
}

.farm-item.selected {
  background-color: #3498db;
}

.farm-icon {
  margin-right: 10px;
  font-size: 1.2rem;
}

.farm-details {
  flex: 1;
}

.farm-name {
  font-weight: 500;
  margin-bottom: 3px;
}

.farm-location {
  font-size: 0.8rem;
  color: #bdc3c7;
}

.alerts-summary {
  display: flex;
  gap: 10px;
}

.alert-count {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  border-radius: 4px;
  background-color: #34495e;
}

.alert-count.high {
  background-color: rgba(231, 76, 60, 0.3);
}

.alert-count.medium {
  background-color: rgba(243, 156, 18, 0.3);
}

.alert-count.low {
  background-color: rgba(52, 152, 219, 0.3);
}

.alert-count .count {
  font-size: 1.5rem;
  font-weight: bold;
}

.alert-count .label {
  font-size: 0.8rem;
  margin-top: 5px;
}

.legend {
  background-color: #34495e;
  padding: 10px;
  border-radius: 4px;
}

.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.legend-item:last-child {
  margin-bottom: 0;
}

.color-box {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  margin-right: 10px;
}

.marker-box {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: #3498db;
  border: 2px solid white;
  margin-right: 10px;
}

.legend-label {
  font-size: 0.85rem;
}

.sidebar-footer {
  padding: 15px;
  display: flex;
  gap: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.export-btn, .help-btn {
  flex: 1;
  padding: 8px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.help-btn {
  background-color: #34495e;
}

.export-btn:hover {
  background-color: #2980b9;
}

.help-btn:hover {
  background-color: #2c3e50;
}

.icon {
  margin-right: 5px;
}

/* Main Content */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.content-container {
  flex: 1;
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-rows: 1fr;
  overflow: hidden;
}

.map-wrapper, .stats-wrapper {
  overflow: hidden;
}

.map-wrapper {
  border-right: 1px solid #e1e4e8;
}

/* Modales */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.3s;
}

.modal-content {
  background-color: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.modal-header {
  padding: 15px 20px;
  border-bottom: 1px solid #e1e4e8;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.2rem;
  color: #2c3e50;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
}

.modal-body {
  padding: 20px;
}

.modal-body h3 {
  margin-top: 0;
  color: #2c3e50;
  font-size: 1.1rem;
}

.modal-body h4 {
  color: #3498db;
  font-size: 1rem;
}

.modal-body p, .modal-body li {
  font-size: 0.9rem;
  color: #5a6268;
  line-height: 1.5;
}

.modal-body ul, .modal-body ol {
  padding-left: 20px;
}

.modal-footer {
  padding: 15px 20px;
  border-top: 1px solid #e1e4e8;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn {
  padding: 8px 15px;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  border: none;
}

.btn.primary {
  background-color: #3498db;
  color: white;
}

.btn.secondary {
  background-color: #f1f1f1;
  color: #333;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #333;
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 0.9rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  animation: slideIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* Responsive adjustments */
@media (max-width: 1200px) {
  .content-container {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }
  
  .map-wrapper {
    border-right: none;
    border-bottom: 1px solid #e1e4e8;
  }
}

@media (max-width: 768px) {
  .home-container {
    flex-direction: column;
  }
  
  .sidebar {
    width: 100%;
    height: auto;
    max-height: 40vh;
  }
  
  .sidebar-content {
    padding: 10px;
  }
  
  .section {
    margin-bottom: 15px;
  }
  
  .section h2 {
    margin-bottom: 10px;
  }
  
  .farms-list {
    max-height: 200px;
  }
}
</style>