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
              <option value="oxygen">Oxígeno Disuelto</option>
              <option value="currents">Corrientes</option>
              <option value="salinity">Salinidad</option>
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
          <div v-if="isLoading" class="loading-indicator">
            <div class="spinner"></div>
            <span>Cargando datos...</span>
          </div>
          <div v-else-if="farms.length === 0" class="no-data">
            No se encontraron piscifactorías.
          </div>
          <div v-else class="farms-list">
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
              <span class="color-box" :style="{backgroundColor: getColorForVariable('high')}"></span>
              <span class="legend-label">Alto riesgo</span>
            </div>
            <div class="legend-item">
              <span class="color-box" :style="{backgroundColor: getColorForVariable('medium')}"></span>
              <span class="legend-label">Riesgo medio</span>
            </div>
            <div class="legend-item">
              <span class="color-box" :style="{backgroundColor: getColorForVariable('low')}"></span>
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
        <button class="export-btn" @click="exportData" :disabled="isExporting">
          <span class="icon">{{ isExporting ? '⏳' : '📊' }}</span> 
          {{ isExporting ? 'Exportando...' : 'Exportar datos' }}
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
            :selectedFarmId="selectedFarmId"
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
        <div v-else class="no-farm-selected">
          <div class="no-farm-message">
            <div class="icon">🔍</div>
            <h3>Ninguna piscifactoría seleccionada</h3>
            <p>Haz clic en una piscifactoría en el mapa o en la lista para ver sus detalles.</p>
          </div>
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
          
          <h4>Novedades:</h4>
          <ul>
            <li><strong>Gráfico temporal dinámico:</strong> Visualiza la evolución de variables ambientales a lo largo del tiempo.</li>
            <li><strong>Predicciones:</strong> Accede a predicciones basadas en análisis de datos históricos.</li>
            <li><strong>Línea de tiempo:</strong> Usa los controles del mapa para ver cómo evolucionan los datos en el tiempo.</li>
          </ul>
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
    
    // Estado de carga y exportación
    const isLoading = ref(false);
    const isExporting = ref(false);
    
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

    const sharedDateRange = ref({
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date(),
      preset: 'week'
    });
    
    // Obtener color según la variable ambiental seleccionada
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
        nutrientes: {
          high: '#e74c3c',
          medium: '#f1c40f',
          low: '#2ecc71'
        }
      };
      
      // Usar colores según la variable seleccionada, o colores por defecto
      const variableColors = colors[selectedVariable.value] || colors.temperature;
      return variableColors[risk];
    };
    
    // Métodos
    // Cargar datos de piscifactorías
    const loadFarms = async () => {
      isLoading.value = true;
      try {
        showToastMessage('Cargando datos de piscifactorías...');
        const response = await DataService.getPiscifactorias();
        farms.value = response.data;
        
        // Si hay datos y no hay selección previa, seleccionar la primera
        if (farms.value.length > 0 && !selectedFarmId.value) {
          await selectFarm(farms.value[0].id);
        }
        
        showToastMessage('Datos cargados correctamente');
      } catch (error) {
        console.error('Error al cargar piscifactorías:', error);
        showToastMessage('Error al cargar datos de piscifactorías');
      } finally {
        isLoading.value = false;
      }
    };

    // Cargar alertas
    const loadAlerts = async () => {
      try {
        const response = await DataService.getAlertas();
        
        // Actualizar conteo de alertas según nivel
        const counts = { high: 0, medium: 0, low: 0 };
        
        if (response.data && response.data.length) {
          response.data.forEach(alert => {
            if (alert.nivel === 'alta') counts.high++;
            else if (alert.nivel === 'media') counts.medium++;
            else counts.low++;
          });
        }
        
        alertCounts.value = counts;
      } catch (error) {
        console.error('Error al cargar alertas:', error);
        // Mantener alertas en 0 en caso de error
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
        
        // Actualizar el mapa con los nuevos datos
        if (mapComponent.value) {
          // Esto activará la actualización del mapa si el componente expone ese método
          mapComponent.value.updateLayer && mapComponent.value.updateLayer();
          showToastMessage(`Datos de ${getVariableName(selectedVariable.value)} actualizados`);
        }
      } catch (error) {
        console.error('Error al cargar datos ambientales:', error);
        showToastMessage('Error al cargar datos ambientales');
      }
    };

    // Seleccionar una piscifactoría
    const selectFarm = async (farmId) => {
      // Si ya está seleccionada, no hacer nada
      if (selectedFarmId.value === farmId) return;
      
      selectedFarmId.value = farmId;
      
      try {
        if (farmId) {
          // Cargar datos detallados de la piscifactoría
          const response = await DataService.getPiscifactoria(farmId);
          
          // Si el mapa está disponible, resaltar la piscifactoría
          if (mapComponent.value && mapComponent.value.highlightFishFarm) {
            mapComponent.value.highlightFishFarm(farmId);
          }
          
          // Mostrar toast de confirmación
          showToastMessage(`Piscifactoría seleccionada: ${response.data.name}`);
        }
      } catch (error) {
        console.error('Error al cargar detalles de piscifactoría:', error);
        showToastMessage('Error al cargar detalles de la piscifactoría');
      }
    };
    
    // Actualizar la variable seleccionada (desde el componente de estadísticas)
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
      if (isExporting.value) return;
      
      isExporting.value = true;
      showToastMessage('Exportando datos...');
      
      try {
        const params = {
          fecha: selectedDateString.value,
          variable: selectedVariable.value,
          piscifactoriaId: selectedFarmId.value || null
        };
        
        const response = await DataService.exportarDatos(params);
        
        if (response.data && response.data.success) {
          showToastMessage('Datos exportados correctamente');
          
          // Si hay una URL de descarga, iniciarla
          if (response.data.downloadUrl && response.data.downloadUrl !== '#') {
            const a = document.createElement('a');
            a.href = response.data.downloadUrl;
            a.download = `datos_${selectedVariable.value}_${selectedDateString.value}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        } else {
          showToastMessage('No se pudieron exportar los datos');
        }
      } catch (error) {
        console.error('Error al exportar datos:', error);
        showToastMessage('Error al exportar datos');
      } finally {
        isExporting.value = false;
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
        // Intentar acceder al método highlightFishFarm del componente mapa
        if (mapComponent.value.highlightFishFarm) {
          mapComponent.value.highlightFishFarm(newId);
        }
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
      isLoading,
      isExporting,
      showHelpModal,
      showToast,
      toastMessage,
      mapComponent,
      updateMapLayer,
      selectFarm,
      updateSelectedVariable,
      showHelp,
      exportData,
      getVariableName,
      getColorForVariable
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

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
  color: #bdc3c7;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #3498db;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.no-data {
  text-align: center;
  padding: 20px 0;
  color: #bdc3c7;
  font-style: italic;
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

.export-btn:hover:not(:disabled) {
  background-color: #2980b9;
}

.help-btn:hover {
  background-color: #2c3e50;
}

.export-btn:disabled {
  background-color: #7f8c8d;
  cursor: not-allowed;
  opacity: 0.7;
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

.no-farm-selected {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f8f9fa;
}

.no-farm-message {
  text-align: center;
  padding: 30px;
  color: #6c757d;
}

.no-farm-message .icon {
  font-size: 3rem;
  margin-bottom: 20px;
}

.no-farm-message h3 {
  font-size: 1.2rem;
  margin-bottom: 10px;
  color: #2c3e50;
}

.no-farm-message p {
  font-size: 0.9rem;
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