<template>
  <div class="stats-dashboard">
    <div class="stats-header">
      <h2>{{ selectedFarm ? selectedFarm.name : 'Estadísticas Generales' }}</h2>
      <div v-if="selectedFarm" class="farm-info">
        <span><strong>Ubicación:</strong> {{ selectedFarm.location }}</span>
        <span><strong>Tipo:</strong> {{ selectedFarm.type }}</span>
      </div>
    </div>
    
    <!-- Error Message -->
    <div v-if="errorMessage" class="error-notification">
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <span>{{ errorMessage }}</span>
        <button class="error-close" @click="clearError">&times;</button>
      </div>
    </div>

    <!-- Date Range Picker -->
    <DateRangePicker 
      :initial-start-date="startDate"
      :initial-end-date="endDate"
      @date-range-changed="handleDateRangeChange"
    />
    
    <!-- Variable Selector -->
    <div class="variable-selector">
      <h3>Variables a mostrar</h3>
      <div class="variable-options">
        <div 
          v-for="variable in availableVariables" 
          :key="variable.id"
          class="variable-option"
          :class="{ 'selected': selectedVariables.includes(variable.id) }"
          @click="toggleVariable(variable.id)"
        >
          <div class="color-indicator" :style="{ backgroundColor: getVariableColor(variable.id) }"></div>
          <span class="variable-name">{{ variable.name }}</span>
        </div>
      </div>
    </div>

    <!-- Loading Indicator -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <div class="loading-text">Cargando datos...</div>
    </div>

    <!-- Main Chart Section -->
    <div class="main-chart-section" v-if="!isLoading">
      <h3>Serie Temporal</h3>
      
      <div v-if="noDataAvailable" class="no-data-message">
        <div class="no-data-icon">📊</div>
        <h3>No hay datos disponibles</h3>
        <p>No se encontraron datos para la piscifactoría y variables seleccionadas. Por favor, intente con otra selección.</p>
        <button class="refresh-btn" @click="loadHistoricalData">
          <span class="refresh-icon">🔄</span> Reintentar
        </button>
      </div>
      
      <div v-else class="chart-container">
        <!-- Enhanced chart component that supports multiple data series -->
        <ChartComponent 
          :multipleData="chartDataSeries"
          chartType="line"
          :chartOptions="chartOptions"
        />
        
        <!-- Chart controls -->
        <div class="chart-controls">
          <div class="chart-type-selector">
            <label for="chart-type">Tipo de gráfico:</label>
            <select id="chart-type" v-model="chartType" @change="updateChartType">
              <option value="line">Línea</option>
              <option value="bar">Barras</option>
              <option value="scatter">Dispersión</option>
            </select>
          </div>
          
          <div class="chart-actions">
            <button class="btn-action" @click="exportData" :disabled="isExporting">
              <span class="icon">{{ isExporting ? '⏳' : '📊' }}</span> 
              {{ isExporting ? 'Exportando...' : 'Exportar datos' }}
            </button>
            <button class="btn-action" @click="resetZoom">
              <span class="icon">🔍</span> Resetear zoom
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Key Indicators Section -->
    <div class="indicators-section" v-if="!isLoading && selectedFarm && !noDataAvailable">
      <h3>Indicadores Clave</h3>
      
      <div class="indicators-grid">
        <div 
          v-for="variable in selectedVariables" 
          :key="variable"
          class="indicator-card"
        >
          <div class="indicator-header">
            <h4>{{ getVariableName(variable) }}</h4>
          </div>
          <div class="indicator-content">
            <div class="indicator-value">
              {{ getLatestValue(variable) }}
              <span class="unit">{{ getVariableUnit(variable) }}</span>
            </div>
            <div class="indicator-stats">
              <div class="stat">
                <span class="stat-label">Min</span>
                <span class="stat-value">{{ getMinValue(variable) }}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Prom</span>
                <span class="stat-value">{{ getAvgValue(variable) }}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Max</span>
                <span class="stat-value">{{ getMaxValue(variable) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import DataService from '../services/DataService';
import DateRangePicker from './DateRangePicker.vue';
import ChartComponent from './ChartComponent.vue';

export default {
  name: 'StatsComponent',
  components: {
    DateRangePicker,
    ChartComponent
  },
  emits: ['variable-changed', 'error', 'refresh-farm-data'],
  props: {
    selectedFarmId: {
      type: Number,
      default: null
    },
    selectedFarm: {
      type: Object,
      default: null
    }
  },
  
  setup(props, { emit }) {
    // State variables
    const isLoading = ref(false);
    const isExporting = ref(false);
    const errorMessage = ref('');
    const noDataAvailable = ref(false);
    const startDate = ref(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // 7 days ago
    const endDate = ref(new Date());
    const chartType = ref('line');
    const autoRefreshInterval = ref(null);
    
    // Data for selected variables
    const variableData = ref({});
    const selectedVariables = ref(['temperature']); // Default selected variable

    // Available variables
    const availableVariables = [
      { id: 'temperature', name: 'Temperatura', unit: '°C' },
      { id: 'o2', name: 'Oxígeno', unit: 'mg/L' },
      { id: 'salinity', name: 'Salinidad', unit: 'ppt' },
      { id: 'currents', name: 'Corrientes', unit: 'm/s' },
      { id: 'no3', name: 'Nitrato', unit: 'mmol/m³' },
      { id: 'po4', name: 'Fosfato', unit: 'mmol/m³' },
      { id: 'CHL', name: 'Clorofila', unit: 'mg/m³' },
      { id: 'TUR', name: 'Turbidez', unit: 'NTU' }
    ];
    
    // Chart configuration options
    const chartOptions = ref({
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              const variableId = selectedVariables.value.find(v => 
                getVariableName(v) === label);
              const unit = getVariableUnit(variableId);
              return `${label}: ${value.toFixed(2)} ${unit}`;
            }
          }
        },
        zoom: {
          zoom: {
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true
            },
            mode: 'xy'
          },
          pan: {
            enabled: true,
            mode: 'xy'
          }
        }
      },
      scales: {
        y: {
          title: {
            display: true,
            text: 'Valor'
          }
        }
      }
    });
    
    // Prepare multiple data series for the chart
    const chartDataSeries = computed(() => {
      return selectedVariables.value.map(variable => {
        return {
          label: getVariableName(variable),
          data: variableData.value[variable] || [],
          color: {
            border: getVariableColor(variable),
            background: getVariableColor(variable, 0.2)
          }
        };
      }).filter(series => series.data.length > 0);
    });

    // Toggle variable selection
    const toggleVariable = (variableId) => {
      const index = selectedVariables.value.indexOf(variableId);
      
      if (index === -1) {
        // Add the variable
        selectedVariables.value.push(variableId);
        
        // Load data for the new variable if we don't already have it
        if (!variableData.value[variableId]) {
          loadDataForVariable(variableId);
        }
      } else {
        // Remove the variable if it's not the last one selected
        if (selectedVariables.value.length > 1) {
          selectedVariables.value.splice(index, 1);
        }
      }
    };
    
    // Get color for a variable
    const getVariableColor = (variableId, alpha = 1) => {
      const colors = {
        'temperature': `rgba(255, 99, 132, ${alpha})`,
        'o2': `rgba(54, 162, 235, ${alpha})`,
        'salinity': `rgba(153, 102, 255, ${alpha})`,
        'currents': `rgba(255, 206, 86, ${alpha})`,
        'no3': `rgba(75, 192, 192, ${alpha})`,
        'po4': `rgba(255, 159, 64, ${alpha})`,
        'CHL': `rgba(46, 204, 113, ${alpha})`,
        'TUR': `rgba(149, 165, 166, ${alpha})`
      };
      
      return colors[variableId] || `rgba(128, 128, 128, ${alpha})`;
    };
    
    // Get variable name
    const getVariableName = (variableId) => {
      const variable = availableVariables.find(v => v.id === variableId);
      return variable ? variable.name : variableId;
    };
    
    // Get variable unit
    const getVariableUnit = (variableId) => {
      const variable = availableVariables.find(v => v.id === variableId);
      return variable ? variable.unit : '';
    };
    
    // Reset chart zoom
    const resetZoom = () => {
      // Implementation depends on the chart library's API
      // This is a placeholder
    };
    
    // Update chart type
    const updateChartType = () => {
      // The chart component will react to the chartType change
    };
    
    // Get latest value for a variable
    const getLatestValue = (variableId) => {
      if (!variableData.value[variableId] || variableData.value[variableId].length === 0) {
        return 'N/A';
      }
      
      const sorted = [...variableData.value[variableId]].sort((a, b) => 
        new Date(b.fecha) - new Date(a.fecha));
      
      return sorted[0].valor.toFixed(2);
    };
    
    // Get min value for a variable
    const getMinValue = (variableId) => {
      if (!variableData.value[variableId] || variableData.value[variableId].length === 0) {
        return 'N/A';
      }
      
      const min = Math.min(...variableData.value[variableId].map(item => item.valor));
      return min.toFixed(2);
    };
    
    // Get max value for a variable
    const getMaxValue = (variableId) => {
      if (!variableData.value[variableId] || variableData.value[variableId].length === 0) {
        return 'N/A';
      }
      
      const max = Math.max(...variableData.value[variableId].map(item => item.valor));
      return max.toFixed(2);
    };
    
    // Get average value for a variable
    const getAvgValue = (variableId) => {
      if (!variableData.value[variableId] || variableData.value[variableId].length === 0) {
        return 'N/A';
      }
      
      const sum = variableData.value[variableId].reduce((acc, item) => acc + item.valor, 0);
      const avg = sum / variableData.value[variableId].length;
      return avg.toFixed(2);
    };
    
    // Handle date range change
    const handleDateRangeChange = (range) => {
      startDate.value = range.start;
      endDate.value = range.end;
      
      // Reload data for all selected variables
      loadHistoricalData();
    };
    
    // Load data for a specific variable
    const loadDataForVariable = async (variableId) => {
      if (!props.selectedFarmId) {
        showError('No hay ninguna piscifactoría seleccionada');
        return;
      }
      
      isLoading.value = true;
      
      try {
        const response = await DataService.getDatosHistoricos(
          variableId, 
          {
            piscifactoriaId: props.selectedFarmId,
            fechaInicio: startDate.value.toISOString(),
            fechaFin: endDate.value.toISOString()
          }
        );
        
        if (response.data && response.data.datos && response.data.datos.length > 0) {
          // Update variable data
          variableData.value = {
            ...variableData.value,
            [variableId]: response.data.datos
          };
          
          noDataAvailable.value = false;
        } else {
          console.warn(`No data available for variable ${variableId}`);
          
          // Set empty data array for this variable
          variableData.value = {
            ...variableData.value,
            [variableId]: []
          };
          
          // Check if we have any data at all
          const hasAnyData = Object.values(variableData.value).some(data => data.length > 0);
          noDataAvailable.value = !hasAnyData;
        }
      } catch (error) {
        console.error(`Error loading data for variable ${variableId}:`, error);
        showError(`Error al cargar datos para ${getVariableName(variableId)}: ${error.message || 'Error desconocido'}`);
        
        // Set empty data array for this variable
        variableData.value = {
          ...variableData.value,
          [variableId]: []
        };
        
        // Check if we have any data at all
        const hasAnyData = Object.values(variableData.value).some(data => data.length > 0);
        noDataAvailable.value = !hasAnyData;
      } finally {
        isLoading.value = false;
      }
    };
    
    // Load historical data for all selected variables
    const loadHistoricalData = async () => {
      if (!props.selectedFarmId) {
        showError('No hay ninguna piscifactoría seleccionada');
        return;
      }
      
      isLoading.value = true;
      noDataAvailable.value = false;
      clearError();
      
      // Reset variable data
      variableData.value = {};
      
      try {
        // Load data for each selected variable
        const promises = selectedVariables.value.map(variable => loadDataForVariable(variable));
        await Promise.all(promises);
        
        // Check if we have any data at all
        const hasAnyData = Object.values(variableData.value).some(data => data.length > 0);
        noDataAvailable.value = !hasAnyData;
        
        if (noDataAvailable.value) {
          throw new Error('No se encontraron datos para la selección actual');
        }
      } catch (error) {
        console.error('Error loading historical data:', error);
        showError(`Error al cargar datos: ${error.message || 'Se produjo un error al obtener los datos'}`);
        noDataAvailable.value = true;
      } finally {
        isLoading.value = false;
      }
    };
    
    // Export data in CSV format
    const exportData = async () => {
      if (isExporting.value) return;
      
      isExporting.value = true;
      
      try {
        // Check if we have any data to export
        const hasData = Object.values(variableData.value).some(data => data && data.length > 0);
        
        if (!hasData) {
          showError('No hay datos disponibles para exportar');
          return;
        }
        
        // Create CSV content with headers
        let csvContent = 'fecha';
        selectedVariables.value.forEach(variable => {
          csvContent += `,${getVariableName(variable)} (${getVariableUnit(variable)})`;
        });
        csvContent += '\n';
        
        // Get all unique dates across all variables
        const allDates = new Set();
        Object.values(variableData.value).forEach(data => {
          data.forEach(item => allDates.add(item.fecha));
        });
        
        const sortedDates = Array.from(allDates).sort();
        
        // Create a row for each date
        sortedDates.forEach(date => {
          csvContent += date;
          
          // Add value for each variable on this date
          selectedVariables.value.forEach(variable => {
            const data = variableData.value[variable] || [];
            const item = data.find(item => item.fecha === date);
            csvContent += `,${item ? item.valor : ''}`;
          });
          
          csvContent += '\n';
        });
        
        // Create a download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `datos_${props.selectedFarmId}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
      } catch (error) {
        console.error('Error exporting data:', error);
        showError(`Error al exportar datos: ${error.message || 'Error desconocido'}`);
      } finally {
        isExporting.value = false;
      }
    };
    
    // Show error message
    const showError = (message) => {
      errorMessage.value = message;
      emit('error', message);
      
      // Auto-clear error after 10 seconds
      setTimeout(() => {
        if (errorMessage.value === message) {
          clearError();
        }
      }, 10000);
    };
    
    // Clear error message
    const clearError = () => {
      errorMessage.value = '';
    };
    
    // Watch for changes in selected farm
    watch(() => props.selectedFarmId, (newVal, oldVal) => {
      if (newVal && newVal !== oldVal) {
        clearError();
        loadHistoricalData();
      }
    });
    
    // Load data when component is mounted
    onMounted(() => {
      if (props.selectedFarmId) {
        loadHistoricalData();
      }
    });
    
    // Cleanup when component is unmounted
    onUnmounted(() => {
      if (autoRefreshInterval.value) {
        clearInterval(autoRefreshInterval.value);
      }
    });
    
    return {
      // State
      isLoading,
      isExporting,
      errorMessage,
      noDataAvailable,
      startDate,
      endDate,
      chartType,
      selectedVariables,
      availableVariables,
      variableData,
      chartOptions,
      chartDataSeries,
      
      // Methods
      clearError,
      handleDateRangeChange,
      toggleVariable,
      getVariableName,
      getVariableUnit,
      getVariableColor,
      getLatestValue,
      getMinValue,
      getMaxValue,
      getAvgValue,
      loadHistoricalData,
      exportData,
      resetZoom,
      updateChartType
    };
  }
};
</script>

