<!-- frontend/src/components/LeafletMap.vue -->
<template>
  <div class="map-container">
    <div id="map" ref="mapContainer" class="map"></div>
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
    </div>
  </div>
</template>

<script>
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useStore } from 'vuex';

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
    }
  },
  setup(props, { emit }) {
    const mapContainer = ref(null);
    const map = ref(null);
    const markers = ref([]);
    const heatLayer = ref(null);
    const loading = ref(true);
    const store = useStore();
    const fishFarms = ref([]);

    // Lista de piscifactorías en la Comunidad Valenciana y Murcia
    const piscifactorias = [
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
    ];

    // Función para inicializar el mapa
    const initMap = () => {
      if (mapContainer.value) {
        // Crear mapa centrado en la Comunidad Valenciana/Murcia
        map.value = L.map('map').setView([38.8, -0.8], 8);
        
        // Añadir capa base de OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 18
        }).addTo(map.value);
        
        // Añadir marcadores para las piscifactorías
        addFishFarmMarkers();

        // Establecer límites del mapa a la región de Valencia y Murcia
        const bounds = L.latLngBounds(
          L.latLng(40.2, -1.8),  // Esquina noroeste (aprox.)
          L.latLng(37.2, 0.2)    // Esquina sureste (aprox.)
        );
        map.value.setMaxBounds(bounds);
        map.value.on('dragend', () => {
          if (!map.value.getBounds().intersects(bounds)) {
            map.value.panInsideBounds(bounds, { animate: false });
          }
        });

        // Cargar datos ambientales
        loadEnvironmentalData();
      }
    };

    // Función para añadir marcadores de piscifactorías
    const addFishFarmMarkers = () => {
      markers.value = [];
      
      piscifactorias.forEach(farm => {
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
        
        markers.value.push(marker);
        
        // Añadir al array de fishFarms para referencia
        fishFarms.value.push(farm);
      });
      
      // Definir método global para ser accesible desde el popup
      window.selectFishFarm = (id) => {
        emit('farm-selected', id);
      };
    };

    // Función para cargar datos ambientales basados en fecha y variable seleccionada
    const loadEnvironmentalData = () => {
      loading.value = true;
      
      // Simulación de obtención de datos
      setTimeout(() => {
        // Añadir capa de calor para visualizar datos ambientales
        if (props.selectedVariable === 'temperature') {
          addTemperatureLayer();
        } else if (props.selectedVariable === 'currents') {
          addCurrentsLayer();
        } else if (props.selectedVariable === 'salinity') {
          addSalinityLayer();
        }
        
        loading.value = false;
      }, 1000);
    };
    
    // Funciones para añadir capas de datos ambientales
    const addTemperatureLayer = () => {
      // Limpiar capa anterior si existe
      if (heatLayer.value) {
        map.value.removeLayer(heatLayer.value);
      }
      
      // Datos de temperatura simulados para esta demostración
      const points = [];
      for (let lat = 37.2; lat <= 40.2; lat += 0.2) {
        for (let lng = -1.8; lng <= 0.2; lng += 0.2) {
          // Generar valores más altos cerca de la costa
          const coastDistance = Math.min(Math.abs(lng + 0.3), 0.8);
          const intensity = Math.max(0, 0.7 - coastDistance) * 900;
          if (intensity > 0) {
            points.push([lat, lng, intensity]);
          }
        }
      }
      
      // Crear capa de calor
      heatLayer.value = L.heatLayer(points, {
        radius: 25,
        blur: 15,
        maxZoom: 10,
        gradient: {0.4: 'blue', 0.6: 'cyan', 0.7: 'lime', 0.8: 'yellow', 1.0: 'red'}
      }).addTo(map.value);
    };
    
    const addCurrentsLayer = () => {
      // Similar a la capa de temperatura pero con otros colores
      if (heatLayer.value) {
        map.value.removeLayer(heatLayer.value);
      }
      
      // Datos simulados para corrientes
      const points = [];
      for (let lat = 37.2; lat <= 40.2; lat += 0.2) {
        for (let lng = -1.8; lng <= 0.2; lng += 0.2) {
          if (lng < -0.2) { // Más intensidad en mar abierto
            const intensity = Math.max(0, (-lng - 0.2) * 500);
            if (intensity > 0) {
              points.push([lat, lng, intensity]);
            }
          }
        }
      }
      
      heatLayer.value = L.heatLayer(points, {
        radius: 25,
        blur: 15,
        maxZoom: 10,
        gradient: {0.4: 'green', 0.6: 'yellow', 0.8: 'orange', 1.0: 'red'}
      }).addTo(map.value);
    };
    
    const addSalinityLayer = () => {
      // Similar a las anteriores con otros patrones
      if (heatLayer.value) {
        map.value.removeLayer(heatLayer.value);
      }
      
      const points = [];
      for (let lat = 37.2; lat <= 40.2; lat += 0.2) {
        for (let lng = -1.8; lng <= 0.2; lng += 0.2) {
          const coastProximity = Math.min(Math.abs(lat - 39), 1) * 700;
          if (coastProximity > 0) {
            points.push([lat, lng, coastProximity]);
          }
        }
      }
      
      heatLayer.value = L.heatLayer(points, {
        radius: 25,
        blur: 15,
        maxZoom: 10,
        gradient: {0.4: 'purple', 0.6: 'blue', 0.8: 'cyan', 1.0: 'white'}
      }).addTo(map.value);
    };

    // Observar cambios en props para actualizar el mapa
    watch(() => props.selectedDate, () => {
      loadEnvironmentalData();
    });
    
    watch(() => props.selectedVariable, () => {
      loadEnvironmentalData();
    });

    // Inicializar mapa al montar el componente
    onMounted(() => {
      initMap();
    });

    // Limpiar recursos al desmontar
    onUnmounted(() => {
      if (map.value) {
        map.value.remove();
      }
      delete window.selectFishFarm;
    });

    return {
      mapContainer,
      loading,
      fishFarms
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
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #3498db;
  border: 2px solid white;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
  transition: all 0.3s;
}

:deep(.marker-icon:hover) {
  transform: scale(1.2);
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
</style>