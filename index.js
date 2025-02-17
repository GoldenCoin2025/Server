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
    slaves: new Map(),  // Almacena los esclavos (ID del esclavo -> WebSocket)
    masters: new Set()   // Almacena los maestros (WebSocket)
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
            } else if (msg === 'ACTUALIZAR_LISTA') {
                // Solicitar la lista de esclavos
                console.log(`[${ip}] Solicitud de actualización de lista`);
                sendSlaveList(ws);  // Enviar lista de esclavos al maestro
            } else if (msg.startsWith('COMANDO:')) {
                // Comando enviado por el maestro al esclavo
                const [comando, slaveId] = parseComando(msg);
                if (comando && slaveId) {
                    console.log(`[COMMAND] Enviando comando ${comando} al esclavo ${slaveId}`);
                    sendCommandToSlave(slaveId, comando);
                }
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

// Función para eliminar esclavos desconectados de la lista
function cleanDisconnectedSlaves() {
    devices.slaves.forEach((ws, slaveId) => {
        if (ws.readyState !== WebSocket.OPEN) {
            console.log(`[DEBUG] El esclavo ${slaveId} está desconectado, eliminándolo de la lista`);
            devices.slaves.delete(slaveId);
        }
    });
}

// Función para enviar lista de esclavos a los maestros
function broadcastSlaves() {
    cleanDisconnectedSlaves();  // Limpiar esclavos desconectados antes de enviar la lista

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
    cleanDisconnectedSlaves();  // Limpiar esclavos desconectados antes de enviar la lista

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

// Función para enviar el comando de un maestro a un esclavo
function sendCommandToSlave(slaveId, comando) {
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

    console.log(`[DEBUG] Enviando comando ${comando} al esclavo ${slaveId}`);
    slaveSocket.send(JSON.stringify({
        action: "COMMAND",
        command: comando,
        timestamp: Date.now()
    }));
    
    // Confirmar el envío del comando
    console.log(`[COMMAND] Comando ${comando} enviado al esclavo ${slaveId}`);
}

// Función para parsear el mensaje del comando y extraer el esclavo y el comando
function parseComando(msg) {
    const match = msg.match(/^COMANDO: (.*?) a (ESCLAVO-.*)$/);
    if (match) {
        return [match[1], match[2]];  // [comando, slaveId]
    }
    return [null, null];
}

// Iniciar servidor HTTP en el puerto especificado
const port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`✅ Servidor ACTIVO en puerto: ${port}`);
});
