<template>
  <div class="chart-container">
    <canvas ref="chartCanvas"></canvas>
    <div v-if="!chartData || chartData.length === 0" class="no-data">
      No hay datos disponibles para mostrar
    </div>
    <div class="chart-legend" v-if="multipleSeries && datasets.length > 0">
      <div 
        v-for="(dataset, index) in datasets" 
        :key="index" 
        class="legend-item"
        :class="{ 'inactive': !datasetVisibility[index] }"
        @click="toggleDataset(index)"
      >
        <span class="color-indicator" :style="{ backgroundColor: dataset.borderColor }"></span>
        <span class="label">{{ dataset.label }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import Chart from 'chart.js/auto';

export default {
  name: 'ChartComponent',
  props: {
    // Single dataset mode
    chartData: {
      type: Array,
      default: () => []
    },
    chartType: {
      type: String,
      default: 'line'
    },
    chartLabel: {
      type: String,
      default: 'Datos'
    },
    // Multiple datasets mode
    multipleData: {
      type: Array,
      default: () => []
    },
    chartOptions: {
      type: Object,
      default: () => ({})
    }
  },
  
  setup(props) {
    const chartCanvas = ref(null);
    const chartInstance = ref(null);
    const datasetVisibility = ref([]);
    const multipleSeries = computed(() => props.multipleData && props.multipleData.length > 0);

    // Chart configuration with sensible defaults
    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'day',
            displayFormats: {
              day: 'dd MMM'
            },
            tooltipFormat: 'dd MMM yyyy'
          },
          title: {
            display: true,
            text: 'Fecha'
          },
          ticks: {
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: 10
          }
        },
        y: {
          beginAtZero: false,
          title: {
            display: true,
            text: 'Valor'
          }
        }
      },
      plugins: {
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false
        },
        legend: {
          display: false // We'll create our own interactive legend
        }
      }
    };

    // Color palette for multiple datasets
    const colorPalette = [
      { border: 'rgb(54, 162, 235)', background: 'rgba(54, 162, 235, 0.2)' },
      { border: 'rgb(255, 99, 132)', background: 'rgba(255, 99, 132, 0.2)' },
      { border: 'rgb(75, 192, 192)', background: 'rgba(75, 192, 192, 0.2)' },
      { border: 'rgb(255, 159, 64)', background: 'rgba(255, 159, 64, 0.2)' },
      { border: 'rgb(153, 102, 255)', background: 'rgba(153, 102, 255, 0.2)' },
      { border: 'rgb(201, 203, 207)', background: 'rgba(201, 203, 207, 0.2)' },
      { border: 'rgb(46, 204, 113)', background: 'rgba(46, 204, 113, 0.2)' }
    ];

    // Process and prepare datasets for chart
    const datasets = computed(() => {
      if (multipleSeries.value) {
        return props.multipleData.map((series, index) => {
          const color = colorPalette[index % colorPalette.length];
          
          return {
            label: series.label || `Serie ${index + 1}`,
            data: series.data.map(item => ({
              x: new Date(item.fecha),
              y: item.valor
            })),
            borderColor: series.color?.border || color.border,
            backgroundColor: series.color?.background || color.background,
            borderWidth: 2,
            tension: 0.2,
            pointRadius: 3,
            hidden: datasetVisibility.value[index] === false
          };
        });
      } else {
        // Single dataset mode
        return [{
          label: props.chartLabel,
          data: props.chartData.map(item => ({
            x: new Date(item.fecha),
            y: item.valor
          })),
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderWidth: 2,
          tension: 0.2,
          pointRadius: 3
        }];
      }
    });

    // Initialize dataset visibility
    const initDatasetVisibility = () => {
      if (multipleSeries.value) {
        datasetVisibility.value = props.multipleData.map(() => true);
      }
    };

    // Toggle dataset visibility
    const toggleDataset = (index) => {
      datasetVisibility.value[index] = !datasetVisibility.value[index];
      
      if (chartInstance.value) {
        chartInstance.value.data.datasets[index].hidden = !datasetVisibility.value[index];
        chartInstance.value.update();
      }
    };

    // Render or update chart
    const renderChart = () => {
      if (!chartCanvas.value) return;
      
      // Destroy existing chart if it exists
      if (chartInstance.value) {
        chartInstance.value.destroy();
      }

      // Check if we have data to display
      if ((multipleSeries.value && datasets.value.length === 0) || 
          (!multipleSeries.value && (!props.chartData || props.chartData.length === 0))) {
        return;
      }

      // Merge options
      const mergedOptions = { 
        ...defaultOptions, 
        ...props.chartOptions
      };

      // Create the chart
      const ctx = chartCanvas.value.getContext('2d');
      
      chartInstance.value = new Chart(ctx, {
        type: props.chartType,
        data: {
          datasets: datasets.value
        },
        options: mergedOptions
      });
    };

    // Watch for data changes
    watch(() => [props.chartData, props.multipleData], () => {
      initDatasetVisibility();
      renderChart();
    }, { deep: true });

    // Watch for chart type changes
    watch(() => props.chartType, () => {
      renderChart();
    });

    // Initialize when mounted
    onMounted(() => {
      initDatasetVisibility();
      renderChart();
    });

    // Clean up when unmounted
    onUnmounted(() => {
      if (chartInstance.value) {
        chartInstance.value.destroy();
      }
    });

    return {
      chartCanvas,
      datasets,
      multipleSeries,
      datasetVisibility,
      toggleDataset
    };
  }
};
</script>

<style scoped>
.chart-container {
  height: 300px;
  width: 100%;
  position: relative;
  margin-bottom: 20px;
}

.no-data {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #6c757d;
  font-style: italic;
  text-align: center;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
  padding: 8px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.legend-item {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.legend-item:hover {
  background-color: #e9ecef;
}

.legend-item.inactive {
  opacity: 0.5;
}

.color-indicator {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 6px;
  border-radius: 50%;
}

.label {
  font-size: 0.85rem;
  color: #495057;
}
</style>