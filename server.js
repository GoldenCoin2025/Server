const net = require('net');
const crypto = require('crypto');

const slaves = new Map();
const masters = new Set();
const WEBSOCKET_KEY = "dGhlIHNhbXBsZSBub25jZQ==";
const MAGIC_STRING = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const server = net.createServer((socket) => {
  let isWebSocket = false;
  let slaveId = null;

  socket.once('data', (data) => {
    const request = data.toString();
    
    if (request.includes('Upgrade: websocket')) {
      isWebSocket = true;
      
      // Handshake compatible con tu app esclava
      const accept = crypto.createHash('sha1')
        .update(WEBSOCKET_KEY + MAGIC_STRING)
        .digest('base64');

      const response = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${accept}`,
        '\r\n'
      ].join('\r\n');

      socket.write(response);

      socket.on('data', (data) => {
        const opcode = data[0] & 0x0F;
        if (opcode === 0x08) return;

        let payloadLength = data[1] & 0x7F;
        let maskOffset = 2;

        if (payloadLength === 126) {
          payloadLength = data.readUInt16BE(2);
          maskOffset = 4;
        } else if (payloadLength === 127) {
          payloadLength = data.readBigUInt64BE(2);
          maskOffset = 10;
        }

        const masks = data.slice(maskOffset, maskOffset + 4);
        const payload = data.slice(maskOffset + 4, maskOffset + 4 + payloadLength);

        const decoded = Buffer.alloc(payloadLength);
        for (let i = 0; i < payloadLength; i++) {
          decoded[i] = payload[i] ^ masks[i % 4];
        }

        const message = decoded.toString('utf-8');

        // Lógica de registro
        if (message.startsWith('ESCLAVO-')) {
          slaveId = message;
          slaves.set(slaveId, socket);
        } 
        else if (message === 'MAESTRO') {
          masters.add(socket);
          sendWebSocketMessage(socket, `ESCLAVOS|${Array.from(slaves.keys()).join(',')}`);
        }
        else if (masters.has(socket) && message.includes('|')) {
          const [targetId, command] = message.split('|');
          const target = slaves.get(targetId);
          if (target) sendWebSocketMessage(target, command);
        }
      });
    }
  });

  socket.on('end', () => {
    if (slaveId) slaves.delete(slaveId);
    if (masters.has(socket)) masters.delete(socket);
  });
});

function sendWebSocketMessage(socket, message) {
  const payload = Buffer.from(message, 'utf8');
  const frame = Buffer.alloc(2 + payload.length);
  frame[0] = 0x81;
  frame[1] = payload.length;
  payload.copy(frame, 2);
  socket.write(frame);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});
