import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0', // Escuchar en todas las interfaces de red
    proxy: {
      // Proxy para las peticiones al backend
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    },
    port: 8080, // Puerto diferente al backend
    open: false, // No abrir navegador automáticamente en WSL
  },
  build: {
    outDir: 'dist', // Carpeta de salida para la compilación
    assetsDir: 'assets', // Carpeta para los assets
    sourcemap: true, // Generar sourcemaps
    // Opciones de minificación
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production', // Eliminar console.log en producción
      },
    },
  },
  // Variables de entorno que estarán disponibles en el cliente
  define: {
    'process.env': process.env
  }
})