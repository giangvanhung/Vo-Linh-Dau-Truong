import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';

const origin = new URL(process.argv[2] ?? 'http://localhost:5173');
const sockets = [];
async function join(parameters) {
  const url = new URL('/lan', origin);
  url.protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:';
  url.search = new URLSearchParams(parameters);
  const socket = new WebSocket(url, { origin: origin.origin });
  sockets.push(socket);
  const inbox = [];
  const waiting = new Set();
  socket.on('message', data => {
    const event = JSON.parse(data);
    inbox.push(event);
    for (const notify of waiting) notify();
  });
  await once(socket, 'open');
  return {
    send: message => socket.send(JSON.stringify(message)),
    close: () => socket.close(),
    receive(predicate) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiting.delete(check);
          reject(new Error('Timed out waiting for controller message'));
        }, 3000);
        function check() {
          const index = inbox.findIndex(predicate);
          if (index < 0) return;
          waiting.delete(check);
          clearTimeout(timer);
          resolve(inbox.splice(index, 1)[0]);
        }
        waiting.add(check);
        check();
      });
    },
  };
}

try {
  const host = await join({ role: 'host', directionBatch: '1' });
  const { options } = await host.receive(message => message.type === 'room');
  assert(options.length, 'No reachable interface advertised');
  assert(options[0].qr?.startsWith('data:image/png'));
  const link = new URL(options[0].link);
  assert.equal(link.pathname, '/controller');
  const room = link.searchParams.get('room');
  const p1 = await join({ room, player: '1' });
  const p2 = await join({ room, player: '2' });
  await host.receive(message => message.type === 'status' && message.connected.every(Boolean));
  for (const [index, player] of [p1, p2].entries()) {
    for (const down of [true, false]) {
      player.send({ type: 'direction', changes: [['d', down]] });
      const event = await host.receive(message => message.type === 'direction' && message.player === index + 1);
      assert.deepEqual(event.changes, [['d', down]]);
    }
  }
  p2.close();
  await host.receive(message => message.type === 'reset' && message.player === 2);
  const reconnect = await join({ room, player: '2' });
  assert.equal((await reconnect.receive(message => message.type === 'joined')).player, 2);
  console.log('LAN WebSocket: room, QR, two slots, press/release, disconnect reset and rejoin passed');
} finally {
  for (const socket of sockets) socket.close();
}
