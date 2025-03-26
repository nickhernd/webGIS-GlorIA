<template>
  <div class="home-container">
    <!-- Panel izquierdo: Sidebar/Filtros -->
    <div class="sidebar" :class="{ 'collapsed': isSidebarCollapsed }">
      <div class="sidebar-header">
        <div class="logo">
          <span class="logo-icon">GIS</span>
          <h1 v-if="!isSidebarCollapsed">WebGIS GlorIA</h1>
        </div>
        <button class="sidebar-toggle" @click="toggleSidebar">
          <span v-if="isSidebarCollapsed">≫</span>
          <span v-else>≪</span>
        </button>
      </div>
      
      <div class="sidebar-content" v-if="!isSidebarCollapsed">
        <!-- Piscifactorías filter -->
        <div class="sidebar-section">
          <h2>Piscifactorías</h2>
          <div class="search-box">
            <input 
              type="text" 
              placeholder="Buscar piscifactoría..." 
              v-model="searchTerm"
              @input="filterFarms"
            />
            <span class="search-icon">🔍</span>
          </div>
          
          <div class="farms-list-wrapper">
            <div v-if="isLoading" class="loading-indicator">
              <div class="spinner"></div>
              <span>Cargando...</span>
            </div>
            <div v-else-if="filteredFarms.length === 0" class="no-data">
              No se encontraron piscifactorías.
            </div>
            <div v-else class="farms-list">
              <div 
                v-for="farm in filteredFarms" 
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
        </div>
        
        <!-- Environmental variables filter -->
        <div class="sidebar-section">
          <h2>Variables Ambientales</h2>
          <div class="filter-group">
            <select id="variable-select" v-model="selectedVariable" @change="updateMapLayer">
              <option value="temperature">Temperatura</option>
              <option value="oxygen">Oxígeno Disuelto</option>
              <option value="currents">Corrientes</option>
              <option value="salinity">Salinidad</option>
              <option value="chlorophyll">Clorofila</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>Fecha:</label>
            <input 
              type="date" 
              v-model="selectedDateString" 
              @change="updateMapLayer" 
              :max="today"
            />
          </div>
        </div>
        
        <!-- Alerts summary -->
        <div class="sidebar-section">
          <h2>Alertas</h2>
          <div class="alerts-summary">
            <div class="alert-card high">
              <div class="alert-count">{{ alertCounts.high }}</div>
              <div class="alert-label">Alta</div>
            </div>
            <div class="alert-card medium">
              <div class="alert-count">{{ alertCounts.medium }}</div>
              <div class="alert-label">Media</div>
            </div>
            <div class="alert-card low">
              <div class="alert-count">{{ alertCounts.low }}</div>
              <div class="alert-label">Baja</div>
            </div>
          </div>
        </div>
        
        <!-- Legend -->
        <div class="sidebar-section">
          <h2>Leyenda</h2>
          <div class="legend">
            <div class="legend-item">
              <div class="color-box" :style="{ backgroundColor: getColorForVariable('high') }"></div>
              <span>Valor alto</span>
            </div>
            <div class="legend-item">
              <div class="color-box" :style="{ backgroundColor: getColorForVariable('medium') }"></div>
              <span>Valor medio</span>
            </div>
            <div class="legend-item">
              <div class="color-box" :style="{ backgroundColor: getColorForVariable('low') }"></div>
              <span>Valor bajo</span>
            </div>
            <div class="legend-item">
              <div class="marker-box"></div>
              <span>Piscifactoría</span>
            </div>
          </div>
        </div>
        
        <!-- Actions -->
        <div class="sidebar-footer">
          <button class="action-btn primary" @click="exportData" :disabled="isExporting">
            <span class="icon">{{ isExporting ? '⏳' : '📊' }}</span> 
            {{ isExporting ? 'Exportando...' : 'Exportar datos' }}
          </button>
          <button class="action-btn secondary" @click="showHelp">
            <span class="icon">❓</span> Ayuda
          </button>
        </div>
      </div>
    </div>
    
    <!-- Panel central: Mapa -->
    <div class="main-content">
      <LeafletMap 
        ref="mapComponent"
        :selectedDate="selectedDate"
        :selectedVariable="selectedVariable"
        :selectedFarmId="selectedFarmId"
        @farm-selected="selectFarm"
      />
    </div>
    
    <!-- Panel derecho: Estadísticas -->
    <div class="stats-panel" :class="{ 'hidden': !selectedFarm || !showStatsPanel }">
      <div class="stats-header">
        <h2>{{ selectedFarm ? selectedFarm.name : 'Estadísticas' }}</h2>
        <div class="stats-actions">
          <button class="toggle-button" @click="toggleStatsPanel">
            {{ showStatsPanel ? '►' : '◄' }}
          </button>
        </div>
      </div>
      
      <div class="stats-content">
        <!-- Selector de pestaña de estadísticas -->
        <div class="stats-tabs">
          <div 
            v-for="tab in statsTabs" 
            :key="tab.id"
            class="stats-tab"
            :class="{ 'active': activeStatsTab === tab.id }"
            @click="activeStatsTab = tab.id"
          >
            {{ tab.name }}
          </div>
        </div>
        
        <!-- Mostrar componente según la pestaña seleccionada -->
        <div v-if="activeStatsTab === 'general' && selectedFarm">
          <StatsComponent 
            :selectedFarmId="selectedFarmId"
            :selectedFarm="selectedFarm" 
            @variable-changed="updateSelectedVariable"
            @error="showError"
            @refresh-farm-data="loadFarmData"
          />
        </div>
        
        <div v-if="activeStatsTab === 'corrientes' && selectedFarm">
          <CurrentsMonitorComponent 
            :selectedFarm="selectedFarm"
            :initialFarmId="selectedFarmId"
            @error="showError"
            @risk-level-changed="handleRiskLevelChanged"
          />
        </div>
        
        <div v-if="!selectedFarm" class="no-selection-message">
          <div class="message-icon">🔍</div>
          <h3>Ninguna piscifactoría seleccionada</h3>
          <p>Seleccione una piscifactoría para ver sus estadísticas.</p>
        </div>
      </div>
    </div>
    
    <!-- Help modal -->
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
            <li><strong>Estadísticas:</strong> Panel lateral con información detallada sobre cada piscifactoría.</li>
            <li><strong>Alertas:</strong> Sistema de notificación para situaciones de riesgo.</li>
          </ul>
          
          <h4>Para comenzar:</h4>
          <ol>
            <li>Selecciona una variable ambiental y fecha en los filtros del panel izquierdo.</li>
            <li>Haz clic en una piscifactoría en el mapa o en la lista para ver sus detalles en el panel derecho.</li>
            <li>Explora las estadísticas y alertas para analizar la situación actual.</li>
          </ol>
        </div>
        <div class="modal-footer">
          <button class="btn primary" @click="showHelpModal = false">Entendido</button>
        </div>
      </div>
    </div>
    
    <!-- Toast notifications -->
    <div class="toast" v-if="toast.show">
      <div class="toast-content" :class="toast.type">
        <span class="toast-icon">{{ getToastIcon(toast.type) }}</span>
        <span class="toast-message">{{ toast.message }}</span>
        <button class="toast-close" @click="hideToast">×</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import LeafletMap from '../components/LeafletMap.vue';
