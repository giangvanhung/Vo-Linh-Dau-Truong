import { gear } from '../game/pickups.js';

export function createCombatEffects(ctx, images) {
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
    ctx.fillRect(0, -radius, width, height);
    ctx.strokeStyle = '#e3ffff';
    ctx.lineWidth = Math.max(1, radius * .18);
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      ctx.lineTo(width * i / 24, Math.sin(i * .9 - age * .8) * radius * .32);
    }
    ctx.stroke();
    ctx.fillStyle = '#b8f6ff';
    for (let i = 0; i < 10; i++) {
      const offset = ((age * 31 + i * 101) % width);
      ctx.fillRect(offset, Math.sin(i * 3.7 + age * .2) * radius * 1.25, Math.min(22, width - offset), 1.5);
    }
    ctx.shadowColor = '#27aaff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#f1ffff';
    ctx.beginPath();
    ctx.arc(0, 0, radius * .66, 0, Math.PI * 2);
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
    if (!attack || attack.projectile || attack.pickupWeapon || (!fighter.skills[attack.id] && !attack.showArc)) return;
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

  return { drawProjectile, drawCombatEffects };
}
