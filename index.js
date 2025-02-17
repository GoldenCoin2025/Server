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

// Función para validar JSON
function isJSON(str) {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}

wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[+] Conexión desde: ${ip}`);

    ws.on('message', (message) => {
        try {
            const msg = message.toString();
            console.log(`[${ip}] Mensaje recibido: ${msg}`);

            if (isJSON(msg)) {
                const data = JSON.parse(msg);
                handleJSONMessage(ws, data);
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

function handleJSONMessage(ws, data) {
    switch(data.action) {
        case 'command':
            handleCommand(data);
            break;
            
        case 'MAESTRO':
            registerMaster(ws);
            break;
            
        case 'ACTUALIZAR_LISTA':
            sendSlaveList(ws);
            break;
            
        default:
            console.log(`[UNKNOWN ACTION] ${JSON.stringify(data)}`);
    }
}

function handleTextMessage(ws, msg) {
    if (msg.startsWith('ESCLAVO-')) {
        registerSlave(msg, ws);
    } else {
        console.log(`[TEXT MESSAGE] ${msg}`);
    }
}

function handleCommand(data) {
    if (!data.target || !data.command) {
        console.log('[COMMAND ERROR] Formato de comando inválido');
        return;
    }
    
    console.log(`[COMMAND] Recibido comando ${data.command} para ${data.target}`);
    sendCommandToSlave(data.target, data.command);
}

function registerMaster(ws) {
    devices.masters.add(ws);
    console.log('[MASTER] Nuevo maestro registrado');
    sendSlaveList(ws);
}

function registerSlave(slaveId, ws) {
    devices.slaves.set(slaveId, ws);
    console.log(`[SLAVE] ${slaveId} registrado`);
    broadcastSlaves();
}

function cleanupDisconnected(ws) {
    // Limpiar esclavos
    devices.slaves.forEach((value, key) => {
        if (value === ws) devices.slaves.delete(key);
    });
    
    // Limpiar maestros
    devices.masters.delete(ws);
    
    broadcastSlaves();
}

function sendCommandToSlave(slaveId, command) {
    const slaveSocket = devices.slaves.get(slaveId);
    
    if (!slaveSocket) {
        console.log(`[ERROR] Esclavo ${slaveId} no encontrado`);
        return;
    }
    
    if (slaveSocket.readyState !== WebSocket.OPEN) {
        console.log(`[ERROR] Esclavo ${slaveId} no conectado`);
        return;
    }

    try {
        slaveSocket.send(JSON.stringify({
            action: "execute",
            command: command,
            timestamp: Date.now()
        }));
        console.log(`[COMMAND] Comando ${command} enviado a ${slaveId}`);
    } catch (e) {
        console.log(`[ERROR] Error enviando comando a ${slaveId}: ${e.message}`);
    }
}

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

function cleanDisconnectedSlaves() {
    devices.slaves.forEach((ws, slaveId) => {
        if (ws.readyState !== WebSocket.OPEN) {
            devices.slaves.delete(slaveId);
            console.log(`[CLEANUP] Esclavo ${slaveId} eliminado`);
        }
    });
}

function sendSlaveList(ws) {
    if (ws.readyState === WebSocket.OPEN) {
        const slaveList = Array.from(devices.slaves.keys());
        ws.send(JSON.stringify({
            action: "init",
            slaves: slaveList,
            count: slaveList.length,
            timestamp: Date.now()
        }));
    }
}

const port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`✅ Servidor ACTIVO en puerto: ${port}`);
});
