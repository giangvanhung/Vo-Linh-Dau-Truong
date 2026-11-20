import { lanSocket } from '../platform/lan.js';

const query = new URLSearchParams(location.search);
let room = query.get('room');
const label = document.querySelector('#connection');
const join = document.querySelector('#join');
const leave = document.querySelector('#leave');
const qrReconnect = document.querySelector('#qr-reconnect');
const pad = document.querySelector('#pad');
const network = document.querySelector('#pad-network');
const latency = document.querySelector('#pad-latency');
const stick = document.querySelector('#stick');
const arrows = pad.querySelector('.direction');
const directionMode = document.querySelector('#direction-mode');
const expand = document.querySelector('#expand-pad');
const rotate = document.querySelector('#rotate-pad');
const light = document.querySelector('#light-pad');
const chooseBackground = document.querySelector('#choose-pad-bg');
const clearBackground = document.querySelector('#clear-pad-bg');
const backgroundFile = document.querySelector('#pad-bg-file');
const portrait = matchMedia('(orientation: portrait)');
const fullscreenRoot = document.documentElement;
const directions = new Set();
let stickPointer = null;
let stickRect;
const pointers = new Map();
let socket, heartbeat, reconnectTimer;

function send(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function reset() {
  for (const button of pointers.values()) button.classList.remove('is-down');
  pointers.clear();
  directions.clear();
  stickPointer = null;
  stickRect = undefined;
  centerStick();
  send({ type: 'reset' });
}

function showJoin(message, expired = false) {
  reset();
  clearInterval(heartbeat);
  clearTimeout(reconnectTimer);
  label.textContent = message;
  setExpanded(false);
  exitFullscreen();
  pad.hidden = leave.hidden = true;
  document.body.classList.remove('pad-connected');
  join.hidden = !room || expired;
  qrReconnect.hidden = false;
}

const qrImage = document.querySelector('#qr-image');
const scanQr = document.querySelector('#scan-qr');
const scanner = document.querySelector('#qr-scanner');
const preview = document.querySelector('#qr-preview');
const playerTwo = join.querySelector('[data-player="2"]');
let scanSession;

function decodeQr(source, canvas, limit, x, y, width, height) {
  const scale = Math.min(1, limit / Math.max(width, height));
  const frameWidth = Math.max(1, Math.round(width * scale));
  const frameHeight = Math.max(1, Math.round(height * scale));
  if (canvas.width !== frameWidth) canvas.width = frameWidth;
  if (canvas.height !== frameHeight) canvas.height = frameHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, x, y, width, height, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return globalThis.jsQR(pixels.data, pixels.width, pixels.height);
}

function openRoomQr(text) {
  let link;
  try { link = new URL(text); } catch { return false; }
  const nextRoom = link.searchParams.get('room');
  if (!['http:', 'https:'].includes(link.protocol) || link.username || link.password
      || !['/controller', '/controller/', '/controller.html'].includes(link.pathname)
      || !/^[A-Za-z0-9_-]{16}$/.test(nextRoom ?? '')) return false;
  link.pathname = '/controller';
  stopScan();
  if (link.origin !== location.origin) {
    location.replace(link.href);
    return true;
  }
  const previous = socket;
  socket = undefined;
  previous?.close();
  history.replaceState(null, '', link.pathname + link.search);
  room = nextRoom;
  playerTwo.hidden = link.searchParams.get('solo') === '1';
  showJoin('Đã nhận mã phòng. Chọn vị trí để kết nối.');
  return true;
}

function stopScan() {
  const session = scanSession;
  scanSession = undefined;
  clearTimeout(session?.timer);
  session?.stream?.getTracks().forEach(track => track.stop());
  preview.srcObject = null;
  scanner.hidden = true;
  scanQr.disabled = qrImage.disabled = false;
}

scanQr.onclick = async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    label.textContent = 'Camera trực tiếp cần trang HTTPS. Bạn có thể dùng Chọn ảnh QR.';
    return;
  }
  if (typeof globalThis.BarcodeDetector !== 'function' && typeof globalThis.jsQR !== 'function') {
    label.textContent = 'Không tải được bộ đọc QR. Hãy tải lại trang hoặc dùng camera của điện thoại.';
    return;
  }
  const session = scanSession = {};
  scanQr.disabled = qrImage.disabled = true;
  scanner.hidden = false;
  label.textContent = 'Cho phép dùng camera rồi đưa mã QR vào khung.';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    if (scanSession !== session) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    session.stream = stream;
    preview.srcObject = stream;
    await preview.play();
    if (scanSession !== session) return;
    let detector;
    try {
      if (typeof globalThis.BarcodeDetector === 'function') {
        detector = new globalThis.BarcodeDetector({ formats: ['qr_code'] });
      }
    } catch {
      // Some browsers expose BarcodeDetector without a working backend.
    }
    label.textContent = 'Đưa trọn mã QR vào giữa khung và giữ điện thoại ổn định. Mã sẽ tự được nhận.';
    const canvas = document.createElement('canvas');
    let scanCenter = true;
    const startedAt = performance.now();
    let readOtherCode = false;
    async function scanFrame() {
      if (scanSession !== session) return;
      try {
        const { videoWidth, videoHeight } = preview;
        if (preview.readyState >= 2 && videoWidth && videoHeight) {
          if (detector) {
            let codes = [];
            try {
              codes = await detector.detect(preview);
            } catch {
              detector = undefined;
            }
            if (scanSession !== session) return;
            if (codes.some(code => openRoomQr(code.rawValue))) return;
            readOtherCode ||= codes.length > 0;
          }
          if (typeof globalThis.jsQR === 'function') {
            const side = Math.floor(Math.min(videoWidth, videoHeight) * 0.75);
            const code = scanCenter
              ? decodeQr(preview, canvas, 1080, (videoWidth - side) / 2, (videoHeight - side) / 2, side, side)
              : decodeQr(preview, canvas, 1920, 0, 0, videoWidth, videoHeight);
            scanCenter = !scanCenter;
            if (code && openRoomQr(code.data)) return;
            readOtherCode ||= Boolean(code);
          } else if (!detector) {
            throw new Error('QR decoder unavailable');
          }
        }
        if (readOtherCode) {
          label.textContent = 'Camera đã đọc được mã. Hãy đưa đúng mã QR phòng tay cầm vào khung.';
        } else if (performance.now() - startedAt > 5000) {
          label.textContent = 'Chưa nhận được mã. Đưa điện thoại gần hơn, giữ trọn mã trong hình và tránh lóa màn hình.';
        }
      } catch {
        stopScan();
        label.textContent = 'Không đọc được hình từ camera. Hãy thử Chọn ảnh QR.';
        return;
      }
      session.timer = setTimeout(scanFrame, 180);
    }
    scanFrame();
  } catch {
    if (scanSession !== session) return;
    stopScan();
    label.textContent = 'Không mở được camera. Hãy kiểm tra quyền camera hoặc chọn ảnh QR.';
  }
};

