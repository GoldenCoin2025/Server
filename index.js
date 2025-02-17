const http = require('http');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('🚀 Remote Control v6.0 - Conexión Estable 🚀');
});

const wss = new WebSocket.Server({ server });

const devices = {
    slaves: new Map(),
    masters: new Set()
};

// ================== FUNCIONES AUXILIARES ==================
function isJSON(str) {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}

function cleanDisconnectedSlaves() {
    devices.slaves.forEach((ws, slaveId) => {
        if (ws.readyState !== WebSocket.OPEN) {
            devices.slaves.delete(slaveId);
            console.log(`[CLEANUP] Esclavo ${slaveId} eliminado`);
        }
    });
}

// ================== MANEJO DE CONEXIONES ==================
wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[+] Conexión desde: ${ip}`);

    ws.on('message', (message) => {
        try {
            const msg = message.toString();
            console.log(`[${ip}] Mensaje recibido: ${msg}`);

            if (isJSON(msg)) {
                const data = JSON.parse(msg);
                handleJSONMessage(data, ws);
            } else {
                handleTextMessage(ws, msg);
            }
        } catch (e) {
            console.error(`[ERROR] ${ip}: ${e.message}`);
        }
    });

    ws.on('close', () => {
        cleanupDisconnected(ws);
        console.log(`[-] ${ip} desconectado`);
    });
});

// ================== MANEJO DE MENSAJES ==================
function handleJSONMessage(data, ws) {
    switch(data.action) {
        case 'command':
            if (data.target && data.command) {
                console.log(`[COMMAND] Comando ${data.command} para ${data.target}`);
                sendCommandToSlave(data.target, data.command);
            }
            break;
            
        case 'confirmation':
            const slaveEntry = Array.from(devices.slaves).find(([id, socket]) => socket === ws);
            const slaveId = slaveEntry ? slaveEntry[0] : 'Desconocido';
            console.log(`[CONFIRM] ${slaveId} confirmó comando: ${data.command} (Estado: ${data.status})`);
            break;
            
        default:
            console.log(`[ACTION DESCONOCIDA] ${JSON.stringify(data)}`);
    }
}

function handleTextMessage(ws, msg) {
    switch(msg) {
        case 'MAESTRO':
            registerMaster(ws);
            break;
            
        case 'ACTUALIZAR_LISTA':
            sendSlaveList(ws);
            break;
            
        default:
            if (msg.startsWith('ESCLAVO-')) {
                registerSlave(msg, ws);
            } else {
                console.log(`[MENSAJE TEXTO] ${msg}`);
            }
    }
}

// ================== FUNCIONES PRINCIPALES ==================
function registerMaster(ws) {
    devices.masters.add(ws);
    console.log('[MASTER] Nuevo maestro registrado');
    sendSlaveList(ws);
    broadcastSlaves();
}

function registerSlave(slaveId, ws) {
    devices.slaves.set(slaveId, ws);
    console.log(`[SLAVE] ${slaveId} registrado`);
    broadcastSlaves();
}

function cleanupDisconnected(ws) {
    devices.slaves.forEach((value, key) => {
        if (value === ws) {
            devices.slaves.delete(key);
            console.log(`[CLEANUP] Esclavo ${key} eliminado`);
        }
    });
    
    if (devices.masters.has(ws)) {
        devices.masters.delete(ws);
        console.log('[CLEANUP] Master eliminado');
    }
    
    broadcastSlaves();
}

function sendCommandToSlave(slaveId, command) {
    const slaveSocket = devices.slaves.get(slaveId);
    
    if (!slaveSocket) {
        console.log(`[ERROR] Esclavo ${slaveId} no encontrado`);
        return;
    }
    
    if (slaveSocket.readyState === WebSocket.OPEN) {
        slaveSocket.send(JSON.stringify({
            action: "execute",
            command: command,
            timestamp: Date.now()
        }));
        console.log(`[COMMAND_OK] ${command} enviado a ${slaveId}`);
    } else {
        console.log(`[ERROR] Esclavo ${slaveId} no conectado`);
    }
}

// ================== ACTUALIZACIÓN DE LISTAS ==================
function broadcastSlaves() {
    cleanDisconnectedSlaves();
    const slaveList = Array.from(devices.slaves.keys());
    
    devices.masters.forEach(master => {
        if (master.readyState === WebSocket.OPEN) {
            master.send(JSON.stringify({
                action: "update",
                slaves: slaveList,
                count: slaveList.length,
                timestamp: Date.now()
            }));
        }
    });
}

function sendSlaveList(ws) {
    cleanDisconnectedSlaves();
    const slaveList = Array.from(devices.slaves.keys());
    
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            action: "init",
            slaves: slaveList,
            count: slaveList.length,
            timestamp: Date.now()
        }));
        console.log(`[LIST_SENT] Lista enviada a maestro (${slaveList.length} esclavos)`);
    }
}

// ================== INICIAR SERVIDOR ==================
const port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`✅ Servidor ACTIVO en puerto: ${port}`);
});
