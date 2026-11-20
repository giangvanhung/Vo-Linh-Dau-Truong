export function createArenaRenderer(canvas, config) {
  const ctx = canvas.getContext('2d');

  function render({ fighters, projectiles, particles, floaters, trails, shake, screenEffect, debug }) {
    const w = canvas.width, h = canvas.height, ground = h * config.stage.groundRatio;
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#27212f'); bg.addColorStop(.48, '#28212a'); bg.addColorStop(1, '#181820'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    drawMoon(w * .5, h * .22);
    drawArchitecture(w, h);
    ctx.fillStyle = '#201e27'; ctx.fillRect(0, ground, w, h - ground);
    ctx.fillStyle = '#483740'; ctx.fillRect(0, ground, w, 2);
    ctx.fillStyle = '#d5a176'; ctx.globalAlpha = .12; ctx.fillRect(w * .16, ground + 1, w * .68, 1); ctx.globalAlpha = 1;
    for (let i = 0; i < 7; i++) { ctx.strokeStyle = `rgba(229,161,113,${.09 - i * .009})`; ctx.beginPath(); ctx.moveTo(w / 2, ground); ctx.lineTo(w * i / 6, h); ctx.stroke(); }
    ctx.save();
    if (shake) ctx.translate(Math.sin(shake * 180) * shake * 25, 0);
    if (screenEffect && screenEffect.elapsed < screenEffect.shakeSeconds) {
      const remaining = screenEffect.shakeSeconds - screenEffect.elapsed;
      ctx.translate(Math.sin(remaining * 180) * remaining * screenEffect.shakeIntensity, 0);
    }
    for (const trail of trails) {
      ctx.globalAlpha = trail.life / trail.total;
      ctx.fillStyle = trail.color;
      ctx.fillRect(Math.min(trail.from, trail.to), ground + trail.y - 11, Math.abs(trail.to - trail.from), 11);
    }
    ctx.globalAlpha = 1;
    for (const shot of projectiles) drawProjectile(shot, ground);
    for (const f of fighters) drawFighter(f, ground);
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / .35); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }
    ctx.globalAlpha = 1;
    for (const f of floaters) { ctx.globalAlpha = Math.min(1, f.life * 2); ctx.textAlign = 'center'; ctx.font = '700 14px Space Grotesk, sans-serif'; ctx.fillStyle = f.blocked ? '#9fd3f6' : '#ffd08b'; ctx.fillText(f.text, f.x, ground + f.y - (1 - f.life / f.total) * 8); }
    ctx.globalAlpha = 1;
    if (debug) drawCollisionBoxes(fighters, projectiles, ground);
    ctx.restore();
    if (screenEffect && screenEffect.elapsed < screenEffect.flashSeconds) {
      ctx.globalAlpha = screenEffect.flashOpacity * (1 - screenEffect.elapsed / screenEffect.flashSeconds);
      ctx.fillStyle = screenEffect.color;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
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
      if (fighter.attackActive && !fighter.attack.projectile) draw(fighter.attackBox, '#ff5d63');
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

  function drawMoon(x, y) { ctx.save(); ctx.shadowBlur = 50; ctx.shadowColor = '#d89676'; ctx.fillStyle = '#c99b82'; ctx.globalAlpha = .6; ctx.beginPath(); ctx.arc(x, y, 48, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = .2; ctx.fillStyle = '#fae2c9'; ctx.beginPath(); ctx.arc(x - 12, y - 8, 38, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  function drawArchitecture(w, h) {
    ctx.fillStyle = '#181720';
    ctx.beginPath(); ctx.moveTo(0, h * .52); ctx.lineTo(w * .15, h * .32); ctx.lineTo(w * .25, h * .52); ctx.lineTo(w * .37, h * .36); ctx.lineTo(w * .49, h * .52); ctx.lineTo(w * .63, h * .34); ctx.lineTo(w * .76, h * .52); ctx.lineTo(w * .87, h * .3); ctx.lineTo(w, h * .49); ctx.lineTo(w, h * .79); ctx.lineTo(0, h * .79); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#51404a'; ctx.globalAlpha = .52; ctx.lineWidth = 2;
    for (const x of [w * .12, w * .25, w * .75, w * .88]) { ctx.beginPath(); ctx.moveTo(x, h * .31); ctx.lineTo(x, h * .77); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 12, h * .4); ctx.lineTo(x, h * .34); ctx.lineTo(x + 12, h * .4); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 22; i++) { const x = (i * 173 + 47) % w, y = (i * 71 + 31) % (h * .55); ctx.fillStyle = i % 3 ? '#edbd87' : '#aac9e0'; ctx.globalAlpha = .25 + (i % 4) * .08; ctx.fillRect(x, y, 2, 2); }
    ctx.globalAlpha = 1;
  }
  function drawFighter(f, ground) {
    const x = f.x, footY = ground + f.y, scale = f.crouching ? .66 : 1, isHung = f.name === config.characters.hung.name;
    const bodyW = f.width, bodyH = f.height * scale, top = footY - bodyH;
    const attack = f.attack, telegraph = attack && attack.elapsed < attack.startup;
    ctx.save();
    ctx.globalAlpha = .34; ctx.fillStyle = '#050509'; ctx.beginPath(); ctx.ellipse(x, ground + 2, 43, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    if (telegraph && attack.effect) {
      const progress = attack.elapsed / attack.startup;
      ctx.strokeStyle = attack.effect.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, top + bodyH / 2, bodyH * .57, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();
    }
    if (attack && !attack.projectile && (telegraph || f.attackActive)) {
      const box = f.attackBox;
      ctx.fillStyle = f.glow;
      ctx.globalAlpha = telegraph ? .15 : .65;
      ctx.fillRect(box.x, ground + box.y, box.width, box.height);
      ctx.globalAlpha = 1;
    }
    if (f.blocking) {
      ctx.strokeStyle = '#b5d9f5';
      ctx.lineWidth = 3;
      const angle = f.facing > 0 ? 0 : Math.PI;
      ctx.beginPath();
      ctx.arc(x, top + bodyH * .48, bodyW * 1.15, angle - 1.05, angle + 1.05);
      ctx.stroke();
    }
    ctx.fillStyle = '#383542';
    ctx.fillRect(x - 24, top - 17, 48, 4);
    ctx.fillStyle = '#9bd3ff';
    ctx.fillRect(x - 24, top - 17, 48 * f.guard / config.combat.guardMax, 4);
    if (f.guardBreak > 0) {
      ctx.fillStyle = '#ffca79';
      ctx.textAlign = 'center';
      ctx.font = '700 10px sans-serif';
      ctx.fillText('VỠ THỦ', x, top - 35);
    }
    ctx.save();
    if (f.flash) {
      ctx.translate(x, footY);
      ctx.rotate(-Math.sign(f.knockVelocity) * f.flash * 1.3);
      ctx.translate(-x, -footY);
    }
    if (f.invulnerable) ctx.globalAlpha = .65;
    ctx.shadowBlur = 18; ctx.shadowColor = f.flash ? '#fff' : f.glow; ctx.fillStyle = f.flash ? '#fff2dc' : f.color;
    const bodyX = x - bodyW / 2, shoulderY = top + bodyH * .26;
    ctx.fillRect(bodyX, top + bodyH * .26, bodyW, bodyH * .5);
    ctx.fillRect(bodyX + 2, top + bodyH * .76, bodyW * .34, bodyH * .24);
    ctx.fillRect(x + bodyW * .16, top + bodyH * .76, bodyW * .34, bodyH * .24);
    ctx.fillRect(bodyX - 5, top + bodyH * .03, bodyW + 10, bodyH * .08);
    ctx.fillRect(bodyX + 4, top - 12, bodyW - 8, 16);
    ctx.fillStyle = '#211c26'; ctx.fillRect(f.facing > 0 ? x + 5 : x - 9, top - 7, 4, 2);
    ctx.shadowBlur = 0;
    const armY = shoulderY + bodyH * .12, armLength = attack && (f.attackActive || telegraph) ? Math.min(attack.range * .7, 54) : 15;
    ctx.fillStyle = f.flash ? '#fff2dc' : f.glow;
    if (attack?.id === 'kick' && (f.attackActive || telegraph)) {
      ctx.fillRect(x + f.facing * 3, top + bodyH * .67, f.facing * Math.min(attack.range * .7, 61), 10);
    } else {
      const armX = f.facing > 0 ? x + bodyW * .25 : x - bodyW * .25 - armLength;
      ctx.fillRect(armX, armY, armLength, 12);
    }
    ctx.textAlign = 'center'; ctx.font = '700 10px "Be Vietnam Pro",sans-serif'; ctx.fillStyle = '#f4edf0'; ctx.globalAlpha = .92; ctx.fillText(isHung ? 'HÙNG' : 'MAI', x, top - 22); ctx.globalAlpha = 1;
    ctx.restore();
    ctx.restore();
  }

  return render;
}