document.querySelector('#stop-qr').onclick = () => {
  stopScan();
  label.textContent = 'Đã đóng camera. Bấm Quét QR mới để thử lại.';
};
async function readRoomQr(event) {
  const input = event.currentTarget;
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  scanQr.disabled = qrImage.disabled = true;
  label.textContent = 'Đang đọc mã QR…';
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const code = decodeQr(image, document.createElement('canvas'), 1600, 0, 0, image.naturalWidth, image.naturalHeight);
    if (!code) {
      label.textContent = 'Chưa đọc được mã QR. Hãy chụp gần hơn và lấy trọn mã.';
      return;
    }
    if (!openRoomQr(code.data)) {
      label.textContent = 'Mã này không phải mã QR phòng tay cầm.';
    }
  } catch {
    label.textContent = 'Không đọc được ảnh. Hãy thử chụp lại hoặc chọn ảnh khác.';
  } finally {
    URL.revokeObjectURL(objectUrl);
    scanQr.disabled = qrImage.disabled = false;
  }
}

qrImage.addEventListener('change', readRoomQr);

playerTwo.hidden = query.get('solo') === '1';

function showNetwork(quality, message) {
  network.dataset.quality = quality;
  if (latency.textContent !== message) latency.textContent = message;
}

function connectPlayer(player, retries = 0) {
  const connection = socket = lanSocket({ room, player });
  let joined = false;
  let lastReply;
  function beat() {
    const now = performance.now();
    if (now - lastReply > 3500) showNetwork('waiting', 'Chưa đo được');
    send({ type: 'heartbeat', sentAt: now });
  }
  connection.onmessage = ({ data }) => {
    if (socket !== connection) return;
    const message = JSON.parse(data);
    if (message.type === 'heartbeat' && joined && Number.isFinite(message.sentAt)) {
      lastReply = performance.now();
      const ms = Math.max(0, Math.round(lastReply - message.sentAt));
      showNetwork(ms < 90 ? 'good' : ms < 180 ? 'fair' : 'poor', ms + ' ms');
      return;
    }
    if (message.type !== 'joined') return;
    joined = true;
    label.textContent = 'Đã kết nối P' + player;
    pad.hidden = leave.hidden = false;
    document.body.classList.add('pad-connected');
    qrReconnect.hidden = true;
    if (!retries) {
      setExpanded(true);
      setRotated(true);
    }
    lastReply = performance.now();
    showNetwork('waiting', 'Đang đo');
    beat();
    heartbeat = setInterval(beat, 750);
  };
  connection.onclose = event => {
    if (socket !== connection) return;
    socket = undefined;
    const attempts = joined ? 0 : retries;
    if ((joined || retries) && attempts < 4 && [1006, 1012, 1013, 4003].includes(event.code)) {
      reset();
      clearInterval(heartbeat);
      label.textContent = 'Đang kết nối lại P' + player + '…';
      showNetwork('waiting', 'Kết nối lại…');
      reconnectTimer = setTimeout(() => {
        reset();
        connectPlayer(player, attempts + 1);
      }, 900 + attempts * 1500);
      return;
    }
    showJoin(event.code === 4003 ? 'Vị trí này đang được dùng. Hãy chọn vị trí khác.'
      : event.code === 4002 ? 'Liên kết đã hết hạn. Mở phòng trên máy tính rồi bấm Quét QR mới.'
      : 'Mất kết nối. Thử vào lại hoặc quét mã QR mới.', event.code === 4002);
  };
}

