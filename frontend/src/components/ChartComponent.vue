<template>
    <div class="chart-container">
      <canvas ref="chartCanvas"></canvas>
    </div>
  </template>
  
  <script>
  import { ref, onMounted, watch } from 'vue';
  import Chart from 'chart.js/auto';
  
  export default {
    name: 'ChartComponent',
    props: {
      chartData: {
        type: Array,
        required: true
      },
      chartType: {
        type: String,
        default: 'line'
      },
      chartLabel: {
        type: String,
        default: 'Datos'
      }
    },
    setup(props) {
      const chartCanvas = ref(null);
      let chart = null;
      
      const renderChart = () => {
        if (!chartCanvas.value || !props.chartData || props.chartData.length === 0) return;
        
        if (chart) {
          chart.destroy();
        }
        
        const ctx = chartCanvas.value.getContext('2d');
        
        chart = new Chart(ctx, {
          type: props.chartType,
          data: {
            labels: props.chartData.map(item => {
              const date = new Date(item.fecha);
              return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            }),
            datasets: [{
              label: props.chartLabel,
              data: props.chartData.map(item => item.valor),
              backgroundColor: 'rgba(52, 152, 219, 0.2)',
              borderColor: 'rgb(52, 152, 219)',
              borderWidth: 3
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                ticks: {
                  maxRotation: 45,
                  autoSkip: true,
                  maxTicksLimit: 10,
                  callback: function(value) {
                    return value.length > 6 ? value.substring(0, 6) : value;
                  }
                }
              },
              y: {
                beginAtZero: true
              }
            }
          }
        });
      };
      
      onMounted(() => {
        renderChart();
      });
      
      watch(() => props.chartData, () => {
        renderChart();
      }, { deep: true });
      
      return {
        chartCanvas
      };
    }
  }
  </script>
  
  <style scoped>
  .chart-container {
    height: 300px;
    width: 100%;
    position: relative;
  }
  </style>
  