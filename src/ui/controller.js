import { lanSocket } from '../platform/lan.js';

const room = new URLSearchParams(location.search).get('room');
const label = document.querySelector('#connection');
const join = document.querySelector('#join');
const leave = document.querySelector('#leave');
const pad = document.querySelector('#pad');
const pointers = new Map();
let socket, heartbeat;

function send(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function reset() {
  for (const button of pointers.values()) button.classList.remove('is-down');
  pointers.clear();
  send({ type: 'reset' });
}

function showJoin(message) {
  reset();
  clearInterval(heartbeat);
  label.textContent = message;
  pad.hidden = leave.hidden = true;
  join.hidden = !room;
}

for (const button of join.querySelectorAll('button')) {
  button.onclick = () => {
    join.hidden = true;
    label.textContent = 'Đang kết nối…';
    const connection = socket = lanSocket({ room, player: button.dataset.player });
    connection.onmessage = ({ data }) => {
      if (socket !== connection || JSON.parse(data).type !== 'joined') return;
      label.textContent = 'Đã kết nối P' + button.dataset.player;
      pad.hidden = leave.hidden = false;
      heartbeat = setInterval(() => send({ type: 'heartbeat' }), 750);
    };
    connection.onclose = event => {
      if (socket !== connection) return;
      socket = undefined;
      showJoin(event.code === 4003 ? 'Vị trí này đang được dùng. Hãy chọn vị trí khác.'
        : event.code === 4002 ? 'Phòng đã đóng hoặc liên kết đã hết hạn.'
        : 'Mất kết nối. Chọn lại vị trí để thử lại.');
    };
  };
}

leave.onclick = () => {
  reset();
  const connection = socket;
  socket = undefined;
  connection?.close();
  showJoin('Đã rời tay cầm.');
};

pad.addEventListener('pointerdown', event => {
  const button = event.target.closest('[data-key]');
  if (!button || event.button !== 0) return;
  event.preventDefault();
  button.setPointerCapture(event.pointerId);
  const alreadyHeld = [...pointers.values()].includes(button);
  pointers.set(event.pointerId, button);
  button.classList.add('is-down');
  if (!alreadyHeld) send({ type: 'input', button: button.dataset.key, down: true });
});

function release(event) {
  const button = pointers.get(event.pointerId);
  if (!button) return;
  pointers.delete(event.pointerId);
  if ([...pointers.values()].includes(button)) return;
  button.classList.remove('is-down');
  send({ type: 'input', button: button.dataset.key, down: false });
}

for (const event of ['pointerup','pointercancel','lostpointercapture']) pad.addEventListener(event, release);
pad.addEventListener('contextmenu', event => event.preventDefault());
window.addEventListener('blur', reset);
window.addEventListener('pagehide', () => {
  reset();
  socket?.close();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
if (!room) showJoin('Quét mã QR trên máy tính để mở tay cầm.');
