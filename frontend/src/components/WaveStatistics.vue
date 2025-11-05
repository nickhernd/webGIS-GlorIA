<template>
  <section class="card wave-statistics">
    <h2>Estadísticas de Oleaje</h2>

    <div v-if="loading" class="loading">Cargando datos...</div>

    <div v-else-if="stats" class="stats-grid">
      <!-- Altura promedio -->
      <div class="stat-item">
        <div class="stat-header">
          <span class="stat-label">Altura Promedio</span>
          <button @click="showInfo('mean')" class="info-btn" title="Ver cómo se calcula">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        </div>
        <div class="stat-value">{{ stats.mean }} m</div>
        <div class="stat-bar">
          <div class="stat-fill" :style="{ width: getBarWidth(stats.mean, stats.max), backgroundColor: getColor(stats.mean) }"></div>
        </div>
      </div>

      <!-- Altura máxima -->
      <div class="stat-item">
        <div class="stat-header">
          <span class="stat-label">Altura Máxima</span>
          <button @click="showInfo('max')" class="info-btn" title="Ver cómo se calcula">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        </div>
        <div class="stat-value">{{ stats.max }} m</div>
        <div class="stat-bar">
          <div class="stat-fill" :style="{ width: '100%', backgroundColor: getColor(stats.max) }"></div>
        </div>
      </div>

      <!-- Altura mínima -->
      <div class="stat-item">
        <div class="stat-header">
          <span class="stat-label">Altura Mínima</span>
          <button @click="showInfo('min')" class="info-btn" title="Ver cómo se calcula">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        </div>
        <div class="stat-value">{{ stats.min }} m</div>
        <div class="stat-bar">
          <div class="stat-fill" :style="{ width: getBarWidth(stats.min, stats.max), backgroundColor: getColor(stats.min) }"></div>
        </div>
      </div>

      <!-- Mediana -->
      <div class="stat-item">
        <div class="stat-header">
          <span class="stat-label">Mediana</span>
          <button @click="showInfo('median')" class="info-btn" title="Ver cómo se calcula">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        </div>
        <div class="stat-value">{{ stats.median }} m</div>
        <div class="stat-bar">
          <div class="stat-fill" :style="{ width: getBarWidth(stats.median, stats.max), backgroundColor: getColor(stats.median) }"></div>
        </div>
      </div>

      <!-- Desviación estándar -->
      <div class="stat-item">
        <div class="stat-header">
          <span class="stat-label">Desviación Estándar</span>
          <button @click="showInfo('std')" class="info-btn" title="Ver cómo se calcula">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        </div>
        <div class="stat-value">{{ stats.std }} m</div>
        <div class="stat-description">Dispersión de datos</div>
      </div>

      <!-- Percentil 25 -->
      <div class="stat-item">
        <div class="stat-header">
          <span class="stat-label">Percentil 25</span>
          <button @click="showInfo('p25')" class="info-btn" title="Ver cómo se calcula">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        </div>
        <div class="stat-value">{{ stats.percentile_25 }} m</div>
        <div class="stat-description">25% de datos por debajo</div>
      </div>

      <!-- Percentil 75 -->
      <div class="stat-item">
        <div class="stat-header">
          <span class="stat-label">Percentil 75</span>
          <button @click="showInfo('p75')" class="info-btn" title="Ver cómo se calcula">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        </div>
        <div class="stat-value">{{ stats.percentile_75 }} m</div>
        <div class="stat-description">75% de datos por debajo</div>
      </div>

      <!-- Total de puntos -->
      <div class="stat-item full-width">
        <div class="stat-header">
          <span class="stat-label">Total de Mediciones</span>
          <button @click="showInfo('count')" class="info-btn" title="Ver información">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        </div>
        <div class="stat-value large">{{ stats.count.toLocaleString() }}</div>
        <div class="stat-description">puntos de datos analizados</div>
      </div>
    </div>

    <div v-else class="empty-state">
      No hay datos de oleaje disponibles
    </div>

    <!-- Popup de información -->
    <div v-if="showPopup" class="info-popup-overlay" @click="closePopup">
      <div class="info-popup" @click.stop>
        <div class="popup-header">
          <h3>{{ popupContent.title }}</h3>
          <button @click="closePopup" class="close-btn">×</button>
        </div>
        <div class="popup-body">
          <div class="formula-section">
            <h4>Fórmula:</h4>
            <div class="formula">{{ popupContent.formula }}</div>
          </div>
          <div class="explanation-section">
            <h4>Explicación:</h4>
            <p>{{ popupContent.explanation }}</p>
          </div>
          <div class="source-section">
            <h4>Fuente de datos:</h4>
            <p>{{ metadata.source || 'HCMR WAVE-MEDWAM4' }}</p>
            <p class="source-detail">{{ metadata.total_points || stats.count }} puntos del Mediterráneo</p>
            <p class="source-detail">Región: Costa de Alicante (lat: 37.5-40.5°, lon: -1.5-0.7°)</p>
            <p v-if="dateRange" class="source-detail">Período: {{ dateRange }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
export default {
  name: 'WaveStatistics',
  props: {
    statistics: {
      type: Object,
      default: null
    },
    metadata: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      loading: false,
      showPopup: false,
      currentInfo: null,
      infoContent: {
        mean: {
          title: 'Altura Promedio',
          formula: 'μ = (Σx) / n',
          explanation: 'Se calcula sumando todas las alturas de olas medidas y dividiendo por el número total de mediciones. Representa la altura "típica" del oleaje en la región.'
        },
        max: {
          title: 'Altura Máxima',
          formula: 'max(x₁, x₂, ..., xₙ)',
          explanation: 'Es el valor más alto registrado entre todas las mediciones de altura de olas. Indica las condiciones más extremas observadas en el período.'
        },
        min: {
          title: 'Altura Mínima',
          formula: 'min(x₁, x₂, ..., xₙ)',
          explanation: 'Es el valor más bajo registrado entre todas las mediciones de altura de olas. Indica las condiciones más calmadas observadas.'
        },
        median: {
          title: 'Mediana',
          formula: 'x̃ = valor central cuando los datos están ordenados',
          explanation: 'Es el valor que divide los datos en dos mitades iguales. El 50% de las mediciones están por debajo y el 50% por encima. Es más robusta que la media ante valores extremos.'
        },
        std: {
          title: 'Desviación Estándar',
          formula: 'σ = √(Σ(xᵢ - μ)² / n)',
          explanation: 'Mide cuánto se dispersan los datos respecto a la media. Un valor alto indica que las alturas de olas varían mucho; un valor bajo indica que son más uniformes.'
        },
        p25: {
          title: 'Percentil 25 (Q1)',
          formula: 'P₂₅: 25% de los datos son menores',
          explanation: 'El 25% de las mediciones de altura de olas están por debajo de este valor. Es el primer cuartil de la distribución.'
        },
        p75: {
          title: 'Percentil 75 (Q3)',
          formula: 'P₇₅: 75% de los datos son menores',
          explanation: 'El 75% de las mediciones están por debajo de este valor. Es el tercer cuartil. La diferencia P₇₅ - P₂₅ se llama rango intercuartílico.'
        },
        count: {
          title: 'Total de Mediciones',
          formula: 'n = número total de puntos de datos',
          explanation: 'Es el número total de mediciones de altura de olas analizadas. Un mayor número de mediciones proporciona estadísticas más confiables.'
        }
      }
    };
  },
  computed: {
    stats() {
      return this.statistics;
    },
    popupContent() {
      return this.currentInfo ? this.infoContent[this.currentInfo] : {};
    },
    dateRange() {
      if (!this.metadata.extracted_at) return null;
      // Extraer rango de fechas si está disponible
      return 'Año 2025';
    }
  },
  methods: {
    getColor(value) {
      if (value < 1.0) return '#10b981'; // Verde
      if (value < 2.2) return '#fbbf24'; // Amarillo
      if (value < 4.0) return '#f97316'; // Naranja
      if (value < 6.0) return '#ef4444'; // Rojo
      return '#000000'; // Negro
    },
    getBarWidth(value, max) {
      return `${(value / max) * 100}%`;
    },
    showInfo(statType) {
      this.currentInfo = statType;
      this.showPopup = true;
    },
    closePopup() {
      this.showPopup = false;
      this.currentInfo = null;
    }
  }
};
</script>