<style scoped>

.stats-dashboard {
  padding: 15px;
  height: 100%;
  overflow-y: auto;
  background-color: #f8f9fa;
  color: #333;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Header styling */
.stats-header {
  margin-bottom: 20px;
  border-bottom: 1px solid #e1e4e8;
  padding-bottom: 10px;
}

.stats-header h2 {
  margin: 0 0 10px 0;
  font-size: 1.5rem;
  color: #2c3e50;
}

.farm-info {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
  color: #6c757d;
}

.farm-info span {
  margin-bottom: 5px;
}

/* Error message styling */
.error-notification {
  margin-bottom: 15px;
  padding: 12px 15px;
  background-color: #f8d7da;
  color: #721c24;
  border-left: 4px solid #e74c3c;
  border-radius: 4px;
  display: flex;
  align-items: center;
  animation: fadeIn 0.3s ease-in-out;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.error-content {
  display: flex;
  align-items: center;
  flex: 1;
}

.error-icon {
  font-size: 20px;
  margin-right: 10px;
}

.error-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #721c24;
  padding: 0 5px;
  transition: color 0.2s;
}

.error-close:hover {
  color: #e74c3c;
}

/* Loading overlay */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  animation: spin 2s linear infinite;
  margin-bottom: 15px;
}

.loading-text {
  font-size: 16px;
  color: #333;
  font-weight: 500;
}

