import { startGame } from './game/match.js';

const config = await fetch('/data/fighters.json').then(response => {
  if (!response.ok) throw new Error('Không tải được cấu hình trận đấu.');
  return response.json();
});
startGame(config);
