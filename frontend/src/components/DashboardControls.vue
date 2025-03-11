<!-- DashboardControls.vue -->
<template>
    <div class="dashboard-controls">
      <div class="controls-header" @click="toggleExpanded">
        <h3>Panel de Control</h3>
        <button class="toggle-btn">
          <i class="toggle-icon">{{ expanded ? '▲' : '▼' }}</i>
        </button>
      </div>
      
      <div v-if="expanded" class="controls-content">
        <div class="control-section">
          <h4>Variables ambientales</h4>
          <div class="variables-grid">
            <div 
              v-for="variable in availableVariables" 
              :key="variable.id"
              class="variable-item"
              :class="{ active: selectedVariables.includes(variable.id) }"
              @click="toggleVariable(variable.id)"
            >
              <div class="variable-icon" :style="{ backgroundColor: variable.color }">
                <i class="icon-variable"></i>
              </div>
              <div class="variable-name">{{ variable.name }}</div>
            </div>
          </div>
        </div>
        
        <div class="control-section">
          <h4>Visualización</h4>
          <div class="visualization-options">
            <div class="option-group">
              <label>Tipo de gráfico:</label>
              <div class="button-group">
                <button 
                  v-for="type in chartTypes" 
                  :key="type.id"
                  class="chart-type-btn"
                  :class="{ active: selectedChartType === type.id }"
                  @click="selectedChartType = type.id; emitConfigChange()"
                >
                  <i :class="type.icon"></i>
                  {{ type.name }}
                </button>
              </div>
            </div>
            
            <div class="option-group">
              <label>Densidad de datos:</label>
              <div class="slider-group">
                <input 
                  type="range" 
                  min="1" 
                  max="5" 
                  v-model="dataResolution" 
                  @change="emitConfigChange"
                >
                <span class="slider-value">{{ getResolutionText() }}</span>
              </div>
            </div>
            
            <div class="option-group">
              <label>Mostrar umbrales:</label>
              <div class="toggle-switch">
                <input 
                  type="checkbox" 
                  id="show-thresholds" 
                  v-model="showThresholds"
                  @change="emitConfigChange"
                >
                <label for="show-thresholds"></label>
              </div>
            </div>
            
            <div class="option-group">
              <label>Mostrar alertas:</label>
              <div class="toggle-switch">
                <input 
                  type="checkbox" 
                  id="show-alerts" 
                  v-model="showAlerts"
                  @change="emitConfigChange"
                >
                <label for="show-alerts"></label>
              </div>
            </div>
          </div>
        </div>
        
        <div class="control-section">
          <h4>Actualización de datos</h4>
          <div class="data-refresh-options">
            <div class="option-group">
              <label>Actualización automática:</label>
              <div class="toggle-switch">
                <input 
                  type="checkbox" 
                  id="auto-refresh" 
                  v-model="autoRefresh"
                  @change="toggleAutoRefresh"
                >
                <label for="auto-refresh"></label>
              </div>
            </div>
            
            <div class="option-group" v-if="autoRefresh">
              <label>Intervalo:</label>
              <select v-model="refreshInterval" @change="updateRefreshInterval">
                <option value="30">30 segundos</option>
                <option value="60">1 minuto</option>
                <option value="300">5 minutos</option>
                <option value="600">10 minutos</option>
                <option value="1800">30 minutos</option>
              </select>
            </div>
            
            <div class="option-group">
              <button class="refresh-btn" @click="refreshData">
                <i class="icon-refresh"></i>
                Actualizar ahora
              </button>
            </div>
          </div>
        </div>
        
        <div class="control-section">
          <h4>Exportar datos</h4>
          <div class="export-options">
            <button 
              class="export-btn" 
              v-for="format in exportFormats" 
              :key="format.id"
              @click="exportData(format.id)"
            >
              <i :class="format.icon"></i>
              {{ format.name }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script>
  export default {
    name: 'DashboardControls',
    props: {
      initialVariables: {
        type: Array,
        default: () => ['o2']
      },
      initialChartType: {
        type: String,
        default: 'line'
      }
    },
    
    data() {
      return {
        expanded: false,
        selectedVariables: this.initialVariables,
        selectedChartType: this.initialChartType,
        dataResolution: 3,
        showThresholds: true,
        showAlerts: true,
        autoRefresh: false,
        refreshInterval: '300',
        refreshTimer: null,
        availableVariables: [
          { id: 'o2', name: 'Oxígeno', color: '#3498db' },
          { id: 'temperature', name: 'Temperatura', color: '#e74c3c' },
          { id: 'salinity', name: 'Salinidad', color: '#9b59b6' },
          { id: 'currents', name: 'Corrientes', color: '#2ecc71' },
          { id: 'CHL', name: 'Clorofila', color: '#f1c40f' },
          { id: 'TUR', name: 'Turbidez', color: '#95a5a6' },
          { id: 'no3', name: 'Nitrato', color: '#e67e22' },
          { id: 'po4', name: 'Fosfato', color: '#16a085' },
          { id: 'nppv', name: 'Productividad', color: '#27ae60' }
        ],
        chartTypes: [
          { id: 'line', name: 'Línea', icon: 'icon-line-chart' },
          { id: 'bar', name: 'Barras', icon: 'icon-bar-chart' },
          { id: 'area', name: 'Área', icon: 'icon-area-chart' }
        ],
        exportFormats: [
          { id: 'csv', name: 'CSV', icon: 'icon-file-csv' },
          { id: 'excel', name: 'Excel', icon: 'icon-file-excel' },
          { id: 'json', name: 'JSON', icon: 'icon-file-code' }
        ]
      };
    },
    
    methods: {
      toggleExpanded() {
        this.expanded = !this.expanded;
      },
      
      toggleVariable(variableId) {
        if (this.selectedVariables.includes(variableId)) {
          // Si ya está seleccionada y hay más de una, quitarla
          if (this.selectedVariables.length > 1) {
            this.selectedVariables = this.selectedVariables.filter(id => id !== variableId);
          }
        } else {
          // Si no está seleccionada, añadirla
          this.selectedVariables.push(variableId);
        }
        
        this.emitConfigChange();
      },
      
      getResolutionText() {
        const texts = {
          1: 'Muy baja',
          2: 'Baja',
          3: 'Media',
          4: 'Alta',
          5: 'Muy alta'
        };
        
        return texts[this.dataResolution] || 'Media';
      },
      
      emitConfigChange() {
        this.$emit('config-changed', {
          variables: this.selectedVariables,
          chartType: this.selectedChartType,
          resolution: parseInt(this.dataResolution),
          showThresholds: this.showThresholds,
          showAlerts: this.showAlerts
        });
      },
      
      toggleAutoRefresh() {
        if (this.autoRefresh) {
          this.startRefreshTimer();
        } else {
          this.stopRefreshTimer();
        }
        
        this.$emit('auto-refresh-changed', this.autoRefresh);
      },
      
      updateRefreshInterval() {
        this.stopRefreshTimer();
        if (this.autoRefresh) {
          this.startRefreshTimer();
        }
        
        this.$emit('refresh-interval-changed', parseInt(this.refreshInterval));
      },
      
      startRefreshTimer() {
        this.stopRefreshTimer();
        const interval = parseInt(this.refreshInterval) * 1000;
        this.refreshTimer = setInterval(() => {
          this.refreshData();
        }, interval);
      },
      
      stopRefreshTimer() {
        if (this.refreshTimer) {
          clearInterval(this.refreshTimer);
          this.refreshTimer = null;
        }
      },
      
      refreshData() {
        this.$emit('refresh-data');
      },
      
      exportData(format) {
        this.$emit('export-data', format);
      },
      
      beforeUnmount() {
        this.stopRefreshTimer();
      }
    }
  };
  </script>
  
  <style scoped>
  .dashboard-controls {
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-bottom: 20px;
    overflow: hidden;
  }
  
  .controls-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    background-color: #f8f9fa;
    cursor: pointer;
    border-bottom: 1px solid #e9ecef;
  }
  
  .controls-header h3 {
    margin: 0;
    font-size: 1rem;
    color: #2c3e50;
  }
  
  .toggle-btn {
    background: none;
    border: none;
    font-size: 1rem;
    color: #6c757d;
    cursor: pointer;
  }
  
  .controls-content {
    padding: 15px;
  }
  
  .control-section {
    margin-bottom: 20px;
  }
  
  .control-section:last-child {
    margin-bottom: 0;
  }
  
  .control-section h4 {
    margin: 0 0 10px 0;
    font-size: 0.9rem;
    color: #6c757d;
    font-weight: 500;
  }
  
  .variables-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 10px;
  }
  
  .variable-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px;
    border-radius: 6px;
    background-color: #f8f9fa;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .variable-item:hover {
    background-color: #e9ecef;
  }
  
  .variable-item.active {
    background-color: #e3f2fd;
    border: 1px solid #3498db;
  }
  
  .variable-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    margin-bottom: 5px;
  }
  
  .variable-name {
    font-size: 0.8rem;
    text-align: center;
  }
  
  .visualization-options, .data-refresh-options {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 15px;
  }
  
  .option-group {
    margin-bottom: 10px;
  }
  
  .option-group label {
    display: block;
    font-size: 0.85rem;
    color: #495057;
    margin-bottom: 5px;
  }
  
  .button-group {
    display: flex;
    gap: 5px;
  }
  
  .chart-type-btn {
    flex: 1;
    padding: 6px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    background-color: #f8f9fa;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    cursor: pointer;
  }
  
  .chart-type-btn.active {
    background-color: #3498db;
    color: white;
    border-color: #3498db;
  }
  
  .slider-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .slider-group input {
    flex: 1;
  }
  
  .slider-value {
    font-size: 0.8rem;
    color: #6c757d;
    width: 60px;
  }
  
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 22px;
  }
  
  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .toggle-switch label {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: .4s;
    border-radius: 22px;
  }
  
  .toggle-switch label:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 2px;
    bottom: 2px;
    background-color: white;
    transition: .4s;
    border-radius: 50%;
  }
  
  .toggle-switch input:checked + label {
    background-color: #3498db;
  }
  
  .toggle-switch input:checked + label:before {
    transform: translateX(22px);
  }
  
  .refresh-btn, .export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 4px;
    border: none;
    background-color: #3498db;
    color: white;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .refresh-btn:hover, .export-btn:hover {
    background-color: #2980b9;
  }
  
  .export-options {
    display: flex;
    gap: 10px;
  }
  
  /* Iconos básicos usando caracteres o emojis */
  .icon-variable::before {
    content: '📊';
  }
  
  .icon-line-chart::before {
    content: '📈';
  }
  
  .icon-bar-chart::before {
    content: '📊';
  }
  
  .icon-area-chart::before {
    content: '📉';
  }
  
  .icon-refresh::before {
    content: '🔄';
  }
  
  .icon-file-csv::before {
    content: '📄';
  }
  
  .icon-file-excel::before {
    content: '📑';
  }
  
  .icon-file-code::before {
    content: '📝';
  }
  </style>