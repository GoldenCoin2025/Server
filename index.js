.log('Nuevo cliente conectado');  // Enviar un mensaje al cliente  ws.send('¡Conexión exitosa!');
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
