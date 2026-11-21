import { activeZone, stageConditionAt, stageFloorAt, zoneRanges, zoneWarning } from '../game/stages.js';
import { createSpriteRenderer, loadImage } from './sprites.js';
import { createCombatEffects, fireGuardianPath } from './combat-effects.js';
import { createEvolutionEffects, advancedAura } from './evolution-effects.js';
import { drawHungAura, drawHungChargeLayers, hungChargePath, hungEffectsPath } from './hung-evolution.js';
import { hungFallFrame } from './hung-action-poses.js';
import { drawChargeVariant } from './charge-effects.js';
import { createStageBackground } from './stage-background.js';
import { drawStrikeTrail } from './fighter-motion.js';
import { drawHeldWeapon, drawLooseWeapon, hungDaoPath } from './held-weapon.js';
import { ballRadius } from '../game/stage-ball.js';
import { gear } from '../game/pickups.js';
import { weaponTypes } from '../game/equipment.js';
import { drawMorph, drawStageCondition, drawStageLife, drawStageRain } from './stage-life.js';
import { createSeasonSnow } from './season-snow.js';

export function createArenaRenderer(canvas, config) {
  const ctx = canvas.getContext('2d');
  const drawBackground = createStageBackground(document.getElementById('arena-background'));
  const drawSeasonSnow = createSeasonSnow(ctx);
  const h = canvas.height;

  const images = new Map();
  const drawSprite = createSpriteRenderer(ctx, config.characters,
    (fighter, hand, drawHand) => drawHeldWeapon(ctx, images, fighter, hand, drawHand),
    () => images.get(hungEffectsPath));
  const { drawProjectile, drawCombatEffects, drawFireGuardian } = createCombatEffects(ctx, images);
  const sparkSheet = '/assets/effects/combat-sparks.png';
  const { drawEvolutionBody, drawEvolutionWings } = createEvolutionEffects(ctx, images, drawFighter);
  const paths = new Set();
  paths.add(sparkSheet);
  paths.add(advancedAura);
  paths.add(hungEffectsPath);
  paths.add(hungChargePath);
  paths.add(hungDaoPath);
  paths.add(fireGuardianPath);
  for (const item of Object.values(gear)) if (item.image) paths.add(item.image);
  for (const weapon of Object.values(weaponTypes)) if (weapon.image) paths.add(weapon.image);
  for (const character of Object.values(config.characters)) {
    const { wings, overlay } = character.awakening?.evolution ?? {};
    if (wings) paths.add(wings);
    if (overlay) paths.add(overlay.image);
    if (character.weapon?.image) paths.add(character.weapon.image);
  }
  for (const path of paths) loadImage(path).then(image => images.set(path, image)).catch(() => {});

  function render({ stage, stageFrame, width: w, fighters, offsets, movementPoses, projectiles, particles, floaters, trails,
    shake, screenEffect, debug, animationTime, ball, drop, looseWeapons, seasonActive }) {
    const ground = h * config.stage.groundRatio;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    if (!displayWidth || !displayHeight) return;
    const scale = Math.min(displayWidth / w, displayHeight / h);
    const top = (displayHeight - h * scale) / 2;
    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    const pixelWidth = Math.max(1, Math.round(displayWidth * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(displayHeight * pixelRatio));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pixelWidth, pixelHeight);
    ctx.setTransform(pixelWidth / w, 0, 0, scale * pixelHeight / displayHeight, 0, top * pixelHeight / displayHeight);
    const center = (fighters[0].x + offsets[0][0] + fighters[1].x + offsets[1][0]) / 2;
    const floor = canvas.parentElement.offsetTop + top + ground * scale;
    drawBackground(stage, floor, center / w, animationTime);
    ctx.save();
    applyArenaView(shake, screenEffect);
    drawStageAmbience(stage, stageFrame, w, ground);
    drawStageLife(ctx, stage.wildlife, stageFrame, w, ground);
    if (stage.weather === 'rain') drawStageRain(ctx, w, ground, animationTime);
    drawStageHazards(stage, stageFrame, w, ground);
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
      drawFireGuardian(f, ground);
      ctx.restore();
    }
    for (const [index, f] of fighters.entries()) {
      ctx.save();
      ctx.translate(...offsets[index]);
      const morphed = f.hp > 0 && f.stageCondition?.kind === 'morph';
      if (morphed) drawMorph(ctx, f, ground, animationTime);
      else {
        if (f.evolving && f.hp > 0) drawEvolutionWings(f, ground, animationTime);
        drawEvolutionBody(f, ground, animationTime, movementPoses?.[index]);
        if (f.characterId === 'hung') drawHungChargeLayers(ctx, images.get(hungChargePath), f, ground, animationTime, true);
      }
      drawStageCondition(ctx, f, ground, animationTime);
      drawStrikeTrail(ctx, f, ground);
      drawCombatEffects(f, ground);
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
    if (stage.weather === 'rain') drawStageRain(ctx, w, ground, animationTime, true);
    ctx.restore();
    if (screenEffect && screenEffect.elapsed < screenEffect.flashSeconds) {
      ctx.globalAlpha = Math.min(.15, screenEffect.flashOpacity) * (1 - screenEffect.elapsed / screenEffect.flashSeconds);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    if (debug) {
      ctx.save();
      applyArenaView(shake, screenEffect);
      drawCollisionBoxes(fighters, projectiles, ground);
      ctx.restore();
    }
  }

  function drawContactShadow(fighter, stage, width, ground) {
    const floor = stageFloorAt({ width, platforms: stage.platforms, rises: stage.rises }, fighter.x, fighter.y);
    const proximity = 1 / (1 + (floor - fighter.y) / 56);
    const fall = fighter.characterId === 'hung' && fighter.knockdown > 0
      ? hungFallFrame(fighter.knockdown, fighter.knockdownFrames) : -1;
    const lying = fall === 2 || fall === 3 || (fighter.characterId === 'mai'
      && (fighter.hp <= 0 || (fighter.knockdown > 5 && fighter.knockdownFrames - fighter.knockdown >= 10)));
    const radius = fighter.width * (lying ? 1.36 : .55 + .25 * proximity);
    ctx.save();
    ctx.fillStyle = '#090713';
    ctx.globalAlpha = .32 * proximity;
    ctx.beginPath();
    ctx.ellipse(Math.round(fighter.x), Math.round(ground + floor + (lying ? 0 : 2)), radius, lying ? 5 : 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (fighter.equipmentColor && fighter.hp > 0) {
      ctx.globalAlpha = .75 * proximity;
      ctx.strokeStyle = fighter.equipmentColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  function applyArenaView(shake, screenEffect) {
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

  function drawStageHazards(stage, frame, width, ground) {
    const zone = stage.zone;
    if (!zone) return;
    const active = activeZone(zone, frame);
    const warning = zoneWarning(zone, frame);
    const condition = stageConditionAt(zone, frame);
    const color = condition?.color ?? zone.color;
    ctx.save();
    for (const [start, end] of zoneRanges(zone)) {
      const left = start * width;
      const span = (end - start) * width;
      if (zone.kind === 'wind') {
        drawWind(left, span, ground, frame, active ? 1 : warning ? .44 : .1);
        continue;
      }
      if (zone.kind === 'slip' && stage.weather === 'rain') {
        drawWetTiles(left, span, ground, frame);
        continue;
      }
      drawHazardPatches(left, span, ground, frame, zone.kind, color, active ? 1 : warning ? .7 : .23);
      if (condition && (warning || active)) {
        ctx.fillStyle = color;
        ctx.globalAlpha = .95;
        ctx.font = '700 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#1a1722';
        ctx.lineWidth = 3;
        ctx.strokeText(condition.label, left + span / 2, ground - 124);
        ctx.fillText(condition.label, left + span / 2, ground - 124);
      }
    }
    ctx.restore();
  }

  function drawHazardPatches(left, width, ground, frame, kind, color, strength) {
    const lava = kind === 'lava';
    const ice = kind === 'slip';
    const count = Math.max(3, Math.round(width / 40));
    ctx.save();
    for (let i = 0; i < count; i++) {
      const x = left + width * (i + .5) / count;
      const y = ground + (i * 7 % 17) - 5;
      const radius = width / count * (.26 + i % 3 * .05);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((i % 3 - 1) * .16);
      ctx.scale(1, ice ? .27 : .36);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      glow.addColorStop(0, color);
      glow.addColorStop(.49, color + '70');
      glow.addColorStop(1, color + '00');
      ctx.fillStyle = glow;
      ctx.globalAlpha = strength * (ice ? .34 : .61);
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      if (lava) {
        ctx.globalAlpha = strength * .85;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-radius * .86, 1);
        ctx.lineTo(-radius * .29, -radius * .34);
        ctx.lineTo(radius * .04, radius * .20);
        ctx.lineTo(radius * .66, -radius * .19);
        ctx.stroke();
      }
      ctx.restore();
      if (ice || strength < .6) continue;
      const age = (frame / (lava ? 25 : 44) + i * .43) % 1;
      ctx.globalAlpha = (1 - age) * strength * .77;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x + Math.sin(i * 2 + age * 5) * 5, y - age * (lava ? 25 : 62),
        1.4 + i % 3 * .35, lava ? 1.3 : 2.8 + age, .26, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWetTiles(left, width, ground, frame) {
    ctx.save();
    for (let i = 0; i < 7; i++) {
      const x = left + width * (.09 + i * .137);
      const y = ground + 6 + (i * 11 % 17);
      const radius = width * (.065 + i % 3 * .013);
      ctx.fillStyle = '#211d2f';
      ctx.globalAlpha = .2;
      ctx.beginPath();
      ctx.ellipse(x, y, radius, 1.7 + i % 3 * .65, -.025, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = i % 2 ? '#ffb7bc' : '#c8c5d9';
      ctx.globalAlpha = .19 + .06 * Math.sin(frame / 17 + i * 1.6);
      ctx.lineWidth = .8;
      ctx.beginPath();
      ctx.moveTo(x - radius * .59, y + 1);
      ctx.quadraticCurveTo(x, y + 2.2, x + radius * .42, y + .4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWind(left, width, ground, frame, strength) {
    ctx.save();
    for (let i = 0; i < 12; i++) {
      const length = 37 + (i * 19 % 74);
      const travel = (frame * (1.4 + i % 5 * .47) + i * 79) % (width + length);
      const x = left + travel - length;
      const sway = Math.sin(frame * .049 + i * 1.7);
      const y = ground - 12 - (i * 37 % 134) + sway * 10;
      const lift = 6 + i % 4 * 4;
      const fade = Math.min(1, travel / length, (width + length - travel) / length);
      const mist = ctx.createLinearGradient(x, 0, x + length, 0);
      mist.addColorStop(0, '#d9f1ff00');
      mist.addColorStop(.62, '#d9f1ffb0');
      mist.addColorStop(1, '#d9f1ff00');
      ctx.globalAlpha = fade * strength * (.32 + i % 3 * .09);
      ctx.fillStyle = mist;
      ctx.beginPath();
      ctx.moveTo(x, y + 4);
      ctx.bezierCurveTo(x + length * .31, y - lift - sway * 7, x + length * .74, y + sway * 6, x + length, y - lift);
      ctx.quadraticCurveTo(x + length * .56, y + 10, x, y + 4);
      ctx.fill();
    }
    ctx.fillStyle = '#e8f2df';
    for (let i = 0; i < 16; i++) {
      const age = (frame / (73 + i % 5 * 13) + i * .267) % 1;
      const x = left + ((i * 43 + frame * (1.5 + i % 4 * .6)) % width);
      const y = ground - 4 - age * (12 + i % 6 * 7) + Math.sin(frame * .08 + i) * 3;
      ctx.globalAlpha = Math.sin(Math.PI * age) * strength * .55;
      ctx.beginPath();
      ctx.ellipse(x, y, 1 + i % 3 * .65, .8, Math.sin(i + frame * .13), 0, 2 * Math.PI);
      ctx.fill();
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
    const fullMeter = fighter.meter >= fighter.meterMax;
    if (fighter.hp <= 0 || (!fighter.charging && !fighter.evolving && !fullMeter)) return;
    if (fighter.characterId === 'hung') {
      if (drawHungChargeLayers(ctx, images.get(hungChargePath), fighter, ground, time, false)) return;
      if (drawHungAura(ctx, images.get(hungEffectsPath), fighter, ground, time)) return;
    }
    if (fighter.characterId === 'hung' && fighter.evolving && !fighter.charging) return;
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
        ctx.globalAlpha = Math.min(1, fighter.formAge / 18) / (1 + Math.abs(fighter.y) / 90);
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
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 35 + pulse * 2, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
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

  function drawFighter(fighter, ground, animationTime, movementPose) {
    if (!drawSprite(fighter, ground, animationTime, movementPose)) {
      const body = fighter.hurtbox;
      ctx.fillStyle = fighter.flash > 0 ? '#fff2dc' : fighter.color;
      ctx.fillRect(body.x, ground + body.y, body.width, body.height);
    }
  }

  render.preloadFighter = drawSprite.preloadFighter;
  return render;
}
