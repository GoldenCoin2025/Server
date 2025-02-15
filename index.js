const http = require('http');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('🔥 Remote Control Server v4 🔥');
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
            console.log(`[${ip}] Mensaje: ${msg}`);

            if (msg.startsWith('ESCLAVO-')) {
                handleSlave(ws, msg, ip);
            } else if (msg === 'MAESTRO') {
                handleMaster(ws, ip);
            } else if (msg.startsWith('CMD:')) {
                handleCommand(msg);
            }

        } catch (e) {
            console.error(`[ERROR] ${ip}: ${e.message}`);
        }
    });

    ws.on('close', () => handleDisconnect(ws, ip));
});

function handleSlave(ws, id, ip) {
    devices.slaves.set(id, ws);
    console.log(`[SLAVE] ${id} registrado`);
    broadcastSlaves();
}

function handleMaster(ws, ip) {
    devices.masters.add(ws);
    console.log(`[MASTER] ${ip} autenticado`);
    sendSlaveList(ws);
}

function handleCommand(msg) {
    const [_, slaveId, command] = msg.split(':');
    const slave = devices.slaves.get(slaveId);
    if (slave?.readyState === WebSocket.OPEN) {
        slave.send(command);
    }
}

function handleDisconnect(ws, ip) {
    devices.slaves.forEach((v, k) => { if (v === ws) devices.slaves.delete(k); });
    devices.masters.delete(ws);
    broadcastSlaves();
    console.log(`[-] ${ip} desconectado`);
}

function broadcastSlaves() {
    const slaveList = Array.from(devices.slaves.keys());
    const data = JSON.stringify({ action: "UPDATE", slaves: slaveList });
    devices.masters.forEach(master => {
        if (master.readyState === WebSocket.OPEN) master.send(data);
    });
}

function sendSlaveList(ws) {
    if (ws.readyState === WebSocket.OPEN) {
        const slaveList = Array.from(devices.slaves.keys());
        ws.send(JSON.stringify({ action: "INIT", slaves: slaveList }));
    }
}

const port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`✅ Servidor activo en puerto ${port}`);
    console.log(`🌍 URL: ${process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost'}`);
});
