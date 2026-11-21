import { stageFloorAt } from '../game/stages.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const interval = 140;

export function createSeasonSnow(ctx) {
  const flakes = [];
  const patches = [];
  let previousTime;
  let previousStage;
  let previousFrame;
  let untilFlake = 0;
  let serial = 0;

  return (stage, frame, width, ground, fighters, time, active) => {
    const { theme, themeEffects } = document.documentElement.dataset;
    const enabled = active && themeEffects === 'on' && !reducedMotion.matches
      && (theme === 'winter' || theme === 'christmas')
      && (!stage.seasonClimate || stage.seasonClimate === 'windy' || stage.seasonClimate === 'frozen');
    if (!enabled || stage !== previousStage || frame < previousFrame) {
      flakes.length = patches.length = 0;
      untilFlake = 0;
      previousTime = time;
    }
    previousStage = stage;
    previousFrame = frame;
    if (!enabled) return;

    const elapsed = Math.min(50, Math.max(0, time - previousTime));
    previousTime = time;
    untilFlake -= elapsed;
    if (untilFlake <= 0) {
      const seed = ++serial;
      flakes.push({
        x: 16 + (seed * .61803398875 % 1) * (width - 32),
        y: -8,
        speed: 45 + seed * 17 % 77,
        size: 2 + seed * 11 % 4,
        phase: seed * 2.4,
      });
      untilFlake += interval;
    }

    const world = { width, platforms: stage.platforms, rises: stage.rises };
    const wind = stage.seasonClimate === 'windy' ? .075 : 0;
    ctx.save();
    ctx.fillStyle = '#e4f5ff';
    for (let i = flakes.length - 1; i >= 0; i--) {
      const flake = flakes[i];
      const floor = stageFloorAt(world, flake.x, flake.y - ground);
      flake.y += flake.speed * elapsed / 1000;
      if (flake.y >= ground + floor) {
        patches.push({ x: flake.x, y: floor, radius: 5 + flake.size * 2, life: 6500, fadeTime: 1500, opacity: 1 });
        flakes.splice(i, 1);
        continue;
      }
      flake.phase += elapsed / (420 + flake.speed * 3);
      flake.x = Math.max(3, Math.min(width - 3, flake.x + (wind + Math.sin(flake.phase) / 38) * elapsed));
      ctx.globalAlpha = .28 + flake.size * .085;
      ctx.fillRect(Math.round(flake.x), Math.round(flake.y), flake.size, flake.size);
    }

    for (let i = patches.length - 1; i >= 0; i--) {
      const patch = patches[i];
      const steppedOn = fighters.some(fighter => fighter.hp > 0
        && Math.abs(fighter.x - patch.x) < patch.radius + fighter.width / 2
        && Math.abs(fighter.y - patch.y) < 7
        && Math.abs(fighter.y - stageFloorAt(world, fighter.x, fighter.y - 1)) < 3);
      if (steppedOn && patch.fadeTime !== 380 && patch.life > 380) {
        patch.opacity = Math.min(1, patch.life / patch.fadeTime);
        patch.fadeTime = patch.life = 380;
      }
      patch.life -= elapsed;
      if (patch.life <= 0) {
        patches.splice(i, 1);
        continue;
      }
      const fade = patch.opacity * Math.min(1, patch.life / patch.fadeTime);
      ctx.globalAlpha = .63 * fade;
      ctx.beginPath();
      ctx.ellipse(patch.x, ground + patch.y, patch.radius * (.5 + fade * .5), 1 + fade * 2,
        0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
}
