import { applyFighterMotion, strikePose } from './fighter-motion.js';
import { weaponMotion } from './weapon-motion.js';

// Front-hand landmarks in each 2-by-2 sheet, expressed within the visible pose.
const grips = {
  mio: [[.91, .41], [.81, .46], [.94, .32], [.51, .26]],
  rin: [[.88, .50], [.85, .40], [.97, .26], [.47, .18]],
  nami: [[.77, .30], [.95, .42], [.97, .31], [.42, .22]],
  yuna: [[.92, .37], [.93, .39], [.97, .31], [.50, .23]],
  'bang-nghi': [[.91, .36], [.87, .40], [.96, .25], [.51, .28]],
  'an-tin': [[.76, .24], [.93, .29], [.96, .25], [.43, .22]],
  'ha-mien': [[.77, .40], [.84, .42], [.95, .25], [.47, .23]],
};
const poseBounds = {
  mio: [[162, 6, 293, 597], [713, 66, 450, 533], [70, 646, 504, 584], [703, 637, 513, 596]],
  rin: [[93, 6, 344, 599], [677, 66, 471, 534], [64, 658, 488, 578], [645, 633, 570, 604]],
  nami: [[146, 9, 317, 597], [682, 63, 441, 543], [78, 640, 484, 595], [676, 633, 542, 604]],
  yuna: [[130, 4, 349, 611], [669, 68, 491, 545], [63, 637, 510, 601], [666, 631, 558, 608]],
  'bang-nghi': [[275, 10, 310, 420], [1097, 42, 420, 387], [244, 463, 425, 418], [1077, 446, 461, 435]],
  'an-tin': [[151, 11, 287, 605], [695, 64, 413, 552], [68, 663, 510, 580], [669, 638, 547, 605]],
  'ha-mien': [[160, 7, 308, 599], [695, 70, 443, 536], [82, 651, 494, 586], [682, 636, 526, 601]],
};

export function prepareDetailedFighter(image, id) {
  const bounds = poseBounds[id];
  if (!bounds || bounds.some(([x, y, w, h]) => x + w > image.width || y + h > image.height)) {
    throw new Error(`Invalid battle sprite atlas for ${id}`);
  }
  const frames = bounds.map(([left, top, width, height], i) => {
    const [u, v] = grips[id][i];
    const [center, floor] = [[.5, .993], [.53, .989], [.46, .987], [.31, .987]][i];
    return { left, top, width, height, center, floor, u, v };
  });
  return { image, frames };
}

const supportCells = {
  rin: [[0, 0, 768, 548], [768, 0, 768, 548], [0, 548, 768, 476], [768, 548, 768, 476]],
  'an-tin': [[0, 0, 627, 646], [627, 0, 627, 646], [0, 646, 500, 608], [500, 646, 754, 608]],
};

export function prepareSupportPoses(image, id) {
  const sample = document.createElement('canvas');
  const size = sample.width = sample.height = 96;
  const ctx = sample.getContext('2d', { willReadFrequently: true });
  const anchors = [[.5, .37, .31], [.45, .9, .36], [.51, .65, .43], [.5, .5, .5]];
  const frames = anchors.map(([center, u, v], i) => {
    const [x, y, cellWidth, cellHeight] = supportCells[id]?.[i]
      ?? [i % 2 * image.width / 2, Math.floor(i / 2) * image.height / 2, image.width / 2, image.height / 2];
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(image, x, y, cellWidth, cellHeight, 0, 0, size, size);
    const pixels = ctx.getImageData(0, 0, size, size).data;
    let top = size, left = size, right = 0, bottom = 0, total = 0;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (pixels[(row * size + col) * 4 + 3] < 192) continue;
        top = Math.min(top, row);
        left = Math.min(left, col);
        right = Math.max(right, col);
        bottom = Math.max(bottom, row);
        total++;
      }
    }
    if (total < 120 || total > size * size * .8 || top === 0 || bottom === size - 1) {
      throw new Error('Invalid supplemental battle pose ' + i);
    }
    const dx = cellWidth / size, dy = cellHeight / size;
    return { left: x + left * dx, top: y + top * dy, width: (right - left + 1) * dx,
      height: (bottom - top + 1) * dy, center, floor: 1, u, v };
  });
  return { image, frames };
}

