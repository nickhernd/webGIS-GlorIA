<!-- frontend/src/views/Home.vue -->
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
      <div class="top-bar">
        <div class="breadcrumbs">
          <span>Inicio</span> / 
          <span v-if="selectedFarmId">{{ getSelectedFarmName() }}</span>
          <span v-else>Vista general</span>
        </div>
        <div class="user-controls">
          <button class="settings-btn" @click="showSettings">⚙️</button>
          <div class="user-info">
            <span class="user-name">Usuario</span>
            <span class="user-avatar">👤</span>
          </div>
        </div>
      </div>
      
      <div class="content-container">
        <div class="map-wrapper">
          <LeafletMap 
            ref="mapComponent"
            :selectedDate="selectedDate"
            :selectedVariable="selectedVariable"
            @farm-selected="selectFarm"
            :fishFarms="farms"
          />
        </div>
        
        <div class="stats-wrapper">
          <StatsComponent 
            :selectedFarmId="selectedFarmId"
            :fishFarms="farms" 
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
    
    <div class="modal" v-if="showSettingsModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Configuración</h2>
          <button class="close-btn" @click="showSettingsModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="settings-section">
            <h3>Visualización del mapa</h3>
            <div class="settings-option">
              <label>
                <input type="checkbox" v-model="settings.showLabels" @change="applySettings">
                Mostrar etiquetas en el mapa
              </label>
            </div>
            <div class="settings-option">
              <label>
                <input type="checkbox" v-model="settings.showGrid" @change="applySettings">
                Mostrar cuadrícula de referencia
              </label>
            </div>
            <div class="settings-option">
              <label>Base de mapa:</label>
              <select v-model="settings.mapBase" @change="applySettings">
                <option value="osm">OpenStreetMap</option>
                <option value="satellite">Satélite</option>
                <option value="terrain">Terreno</option>
              </select>
            </div>
          </div>
          
          <div class="settings-section">
            <h3>Alertas</h3>
            <div class="settings-option">
              <label>
                <input type="checkbox" v-model="settings.notificationsEnabled" @change="applySettings">
                Activar notificaciones de alertas
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn secondary" @click="showSettingsModal = false">Cancelar</button>
          <button class="btn primary" @click="saveSettings">Guardar</button>
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
    const showSettingsModal = ref(false);
    
    // Toast para notificaciones
    const showToast = ref(false);
    const toastMessage = ref('');
    
    // Configuraciones
    const settings = ref({
      showLabels: true,
      showGrid: false,
      mapBase: 'osm',
      notificationsEnabled: true
    });
    
    // Fecha seleccionada como objeto Date
    const selectedDate = computed(() => {
      return new Date(selectedDateString.value);
    });
    
    // Lista de piscifactorías
    const farms = ref([
      {
        id: 1,
        name: "Centro de Investigación Piscícola de El Palmar",
        location: "El Palmar, Valencia",
        coordinates: [39.4167, -0.3333],
        type: "Investigación",
        species: ["especies dulceacuícolas amenazadas"],
        description: "Gestionado por VAERSA, enfocado en conservación mediante programas de producción y cría en cautividad."
      },
      {
        id: 2,
        name: "Centro de Cultivo de Peces de Tuéjar",
        location: "Tuéjar, Valencia",
        coordinates: [39.8833, -1.0167],
        type: "Producción",
        species: ["trucha arcoíris", "madrilla del Turia"],
        description: "Especializado en trucha arcoíris y madrilla del Turia, con planes para otras especies."
      },
      {
        id: 3,
        name: "Centro de Cultivo de Peces de Aguas Templadas",
        location: "Polinyà del Xúquer, Valencia",
        coordinates: [39.1833, -0.4167],
        type: "Reproducción y Engorde",
        species: ["anguila", "fartet"],
        description: "Dedicado a reproducción y engorde de diversas especies, incluyendo anguila y fartet."
      },
      {
        id: 4,
        name: "Polígono de Acuicultura de San Pedro del Pinatar",
        location: "San Pedro del Pinatar, Murcia",
        coordinates: [37.8667, -0.7833],
        type: "Producción Comercial",
        species: ["dorada", "lubina"],
        description: "El polígono de acuicultura más grande de la Región de Murcia."
      },
      {
        id: 5,
        name: "Piscifactorías de Mazarrón",
        location: "Mazarrón, Murcia",
        coordinates: [37.5667, -1.6000],
        type: "Producción Comercial",
        species: ["dorada", "lubina"],
        description: "Instalaciones dedicadas al cultivo de dorada y lubina."
      }
    ]);
    
    // Conteo de alertas simulado
    const alertCounts = ref({
      high: 1,
      medium: 2,
      low: 3
    });
    
    // Métodos
    const updateMapLayer = () => {
      console.log('Actualizando mapa con variable:', selectedVariable.value, 'y fecha:', selectedDate.value);
      // Actualizar capa del mapa según la variable y fecha seleccionadas
      if (mapComponent.value) {
        // Aquí se llamaría al método correspondiente del componente mapa
      }
    };
    
    const selectFarm = (farmId) => {
      console.log('Piscifactoría seleccionada:', farmId);
      selectedFarmId.value = farmId;
      
      // Mostrar toast de confirmación
      showToastMessage(`Piscifactoría seleccionada: ${getSelectedFarmName()}`);
    };
    
    const getSelectedFarmName = () => {
      if (!selectedFarmId.value) return '';
      const farm = farms.value.find(f => f.id === selectedFarmId.value);
      return farm ? farm.name : '';
    };
    
    const updateSelectedVariable = (variable) => {
      selectedVariable.value = variable;
      updateMapLayer();
    };
    
    // Métodos para modales
    const showHelp = () => {
      showHelpModal.value = true;
    };
    
    const showSettings = () => {
      showSettingsModal.value = true;
    };
    
    const applySettings = () => {
      // Aplicar configuraciones al mapa
      if (mapComponent.value) {
        // Aquí se aplicarían las configuraciones al mapa
      }
    };
    
    const saveSettings = () => {
      applySettings();
      showSettingsModal.value = false;
      showToastMessage('Configuración guardada');
      
      // En una aplicación real, aquí se guardarían las configuraciones en localStorage o backend
      localStorage.setItem('gloria-settings', JSON.stringify(settings.value));
    };
    
    // Funcionalidad para exportar datos
    const exportData = () => {
      showToastMessage('Exportando datos...');
      
      // Simular proceso de exportación
      setTimeout(() => {
        showToastMessage('Datos exportados correctamente');
      }, 1500);
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
    
    // Cargar configuraciones guardadas
    const loadSavedSettings = () => {
      const savedSettings = localStorage.getItem('gloria-settings');
      if (savedSettings) {
        settings.value = JSON.parse(savedSettings);
      }
    };
    
    // Ciclo de vida
    onMounted(() => {
      // Cargar configuraciones
      loadSavedSettings();
      
      // Inicialización al cargar
      updateMapLayer();
      
      // Simular carga de datos
      showToastMessage('Datos cargados correctamente');
    });
    
    // Observar cambios en el ID de la piscifactoría seleccionada
    watch(selectedFarmId, (newId) => {
      if (newId && mapComponent.value) {
        // Centrar mapa en la piscifactoría seleccionada
        const farm = farms.value.find(f => f.id === newId);
        if (farm) {
          // Aquí se centraría el mapa en las coordenadas de la piscifactoría
        }
      }
    });
    
    return {
      selectedVariable,
      selectedDateString,
      selectedDate,
      selectedFarmId,
      farms,
      alertCounts,
      settings,
      showHelpModal,
      showSettingsModal,
      showToast,
      toastMessage,
      mapComponent,
      updateMapLayer,
      selectFarm,
      getSelectedFarmName,
      updateSelectedVariable,
      showHelp,
      showSettings,
      applySettings,
      saveSettings,
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

.top-bar {
  height: 60px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  background-color: white;
  border-bottom: 1px solid #e1e4e8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.breadcrumbs {
  font-size: 0.9rem;
  color: #6c757d;
}

.user-controls {
  display: flex;
  align-items: center;
  gap: 15px;
}

.settings-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
}

.user-avatar {
  font-size: 1.2rem;
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

/* Configuraciones */
.settings-section {
  margin-bottom: 20px;
}

.settings-section h3 {
  font-size: 1rem;
  margin-bottom: 10px;
  color: #2c3e50;
  padding-bottom: 5px;
  border-bottom: 1px solid #f1f1f1;
}

.settings-option {
  margin-bottom: 10px;
}

.settings-option label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: #5a6268;
}

.settings-option select {
  width: 100%;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #ced4da;
  font-size: 0.9rem;
  margin-top: 5px;
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