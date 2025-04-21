<template>
  <div class="risk-heatmap-container">
    <!-- Leyenda del riesgo -->
    <div 
      class="map-legend risk-legend" 
      :class="{ 'active': visible }"
      v-if="heatmapLayer">
      <div class="legend-title">Nivel de riesgo de escape</div>
      <div class="legend-scale risk-scale">
        <div class="legend-scale-item"></div>
        <div class="legend-scale-item"></div>
        <div class="legend-scale-item"></div>
        <div class="legend-scale-item"></div>
      </div>
      <div class="legend-labels">
        <span>Bajo (0-35%)</span>
        <span>Alto (70-100%)</span>
      </div>
      <div class="legend-info">
        Las áreas coloreadas indican zonas con riesgo de escape
      </div>
    </div>
    
    <!-- Control de animación temporal para el riesgo -->
    <div class="timeline-control" v-if="visible && predictionDays.length > 0">
      <div class="timeline-header">
        <h3>Evolución del riesgo</h3>
        <div class="timeline-buttons">
          <button @click="playPauseTimeline" class="timeline-btn">
            <i :class="isPlaying ? 'pause-icon' : 'play-icon'"></i>
          </button>
          <button @click="resetTimeline" class="timeline-btn">
            <i class="reset-icon"></i>
          </button>
        </div>
      </div>
      <div class="timeline-slider-container">
        <input 
          type="range" 
          class="timeline-slider" 
          min="0" 
          :max="predictionDays.length - 1" 
          v-model="currentIndex"
          @input="onTimelineChange">
        <div class="timeline-date">{{ currentDate }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import L from 'leaflet';

export default {
  name: 'RiskHeatmapComponent',
  props: {
    map: {
      type: Object,
      required: true
    },
    piscifactorias: {
      type: Array,
      default: () => []
    },
    predictionDays: {
      type: Array,
      default: () => []
    },
    visible: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      heatmapLayer: null,
      riskData: [],
      currentIndex: 0,
      isPlaying: false,
      timelineInterval: null
    };
  },
  computed: {
    currentDate() {
      if (this.predictionDays.length === 0) return '';
      const currentDay = this.predictionDays[this.currentIndex];
      if (!currentDay) return '';
      return new Date(currentDay.fecha).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        this.updateHeatmap();
      } else {
        this.clearHeatmap();
        this.stopTimeline();
      }
    },
    piscifactorias() {
      if (this.visible) {
        this.updateHeatmap();
      }
    },
    predictionDays() {
      if (this.predictionDays.length > 0) {
        this.currentIndex = 0;
        if (this.visible) {
          this.updateRiskDataForDay(0);
        }
      }
    }
  },
  mounted() {
    if (this.visible && this.predictionDays.length > 0) {
      this.updateRiskDataForDay(0);
    }
  },
  beforeUnmount() {
    this.clearHeatmap();
    this.stopTimeline();
  },
  methods: {
    updateHeatmap() {
      if (this.predictionDays.length > 0) {
        this.updateRiskDataForDay(this.currentIndex);
      }
    },
    clearHeatmap() {
      if (this.heatmapLayer && this.map.hasLayer(this.heatmapLayer)) {
        this.map.removeLayer(this.heatmapLayer);
      }
      this.heatmapLayer = null;
    },
    updateRiskDataForDay(dayIndex) {
      // Limpiar capa anterior
      this.clearHeatmap();
      
      if (!this.predictionDays[dayIndex]) return;
      
      // Obtener valor de riesgo para este día
      const riskValue = this.predictionDays[dayIndex].indice;
      
      // Crear datos para heatmap basados en las piscifactorías
      this.riskData = this.piscifactorias
        .filter(farm => farm.coordinates && farm.coordinates.length === 2)
        .map(farm => {
          // Variar un poco el riesgo para cada piscifactoría
          const farmRisk = Math.min(10, Math.max(1, riskValue + (Math.random() - 0.5) * 2));
          
          return {
            lat: farm.coordinates[1],
            lng: farm.coordinates[0],
            value: farmRisk,
            farmId: farm.id,
            farmName: farm.name,
            // Conservar la geometría si existe
            area_geometry: farm.area_geometry
          };
        });
      
      // Crear y añadir nueva capa
      this.heatmapLayer = this.createRiskHeatLayer();
      if (this.heatmapLayer && this.visible) {
        this.heatmapLayer.addTo(this.map);
      }
      
      // Emitir evento con los datos actuales
      this.$emit('day-changed', {
        index: dayIndex,
        date: this.currentDate,
        riskValue: riskValue
      });
    },
    createRiskHeatLayer() {
      // Si no hay datos de riesgo o no hay piscifactorías, retornar null
      if (!this.riskData || this.riskData.length === 0 || !this.piscifactorias || this.piscifactorias.length === 0) {
        console.warn("No hay datos de riesgo o piscifactorías para crear el heatmap");
        return null;
      }
      
      // Crear una capa de grupo para contener todas las áreas de calor
      const riskLayerGroup = L.layerGroup();
      
      // Para cada piscifactoría, crear un heatmap limitado a su área
      this.riskData.forEach(farm => {
        // Verificar si tiene coordenadas
        if (!farm.lat || !farm.lng) return;
        
        const centerLat = farm.lat;
        const centerLng = farm.lng;
        const riskValue = farm.value;
        
        // Colores basados en el nivel de riesgo (0-10)
        let heatColor;
        if (riskValue < 3.5) {
          heatColor = 'green'; // Riesgo bajo
        } else if (riskValue < 7) {
          heatColor = 'orange'; // Riesgo medio
        } else {
          heatColor = 'red'; // Riesgo alto
        }
        
        // Radio del área de calor (metros)
        const radius = 500; // Radio de 500m por defecto, ajustar según necesidades
        
        // Si la piscifactoría tiene geometría de área, usar ese polígono
        if (farm.area_geometry) {
          try {
            // Crear el polígono del área
            const geojson = typeof farm.area_geometry === 'string' 
              ? JSON.parse(farm.area_geometry) 
              : farm.area_geometry;
              
            // Crear un círculo de calor que esté limitado al área de la piscifactoría
            const farmArea = L.geoJSON(geojson, {
              style: {
                fillColor: heatColor,
                fillOpacity: 0.5,
                color: heatColor,
                weight: 2,
                opacity: 0.8
              }
            });
            
            // Añadir tooltip con información del riesgo
            farmArea.bindTooltip(`${farm.farmName}: Riesgo ${riskValue.toFixed(1)}/10 (${Math.round(riskValue*10)}%)`, {
              permanent: false,
              direction: 'top',
              className: 'risk-tooltip'
            });
            
            riskLayerGroup.addLayer(farmArea);
          } catch (e) {
            console.warn(`Error al procesar geometría para ${farm.farmName}:`, e);
            // Si hay error con la geometría, usar el método alternativo de círculo
            this.addCircularHeatArea(riskLayerGroup, centerLat, centerLng, radius, riskValue, heatColor, farm.farmName);
          }
        } else {
          // Si no tiene geometría de área, crear un círculo de calor
          this.addCircularHeatArea(riskLayerGroup, centerLat, centerLng, radius, riskValue, heatColor, farm.farmName);
        }
      });
      
      return riskLayerGroup;
    },
    addCircularHeatArea(layerGroup, lat, lng, radius, riskValue, color, farmName) {
      // Crear un círculo con gradiente de calor
      const circle = L.circle([lat, lng], {
        radius: radius,
        color: color,
        fillColor: color,
        fillOpacity: 0.5,
        weight: 2,
        opacity: 0.8
      });
      
      // Añadir tooltip con información del riesgo
      circle.bindTooltip(`${farmName}: Riesgo ${riskValue.toFixed(1)}/10 (${Math.round(riskValue*10)}%)`, {
        permanent: false,
        direction: 'top',
        className: 'risk-tooltip'
      });
      
      layerGroup.addLayer(circle);
      
      // Opcional: Crear puntos de calor dentro del círculo para simular un heatmap
      // Esto puede aumentar la carga de renderizado, por lo que es opcional
      // Se puede descomentar si se desea un efecto más detallado
      /*
      const numPoints = 10; // Número de puntos para simular el heatmap
      const points = [];
      
      for (let i = 0; i < numPoints; i++) {
        // Distribuir puntos aleatoriamente dentro del radio
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * radius * 0.9; // 90% del radio para mantenerlos dentro
        const pointLat = lat + (dist / 111000) * Math.cos(angle); // 111000 metros ≈ 1 grado de latitud
        const pointLng = lng + (dist / (111000 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle);
        
        points.push([pointLat, pointLng, riskValue]);
      }
      
      // Crear heatmap con los puntos generados
      if (points.length > 0) {
        const heatmap = L.heatLayer(points, {
          radius: 25,
          blur: 15,
          maxZoom: 10,
          max: 10,
          minOpacity: 0.4,
          gradient: {
            0.4: 'blue',
            0.6: 'lime',
            0.8: 'orange',
            1.0: 'red'
          }
        });
        
        layerGroup.addLayer(heatmap);
      }
      */
    },
    // Métodos para la línea de tiempo
    playPauseTimeline() {
      if (this.isPlaying) {
        this.stopTimeline();
      } else {
        this.startTimeline();
      }
    },
    startTimeline() {
      if (!this.predictionDays.length) return;
      
      this.isPlaying = true;
      // Avanzar la línea de tiempo cada 1.5 segundos
      this.timelineInterval = setInterval(() => {
        this.currentIndex = (parseInt(this.currentIndex) + 1) % this.predictionDays.length;
        this.updateRiskDataForDay(this.currentIndex);
      }, 1500);
    },
    stopTimeline() {
      if (this.timelineInterval) {
        clearInterval(this.timelineInterval);
        this.timelineInterval = null;
      }
      this.isPlaying = false;
    },
    resetTimeline() {
      this.stopTimeline();
      this.currentIndex = 0;
      this.updateRiskDataForDay(0);
    },
    onTimelineChange() {
      // Detener la reproducción automática si está activa
      if (this.isPlaying) {
        this.stopTimeline();
      }
      
      // Actualizar los datos según el día seleccionado
      const index = parseInt(this.currentIndex);
      this.updateRiskDataForDay(index);
    }
  }
}
</script>

