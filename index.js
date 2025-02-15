const WebSocket = require('ws');

const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port });

// Almacenamiento de dispositivos
const devices = {
    masters: new Set(),
    slaves: new Map() // <slaveId, WebSocket>
};

wss.on('connection', ws => {
    let deviceType = null;
    let slaveId = null;

    ws.on('message', message => {
        const msg = message.toString();
        
        // Registrar tipo de dispositivo
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
            
            // Enviar lista de esclavos al maestro
            ws.send(JSON.stringify({
                type: 'slave_list',
                slaves: Array.from(devices.slaves.keys())
            }));
        }
        
        // Comandos de maestro a esclavo
        if (deviceType === 'master' && msg.startsWith('cmd:')) {
            const [targetSlave, command] = msg.split(':').slice(2);
            const slaveWs = devices.slaves.get(targetSlave);
            if (slaveWs) {
                slaveWs.send(command);
            }
        }
    });

    ws.on('close', () => {
        if (deviceType === 'slave' && slaveId) {
            devices.slaves.delete(slaveId);
        } else if (deviceType === 'master') {
            devices.masters.delete(ws);
        }
        console.log('Dispositivo desconectado');
    });
});

console.log(`Servidor WebSocket escuchando en el puerto ${port}`);
