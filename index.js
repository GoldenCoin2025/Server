const http = require('http');
const WebSocket = require('ws');

// Crear servidor HTTP básico
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Servidor activo');
});

// Crear WebSocket server adjunto al HTTP
const wss = new WebSocket.Server({ server });

// Almacenamiento de dispositivos
const devices = {
    masters: new Set(),
    slaves: new Map() // <slaveId, WebSocket>
};

wss.on('connection', (ws) => {
    let deviceType = null;
    let slaveId = null;

    ws.on('message', (message) => {
        const msg = message.toString();
        
        if (msg.startsWith('slave:')) {
            slaveId = msg.split(':')[1];
            devices.slaves.set(slaveId, ws);
            deviceType = 'slave';
            console.log(`Slave conectado: ${slaveId}`);
            
        } else if (msg.startsWith('master:')) {
            const masterId = msg.split(':')[1];
            devices.masters.add(ws);
            deviceType = 'master';
            console.log(`Master conectado: ${masterId}`);
            
            // Enviar lista de esclavos
            ws.send(JSON.stringify({
                type: 'slave_list',
                slaves: Array.from(devices.slaves.keys())
            }));
        }
        
        if (deviceType === 'master' && msg.startsWith('cmd:')) {
            const [targetSlave, command] = msg.split(':').slice(2);
            const slaveWs = devices.slaves.get(targetSlave);
            if (slaveWs && slaveWs.readyState === WebSocket.OPEN) {
                slaveWs.send(command);
            }
        }
    });

    ws.on('close', () => {
        if (deviceType === 'slave' && slaveId) {
            devices.slaves.delete(slaveId);
            console.log(`Slave desconectado: ${slaveId}`);
        } else if (deviceType === 'master') {
            devices.masters.delete(ws);
            console.log('Master desconectado');
        }
    });
});

// Usar el puerto de Railway
const port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`Servidor escuchando en puerto ${port}`);
});
