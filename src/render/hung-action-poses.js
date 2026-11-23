export const hungPosePaths = {
  technique: '/assets/characters/hung/guard-palm-charge.png',
  heavyWindup: '/assets/characters/hung/heavy-windup.png',
  rollRecovery: '/assets/characters/hung/roll-recovery.png',
  dodge: '/assets/characters/hung/dash-roll-preview.png',
  airborne: '/assets/characters/hung/airborne-poses.png',
  landing: '/assets/characters/hung/landing-preview.png',
  turn: '/assets/characters/hung/turn-poses.png',
  fall: '/assets/characters/hung/knockdown-poses.png',
  crouch: '/assets/characters/hung/crouch-poses.png',
  crouchWalk: '/assets/characters/hung/crouch-walk-poses.png',
  walk: '/assets/characters/hung/walk-poses.png',
  kick: '/assets/characters/hung/kick-poses.png',
  comboKick: '/assets/characters/hung/air-kick-combo-poses.png',
};

// Atlas rectangles, floor pivots, and fist/chest landmarks in source pixels.
const turns = [
  { rect: [0, 0, 512, 512], pivot: [248, 466], rear: [225, 198], front: [326, 161], chest: [246, 193] },
  { rect: [512, 0, 512, 512], pivot: [765, 466], rear: [738, 225], front: [937, 154], chest: [766, 188] },
  { rect: [1024, 0, 512, 512], pivot: [1270, 466], rear: [1433, 172], front: [1214, 210], chest: [1267, 196] },
  { rect: [0, 512, 512, 512], pivot: [164, 970], rear: [124, 780], front: [333, 667], chest: [223, 716] },
  { rect: [512, 512, 512, 512], pivot: [653, 970], rear: [577, 769], front: [766, 650], chest: [682, 672] },
  { rect: [1024, 512, 512, 512], pivot: [1193, 970], rear: [1063, 895], front: [1290, 742], chest: [1203, 783] },
];
const falls = [
  { rect: [0, 0, 340, 363], pivot: [160, 350] },
  { rect: [350, 0, 340, 363], pivot: [495, 347] },
  { rect: [705, 0, 370, 363], pivot: [886, 351] },
  { rect: [1090, 0, 388, 363], pivot: [1283, 351] },
  { rect: [1510, 0, 310, 363], pivot: [1668, 351] },
  { rect: [1870, 0, 300, 363], pivot: [2006, 351] },
];
const crouches = [
  { rect: [0, 0, 512, 512], pivot: [260, 464], rear: [263, 232], front: [327, 209], chest: [268, 211] },
  { rect: [512, 0, 512, 512], pivot: [767, 464], rear: [759, 318], front: [825, 275], chest: [772, 291] },
  { rect: [1024, 0, 512, 512], pivot: [1233, 464], rear: [1234, 319], front: [1400, 267], chest: [1250, 283] },
  { rect: [0, 512, 512, 512], pivot: [244, 950], rear: [427, 734], front: [219, 791], chest: [249, 767] },
  { rect: [512, 512, 512, 512], pivot: [701, 951], rear: [689, 802], front: [812, 782], chest: [708, 787] },
  { rect: [1024, 512, 512, 512], pivot: [1231, 949], rear: [1250, 797], front: [1375, 929], chest: [1275, 797] },
];
const crouchSteps = [
  { rect: [0, 0, 512, 512], pivot: [285, 453], rear: [287, 264], front: [370, 226], chest: [300, 227] },
  { rect: [512, 0, 512, 512], pivot: [766, 452], rear: [765, 277], front: [850, 243], chest: [777, 250] },
  { rect: [1024, 0, 512, 512], pivot: [1248, 452], rear: [1247, 283], front: [1324, 244], chest: [1260, 248] },
  { rect: [0, 512, 512, 512], pivot: [267, 952], rear: [274, 766], front: [349, 732], chest: [282, 741] },
  { rect: [512, 512, 512, 512], pivot: [747, 952], rear: [756, 765], front: [821, 736], chest: [767, 746] },
  { rect: [1024, 512, 512, 512], pivot: [1236, 952], rear: [1253, 765], front: [1330, 735], chest: [1263, 744] },
];
const standingSteps = [
  { rect: [0, 0, 512, 512], pivot: [286, 471], rear: [211, 273], front: [371, 239], chest: [291, 166] },
  { rect: [512, 0, 512, 512], pivot: [770, 471], rear: [731, 285], front: [841, 259], chest: [775, 172] },
  { rect: [1024, 0, 512, 512], pivot: [1252, 471], rear: [1234, 281], front: [1345, 241], chest: [1275, 170] },
  { rect: [0, 512, 512, 512], pivot: [278, 985], rear: [199, 782], front: [352, 750], chest: [290, 677] },
  { rect: [512, 512, 512, 512], pivot: [762, 985], rear: [696, 791], front: [834, 760], chest: [774, 684] },
  { rect: [1024, 512, 512, 512], pivot: [1244, 985], rear: [1189, 787], front: [1323, 751], chest: [1263, 685] },
];
const kicks = [
  { rect: [0, 0, 512, 512], pivot: [188, 486], rear: [148, 233], front: [294, 147], chest: [192, 171] },
  { rect: [512, 0, 512, 512], pivot: [678, 486], rear: [583, 267], front: [779, 140], chest: [718, 172] },
  { rect: [1024, 0, 512, 512], pivot: [1190, 486], rear: [1232, 222], front: [1300, 142], chest: [1244, 169] },
  { rect: [0, 512, 512, 512], pivot: [262, 966], rear: [95, 782], front: [374, 730], chest: [276, 743] },
  { rect: [512, 512, 512, 512], pivot: [653, 966], rear: [549, 847], front: [810, 752], chest: [723, 775] },
  { rect: [1024, 512, 512, 512], pivot: [1228, 966], rear: [1101, 892], front: [1326, 744], chest: [1257, 774] },
];
const comboKicks = [
  { rect: [0, 0, 512, 1024], pivot: [145, 816], rear: [145, 483], front: [262, 366], chest: [171, 412], toe: [464, 322], ratio: .192 },
  { rect: [512, 0, 512, 1024], pivot: [639, 798], rear: [682, 571], front: [797, 504], chest: [692, 524], toe: [949, 685], ratio: .153 },
  { rect: [1024, 0, 512, 1024], pivot: [1156, 708], rear: [1054, 435], front: [1320, 425], chest: [1221, 433], toe: [1507, 737], ratio: .204 },
];
// Both boot soles share y=1311. Hips and hand points use the same sprite coordinates.
const landing = [
  { rect: [0, 0, 1076, 1462], pivot: [525, 1311], rear: [500, 583], front: [790, 449], chest: [579, 500] },
];
// Airborne pivots keep the belt and torso over the physics origin at both transitions.
const airborne = [
  { rect: [0, 0, 887, 887], pivot: [527, 819], rear: [515, 333], front: [673, 214], chest: [569, 276] },
  { rect: [887, 0, 887, 887], pivot: [1338, 818], rear: [1324, 375], front: [1478, 279], chest: [1369, 310] },
];
const dodges = [
  { rect: [0, 0, 1085, 725], pivot: [691, 689], rear: [785, 321], front: [1012, 233], chest: [855, 283] },
  { rect: [1085, 0, 1085, 725], pivot: [1700, 385], rear: [1780, 429], front: [1825, 362], chest: [1605, 345] },
];
// Silhouette landmarks around the curled body, including the brim and the boots.
const rollOutline = [[1615, 175], [1756, 147], [1866, 321], [1956, 386], [1942, 460],
  [1830, 584], [1647, 599], [1536, 539], [1490, 441], [1484, 344], [1432, 238],
  [1522, 181], [1379, 309], [1395, 408]];