/* No data message */
.no-data-message {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 30px;
  text-align: center;
  margin: 20px 0;
  border: 1px dashed #ced4da;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.no-data-icon {
  font-size: 48px;
  margin-bottom: 15px;
}

.no-data-message h3 {
  font-size: 18px;
  margin-bottom: 10px;
  color: #2c3e50;
}

.no-data-message p {
  color: #6c757d;
  margin-bottom: 20px;
  line-height: 1.5;
}

.refresh-btn {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  transition: background-color 0.2s;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.refresh-btn:hover {
  background-color: #2980b9;
}

.refresh-icon {
  margin-right: 8px;
}

/* Variable selector */
.variable-selector {
  background-color: white;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.variable-selector h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1rem;
  color: #2c3e50;
}

.variable-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.variable-option {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #e1e4e8;
}

.variable-option:hover {
  background-color: #e9ecef;
  transform: translateY(-2px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.variable-option.selected {
  background-color: #e3f2fd;
  border-color: #90caf9;
  box-shadow: 0 2px 4px rgba(144, 202, 249, 0.2);
}

.color-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 8px;
}

.variable-name {
  font-size: 0.9rem;
  color: #495057;
}

/* Main chart section */
.main-chart-section {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.main-chart-section h3 {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 1.1rem;
  color: #2c3e50;
  border-bottom: 1px solid #f1f1f1;
  padding-bottom: 10px;
}

.chart-container {
  margin-bottom: 20px;
}

.chart-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 15px;
  border-top: 1px solid #f1f1f1;
}

.chart-type-selector {
  display: flex;
  align-items: center;
}

.chart-type-selector label {
  margin-right: 10px;
  font-size: 0.9rem;
  color: #6c757d;
}

.chart-type-selector select {
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #ced4da;
  background-color: #f8f9fa;
  color: #495057;
  cursor: pointer;
  transition: border-color 0.2s;
}

.chart-type-selector select:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.2);
}

