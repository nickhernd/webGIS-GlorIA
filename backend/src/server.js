import app from './app.js';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const port = process.env.PORT || 3000;

// Iniciar el servidor
app.listen(port, () => {
  console.log(`🚀 Servidor ejecutándose en el puerto ${port}`);
  console.log(`📡 API disponible en http://localhost:${port}/api`);
});