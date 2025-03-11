<template>
  <div class="map-container">
    <div id="map" ref="mapContainer" class="map"></div>
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
    </div>
    
    <div v-if="errorMessage" class="error-message">
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <span>{{ errorMessage }}</span>
      </div>
    </div>
    
    <div class="map-controls" v-if="showControls">
      <div class="opacity-control">
        <label>Opacidad del mapa de calor: {{ heatmapOpacity }}%</label>
        <input 
          type="range" 
          min="10" 
          max="100" 
          v-model="heatmapOpacity" 
          @input="updateHeatmapOpacity"
          class="opacity-slider"
        >
      </div>
      <div class="timeline-controls">
        <button class="control-btn" @click="playAnimation" :disabled="isPlaying">
          <span v-if="isPlaying">▌▌</span>
          <span v-else>▶</span>
        </button>
        <input 
          type="range" 
          class="time-slider" 
          :min="0" 
          :max="timelineData.length - 1" 
          v-model="currentTimeIndex"
          @input="updateTimeDisplay"
        >
        <div class="time-display">{{ currentTimeDisplay }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ref, onMounted, onUnmounted, watch } from 'vue';
import DataService from '../services/DataService';

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

export default {
  name: 'LeafletMap',
  props: {
    selectedDate: {
      type: Date,
      default: () => new Date()
    },
    selectedVariable: {
      type: String,
      default: 'temperature'
    },
    selectedFarmId: {
      type: Number,
      default: null
    },
    maxDate: {
      type: Date,
      default: () => new Date()
    }
  },
  emits: ['farm-selected', 'error'],
  
  setup(props, { emit }) {
    const mapContainer = ref(null);
    const map = ref(null);
    const markerLayers = ref({});
    const heatLayer = ref(null);
    const customLayer = ref(null);
    const loading = ref(true);
    const piscifactorias = ref([]);
    const errorMessage = ref('');
    
    // Estado para controles
    const showControls = ref(false);
    const isPlaying = ref(false);
    const currentTimeIndex = ref(0);
    const timelineData = ref([]);
    const animationInterval = ref(null);
    const currentTimeDisplay = ref('');
    const heatmapOpacity = ref(60);
    
    // Mostrar mensaje de error
    const showError = (message) => {
      errorMessage.value = message;
      setTimeout(() => {
        errorMessage.value = '';
      }, 5000);
    };
    
    // Función para inicializar el mapa
    const initMap = async () => {
      if (mapContainer.value) {
        try {
          // Crear mapa centrado en la Comunidad Valenciana/Murcia
          map.value = L.map('map').setView([38.8, -0.8], 8);
          
          // Añadir capa base de OpenStreetMap
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18
          }).addTo(map.value);
          
          // Crear capa personalizada para visualizaciones
          customLayer.value = L.layerGroup().addTo(map.value);
          
          // Evento de zoom para actualizar visualización
          map.value.on('zoomend', updateVisualizationForZoom);
          
          // Cargar piscifactorías
          await loadFishFarms();
          
          // Establecer límites del mapa
          const bounds = L.latLngBounds(
            L.latLng(40.2, -1.8),
            L.latLng(37.2, 0.2)
          );
          map.value.setMaxBounds(bounds);
          map.value.on('dragend', () => {
            if (!map.value.getBounds().intersects(bounds)) {
              map.value.panInsideBounds(bounds, { animate: false });
            }
          });

          // Cargar datos ambientales
          await loadEnvironmentalData();
          
          // Cargar datos de línea de tiempo
          await loadTimelineData();
          
          // Añadir control de opacidad
          addOpacityControl();
        } catch (error) {
          console.error('Error al inicializar el mapa:', error);
          showError('Error al inicializar el mapa. Intente de nuevo más tarde.');
        } finally {
          loading.value = false;
        }
      }
    };

    // Función para cargar piscifactorías
    const loadFishFarms = async () => {
      try {
        loading.value = true;
        const response = await DataService.getPiscifactorias();

        if (response.data && response.data.length > 0) {
          piscifactorias.value = response.data;
          addFishFarmMarkers();
        } else {
          throw new Error('No hay datos de piscifactorías disponibles');
        }
      } catch (error) {
        console.error('Error al cargar piscifactorías:', error);
        showError('No se pudieron cargar los datos de piscifactorías');
        emit('error', 'No se pudieron cargar los datos de piscifactorías');
      } finally {
        loading.value = false;
      }
    };

    // Función para añadir marcadores de piscifactorías
    const addFishFarmMarkers = () => {
      // Limpiar marcadores existentes
      if (Object.keys(markerLayers.value).length > 0) {
        Object.values(markerLayers.value).forEach(marker => {
          if (map.value) map.value.removeLayer(marker);
        });
        markerLayers.value = {};
      }
      
      piscifactorias.value.forEach(farm => {
        const customIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div class="marker-icon fish-farm" data-id="${farm.id}"></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });
        
        const marker = L.marker(farm.coordinates, { icon: customIcon })
          .addTo(map.value)
          .bindPopup(`
            <div class="popup-content">
              <h3>${farm.name}</h3>
              <p><strong>Ubicación:</strong> ${farm.location}</p>
              <p><strong>Tipo:</strong> ${farm.type}</p>
              <p><strong>Especies:</strong> ${farm.species.join(', ')}</p>
              <p>${farm.description}</p>
              <button class="popup-btn" onclick="window.selectFishFarm(${farm.id})">Ver detalles</button>
            </div>
          `);
        
        markerLayers.value[farm.id] = marker;
        
        // Evento de clic
        marker.on('click', () => {
          highlightFishFarm(farm.id);
          emit('farm-selected', farm.id);
        });
      });
      
      // Método global para popup
      window.selectFishFarm = (id) => {
        highlightFishFarm(id);
        emit('farm-selected', id);
      };
      
      // Resaltar si hay selección
      if (props.selectedFarmId) {
        highlightFishFarm(props.selectedFarmId);
      }
    };

    // Función para cargar datos ambientales
    const loadEnvironmentalData = async () => {
      loading.value = true;

      try {
        const dateStr = props.selectedDate.toISOString().split('T')[0];
        const response = await DataService.getDatosAmbientales({ 
          fecha: dateStr, 
          variable: props.selectedVariable 
        });

        if (response.data && response.data.datos && response.data.datos.length > 0) {
          createCustomVisualization(response.data.datos);
        } else {
          throw new Error('No hay datos ambientales disponibles');
        }
      } catch (error) {
        console.error('Error al cargar datos ambientales:', error);
        clearLayers();
        showError(`No se pudieron cargar los datos ambientales para ${props.selectedVariable}`);
        emit('error', `No se pudieron cargar los datos ambientales para ${props.selectedVariable}`);
      } finally {
        loading.value = false;
      }
    };
    
    // Limpiar todas las capas
    const clearLayers = () => {
      if (customLayer.value) {
        customLayer.value.clearLayers();
      }
      if (heatLayer.value && map.value) {
        map.value.removeLayer(heatLayer.value);
        heatLayer.value = null;
      }
    };
    
    // Crear visualización personalizada
    const createCustomVisualization = (points) => {
      // Limpiar capas existentes
      clearLayers();
      
      // Calcular áreas de influencia alrededor de las piscifactorías
      const farmPoints = piscifactorias.value.map(farm => ({
        lat: farm.coordinates[0],
        lng: farm.coordinates[1],
        id: farm.id
      }));
      
      // Filtrar puntos para mantener solo los cercanos a piscifactorías (máx 10km)
      const relevantPoints = points.filter(point => {
        // Verificar si el punto está cerca de alguna piscifactoría
        return farmPoints.some(farm => {
          const distance = L.latLng(point.lat, point.lng).distanceTo(L.latLng(farm.lat, farm.lng));
          return distance < 10000; // 10km
        });
      });
      
      // Si no hay puntos relevantes, salir
      if (relevantPoints.length === 0) {
        showError('No hay datos ambientales cercanos a las piscifactorías');
        return;
      }
      
      // Crear capa de datos interpolada alrededor de piscifactorías
      const currentZoom = map.value.getZoom();
      const cellSize = 200 / Math.pow(1.2, currentZoom - 8); // Ajustar tamaño según zoom
      
      // Para cada piscifactoría, crear una malla alrededor
      farmPoints.forEach(farm => {
        const farmLatLng = L.latLng(farm.lat, farm.lng);
        const radius = 5000; // 5km de radio
        
        // Calcular una malla de puntos en la región
        const latStep = 0.01 * (cellSize / 100);
        const lngStep = 0.015 * (cellSize / 100);
        
        // Centro de la piscifactoría
        const centerLat = farm.lat;
        const centerLng = farm.lng;
        
        // Crear malla
        for (let lat = centerLat - 0.05; lat <= centerLat + 0.05; lat += latStep) {
          for (let lng = centerLng - 0.075; lng <= centerLng + 0.075; lng += lngStep) {
            const cellCenter = L.latLng(lat, lng);
            const distance = farmLatLng.distanceTo(cellCenter);
            
            // Solo considerar puntos dentro del radio
            if (distance <= radius) {
              // Buscar puntos cercanos para interpolar
              let weightedSum = 0;
              let weightSum = 0;
              let hasValues = false;
              
              relevantPoints.forEach(point => {
                const pointLatLng = L.latLng(point.lat, point.lng);
                const dist = cellCenter.distanceTo(pointLatLng);
                
                if (dist < 8000) { // Solo puntos a menos de 8km
                  // Ponderación inversa al cuadrado de la distancia
                  const weight = 1 / Math.max(dist * dist, 100);
                  weightedSum += point.valor * weight;
                  weightSum += weight;
                  hasValues = true;
                }
              });
              
              // Si hay valores para interpolar
              if (hasValues && weightSum > 0) {
                const interpolatedValue = weightedSum / weightSum;
                
                // Crear rectángulo con valor interpolado
                const rect = L.rectangle(
                  [
                    [lat - latStep/2, lng - lngStep/2],
                    [lat + latStep/2, lng + lngStep/2]
                  ],
                  {
                    color: 'transparent',
                    fillColor: getColorForValue(interpolatedValue, props.selectedVariable),
                    fillOpacity: Math.min(0.7 * (heatmapOpacity.value / 100), 0.8),
                    weight: 0
                  }
                );
                
                rect.addTo(customLayer.value);
              }
            }
          }
        }
      });
    };
    
    // Obtener color según valor
    const getColorForValue = (value, variable) => {
      // Normalizar valor según variable
      const normalRange = getNormalizedRange(variable);
      let normalizedValue = (value - normalRange.min) / (normalRange.max - normalRange.min);
      normalizedValue = Math.max(0, Math.min(1, normalizedValue));
      
      // Obtener color desde gradiente
      const gradient = getGradientByVariable(variable);
      const stops = Object.keys(gradient).map(Number).sort((a, b) => a - b);
      
      // Encontrar colores para interpolar
      for (let i = 0; i < stops.length - 1; i++) {
        if (normalizedValue >= stops[i] && normalizedValue <= stops[i+1]) {
          const ratio = (normalizedValue - stops[i]) / (stops[i+1] - stops[i]);
          return interpolateColor(gradient[stops[i]], gradient[stops[i+1]], ratio);
        }
      }
      
      // Valor por defecto (último color)
      return gradient[stops[stops.length - 1]];
    };
    
    // Rango normal para cada variable
    const getNormalizedRange = (variable) => {
      const ranges = {
        temperature: { min: 18, max: 28 },
        oxygen: { min: 4, max: 12 },
        salinity: { min: 34, max: 38 },
        currents: { min: 0, max: 1.2 },
        nutrientes: { min: 0, max: 20 },
        nppv: { min: 0, max: 30 }
      };
      return ranges[variable] || { min: 0, max: 100 };
    };
    
    // Gradiente de colores por variable
    const getGradientByVariable = (variable) => {
      const gradients = {
        temperature: {0.0: 'rgba(0, 0, 255, 0.7)', 0.3: 'rgba(0, 255, 255, 0.7)', 0.5: 'rgba(0, 255, 0, 0.7)', 0.7: 'rgba(255, 255, 0, 0.7)', 1.0: 'rgba(255, 0, 0, 0.7)'},
        oxygen: {0.0: 'rgba(255, 0, 0, 0.7)', 0.3: 'rgba(255, 165, 0, 0.7)', 0.6: 'rgba(255, 255, 0, 0.7)', 1.0: 'rgba(0, 255, 0, 0.7)'},
        salinity: {0.0: 'rgba(128, 0, 128, 0.7)', 0.3: 'rgba(0, 0, 255, 0.7)', 0.6: 'rgba(0, 255, 255, 0.7)', 1.0: 'rgba(255, 255, 255, 0.7)'},
        currents: {0.0: 'rgba(0, 128, 0, 0.7)', 0.3: 'rgba(255, 255, 0, 0.7)', 0.6: 'rgba(255, 165, 0, 0.7)', 1.0: 'rgba(255, 0, 0, 0.7)'},
        nutrientes: {0.0: 'rgba(0, 128, 0, 0.7)', 0.3: 'rgba(144, 238, 144, 0.7)', 0.6: 'rgba(255, 255, 0, 0.7)', 1.0: 'rgba(255, 0, 0, 0.7)'},
        nppv: {0.0: 'rgba(0, 100, 0, 0.7)', 0.3: 'rgba(50, 205, 50, 0.7)', 0.6: 'rgba(173, 255, 47, 0.7)', 1.0: 'rgba(255, 215, 0, 0.7)'}
      };
      return gradients[variable] || {0.0: 'rgba(0, 0, 255, 0.7)', 0.3: 'rgba(0, 255, 255, 0.7)', 0.6: 'rgba(255, 255, 0, 0.7)', 1.0: 'rgba(255, 0, 0, 0.7)'};
    };
    
    // Interpolar entre dos colores
    const interpolateColor = (color1, color2, ratio) => {
      const c1 = parseRGBA(color1);
      const c2 = parseRGBA(color2);
      
      const r = Math.round(c1.r + ratio * (c2.r - c1.r));
      const g = Math.round(c1.g + ratio * (c2.g - c1.g));
      const b = Math.round(c1.b + ratio * (c2.b - c1.b));
      const a = c1.a + ratio * (c2.a - c1.a);
      
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    };
    
    // Parsear color RGBA
    const parseRGBA = (rgba) => {
      const match = rgba.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
      return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
        a: match[4] ? parseFloat(match[4]) : 1
      };
    };
    
    // Actualizar visualización al cambiar zoom
    const updateVisualizationForZoom = () => {
      if (customLayer.value && customLayer.value.getLayers().length > 0) {
        // Recargar visualización con el nuevo nivel de zoom
        loadEnvironmentalData();
      }
    };
    
    // Resaltar piscifactoría
    const highlightFishFarm = (id) => {
      Object.keys(markerLayers.value).forEach(farmId => {
        const marker = markerLayers.value[farmId];
        const icon = marker.getElement()?.querySelector('.marker-icon');
        if (icon) {
          icon.classList.remove('selected');
        }
      });
      
      const selectedMarker = markerLayers.value[id];
      if (selectedMarker) {
        const icon = selectedMarker.getElement()?.querySelector('.marker-icon');
        if (icon) {
          icon.classList.add('selected');
        }
        
        // Centrar en piscifactoría
        const farm = piscifactorias.value.find(f => f.id === id);
        if (farm && map.value) {
          // Calcular el zoom adecuado basado en el área de la piscifactoría
          const currentZoom = map.value.getZoom();
          const targetZoom = Math.max(currentZoom, 12); // Mínimo zoom 12 para ver detalles

          map.value.flyTo(farm.coordinates, targetZoom, {
            animate: true,
            duration: 0.8
          });
        }
      }
    };
    
    // Control de opacidad
    const addOpacityControl = () => {
      if (!map.value) return;
      
      const OpacityControl = L.Control.extend({
        options: {
          position: 'bottomleft'
        },
        onAdd: function() {
          const container = L.DomUtil.create('div', 'custom-control leaflet-bar');
          container.innerHTML = `
            <div style="background: white; padding: 8px; border-radius: 4px; box-shadow: 0 1px 5px rgba(0,0,0,0.2);">
              <div style="margin-bottom: 5px; font-size: 12px;">Opacidad del mapa de calor</div>
              <input type="range" min="10" max="100" value="${heatmapOpacity.value}" 
                     style="width: 180px; height: 10px;" id="heatmap-opacity-slider">
              <div style="text-align: center; font-size: 10px; margin-top: 3px;">${heatmapOpacity.value}%</div>
            </div>
          `;
          
          // Evitar propagación de eventos
          L.DomEvent.disableClickPropagation(container);
          
          // Evento del slider
          const slider = container.querySelector('input');
          const valueDisplay = container.querySelector('div:last-child');
          
          slider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            heatmapOpacity.value = value;
            valueDisplay.textContent = `${value}%`;
            updateHeatmapOpacity();
          });
          
          return container;
        }
      });
      
      // Añadir control al mapa
      map.value.addControl(new OpacityControl());
    };
    
    // Actualizar opacidad
    const updateHeatmapOpacity = () => {
      if (customLayer.value && customLayer.value.getLayers().length > 0) {
        const opacity = Math.min(0.7 * (heatmapOpacity.value / 100), 0.8);
        
        // Actualizar opacidad de cada rectángulo
        customLayer.value.eachLayer(layer => {
          if (layer.setStyle) {
            layer.setStyle({ fillOpacity: opacity });
          }
        });
      }
    };
    
    // Cargar datos para línea de tiempo
    const loadTimelineData = async () => {
      try {
        const response = await DataService.getDatosHistoricos(props.selectedVariable, {
          periodo: 'week'
        });
        
        if (response.data && response.data.datos && response.data.datos.length > 0) {
          timelineData.value = response.data.datos;
          currentTimeIndex.value = 0;
          updateTimeDisplay();
          showControls.value = true;
        } else {
          throw new Error('No hay datos históricos disponibles');
        }
      } catch (error) {
        console.error('Error al cargar datos históricos:', error);
        showControls.value = false;
        showError(`No se pudieron cargar los datos históricos para ${props.selectedVariable}`);
      }
    };
    
    // Actualizar visualización del tiempo
    const updateTimeDisplay = () => {
      if (timelineData.value.length > 0 && currentTimeIndex.value < timelineData.value.length) {
        const timeData = timelineData.value[currentTimeIndex.value];
        if (timeData && timeData.fecha) {
          const date = new Date(timeData.fecha);
          
          // Formatear fecha
          const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          };
          currentTimeDisplay.value = date.toLocaleDateString('es-ES', options);
          
          // Actualizar visualización temporal
          updateVisualizationForTime(date);
        }
      }
    };
    
    // Actualizar visualización para momento específico
    const updateVisualizationForTime = async (date) => {
      try {
        const dateStr = date.toISOString().split('T')[0];
        
        const response = await DataService.getDatosAmbientales({ 
          fecha: dateStr, 
          variable: props.selectedVariable,
          hora: date.getHours()
        });
        
        if (response.data && response.data.datos && response.data.datos.length > 0) {
          createCustomVisualization(response.data.datos);
        }
      } catch (error) {
        console.error('Error al actualizar datos temporales:', error);
      }
    };
    
    // Reproducir animación temporal
    const playAnimation = () => {
      if (isPlaying.value) {
        stopAnimation();
      } else {
        isPlaying.value = true;
        animationInterval.value = setInterval(() => {
          currentTimeIndex.value = (parseInt(currentTimeIndex.value) + 1) % timelineData.value.length;
          updateTimeDisplay();
        }, 1500);
      }
    };
    
    // Detener animación
    const stopAnimation = () => {
      if (animationInterval.value) {
        clearInterval(animationInterval.value);
        animationInterval.value = null;
      }
      isPlaying.value = false;
    };

    // Observar cambios en props
    watch(() => props.selectedDate, () => {
      loadEnvironmentalData();
    });
    
    watch(() => props.selectedVariable, () => {
      loadEnvironmentalData();
      loadTimelineData();
    });
    
    watch(() => props.selectedFarmId, (newId) => {
      if (newId) {
        highlightFishFarm(newId);
      }
    });

    // Ciclo de vida
    onMounted(() => {
      initMap();
    });

    onUnmounted(() => {
      if (map.value) {
        map.value.remove();
      }
      delete window.selectFishFarm;
      
      if (animationInterval.value) {
        clearInterval(animationInterval.value);
      }
    });

    return {
      mapContainer,
      loading,
      errorMessage,
      highlightFishFarm,
      showControls,
      isPlaying,
      currentTimeIndex,
      timelineData,
      currentTimeDisplay,
      playAnimation,
      updateTimeDisplay,
      heatmapOpacity,
      updateHeatmapOpacity
    };
  }
};
</script>

