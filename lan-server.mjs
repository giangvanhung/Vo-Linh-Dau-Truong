import { randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import QRCode from 'qrcode';
import { WebSocket, WebSocketServer } from 'ws';

const buttons = new Set(['a','d','w','s','p','j','k','l','q','r','t','u','i','o','f','g','enhanced']);
const send = (socket, message) => {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
};

const networkPriority = { wifi: 0, ethernet: 1, other: 2, virtual: 3 };

function networkType(name) {
  if (/vpn|radmin|tailscale|zerotier|hamachi|wireguard|tap-windows|virtual|vethernet|vmware|wsl|hyper-v|wi-fi direct/i.test(name)) return 'virtual';
  if (/wi[ -]?fi|wireless|wlan|802\.11/i.test(name)) return 'wifi';
  if (/ethernet|^eth\d|^en[opsx]\d|^local area connection/i.test(name)) return 'ethernet';
  return 'other';
}

export function attachLan(server) {
  const allowedOrigins = new Set((process.env.LAN_ALLOWED_ORIGINS ?? '').split(',').map(origin => origin.trim()).filter(Boolean));
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 512 });
  const rooms = new Map();

  server.on('upgrade', (request, socket, head) => {
    const origin = request.headers.origin;
    const host = request.headers.host;
    let path;
    try {
      const url = new URL(request.url, 'http://' + host);
      if (url.pathname !== '/lan' || !origin || (new URL(origin).host !== host && !allowedOrigins.has(origin))) throw new Error();
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
    socket.missedPongs = 0;
    socket.on('error', () => socket.terminate());
    socket.on('pong', () => { socket.missedPongs = 0; });
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
      const online = allowedOrigins.has(origin.origin);
      const addresses = online ? [{ address: origin.hostname, name: '', type: 'online' }]
        : Object.entries(networkInterfaces()).flatMap(([name, entries]) =>
        entries.filter(entry => entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.'))
          .map(entry => ({ address: entry.address, name, type: networkType(name) })));
      if (!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
          && !addresses.some(entry => entry.address === origin.hostname)) {
        addresses.push({ address: origin.hostname, name: '', type: 'other' });
      }
      if (!online) {
        addresses.sort((a, b) => networkPriority[a.type] - networkPriority[b.type]
          || Number(b.address === origin.hostname) - Number(a.address === origin.hostname));
      }
      const controllerLink = address => {
        const link = new URL('/controller', origin);
        link.hostname = address;
        link.searchParams.set('room', id);
        if (solo) link.searchParams.set('solo', '1');
        return link.href;
      };
      const seen = new Set();
      const links = [];
      for (const { address, name, type } of addresses) {
        if (seen.has(address)) continue;
        seen.add(address);
        links.push({ link: controllerLink(address), name, type });
      }
      Promise.all(links.map(async option => ({
        ...option,
        qr: await QRCode.toDataURL(option.link, { scale: 10, margin: 4 }),
      })))
        .then(options => send(socket, { type: 'room', options }))
        .catch(() => send(socket, { type: 'room', options: links }));
      status(room);
      return;
    }

    const room = rooms.get(url.searchParams.get('room'));
    const index = ['1', '2'].indexOf(url.searchParams.get('player'));
    if (!room || index < 0 || index >= room.players.length) return socket.close(4002, 'Slot unavailable');
    if (room.players[index]) return socket.close(4003, 'Slot occupied');
    room.players[index] = socket;
    const player = index + 1;
    socket.releaseStaleInput = now => {
      if (!socket.lastInput || now - socket.lastInput <= 3500) return;
      socket.lastInput = 0;
      send(room.host, { type: 'reset', player });
    };
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
        if (message.type === 'heartbeat' && Number.isFinite(message.sentAt)) {
          send(socket, { type: 'heartbeat', sentAt: message.sentAt });
        }
        if (message.type === 'reset') send(room.host, { type: 'reset', player });
        if (message.type === 'input' && buttons.has(message.button) && typeof message.down === 'boolean') {
          send(room.host, { type: 'input', player, button: message.button, down: message.down });
        }
      } catch { /* Ignore malformed controller messages. */ }
    });
  });

  const check = setInterval(() => {
    const now = Date.now();
    for (const socket of sockets.clients) {
      if (socket.missedPongs >= 5) {
        socket.terminate();
        continue;
      }
      socket.releaseStaleInput?.(now);
      socket.missedPongs++;
      socket.ping();
    }
  }, 1500);
  check.unref();
  server.on('close', () => clearInterval(check));
}
