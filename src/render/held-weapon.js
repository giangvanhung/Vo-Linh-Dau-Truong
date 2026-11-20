import { gear } from '../game/pickups.js';
import { strikePose } from './fighter-motion.js';

const pickupProfiles = {
  sword: { width: 78, tilt: -.7, windup: -1.25, follow: .92, tip: 61, gripX: .23, gripY: .78 },
  blaster: { width: 55, tilt: -.16, windup: -.15, follow: 0, tip: 40, gripX: .23, gripY: .73 },
  slipper: { tilt: -.8, windup: -1.6, follow: .7, tip: 34 },
  broom: { tilt: .2, windup: .92, follow: -.24, tip: 61 },
  rattan: { tilt: -.93, windup: -1.75, follow: .36, tip: 74 },
  dogStaff: { tilt: -.77, windup: -1.02, follow: .53, tip: 52 },
};
const pickupWeapons = {};
for (const [kind, profile] of Object.entries(pickupProfiles)) {
  pickupWeapons[kind] = { ...gear[kind], ...profile, kind, pickup: true };
}

export function heldWeapon(fighter) {
  const pickup = fighter.attack?.pickupWeapon ?? (fighter.weaponUses > 0 ? fighter.pickupWeapon : null);
  return pickup ? pickupWeapons[pickup] : fighter.weapon;
}

function pickupPose(fighter, weapon, attack, time, frame = attack?.elapsed ?? 0) {
  const grip = fighter.hurtbox.height * .65;
  const stride = fighter.moving && !attack ? Math.sin(fighter.walkDistance / 9) : 0;
  const readyY = -grip + stride * 4 + Math.sin(time / 140) * 1.4;
  if (!attack) return { x: 15 + stride * 5, y: readyY, angle: weapon.tilt + stride * .16 };
  const extension = strikePose({ ...attack, elapsed: frame });
  const wind = Math.max(0, -extension);
  const reach = Math.max(0, extension);
  if (weapon.kind === 'blaster') {
    const recoil = frame < attack.startup ? 0 : Math.max(0, 1 - (frame - attack.startup) / 8);
    return { x: 15 + 15 * reach - 8 * recoil,
      y: readyY + (-attack.projectile.yOffset - readyY) * reach,
      angle: weapon.tilt * (1 - reach) - .25 * recoil };
  }
  const low = weapon.kind === 'broom';
  return { x: 15 + 23 * reach - 38 * wind,
    y: readyY + (low ? 26 : -11) * reach - 30 * wind,
    angle: weapon.tilt + (weapon.follow - weapon.tilt) * reach + weapon.windup * wind * 4 };
}

function drawPickupEffect(ctx, fighter, weapon, attack, animationTime, pose) {
  if (!attack) return;
  const age = attack.elapsed - attack.startup;
  if (weapon.kind === 'blaster') {
    if (age < 0 || age >= 7) return;
    const size = 18 * (1 - age / 8);
    ctx.globalAlpha = 1 - age / 7;
    ctx.fillStyle = weapon.color;
    ctx.beginPath();
    const x = pose.x + weapon.tip;
    const y = -attack.projectile.yOffset;
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
    const { x, y, angle } = pickupPose(fighter, weapon, attack, animationTime, frame);
    ctx.lineTo(x + Math.cos(angle) * weapon.tip, y + Math.sin(angle) * weapon.tip);
  }
  ctx.strokeStyle = weapon.color;
  ctx.lineWidth = weapon.kind === 'sword' ? 10 : weapon.kind === 'rattan' ? 4 : 7;
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff3d9';
  ctx.stroke();
}

export function drawHeldWeapon(ctx, images, fighter, ground, animationTime) {
  if (fighter.hp <= 0 || fighter.dash?.roll || fighter.attack?.unarmed) return;
  const weapon = heldWeapon(fighter);
  if (!weapon) return;
  const image = images.get(weapon.image);
  if (!image && !weapon.swing && !weapon.kind) return;
  const attack = fighter.attack;
  const swinging = attack && (weapon.pickup ? attack.pickupWeapon === weapon.kind
    : ['heavy', 'closeSkill', 'ultimate'].includes(attack.id));
  const extension = swinging ? strikePose(attack) : 0;
  const facing = attack?.facing ?? fighter.dash?.facing ?? fighter.facing;
  const grip = fighter.hurtbox.height * .65;
  ctx.save();
  ctx.translate(fighter.x, ground + fighter.y);
  ctx.scale(facing, 1);
  if (weapon.pickup) {
    const weaponAttack = swinging ? attack : null;
    const pose = pickupPose(fighter, weapon, weaponAttack, animationTime);
    ctx.save();
    drawPickupEffect(ctx, fighter, weapon, weaponAttack, animationTime, pose);
    ctx.restore();
    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.angle);
  } else {
    ctx.translate(15 + extension * (weapon.reach ?? 23),
      -grip + Math.sin(animationTime / 115) * 1.5 - extension * 14);
    ctx.rotate((weapon.tilt ?? -.45) + extension * (weapon.arc ?? 1.2));
  }
  if (image) {
    const width = weapon.width;
    const height = width * image.height / image.width;
    ctx.drawImage(image, -width * (weapon.gripX ?? .24), -height * (weapon.gripY ?? .76), width, height);
  } else {
    drawShape(ctx, weapon, extension);
  }
  ctx.restore();
}

function drawShape(ctx, weapon, extension) {
  const { kind, color } = weapon;
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  if (kind === 'slipper') {
    ctx.beginPath();
    ctx.ellipse(17, 0, 17, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#694e36';
    for (let x = 9; x < 27; x += 5) ctx.fillRect(x, -4, 2, 7);
    return;
  }
  const handle = kind === 'pan' ? 29 : kind === 'rattan' ? 74 : kind === 'staff' ? 61 : 52;
  ctx.lineWidth = kind === 'rattan' ? 3 : 5;
  ctx.beginPath();
  ctx.moveTo(kind === 'staff' || kind === 'dogStaff' ? -26 : -5, 0);
  ctx.quadraticCurveTo(handle * .65, kind === 'rattan' ? 16 - extension * 39 : 0, handle, 0);
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
