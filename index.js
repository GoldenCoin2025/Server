const http = require('http');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('🚀 Remote Control Server - by ZeusOdin');
});

const wss = new WebSocket.Server({ server });

const devices = {
    slaves: new Map(),
    masters: new Set()
};

wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[+] Nueva conexión desde: ${ip}`);

    ws.on('message', (message) => {
        try {
            const msg = message.toString();
            console.log(`[DEBUG] ${ip} -> ${msg}`);

            // Registrar esclavo
            if (msg.startsWith('ESCLAVO-')) {
                devices.slaves.set(msg, ws);
                console.log(`[SLAVE] ${msg} registrado`);
                broadcastSlaves();
            }
            // Registrar maestro
            else if (msg === 'MAESTRO') {
                devices.masters.add(ws);
                console.log(`[MASTER] ${ip} autenticado`);
                sendSlaveList(ws);
            }

        } catch (e) {
            console.error(`[ERROR] ${ip}: ${e.message}`);
        }
    });

    ws.on('close', () => {
        devices.slaves.forEach((v, k) => { if (v === ws) devices.slaves.delete(k); });
        devices.masters.delete(ws);
        broadcastSlaves();
        console.log(`[-] ${ip} desconectado`);
    });
});

function broadcastSlaves() {
    const slaveList = Array.from(devices.slaves.keys());
    const data = JSON.stringify({ type: 'slaves', count: slaveList.length, slaves: slaveList });
    
    devices.masters.forEach(master => {
        if (master.readyState === WebSocket.OPEN) {
            master.send(data);
        }
    });
}

function sendSlaveList(ws) {
    if (ws.readyState === WebSocket.OPEN) {
        const slaveList = Array.from(devices.slaves.keys());
        ws.send(JSON.stringify({ type: 'slaves', count: slaveList.length, slaves: slaveList }));
    }
}

const port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`✅ Servidor activo en puerto: ${port}`);
    console.log(`🔗 URL pública: ${process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost'}`);
});
