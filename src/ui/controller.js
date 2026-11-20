import { lanSocket } from '../platform/lan.js';

const query = new URLSearchParams(location.search);
const room = query.get('room');
const label = document.querySelector('#connection');
const join = document.querySelector('#join');
const leave = document.querySelector('#leave');
const pad = document.querySelector('#pad');
const stick = document.querySelector('#stick');
const arrows = pad.querySelector('.direction');
const directionMode = document.querySelector('#direction-mode');
const expand = document.querySelector('#expand-pad');
const fullscreenRoot = document.documentElement;
const directions = new Set();
let stickPointer = null;
const pointers = new Map();
let socket, heartbeat;

function send(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function reset() {
  for (const button of pointers.values()) button.classList.remove('is-down');
  pointers.clear();
  directions.clear();
  stickPointer = null;
  centerStick();
  send({ type: 'reset' });
}

function showJoin(message) {
  reset();
  clearInterval(heartbeat);
  label.textContent = message;
  setExpanded(false);
  exitFullscreen();
  pad.hidden = leave.hidden = true;
  join.hidden = !room;
}

if (query.get('solo') === '1') join.querySelector('[data-player="2"]').hidden = true;

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

function setExpanded(enabled) {
  document.body.classList.toggle('pad-expanded', enabled);
  expand.setAttribute('aria-pressed', String(enabled));
  expand.textContent = enabled ? 'Thu nhỏ' : 'Toàn màn hình';
}

function fullscreenElement() {
  return document.fullscreenElement ?? document.webkitFullscreenElement;
}

async function exitFullscreen() {
  if (fullscreenElement() !== fullscreenRoot) return;
  const exit = document.exitFullscreen ?? document.webkitExitFullscreen;
  try {
    await exit?.call(document);
  } catch {
    // The browser can exit on its own while the connection is closing.
  }
}

expand.onclick = async () => {
  const enabled = !document.body.classList.contains('pad-expanded');
  setExpanded(enabled);
  if (!enabled) {
    await exitFullscreen();
    return;
  }
  const request = fullscreenRoot.requestFullscreen ?? fullscreenRoot.webkitRequestFullscreen;
  try {
    await request?.call(fullscreenRoot);
    if (!document.body.classList.contains('pad-expanded')) await exitFullscreen();
  } catch {
    // Keep the controller expanded within the browser viewport.
  }
};

for (const eventName of ['fullscreenchange', 'webkitfullscreenchange']) {
  document.addEventListener(eventName, () => {
    if (!fullscreenElement()) setExpanded(false);
  });
}

directionMode.onclick = () => {
  reset();
  const enabled = stick.hidden;
  stick.hidden = !enabled;
  arrows.hidden = enabled;
  directionMode.setAttribute('aria-pressed', String(enabled));
  directionMode.textContent = enabled ? 'Nút hướng' : 'Joystick';
};

function centerStick() {
  stick.style.setProperty('--stick-x', '0px');
  stick.style.setProperty('--stick-y', '0px');
}

function updateDirections(next) {
  for (const button of directions) {
    if (!next.has(button)) send({ type: 'input', button, down: false });
  }
  for (const button of next) {
    if (!directions.has(button)) send({ type: 'input', button, down: true });
  }
  directions.clear();
  for (const button of next) directions.add(button);
}

function moveStick(event) {
  if (event.pointerId !== stickPointer) return;
  const rect = stick.getBoundingClientRect();
  const x = event.clientX - rect.left - rect.width / 2;
  const y = event.clientY - rect.top - rect.height / 2;
  const travel = rect.width * 0.28;
  const scale = Math.min(1, travel / Math.max(1, Math.hypot(x, y)));
  stick.style.setProperty('--stick-x', x * scale + 'px');
  stick.style.setProperty('--stick-y', y * scale + 'px');
  const threshold = travel * 0.4;
  const next = new Set();
  if (Math.abs(x) > threshold) next.add(x < 0 ? 'a' : 'd');
  if (Math.abs(y) > threshold) next.add(y < 0 ? 'w' : 's');
  updateDirections(next);
}

stick.addEventListener('pointerdown', event => {
  if (event.button !== 0 || stickPointer !== null) return;
  event.preventDefault();
  stickPointer = event.pointerId;
  stick.setPointerCapture(event.pointerId);
  moveStick(event);
});
stick.addEventListener('pointermove', moveStick);
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  stick.addEventListener(eventName, event => {
    if (event.pointerId !== stickPointer) return;
    stickPointer = null;
    centerStick();
    updateDirections(new Set());
  });
}

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
