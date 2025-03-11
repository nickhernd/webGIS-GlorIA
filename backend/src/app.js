import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { testConnection } from './db.js';

// Cargar variables de entorno
dotenv.config();

// Obtener __dirname equivalente en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear aplicación Express
const app = express();

// Configurar middleware
app.use(morgan('dev')); // Logging
app.use(cors()); // Habilitar CORS para todas las rutas
app.use(express.json()); // Parsear JSON en el body
app.use(express.urlencoded({ extended: false })); // Parsear URL-encoded en el body

// Servir archivos estáticos desde la carpeta frontend/dist (para producción)
app.use(express.static(path.join(__dirname, '../../frontend')));

// Probar conexión a la base de datos al iniciar
testConnection()
  .then(connected => {
    if (connected) {
      console.log('✅ Conexión a la base de datos establecida correctamente');
    } else {
      console.warn('⚠️ No se pudo establecer conexión a la base de datos. El API utilizará datos simulados.');
    }
  })
  .catch(err => {
    console.error('❌ Error al verificar la conexión:', err);
    console.warn('⚠️ El API utilizará datos simulados como fallback.');
  });

// Rutas API
app.use('/api', apiRoutes);

// Manejar rutas no encontradas en la API
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Ruta fallback para SPA (para producción)
// Esta ruta debe ir después de todas las rutas API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
  });
});

export default app;