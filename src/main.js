import { startGame } from './game/match.js';

const fullscreenButton = document.querySelector('#game-fullscreen');
const gameCard = fullscreenButton.closest('.game-card');

function setGameExpanded(expanded) {
  document.body.classList.toggle('game-expanded', expanded);
  fullscreenButton.setAttribute('aria-pressed', String(expanded));
  fullscreenButton.textContent = expanded ? 'Thu nhỏ' : 'Toàn màn hình';
}

fullscreenButton.addEventListener('click', async () => {
  if (document.fullscreenElement === gameCard) {
    await document.exitFullscreen();
    return;
  }

  const expanded = !document.body.classList.contains('game-expanded');
  setGameExpanded(expanded);
  if (expanded) {
    try {
      await gameCard.requestFullscreen?.();
      if (document.fullscreenElement === gameCard && !document.body.classList.contains('game-expanded')) {
        await document.exitFullscreen();
      }
    } catch {
      // Keep the arena expanded within the browser viewport.
    }
  }
});

document.addEventListener('fullscreenchange', () => {
  setGameExpanded(document.fullscreenElement === gameCard);
});

const config = await fetch('/data/fighters.json').then(response => {
  if (!response.ok) throw new Error('Không tải được cấu hình trận đấu.');
  return response.json();
});
startGame(config);
