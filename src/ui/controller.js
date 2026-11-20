import { createControllerInput } from './controller-input.js';
import { createControllerQr } from './controller-qr.js';
import { createControllerLayout } from './controller-layout.js';
import { lanSocket } from '../platform/lan.js';

const query = new URLSearchParams(location.search);
let room = query.get('room');
const label = document.querySelector('#connection');
const join = document.querySelector('#join');
const leave = document.querySelector('#leave');
const leavePad = document.querySelector('#leave-pad');
const qrReconnect = document.querySelector('#qr-reconnect');
const pad = document.querySelector('#pad');
const network = document.querySelector('#pad-network');
const latency = document.querySelector('#pad-latency');
const testToggle = document.querySelector('#test-pad');
const testPanel = document.querySelector('#pad-test');
const testConnection = document.querySelector('#test-connection');
const testInput = document.querySelector('#test-input');
const offlineTest = document.querySelector('#test-offline');
const controlLabels = new Map(Array.from(pad.querySelectorAll('[data-key]'), button => [
  button.dataset.key, button.getAttribute('aria-label') || button.textContent.trim()
]));
const testedControls = new Set();
let testing = false;
let connectedPlayer;
let socket, heartbeat, reconnectTimer;
let directionBatch = false;

const { reset, invalidateStick, held: heldControls } = createControllerInput({
  pad,
  send,
  supportsDirectionBatch: () => directionBatch,
  onChange: showTestInput,
});

const { setExpanded, setRotated, exitFullscreen, toggleExpanded, syncFullscreen } = createControllerLayout({
  pad,
  reset,
  invalidateStick,
});

function send(message) {
  if (testing && (message.type === 'input' || message.type === 'direction')) return;
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function showTestInput() {
  if (!testing) return;
  const held = heldControls();
  for (const key of held) testedControls.add(key);
  const names = [...held].map(key => controlLabels.get(key));
  const inputStatus = names.length ? 'Đang giữ ' + names.join(', ')
    : testedControls.size ? 'Đã nhả hết nút' : 'Bấm nút hoặc gạt joystick để thử';
  testInput.textContent = inputStatus
    + ' · Đã thử ' + testedControls.size + '/' + controlLabels.size;
}

function showTestConnection() {
  if (!testing) return;
  testConnection.textContent = connectedPlayer ? 'Đã kết nối P' + connectedPlayer
    : socket || reconnectTimer ? 'Đang kết nối…' : 'Chưa kết nối';
  network.hidden = !connectedPlayer && !socket && !reconnectTimer;
  leavePad.hidden = network.hidden;
}

function setTesting(enabled) {
  reset();
  testing = enabled;
  document.body.classList.toggle('pad-testing', enabled);
  testedControls.clear();
  testPanel.hidden = !enabled;
  testToggle.setAttribute('aria-pressed', String(enabled));
  testToggle.textContent = enabled ? 'Thoát kiểm tra' : 'Kiểm tra';
  network.hidden = false;
  leavePad.hidden = false;
  showTestConnection();
  showTestInput();
}

function showJoin(message, expired = false) {
  setTesting(false);
  connectedPlayer = undefined;
  clearInterval(heartbeat);
  clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
  label.textContent = message;
  setExpanded(false);
  exitFullscreen();
  pad.hidden = leave.hidden = true;
  offlineTest.hidden = false;
  document.body.classList.remove('pad-connected');
  join.hidden = !room || expired;
  qrReconnect.hidden = false;
}

const playerTwo = join.querySelector('[data-player="2"]');
const { stopScan } = createControllerQr({
  label,
  onRoom(nextRoom, link) {
    const previous = socket;
    socket = undefined;
    previous?.close();
    history.replaceState(null, '', link.pathname + link.search);
    room = nextRoom;
    playerTwo.hidden = link.searchParams.get('solo') === '1';
    showJoin('Đã nhận mã phòng. Chọn vị trí để kết nối.');
  },
});

playerTwo.hidden = query.get('solo') === '1';

function showNetwork(quality, message) {
  network.dataset.quality = quality;
  if (latency.textContent !== message) latency.textContent = message;
}

function connectPlayer(player, retries = 0) {
  directionBatch = false;
  const connection = socket = lanSocket({ room, player });
  showTestConnection();
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
    connectedPlayer = player;
    offlineTest.hidden = true;
    showTestConnection();
    directionBatch = message.directionBatch === true;
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
    connectedPlayer = undefined;
    const attempts = joined ? 0 : retries;
    if ((joined || retries) && attempts < 4 && [1006, 1012, 1013, 4003].includes(event.code)) {
      reset();
      clearInterval(heartbeat);
      label.textContent = 'Đang kết nối lại P' + player + '…';
      showNetwork('waiting', 'Kết nối lại…');
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        reset();
        connectPlayer(player, attempts + 1);
      }, 900 + attempts * 1500);
      showTestConnection();
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
    setTesting(false);
    pad.hidden = true;
    offlineTest.hidden = true;
    join.hidden = true;
    label.textContent = 'Đang kết nối…';
    connectPlayer(button.dataset.player);
  };
}

offlineTest.onclick = () => {
  if (testing) {
    testToggle.click();
    return;
  }
  stopScan();
  pad.hidden = false;
  setTesting(true);
  pad.scrollIntoView({ block: 'nearest' });
};

testToggle.onclick = () => {
  if (testing && !socket && !connectedPlayer && !reconnectTimer) {
    pad.hidden = true;
    setExpanded(false);
    void exitFullscreen();
  }
  setTesting(!testing);
};

function leaveRoom() {
  reset();
  const connection = socket;
  socket = undefined;
  connection?.close();
  showJoin('Đã rời tay cầm.');
}

leave.onclick = leaveRoom;
leavePad.onclick = leaveRoom;

window.addEventListener('blur', reset);
window.addEventListener('pagehide', () => {
  stopScan();
  if (socket || reconnectTimer) leaveRoom();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    reset();
    void toggleExpanded(false);
  }
  syncFullscreen();
});
window.addEventListener('pageshow', syncFullscreen);
if (!room) showJoin('Quét mã QR trên máy tính để mở tay cầm.');
