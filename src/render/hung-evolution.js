import { strikePose } from './fighter-motion.js';
import { hungTechniqueHand } from './hung-action-poses.js';

export const hungEffectsPath = '/assets/effects/hung-evolution-v2.png';
export const hungChargePath = '/assets/effects/hung-charge-layers.png';
const chargeTiles = [[0, 190, 627, 327], [627, 0, 627, 607], [0, 625, 627, 629], [627, 863, 627, 335]];

export function drawHungChargeLayers(ctx, image, fighter, ground, time, foreground) {
  if (!image || !fighter.charging || fighter.hp <= 0) return false;
  const intensity = Math.min(1, fighter.chargeFrames / 55);
  const h = fighter.height;
  const draw = (cell, width, height, y, opacity) => {
    ctx.globalAlpha = opacity;
    ctx.drawImage(image, ...chargeTiles[cell], -width / 2, y, width, height);
  };
  ctx.save();
  ctx.translate(fighter.x, ground + fighter.y);
  ctx.globalCompositeOperation = 'screen';
  if (foreground) {
    const pulse = (time / 560) % 1;
    draw(3, h * (.8 + pulse * .42), h * .32, -h * .19, intensity * (1 - pulse) * .64);
    const [handX, handY] = hungTechniqueHand(2);
    const scale = (fighter.sprite?.displaySize ?? 128) / 128;
    const x = handX * fighter.facing * scale, y = handY * scale;
    const radius = (5 + intensity * 9) * scale;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, '#fff5cf');
    glow.addColorStop(.38, '#ffc26c');
    glow.addColorStop(1, '#ff8e3100');
    ctx.globalAlpha = intensity * (.63 + .16 * Math.sin(time / 80));
    ctx.fillStyle = glow;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.fillStyle = '#ffd898';
    for (let i = 0; i < 9; i++) {
      const rise = (time / (570 + i * 30) + i * .213) % 1;
      const x = (i % 2 ? 1 : -1) * (h * (.18 + i % 3 * .095) + Math.sin(rise * 5 + i) * 7);
      ctx.globalAlpha = intensity * (1 - rise) * .58;
      ctx.fillRect(x, -rise * h * .98, 1.5, 2);
    }
  } else {
    const swell = Math.sin(time / 185);
    draw(0, h * (1.17 + swell * .06), h * .38, -h * .23, .26 + intensity * .59);
    draw(2, h * (1.52 + swell * .04), h * 1.16, -h * 1.19, Math.max(0, intensity - .17) * .64);
    draw(1, h * (1.12 - swell * .04), h * 1.16, -h * 1.2, Math.max(0, intensity - .37) * 1.12);
  }
  ctx.restore();
  return true;
}
const atlasTiles = {
  armor: [160, 74, 315, 508],
  fire: [735, 8, 405, 589],
  aura: [0, 623, 619, 622],
  scarf: [624, 846, 620, 207],
};

export function drawHungAura(ctx, image, fighter, ground, time) {
  if (!image || fighter.hp <= 0 || (!fighter.evolving && !fighter.charging)) return false;
  const build = fighter.evolving ? 1 : Math.min(1, fighter.chargeFrames / 24);
  const pulse = Math.sin(time / 133);
  const width = fighter.height * (1.4 + .14 * build + pulse * .07);
  const height = fighter.height * (1.19 + .12 * build - pulse * .05);
  ctx.save();
  ctx.translate(fighter.x, ground + fighter.y);
  ctx.scale(fighter.attack?.facing ?? fighter.dash?.facing ?? fighter.facing, 1);
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = (.23 + .37 * build + .07 * pulse) * (fighter.charging ? 1 : .79);
  ctx.drawImage(image, ...atlasTiles.aura, -width / 2, -height - 10, width, height);
  ctx.restore();
  return true;
}

function drawScarf(ctx, image, fighter, x, y, scale, time) {
  const [sx, sy, sw, sh] = atlasTiles.scarf;
  const motion = fighter.dash ? 1 : fighter.moving ? .7 : !fighter.onGround ? .5 : .12;
  const length = 33 + motion * 22;
  const height = 17;
  const segments = 12;
  for (let i = 0; i < segments; i++) {
    const tail = Math.max(0, 1 - (i + .5) / (segments * .87));
    const wave = Math.sin(time / (112 - motion * 45) + tail * 7) * tail * (2.5 + motion * 6);
    const drape = tail * (6 - motion * 13);
    ctx.drawImage(image, sx + sw * i / segments, sy, sw / segments, sh,
      x + length * (i / segments - .87) * scale, y + (wave + drape - height * .24) * scale,
      (length / segments + .35) * scale, height * scale);
  }
}

