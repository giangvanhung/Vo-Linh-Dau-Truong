import { KNOCKDOWN_FRAMES } from '../combat/fighter.js';
import { weaponMotion } from './weapon-motion.js';
import { applyKickBalance } from './fighter-motion.js';

export const maiPosePaths = [
  '/assets/characters/mai/wind-action-poses.png',
  '/assets/characters/mai/wind-low-poses.png',
  '/assets/characters/mai/wind-run-poses.png',
  '/assets/characters/mai/wind-kick-poses.png',
];

const standingKicks = {
  side: [[250, 490], [680, 490], [1207, 490]],
  rise: [[365, 997], [680, 997], [1250, 997]],
};

function drawStandingKick(ctx, image, fighter, name) {
  const attack = fighter.attack;
  const anchors = standingKicks[attack?.kickStyle];
  if (!image || name !== 'kick' || !anchors) return false;
  const { elapsed, startup, active, recovery } = attack;
  const age = elapsed - startup - active;
  if (elapsed < startup * .2 || age >= recovery * .7) return false;
  const column = elapsed < startup ? 0 : age < 0 ? 1 : 2;
  const rising = attack.kickStyle === 'rise';
  // Pass through the bent-knee pose before returning from the high kick to guard.
  const retracting = rising && column === 2 && age < recovery * .3;
  const row = Number(rising && !retracting);
  const [x, y] = (retracting ? standingKicks.side : anchors)[column];
  const scale = (fighter.sprite.displaySize ?? 128) * .86 / 467;
  ctx.drawImage(image, column * 512, row * 512, 512, 512,
    (column * 512 - x) * scale, (row * 512 - y) * scale, 512 * scale, 512 * scale);
  return true;
}

// Crop edges, ground pivot and forward hand in image pixels.
const poses = {
  guard: [40, 0, 252, 318, 151, 309, 206, 92],
  runA: [320, 8, 564, 315, 444, 301, 536, 113],
  runB: [605, 18, 866, 319, 748, 309, 838, 125],
  jump: [945, 0, 1141, 242, 1046, 284, 1110, 94],
  low: [48, 403, 238, 647, 143, 638, 211, 507],
  lowStep: [345, 405, 582, 648, 458, 637, 523, 510],
  block: [640, 327, 858, 648, 744, 636, 794, 397],
  dash: [899, 404, 1176, 648, 1048, 630, 1004, 494],
  palm: [19, 659, 273, 978, 132, 960, 249, 739],
  punch: [321, 659, 579, 975, 428, 957, 550, 753],
  kick: [593, 649, 888, 978, 708, 961, 731, 740],
  sweep: [887, 725, 1199, 976, 1001, 941, 1054, 826],
  hit: [15, 998, 250, 1308, 143, 1289, 222, 1076],
  down: [275, 1197, 609, 1305, 440, 1284],
  windup: [609, 996, 876, 1312, 738, 1294, 799, 1136],
  cast: [893, 1010, 1199, 1308, 1027, 1286, 1173, 1102],
};

const lowPoses = {
  lowPalm: [70, 101, 470, 469, 247, 452, 413, 265],
  lowPunch: [592, 100, 1007, 469, 775, 452, 968, 263],
  lowBlock: [1115, 83, 1423, 473, 1272, 457, 1382, 220],
  fall: [27, 682, 575, 972, 281, 952],
  gather: [580, 530, 941, 972, 782, 956, 873, 738],
  slash: [1010, 566, 1496, 973, 1287, 956, 1461, 681],
};

const runPoses = [
  [68, 15, 428, 437, 238, 421, 336, 154],
  [519, 18, 804, 439, 664, 423, 773, 186],
  [950, 16, 1253, 439, 1105, 423, 1217, 163],
  [1374, 16, 1706, 439, 1533, 425, 1669, 149],
  [64, 453, 429, 882, 239, 867, 337, 604],
  [520, 459, 804, 882, 667, 867, 773, 612],
  [951, 463, 1251, 882, 1107, 867, 1221, 607],
  [1373, 453, 1714, 882, 1540, 868, 1676, 601],
];

const strikes = {
  light_punch: ['guard', 'palm', 'guard'],
  heavy_punch: ['windup', 'punch', 'guard'],
  kick: ['guard', 'kick', 'guard'],
  risingKick: ['low', 'kick', 'guard'],
  lowKick: ['low', 'kick', 'low'],
  sweep: ['low', 'sweep', 'low'],
  skill_1: ['windup', 'slash', 'guard'],
  skill_2: ['windup', 'cast', 'guard'],
  ultimate: ['windup', 'slash', 'guard'],
  maiCrosswind: ['dash', 'slash', 'guard'],
  maiFinisher: ['windup', 'cast', 'guard'],
  maiLowPalm: ['low', 'lowPalm', 'low'],
  maiLowPunch: ['low', 'lowPunch', 'low'],
};