const rollRecovery = [
  { rect: [0, 0, 1536, 1024], pivot: [810, 925], rear: [864, 529], front: [1096, 449], chest: [934, 467] },
];
const heavyWindup = [
  { rect: [0, 0, 1199, 1312], pivot: [633, 1216], rear: [435, 568], front: [803, 378], chest: [601, 465] },
];
const techniques = [
  { rect: [0, 0, 724, 724], pivot: [355, 667], rear: [371, 397], front: [467, 272], chest: [382, 357] },
  { rect: [724, 0, 724, 724], pivot: [1055, 667], rear: [1016, 350], front: [1347, 205], chest: [1094, 254] },
  { rect: [1448, 0, 724, 724], pivot: [1794, 667], rear: [1769, 358], front: [1875, 356], chest: [1805, 271] },
];
const techniqueScale = .159;
const atlases = { technique: techniques, heavyWindup, rollRecovery, dodge: dodges, airborne, landing, turn: turns, fall: falls, crouch: crouches, crouchWalk: crouchSteps, walk: standingSteps, kick: kicks, comboKick: comboKicks };

// Keep the collar on the sprite and mask only the trailing cloth behind the shoulder.
const scarfTails = {
  base: [
    [0, 33, 20, 47], [1, 32, 19, 49], [2, 34, 20, 48], [3, 37, 21, 46],
    [4, 37, 18, 43], [5, 30, 18, 45], [6, 32, 20, 47], [7, 28, 47, 76],
    [8, 34, 30, 54], [9, 34, 17, 45], [10, 33, 17, 48],
  ],
  turn: [
    [0, 216, 105, 220], [1, 221, 125, 223], [2, 237, 130, 239],
    [3, 181, 120, 233], [4, 105, 120, 227], [5, 144, 212, 307],
  ],
  crouch: [
    [0, 226, 145, 219], [1, 222, 222, 285], [2, 181, 219, 286],
    [3, 201, 185, 274], [4, 147, 206, 298], [5, 220, 192, 268],
  ],
};