<style scoped>
.wave-statistics {
  margin-bottom: 1rem;
}

h2 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #1f2937;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #9ca3af;
  font-size: 0.875rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.stat-item {
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}

.stat-item.full-width {
  grid-column: 1 / -1;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
}

.stat-item.full-width .stat-label,
.stat-item.full-width .stat-value,
.stat-item.full-width .stat-description {
  color: white;
}

.stat-item.full-width .info-btn {
  color: white;
  border-color: rgba(255, 255, 255, 0.3);
}

.stat-item.full-width .info-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.info-btn {
  background: none;
  border: 1px solid #e5e7eb;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;
  padding: 0;
}

.info-btn:hover {
  background: #f3f4f6;
  color: #3b82f6;
  border-color: #3b82f6;
  transform: scale(1.1);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.stat-value.large {
  font-size: 2rem;
}

.stat-description {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.stat-bar {
  width: 100%;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 0.5rem;
}

.stat-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* Popup styles */
.info-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.info-popup {
  background: white;
  border-radius: 0.75rem;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.popup-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  line-height: 1;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #1f2937;
}

.popup-body {
  padding: 1.5rem;
}

.formula-section,
.explanation-section,
.source-section {
  margin-bottom: 1.5rem;
}

.formula-section:last-child,
.explanation-section:last-child,
.source-section:last-child {
  margin-bottom: 0;
}

.formula-section h4,
.explanation-section h4,
.source-section h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.5rem 0;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.formula {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
  font-family: 'Courier New', monospace;
  font-size: 1.125rem;
  color: #1f2937;
  text-align: center;
}

.explanation-section p {
  color: #4b5563;
  line-height: 1.6;
  margin: 0;
}

.source-section p {
  color: #4b5563;
  margin: 0.25rem 0;
}

.source-detail {
  font-size: 0.875rem;
  color: #6b7280;
}
</style>
