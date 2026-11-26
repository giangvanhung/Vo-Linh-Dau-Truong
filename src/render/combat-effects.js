import { hungKickTip, hungTechniqueFrame, hungTechniqueHand } from './hung-action-poses.js';
import { gear } from '../game/pickups.js';
import { drawItemShape } from './held-weapon.js';

export const fireGuardianPath = '/assets/effects/hung-fire-guardian.png';

export function createCombatEffects(ctx, images) {
  function drawFireGuardian(fighter, ground) {
    const attack = fighter.attack;
    if (attack?.visual !== 'fireGuardian' || fighter.disabled) return;
    const { elapsed, startup, active, recovery } = attack;
    const rise = Math.min(1, (elapsed + 1) / 8);
    const step = Math.max(0, Math.min(1, (elapsed - 4) / (startup - 4)));
    const strike = elapsed >= startup;
    const fade = Math.max(0, 1 - Math.max(0, elapsed - startup - active) / Math.min(15, recovery));
    const width = 152;
    const height = 151;
    if (!fade) return;
    ctx.save();
    ctx.translate(fighter.x + attack.facing * (-27 + (step * step * (3 - 2 * step)) * 74), ground + fighter.y);
    ctx.scale(attack.facing, 1);
    ctx.globalAlpha = rise * fade;
    const light = ctx.createRadialGradient(0, -height * .42, 5, 0, -height * .42, height * .56);
    light.addColorStop(0, '#ffbd7060');
    light.addColorStop(.56, '#f1722b36');
    light.addColorStop(1, '#b9230d00');
    ctx.fillStyle = light;
    ctx.fillRect(-height, -height, height * 2, height * 1.2);
    const image = images.get(fireGuardianPath);
    if (image) {
      const cell = image.width / 2;
      ctx.drawImage(image, strike ? cell : 0, 0, cell, image.height, -width * .5, -height, width, height + 5);
    }
    const color = '#ffcf85';
    if (strike && elapsed < startup + active + 8) {
      const age = elapsed - startup;
      ctx.strokeStyle = color;
      ctx.lineWidth = 4 - Math.min(3, age * .3);
      ctx.globalAlpha *= Math.max(0, 1 - age / (active + 8));
      ctx.shadowColor = '#ff8235';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(-7, -57);
      ctx.bezierCurveTo(29, -71, 67, -100, 91, -75);
      ctx.quadraticCurveTo(99, -62, 79, -43);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPalmSeal(width, height, color, age) {
    ctx.save();
    ctx.scale(width / 100, height / 100);
    const ink = ctx.createLinearGradient(-48, 0, 42, 0);
    ink.addColorStop(0, '#201b2300');
    ink.addColorStop(.44, color + '8c');
    ink.addColorStop(1, '#fff2d1');
    ctx.fillStyle = ink;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-31, 43);
    ctx.bezierCurveTo(-32, 28, -21, 18, -17, 9);
    ctx.lineTo(-26, -10);
    ctx.quadraticCurveTo(-26, -21, -18, -18);
    ctx.lineTo(-7, -7);
    ctx.lineTo(-9, -31);
    ctx.quadraticCurveTo(-6, -42, 0, -35);
    ctx.lineTo(5, -17);
    ctx.lineTo(8, -43);
    ctx.quadraticCurveTo(13, -50, 17, -43);
    ctx.lineTo(17, -15);
    ctx.lineTo(24, -36);
    ctx.quadraticCurveTo(31, -42, 32, -33);
    ctx.lineTo(27, -8);
    ctx.lineTo(36, -23);
    ctx.quadraticCurveTo(43, -26, 42, -18);
    ctx.lineTo(33, 12);
    ctx.quadraticCurveTo(23, 38, -5, 42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const sway = Math.sin(age * .48) * 5;
    ctx.strokeStyle = ink;
    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-47, -15 + sway);
    ctx.bezierCurveTo(-15, -29 + sway, 19, -11, 49, -36);
    ctx.moveTo(-50, 30);
    ctx.bezierCurveTo(-37, 21 - sway, -15, 31, 9, 17);
    ctx.moveTo(-31, 48);
    ctx.quadraticCurveTo(6, 56 - sway, 40, 28);
    ctx.stroke();
    ctx.restore();
  }

  function drawChannelBeam({ x, y, facing, width, height, age }, ground) {
    if (width < 1) return;
    const radius = height / 2;
    ctx.save();
    ctx.translate(x, ground + y);
    ctx.scale(facing, 1);
    const glow = ctx.createLinearGradient(0, -radius, 0, radius);
    glow.addColorStop(0, '#087dff00');
    glow.addColorStop(.25, '#258fff');
    glow.addColorStop(.5, '#f3ffff');
    glow.addColorStop(.75, '#258fff');
    glow.addColorStop(1, '#087dff00');
    ctx.fillStyle = glow;
    const tipWidth = Math.min(width, radius * 1.5);
    const tipBase = width - tipWidth;
    ctx.fillRect(0, -radius, tipBase, height);
    ctx.beginPath();
    ctx.ellipse(tipBase, 0, tipWidth, radius, 0, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.strokeStyle = '#e3ffff';
    ctx.lineWidth = Math.max(1, radius * .18);
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const progress = i / 24;
      ctx.lineTo(width * progress, Math.sin(i * .9 - age * .8) * radius * .32 * Math.min(1, (1 - progress) * 8));
    }
    ctx.stroke();
    ctx.fillStyle = '#b8f6ff';
    for (let i = 0; i < 10; i++) {
      if (tipBase <= 0) break;
      const offset = (age * 31 + i * 101) % tipBase;
      ctx.fillRect(offset, Math.sin(i * 3.7 + age * .2) * radius * 1.25, Math.min(22, tipBase - offset), 1.5);
    }
    ctx.shadowColor = '#27aaff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#f1ffff';
    ctx.beginPath();
    ctx.arc(0, 0, radius * .66, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(width, 0, Math.min(radius * .28, tipWidth), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawProjectile(shot, ground) {
    const { x, y, facing, attack, attacker } = shot;
    const { color, width, height, pierce, shape } = attack.projectile;
    if (shape === 'channelBeam') {
      if (attacker.attack === attack) drawChannelBeam(shot, ground);
      return;
    }
    ctx.save();
    ctx.shadowColor = ctx.fillStyle = color;
    ctx.shadowBlur = 10;
    ctx.translate(x, ground + y);
    ctx.scale(facing, 1);
    if (shape === 'palmSeal') {
      drawPalmSeal(width, height, color, shot.age);
      ctx.restore();
      return;
    }
    if (shape === 'wind' && attacker.characterId === 'mai') {
      ctx.rotate(-.16);
      drawWindBlade(width, height, color);
      ctx.restore();
      return;
    }
    if (['slipper', 'orb', 'vial', 'dart'].includes(shape)) {
      if (shape !== 'orb') ctx.rotate(shot.age * (shape === 'dart' ? .42 : .19));
      if (shape === 'slipper') ctx.translate(-width / 2, 0);
      drawItemShape(ctx, shape, color, width / (shape === 'slipper' ? 34 : 26));
      ctx.restore();
      return;
    }
    const weapon = attack.usesNativeWeapon && attacker.weapon?.projectile && images.get(attacker.weapon.image);
    if (weapon) {
      const size = width * 1.08;
      const imageHeight = size * weapon.height / weapon.width;
      ctx.rotate(.58);
      ctx.drawImage(weapon, -size / 2, -imageHeight / 2, size, imageHeight);
      ctx.restore();
      return;
    }
    if (shape === 'waveBeam') {
      ctx.beginPath();
      ctx.moveTo(-width / 2, -height * .23);
      ctx.bezierCurveTo(0, -height * .54, width * .32, -height * .56, width / 2, 0);
      ctx.bezierCurveTo(width * .32, height * .56, 0, height * .54, -width / 2, height * .23);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f1fcff';
      ctx.beginPath();
      ctx.ellipse(width * .08, 0, width * .32, height * .22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    if (shape === 'piercingRay' || shape === 'crescent') {
      ctx.beginPath();
      if (shape === 'piercingRay') {
        ctx.moveTo(-width / 2, 0);
        ctx.lineTo(width * .28, -height / 2);
        ctx.lineTo(width / 2, 0);
        ctx.lineTo(width * .28, height / 2);
        ctx.fill();
        ctx.fillStyle = '#fff7fb';
        ctx.fillRect(-width * .3, -1, width * .72, 2);
      } else {
        ctx.moveTo(-width / 2, -height / 2);
        ctx.quadraticCurveTo(width * 1.45, -height * .32, -width / 2, height / 2);
        ctx.quadraticCurveTo(width * .18, 0, -width / 2, -height / 2);
        ctx.fill();
        ctx.strokeStyle = '#f6e5ff';
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    ctx.beginPath();
    const outlines = {
      ice: [[-.5,0], [-.15,-.49], [.38,-.3], [.5,0], [.34,.39], [-.19,.5]],
      vial: [[-.28,-.5], [.25,-.5], [.25,-.24], [.5,.05], [.32,.5], [-.38,.5], [-.5,.02], [-.28,-.24]],
      pool: [[-.50,.22], [-.36,-.10], [-.18,.02], [-.06,-.45], [.11,.02], [.36,-.16], [.5,.29], [.28,.5], [-.33,.46]],
      embers: [[-.5,.5], [-.34,-.25], [-.16,.23], [0,-.5], [.16,.24], [.32,-.21], [.5,.5]],
      fire: [[-.5,0], [-.30,-.35], [.12,-.5], [.5,-.22], [.45,.29], [.10,.5], [-.33,.30]],
      wind: [[-.5,.42], [-.12,-.35], [.5,-.44], [.14,.1], [.39,.36], [-.09,.2]],
      pillar: [[-.5,.5], [-.38,.17], [-.22,.12], [-.16,-.4], [.08,-.5], [.24,-.06], [.38,.08], [.5,.5]],
      bloom: [[-.5,0], [-.34,-.42], [-.08,-.31], [.18,-.5], [.44,-.15], [.5,.17], [.2,.45], [-.13,.32], [-.34,.5]],
      bolt: [[-.5,-.35], [.04,-.5], [-.06,-.1], [.5,-.16], [.01,.5], [.1,.14], [-.5,.26]],
      stone: [[-.5,.5], [-.38,-.08], [-.16,-.21], [0,-.5], [.24,-.29], [.5,.5]],
      petal: [[-.5,0], [-.15,-.41], [.16,-.46], [.5,-.19], [.26,.26], [-.05,.49]],
    };
    const outline = outlines[shape];
    if (outline) {
      outline.forEach(([px, py]) => ctx.lineTo(px * width, py * height));
      ctx.closePath();
    } else {
      ctx.ellipse(0, 0, width / 2, height / 2, pierce ? -.22 : 0, 0, Math.PI * 2);
    }
    ctx.fill();
    if (!['pool', 'embers', 'pillar', 'bloom'].includes(shape) && attack.projectile.speed) {
      ctx.globalAlpha = .45;
      ctx.fillRect(-width * .7, -height * .08, width * .8, Math.max(2, height * .16));
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff2d4';
      ctx.fillRect(-width * .12, -height * .08, width * .33, Math.max(1, height * .13));
    }
    ctx.restore();
  }

  function drawCombatEffects(fighter, ground) {
    if (fighter.hp <= 0) return;
    const attack = fighter.attack;
    if (attack?.pickupWeapon === 'broom' && fighter.attackActive) {
      const progress = (attack.elapsed - attack.startup + 1) / attack.active;
      const { far } = attack.limbBoxes[0];
      ctx.save();
      ctx.translate(fighter.x + far * attack.facing * .65, ground + fighter.y);
      ctx.fillStyle = '#d9b383';
      for (let i = 0; i < 7; i++) {
        const distance = (i * 3 + 12 * progress) * attack.facing;
        ctx.globalAlpha = (1 - progress) * (.26 + (i % 3) * .1);
        ctx.beginPath();
        ctx.ellipse(distance, -4 - (i % 4) * (2 + progress * 4), 1.6 + i % 3, 1 + progress, -.25, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (fighter.characterId === 'robot' && attack?.id === 'closeSkill' && fighter.attackActive) {
      const progress = (attack.elapsed - attack.startup + 1) / attack.active;
      ctx.save();
      ctx.globalAlpha = 1 - progress * .8;
      ctx.strokeStyle = '#ffcf96';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(fighter.x + attack.facing * (40 + 66 * progress), ground + fighter.y - 57,
        5 + 12 * progress, 13 + 14 * progress, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (attack?.projectile && !attack.pickupWeapon && !fighter.disabled && attack.elapsed < attack.startup) {
      const progress = attack.elapsed / attack.startup;
      if (attack.projectile.shape === 'palmSeal') {
        ctx.save();
        const phase = hungTechniqueFrame(fighter, 'skill_2');
        const [x, y] = phase >= 0 ? hungTechniqueHand(phase) : [18 + progress * 14, -attack.projectile.yOffset];
        const scale = (fighter.sprite?.displaySize ?? 128) / 128;
        ctx.translate(fighter.x + attack.facing * x * scale, ground + fighter.y + y * scale);
        ctx.scale(attack.facing, 1);
        ctx.globalAlpha = Math.max(0, (progress - .2) * .86);
        drawPalmSeal(13 + progress * 24, 24 + progress * 22, attack.projectile.color, attack.elapsed);
        ctx.restore();
      } else if (attack.projectile.shape === 'wind' && fighter.characterId === 'mai') {
        ctx.save();
        ctx.translate(fighter.x + attack.facing * (20 + progress * 10), ground + fighter.y - attack.projectile.yOffset);
        ctx.scale(attack.facing, 1);
        ctx.rotate(1 - progress * 1.2);
        ctx.globalAlpha = progress * .66;
        drawWindBlade(14 + 32 * progress, 5 + progress * 14, attack.projectile.color);
        ctx.restore();
      } else {
        const radius = 2 + (attack.projectile.shape?.endsWith('Beam') ? 15 : 8) * progress;
        ctx.save();
        ctx.globalAlpha = .35 + progress * .55;
        ctx.shadowBlur = 12;
        ctx.shadowColor = attack.projectile.color;
        ctx.fillStyle = attack.projectile.color;
        ctx.beginPath();
        ctx.arc(fighter.x + attack.facing * fighter.width * .58, ground + fighter.y - attack.projectile.yOffset,
          radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff4db';
        ctx.beginPath();
        ctx.arc(fighter.x + attack.facing * fighter.width * .58, ground + fighter.y - attack.projectile.yOffset,
          radius * .48, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    const shield = fighter.shieldHp > 0 && images.get(gear.shield.image);
    if (shield) {
      const width = 34;
      const height = width * shield.height / shield.width;
      ctx.save();
      ctx.translate(fighter.x, ground + fighter.y);
      ctx.scale(attack?.facing ?? fighter.facing, 1);
      ctx.drawImage(shield, -44, -fighter.hurtbox.height * .68 - height / 2, width, height);
      ctx.restore();
    }
    if (attack?.visual === 'fireRush') {
      drawFireRush(fighter, ground);
      return;
    }
    if (attack?.visual === 'maiWindSlash' || (fighter.characterId === 'mai'
      && (attack?.kickStyle || ['maiAirSide', 'maiAirDrop'].includes(attack?.animation)))) {
      drawMaiWindSlash(fighter, ground);
      return;
    }
    if (!attack || attack.visual === 'overheadBlade' || attack.projectile || attack.pickupWeapon
      || (!fighter.skills[attack.id] && !attack.showArc)) return;
    const pulse = attack.pulses?.some(({from, to}) => attack.elapsed - attack.startup >= from && attack.elapsed - attack.startup < to);
    const active = fighter.attackActive && (!attack.pulses || pulse);
    const warning = attack.elapsed < attack.startup && attack.elapsed >= attack.startup - 6;
    if (!active && !warning) return;
    ctx.save();
    ctx.strokeStyle = attack.effect?.color ?? (fighter.evolving ? fighter.evolution.color : fighter.glow);
    ctx.lineWidth = active ? attack.id === 'ultimate' ? 4 : 2.5 : 1;
    ctx.globalAlpha = active ? .84 : .32;
    for (const box of fighter.attackBoxes) {
      ctx.beginPath();
      ctx.ellipse(box.x + box.width / 2, ground + box.y + box.height / 2,
        box.width / 2, box.height / 2, 0, active && !attack.radial ? -.85 : 0,
        active && !attack.radial ? 2.7 : Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWindBlade(width, height, color) {
    const gradient = ctx.createLinearGradient(-width * .56, 0, width * .46, 0);
    gradient.addColorStop(0, '#93aaff00');
    gradient.addColorStop(.57, color);
    gradient.addColorStop(1, '#ecffff');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(-width * .57, height * .43);
    ctx.bezierCurveTo(-width * .02, height * .22, width * .31, -height * .08, width * .5, -height * .5);
    ctx.bezierCurveTo(width * .45, height * .3, width * .17, height * .47, -width * .57, height * .43);
    ctx.fill();
    ctx.globalAlpha *= .63;
    ctx.beginPath();
    ctx.moveTo(-width * .52, height * .64);
    ctx.quadraticCurveTo(width * .16, height * .65, width * .41, height * .19);
    ctx.quadraticCurveTo(width * .28, height * .78, -width * .52, height * .64);
    ctx.fill();
  }

  function drawMaiWindSlash(fighter, ground) {
    const attack = fighter.attack;
    const pulse = fighter.activePulse;
    const age = attack.elapsed - attack.startup;
    const from = pulse?.from ?? 0;
    const duration = pulse ? pulse.to - from : attack.active;
    if (age < -6 || age >= attack.active + 4) return;
    const progress = Math.max(0, Math.min(1, (age - from) / duration));
    const slash = pulse ? attack.pulses.indexOf(pulse) : age >= attack.active && attack.pulses ? 2 : 0;
    const kick = pulse?.kickStyle ?? attack.kickStyle ?? attack.animation;
    const path = {
      side: [46, -67, -.12, 66, 21],
      rise: [39, -80, -1.1, 86, 37],
      low: [28, -16, .1, 53, 17],
      sweep: [43, -13, .12, 66, 19],
      maiAirSide: [46, -87, -.12, 66, 21],
      maiAirDrop: [35, -65, .38, 60, 22],
    }[kick];
    const color = fighter.evolution?.color && fighter.evolving ? fighter.evolution.color : '#9fe7ff';
    ctx.save();
    ctx.translate(fighter.x + attack.facing * (path?.[0] ?? 17 + 22 * progress),
      ground + fighter.y + (path?.[1] ?? -64));
    ctx.scale(attack.facing, 1);
    ctx.rotate((path?.[2] ?? [-.84, .55, -1.2][slash]) + progress * (path ? .23 : .64));
    ctx.globalAlpha = age < 0 ? (age + 6) / 15 : Math.max(.1, 1 - progress * .65) * (age < attack.active ? 1 : .48);
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    drawWindBlade((path?.[3] ?? (slash === 2 ? 107 : 80)) * (.7 + progress * .3),
      path?.[4] ?? (slash === 2 ? 61 : 42), color);
    ctx.restore();
  }

  function drawFireRush(fighter, ground) {
    const attack = fighter.attack;
    const age = attack.elapsed - attack.startup;
    const pulse = fighter.activePulse;
    const final = attack.pulses.at(-1);
    const finishing = age >= final.from;
    if (age < -12 || age >= final.to + 13) return;

    ctx.save();
    ctx.translate(fighter.x, ground + fighter.y);
    ctx.scale(attack.facing, 1);
    ctx.globalAlpha = finishing ? Math.max(0, 1 - (age - final.from) / 19) : Math.min(1, (age + 12) / 11);
    ctx.shadowColor = '#ff641f';
    ctx.shadowBlur = 15;
    ctx.lineCap = 'round';
    const flare = ctx.createLinearGradient(-34, 0, 104, -68);
    flare.addColorStop(0, '#f4491300');
    flare.addColorStop(.52, '#ff7e29');
    flare.addColorStop(.84, '#ffcf71');
    flare.addColorStop(1, '#fff5c9');
    ctx.strokeStyle = flare;
    ctx.lineWidth = finishing ? 10 : pulse ? 6 : 3;
    ctx.beginPath();
    if (finishing) {
      ctx.moveTo(-24, -9);
      ctx.bezierCurveTo(30, 12, 103, -38, 79, -99);
      ctx.quadraticCurveTo(69, -114, 50, -111);
    } else if (pulse?.animation === 'heavy_punch') {
      ctx.moveTo(-32, -32);
      ctx.quadraticCurveTo(24, -94, 78, -67);
    } else {
      ctx.moveTo(-38, -26);
      const [toeX, toeY] = hungKickTip('kick');
      ctx.quadraticCurveTo(25, -17, pulse ? toeX : 56, pulse ? toeY : -34);
    }
    ctx.stroke();
    if (finishing) {
      const spread = 14 + (age - final.from) * 4;
      ctx.strokeStyle = '#ffd59d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(35, -3, spread, 5 + spread * .12, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  return { drawProjectile, drawCombatEffects, drawFireGuardian };
}
