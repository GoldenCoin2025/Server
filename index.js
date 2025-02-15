const http = require('http');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Servidor Activo - Remote Control v1.0');
});

const wss = new WebSocket.Server({ 
    server,
    perMessageDeflate: {
        zlibDeflateOptions: { level: 1 }
    }
});

const devices = {
    slaves: new Map(),
    masters: new Set()
};

wss.on('connection', (ws) => {
    console.log('[+] Nueva conexión');

    ws.on('message', (message) => {
        try {
            const msg = message.toString();
            
            // Registrar esclavo
            if (msg.startsWith('ESCLAVO-')) {
                devices.slaves.set(msg, ws);
                console.log(`[SLAVE] ${msg} registrado`);
                updateMasters();
            }
            // Registrar maestro
            else if (msg === 'MAESTRO') {
                devices.masters.add(ws);
                console.log('[MASTER] Nuevo controlador conectado');
                sendSlaveList(ws);
            }
            // Comandos de control
            else if (msg.startsWith('CMD:')) {
                const [_, slaveId, command] = msg.split(':', 3);
                const slave = devices.slaves.get(slaveId);
                if (slave?.readyState === WebSocket.OPEN) {
                    slave.send(command);
                }
            }
        } catch (e) {
            console.error('[ERROR]', e.message);
        }
    });

    ws.on('close', () => {
        devices.slaves.forEach((v, k) => { if (v === ws) devices.slaves.delete(k); });
        devices.masters.delete(ws);
        updateMasters();
        console.log('[-] Cliente desconectado');
    });
});

function updateMasters() {
    const slaveList = Array.from(devices.slaves.keys());
    devices.masters.forEach(master => {
        if (master.readyState === WebSocket.OPEN) {
            master.send(JSON.stringify({
                type: 'devices',
                count: slaveList.length,
                slaves: slaveList
            }));
        }
    });
}

function sendSlaveList(ws) {
    if (ws.readyState === WebSocket.OPEN) {
        const slaveList = Array.from(devices.slaves.keys());
        ws.send(JSON.stringify({
            type: 'devices',
            count: slaveList.length,
            slaves: slaveList
        }));
    }
}

const port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`🚀 Servidor activo en puerto ${port}`);
});
