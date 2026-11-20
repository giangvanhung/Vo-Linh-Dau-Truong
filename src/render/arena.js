import { createSpriteRenderer, loadImage } from './sprites.js';

export function createArenaRenderer(canvas, config) {
  const ctx = canvas.getContext('2d');

  const drawSprite = createSpriteRenderer(ctx, config.characters);
  const layers = [null, null, null];
  const { background, parallax = [] } = config.stage;
  let composite;
  if (background) loadImage(background).then(image => { composite = image; }).catch(() => {});
  parallax.forEach((path, index) => {
    loadImage(path).then(image => { layers[index] = image; }).catch(() => {});
  });

  function drawStage(w, h, ground, center) {
    ctx.fillStyle = '#191922';
    ctx.fillRect(0, 0, w, h);
    const draw = (image, shift) => {
      const scale = Math.max(w * 1.10 / image.width, h / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      const floor = config.stage.artGroundRatio ?? .724;
      const top = Math.min(0, Math.max(h - height, ground - height * floor));
      ctx.drawImage(image, (w - width) / 2 + shift, top, width, height);
    };
    if (layers.every(Boolean)) {
      layers.forEach((image, index) => {
        const shift = (w / 2 - center) * [.035, .075, .12][index];
        draw(image, Math.max(-w * .05, Math.min(w * .05, shift)));
      });
    } else if (composite || layers[0]) {
      draw(composite ?? layers[0], 0);
    } else {
      ctx.fillStyle = '#302b37';
      ctx.fillRect(0, ground, w, h - ground);
    }
    ctx.fillStyle = 'rgba(12, 13, 22, .29)';
    ctx.fillRect(0, 0, w, h);
  }

  function render({ fighters, projectiles, particles, floaters, trails, shake, screenEffect, debug, animationTime }) {
    const w = canvas.width, h = canvas.height, ground = h * config.stage.groundRatio;
    ctx.clearRect(0, 0, w, h);
    const center = (fighters[0].x + fighters[1].x) / 2;
    drawStage(w, h, ground, center);
    ctx.save();
    applyShake(shake, screenEffect);
    for (const trail of trails) {
      ctx.globalAlpha = trail.life / trail.total;
      ctx.fillStyle = trail.color;
      ctx.fillRect(Math.min(trail.from, trail.to), ground + trail.y - 11, Math.abs(trail.to - trail.from), 11);
    }
    ctx.globalAlpha = 1;
    for (const shot of projectiles) drawProjectile(shot, ground);
    for (const f of fighters) drawFighter(f, ground, animationTime);
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / .35); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }
    ctx.globalAlpha = 1;
    for (const f of floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 3);
      ctx.textAlign = 'center';
      ctx.font = '700 16px Space Grotesk, sans-serif';
      ctx.strokeStyle = '#191624';
      ctx.lineWidth = 3;
      ctx.fillStyle = f.blocked ? '#bde8ff' : '#ffd397';
      ctx.strokeText(f.text, f.x, ground + f.y);
      ctx.fillText(f.text, f.x, ground + f.y);
      const spark = Math.max(0, 1 - (f.total - f.life) / .12);
      if (spark > 0) {
        ctx.globalAlpha = spark;
        ctx.strokeStyle = f.blocked ? '#c5ebff' : '#fff6ce';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const angle = i * Math.PI / 4;
          const y = ground + f.contactY;
          ctx.moveTo(f.x + Math.cos(angle) * 4, y + Math.sin(angle) * 4);
          ctx.lineTo(f.x + Math.cos(angle) * (10 + 6 * spark), y + Math.sin(angle) * (10 + 6 * spark));
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (screenEffect && screenEffect.elapsed < screenEffect.flashSeconds) {
      ctx.globalAlpha = Math.min(.15, screenEffect.flashOpacity) * (1 - screenEffect.elapsed / screenEffect.flashSeconds);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    if (debug) {
      ctx.save();
      applyShake(shake, screenEffect);
      drawCollisionBoxes(fighters, projectiles, ground);
      ctx.restore();
    }
  }

  function applyShake(shake, screenEffect) {
    if (shake) ctx.translate(Math.sin(shake * 180) * shake * 25, 0);
    if (screenEffect && screenEffect.elapsed < screenEffect.shakeSeconds) {
      const remaining = screenEffect.shakeSeconds - screenEffect.elapsed;
      ctx.translate(Math.sin(remaining * 180) * Math.min(4, remaining * screenEffect.shakeIntensity), 0);
    }
  }

  function drawCollisionBoxes(fighters, projectiles, ground) {
    ctx.lineWidth = 2;
    const draw = (box, color) => {
      ctx.strokeStyle = color;
      ctx.strokeRect(box.x, ground + box.y, box.width, box.height);
    };
    for (const fighter of fighters) {
      draw(fighter.hurtbox, '#62eac0');
      if (fighter.attackActive && !fighter.attack.projectile) for (const box of fighter.attackBoxes) draw(box, '#ff5d63');
    }
    for (const shot of projectiles) {
      if (shot.hit) continue;
      const { width, height } = shot.attack.projectile;
      draw({ x: shot.x - width / 2, y: shot.y - height / 2, width, height }, '#ff5d63');
    }
  }

  function drawProjectile({ x, y, attack }, ground) {
    const { color, width, height, pierce } = attack.projectile;
    ctx.save();
    ctx.shadowColor = ctx.fillStyle = color;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.ellipse(x, ground + y, width / 2, height / 2, pierce ? -.22 * attack.facing : 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFighter(fighter, ground, animationTime) {
    if (drawSprite(fighter, ground, animationTime)) return;
    const body = fighter.hurtbox;
    ctx.fillStyle = fighter.flash > 0 ? '#fff2dc' : fighter.color;
    ctx.fillRect(body.x, ground + body.y, body.width, body.height);
  }

  return render;
}
