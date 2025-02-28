// backend/src/server.js (versión con ES Modules)
import app from './app.js';
import http from 'http';

// Obtener puerto del entorno o usar valor por defecto
const port = process.env.PORT || 3000;
app.set('port', port);

// Crear servidor HTTP
const server = http.createServer(app);

// Escuchar en el puerto especificado
server.listen(port);

// Manejadores de eventos del servidor
server.on('error', onError);
server.on('listening', onListening);

// Función para manejar errores de servidor
function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // Mensajes de error específicos
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requiere privilegios elevados');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' ya está en uso');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

// Función para manejar inicio del servidor
function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  console.log('Servidor escuchando en ' + bind);
  console.log(`Servidor disponible en http://localhost:${addr.port}`);
}