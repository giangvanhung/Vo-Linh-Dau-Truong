import { gear } from '../game/pickups.js';

export function createCombatEffects(ctx, images) {
  function drawProjectile({ x, y, facing, attack, attacker }, ground) {
    const { color, width, height, pierce, shape } = attack.projectile;
    ctx.save();
    ctx.shadowColor = ctx.fillStyle = color;
    ctx.shadowBlur = 10;
    ctx.translate(x, ground + y);
    ctx.scale(facing, 1);
    const weapon = !attack.pickupWeapon && attacker.weapon?.projectile && images.get(attacker.weapon.image);
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

  function drawPartyWeapon(kind, fighter, ground) {
    const attack = fighter.attack;
    ctx.save();
    ctx.translate(fighter.x, ground + fighter.y - fighter.height * .6);
    ctx.scale(attack?.facing ?? fighter.facing, 1);
    ctx.rotate(fighter.attackActive ? .27 : -.67);
    ctx.fillStyle = ctx.strokeStyle = gear[kind].color;
    ctx.lineCap = 'round';
    if (kind === 'slipper') {
      ctx.beginPath();
      ctx.ellipse(25, 0, 17, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#694e36';
      for (let x = 18; x <= 35; x += 5) ctx.fillRect(x, -4, 2, 7);
    } else {
      const length = kind === 'rattan' ? 75 : 55;
      ctx.lineWidth = kind === 'rattan' ? 3 : 6;
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.quadraticCurveTo(length * .7, kind === 'rattan' ? (fighter.attackActive ? -25 : 16) : 0, length, 0);
      ctx.stroke();
      if (kind === 'broom') {
        ctx.beginPath();
        ctx.moveTo(length - 12, 0);
        ctx.lineTo(length + 9, -12);
        ctx.lineTo(length + 9, 12);
        ctx.closePath();
        ctx.fill();
      }
      if (kind === 'dogStaff') {
        ctx.strokeStyle = '#355e43';
        ctx.lineWidth = 2;
        for (let x = 19; x < length; x += 10) {
          ctx.beginPath(); ctx.moveTo(x, -3); ctx.lineTo(x, 3); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function drawCombatEffects(fighter, ground) {
    if (fighter.hp <= 0) return;
    const attack = fighter.attack;
    const kind = attack?.pickupWeapon ?? (fighter.weaponUses ? fighter.pickupWeapon : '');
    const item = gear[kind];
    if (item?.swing) drawPartyWeapon(kind, fighter, ground);
    if (attack?.projectile?.shape === 'waveBeam' && attack.elapsed < attack.startup) {
      const radius = 2 + 15 * attack.elapsed / attack.startup;
      ctx.save();
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#55bfff';
      ctx.fillStyle = '#d8f8ff';
      ctx.beginPath();
      ctx.arc(fighter.x + attack.facing * fighter.width * .58, ground + fighter.y - attack.projectile.yOffset,
        radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (fighter.shieldHp > 0 || item?.image) {
      const equipment = fighter.shieldHp > 0 ? [gear.shield, item] : [item];
      ctx.save();
      ctx.translate(fighter.x, ground + fighter.y);
      ctx.scale(attack?.facing ?? fighter.facing, 1);
      for (const [index, entry] of equipment.entries()) {
        const image = images.get(entry?.image);
        if (!image) continue;
        const guard = entry === gear.shield;
        const size = guard ? 34 : fighter.attackActive && entry === gear.sword ? 83 : 56;
        const height = size * image.height / image.width;
        ctx.drawImage(image, (index || !guard ? 18 : -35) - size / 4, -fighter.hurtbox.height * .68 - height / 2, size, height);
      }
      ctx.restore();
    }
    if (!attack || attack.projectile || (!fighter.skills[attack.id] && !attack.pickupWeapon && !attack.showArc)) return;
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
