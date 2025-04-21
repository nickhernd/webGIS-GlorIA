<template>
    <section class="panel risk-factors-panel">
      <h2>Factores de riesgo</h2>
      <div class="factors-content">
        <div v-if="loading" class="loader-container">
          <div class="loader"></div>
        </div>
        
        <div v-else-if="factors.length === 0" class="no-data-message">
          No hay datos de factores de riesgo disponibles
        </div>
        
        <div v-else class="factors-list">
          <div v-for="(factor, index) in factors" :key="index" class="factor-item">
            <div class="factor-header">
              <div class="factor-name">{{ factor.nombre }}</div>
              <div class="factor-value">{{ factor.valor }} {{ factor.unidad }}</div>
            </div>
            
            <div class="factor-bar-container">
              <div class="factor-bar">
                <div 
                  class="factor-fill" 
                  :style="{ 
                    width: `${calculateBarWidth(factor)}%`,
                    backgroundColor: getBarColor(factor)
                  }"
                ></div>
              </div>
            </div>
            
            <div class="factor-details">
              <div class="factor-contribution">
                Contribución: {{ factor.contribucion }}/10
              </div>
              <div class="factor-threshold">
                Umbral crítico: {{ factor.umbral }} {{ factor.unidad }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </template>
  
  <script>
  export default {
    name: 'RiskFactorsComponent',
    props: {
      factors: {
        type: Array,
        default: () => []
      },
      loading: {
        type: Boolean,
        default: false
      }
    },
    methods: {
      calculateBarWidth(factor) {
        // Calcular el ancho de la barra basado en la relación valor/umbral
        if (!factor.umbral) return 0;
        const percentage = (factor.valor / factor.umbral) * 100;
        return Math.min(100, percentage);
      },
      getBarColor(factor) {
        // Determinar el color basado en la proximidad al umbral
        const percentage = (factor.valor / factor.umbral) * 100;
        
        if (percentage >= 100) {
          return '#e74c3c'; // Rojo para valores por encima del umbral
        } else if (percentage >= 75) {
          return '#f39c12'; // Naranja para valores cercanos al umbral
        } else if (percentage >= 50) {
          return '#f1c40f'; // Amarillo para valores intermedios
        } else {
          return '#2ecc71'; // Verde para valores seguros
        }
      }
    }
  }
  </script>
  
  <style scoped>
  .risk-factors-panel {
    flex: 1;
    margin-top: 15px;
  }
  
  .factors-content {
    flex: 1;
    padding: 15px;
    overflow-y: auto;
  }
  
  .loader-container {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 30px 0;
  }
  
  .loader {
    border: 3px solid #212850;
    border-top: 3px solid #4a6bff;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .no-data-message {
    padding: 30px 0;
    text-align: center;
    color: #a8dadc;
    font-style: italic;
  }
  
  .factors-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .factor-item {
    background-color: #141832;
    border-radius: 6px;
    padding: 12px;
  }
  
  .factor-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  
  .factor-name {
    font-weight: bold;
    color: #e9ecef;
  }
  
  .factor-value {
    color: #a8dadc;
    font-weight: bold;
  }
  
  .factor-bar-container {
    margin-bottom: 10px;
  }
  
  .factor-bar {
    width: 100%;
    height: 8px;
    background-color: #212850;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .factor-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }
  
  .factor-details {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: #a8dadc;
  }
  
  .factor-contribution {
    color: #f39c12;
  }
  
  .factor-threshold {
    font-style: italic;
  }
  </style>