<template>
  <div>
    <h3>Selecciona Rango de Fechas</h3>
    <input type="date" v-model="startDate" />
    <input type="date" v-model="endDate" />
    <button @click="submitDateRange">Actualizar</button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      startDate: '',
      endDate: '',
    };
  },
  methods: {
    submitDateRange() {
      this.$emit('update', { start: this.startDate, end: this.endDate });
    },
  },
};
</script>

<style scoped>
/* Estilos para el DateRangePicker */
</style>