<style scoped>
.map-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 500px;
}

.map {
  width: 100%;
  height: 100%;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.5);
  z-index: 1000;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  animation: spin 2s linear infinite;
}

.error-message {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #f8d7da;
  color: #721c24;
  padding: 10px 15px;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 2000;
  max-width: 80%;
  text-align: center;
}

.error-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-icon {
  font-size: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Estilos para marcadores */
:deep(.custom-marker) {
  display: flex;
  justify-content: center;
  align-items: center;
}

:deep(.marker-icon) {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background-color: #3498db;
  border: 3px solid white;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.6);
  transition: all 0.3s;
}

:deep(.marker-icon:hover) {
  transform: scale(1.2);
}

:deep(.marker-icon.selected) {
  width: 26px;
  height: 26px;
  background-color: #e74c3c;
  border: 3px solid white;
  box-shadow: 0 0 12px rgba(231, 76, 60, 0.9);
  transform: scale(1.3);
  z-index: 1000;
}

:deep(.popup-content) {
  padding: 5px;
  max-width: 250px;
}

:deep(.popup-content h3) {
  margin-top: 0;
  color: #2c3e50;
  font-size: 16px;
}

:deep(.popup-btn) {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 3px;
  cursor: pointer;
  margin-top: 5px;
}

:deep(.popup-btn:hover) {
  background-color: #2980b9;
}

