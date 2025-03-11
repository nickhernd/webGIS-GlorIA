import { createRouter, createWebHistory } from 'vue-router'

// Importar componentes para las rutas
import Home from '../views/Home.vue'

// Definición de rutas
const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: {
      title: 'Inicio - WebGIS GlorIA'
    }
  },
  {
    path: '/piscifactoria/:id',
    name: 'PiscifactoriaDetalle',
    component: Home,  // Utilizamos el mismo componente pero con parámetros
    props: true,
    meta: {
      title: 'Detalle de Piscifactoría - WebGIS GlorIA'
    }
  },
  // Ruta para manejar rutas no encontradas
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: Home, // Usando Home como fallback en lugar de un componente NotFound
    meta: {
      title: 'Página no encontrada - WebGIS GlorIA'
    }
  }
]

// Crear instancia del router
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // Comportamiento de desplazamiento al cambiar de ruta
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

// Actualizar el título de la página según la ruta
router.beforeEach((to, from, next) => {
  document.title = to.meta.title || 'WebGIS GlorIA'
  
  // Si la ruta tiene un ID de piscifactoría, obtener el nombre y actualizar el título
  if (to.name === 'PiscifactoriaDetalle' && to.params.id) {
    // Aquí se podría implementar la lógica para obtener el nombre de la piscifactoría
    // y actualizar el título dinámicamente
  }
  
  next()
})

export default router