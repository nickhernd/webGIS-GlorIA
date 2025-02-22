<template>
  <div>
    <h3>Filtrar Datos</h3>
    <label>
      Variable:
      <select v-model="selectedVariable">
        <option value="nutrientes">Nutrientes</option>
        <option value="temperatura">Temperatura</option>
      </select>
    </label>
    <button @click="applyFilter">Filtrar</button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      selectedVariable: '',
    };
  },
  methods: {
    applyFilter() {
      this.$emit('filter', { variable: this.selectedVariable });
    },
  },
};
</script>

<style scoped>
/* Estilos para el DataFilter */
</style>