// Rear fist and chest anchors for the 128 px cells in Hùng's atlas.
const poses = [
  [[45, 53], [52, 48]], [[38, 55], [52, 43]], [[37, 61], [53, 47]],
  [[54, 44], [55, 47]], [[46, 46], [54, 43]], [[35, 48], [45, 43]],
  [[45, 53], [52, 48]], [[31, 87], [49, 75]], [[45, 61], [53, 56]],
  [[39, 61], [51, 49]], [[44, 56], [55, 52]], [[35, 110], [40, 104]],
  [[44, 108], [48, 103]],
];

function drawLamellarArmor(ctx, x, y, scale, color, advanced) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate(-.16);
  ctx.lineWidth = 1;
  for (let row = 0; row < 3; row++) {
    const half = 9 - row * 1.5;
    const top = row * 4 - 7;
    ctx.fillStyle = row % 2 ? '#723823dd' : '#4c2923dd';
    ctx.strokeStyle = row === 0 && advanced ? '#fff3b8' : color;
    ctx.beginPath();
    ctx.moveTo(-half, top);
    ctx.lineTo(half, top - 1);
    ctx.lineTo(half - 2, top + 4);
    ctx.lineTo(0, top + 6);
    ctx.lineTo(-half + 1, top + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawFistFire(ctx, x, y, scale, time, reach, advanced) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const sweep = reach * 22;
  const flicker = Math.sin(time / 32) * 3;
  const orange = advanced ? '#ffaf36' : '#ff7a26';
  const fire = ctx.createLinearGradient(0, 8, -sweep, -16);
  fire.addColorStop(0, '#fff3ac');
  fire.addColorStop(.45, orange);
  fire.addColorStop(1, '#e8351370');
  ctx.shadowColor = orange;
  ctx.shadowBlur = 7;
  ctx.fillStyle = fire;
  ctx.beginPath();
  ctx.moveTo(7, 3);
  ctx.quadraticCurveTo(11, -4, 4 - sweep * .3, -13 + flicker);
  ctx.lineTo(1 - sweep * .4, -6);
  ctx.quadraticCurveTo(-4 - sweep, -10, -9 - sweep, -17 - flicker);
  ctx.quadraticCurveTo(-11 - sweep, -5, -7 - sweep * .4, 2);
  ctx.quadraticCurveTo(-1, 10, 7, 3);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff6cb';
  ctx.beginPath();
  ctx.moveTo(4, 3);
  ctx.quadraticCurveTo(5, -2, -3 - sweep * .55, -6);
  ctx.quadraticCurveTo(-1 - sweep * .4, 1, -4, 4);
  ctx.quadraticCurveTo(0, 7, 4, 3);
  ctx.fill();
  ctx.fillStyle = '#ffcb71';
  for (let i = 0; i < 4; i++) {
    const age = (time / 175 + i / 4) % 1;
    ctx.globalAlpha = 1 - age;
    ctx.fillRect((i - 1.5) * 4 - sweep * age, -7 - age * 16, 1.5, 2);
  }
  ctx.restore();
}

export function drawHungEvolution(ctx, image, fighter, time, cell, left, top, scale, grip, alternateFist, pose = poses[cell], paintedScarf = false) {
  if (fighter.hp <= 0 || !pose) return;
  const [[rearX, rearY], [chestX, chestY]] = pose;
  if (image && !fighter.dash?.roll && !paintedScarf) {
    drawScarf(ctx, image, fighter, left + (chestX - 5) * scale, top + (chestY - 13) * scale, scale, time);
  }
  if (!fighter.evolving) return;
  const advanced = fighter.awakeningLevel === 2;
  const color = advanced ? '#ffe191' : '#d79a54';
  const attack = fighter.attack;
  const punching = attack?.evolvedPunch && !fighter.disabled;
  const reach = punching ? Math.max(0, strikePose(attack)) : 0;
  if (image) {
    ctx.drawImage(image, ...atlasTiles.armor, left + (chestX - 12) * scale, top + (chestY - 13) * scale, 24 * scale, 30 * scale);
  } else drawLamellarArmor(ctx, left + chestX * scale, top + chestY * scale, scale, color, advanced);
  const rear = alternateFist ?? [left + rearX * scale, top + rearY * scale];
  const front = grip ?? [left + 69 * scale, top + 111 * scale];
  const rearStrike = punching && attack.limbSide === 'right';
  drawHandFire(rear, time + 79, rearStrike ? reach : 0);
  drawHandFire(front, time, rearStrike ? 0 : reach);

  function drawHandFire([x, y], phase, drive) {
    if (!image) {
      drawFistFire(ctx, x, y, scale, phase, drive, advanced);
      return;
    }
    const width = (19 + drive * 14) * scale;
    const height = (23 + Math.sin(phase / 63) * 3 + (advanced ? 3 : 0)) * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-drive * .83 + Math.sin(phase / 91) * .13);
    ctx.globalAlpha *= .89 + .11 * Math.sin(phase / 47);
    ctx.drawImage(image, ...atlasTiles.fire, -width * .5, -height * .85, width, height);
    ctx.restore();
  }
}
