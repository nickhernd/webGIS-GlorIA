<template>
  <div class="relative w-full h-full">
    <!-- El contenedor del mapa -->
    <div id="map" class="absolute inset-0"></div>
    
    <!-- Controles superiores -->
    <div class="absolute top-4 right-4 flex gap-2 z-10">
      <button 
        v-for="view in mapViews" 
        :key="view.id"
        class="bg-white px-3 py-1 rounded shadow hover:bg-gray-100"
        @click="changeMapView(view.id)"
      >
        {{ view.name }}
      </button>
    </div>

    <!-- Leyenda -->
    <div class="absolute bottom-4 left-4 bg-white p-2 rounded shadow z-10" v-if="currentLayer">
      <h3 class="text-sm font-medium">{{ currentLayer.title }}</h3>
      <div class="h-2 w-40 mt-1 bg-gradient-to-r" :class="getGradientClass(currentLayer.id)"></div>
      <div class="flex justify-between text-xs mt-1">
        <span>{{ currentLayer.min }}{{ currentLayer.unit }}</span>
        <span>{{ currentLayer.max }}{{ currentLayer.unit }}</span>
      </div>
    </div>
  </div>
</template>

<script>
// Importaciones de OpenLayers
import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import { fromLonLat } from 'ol/proj';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Style, Circle, Fill, Stroke, Text } from 'ol/style';
import { GeoJSON } from 'ol/format';
import Heatmap from 'ol/layer/Heatmap';

