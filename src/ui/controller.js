import { lanSocket } from '../platform/lan.js';

const query = new URLSearchParams(location.search);
const room = query.get('room');
const label = document.querySelector('#connection');
const join = document.querySelector('#join');
const leave = document.querySelector('#leave');
const qrReconnect = document.querySelector('#qr-reconnect');
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

function showJoin(message, expired = false) {
  reset();
  clearInterval(heartbeat);
  label.textContent = message;
  setExpanded(false);
  exitFullscreen();
  pad.hidden = leave.hidden = true;
  join.hidden = !room || expired;
  qrReconnect.hidden = false;
}

const qrCamera = document.querySelector('#qr-camera');
const qrImage = document.querySelector('#qr-image');
const scanQr = document.querySelector('#scan-qr');
const chooseQr = document.querySelector('#choose-qr');
scanQr.onclick = () => qrCamera.click();
chooseQr.onclick = () => qrImage.click();

async function readRoomQr(event) {
  const input = event.currentTarget;
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  scanQr.disabled = chooseQr.disabled = true;
  label.textContent = 'Đang đọc mã QR…';
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = globalThis.jsQR(pixels.data, pixels.width, pixels.height);
    if (!code) {
      label.textContent = 'Chưa đọc được mã QR. Hãy chụp gần hơn và lấy trọn mã.';
      return;
    }
    const link = URL.canParse(code.data) ? new URL(code.data) : null;
    if (!link || !['http:', 'https:'].includes(link.protocol) || link.username || link.password
        || link.pathname !== '/controller' || !/^[A-Za-z0-9_-]{16}$/.test(link.searchParams.get('room') ?? '')) {
      label.textContent = 'Mã này không phải mã QR phòng tay cầm.';
      return;
    }
    location.assign(link.href);
  } catch {
    label.textContent = 'Không đọc được ảnh. Hãy thử chụp lại hoặc chọn ảnh khác.';
  } finally {
    URL.revokeObjectURL(objectUrl);
    scanQr.disabled = chooseQr.disabled = false;
  }
}

qrCamera.addEventListener('change', readRoomQr);
qrImage.addEventListener('change', readRoomQr);

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
      qrReconnect.hidden = true;
      heartbeat = setInterval(() => send({ type: 'heartbeat' }), 750);
    };
    connection.onclose = event => {
      if (socket !== connection) return;
      socket = undefined;
      showJoin(event.code === 4003 ? 'Vị trí này đang được dùng. Hãy chọn vị trí khác.'
        : event.code === 4002 ? 'Liên kết đã hết hạn. Mở phòng trên máy tính rồi bấm Quét QR mới.'
        : 'Mất kết nối. Thử vào lại hoặc quét mã QR mới.', event.code === 4002);
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
