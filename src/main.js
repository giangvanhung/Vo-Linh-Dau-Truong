import { startGame } from './game/match.js';

const fullscreenButton = document.querySelector('#game-fullscreen');
const gameCard = fullscreenButton.closest('.game-card');
const isTV = /web[o0]s|smart-tv|smarttv|netcast/i.test(navigator.userAgent);
document.body.classList.toggle('tv-layout', isTV);
if (isTV) setGameExpanded(true);

function setGameExpanded(expanded) {
  document.body.classList.toggle('game-expanded', expanded);
  fullscreenButton.setAttribute('aria-pressed', String(expanded));
  fullscreenButton.textContent = expanded ? 'Thu nhỏ' : 'Toàn màn hình';
}

function fullscreenElement() {
  return document.fullscreenElement ?? document.webkitFullscreenElement;
}

async function toggleGameFullscreen() {
  const exit = document.exitFullscreen ?? document.webkitExitFullscreen;
  if (fullscreenElement() === gameCard) {
    await exit?.call(document);
    return;
  }

  const expanded = !document.body.classList.contains('game-expanded');
  setGameExpanded(expanded);
  if (expanded) {
    try {
      const request = gameCard.requestFullscreen ?? gameCard.webkitRequestFullscreen;
      await request?.call(gameCard);
      if (fullscreenElement() === gameCard && !document.body.classList.contains('game-expanded')) {
        await exit?.call(document);
      }
    } catch {
      // Keep the arena expanded within the browser viewport.
    }
  }
}

fullscreenButton.addEventListener('click', toggleGameFullscreen);
window.addEventListener('keydown', event => {
  if (event.key !== 'F12') return;
  event.preventDefault();
  if (!event.repeat) void toggleGameFullscreen();
});
for (const eventName of ['fullscreenchange', 'webkitfullscreenchange']) {
  document.addEventListener(eventName, () => {
    setGameExpanded(fullscreenElement() === gameCard);
  });
}

fetch('/data/fighters.json').then(response => {
  if (!response.ok) throw new Error('Không tải được cấu hình trận đấu.');
  return response.json();
}).then(startGame).catch(error => {
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = 'Không khởi động được game. Hãy tải lại trang. Nếu lỗi vẫn xảy ra, hãy kiểm tra phiên bản trình duyệt.';
  document.getElementById('menu-panel').appendChild(message);
  console.error(error);
});