export default {
  name: 'MapComponent',
  props: {
    selectedLayer: {
      type: Object,
      default: null
    },
    selectedDate: {
      type: String,
      default: () => new Date().toISOString().split('T')[0]
    },
    selectedDepth: {
      type: Number,
      default: -0.5
    }
  },
  data() {
    return {
      map: null,
      currentLayer: null,
      currentView: 'valencia',
      isLoading: false,
      mapViews: [
        { id: 'valencia', name: 'Valencia' },
        { id: 'mediterraneo', name: 'Mediterráneo' },
        { id: 'global', name: 'Global' }
      ],
      baseLayers: {},
      dataLayers: {}
    };
  },
  watch: {
    selectedLayer: {
      handler(newLayer) {
        if (newLayer) {
          this.currentLayer = newLayer;
          this.updateDataLayer();
        }
      },
      immediate: true
    },
    selectedDate() {
      this.updateDataLayer();
    },
    selectedDepth() {
      this.updateDataLayer();
    }
  },
  mounted() {
    this.initMap();
  },
  methods: {
    initMap() {
      console.log('Inicializando mapa con OpenLayers');
      
      // Crear capa base de OpenStreetMap
      const osmLayer = new TileLayer({
        source: new OSM(),
        visible: true,
        title: 'OSM'
      });
      
      // Crear capa base con estilo oscuro para océanos
      const darkLayer = new TileLayer({
        source: new XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
          attributions: 'Tiles © <a href="https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer">ArcGIS</a>'
        }),
        visible: true,
        title: 'Dark Ocean'
      });
      
      // Inicializar el mapa
      this.map = new Map({
        target: 'map',
        layers: [darkLayer],
        view: new View({
          center: fromLonLat([0.15, 39.5]), // Comunidad Valenciana
          zoom: 7
        }),
        controls: []
      });
      
      // Almacenar referencias a las capas base
      this.baseLayers = {
        osm: osmLayer,
        dark: darkLayer
      };
      
      // Inicializar capas de datos vacías
      this.dataLayers = {
        temperature: this.createEmptyVectorLayer('temperature'),
        currents: this.createEmptyVectorLayer('currents'),
        nutrients: this.createEmptyVectorLayer('nutrients')
      };
      
      // Añadir todas las capas de datos (inicialmente vacías)
      Object.values(this.dataLayers).forEach(layer => {
        this.map.addLayer(layer);
      });
      
      // Añadir capa de piscifactorías
      this.addFishFarms();
      
      console.log('Mapa inicializado');
    },
    
    createEmptyVectorLayer(id) {
      return new VectorLayer({
        source: new VectorSource(),
        visible: false,
        title: id
      });
    },
    
    updateDataLayer() {
      if (!this.currentLayer || !this.map) return;
      
      // Ocultar todas las capas de datos
      Object.values(this.dataLayers).forEach(layer => {
        layer.setVisible(false);
      });
      
      this.isLoading = true;
      console.log(`Actualizando capa: ${this.currentLayer.id}`);
      
      // Simular carga de datos (esto se reemplazará con datos reales de tu API)
      setTimeout(() => {
        // Crear datos de ejemplo
        const data = this.generateExampleData(this.currentLayer.id);
        
        // Obtener la capa correspondiente
        const layer = this.dataLayers[this.currentLayer.id];
        
        if (layer) {
          // Actualizar la fuente de datos
          const source = new VectorSource({
            features: data
          });
          
          if (this.currentLayer.id === 'temperature') {
            // Para temperatura, usar capa de heatmap
            const heatmapLayer = new Heatmap({
              source: source,
              blur: 15,
              radius: 10,
              opacity: 0.8,
              gradient: ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000']
            });
            
            // Reemplazar la capa existente
            const index = this.map.getLayers().getArray().indexOf(layer);
            this.map.getLayers().removeAt(index);
            this.map.getLayers().insertAt(index, heatmapLayer);
            this.dataLayers.temperature = heatmapLayer;
            heatmapLayer.setVisible(true);
          } else {
            // Para otras capas, actualizar la fuente del VectorLayer
            layer.setSource(source);
            layer.setVisible(true);
            
            // Configurar estilo según el tipo de capa
            if (this.currentLayer.id === 'currents') {
              layer.setStyle(this.getCurrentStyle());
            } else if (this.currentLayer.id === 'nutrients') {
              layer.setStyle(this.getNutrientStyle());
            }
          }
        }
        
        this.isLoading = false;
      }, 500);
    },
    
    generateExampleData(layerId) {
      const features = [];
      
      // Generar puntos en el área de la Comunidad Valenciana
      for (let lon = -0.5; lon <= 1.0; lon += 0.1) {
        for (let lat = 38.0; lat <= 40.5; lat += 0.1) {
          let value;
          
          if (layerId === 'temperature') {
            // Valores de temperatura que varían según la localización
            value = 15 + Math.sin(lat * 10) * 3 + Math.cos(lon * 5) * 2;
          } else if (layerId === 'currents') {
            // Velocidad de corrientes
            value = 0.2 + Math.sin(lat * 8) * 0.15 + Math.cos(lon * 6) * 0.1;
          } else {
            // Nutrientes u otros
            value = 1 + Math.sin(lat * 12) * 0.8 + Math.cos(lon * 7) * 0.5;
          }
          
          const feature = new Feature({
            geometry: new Point(fromLonLat([lon, lat])),
            value: value
          });
          
          features.push(feature);
        }
      }
      
      return features;
    },
    
    getCurrentStyle() {
      return (feature) => {
        const value = feature.get('value');
        
        // Escala de colores para corrientes
        let color;
        if (value < 0.3) color = '#0571b0';
        else if (value < 0.6) color = '#92c5de';
        else if (value < 0.9) color = '#f7f7f7';
        else color = '#f4a582';
        
        return new Style({
          image: new Circle({
            radius: 4,
            fill: new Fill({ color: color }),
            stroke: new Stroke({ color: 'rgba(0,0,0,0.2)', width: 1 })
          })
        });
      };
    },
    
    getNutrientStyle() {
      return (feature) => {
        const value = feature.get('value');
        
        // Escala de colores para nutrientes
        let color;
        if (value < 1) color = '#eff3ff';
        else if (value < 2) color = '#bdd7e7';
        else if (value < 3) color = '#6baed6';
        else if (value < 4) color = '#3182bd';
        else color = '#08519c';
        
        return new Style({
          image: new Circle({
            radius: 4,
            fill: new Fill({ color: color }),
            stroke: new Stroke({ color: 'rgba(0,0,0,0.2)', width: 1 })
          })
        });
      };
    },
    
    addFishFarms() {
      // Datos de ejemplo de piscifactorías
      const farms = [
        { id: 1, name: 'Piscifactoría Sagunto', lat: 39.6766, lon: -0.2026, risk: 'low' },
        { id: 2, name: 'Piscifactoría Burriana', lat: 39.8573, lon: 0.0522, risk: 'medium' },
        { id: 3, name: 'Piscifactoría Calpe', lat: 38.6333, lon: 0.0714, risk: 'high' }
      ];
      
      // Crear features para las piscifactorías
      const features = farms.map(farm => {
        const feature = new Feature({
          geometry: new Point(fromLonLat([farm.lon, farm.lat])),
          id: farm.id,
          name: farm.name,
          risk: farm.risk
        });
        
        return feature;
      });
      
      // Crear capa de piscifactorías
      const farmLayer = new VectorLayer({
        source: new VectorSource({
          features: features
        }),
        style: (feature) => {
          const risk = feature.get('risk');
          const name = feature.get('name');
          
          // Colores según nivel de riesgo
          let color;
          if (risk === 'low') color = '#3CB043';
          else if (risk === 'medium') color = '#FFA500';
          else if (risk === 'high') color = '#FF0000';
          else color = '#FFFFFF';
          
          return new Style({
            image: new Circle({
              radius: 8,
              fill: new Fill({ color: color }),
              stroke: new Stroke({ color: '#FFFFFF', width: 2 })
            }),
            text: new Text({
              text: name,
              offsetY: -15,
              fill: new Fill({ color: '#FFFFFF' }),
              stroke: new Stroke({ color: '#000000', width: 2 })
            })
          });
        }
      });
      
      // Añadir capa al mapa
      this.map.addLayer(farmLayer);
    },
    
    changeMapView(viewId) {
      if (viewId === 'valencia') {
        this.map.getView().animate({
          center: fromLonLat([0.15, 39.5]),
          zoom: 7,
          duration: 1000
        });
      } else if (viewId === 'mediterraneo') {
        this.map.getView().animate({
          center: fromLonLat([10, 38]),
          zoom: 4,
          duration: 1000
        });
      } else if (viewId === 'global') {
        this.map.getView().animate({
          center: fromLonLat([0, 30]),
          zoom: 2,
          duration: 1000
        });
      }
      
      this.currentView = viewId;
    },
    
    getGradientClass(layerId) {
      if (layerId === 'temperature') {
        return 'from-blue-500 via-green-500 to-red-500';
      } else if (layerId === 'currents') {
        return 'from-blue-500 via-gray-200 to-red-300';
      } else {
        return 'from-blue-100 via-blue-300 to-blue-800';
      }
    }
  }
};
</script>

<style>
/* Necesario para que el mapa ocupe todo el espacio disponible */
#map {
  width: 100%;
  height: 100%;
}
</style>