import { weaponMotion } from './weapon-motion.js';
import { gear } from '../game/pickups.js';
import { overheadChopPose, strikePose } from './fighter-motion.js';

const pickupProfiles = {
  sword: { width: 78, tilt: -.7, windup: -1.25, follow: .92, tip: 61, gripX: .23, gripY: .78, axis: -.85 },
  blaster: { width: 55, tilt: -.16, windup: -.15, follow: 0, tip: 40, gripX: .23, gripY: .73, axis: -.36 },
  slipper: { tilt: -.8, windup: -1.6, follow: .7, tip: 34 },
  broom: { tilt: .2, windup: .92, follow: -.24, tip: 61 },
  rattan: { tilt: -.93, windup: -1.75, follow: .36, tip: 74 },
  dogStaff: { tilt: -.77, windup: -1.02, follow: .53, tip: 52 },
  orb: { tilt: 0, windup: 0, follow: 0, tip: 0 },
  vial: { tilt: 0, windup: 0, follow: 0, tip: 0 },
  dart: { tilt: 0, windup: 0, follow: 0, tip: 0 },
};
const pickupWeapons = {};
for (const [kind, profile] of Object.entries(pickupProfiles)) {
  pickupWeapons[kind] = { ...gear[kind], ...profile, kind, pickup: true };
}
export const hungDaoPath = '/assets/effects/hung-dao.png';
const overheadBlade = { ...pickupWeapons.sword, image: hungDaoPath, width: 110, tip: 77,
  gripX: .29, gripY: .465, axis: -.086, tilt: -1.144, color: '#ffc66f' };
const imageGrips = {
  '/assets/effects/party-sword.png': [.23, .78],
  '/assets/effects/fox-spear.png': [.43, .60],
  '/assets/effects/golem-hammer.png': [.205, .78],
};

export function heldWeapon(fighter) {
  if (fighter.attack?.visual === 'overheadBlade') return overheadBlade;
  if (fighter.attack?.mainWeapon) return fighter.weapon;
  if (fighter.attack?.thrownItem && fighter.attack.elapsed >= fighter.attack.startup) return null;
  const pickup = fighter.attack?.pickupWeapon ?? (fighter.weaponUses > 0 ? fighter.pickupWeapon : null);
  return pickup ? pickupWeapons[pickup] : fighter.weapon;
}

function pickupAngle(weapon, attack, frame = attack?.elapsed ?? 0) {
  if (!attack) return weapon.tilt;
  if (weapon === overheadBlade) {
    const { lift, drive } = overheadChopPose({ ...attack, elapsed: frame });
    return -1.23 - weapon.axis - lift * 1.34 + drive * 1.93;
  }
  const extension = strikePose({ ...attack, elapsed: frame });
  const wind = Math.max(0, -extension);
  const reach = Math.max(0, extension);
  if (weapon.kind === 'blaster') {
    const motion = weaponMotion({ ...attack, elapsed: frame });
    return weapon.tilt * (1 - motion.amount) + (motion.angle - weapon.axis) * motion.amount;
  }
  if (['dogStaff', 'rattan', 'broom'].includes(weapon.kind)) {
    const motion = weaponMotion({ ...attack, elapsed: frame });
    return weapon.tilt * (1 - motion.amount) + motion.angle;
  }
  return weapon.tilt + (weapon.follow - weapon.tilt) * reach + weapon.windup * wind * 4;
}

function drawPickupEffect(ctx, weapon, attack, sizeScale) {
  if (!attack) return;
  const age = attack.elapsed - attack.startup;
  if (weapon.kind === 'blaster') {
    if (age < 0 || age >= 7) return;
    const size = 18 * (1 - age / 8);
    ctx.globalAlpha = 1 - age / 7;
    ctx.fillStyle = weapon.color;
    ctx.beginPath();
    const angle = pickupAngle(weapon, attack) + weapon.axis;
    const x = Math.cos(angle) * weapon.tip * sizeScale;
    const y = Math.sin(angle) * weapon.tip * sizeScale;
    ctx.moveTo(x - size / 2, y);
    ctx.lineTo(x + size * .35, y - size);
    ctx.lineTo(x + size * 1.7, y);
    ctx.lineTo(x + size * .35, y + size);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff7e9';
    ctx.fillRect(x, y - 2, size, 4);
    return;
  }
  if (age < -7 || age >= attack.active + 6) return;
  ctx.globalAlpha = age < 0 ? (age + 8) / 8 : 1 - age / (attack.active + 6);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let sample = 0; sample <= 8; sample++) {
    const frame = Math.max(0, Math.min(attack.startup + attack.active, attack.elapsed - 8 + sample));
    const angle = pickupAngle(weapon, attack, frame) + (weapon.axis ?? 0);
    const bend = weapon.kind === 'rattan' ? (8 - strikePose({ ...attack, elapsed: frame }) * 23) * .34 : 0;
    ctx.lineTo((Math.cos(angle) * weapon.tip - Math.sin(angle) * bend) * sizeScale,
      (Math.sin(angle) * weapon.tip + Math.cos(angle) * bend) * sizeScale);
  }
  ctx.strokeStyle = weapon.color;
  ctx.lineWidth = weapon.kind === 'sword' ? 10 : weapon.kind === 'rattan' ? 4 : 7;
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff3d9';
  ctx.stroke();
}

