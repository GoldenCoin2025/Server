const WebSocket = require('ws');
const server = new WebSocket.Server({ port: process.env.PORT || 8080 });

const devices = {
    slaves: new Map(),
    masters: new Map()
};

server.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`Nueva conexión: ${ip}`);

    ws.on('message', (message) => {
        const msg = message.toString();
        
        // Registrar esclavo
        if(msg.startsWith('ESCLAVO-')) {
            devices.slaves.set(msg, ws);
            console.log(`Esclavo registrado: ${msg}`);
        } 
        // Registrar maestro
        else if(msg === 'MAESTRO') {
            devices.masters.set(ip, ws);
            console.log(`Maestro conectado: ${ip}`);
        }
        // Comando de control
        else if(msg.startsWith('START_SCREENSHARE:')) {
            const targetSlave = msg.split(':')[1];
            const slaveWs = devices.slaves.get(targetSlave);
            
            if(slaveWs && slaveWs.readyState === WebSocket.OPEN) {
                slaveWs.send('INICIAR_CAPTURA');
                console.log(`Enviando comando a esclavo: ${targetSlave}`);
            }
        }
        // Transmisión de frames
        else if(msg.startsWith('FRAME:')) {
            const [slaveId, frameData] = msg.split(':', 2)[1].split('|');
            
            devices.masters.forEach(masterWs => {
                if(masterWs.readyState === WebSocket.OPEN) {
                    masterWs.send(`FRAME:${slaveId}:${frameData}`);
                }
            });
        }
    });

    ws.on('close', () => {
        devices.slaves.forEach((v, k) => { if(v === ws) devices.slaves.delete(k); });
        devices.masters.delete(ip);
        console.log(`Conexión cerrada: ${ip}`);
    });
});

console.log(`🚀 Servidor activo en puerto ${server.options.port}`);
