import { createLanHost } from '../platform/lan.js';
import { relayUrl } from '../platform/relay-url.js';
import { addPagination, connectSectionButtons } from './pagination.js';

export function createControllerPairing({ byId, canPlay, onContinue, showLobby }) {
  const pairing = byId('lan-pairing');
  const addressList = byId('lan-addresses');
  const addressPages = byId('lan-address-pages');
  const showPairingPage = connectSectionButtons(pairing.querySelector('.section-navigation'));
  const lobby = byId('lan-lobby');
  const startButton = byId('lan-start');
  const qr = byId('lan-qr');
  const scanHelp = byId('lan-scan-help');
  const scanButton = pairing.querySelector('[aria-controls="lan-scan-page"]');
  qr.addEventListener('error', () => {
    qr.hidden = true;
    scanHelp.hidden = true;
    if (scanButton.getAttribute('aria-pressed') === 'true') showPairingPage('lan-manual-page');
    scanButton.disabled = true;
  });
  const networkLabels = { wifi: 'Wi‑Fi', ethernet: 'Ethernet (cắm dây)', virtual: 'VPN / mạng ảo', other: 'Mạng khác', online: 'Internet' };
  const networkHints = {
    wifi: 'Kết nối điện thoại vào cùng Wi‑Fi với thiết bị đang chạy game.',
    ethernet: 'Dùng Wi‑Fi phát từ cùng router mà thiết bị chạy game đang cắm dây mạng.',
    virtual: 'Địa chỉ VPN hoặc mạng ảo. Nếu điện thoại chỉ dùng Wi‑Fi, hãy chọn địa chỉ Wi‑Fi hoặc Ethernet.',
    other: 'Nếu chưa rõ đây là mạng nào, xem tên bộ điều hợp trong cài đặt mạng của máy tính.',
    online: 'Tay cầm gửi tín hiệu qua máy chủ Internet, kể cả khi TV và điện thoại dùng cùng Wi‑Fi.',
  };
  const soloLanButton = byId('solo-lan-button');
  let soloLan = false;
  let addresses = [];
  let connected = [false, false];
  let roomReady = false;
  function updateLanStatus() {
    if (!roomReady) return;
    byId('lan-status').textContent = (addresses.length ? '' : 'Không tìm thấy địa chỉ IPv4 LAN. ')
      + connected.slice(0, soloLan ? 1 : 2)
        .map((online, index) => 'P' + (index + 1) + (online ? ' có tay cầm' : ' dùng bàn phím')).join(' · ');
  }
  function selectAddress(index) {
    const option = addresses[index];
    for (const [position, button] of [...addressList.children].entries()) {
      button.setAttribute('aria-pressed', String(position === index));
    }
    byId('lan-link').textContent = option.link;
    byId('lan-address-hint').textContent = networkHints[option.type] ?? networkHints.other;
    qr.hidden = !option.qr;
    scanHelp.hidden = !option.qr;
    scanButton.disabled = !option.qr;
    if (option.qr) qr.src = option.qr;
  }
  const lanHost = createLanHost({
    canPlay: () => canPlay(soloLan),
    onRoom(options) {
      addresses = options;
      const addressButtons = options.map(({ link, name, type }, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'lan-network-option';
        const label = document.createElement('strong');
        label.textContent = networkLabels[type] ?? networkLabels.other;
        const detail = document.createElement('small');
        const adapter = name && name.toLowerCase() !== type ? `${name} · ` : '';
        detail.textContent = adapter + new URL(link).host;
        button.append(label, detail);
        button.addEventListener('click', () => {
          selectAddress(index);
          showPairingPage(qr.hidden ? 'lan-manual-page' : 'lan-scan-page');
        });
        return button;
      });
      addressList.replaceChildren(...addressButtons);
      addressPages.replaceChildren();
      const addressesPerPage = 2;
      if (options.length > addressesPerPage) {
        const pages = Array.from({ length: Math.ceil(options.length / addressesPerPage) }, () => '');
        addPagination(addressPages, pages, page => addressButtons.forEach((button, index) => {
          button.hidden = Math.floor(index / addressesPerPage) !== page;
        }), addressList.id);
      }
      showPairingPage('lan-network-page');
      byId('lan-link-box').hidden = !options.length;
      if (options.length) {
        selectAddress(0);
        if (lobby.contains(pairing) && document.activeElement === startButton) {
          addressList.firstElementChild.focus();
        }
      }
      roomReady = true;
      updateLanStatus();
    },
    onStatus(players) {
      connected = players;
      updateLanStatus();
    },
    onClose() {
      const wasReady = roomReady;
      roomReady = false;
      byId('lan-status').textContent = wasReady
        ? 'Mất kết nối phòng. Bàn phím vẫn dùng được. Về menu để tạo phòng mới.'
        : relayUrl
          ? `Không mở được phòng trên máy chủ ${new URL(relayUrl).host}. Thử mở game trực tiếp trên máy chủ này.`
          : 'Không mở được phòng. Kiểm tra kết nối đến máy chủ đang chạy game.';
      byId('network-mode').textContent = 'LAN · MẤT KẾT NỐI';
      byId('lan-link-box').hidden = true;
      if (soloLan) soloLanButton.hidden = false;
      byId('status-text').textContent = 'MẤT KẾT NỐI PHÒNG LAN';
    },
  });
  soloLanButton.addEventListener('click', () => {
    soloLan = true;
    showControllerRoom();
    if (!roomReady) openControllerRoom();
  });
  startButton.addEventListener('click', () => {
    moveToDetails();
    onContinue();
  });
  function openControllerRoom() {
    addresses = [];
    connected = [false, false];
    roomReady = false;
    byId('lan-keyboard-help').hidden = soloLan;
    byId('lan-status').textContent = 'Đang tạo phòng…';
    byId('lan-link-box').hidden = true;
    byId('network-mode').textContent = soloLan ? 'TAY CẦM LAN' : 'LAN';
    lanHost.open({ solo: soloLan });
  }

  function showControllerRoom() {
    byId('lan-title').textContent = soloLan ? 'Kết nối tay cầm P1' : 'Đấu 2 người qua LAN';
    lobby.append(pairing);
    showLobby();
    byId('lan-panel').scrollTop = 0;
    const currentPage = pairing.querySelector('.section-navigation [aria-pressed="true"]');
    (roomReady && addresses.length ? currentPage : startButton).focus();
  }

  function moveToDetails() {
    if (addresses.length) showPairingPage(qr.hidden ? 'lan-manual-page' : 'lan-scan-page');
    byId('lan-details').append(pairing);
    byId('lan-details').hidden = false;
  }

  function updateSetupButton(hidden) {
    soloLanButton.hidden = hidden;
    soloLanButton.textContent = soloLan ? 'Mã QR tay cầm P1' : 'Kết nối tay cầm P1';
  }

  function close() {
    soloLan = false;
    roomReady = false;
    lanHost.close();
    byId('lan-details').hidden = true;
    byId('lan-details').open = false;
    byId('network-mode').textContent = 'OFFLINE';
  }

  return {
    get solo() { return soloLan; },
    open() {
      showControllerRoom();
      openControllerRoom();
    },
    close,
    updateSetupButton,
    moveToDetails,
    clear: lanHost.clear,
    consume: lanHost.consume,
  };
}
