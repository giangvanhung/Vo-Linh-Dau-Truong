import { activeZone, overlapsSurface, zoneRanges } from '../game/stages.js';
import { createSpriteRenderer, loadImage } from './sprites.js';
import { createCombatEffects } from './combat-effects.js';
import { createStageBackground } from './stage-background.js';
import { drawStrikeTrail } from './fighter-motion.js';
import { drawHeldWeapon } from './held-weapon.js';
import { ballRadius } from '../game/stage-ball.js';
import { gear } from '../game/pickups.js';

export function createArenaRenderer(canvas, config) {
  const ctx = canvas.getContext('2d');
  const drawBackground = createStageBackground(document.getElementById('arena-background'));
  const w = canvas.width, h = canvas.height;

  const drawSprite = createSpriteRenderer(ctx, config.characters);
  const images = new Map();
  const { drawProjectile, drawCombatEffects } = createCombatEffects(ctx, images);
  const sparkSheet = '/assets/effects/combat-sparks.png';
  const evolutionFist = '/assets/effects/hung-evolution-fist.png';
  const advancedAura = '/assets/effects/evolution-level-two.png';
  const paths = new Set();
  paths.add(sparkSheet);
  paths.add(evolutionFist);
  paths.add(advancedAura);
  for (const item of Object.values(gear)) if (item.image) paths.add(item.image);
  for (const character of Object.values(config.characters)) {
    const { wings, overlay } = character.awakening?.evolution ?? {};
    if (wings) paths.add(wings);
    if (overlay) paths.add(overlay.image);
    if (character.weapon?.image) paths.add(character.weapon.image);
  }
  for (const path of paths) loadImage(path).then(image => images.set(path, image)).catch(() => {});

  function render({ stage, stageFrame, fighters, offsets, projectiles, particles, floaters, trails, shake, screenEffect, debug, animationTime, ball, drop }) {
    const ground = h * config.stage.groundRatio;
    const displayHeight = canvas.clientHeight;
    const scale = Math.min(canvas.clientWidth / w, displayHeight / h);
    const pixelScale = Math.min(2, Math.max(1, scale * (window.devicePixelRatio || 1)));
    const pixelWidth = Math.round(w * pixelScale);
    const pixelHeight = Math.round(h * pixelScale);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    ctx.setTransform(pixelWidth / w, 0, 0, pixelHeight / h, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const center = (fighters[0].x + offsets[0][0] + fighters[1].x + offsets[1][0]) / 2;
    const floor = canvas.parentElement.offsetTop + (displayHeight - h * scale) / 2 + ground * scale;
    drawBackground(stage, floor, center / w);
    ctx.save();
    applyShake(shake, screenEffect);
    drawTerrain(stage, stageFrame, w, ground);
    if (ball) drawBall(ball, ground);
    if (drop) {
      ctx.fillStyle = '#252420';
      ctx.fillRect(drop.x - 15, ground + drop.y - 15, 30, 29);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#eac587';
      ctx.strokeRect(drop.x - 15, ground + drop.y - 15, 30, 29);
      ctx.fillStyle = '#eac587';
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('?', drop.x, ground + drop.y + 7);
    }
    for (const trail of trails) {
      ctx.globalAlpha = trail.life / trail.total;
      ctx.fillStyle = trail.color;
      ctx.fillRect(Math.min(trail.from, trail.to), ground + trail.y - 11, Math.abs(trail.to - trail.from), 11);
    }
    ctx.globalAlpha = 1;
    fighters.forEach((fighter, index) => {
      ctx.save();
      ctx.translate(offsets[index][0], 0);
      drawContactShadow(fighter, stage, w, ground);
      ctx.restore();
    });
    for (const shot of projectiles) drawProjectile(shot, ground);
    for (const [index, f] of fighters.entries()) {
      ctx.save();
      ctx.translate(...offsets[index]);
      drawAura(f, ground, animationTime);
      ctx.restore();
    }
    for (const [index, f] of fighters.entries()) {
      ctx.save();
      ctx.translate(...offsets[index]);
      if (f.evolving && f.hp > 0) drawEvolutionWings(f, ground, animationTime);
      drawEvolutionBody(f, ground, animationTime);
      drawHeldWeapon(ctx, images, f, ground, animationTime);
      drawStrikeTrail(ctx, f, ground);
      drawCombatEffects(f, ground);
      if (f.attack?.evolvedPunch) drawEvolutionFist(f, ground, animationTime);
      if (f.hp <= 0 || (!f.freezeFrames && !f.poisonFrames)) {
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.strokeStyle = f.freezeFrames ? '#a7f0ff' : '#ace781';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.globalAlpha = .62;
      const y = ground + f.y;
      if (f.freezeFrames) {
        ctx.beginPath();
        ctx.moveTo(f.x - 31, y);
        ctx.lineTo(f.x - 24, y - f.height * .68);
        ctx.lineTo(f.x, y - f.height - 4);
        ctx.lineTo(f.x + 25, y - f.height * .59);
        ctx.lineTo(f.x + 33, y);
        ctx.closePath();
        ctx.stroke();
      } else {
        for (let i = 0; i < 4; i++) {
          const rise = (animationTime / 24 + i * 13) % 46;
          ctx.fillRect(f.x + Math.cos(i * 2.1 + rise / 10) * 25, y - rise, 3, 3);
        }
      }
      ctx.restore();
      ctx.restore();
    }
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
        const texture = images.get(sparkSheet);
        if (texture) {
          const column = f.sparkType === 'guard' ? 2 : f.sparkType === 'kick' ? 1 : 0;
          const tile = texture.height;
          const size = Math.round(28 + 18 * (1 - spark) + (f.sparkType === 'kick' ? 8 : 0));
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.translate(Math.round(f.x), Math.round(ground + f.contactY));
          ctx.scale(f.facing < 0 ? -1 : 1, 1);
          ctx.drawImage(texture, column * tile, 0, tile, tile, -size / 2, -size / 2, size, size);
          ctx.restore();
          continue;
        }
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

  function drawContactShadow(fighter, stage, width, ground) {
    let floor = 0;
    for (const platform of stage.platforms ?? []) {
      if (fighter.y <= platform.y && overlapsSurface(fighter.x, width, platform.range)) {
        floor = Math.min(floor, platform.y);
      }
    }
    const proximity = 1 / (1 + (floor - fighter.y) / 56);
    const radius = fighter.width * (.55 + .25 * proximity);
    ctx.save();
    ctx.fillStyle = '#090713';
    ctx.globalAlpha = .32 * proximity;
    ctx.beginPath();
    ctx.ellipse(Math.round(fighter.x), Math.round(ground + floor + 2), radius, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (fighter.equipmentColor && fighter.hp > 0) {
      ctx.globalAlpha = .75 * proximity;
      ctx.strokeStyle = fighter.equipmentColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
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

  function drawTerrain(stage, frame, w, ground) {
    ctx.save();
    for (const platform of stage.platforms ?? []) {
      const [left, right] = platform.range.map(value => Math.round(value * w));
      const y = ground + platform.y;
      ctx.fillStyle = '#182939';
      ctx.fillRect(left + 5, y + 4, right - left - 10, 13);
      ctx.fillStyle = stage.zone?.color ?? '#92a6b7';
      ctx.fillRect(left, y, right - left, 4);
      ctx.fillStyle = '#536579';
      for (let x = left + 16; x < right - 6; x += 24) ctx.fillRect(x, y + 7, 8, 4);
    }
    const zone = stage.zone;
    if (zone) {
      const active = activeZone(zone, frame);
      const warning = zone.cycle && frame % zone.cycle >= zone.cycle - zone.active - 48;
      ctx.fillStyle = zone.color;
      for (const [start, end] of zoneRanges(zone)) {
        const left = start * w, width = (end - start) * w;
        const lava = zone.kind === 'lava';
        ctx.globalAlpha = active ? .55 : warning ? .35 : .15;
        ctx.fillRect(left, ground + (lava ? -3 : 2), width, lava ? 13 : zone.kind === 'slip' ? 5 : 3);
        if (!active || zone.kind === 'slip') continue;
        for (let i = 0; i < 12; i++) {
          const x = left + ((i * 37 + frame * 3) % width);
          const y = ground - 5 - ((i * 17 + frame * 4) % (zone.kind === 'wind' ? 145 : lava ? 28 : 72));
          ctx.fillRect(x, y, zone.kind === 'wind' ? 15 : 3, zone.kind === 'wind' || lava ? 2 : 9);
        }
      }
    }
    ctx.restore();
  }

  function drawChargeAura(fighter, time, build, color) {
    const height = fighter.height * (.85 + build * .72);
    const width = fighter.hurtbox.width * (.65 + build * .48);
    const pulse = Math.sin(time / 42);
    const light = ctx.createLinearGradient(0, -height, 0, 0);
    light.addColorStop(0, 'transparent');
    light.addColorStop(.45, color);
    light.addColorStop(1, '#fff3cb');

    const ripple = (time / 480) % 1;
    ctx.globalAlpha = (1 - ripple) * build * .7;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, width * (.8 + ripple), 4 + ripple * 8, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = light;
    ctx.globalAlpha = .28 + build * .38;
    ctx.beginPath();
    ctx.moveTo(-width, 0);
    ctx.quadraticCurveTo(-width * 1.12, -height * .32, -width * .74, -height * (.69 + pulse * .07));
    ctx.lineTo(-width * .37, -height * .48);
    ctx.lineTo(-width * .13, -height);
    ctx.lineTo(width * .25, -height * .66);
    ctx.lineTo(width * .62, -height * (.86 - pulse * .06));
    ctx.quadraticCurveTo(width * .68, -height * .38, width, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    for (let i = 0; i < 12; i++) {
      const rise = (time / 290 + i * .271) % 1;
      const side = i % 2 ? 1 : -1;
      const x = side * width * (.65 + (i % 4) * .14 - rise * .28);
      const y = -rise * height;
      ctx.globalAlpha = (1 - rise) * (.45 + build * .4);
      ctx.fillStyle = i % 3 ? color : '#fff3cb';
      ctx.fillRect(x, y, 2, 6 + build * 9);
    }

    ctx.fillStyle = '#d3bc9a';
    for (let i = 0; i < 6; i++) {
      const lift = (time / 620 + i / 6) % 1;
      const x = (i % 2 ? 1 : -1) * width * (.65 + lift * .58);
      ctx.globalAlpha = (1 - lift) * build * .65;
      ctx.fillRect(x, -lift * 25, 3, 3);
    }
  }

  function drawAura(fighter, ground, time) {
    const fullMeter = fighter.meter >= fighter.rules.meterMax;
    if (fighter.hp <= 0 || (!fighter.charging && !fighter.awakeningFrames && !fullMeter)) return;
    const pulse = Math.sin(time / 110);
    ctx.save();
    ctx.translate(fighter.x, ground + fighter.y);
    ctx.strokeStyle = ctx.fillStyle = fighter.glow;
    if (fighter.charging || fighter.evolving) {
      const color = fighter.evolving ? fighter.evolution.color ?? '#ffcc53' : fighter.glow;
      if (fighter.evolving) {
        ctx.save();
        ctx.translate(0, -fighter.y);
        ctx.scale(1, .22);
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 64 + pulse * 5);
        glow.addColorStop(0, color + '66');
        glow.addColorStop(1, color + '00');
        ctx.globalAlpha = Math.min(1, fighter.awakeningFrames / 18) / (1 + Math.abs(fighter.y) / 90);
        ctx.fillStyle = glow;
        ctx.fillRect(-70, -70, 140, 140);
        ctx.restore();
      }
      ctx.strokeStyle = color;
      drawChargeAura(fighter, time, fighter.evolving ? (fighter.awakeningLevel === 2 ? 1.45 : 1) : Math.min(1, fighter.chargeFrames / 24), color);
      ctx.restore();
      return;
    }
    ctx.globalAlpha = .78;
    ctx.lineWidth = fighter.awakeningFrames ? 3 : 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 35 + pulse * 2, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (fighter.awakeningFrames) {
      for (let i = 0; i < 8; i++) {
        const angle = time / 340 + i * Math.PI / 4;
        const height = (time / 27 + i * 9) % 66;
        ctx.globalAlpha = (1 - height / 66) * .65;
        ctx.fillRect(Math.round(Math.cos(angle) * 34), Math.round(-height), 3, 3);
      }
    }
    ctx.restore();
  }

  function drawEvolutionWings(fighter, ground, time) {
    const image = images.get(fighter.evolution.wings);
    if (!image) return;
    const pulse = Math.sin(time / 105);
    const progress = Math.min(1, (fighter.awakeningDuration - fighter.awakeningFrames + 1) / 12, fighter.awakeningFrames / 20);
    const width = fighter.height * (1.42 + pulse * .09) * (.62 + .38 * progress);
    const height = width * image.height / image.width;
    ctx.save();
    ctx.translate(fighter.x - fighter.facing * 8, ground + fighter.y - fighter.hurtbox.height * .67);
    ctx.scale(fighter.facing, 1);
    ctx.rotate(pulse * .055);
    ctx.globalAlpha = progress * (.94 + pulse * .06);
    ctx.drawImage(image, -width * .66, -height * .83, width, height);
    ctx.restore();
  }

  function drawEvolutionBody(fighter, ground, time) {
    if (!fighter.evolving || fighter.hp <= 0) {
      drawFighter(fighter, ground, time);
      return;
    }

    const age = fighter.awakeningDuration - fighter.awakeningFrames;
    const blend = Math.min(1, age / 14, fighter.awakeningFrames / 18);
    const { body, color = '#ffcc53', scale = 1, overlay } = fighter.evolution;
    const size = 1 + blend * (scale - 1);
    const feet = ground + fighter.y;
    const aura = fighter.awakeningLevel === 2 && images.get(advancedAura);
    if (aura && blend > 0) {
      const width = fighter.height * (1.65 + .1 * Math.sin(time / 160));
      const height = width * aura.height / aura.width;
      ctx.save();
      ctx.globalAlpha = .58 * blend;
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(aura, fighter.x - width / 2, feet - height * .89, width, height);
      ctx.restore();
    }
    if (overlay?.behind) drawEvolutionOverlay(fighter, ground, time, blend, overlay);
    ctx.save();
    ctx.translate(fighter.x, feet);
    ctx.scale(size, size);
    ctx.translate(-fighter.x, -feet);
    drawFighter(fighter, ground, time);
    ctx.restore();

    if (body) drawEvolutionEquipment(fighter, ground, time, blend, body, color);
    if (overlay && !overlay.behind) drawEvolutionOverlay(fighter, ground, time, blend, overlay);

    if (age < 24) {
      const wave = age / 24;
      ctx.save();
      ctx.globalAlpha = (1 - wave) * .85;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3 - 2 * wave;
      ctx.beginPath();
      ctx.ellipse(fighter.x, feet, 14 + wave * 100, 4 + wave * 18, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEvolutionEquipment(fighter, ground, time, blend, body, color) {
    const torso = ground + fighter.hurtbox.y + fighter.hurtbox.height * .36;
    ctx.save();
    ctx.translate(fighter.x, torso);
    ctx.scale(fighter.attack?.facing ?? fighter.dash?.facing ?? fighter.facing, 1);
    ctx.globalAlpha = blend;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 9;
    ctx.lineWidth = 1.5;
    if (body === 'armor') {
      if (!fighter.dash?.roll) {
        ctx.fillStyle = '#5b301e';
        ctx.beginPath();
        ctx.moveTo(-18, -9);
        ctx.lineTo(-9, -13);
        ctx.lineTo(0, -6);
        ctx.lineTo(10, -13);
        ctx.lineTo(19, -8);
        ctx.lineTo(11, 8);
        ctx.lineTo(0, 14);
        ctx.lineTo(-11, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      if (fighter.attack?.evolvedPunch) {
        const box = fighter.attackBoxFor(fighter.attack, fighter.attack.facing);
        const reach = Math.min(1, fighter.attack.elapsed / Math.max(1, fighter.attack.startup));
        const tip = (fighter.attack.facing > 0 ? box.x + box.width - fighter.x : fighter.x - box.x) * reach;
        ctx.beginPath();
        ctx.moveTo(9, 4);
        ctx.lineTo(tip * .55, Math.sin(time / 19) * 7);
        ctx.lineTo(tip, ground + box.y + box.height / 2 - torso);
        ctx.stroke();
      }
    } else if (body === 'sword') {
      const angle = time / 240;
      ctx.translate(Math.cos(angle) * 35, Math.sin(angle) * 13);
      ctx.rotate(-.55 + Math.sin(angle) * .24);
      ctx.fillStyle = '#dafaff';
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(5, -14);
      ctx.lineTo(2, 11);
      ctx.lineTo(-4, 15);
      ctx.lineTo(-5, -11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(-8, 11, 16, 2);
    }
    ctx.restore();
  }

  function drawEvolutionOverlay(fighter, ground, time, blend, overlay) {
    const image = images.get(overlay.image);
    if (!image) return;
    const facing = fighter.attack?.facing ?? fighter.dash?.facing ?? fighter.facing;
    const pulse = Math.sin(time / 115);
    const active = fighter.attackActive;
    const width = fighter.height * overlay.width * (1 + pulse * .04 + (active ? .12 : 0));
    const height = width * image.height / image.width;
    ctx.save();
    ctx.translate(fighter.x + facing * fighter.height * (overlay.x + (active ? .12 : 0)),
      ground + fighter.y - fighter.height * overlay.y + pulse * 3);
    ctx.scale(facing, 1);
    ctx.rotate(pulse * .09);
    ctx.globalAlpha = blend * (active ? 1 : .87);
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();
  }

  function drawEvolutionFist(fighter, ground, time) {
    const image = images.get(evolutionFist);
    if (!image) return;
    const { attack } = fighter;
    const box = fighter.attackBoxFor(attack, attack.facing);
    const reach = Math.min(1, attack.elapsed / Math.max(1, attack.startup));
    const handX = attack.facing > 0 ? box.x + box.width : box.x;
    const size = (attack.id === 'heavy' ? 62 : 48) + Math.sin(time / 34) * 4;
    ctx.save();
    ctx.translate(fighter.x + (handX - fighter.x) * reach, ground + box.y + box.height / 2);
    ctx.rotate(time / 115 * attack.facing);
    ctx.globalAlpha = fighter.attackActive ? 1 : .7;
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  function drawBall(ball, ground) {
    ctx.save();
    ctx.translate(ball.x, ground);
    ctx.fillStyle = '#141f235c';
    ctx.beginPath();
    ctx.ellipse(0, 1, ballRadius, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(0, ball.y - ballRadius);
    ctx.rotate(ball.spin);
    ctx.fillStyle = '#fff5de';
    ctx.strokeStyle = '#202631';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, ballRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#303747';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * .4;
      const x = Math.cos(angle), y = Math.sin(angle);
      if (i === 0) ctx.moveTo(x * 4, y * 4);
      else ctx.lineTo(x * 4, y * 4);
    }
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * .4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 4, Math.sin(angle) * 4);
      ctx.lineTo(Math.cos(angle) * 11, Math.sin(angle) * 11);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFighter(fighter, ground, animationTime) {
    if (!drawSprite(fighter, ground, animationTime)) {
      const body = fighter.hurtbox;
      ctx.fillStyle = fighter.flash > 0 ? '#fff2dc' : fighter.color;
      ctx.fillRect(body.x, ground + body.y, body.width, body.height);
    }
  }

  return render;
}
