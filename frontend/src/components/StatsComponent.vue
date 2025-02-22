<template>
  <div class="stats">
    <h2>Estadísticas de {{ piscifactoría ? piscifactoría.nombre : 'Selecciona una piscifactoría' }}</h2>
    <p v-if="dateRange">Rango de fechas: {{ dateRange }}</p>
    <!-- Aquí puedes agregar más estadísticas y gráficos -->
  </div>
</template>

<script>
export default {
  props: ['piscifactoría', 'date-range', 'filter'],
};
</script>

<style scoped>
.stats {
  flex: 2;
}
</style>