import StatsComponent from '../components/StatsComponent.vue';
import DataService from '../services/DataService';
import CurrentsMonitorComponent from '../components/CurrentsMonitorComponent.vue';

export default {
  name: 'HomeView',
  components: {
    LeafletMap,
    StatsComponent,
    CurrentsMonitorComponent
  },
  setup() {
    // State variables
    const isSidebarCollapsed = ref(false);
    const showStatsPanel = ref(true);
    const selectedVariable = ref('temperature');
    const selectedDateString = ref(new Date().toISOString().substr(0, 10));
    const selectedFarmId = ref(null);
    const searchTerm = ref('');
    const farms = ref([]);
    const filteredFarms = ref([]);
    const selectedFarm = ref(null);
    const alerts = ref([]);
    const isLoading = ref(false);
    const isExporting = ref(false);
    const showHelpModal = ref(false);
    const mapComponent = ref(null);

    const handleRiskLevelChanged = (riskInfo) => {
      console.log('Nivel de riesgo cambiado:', riskInfo);
        if (riskInfo.level === 'Alto') {
          showToast(`Alerta: Riesgo alto de corrientes (${riskInfo.index.toFixed(1)}/10)`, 'warning');
        }
    };
    
    // Toast notification
    const toast = ref({
      show: false,
      message: '',
      type: 'info', // 'info', 'success', 'warning', 'error'
      timeout: null
    });
    
    // Alert counts
    const alertCounts = ref({
      high: 0,
      medium: 0,
      low: 0
    });
    
    // Get today's date string for max date input
    const today = new Date().toISOString().split('T')[0];
    
    // Computed
    const selectedDate = computed(() => {
      return new Date(selectedDateString.value);
    });
    
    // Toggle sidebar collapsed state
    const toggleSidebar = () => {
      isSidebarCollapsed.value = !isSidebarCollapsed.value;
    };
    
    // Toggle stats panel visibility
    const toggleStatsPanel = () => {
      showStatsPanel.value = !showStatsPanel.value;
    };
    
    // Filter farms based on search term
    const filterFarms = () => {
      if (!searchTerm.value) {
        filteredFarms.value = farms.value;
        return;
      }
      
      const term = searchTerm.value.toLowerCase();
      filteredFarms.value = farms.value.filter(farm => 
        farm.name.toLowerCase().includes(term) || 
        farm.location.toLowerCase().includes(term)
      );
    };
    
    // Select a farm
    const selectFarm = async (farmId) => {
      if (selectedFarmId.value === farmId) return;
      
      selectedFarmId.value = farmId;
      
      // Load farm details
      await loadFarmData(farmId);
      
      // If map component exists, highlight the farm
      if (mapComponent.value) {
        mapComponent.value.highlightFishFarm && mapComponent.value.highlightFishFarm(farmId);
      }
      
      // Show stats panel if it's hidden
      if (!showStatsPanel.value) {
        showStatsPanel.value = true;
      }
      
      showToast(`Piscifactoría seleccionada: ${selectedFarm.value?.name}`, 'success');
    };
    
    // Update map layer
    const updateMapLayer = () => {
      if (mapComponent.value) {
        mapComponent.value.updateLayer && mapComponent.value.updateLayer();
        showToast(`Datos de ${getVariableName(selectedVariable.value)} actualizados`, 'info');
      }
    };
    
    // Update selected variable
    const updateSelectedVariable = (variable) => {
      selectedVariable.value = variable;
      updateMapLayer();
    };
    
    // Load all farms
    const loadFarms = async () => {
      isLoading.value = true;
      
      try {
        const response = await DataService.getPiscifactorias();
        
        if (response.data && response.data.length > 0) {
          farms.value = response.data;
          filterFarms();
          showToast('Datos de piscifactorías cargados correctamente', 'success');
        } else {
          throw new Error('No se encontraron piscifactorías');
        }
      } catch (error) {
        console.error('Error al cargar piscifactorías:', error);
        showToast('Error al cargar datos de piscifactorías', 'error');
      } finally {
        isLoading.value = false;
      }
    };
    
    // Load specific farm data
    const loadFarmData = async (farmId) => {
      try {
        const response = await DataService.getPiscifactoria(farmId);
        
        if (response.data) {
          selectedFarm.value = response.data;
        } else {
          throw new Error('No se encontraron datos para la piscifactoría seleccionada');
        }
      } catch (error) {
        console.error('Error al cargar datos de piscifactoría:', error);
        showToast('Error al cargar detalles de la piscifactoría', 'error');
      }
    };
    
    // Load alerts
    const loadAlerts = async () => {
      try {
        const response = await DataService.getAlertas();
        
        if (response.data) {
          alerts.value = response.data;
          
          // Calculate alert counts
          alertCounts.value = {
            high: alerts.value.filter(a => a.nivel === 'alta').length,
            medium: alerts.value.filter(a => a.nivel === 'media').length,
            low: alerts.value.filter(a => a.nivel === 'baja').length
          };
        } else {
          alerts.value = [];
          resetAlertCounts();
        }
      } catch (error) {
        console.error('Error al cargar alertas:', error);
        showToast('Error al cargar datos de alertas', 'error');
        alerts.value = [];
        resetAlertCounts();
      }
    };
    
    // Reset alert counts
    const resetAlertCounts = () => {
      alertCounts.value = { high: 0, medium: 0, low: 0 };
    };
    
    // Export data
    const exportData = async () => {
      if (isExporting.value) return;
      
      isExporting.value = true;
      showToast('Exportando datos...', 'info');
      
      try {
        const params = {
          fecha: selectedDateString.value,
          variable: selectedVariable.value,
          piscifactoriaId: selectedFarmId.value || null
        };
        
        const response = await DataService.exportarDatos(params);
        
        if (response.data && response.data.success) {
          showToast('Datos exportados correctamente', 'success');
          
          if (response.data.downloadUrl) {
            const a = document.createElement('a');
            a.href = response.data.downloadUrl;
            a.download = `datos_${selectedVariable.value}_${selectedDateString.value}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        } else {
          throw new Error('No se pudieron exportar los datos');
        }
      } catch (error) {
        console.error('Error al exportar datos:', error);
        showToast('Error al exportar datos', 'error');
      } finally {
        isExporting.value = false;
      }
    };
    
    // Show help modal
    const showHelp = () => {
      showHelpModal.value = true;
    };
    
    // Show toast notification
    const showToast = (message, type = 'info') => {
      // Clear any existing timeout
      if (toast.value.timeout) {
        clearTimeout(toast.value.timeout);
      }
      
      // Set new toast
      toast.value = {
        show: true,
        message: message,
        type: type,
        timeout: setTimeout(() => {
          hideToast();
        }, 5000) // Auto-hide after 5 seconds
      };
    };
    
    // Hide toast notification
    const hideToast = () => {
      if (toast.value.timeout) {
        clearTimeout(toast.value.timeout);
      }
      toast.value.show = false;
    };
    
    // Show error message
    const showError = (message) => {
      showToast(message, 'error');
    };
    
    // Get variable name
    const getVariableName = (variableKey) => {
      const names = {
        'temperature': 'Temperatura',
        'oxygen': 'Oxígeno disuelto',
        'salinity': 'Salinidad',
        'currents': 'Corrientes',
        'chlorophyll': 'Clorofila'
      };
      return names[variableKey] || variableKey;
    };
    
    // Get color for variable
    const getColorForVariable = (risk) => {
      const colors = {
        temperature: {
          high: '#e74c3c',
          medium: '#f39c12',
          low: '#2ecc71'
        },
        oxygen: {
          high: '#e74c3c',
          medium: '#f39c12',
          low: '#3498db'
        },
        salinity: {
          high: '#9b59b6',
          medium: '#3498db',
          low: '#2ecc71'
        },
        currents: {
          high: '#e74c3c',
          medium: '#f39c12',
          low: '#2ecc71'
        },
        chlorophyll: {
          high: '#e74c3c',
          medium: '#f1c40f',
          low: '#2ecc71'
        }
      };
      
      const variableColors = colors[selectedVariable.value] || colors.temperature;
      return variableColors[risk] || '#95a5a6';
    };
    
    // Get toast icon
    const getToastIcon = (type) => {
      switch (type) {
        case 'success': return '✅';
        case 'error': return '❌';
        case 'warning': return '⚠️';
        case 'info': 
        default: return 'ℹ️';
      }
    };
    
    // Initialize data
    onMounted(() => {
      loadFarms();
      loadAlerts();
    });
    
    // Watch for changes in selected farm ID
    watch(selectedFarmId, (newVal) => {
      if (mapComponent.value && newVal) {
        mapComponent.value.highlightFishFarm && mapComponent.value.highlightFishFarm(newVal);
      }
    });
    
    return {
      // State
      isSidebarCollapsed,
      showStatsPanel,
      selectedVariable,
      selectedDateString,
      selectedDate,
      selectedFarmId,
      selectedFarm,
      searchTerm,
      farms,
      filteredFarms,
      alerts,
      alertCounts,
      isLoading,
      isExporting,
      showHelpModal,
      toast,
      today,
      mapComponent,
      
      // Methods
      toggleSidebar,
      toggleStatsPanel,
      filterFarms,
      selectFarm,
      updateMapLayer,
      updateSelectedVariable,
      loadFarmData,
      loadAlerts,
      exportData,
      showHelp,
      showToast,
      hideToast,
      showError,
      getVariableName,
      getColorForVariable,
      getToastIcon,
      handleRiskLevelChanged
    };
  }
};
</script>

<style scoped>
.home-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background-color: #f5f7fa;
  position: relative;
}

.stats-tabs {
  display: flex;
  border-bottom: 1px solid #e1e4e8;
  margin-bottom: 15px;
}

.stats-tab {
  padding: 10px 15px;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  font-size: 0.9rem;
  transition: all 0.2s;
  color: #6c757d;
}

.stats-tab:hover {
  color: #3498db;
  background-color: #f8f9fa;
}

.stats-tab.active {
  border-bottom-color: #3498db;
  color: #3498db;
  font-weight: 500;
}

/* Sidebar (Panel Izquierdo) */
.sidebar {
  width: 300px;
  background-color: #2c3e50;
  color: white;
  display: flex;
  flex-direction: column;
  height: 100%;
  transition: width 0.3s ease;
  z-index: 10;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
}

.sidebar.collapsed {
  width: 60px;
}

.sidebar-header {
  padding: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background-color: #1f2d3d;
}

.logo {
  display: flex;
  align-items: center;
}

.logo-icon {
  width: 30px;
  height: 30px;
  background-color: #3498db;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
}

.sidebar-header h1 {
  margin: 0 0 0 10px;
  font-size: 1.2rem;
  font-weight: 500;
}

.sidebar-toggle {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 1.2rem;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.3s;
  border-radius: 4px;
}

.sidebar-toggle:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
}

.sidebar-section {
  margin-bottom: 20px;
}

.sidebar-section h2 {
  font-size: 0.9rem;
  text-transform: uppercase;
  color: #95a5a6;
  margin-bottom: 15px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.search-box {
  position: relative;
  margin-bottom: 15px;
}

.search-box input {
  width: 100%;
  padding: 8px 10px 8px 30px;
  border: none;
  border-radius: 4px;
  background-color: #34495e;
  color: white;
  font-size: 0.9rem;
}

.search-box input::placeholder {
  color: #95a5a6;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #95a5a6;
  font-size: 0.8rem;
}

.filter-group {
  margin-bottom: 15px;
}

.filter-group label {
  display: block;
  font-size: 0.85rem;
  margin-bottom: 5px;
  color: #bdc3c7;
}

.filter-group select,
.filter-group input {
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 4px;
  background-color: #34495e;
  color: white;
  font-size: 0.9rem;
}

.farms-list-wrapper {
  background-color: #34495e;
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  color: #bdc3c7;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.no-data {
  padding: 20px;
  text-align: center;
  color: #bdc3c7;
  font-style: italic;
}

.farms-list {
  display: flex;
  flex-direction: column;
}

.farm-item {
  display: flex;
  align-items: center;
  padding: 10px 15px;
  transition: background-color 0.2s;
  cursor: pointer;
  border-radius: 4px;
}

.farm-item:hover {
  background-color: #3a536b;
}

.farm-item.selected {
  background-color: #3498db;
}

.farm-icon {
  margin-right: 10px;
  font-size: 1rem;
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

.alert-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  border-radius: 4px;
}

.alert-card.high {
  background-color: rgba(231, 76, 60, 0.3);
}

.alert-card.medium {
  background-color: rgba(243, 156, 18, 0.3);
}

.alert-card.low {
  background-color: rgba(52, 152, 219, 0.3);
}

.alert-count {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 5px;
}

.alert-label {
  font-size: 0.8rem;
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

.color-box,
.marker-box {
  width: 16px;
  height: 16px;
  margin-right: 10px;
}

.color-box {
  border-radius: 3px;
}

.marker-box {
  border-radius: 50%;
  background-color: #3498db;
  border: 2px solid white;
}

.sidebar-footer {
  padding: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-btn {
  padding: 10px;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.action-btn.primary {
  background-color: #3498db;
  color: white;
}

.action-btn.primary:hover:not(:disabled) {
  background-color: #2980b9;
}

.action-btn.secondary {
  background-color: #34495e;
  color: white;
}

.action-btn.secondary:hover {
  background-color: #2c3e50;
}

.action-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.action-btn .icon {
  margin-right: 8px;
}

/* Main content (Panel Central - Mapa) */
.main-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* Stats panel (Panel Derecho) */
.stats-panel {
  width: 400px;
  background-color: white;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.3s ease;
}

.stats-panel.hidden {
  transform: translateX(100%);
}

.stats-header {
  padding: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e1e4e8;
  background-color: #f8f9fa;
}

.stats-header h2 {
  margin: 0;
  font-size: 1.2rem;
  color: #2c3e50;
  font-weight: 600;
}

.stats-actions {
  display: flex;
  align-items: center;
}

.toggle-button {
  background: none;
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #2c3e50;
  font-size: 1.2rem;
  transition: background-color 0.2s;
}

.toggle-button:hover {
  background-color: #f1f1f1;
}

.stats-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.no-selection-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  padding: 20px;
  text-align: center;
  color: #6c757d;
}

.message-icon {
  font-size: 3rem;
  margin-bottom: 15px;
}

.no-selection-message h3 {
  font-size: 1.2rem;
  margin-bottom: 10px;
  color: #2c3e50;
}

.no-selection-message p {
  font-size: 0.9rem;
  max-width: 300px;
}

/* Modal */
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
  animation: fadeIn 0.3s ease;
}

.modal-content {
  background-color: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideIn 0.3s ease;
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

/* Toast */
.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  animation: slideUp 0.3s ease;
}

.toast-content {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  border-radius: 4px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
  background-color: white;
  min-width: 300px;
  max-width: 400px;
}

.toast-content.success {
  border-left: 4px solid #2ecc71;
}

.toast-content.error {
  border-left: 4px solid #e74c3c;
}

.toast-content.warning {
  border-left: 4px solid #f39c12;
}

.toast-content.info {
  border-left: 4px solid #3498db;
}

.toast-icon {
  margin-right: 10px;
  font-size: 1.2rem;
}

.toast-message {
  flex: 1;
  font-size: 0.9rem;
  color: #2c3e50;
}

.toast-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #95a5a6;
  margin-left: 10px;
}

.toast-close:hover {
  color: #7f8c8d;
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { transform: translateY(-20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* Responsive adjustments */
@media (max-width: 1200px) {
  .stats-panel {
    width: 350px;
  }
}

@media (max-width: 992px) {
  .home-container {
    position: relative;
  }
  
  .sidebar {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 100;
    transform: translateX(0);
    transition: transform 0.3s ease;
  }
  
  .sidebar.collapsed {
    transform: translateX(-300px);
    width: 300px;
  }
  
  .stats-panel {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    z-index: 100;
  }
}

@media (max-width: 768px) {
  .stats-panel {
    width: 100%;
  }
  
  .toast {
    left: 20px;
    right: 20px;
    bottom: 20px;
  }
  
  .toast-content {
    min-width: auto;
    max-width: none;
    width: 100%;
  }
}
</style>