import { gear } from '../game/pickups.js';
import { strikePose } from './fighter-motion.js';

const pickupProfiles = {
  sword: { width: 78, tilt: -.35, arc: 1.18, gripX: .23, gripY: .78 },
  blaster: { width: 55, tilt: -.12, arc: -.26, gripX: .23, gripY: .73 },
  slipper: { tilt: -.88, arc: 1.17 },
  broom: { tilt: .12, arc: .55 },
  rattan: { tilt: -.89, arc: 1.24 },
  dogStaff: { tilt: -.77, arc: .72 },
};
const pickupWeapons = {};
for (const [kind, profile] of Object.entries(pickupProfiles)) {
  pickupWeapons[kind] = { ...gear[kind], ...profile, kind, pickup: true };
}

export function heldWeapon(fighter) {
  const pickup = fighter.attack?.pickupWeapon ?? (fighter.weaponUses > 0 ? fighter.pickupWeapon : null);
  return pickup ? pickupWeapons[pickup] : fighter.weapon;
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
  const handHeight = weapon.kind === 'broom' ? -21 : weapon.kind === 'blaster' ? 3 : 14;
  ctx.save();
  ctx.translate(fighter.x, ground + fighter.y);
  ctx.scale(facing, 1);
  ctx.translate(15 + extension * (weapon.reach ?? (weapon.kind === 'blaster' ? 10 : 23)),
    -grip + Math.sin(animationTime / 115) * 1.5 - extension * handHeight);
  ctx.rotate((weapon.tilt ?? -.45) + extension * (weapon.arc ?? 1.2));
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
