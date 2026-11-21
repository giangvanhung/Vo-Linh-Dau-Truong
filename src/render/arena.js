import { activeZone, groundHeightAt, stageConditionAt, stageFloorAt, zoneRanges, zoneWarning } from '../game/stages.js';
import { createSpriteRenderer, loadImage } from './sprites.js';
import { createCombatEffects } from './combat-effects.js';
import { createEvolutionEffects, evolutionFist, advancedAura } from './evolution-effects.js';
import { drawChargeVariant } from './charge-effects.js';
import { createStageBackground } from './stage-background.js';
import { drawStrikeTrail } from './fighter-motion.js';
import { drawHeldWeapon, drawLooseWeapon } from './held-weapon.js';
import { ballRadius } from '../game/stage-ball.js';
import { gear } from '../game/pickups.js';
import { weaponTypes } from '../game/equipment.js';
import { drawMorph, drawStageCondition, drawStageLife } from './stage-life.js';
import { createSeasonSnow } from './season-snow.js';

const terrainArt = Object.fromEntries(['crate', 'steel', 'stone', 'timber'].map(kind =>
  [kind, '/assets/backgrounds/terrain-' + kind + '.png']));

export function createArenaRenderer(canvas, config) {
  const ctx = canvas.getContext('2d');
  const drawBackground = createStageBackground(document.getElementById('arena-background'));
  const drawSeasonSnow = createSeasonSnow(ctx);
  const h = canvas.height;
  // Leave room for wide attack poses and evolved bodies beyond the arena walls.
  const wallClearance = 48;

  const images = new Map();
  const drawSprite = createSpriteRenderer(ctx, config.characters,
    (fighter, hand, drawHand) => drawHeldWeapon(ctx, images, fighter, hand, drawHand));
  const { drawProjectile, drawCombatEffects } = createCombatEffects(ctx, images);
  const sparkSheet = '/assets/effects/combat-sparks.png';
  const { drawEvolutionBody, drawEvolutionFist, drawEvolutionWings } = createEvolutionEffects(ctx, images, drawFighter);
  const paths = new Set();
  paths.add(sparkSheet);
  paths.add(evolutionFist);
  paths.add(advancedAura);
  for (const item of Object.values(gear)) if (item.image) paths.add(item.image);
  for (const weapon of Object.values(weaponTypes)) if (weapon.image) paths.add(weapon.image);
  for (const asset of Object.values(terrainArt)) paths.add(asset);
  for (const character of Object.values(config.characters)) {
    const { wings, overlay } = character.awakening?.evolution ?? {};
    if (wings) paths.add(wings);
    if (overlay) paths.add(overlay.image);
    if (character.weapon?.image) paths.add(character.weapon.image);
  }
  for (const path of paths) loadImage(path).then(image => images.set(path, image)).catch(() => {});

  function render({ stage, stageFrame, width: w, fighters, offsets, projectiles, particles, floaters, trails,
    shake, screenEffect, debug, animationTime, ball, drop, looseWeapons, seasonActive }) {
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
    applyArenaView(w, ground, shake, screenEffect);
    drawStageAmbience(stage, stageFrame, w, ground);
    drawStageLife(ctx, stage.wildlife, stageFrame, w, ground);
    drawTerrain(stage, stageFrame, w, ground);
    drawSeasonSnow(stage, stageFrame, w, ground, fighters, animationTime, seasonActive);
    if (ball) drawBall(ball, ground);
    for (const item of looseWeapons) drawLooseWeapon(ctx, images, item, ground, animationTime);
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
      const morphed = f.hp > 0 && f.stageCondition?.kind === 'morph';
      if (morphed) drawMorph(ctx, f, ground, animationTime);
      else {
        if (f.evolving && f.hp > 0) drawEvolutionWings(f, ground, animationTime);
        drawEvolutionBody(f, ground, animationTime);
      }
      drawStageCondition(ctx, f, ground, animationTime);
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
      applyArenaView(w, ground, shake, screenEffect);
      drawCollisionBoxes(fighters, projectiles, ground);
      ctx.restore();
    }
  }

  function drawContactShadow(fighter, stage, width, ground) {
    const floor = stageFloorAt({ width, platforms: stage.platforms, rises: stage.rises }, fighter.x, fighter.y);
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

  function applyArenaView(w, ground, shake, screenEffect) {
    const viewScale = w / (w + 2 * wallClearance);
    ctx.translate((1 - viewScale) * w / 2, (1 - viewScale) * ground);
    ctx.scale(viewScale, viewScale);
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
      if (shot.attack.projectile.meterPerFrame) {
        draw({ x: shot.x - (shot.facing < 0 ? shot.width : 0), y: shot.y - shot.height / 2,
          width: shot.width, height: shot.height }, '#ff5d63');
        continue;
      }
      const { width, height } = shot.attack.projectile;
      draw({ x: shot.x - width / 2, y: shot.y - height / 2, width, height }, '#ff5d63');
    }
  }

  function drawTerrain(stage, frame, w, ground) {
    ctx.save();
    const edgeColor = stage.terrainColor ?? '#90a7b8';
    const world = { width: w, rises: stage.rises };
    for (const { range, rise } of stage.rises ?? []) {
      const [left, right] = range.map(value => value * w);
      const ramp = (right - left) * .35;
      const points = [left, left + ramp, right - ramp, right];
      ctx.beginPath();
      for (const x of points) ctx.lineTo(x, ground + groundHeightAt(world, x));
      ctx.lineTo(right, ground + 11);
      ctx.lineTo(left, ground + 11);
      ctx.closePath();
      const paint = ctx.createLinearGradient(0, ground - 26, 0, ground + 12);
      paint.addColorStop(0, edgeColor);
      paint.addColorStop(1, '#20212c');
      ctx.fillStyle = paint;
      ctx.fill();
      const stone = images.get(terrainArt.stone);
      if (stone) {
        ctx.save();
        ctx.clip();
        ctx.globalAlpha = .72;
        ctx.drawImage(stone, stone.width * .08, stone.height * .28, stone.width * .84, stone.height * .62,
          left, ground - rise, right - left, rise + 11);
        ctx.restore();
      }
      ctx.beginPath();
      for (const x of points) ctx.lineTo(x, ground + groundHeightAt(world, x));
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.strokeStyle = edgeColor;
    ctx.globalAlpha = .65;
    ctx.lineWidth = 2;
    for (const x of [15, w - 15]) {
      const towardCenter = x < w / 2 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x, ground - 13);
      ctx.lineTo(x, ground + 4);
      ctx.lineTo(x + towardCenter * 17, ground + 4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const platform of stage.platforms ?? []) {
      const [left, right] = platform.range.map(value => Math.round(value * w));
      const y = ground + platform.y;
      const art = images.get(terrainArt[platform.art]);
      if (art) {
        const width = right - left;
        const available = ground + Math.min(groundHeightAt(world, left), groundHeightAt(world, right)) - y;
        const thickness = Math.max(17, Math.min(available, width * art.height / art.width, platform.art === 'steel' ? 98 : 63));
        ctx.drawImage(art, left, y, width, thickness);
        ctx.globalAlpha = .62;
        ctx.fillStyle = edgeColor;
        ctx.fillRect(left + 2, y, width - 4, 2);
        ctx.globalAlpha = 1;
        continue;
      }
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
      const warning = zoneWarning(zone, frame);
      const condition = stageConditionAt(zone, frame);
      const zoneColor = condition?.color ?? zone.color;
      ctx.fillStyle = zoneColor;
      for (const [start, end] of zoneRanges(zone)) {
        const left = start * w, width = (end - start) * w;
        const lava = zone.kind === 'lava';
        if (condition && warning) {
          ctx.globalAlpha = active ? .23 : .11;
          ctx.fillRect(left, ground - 26, width, 28);
          ctx.globalAlpha = .92;
          ctx.font = '700 15px sans-serif';
          ctx.textAlign = 'center';
          ctx.strokeStyle = '#1a1722';
          ctx.lineWidth = 3;
          ctx.strokeText(condition.label, left + width / 2, ground - 124);
          ctx.fillText(condition.label, left + width / 2, ground - 124);
        }
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

  function drawStageAmbience(stage, frame, width, ground) {
    if (!stage.ambient) return;
    ctx.save();
    ctx.fillStyle = stage.ambient;
    for (let index = 0; index < 24; index++) {
      const x = (index * 167 + frame * (.14 + index % 3 * .08)) % width;
      const y = ground - 26 - (index * 43 % 238) + Math.sin(index * 2 + frame / 38) * 8;
      ctx.globalAlpha = .13 + (Math.sin(frame / 22 + index * 1.6) + 1) * .18;
      ctx.fillRect(Math.round(x), Math.round(y), index % 4 ? 2 : 3, 2);
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
      const build = fighter.evolving ? (fighter.awakeningLevel === 2 ? 1.45 : 1) : Math.min(1, fighter.chargeFrames / 24);
      if (!drawChargeVariant(ctx, fighter, time, build, color)) drawChargeAura(fighter, time, build, color);
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
