<template>
  <div class="flex h-screen">
    <!-- Sidebar -->
    <div class="w-64 bg-gray-800 p-4">
      <div class="text-white">
        <h2 class="text-xl font-bold mb-4">Add layer...</h2>
        <div class="bg-white rounded p-4 text-gray-900">
          <h3 class="text-blue-600 font-medium">Sea water potential temperature</h3>
          <p class="text-gray-600 text-sm">thetao</p>
          <p class="text-gray-600 text-sm">02/03/2025 • -0.5m • Global daily</p>
          <div class="mt-4">
            <div class="h-2 bg-gradient-to-r from-purple-500 via-red-500 to-yellow-500 rounded"></div>
            <div class="flex justify-between text-xs mt-1">
              <span>0°C</span>
              <span>30°C</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main content -->
    <div class="flex-1 flex flex-col">
      <!-- Map area -->
      <div class="flex-1 bg-gray-700">
        <div class="h-full relative">
          <!-- Map placeholder -->
          <div class="absolute top-4 right-4 flex gap-2">
            <button class="bg-white px-3 py-1 rounded shadow hover:bg-gray-100">Points</button>
            <button class="bg-white px-3 py-1 rounded shadow hover:bg-gray-100">Lines</button>
            <button class="bg-white px-3 py-1 rounded shadow hover:bg-gray-100">Areas</button>
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <div class="h-24 bg-gray-800 p-4">
        <div class="flex items-center gap-2 text-white">
          <button class="p-2 hover:bg-gray-700 rounded">▶</button>
          <div class="flex-1 h-2 bg-gray-700 rounded-full relative">
            <div class="absolute w-4 h-4 bg-blue-500 rounded-full top-1/2 -translate-y-1/2" style="left: 50%"></div>
          </div>
          <span>2025</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'HomeView'
}
</script>