export function drawDetailedFighter(ctx, sheet, fighter, name, ground, time, drawWeapon) {
  if (!sheet || fighter.activeHeroForm?.mech) return false;
  const attack = fighter.attack;
  const motion = weaponMotion(attack);
  const extension = attack ? strikePose(attack) : 0;
  const stride = Math.sin(fighter.walkDistance / 9);
  const moving = name === 'run' || name === 'dash' || name === 'crouchWalk';
  const swinging = attack && !['hit', 'knockdown', 'ko'].includes(name);
  let index = moving && Math.abs(stride) > .43 ? 1 : 0;
  if (name === 'jump' && fighter.airDirection) index = 1;
  if (swinging && (extension > .55 || motion?.amount > .55)) index = attack.id === 'kick' || attack.kickStyle ? 3 : 2;
  const support = sheet.support;
  const supported = !support ? -1
    : name === 'block' && fighter.crouching ? 0
    : name === 'ko' ? 3
    : name === 'knockdown' ? (fighter.knockdown <= 9 ? 0 : 3)
    : name === 'hit' ? 2
    : swinging && attack.projectile && attack.elapsed >= attack.startup - 3 && extension > .43 ? 1 : -1;
  const frame = supported >= 0 ? support.frames[supported] : sheet.frames[index];
  const image = supported >= 0 ? support.image : sheet.image;
  const size = (fighter.height + 5) / (supported >= 0 ? support.frames[1].height : sheet.frames[0].height);
  const width = frame.width * size, height = frame.height * size;
  const left = -width * frame.center, top = -height * frame.floor;
  const hand = [left + width * frame.u, top + height * frame.v];
  const idle = name === 'idle' ? Math.sin(time / 170) * 1.3 : 0;
  const form = fighter.activeHeroForm;
  ctx.save();
  ctx.translate(fighter.x, ground + fighter.y);
  ctx.scale(attack?.facing ?? fighter.dash?.facing ?? fighter.facing, 1);
  ctx.imageSmoothingEnabled = false;
  if (supported < 0) applyFighterMotion(ctx, fighter, name, fighter.height, name === 'crouch' ? 1 : 0, false);
  if (name === 'ko' && supported < 0) ctx.rotate(-Math.PI * .47);
  if (name === 'block') {
    const impact = Math.min(1, fighter.attackLock / .14);
    ctx.transform(1, 0, .07 * impact, 1 - .06 * impact, 0, 0);
  }
  if (name === 'crouch') ctx.scale(1, .79);
  if (moving) ctx.transform(1, 0, -.08, 1, 0, -Math.abs(stride) * 1.5);
  if (motion && swinging) {
    const brace = Math.sin(Math.PI * Math.min(1, attack.elapsed / attack.startup));
    ctx.transform(1, 0, brace * .14 - Math.max(0, extension) * .16, 1, 0, 0);
  }
  if (fighter.activeHeroForm) {
    ctx.shadowColor = form?.color ?? fighter.glow;
    ctx.shadowBlur = 9;
  }
  ctx.translate(0, idle);
  const drawBody = () => ctx.drawImage(image, frame.left, frame.top, frame.width, frame.height, left, top, width, height);
  drawBody();
  ctx.shadowBlur = 0;
  if (!['hit', 'knockdown', 'ko'].includes(name)) drawWeapon(hand, drawBody);
  if (form?.skills?.counter) {
    const [x, y] = hand;
    ctx.strokeStyle = form.color ?? fighter.glow;
    ctx.lineWidth = fighter.heroCounter ? 4 : 2;
    ctx.beginPath();
    ctx.ellipse(x + 2, y, 9, 17, -.13, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  return true;
}
