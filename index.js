const http = require('http');
const WebSocket = require('ws');

// Servidor HTTP para mantener activo el proceso
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Servidor activo');
});

// WebSocket Server adjunto al HTTP
const wss = new WebSocket.Server({ server });

// Mantener compatibilidad con tu app esclava original
wss.on('connection', ws => {
    console.log('Nuevo cliente conectado');
    
    // Mensaje inicial para tu app esclava
    ws.send('¡Conexión exitosa!');
    
    // Lógica original de mensajes
    ws.on('message', message => {
        const msg = message.toString();
        console.log(`Mensaje recibido: ${msg}`);
        
        // Registrar esclavos (compatibilidad con tu app)
        if (msg.startsWith('ESCLAVO-')) {
            console.log(`Dispositivo esclavo registrado: ${msg}`);
        }
    });
    
    ws.on('close', () => {
        console.log('Cliente desconectado');
    });
});

// Usar puerto de Railway
const port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`Servidor escuchando en puerto ${port}`);
});