export function maiPoseName(fighter, name, time, stride) {
  const attack = fighter.attack;
  if (name === 'ko') return time < 75 ? 'hit' : time < 170 ? 'fall' : 'down';
  if (name === 'knockdown') {
    const age = (fighter.knockdownFrames ?? KNOCKDOWN_FRAMES) - fighter.knockdown;
    return age < 4 ? 'hit' : age < 10 ? 'fall' : fighter.knockdown > 5 ? 'down' : 'low';
  }
  if (name === 'hit') return 'hit';
  if (attack?.pickupWeapon === 'blaster') {
    const { amount } = weaponMotion(attack);
    return amount >= .72 ? 'cast' : amount >= .25 ? 'windup' : 'guard';
  }
  if (attack) {
    if (attack.id === 'ultimate' && name === 'maiCrosswind') return 'punch';
    const normal = name === 'light_punch' || name === 'heavy_punch';
    const armed = normal && (attack.mainWeapon === 'blade' || attack.pickupWeapon);
    const poseSet = attack.kickStyle === 'rise' ? 'risingKick'
      : attack.kickStyle === 'low' ? 'lowKick' : armed ? (attack.projectile ? 'skill_2' : 'skill_1') : name;
    const [windup, strike, recovery] = strikes[poseSet] ?? strikes[{
      light: 'light_punch', heavy: 'heavy_punch', kick: 'kick',
    }[attack.id]] ?? strikes.skill_1;
    if (attack.elapsed < attack.startup || (attack.pulses && !fighter.activePulse && fighter.attackActive)) return windup;
    if (fighter.attackActive || attack.elapsed < attack.startup + attack.active + 3) return strike;
    return recovery;
  }
  if (name === 'run') return Math.floor(stride / 17) % 2 ? 'runA' : 'runB';
  if (name === 'crouchWalk') return Math.floor(stride / 10) % 2 ? 'lowStep' : 'low';
  if (name === 'block') return fighter.crouching ? 'lowBlock' : 'block';
  if (name === 'jump') return fighter.freeFlying && fighter.flightX && !fighter.flightY ? 'dash' : 'jump';
  if (name === 'roll') return fighter.dash.elapsed < fighter.dash.frames * .84 ? 'jump' : 'low';
  if (name === 'dash') return 'dash';
  if (name === 'crouch') return 'low';
  return name === 'charge' ? 'gather' : 'guard';
}

export function drawMaiPose(ctx, images, fighter, name, time, animationTime, stride, drawWeapon) {
  if (drawStandingKick(ctx, images[3], fighter, name)) return true;
  const pose = maiPoseName(fighter, name, time, stride);
  const base = poses[pose];
  const running = name === 'run' && images[2];
  const image = running || images[base ? 0 : 1];
  const runFrame = ((Math.floor(stride / 11) % 8) + 8) % 8;
  const frame = running ? runPoses[runFrame] : base ?? lowPoses[pose];
  if (!image || !frame) return false;
  const [left, top, right, bottom, anchorX, anchorY, handX, handY] = frame;
  const scale = (fighter.sprite.displaySize ?? 128) * .86 / (running ? 395 : base ? 298 : 407);
  const width = right - left;
  const height = bottom - top;
  const bob = pose === 'guard' || pose === 'gather' ? Math.sin(animationTime / 145) * .012 : 0;
  ctx.save();
  if (pose === 'kick' || pose === 'sweep') applyKickBalance(ctx, fighter.attack);
  if (pose === 'cast' && fighter.attack?.pickupWeapon === 'blaster') {
    const { angle } = weaponMotion(fighter.attack);
    const recoil = (-.10 - angle) / .26;
    ctx.transform(1, 0, .06 * recoil, 1, 0, 0);
  }
  if (name === 'roll' && pose === 'jump') {
    ctx.translate(0, -31);
    ctx.rotate(Math.PI * 2 * fighter.dash.elapsed / (fighter.dash.frames * .84));
    ctx.translate(0, 46);
  }
  ctx.scale(1 - bob * .4, 1 + bob);
  const drawBody = () => ctx.drawImage(image, left, top, width, height,
    (left - anchorX) * scale, (top - anchorY) * scale, width * scale, height * scale);
  drawBody();
  if (handX && !['hit', 'knockdown', 'ko'].includes(name)) {
    drawWeapon([(handX - anchorX) * scale, (handY - anchorY) * scale], drawBody);
  }
  ctx.restore();
  return true;
}
