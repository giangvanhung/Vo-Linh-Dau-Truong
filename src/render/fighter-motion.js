import { hungKickTip } from './hung-action-poses.js';
import { KNOCKDOWN_FRAMES } from '../combat/fighter.js';

const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => value * value * (3 - 2 * value);

export function strikePose({ elapsed, startup, active, recovery }) {
  if (elapsed < startup) {
    const progress = clamp(elapsed / Math.max(1, startup));
    return ease(clamp((progress - .45) / .55)) - .22 * Math.sin(Math.PI * progress);
  }
  return 1 - ease(clamp((elapsed - startup - active) / Math.max(1, recovery)));
}

export function overheadChopPose({ elapsed, startup, active, recovery }) {
  const raisedAt = startup * .65;
  const drop = ease(clamp((elapsed - raisedAt) / (startup + 2 - raisedAt)));
  const lift = ease(clamp(elapsed / raisedAt)) * (1 - drop);
  const drive = drop * (1 - ease(clamp((elapsed - startup - active) / Math.min(recovery, 18))));
  return { lift, drive };
}

export function applyFighterMotion(ctx, fighter, name, height, crouch, still) {
  if (name === 'knockdown') {
    const fall = ease(clamp((KNOCKDOWN_FRAMES - fighter.knockdown) / 7));
    const rise = ease(clamp(fighter.knockdown / 10));
    const tilt = fall * rise;
    ctx.translate(0, -height * .14 * tilt);
    ctx.rotate(-Math.PI * .48 * tilt);
  } else if (name === 'roll') {
    const progress = clamp(fighter.dash.elapsed / fighter.dash.frames);
    const tuck = Math.sin(Math.PI * progress);
    const radius = height * .24;
    ctx.translate(0, -radius);
    ctx.rotate(ease(progress) * 2 * Math.PI);
    ctx.scale(1 - tuck * .16, 1 - tuck * (still ? .48 : .17));
    ctx.translate(0, -radius * (still ? tuck - 1 : -1));
  } else if (name === 'dash') {
    const lean = Math.sin(Math.PI * clamp(fighter.dash.elapsed / fighter.dash.frames));
    ctx.transform(1, 0, -.18 * lean, 1 - .07 * lean, 0, 0);
  } else if (name === 'jump') {
    const rise = Math.max(-1, Math.min(1, -fighter.vy / 590));
    const drift = fighter.airDirection * fighter.facing;
    ctx.transform(1 - rise * .035, 0, -.045 * rise - .09 * drift, 1 + rise * .06, 0, 0);
  } else if (name === 'block' && fighter.crouching) {
    ctx.scale(1, .69);
  } else if (name === 'crouchWalk') {
    const step = Math.sin(fighter.walkDistance * Math.PI / 15);
    ctx.transform(1, 0, -.06 * step, .72 - .035 * Math.abs(step), 0, 0);
  } else if (name === 'charge') {
    const tension = clamp(fighter.chargeFrames / 18);
    ctx.scale(1 + tension * .045, 1 - tension * .055);
  } else if (name !== 'hit' && name !== 'ko') {
    if (fighter.attack && fighter.canMoveDuringAttack) {
      const stride = fighter.moving ? Math.sin(fighter.walkDistance / 8) : 0;
      const drift = fighter.onGround ? 0 : fighter.airDirection * fighter.attack.facing;
      ctx.transform(1, 0, -.07 * drift - .025 * stride, 1 - .025 * Math.abs(stride), 0, 0);
    }
    const pickup = fighter.attack?.pickupWeapon;
    if (pickup) {
      const motion = strikePose(fighter.attack);
      const age = fighter.attack.elapsed - fighter.attack.startup;
      const recoil = pickup === 'blaster' && age >= 0 ? Math.max(0, 1 - age / 8) : 0;
      ctx.transform(1, 0, -.16 * motion + .12 * recoil, 1 - (pickup === 'broom' ? .25 : .04) * Math.max(0, motion), 0, 0);
      return;
    }
    const motion = fighter.attack ? strikePose(fighter.attack) : 0;
    const rear = fighter.attack?.limbSide === 'right';
    const twist = rear ? (still ? .22 : .11) : (still ? .15 : .045);
    ctx.transform(1 + motion * (rear ? .065 : .035), 0, -motion * twist,
      1 - crouch * (still ? .28 : .06), 0, 0);
  }
}