export function drawHeldWeapon(ctx, images, fighter, [x, y], drawHand) {
  if (fighter.hp <= 0 || fighter.dash?.roll || fighter.attack?.unarmed) return;
  const weapon = heldWeapon(fighter);
  if (!weapon) return;
  const fallback = weapon === overheadBlade && !images.get(hungDaoPath);
  const art = fallback ? pickupWeapons.sword : weapon;
  const image = art.image && images.get(art.image);
  if (!image && !weapon.swing && !weapon.kind) return;
  const attack = fighter.attack;
  const swinging = attack && (weapon.pickup ? attack.pickupWeapon === weapon.kind || weapon === overheadBlade
    : attack.mainWeapon || ['heavy', 'closeSkill', 'ultimate'].includes(attack.id));
  const extension = swinging ? strikePose(attack) : 0;
  const scale = (fighter.sprite?.displaySize ?? 128) / 128;
  ctx.save();
  ctx.translate(x, y);
  if (weapon.pickup) {
    const weaponAttack = swinging ? attack : null;
    ctx.save();
    if (!weaponAttack?.projectile || weapon.kind === 'blaster') drawPickupEffect(ctx, weapon, weaponAttack, scale);
    ctx.restore();
    const fallbackAngle = fallback ? weapon.axis - art.axis : 0;
    ctx.rotate(pickupAngle(weapon, weaponAttack) + fallbackAngle);
  } else {
    const sweep = { slash: 1.05, reverse: -1.4, thrust: .55, lift: -1.15 };
    const motion = swinging && weaponMotion(attack);
    const tilt = motion?.kind === 'thrust' ? -weapon.tilt * motion.amount
      : motion?.kind === 'cast' ? .84 * motion.amount : (motion?.angle ?? extension * (sweep[attack?.swing] ?? weapon.arc ?? .85));
    ctx.rotate((weapon.tilt ?? -.45) + tilt);
    if (motion?.kind === 'thrust' && fighter.attackActive) {
      const length = weapon.width * .6 * scale;
      ctx.strokeStyle = '#edf8fcaa';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(length * .46, -2.5);
      ctx.lineTo(length + 9, -2.5);
      ctx.stroke();
    }
  }
  ctx.scale(scale, scale);
  if (image) {
    const width = weapon.width;
    const height = width * image.height / image.width;
    const [gripX, gripY] = imageGrips[art.image] ?? [.24, .76];
    ctx.drawImage(image, -width * (art.gripX ?? gripX), -height * (art.gripY ?? gripY), width, height);
  } else {
    drawShape(ctx, weapon, extension);
  }
  ctx.restore();
  if (weapon.kind !== 'gauntlet' && drawHand) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, 4.2 * scale, 3.3 * scale, 0, 0, 2 * Math.PI);
    ctx.clip();
    drawHand();
    ctx.restore();
  }
}

export function drawItemShape(ctx, kind, color, extent = 1) {
  ctx.save();
  ctx.scale(extent, extent);
  drawShape(ctx, { kind, color }, 0);
  ctx.restore();
}