for (const button of join.querySelectorAll('button')) {
  button.onclick = () => {
    stopScan();
    join.hidden = true;
    label.textContent = 'Đang kết nối…';
    connectPlayer(button.dataset.player);
  };
}

function leaveRoom() {
  reset();
  const connection = socket;
  socket = undefined;
  connection?.close();
  showJoin('Đã rời tay cầm.');
}

leave.onclick = leaveRoom;
document.querySelector('#leave-pad').onclick = leaveRoom;

function setExpanded(enabled) {
  stickRect = undefined;
  if (!enabled) setRotated(false);
  document.body.classList.toggle('pad-expanded', enabled);
  expand.setAttribute('aria-pressed', String(enabled));
  expand.textContent = enabled ? 'Thu nhỏ' : 'Toàn màn hình';
}

function setRotated(enabled) {
  stickRect = undefined;
  document.body.classList.toggle('pad-rotate', enabled);
  rotate.setAttribute('aria-pressed', String(enabled));
  rotate.textContent = enabled ? 'Bỏ xoay ngang' : 'Xoay ngang';
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

async function toggleExpanded(enabled) {
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
}

expand.onclick = () => {
  reset();
  void toggleExpanded(!document.body.classList.contains('pad-expanded'));
};
rotate.onclick = () => {
  reset();
  const enabled = !document.body.classList.contains('pad-rotate');
  setRotated(enabled);
  if (enabled && !document.body.classList.contains('pad-expanded')) void toggleExpanded(true);
};
portrait.addEventListener?.('change', reset);
window.addEventListener('resize', () => { stickRect = undefined; });

light.onclick = () => {
  const enabled = document.body.classList.toggle('pad-light');
  light.setAttribute('aria-pressed', String(enabled));
  light.textContent = enabled ? 'Màu tối' : 'Màu sáng';
};

let backgroundUrl;
chooseBackground.onclick = () => backgroundFile.click();
function removeBackground() {
  if (backgroundUrl) URL.revokeObjectURL(backgroundUrl);
  backgroundUrl = undefined;
  pad.style.removeProperty('--pad-photo');
  clearBackground.hidden = true;
}
clearBackground.onclick = removeBackground;
backgroundFile.addEventListener('change', () => {
  const file = backgroundFile.files[0];
  backgroundFile.value = '';
  if (!file) return;
  removeBackground();
  backgroundUrl = URL.createObjectURL(file);
  pad.style.setProperty('--pad-photo', `url("${backgroundUrl}")`);
  clearBackground.hidden = false;
});

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
  const rect = stickRect ??= stick.getBoundingClientRect();
  const screenX = event.clientX - rect.left - rect.width / 2;
  const screenY = event.clientY - rect.top - rect.height / 2;
  const rotated = portrait.matches && document.body.classList.contains('pad-rotate');
  const x = rotated ? screenY : screenX;
  const y = rotated ? -screenX : screenY;
  const travel = rect.width * 0.28;
  const scale = Math.min(1, travel / Math.max(1, Math.hypot(x, y)));
  stick.style.setProperty('--stick-x', x * scale + 'px');
  stick.style.setProperty('--stick-y', y * scale + 'px');
  const next = new Set();
  const horizontal = x < 0 ? 'a' : 'd';
  const vertical = y < 0 ? 'w' : 's';
  if (Math.abs(x) > travel * (directions.has(horizontal) ? .22 : .34)) next.add(horizontal);
  if (Math.abs(y) > travel * (directions.has(vertical) ? .30 : .48)) next.add(vertical);
  updateDirections(next);
}

stick.addEventListener('pointerdown', event => {
  if (event.button !== 0 || stickPointer !== null) return;
  event.preventDefault();
  stickRect = undefined;
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
  stopScan();
  if (socket || reconnectTimer) leaveRoom();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
if (!room) showJoin('Quét mã QR trên máy tính để mở tay cầm.');