/* Controles de línea de tiempo */
.map-controls {
  position: absolute;
  bottom: 25px;
  left: 50%;
  transform: translateX(-50%);
  width: 85%;
  background-color: rgba(255, 255, 255, 0.85);
  border-radius: 10px;
  padding: 12px;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.opacity-control {
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.opacity-control label {
  display: block;
  margin-bottom: 5px;
  font-size: 12px;
  color: #333;
}

.opacity-slider {
  width: 100%;
  height: 8px;
  -webkit-appearance: none;
  appearance: none;
  background: #e0e0e0;
  outline: none;
  border-radius: 5px;
}

.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3498db;
  cursor: pointer;
}

.opacity-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3498db;
  cursor: pointer;
  border: none;
}

.timeline-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.control-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background-color: #3498db;
  color: white;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 16px;
  transition: background-color 0.2s;
}

.control-btn:hover {
  background-color: #2980b9;
}

.control-btn:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

.time-slider {
  flex: 1;
  height: 10px;
  -webkit-appearance: none;
  appearance: none;
  background: #e0e0e0;
  outline: none;
  border-radius: 5px;
}

.time-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #3498db;
  cursor: pointer;
}

.time-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #3498db;
  cursor: pointer;
  border: none;
}

.time-display {
  font-size: 12px;
  color: #333;
  min-width: 150px;
  text-align: center;
  background-color: white;
  padding: 5px 8px;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Control personalizado para Leaflet */
:deep(.custom-control) {
  background: none;
  border: none;
}

:deep(.custom-control input) {
  cursor: pointer;
}

/* Estilos responsivos */
@media (max-width: 768px) {
  .map-controls {
    width: 95%;
    padding: 8px;
  }
  
  .timeline-controls {
    flex-direction: column;
    gap: 5px;
  }
  
  .time-display {
    min-width: auto;
    width: 100%;
  }
}
</style>