.chart-actions {
  display: flex;
  gap: 10px;
}

.btn-action {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 4px;
  border: none;
  background-color: #f8f9fa;
  color: #495057;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-action:hover {
  background-color: #e9ecef;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn-action:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-action .icon {
  margin-right: 6px;
}

/* Indicators section */
.indicators-section {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.indicators-section h3 {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 1.1rem;
  color: #2c3e50;
  border-bottom: 1px solid #f1f1f1;
  padding-bottom: 10px;
}

.indicators-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 15px;
}

.indicator-card {
  border-radius: 6px;
  border: 1px solid #e1e4e8;
  overflow: hidden;
  transition: all 0.2s;
}

.indicator-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.indicator-header {
  padding: 10px 15px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e1e4e8;
}

.indicator-header h4 {
  margin: 0;
  font-size: 0.95rem;
  color: #2c3e50;
}

.indicator-content {
  padding: 15px;
}

.indicator-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 15px;
  text-align: center;
}

.indicator-value .unit {
  font-size: 0.9rem;
  color: #6c757d;
  font-weight: normal;
  margin-left: 4px;
}

.indicator-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  background-color: #f8f9fa;
  padding: 10px;
  border-radius: 4px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-label {
  font-size: 0.8rem;
  color: #6c757d;
  margin-bottom: 5px;
}

.stat-value {
  font-size: 0.9rem;
  font-weight: 500;
  color: #2c3e50;
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Media Queries for responsiveness */
@media (max-width: 992px) {
  .indicators-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }
}

@media (max-width: 768px) {
  .chart-controls {
    flex-direction: column;
    gap: 15px;
    align-items: flex-start;
  }
  
  .chart-actions {
    width: 100%;
  }
  
  .btn-action {
    flex: 1;
    justify-content: center;
  }
  
  .variable-options {
    flex-direction: column;
    gap: 8px;
  }
  
  .variable-option {
    width: 100%;
  }
}

@media (max-width: 576px) {
  .stats-dashboard {
    padding: 10px;
  }
  
  .indicators-grid {
    grid-template-columns: 1fr;
  }
  
  .main-chart-section,
  .indicators-section,
  .variable-selector {
    padding: 15px;
  }
}
</style>