export function drawLowStride(ctx, image, sx, sy, sw, sh, x, y, width, height, distance) {
  const knees = Math.round(sh * .69);
  const bodyHeight = height * knees / sh;
  const legHeight = height - bodyHeight;
  const step = Math.sin(distance * Math.PI / 15);
  ctx.drawImage(image, sx, sy, sw, knees, x, y, width, bodyHeight);
  for (const side of [0, 1]) {
    const stride = side ? step : -step;
    ctx.save();
    ctx.translate(x + side * width / 2, y + bodyHeight);
    ctx.transform(1, 0, stride * .15, 1 - Math.max(0, stride) * .16, 0, 0);
    ctx.drawImage(image, sx + side * sw / 2, sy + knees, sw / 2, sh - knees, 0, 0, width / 2, legHeight);
    ctx.restore();
  }
}

export function drawStrikeTrail(ctx, fighter, ground) {
  const attack = fighter.attack;
  if (!attack || attack.projectile || attack.pickupWeapon || fighter.disabled || !fighter.attackActive) return;
  const kick = attack.id === 'kick' || (attack.hungKick && attack.hungKick !== 'airJ');
  const armedStrike = attack.swing && attack.mainWeapon !== 'gauntlet';
  const punch = !kick && !armedStrike && (attack.id === 'light' || attack.id === 'heavy');
  const slash = !punch && !kick && fighter.weapon && (armedStrike || ['closeSkill', 'ultimate'].includes(attack.id));
  if (!punch && !kick && !slash) return;
  const box = fighter.attackBoxes[0];
  if (!box) return;
  const progress = clamp((attack.elapsed - attack.startup) / Math.max(1, attack.active));
  const rear = attack.limbSide === 'right';
  const tip = attack.facing > 0 ? box.x + box.width : box.x;
  const color = fighter.evolving ? fighter.evolution.color : fighter.glow;
  ctx.save();
  if (kick && fighter.characterId === 'hung' && (fighter.onGround || attack.hungKick === 'slam')) {
    const [toeX, toeY] = hungKickTip(attack.lowStance ? 'sweep' : 'kick', attack.hungKick);
    const scale = (fighter.sprite?.displaySize ?? 128) / 128;
    ctx.translate(fighter.x + attack.facing * toeX * scale, ground + fighter.y + toeY * scale);
  } else ctx.translate(tip, ground + box.y + box.height * (attack.limbSide ? (rear ? .62 : .42) : .5));
  ctx.scale(attack.facing, 1);
  ctx.globalAlpha = .85 * (1 - progress);
  ctx.strokeStyle = color;
  ctx.lineWidth = slash ? 4 : kick || attack.id === 'heavy' ? 4.5 : 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (attack.hungKick === 'launch' || attack.hungKick === 'slam') {
    const rise = attack.hungKick === 'launch' ? 1 : -1;
    ctx.moveTo(-box.width * .64, 40 * rise);
    ctx.quadraticCurveTo(-14, 19 * rise, 3, -3 * rise);
  } else if (attack.hungKick === 'heavy' || attack.hungKick === 'low') {
    ctx.moveTo(-box.width * .57, 6);
    ctx.quadraticCurveTo(-12, 7, 3, -1);
  } else if (kick && attack.lowStance) {
    ctx.moveTo(-box.width * .8, 7);
    ctx.bezierCurveTo(-box.width * .47, 13, -box.width * .12, 9, 3, 1);
  } else if (punch && attack.lowStance) {
    ctx.moveTo(-box.width * (attack.id === 'heavy' ? .74 : .43), 5);
    ctx.quadraticCurveTo(-box.width * .23, 4, 2, -2);
  } else if (kick && attack.plantFoot) {
    ctx.moveTo(-box.width * .78, 8);
    ctx.bezierCurveTo(-box.width * .49, 12, -8, 4, 5, -4);
  } else if (kick) {
    const sweep = rear ? -1 : 1;
    ctx.moveTo(-box.width * .68, 15 * sweep);
    ctx.bezierCurveTo(-box.width * .31, 19 * sweep, box.width * .23, 5 * sweep, -2, -11 * sweep);
  } else if (attack.swing === 'thrust') {
    ctx.moveTo(-box.width * .76, 3);
    ctx.quadraticCurveTo(-box.width * .32, -4, 4, 0);
  } else if (slash) {
    const height = attack.swing === 'lift' || attack.swing === 'reverse' ? -25 : 25;
    ctx.moveTo(-box.width * .6, height);
    ctx.quadraticCurveTo(box.width * .18, 0, -box.width * .18, -height);
  } else if (rear) {
    ctx.moveTo(-box.width * .66, -9);
    ctx.quadraticCurveTo(-box.width * .24, -14, 2, 4);
  } else {
    ctx.moveTo(-box.width * .62, 6);
    ctx.quadraticCurveTo(-box.width * .22, 5, 2, -4);
  }
  ctx.stroke();
  if (attack.limbSide) {
    ctx.globalAlpha = .78 * (1 - progress);
    ctx.strokeStyle = '#fff5dc';
    ctx.lineWidth = rear ? 1.6 : 1.15;
    ctx.stroke();
  }
  ctx.restore();
}
