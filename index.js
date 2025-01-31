const WebSocket = require('ws');

// Configuración del puerto (utilizamos el puerto dinámico de Railway)
const port = process.env.PORT || 8080; // Si Railway no asigna un puerto, usará el 8080 por defecto

// Crear el servidor WebSocket
const wss = new WebSocket.Server({ port });

// Cuando un cliente se conecta
wss.on('connection', ws => {
  console.log('Nuevo cliente conectado');

  // Enviar un mensaje al cliente
  ws.send('¡Conexión exitosa!');

  // Escuchar los mensajes recibidos del cliente
  ws.on('message', message => {
    console.log(`Mensaje recibido: ${message}`);
  });

  // Manejar la desconexión del cliente
  ws.on('close', () => {
    console.log('Cliente desconectado');
  });
});

console.log(`Servidor WebSocket escuchando en el puerto ${port}`);
