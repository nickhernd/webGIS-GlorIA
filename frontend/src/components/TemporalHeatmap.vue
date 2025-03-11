<!-- TemporalHeatmap.vue -->
<template>
    <div class="temporal-heatmap-section">
      <h3>Evolución diaria - {{ variableName }}</h3>
      <div class="heatmap-container">
        <div class="heatmap-loading" v-if="loading">
          <div class="loading-spinner"></div>
          <span>Cargando datos...</span>
        </div>
        <div class="heatmap-grid" ref="heatmapGrid" v-else>
          <!-- El heatmap se renderizará aquí dinámicamente -->
        </div>
        <div class="heatmap-legend">
          <div class="legend-gradient" ref="legendGradient"></div>
          <div class="legend-labels">
            <span ref="minLabel">Bajo</span>
            <span ref="midLabel">Medio</span>
            <span ref="maxLabel">Alto</span>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script>
  export default {
    name: 'TemporalHeatmap',
    props: {
      variable: {
        type: String,
        required: true
      },
      variableName: {
        type: String,
        default: ''
      },
      data: {
        type: Array,
        default: () => []
      },
      loading: {
        type: Boolean,
        default: false
      },
      colorScheme: {
        type: String,
        default: 'default' // 'default', 'temperature', 'oxygen', 'currents'
      }
    },
    
    watch: {
      data() {
        this.renderHeatmap();
      },
      variable() {
        this.updateColors();
      }
    },
    
    mounted() {
      this.renderHeatmap();
      this.updateColors();
    },
    
    methods: {
      renderHeatmap() {
        if (!this.$refs.heatmapGrid || this.data.length === 0) return;
        
        // Limpiar el contenedor
        this.$refs.heatmapGrid.innerHTML = '';
        
        // Crear encabezados de horas
        const hourHeadersContainer = document.createElement('div');
        hourHeadersContainer.className = 'heatmap-hours-header';
        
        // Añadir celda vacía para el encabezado de los días
        const emptyCell = document.createElement('div');
        emptyCell.className = 'heatmap-cell empty';
        hourHeadersContainer.appendChild(emptyCell);
        
        // Añadir encabezados de horas (0-23, de 3 en 3 horas para no saturar)
        for (let hour = 0; hour < 24; hour += 3) {
          const hourCell = document.createElement('div');
          hourCell.className = 'heatmap-cell hour-header';
          hourCell.textContent = `${hour}h`;
          hourHeadersContainer.appendChild(hourCell);
        }
        
        this.$refs.heatmapGrid.appendChild(hourHeadersContainer);
        
        // Crear filas para cada día
        this.data.forEach(dayData => {
          const dayRow = document.createElement('div');
          dayRow.className = 'heatmap-row';
          
          // Añadir celda de etiqueta del día
          const dayCell = document.createElement('div');
          dayCell.className = 'heatmap-cell day-label';
          dayCell.textContent = dayData.day;
          dayRow.appendChild(dayCell);
          
          // Obtener valores máximo y mínimo para este día
          const values = dayData.hours.map(h => h.value);
          const maxVal = Math.max(...values);
          const minVal = Math.min(...values);
          
          // Añadir celdas para cada hora
          for (let hour = 0; hour < 24; hour += 3) {
            // Promedio de valores para cada bloque de 3 horas
            let avgValue = 0;
            let count = 0;
            
            for (let h = hour; h < hour + 3 && h < 24; h++) {
              if (dayData.hours[h]) {
                avgValue += dayData.hours[h].value;
                count++;
                
                // Verificar si es la hora actual
                if (dayData.hours[h].isNow) {
                  dayCell.classList.add('current-day');
                }
              }
            }
            
            avgValue = count > 0 ? avgValue / count : 0;
            
            const hourCell = document.createElement('div');
            hourCell.className = 'heatmap-cell';
            
            // Normalizar el valor para el rango de colores
            const normalizedValue = this.normalizeValue(avgValue);
            const color = this.getColorForValue(normalizedValue);
            hourCell.style.backgroundColor = color;
            
            // Verificar si es la hora actual
            const isNowInRange = dayData.hours.slice(hour, hour + 3).some(h => h && h.isNow);
            if (isNowInRange) {
              hourCell.classList.add('current-time');
            }
            
            // Añadir tooltip con valores
            hourCell.title = `${dayData.day} ${hour}:00-${hour + 3}:00: ${avgValue.toFixed(2)}`;
            
            // Evento de clic para mostrar detalles
            hourCell.addEventListener('click', () => {
              this.$emit('cell-click', {
                day: dayData.day,
                hourStart: hour,
                hourEnd: hour + 3,
                value: avgValue
              });
            });
            
            dayRow.appendChild(hourCell);
          }
          
          this.$refs.heatmapGrid.appendChild(dayRow);
        });
      },
      
      updateColors() {
        if (!this.$refs.legendGradient) return;
        
        let gradientColors, minValue, midValue, maxValue;
        
        // Configurar colores y etiquetas según la variable
        switch (this.variable) {
          case 'o2':
            gradientColors = 'linear-gradient(to right, #d73027, #fc8d59, #fee090, #e0f3f8, #91bfdb, #4575b4)';
            minValue = '4 mg/L';
            midValue = '6 mg/L';
            maxValue = '8 mg/L';
            break;
          case 'temperature':
          case 'temperatura':
            gradientColors = 'linear-gradient(to right, #313695, #4575b4, #74add1, #abd9e9, #fdae61, #f46d43, #d73027)';
            minValue = '18°C';
            midValue = '22°C';
            maxValue = '26°C';
            break;
          case 'currents':
          case 'corrientes':
            gradientColors = 'linear-gradient(to right, #edf8fb, #b2e2e2, #66c2a4, #2ca25f, #006d2c)';
            minValue = '0.1 m/s';
            midValue = '0.3 m/s';
            maxValue = '0.5 m/s';
            break;
          case 'salinity':
          case 'salinidad':
            gradientColors = 'linear-gradient(to right, #f7fbff, #deebf7, #c6dbef, #9ecae1, #6baed6, #4292c6, #2171b5, #08519c, #08306b)';
            minValue = '34 ppt';
            midValue = '36 ppt';
            maxValue = '38 ppt';
            break;
          default:
            gradientColors = 'linear-gradient(to right, #ffffcc, #a1dab4, #41b6c4, #2c7fb8, #253494)';
            minValue = 'Bajo';
            midValue = 'Medio';
            maxValue = 'Alto';
        }
        
        // Actualizar la leyenda
        this.$refs.legendGradient.style.background = gradientColors;
        
        if (this.$refs.minLabel) this.$refs.minLabel.textContent = minValue;
        if (this.$refs.midLabel) this.$refs.midLabel.textContent = midValue;
        if (this.$refs.maxLabel) this.$refs.maxLabel.textContent = maxValue;
      },
      
      normalizeValue(value) {
        // Define rangos según la variable para normalizar entre 0 y 1
        let min, max;
        
        switch (this.variable) {
          case 'o2':
            min = 4;
            max = 8;
            break;
          case 'temperature':
          case 'temperatura':
            min = 18;
            max = 26;
            break;
          case 'currents':
          case 'corrientes':
            min = 0.1;
            max = 0.5;
            break;
          case 'salinity':
          case 'salinidad':
            min = 34;
            max = 38;
            break;
          default:
            // Usar el rango de datos actual si no es una variable reconocida
            const allValues = this.data.flatMap(day => day.hours.map(h => h.value));
            min = Math.min(...allValues);
            max = Math.max(...allValues);
        }
        
        // Normalizar el valor entre 0 y 1
        return Math.max(0, Math.min(1, (value - min) / (max - min)));
      },
      
      getColorForValue(normalizedValue) {
        // Obtener colores según la variable
        let colors;
        
        switch (this.variable) {
          case 'o2':
            colors = ['#d73027', '#fc8d59', '#fee090', '#e0f3f8', '#91bfdb', '#4575b4'];
            break;
          case 'temperature':
          case 'temperatura':
            colors = ['#313695', '#4575b4', '#74add1', '#abd9e9', '#fdae61', '#f46d43', '#d73027'];
            break;
          case 'currents':
          case 'corrientes':
            colors = ['#edf8fb', '#b2e2e2', '#66c2a4', '#2ca25f', '#006d2c'];
            break;
          case 'salinity':
          case 'salinidad':
            colors = ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'];
            break;
          default:
            colors = ['#ffffcc', '#a1dab4', '#41b6c4', '#2c7fb8', '#253494'];
        }
        
        // Calcular el índice de color
        const colorIndex = Math.floor(normalizedValue * (colors.length - 1));
        
        // Si es el último color, devolver directamente
        if (colorIndex >= colors.length - 1) {
          return colors[colors.length - 1];
        }
        
        // Interpolación entre colores
        const ratio = (normalizedValue * (colors.length - 1)) - colorIndex;
        const startColor = this.hexToRgb(colors[colorIndex]);
        const endColor = this.hexToRgb(colors[colorIndex + 1]);
        
        const r = Math.floor(startColor.r + ratio * (endColor.r - startColor.r));
        const g = Math.floor(startColor.g + ratio * (endColor.g - startColor.g));
        const b = Math.floor(startColor.b + ratio * (endColor.b - startColor.b));
        
        return `rgb(${r}, ${g}, ${b})`;
      },
      
      hexToRgb(hex) {
        // Eliminar # si existe
        hex = hex.replace('#', '');
        
        // Parsear valores RGB
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        return { r, g, b };
      }
    }
  };
  </script>
  
  <style scoped>
  .temporal-heatmap-section {
    background-color: white;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-bottom: 20px;
  }
  
  .temporal-heatmap-section h3 {
    margin-top: 0;
    font-size: 1rem;
    color: #2c3e50;
    margin-bottom: 15px;
  }
  
  .heatmap-container {
    position: relative;
    width: 100%;
    overflow-x: auto;
  }
  
  .heatmap-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 150px;
    color: #6c757d;
  }
  
  .loading-spinner {
    width: 30px;
    height: 30px;
    border: 3px solid rgba(0, 0, 0, 0.1);
    border-top-color: #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 10px;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .heatmap-grid {
    display: flex;
    flex-direction: column;
    min-width: 600px;
  }
  
  .heatmap-hours-header, .heatmap-row {
    display: flex;
    width: 100%;
  }
  
  .heatmap-cell {
    flex: 1;
    height: 25px;
    text-align: center;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(0, 0, 0, 0.1);
  }
  
  .heatmap-cell.empty {
    border: none;
  }
  
  .heatmap-cell.hour-header, .heatmap-cell.day-label {
    font-weight: 500;
    background-color: #f8f9fa;
    color: #495057;
  }
  
  .heatmap-cell.day-label {
    width: 40px;
    flex: 0 0 40px;
  }
  
  .heatmap-cell.current-time {
    border: 2px solid #e74c3c;
  }
  
  .day-label.current-day {
    font-weight: bold;
    color: #e74c3c;
  }
  
  .heatmap-legend {
    margin-top: 15px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .legend-gradient {
    width: 80%;
    height: 15px;
    border-radius: 3px;
    margin-bottom: 5px;
  }
  
  .legend-labels {
    width: 80%;
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #6c757d;
  }
  </style>