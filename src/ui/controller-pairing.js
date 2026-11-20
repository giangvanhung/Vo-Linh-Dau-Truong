import { createLanHost } from '../platform/lan.js';

export function createControllerPairing({ byId, canPlay, onContinue, showLobby }) {
  const pairing = byId('lan-pairing');
  const address = byId('lan-address');
  const networkLabels = { wifi: 'Wi‑Fi', ethernet: 'Ethernet (cắm dây)', virtual: 'VPN / mạng ảo', other: 'Mạng khác', online: 'Internet' };
  const networkHints = {
    wifi: 'Dùng địa chỉ này khi điện thoại và máy tính kết nối cùng Wi‑Fi.',
    ethernet: 'Dùng địa chỉ này khi dây mạng máy tính nối vào cùng router phát Wi‑Fi cho điện thoại.',
    virtual: 'Địa chỉ VPN hoặc mạng ảo. Nếu điện thoại chỉ dùng Wi‑Fi, hãy chọn địa chỉ Wi‑Fi hoặc Ethernet.',
    other: 'Nếu chưa rõ đây là mạng nào, xem tên bộ điều hợp trong cài đặt mạng của máy tính.',
    online: 'Quét mã QR bằng điện thoại có kết nối Internet. TV và điện thoại có thể dùng hai mạng khác nhau.',
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
  function updateLanAddress() {
    const option = addresses[Number(address.value)];
    byId('lan-link-box').hidden = !option;
    if (!option) return;
    byId('lan-network-help').hidden = option.type === 'online';
    const link = byId('lan-link');
    link.href = link.textContent = option.link;
    byId('lan-address-hint').textContent = networkHints[option.type] ?? networkHints.other;
    const qr = byId('lan-qr');
    qr.hidden = !option.qr;
    if (option.qr) qr.src = option.qr;
  }
  const lanHost = createLanHost({
    canPlay: () => canPlay(soloLan),
    onRoom(options) {
      addresses = options;
      address.options.length = 0;
      options.forEach(({ link, name, type }, index) => {
        const label = networkLabels[type] ?? networkLabels.other;
        const adapter = name && name.toLowerCase() !== type ? ` (${name})` : '';
        address.add(new Option(`${label}${adapter} · ${new URL(link).host}`, index));
      });
      byId('lan-address-label').hidden = options.length < 2;
      roomReady = true;
      updateLanAddress();
      updateLanStatus();
    },
    onStatus(players) {
      connected = players;
      updateLanStatus();
    },
    onClose() {
      roomReady = false;
      byId('lan-status').textContent = 'Mất kết nối phòng. Bàn phím vẫn dùng được. Về menu để tạo phòng mới.';
      byId('network-mode').textContent = 'LAN · MẤT KẾT NỐI';
      byId('lan-link-box').hidden = true;
      if (soloLan) soloLanButton.hidden = false;
      byId('status-text').textContent = 'MẤT KẾT NỐI PHÒNG LAN';
    },
  });
  address.addEventListener('change', updateLanAddress);
  soloLanButton.addEventListener('click', () => {
    soloLan = true;
    showControllerRoom();
    if (!roomReady) openControllerRoom();
  });
  byId('lan-start').addEventListener('click', () => {
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
    byId('lan-lobby').append(pairing);
    pairing.querySelectorAll('details').forEach(details => { details.open = false; });
    showLobby();
    byId('lan-start').focus({ preventScroll: true });
    byId('lan-panel').scrollTop = 0;
  }

  function moveToDetails() {
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
