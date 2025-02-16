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
                // Registrar dispositivo esclavo
                devices.slaves.set(msg, ws);
                console.log(`[SLAVE] ${msg} registrado`);
                broadcastSlaves();
            } else if (msg === 'MAESTRO') {
                // Registrar dispositivo maestro
                devices.masters.add(ws);
                console.log(`[MASTER] ${ip} listo`);
                sendSlaveList(ws); // Enviar lista INMEDIATAMENTE
            } else if (msg.startsWith('START_SCREENSHARE:')) {
                // Comando para capturar pantalla
                const slaveId = msg.replace('START_SCREENSHARE:', '');
                startScreenShareCommand(slaveId);
            }
        } catch (e) {
            console.error(`[ERROR] ${ip}: ${e.message}`);
        }
    });

    ws.on('close', () => {
        // Eliminar esclavo o maestro desconectado
        devices.slaves.forEach((v, k) => { if (v === ws) devices.slaves.delete(k); });
        devices.masters.delete(ws);
        broadcastSlaves();
        console.log(`[-] ${ip} desconectado`);
    });
});

// Función para enviar lista de esclavos a los maestros
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

// Función para enviar la lista de esclavos a un maestro específico
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

// Función para enviar el comando de captura de pantalla a un esclavo
function startScreenShareCommand(slaveId) {
    const slaveSocket = devices.slaves.get(slaveId);
    if (slaveSocket) {
        // Enviar comando al esclavo para iniciar la captura de pantalla
        if (slaveSocket.readyState === WebSocket.OPEN) {
            slaveSocket.send(JSON.stringify({
                action: "START_SCREENSHARE",
                timestamp: Date.now()
            }));
            console.log(`[COMMAND] Enviado comando START_SCREENSHARE al esclavo ${slaveId}`);
        } else {
            console.log(`[ERROR] El esclavo ${slaveId} no está disponible`);
        }
    } else {
        console.log(`[ERROR] Esclavo con ID ${slaveId} no encontrado`);
    }
}

// Iniciar servidor
const port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`✅ Servidor ACTIVO en puerto: ${port}`);
});