export function drawLooseWeapon(ctx, images, item, ground, time) {
  const weapon = item.weapon ?? pickupWeapons[item.kind];
  if (!weapon) return;
  const image = images.get(weapon.image);
  ctx.save();
  ctx.translate(item.x, ground + item.y - 8);
  ctx.globalAlpha = .85;
  ctx.shadowColor = weapon.color ?? '#ffc280';
  ctx.shadowBlur = 5 + (Math.sin(time / 110) + 1) * 3;
  if (image) {
    const width = Math.min(46, (weapon.width ?? 60) * .58);
    const height = width * image.height / image.width;
    ctx.rotate(.52);
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
  } else {
    ctx.scale(.63, .63);
    ctx.translate(['orb', 'vial', 'dart', 'gauntlet'].includes(weapon.kind) ? 0 : -16, 0);
    drawShape(ctx, weapon, 0);
  }
  ctx.restore();
}

function drawShape(ctx, weapon, extension) {
  const { kind, color } = weapon;
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  if (kind === 'orb') {
    const glow = ctx.createRadialGradient(-2, -3, 1, 0, 0, 13);
    glow.addColorStop(0, '#f5ffff');
    glow.addColorStop(.42, color);
    glow.addColorStop(1, '#236bac55');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b8f4ff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 5, -.48, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  if (kind === 'vial') {
    ctx.fillStyle = '#d0ab65';
    ctx.fillRect(-4, -12, 8, 6);
    ctx.beginPath();
    ctx.moveTo(-4, -6);
    ctx.lineTo(4, -6);
    ctx.lineTo(9, 1);
    ctx.quadraticCurveTo(12, 11, 0, 11);
    ctx.quadraticCurveTo(-12, 11, -9, 1);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#f2ffe0';
    ctx.stroke();
    ctx.fillStyle = '#3b684b';
    ctx.fillRect(-6, 4, 12, 4);
    return;
  }
  if (kind === 'dart') {
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(-3, -3);
      ctx.lineTo(13, 0);
      ctx.lineTo(2, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#44516c';
    ctx.fillRect(-2, -2, 4, 4);
    return;
  }
  if (kind === 'gauntlet') {
    ctx.lineWidth = 1.7;
    ctx.strokeStyle = '#ffe6a9';
    ctx.beginPath();
    ctx.moveTo(-8, -6);
    ctx.lineTo(2, -9);
    ctx.lineTo(11, -6);
    ctx.lineTo(11, 5);
    ctx.lineTo(2, 8);
    ctx.lineTo(-8, 5);
    ctx.closePath();
    ctx.fillStyle = '#493343';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(-6, -4, 3, 8);
    ctx.fillRect(1, -5, 8, 8);
    ctx.fillStyle = '#fff5d6';
    ctx.fillRect(2, -4, 6, 2);
    return;
  }
  if (kind === 'slipper') {
    ctx.beginPath();
    ctx.ellipse(17, 0, 17, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#694e36';
    for (let x = 9; x < 27; x += 5) ctx.fillRect(x, -4, 2, 7);
    return;
  }
  const handle = kind === 'pan' ? 29 : kind === 'rattan' ? 74 : kind === 'staff' || kind === 'dogStaff' ? 61 : 52;
  ctx.lineWidth = kind === 'rattan' ? 3 : 5;
  ctx.beginPath();
  ctx.moveTo(kind === 'staff' || kind === 'dogStaff' ? -26 : -5, 0);
  if (kind === 'rattan') {
    const bend = 8 - extension * 23;
    ctx.bezierCurveTo(handle * .34, bend * .55, handle * .78, -bend, handle, bend * .34);
  } else ctx.lineTo(handle, 0);
  ctx.stroke();
  if (kind === 'pan' || kind === 'staff') {
    const pan = kind === 'pan';
    ctx.lineWidth = pan ? 2 : 3;
    ctx.strokeStyle = pan ? '#848b95' : '#e3b575';
    ctx.fillStyle = pan ? '#353944' : '#a671d7';
    ctx.beginPath();
    ctx.ellipse(handle + 5, 0, pan ? 19 : 9, pan ? 12 : 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'broom') {
    ctx.beginPath();
    ctx.moveTo(handle - 12, 0);
    ctx.lineTo(handle + 9, -12);
    ctx.lineTo(handle + 9, 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#986536';
    ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(handle - 10, i * .55);
      ctx.quadraticCurveTo(handle, i * 1.45, handle + 10 + Math.abs(i) * Math.max(0, extension), i * 2.65);
      ctx.stroke();
    }
  } else if (kind === 'dogStaff') {
    ctx.strokeStyle = '#355e43';
    ctx.lineWidth = 2;
    for (let x = -18; x < handle; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, -2);
      ctx.lineTo(x, 2);
      ctx.stroke();
    }
  }
}
