<template>
  <div class="w-64 bg-gray-800 text-white p-4">
    <h2 class="text-xl font-bold mb-4">Add layer...</h2>
    <div class="bg-white rounded p-4 text-gray-900">
      <h3 class="text-blue-600 font-medium">Sea water potential temperature</h3>
      <p class="text-gray-600 text-sm">thetao</p>
      <p class="text-gray-600 text-sm">02/03/2025 • -0.5m • Global daily</p>
      <div class="mt-2">
        <div class="h-2 bg-gradient-to-r from-purple-500 via-red-500 to-yellow-500 rounded"></div>
        <div class="flex justify-between text-xs mt-1">
          <span>0°C</span>
          <span>30°C</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Sidebar',
  emits: ['select', 'date-range-update', 'filter-update']
}
</script>