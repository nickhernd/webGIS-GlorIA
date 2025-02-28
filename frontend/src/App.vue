<!-- frontend/src/App.vue -->
<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
/* Estilos globales */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: #333;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

#app {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

/* Estilos para scrollbars personalizados */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #aaa;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #888;
}

/* Estilos para clases de utilidad */
.text-center {
  text-align: center;
}

.text-right {
  text-align: right;
}

.text-left {
  text-align: left;
}

.d-flex {
  display: flex;
}

.justify-center {
  justify-content: center;
}

.align-center {
  align-items: center;
}

.flex-column {
  flex-direction: column;
}

.gap-10 {
  gap: 10px;
}

.gap-20 {
  gap: 20px;
}

.w-100 {
  width: 100%;
}

.h-100 {
  height: 100%;
}

.position-relative {
  position: relative;
}

/* Variables CSS globales */
:root {
  --primary-color: #3498db;
  --secondary-color: #2c3e50;
  --success-color: #2ecc71;
  --warning-color: #f39c12;
  --danger-color: #e74c3c;
  --light-bg: #f5f7fa;
  --dark-bg: #34495e;
  --text-color: #333;
  --text-light: #6c757d;
  --border-color: #e1e4e8;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --border-radius: 4px;
}
</style>