export function maskHungScarf(image, kind) {
  const masks = scarfTails[kind];
  if (!masks) return image;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return image;
  ctx.drawImage(image, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  const cellSize = kind === 'base' ? 128 : 512;
  const columns = kind === 'base' ? 8 : 3;
  for (const [cell, neck, top, bottom] of masks) {
    const x = cell % columns * cellSize;
    const y = Math.floor(cell / columns) * cellSize;
    const taper = kind === 'base' ? 12 : 68;
    ctx.beginPath();
    ctx.moveTo(x, y + top);
    ctx.lineTo(x + neck, y + top);
    ctx.lineTo(x + neck - taper, y + (top + bottom) / 2);
    ctx.lineTo(x + neck - taper * 1.45, y + bottom);
    ctx.lineTo(x, y + bottom);
    ctx.closePath();
    ctx.fill();
  }
  return canvas;
}

export function hungTurnFrame(attack, name) {
  if (!attack || attack.pickupWeapon) return -1;
  const { elapsed, startup, active } = attack;
  const age = elapsed - startup;
  if (name === 'sweep' || (name === 'kick' && attack.id === 'kick')) {
    if (name === 'kick' && age < 0 && elapsed >= startup * .3) return 3;
    return age >= 0 && age < active + 2 ? (name === 'sweep' ? 5 : 4) : -1;
  }
  if (name !== 'light_punch' && name !== 'heavy_punch') return -1;
  if (age < 0 && elapsed >= startup * .3) return 0;
  return age >= 0 && age < active + 1 ? (attack.limbSide === 'right' ? 2 : 1) : -1;
}

export function hungFallFrame(remaining, duration) {
  const age = duration - remaining;
  if (age < 2) return 0;
  if (age < 5) return 1;
  if (age < 8) return 2;
  if (remaining > 12) return 3;
  return remaining > 6 ? 4 : 5;
}

export function hungCrouchFrame(fighter, name, transition) {
  if (name === 'crouch' && fighter.guardBreak && fighter.crouchGuardFatigue) return 1;
  const attack = fighter.attack;
  if (attack?.lowStance && (name === 'crouchPunch' || name === 'sweep')) {
    if (attack.elapsed < attack.startup) return name === 'sweep' ? 5 : 1;
    if (attack.elapsed < attack.startup + attack.active + 2) {
      return name === 'sweep' ? 4 : attack.id === 'heavy' ? 3 : 2;
    }
    return name === 'sweep' && attack.elapsed < attack.startup + attack.active + 6 ? 5 : 1;
  }
  if (fighter.crouching && (name === 'crouch' || name === 'block')) return transition < 40 ? 0 : 1;
  if (name === 'crouchWalk' && transition < 40) return 0;
  if (name === 'idle' && transition > 0) return 0;
  return -1;
}

export function hungCrouchWalkFrame(distance) {
  const phase = ((distance % 48) + 48) % 48;
  return Math.floor(phase / 8);
}

export function hungWalkFrame(distance) {
  const phase = ((distance % 102) + 102) % 102;
  return Math.floor(phase / 17);
}

export function hungKickFrame(fighter, name) {
  const attack = fighter.attack;
  if (attack?.visual === 'fireRush' && name === 'kick' && fighter.activePulse) {
    const { from, to } = fighter.activePulse;
    const age = attack.elapsed - attack.startup;
    return age === from ? 0 : age >= to - 2 ? 2 : 1;
  }
  if (!fighter.onGround || !attack || (attack.id !== 'kick' && attack.hungKick !== 'heavy')
    || attack.pickupWeapon || (name !== 'kick' && name !== 'sweep')) return -1;
  const { elapsed, startup, active, recovery } = attack;
  const base = name === 'sweep' ? 3 : 0;
  if (elapsed < startup) return elapsed >= startup * .25 ? base : -1;
  if (elapsed < startup + active) return base + 1;
  if (elapsed < startup + active + Math.ceil(recovery * .40)) return base + 2;
  return -1;
}

const comboKickFrames = { launch: 0, low: 1, slam: 2 };

export function hungComboKickPose(fighter) {
  const attack = fighter.attack;
  const index = comboKickFrames[attack?.hungKick];
  if (index === undefined) return null;
  const age = attack.elapsed - attack.startup;
  if (age >= 0 && age < attack.active && (index !== 2 || !fighter.onGround)) return ['comboKick', index];
  if (index === 2) return fighter.onGround ? ['landing', 0] : ['airborne', 1];
  if (index === 1) return ['crouch', 1];
  if (age < 0) return ['kick', 0];
  return age < attack.active + 10 ? ['kick', 2] : ['landing', 0];
}
export function hungAirborneFrame(fighter) {
  // Leave a longer extension on a running takeoff. Both variants retain the original apex.
  if (fighter.vy < (fighter.runJump ? -210 : -335)) return 0;
  if (fighter.vy > 120) return 1;
  return -1;
}

export function hungDodgeFrame(dash) {
  const progress = dash.elapsed / dash.frames;
  if (dash.roll) return progress >= 1 / 6 && progress < 5 / 6 ? 1 : -1;
  return progress >= .1 && progress < .72 ? 0 : -1;
}

export function applyHungRollPose(ctx, dash, scale) {
  const progress = (dash.elapsed / dash.frames - 1 / 6) * 1.5;
  const angle = (progress - .42) * Math.PI * 1.5;
  const [px, py] = dodges[1].pivot;
  const sine = Math.sin(angle), cosine = Math.cos(angle);
  const contact = Math.max(...rollOutline.map(([x, y]) => (x - px) * sine + (y - py) * cosine));
  ctx.translate(0, -contact * .134 * scale);
  ctx.rotate(angle);
}

export function hungTechniqueFrame(fighter, name) {
  if (!fighter.onGround) return -1;
  if (name === 'block' && fighter.crouching) return 0;
  if (name === 'charge') return 2;
  const attack = fighter.attack;
  if (attack?.visual !== 'palmSeal') return -1;
  if (attack.elapsed < attack.startup - 4) return 2;
  return attack.elapsed < attack.startup + 9 ? 1 : -1;
}

export function hungTechniqueHand(index) {
  const { pivot: [x, y], front, rear } = techniques[index];
  const [u, v] = index === 1 ? front : [(front[0] + rear[0]) / 2, (front[1] + rear[1]) / 2];
  return [(u - x) * techniqueScale, (v - y) * techniqueScale];
}

export function hungKickTip(name, move) {
  const frame = comboKicks[comboKickFrames[move]];
  if (frame) return frame.toe.map((value, index) => (value - frame.pivot[index]) * frame.ratio);
  const [x, y] = kicks[name === 'sweep' ? 4 : 1].pivot;
  const [toe, height] = name === 'sweep' ? [981, 917] : [976, 204];
  return [(toe - x) * .235, (height - y) * .235];
}

export function drawHungPose(ctx, image, kind, index, scale) {
  const frame = atlases[kind][index];
  if (!image || !frame) return null;
  const [x, y, width, height] = frame.rect;
  const [px, py] = frame.pivot;
  const ratio = frame.ratio ?? ({ technique: techniqueScale, heavyWindup: .089, rollRecovery: .093, dodge: .134, airborne: .124, landing: .078, fall: .365, crouchWalk: .224, walk: .246, kick: .235 }[kind] ?? .257);
  const size = scale * ratio;
  const lying = kind === 'fall' && (index === 2 || index === 3);
  const heightScale = size * (lying ? .88 : 1);
  ctx.drawImage(image, x, y, width, height, (x - px) * size,
    (y - py) * heightScale + (lying ? 2 * scale : 0), width * size, height * heightScale);
  if (!frame.front) return {};
  const local = ([u, v]) => [(u - px) * ratio, (v - py) * ratio];
  return { front: local(frame.front), rear: local(frame.rear), chest: local(frame.chest) };
}
