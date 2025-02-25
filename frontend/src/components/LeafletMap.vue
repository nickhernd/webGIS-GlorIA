<!-- src/components/LeafletMap.vue -->
<template>
    <div class="map-container">
      <div id="map" style="width: 100%; height: 100%;"></div>
      
      <!-- Leyenda de la capa seleccionada -->
      <div class="legend" v-if="selectedLayer">
        <h4>{{ selectedLayer.title }}</h4>
        <div class="gradient" :style="getGradientStyle(selectedLayer.id)"></div>
        <div class="labels">
          <span>{{ selectedLayer.min }}{{ selectedLayer.unit }}</span>
          <span>{{ selectedLayer.max }}{{ selectedLayer.unit }}</span>
        </div>
      </div>
    </div>
  </template>
  
  <script>
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  
  export default {
    name: 'LeafletMap',
    props: {
      selectedLayer: {
        type: Object,
        default: null
      },
      selectedDate: {
        type: String,
        default: null
      },
      selectedDepth: {
        type: [Number, String],
        default: -0.5
      }
    },
    data() {
      return {
        map: null,
        baseLayers: {},
        dataLayers: {},
        farmMarkers: [],
        legend: null,
        heatmap: null
      };
    },
    watch: {
      selectedLayer(newLayer) {
        if (newLayer && this.map) {
          this.updateDataLayer();
        }
      },
      selectedDate() {
        if (this.selectedLayer && this.map) {
          this.updateDataLayer();
        }
      },
      selectedDepth() {
        if (this.selectedLayer && this.map) {
          this.updateDataLayer();
        }
      }
    },
    mounted() {
      console.log('Inicializando mapa Leaflet');
      this.initMap();
    },
    methods: {
      initMap() {
        // Crear el mapa centrado en la Comunidad Valenciana
        this.map = L.map('map', {
          center: [38.5, -0.5], // Centrado entre Valencia y Murcia
          zoom: 8,
          minZoom: 6,  // Limitar el zoom mínimo
          maxZoom: 12  // Limitar el zoom máximo
        });
  
        // Añadir capa base oscura
        const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19
        });
  
        // Añadir capa base de satélite
        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        });
  
        // Almacenar capas base
        this.baseLayers = {
          "Oscuro": darkLayer,
          "Satélite": satelliteLayer
        };
  
        // Añadir capa por defecto
        darkLayer.addTo(this.map);
        
        // Añadir control de capas
        L.control.layers(this.baseLayers, {}).addTo(this.map);
  
        // Añadir control de escala
        L.control.scale({imperial: false}).addTo(this.map);
        
        // Añadir marcadores de piscifactorías
        this.addFishFarmMarkers();
        
        console.log('Mapa Leaflet inicializado correctamente');
      },
      
      addFishFarmMarkers() {
        // Datos de ejemplo de piscifactorías
        const farms = [
          { id: 1, name: 'Piscifactoría Sagunto', lat: 39.6766, lon: -0.2026, risk: 'low' },
          { id: 2, name: 'Piscifactoría Burriana', lat: 39.8573, lon: 0.0522, risk: 'medium' },
          { id: 3, name: 'Piscifactoría Calpe', lat: 38.6333, lon: 0.0714, risk: 'high' }
        ];
        
        // Estilos según nivel de riesgo
        const getMarkerStyle = (risk) => {
          let color;
          if (risk === 'low') color = '#3CB043';
          else if (risk === 'medium') color = '#FFA500';
          else if (risk === 'high') color = '#FF0000';
          else color = '#FFFFFF';
          
          return L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
        };
        
        // Añadir marcadores al mapa
        farms.forEach(farm => {
          const marker = L.marker([farm.lat, farm.lon], {
            icon: getMarkerStyle(farm.risk)
          }).addTo(this.map);
          
          marker.bindPopup(`
            <div>
              <h3 style="font-weight: bold;">${farm.name}</h3>
              <p>Nivel de riesgo: ${farm.risk}</p>
            </div>
          `);
          
          this.farmMarkers.push(marker);
        });
      },
      
      updateDataLayer() {
        if (!this.selectedLayer || !this.map) return;
        
        console.log(`Actualizando capa: ${this.selectedLayer.id}`);
        
        // Limpiar capas de datos existentes
        if (this.heatmap) {
          this.map.removeLayer(this.heatmap);
          this.heatmap = null;
        }
        
        // Generar datos simulados según el tipo de capa
        const data = this.generateOceanData(
          this.selectedLayer.id, 
          this.selectedDate, 
          this.selectedDepth
        );
        
        // Visualizar datos según el tipo de capa
        if (this.selectedLayer.id === 'temperature') {
          this.showTemperatureLayer(data);
        } else if (this.selectedLayer.id === 'currents') {
          this.showCurrentsLayer(data);
        } else if (this.selectedLayer.id === 'nutrients') {
          this.showNutrientsLayer(data);
        }
      },
      
      generateOceanData(layerId, date, depth) {
        // Generar grid de puntos con valores simulados
        const points = [];
        const dateObj = new Date(date);
        const depthValue = parseFloat(depth);
        
        // Ajustar valores según fecha (simular cambios temporales)
        const monthOffset = dateObj.getMonth() / 12; // 0-1 según el mes
        
        // Generar puntos en la región de interés
        for (let lon = -1.2; lon <= 1.2; lon += 0.05) {
          for (let lat = 37.5; lat <= 40.5; lat += 0.05) {
            // Solo incluir puntos en el "mar" (simplificación)
            if (this.isInSea(lon, lat)) {
              let value;
              
              if (layerId === 'temperature') {
                // Simulación de temperatura del agua
                // Base: 15-22°C con variación estacional y espacial
                const basetemp = 18 + 7 * monthOffset; // Más caliente en verano
                value = basetemp + Math.sin(lat * 8) * 2 + Math.cos(lon * 5) * 1.5;
                // Ajuste por profundidad
                value = value - 0.1 * Math.abs(depthValue);
              } 
              else if (layerId === 'currents') {
                // Simulación de corrientes marinas
                // Base: 0.1-1.0 m/s con patrones variables
                value = 0.1 + Math.abs(Math.sin(lat * 10 + lon * 8)) * 0.9;
                // Variación estacional (más fuertes en invierno)
                value = value * (1.2 - 0.4 * monthOffset);
              } 
              else if (layerId === 'nutrients') {
                // Simulación de concentración de nutrientes
                // Base: 0.5-4.5 mmol/m³
                value = 0.5 + Math.abs(Math.cos(lat * 12) * Math.sin(lon * 6)) * 4;
                // Mayor concentración a mayor profundidad
                value = value * (1 + 0.05 * Math.abs(depthValue));
              }
              
              points.push({
                lat: lat,
                lng: lon,
                value: value
              });
            }
          }
        }
        
        return points;
      },
      
      isInSea(lon, lat) {
        // Simplificación: determinar si un punto está en el mar
        // En un caso real, se usaría un polígono preciso de la costa
        
        // Línea costera simplificada (valores aproximados)
        const coastPoints = [
          [40.5, 0.5], // Norte de Castellón
          [39.5, -0.3], // Valencia
          [39.0, -0.2], // Sur de Valencia
          [38.5, -0.4], // Alicante Norte
          [38.1, -0.6], // Alicante
          [37.6, -0.7]  // Sur de Alicante
        ];
        
        // Si el punto está al este (mayor longitud) de la costa, está en el mar
        for (let i = 0; i < coastPoints.length - 1; i++) {
          const [lat1, lon1] = coastPoints[i];
          const [lat2, lon2] = coastPoints[i + 1];
          
          // Si el punto está dentro del rango de latitud de este segmento
          if (lat >= Math.min(lat1, lat2) && lat <= Math.max(lat1, lat2)) {
            // Interpolar la longitud de la costa en esta latitud
            const ratio = (lat - lat1) / (lat2 - lat1);
            const coastLon = lon1 + ratio * (lon2 - lon1);
            
            // Si la longitud del punto es mayor que la costa, está en el mar
            if (lon > coastLon) return true;
          }
        }
        
        // Por defecto, considerar que está en el mar si está suficientemente al este
        return lon > 0;
      },
      
      showTemperatureLayer(data) {
        // Crear datos para heatmap de temperatura
        const heatData = data.map(point => [point.lat, point.lng, point.value / 30]); // Normalizar valores
        
        // Configuración de colores para temperatura
        const gradient = {
          0.0: 'blue',
          0.3: 'cyan',
          0.5: 'lime',
          0.7: 'yellow',
          1.0: 'red'
        };
        
        // Crear heatmap
        this.heatmap = L.heatLayer(heatData, {
          radius: 15,
          blur: 10,
          maxZoom: 10,
          gradient: gradient,
          minOpacity: 0.6
        }).addTo(this.map);
      },
      
      showCurrentsLayer(data) {
        // Para corrientes, mostramos vectores o círculos coloreados
        const geojsonData = {
          type: 'FeatureCollection',
          features: data.map(point => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [point.lng, point.lat]
            },
            properties: {
              value: point.value
            }
          }))
        };
        
        // Función para estilo según velocidad de corriente
        const getCircleStyle = (value) => {
          let color;
          if (value < 0.3) color = '#0571b0';
          else if (value < 0.6) color = '#92c5de';
          else if (value < 0.9) color = '#f7f7f7';
          else color = '#f4a582';
          
          return {
            radius: 4,
            fillColor: color,
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
          };
        };
        
        // Añadir capa de GeoJSON
        this.heatmap = L.geoJSON(geojsonData, {
          pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, getCircleStyle(feature.properties.value));
          }
        }).addTo(this.map);
      },
      
      showNutrientsLayer(data) {
        // Para nutrientes, usamos círculos graduados
        const geojsonData = {
          type: 'FeatureCollection',
          features: data.map(point => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [point.lng, point.lat]
            },
            properties: {
              value: point.value
            }
          }))
        };
        
        // Función para estilo según concentración
        const getCircleStyle = (value) => {
          let color;
          if (value < 1) color = '#eff3ff';
          else if (value < 2) color = '#bdd7e7';
          else if (value < 3) color = '#6baed6';
          else if (value < 4) color = '#3182bd';
          else color = '#08519c';
          
          return {
            radius: 4,
            fillColor: color,
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
          };
        };
        
        // Añadir capa de GeoJSON
        this.heatmap = L.geoJSON(geojsonData, {
          pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, getCircleStyle(feature.properties.value));
          }
        }).addTo(this.map);
      },
      
      getGradientStyle(layerId) {
        if (layerId === 'temperature') {
          return 'background: linear-gradient(to right, blue, cyan, lime, yellow, red)';
        } else if (layerId === 'currents') {
          return 'background: linear-gradient(to right, #0571b0, #92c5de, #f7f7f7, #f4a582)';
        } else {
          return 'background: linear-gradient(to right, #eff3ff, #bdd7e7, #6baed6, #3182bd, #08519c)';
        }
      }
    }
  };
  </script>
  
  <style scoped>
  .map-container {
    width: 100%;
    height: 100%;
    min-height: 400px;
    position: relative;
  }
  
  .legend {
    position: absolute;
    bottom: 20px;
    left: 20px;
    background: white;
    padding: 10px;
    border-radius: 4px;
    z-index: 1000;
    box-shadow: 0 1px 5px rgba(0,0,0,0.4);
  }
  
  .legend h4 {
    margin: 0 0 5px 0;
    font-size: 14px;
    font-weight: bold;
  }
  
  .gradient {
    height: 10px;
    width: 150px;
    margin-bottom: 5px;
    border-radius: 2px;
  }
  
  .labels {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }
  </style>