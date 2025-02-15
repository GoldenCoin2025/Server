const http = require('http');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('🚀 Remote Control v5.0 - Funcional 🚀');
});

const wss = new WebSocket.Server({ server });

const devices = {
    slaves: new Map(),
    masters: new Set()
};

wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[+] Conexión desde: ${ip}`);

    ws.on('message', (message) => {
        try {
            const msg = message.toString();
            console.log(`[${ip}] Mensaje: ${msg}`);

            if (msg.startsWith('ESCLAVO-')) {
                devices.slaves.set(msg, ws);
                console.log(`[SLAVE] ${msg} registrado`);
                broadcastSlaves();
            } else if (msg === 'MAESTRO') {
                devices.masters.add(ws);
                console.log(`[MASTER] ${ip} listo`);
                sendSlaveList(ws); // Enviar lista INMEDIATAMENTE
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
    devices.masters.forEach(master => {
        if (master.readyState === WebSocket.OPEN) {
            master.send(JSON.stringify({
                action: "UPDATE",
                slaves: slaveList,
                timestamp: Date.now()
            }));
        }
    });
}

function sendSlaveList(ws) {
    if (ws.readyState === WebSocket.OPEN) {
        const slaveList = Array.from(devices.slaves.keys());
        console.log(`[DEBUG] Enviando lista a MASTER: ${slaveList}`);
        ws.send(JSON.stringify({
            action: "INIT",
            slaves: slaveList,
            timestamp: Date.now()
        }));
    }
}

const port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`✅ Servidor ACTIVO en puerto: ${port}`);
});
