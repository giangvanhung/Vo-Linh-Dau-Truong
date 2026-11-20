import { randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import QRCode from 'qrcode';
import { WebSocket, WebSocketServer } from 'ws';

const buttons = new Set(['a','d','w','s','p','j','k','l','q','r','t','u','i','o','f','g','enhanced']);
const send = (socket, message) => {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
};

export function attachLan(server) {
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 512 });
  const rooms = new Map();

  server.on('upgrade', (request, socket, head) => {
    const origin = request.headers.origin;
    const host = request.headers.host;
    let path;
    try {
      const url = new URL(request.url, 'http://' + host);
      if (url.pathname !== '/lan' || !origin || new URL(origin).host !== host) throw new Error();
      path = url;
    } catch {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    sockets.handleUpgrade(request, socket, head, client => {
      sockets.emit('connection', client, path, request);
    });
  });

  function status(room) {
    send(room.host, { type: 'status', connected: room.players.map(Boolean) });
  }

  sockets.on('connection', (socket, url, request) => {
    socket.alive = true;
    socket.on('error', () => socket.terminate());
    socket.on('pong', () => { socket.alive = true; });
    if (url.searchParams.get('role') === 'host') {
      if (rooms.size >= 32) return socket.close(1013, 'Server busy');
      const id = randomBytes(12).toString('base64url');
      const solo = url.searchParams.get('solo') === '1';
      const room = { host: socket, players: solo ? [null] : [null, null] };
      rooms.set(id, room);
      socket.on('close', () => {
        rooms.delete(id);
        for (const player of room.players) player?.close(4002, 'Room closed');
      });
      const origin = new URL(request.headers.origin);
      const addresses = Object.values(networkInterfaces()).flat()
        .filter(address => address.family === 'IPv4' && !address.internal)
        .map(address => address.address);
      const controllerLink = address => {
        const link = new URL('/controller', origin);
        link.hostname = address;
        link.searchParams.set('room', id);
        if (solo) link.searchParams.set('solo', '1');
        return link.href;
      };
      const urls = [...new Set(addresses)].map(controllerLink);
      if (!['localhost','127.0.0.1','[::1]'].includes(origin.hostname)) {
        urls.unshift(controllerLink(origin.hostname));
      }
      const links = [...new Set(urls)];
      Promise.all(links.map(async link => ({ link, qr: await QRCode.toDataURL(link, { width: 180, margin: 2 }) })))
        .then(options => send(socket, { type: 'room', options }))
        .catch(() => send(socket, { type: 'room', options: links.map(link => ({ link })) }));
      status(room);
      return;
    }

    const room = rooms.get(url.searchParams.get('room'));
    const index = ['1', '2'].indexOf(url.searchParams.get('player'));
    if (!room || index < 0 || index >= room.players.length) return socket.close(4002, 'Slot unavailable');
    if (room.players[index]) return socket.close(4003, 'Slot occupied');
    room.players[index] = socket;
    const player = index + 1;
    socket.lastInput = Date.now();
    socket.on('close', () => {
      room.players[index] = null;
      send(room.host, { type: 'reset', player });
      status(room);
    });
    send(socket, { type: 'joined', player });
    status(room);
    socket.on('message', raw => {
      socket.lastInput = Date.now();
      try {
        const message = JSON.parse(raw);
        if (message.type === 'reset') send(room.host, { type: 'reset', player });
        if (message.type === 'input' && buttons.has(message.button) && typeof message.down === 'boolean') {
          send(room.host, { type: 'input', player, button: message.button, down: message.down });
        }
      } catch { /* Ignore malformed controller messages. */ }
    });
  });

  const check = setInterval(() => {
    for (const socket of sockets.clients) {
      if (!socket.alive || (socket.lastInput && Date.now() - socket.lastInput > 3500)) {
        socket.terminate();
        continue;
      }
      socket.alive = false;
      socket.ping();
    }
  }, 1500);
  check.unref();
  server.on('close', () => clearInterval(check));
}
