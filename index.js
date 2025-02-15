const http = require('http');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Servidor activo');
});

const wss = new WebSocket.Server({ server });

const devices = {
    slaves: new Map(),
    masters: new Set()
};

wss.on('connection', (ws) => {
    console.log('Nuevo cliente conectado');

    ws.on('message', (message) => {
        const msg = message.toString();
        console.log(`Mensaje recibido: ${msg}`);

        // Registrar esclavo
        if (msg.startsWith('ESCLAVO-')) {
            devices.slaves.set(msg, ws);
            console.log(`Slave registrado: ${msg}`);
            updateMasters();
        }
        // Registrar maestro
        else if (msg === 'MAESTRO') {
            devices.masters.add(ws);
            console.log('Nuevo maestro conectado');
            sendSlaveList(ws);
        }
        // Comandos de control
        else if (msg.startsWith('CONTROL:')) {
            const [_, slaveId, command] = msg.split(':');
            const slave = devices.slaves.get(slaveId);
            if (slave && slave.readyState === WebSocket.OPEN) {
                slave.send(command);
            }
        }
    });

    ws.on('close', () => {
        devices.slaves.forEach((value, key) => {
            if (value === ws) devices.slaves.delete(key);
        });
        devices.masters.delete(ws);
        console.log('Cliente desconectado');
        updateMasters();
    });
});

function updateMasters() {
    const slaveList = Array.from(devices.slaves.keys());
    devices.masters.forEach(master => {
        if (master.readyState === WebSocket.OPEN) {
            master.send(JSON.stringify({
                type: 'slave_list',
                slaves: slaveList,
                count: slaveList.length
            }));
        }
    });
}

function sendSlaveList(ws) {
    if (ws.readyState === WebSocket.OPEN) {
        const slaveList = Array.from(devices.slaves.keys());
        ws.send(JSON.stringify({
            type: 'slave_list',
            slaves: slaveList,
            count: slaveList.length
        }));
    }
}

const port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`Servidor listo en puerto ${port}`);
});