<style scoped>
/* Estilo para el tooltip de riesgo */
:deep(.risk-tooltip) {
  font-size: 12px;
  padding: 5px 10px;
  background-color: rgba(33, 40, 80, 0.9);
  border: 1px solid #4a6bff;
  color: white;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  font-weight: bold;
}

/* Mejora los estilos de la leyenda de riesgo */
.risk-legend {
  width: 220px;
  padding: 12px;
}

.risk-legend .legend-title {
  font-weight: bold;
  font-size: 13px;
  margin-bottom: 8px;
}

.risk-legend .legend-scale {
  height: 25px;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.risk-legend .legend-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: bold;
}

.risk-legend .legend-info {
  font-size: 10px;
  margin-top: 6px;
  font-style: italic;
  text-align: center;
  color: #333;
}

/* Actualizar los estilos para cada nivel de riesgo */
.risk-scale .legend-scale-item:nth-child(1) { 
  background-color: green; 
}
.risk-scale .legend-scale-item:nth-child(2) { 
  background-color: lime; 
}
.risk-scale .legend-scale-item:nth-child(3) { 
  background-color: orange; 
}
.risk-scale .legend-scale-item:nth-child(4) { 
  background-color: red; 
}

/* Timeline control */
.timeline-control {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 500px;
  background-color: rgba(20, 24, 50, 0.9);
  padding: 10px 15px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.timeline-header h3 {
  margin: 0;
  font-size: 0.9rem;
  color: #e9ecef;
  font-weight: normal;
}

.timeline-buttons {
  display: flex;
  gap: 5px;
}

.timeline-btn {
  background-color: #4a6bff;
  color: white;
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

.timeline-slider-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.timeline-slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: #141832;
  outline: none;
  border-radius: 3px;
  margin-bottom: 8px;
}

.timeline-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #4a6bff;
  cursor: pointer;
  border: 2px solid white;
}

.timeline-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #4a6bff;
  cursor: pointer;
  border: 2px solid white;
}

.timeline-date {
  font-size: 0.8rem;
  color: #e9ecef;
  text-align: center;
}

/* Iconos */
.play-icon {
  display: inline-block;
  width: 12px;
  height: 12px;
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>');
  background-size: contain;
  background-repeat: no-repeat;
}

.pause-icon {
  display: inline-block;
  width: 12px;
  height: 12px;
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>');
  background-size: contain;
  background-repeat: no-repeat;
}

.reset-icon {
  display: inline-block;
  width: 12px;
  height: 12px;
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>');
  background-size: contain;
  background-repeat: no-repeat;
}

/* Estilos para leyendas de capas */
.map-legend {
  position: absolute;
  bottom: 20px;
  right: 10px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 10px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  width: 200px;
  display: none; /* Se mostrará cuando se active una capa */
}

.map-legend.active {
  display: block;
}

.legend-scale {
  display: flex;
  height: 20px;
  margin-bottom: 5px;
}

.legend-scale-item {
  flex: 1;
  height: 100%;
}
</style>