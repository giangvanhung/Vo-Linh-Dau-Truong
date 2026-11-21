import { weaponMotion } from './weapon-motion.js';
import { strikePose } from './fighter-motion.js';

// Each outline uses the original artwork scaled to 96 px wide.
// The first point is the shoulder or hip and serves as the rotation pivot.
const limbs = {
  golem: { arm: [[58,28],[68,22],[95,28],[96,53],[73,57]], leg: [[55,53],[64,48],[76,59],[88,89],[60,89],[55,70]] },
  fox: { arm: [[68,41],[73,36],[84,42],[96,34],[95,54],[80,59],[71,54]], leg: [[72,65],[81,66],[88,83],[96,113],[80,113],[77,102],[65,82]] },
  goblin: { arm: [[47,35],[54,30],[64,34],[73,26],[96,7],[96,38],[70,49],[52,47]], leg: [[49,57],[60,51],[73,64],[73,90],[51,90],[53,75]] },
  elf: { arm: [[44,27],[53,18],[63,22],[96,0],[96,17],[69,32],[53,40]], leg: [[49,55],[62,56],[77,70],[94,102],[76,102],[65,81],[50,71]] },
  jackal: { arm: [[48,29],[57,25],[67,29],[95,8],[96,24],[74,40],[55,43]], leg: [[49,53],[63,55],[76,70],[89,101],[72,101],[60,78],[50,70]] },
  robot: { arm: [[55,30],[68,20],[86,19],[96,31],[92,51],[69,58],[57,46]], leg: [[55,60],[65,53],[78,64],[94,106],[65,106],[59,83],[48,72]] },
  corgi: { arm: [[57,42],[66,33],[73,13],[96,9],[96,47],[78,49],[69,59]], leg: [[61,72],[70,66],[81,70],[82,93],[58,93],[55,79]] },
  dragon: { arm: [[61,31],[72,27],[78,29],[86,15],[95,15],[95,34],[81,45],[67,45]], leg: [[60,57],[72,55],[84,66],[96,106],[73,106],[69,85],[57,71]] },
  shadow: { arm: [[63,31],[70,28],[78,33],[83,18],[96,17],[96,40],[81,49],[68,44]], leg: [[64,60],[73,57],[86,69],[94,111],[69,111],[69,87],[59,74]] },
};

// The foreground limbs from the guard stance, with the joint first and the fist or foot last.
const rearLimbs = {
  golem: { arm: [[25,18],[16,20],[1,35],[1,49],[16,58],[28,52],[29,37],[16,45]], leg: [[38,49],[28,51],[18,63],[13,79],[6,87],[27,87],[29,71],[43,57],[15,83]] },
  fox: { arm: [[54,31],[48,29],[42,46],[47,48],[58,42],[66,39],[66,31],[61,37]], leg: [[52,60],[43,62],[32,80],[23,111],[35,113],[37,102],[46,84],[58,72],[29,109]] },
  goblin: { arm: [[24,29],[12,32],[10,39],[19,46],[23,51],[33,50],[32,44],[24,43],[27,47]], leg: [[32,56],[20,59],[11,74],[1,88],[0,93],[15,93],[15,83],[26,73],[39,62],[7,89]] },
  elf: { arm: [[27,22],[20,24],[17,31],[13,43],[14,53],[22,54],[23,47],[19,45],[18,50]], leg: [[31,52],[21,56],[14,72],[10,84],[7,100],[17,101],[19,92],[26,76],[38,59],[12,95]] },
  jackal: { arm: [[31,30],[23,32],[19,38],[20,49],[25,55],[31,51],[27,45],[28,40],[26,50]], leg: [[33,57],[22,67],[14,74],[8,89],[5,101],[14,101],[15,94],[23,82],[32,74],[43,60],[10,97]] },
  robot: { arm: [[22,26],[12,27],[3,36],[3,53],[19,62],[45,60],[53,48],[49,35],[38,35],[44,46]], leg: [[37,62],[26,56],[16,65],[8,80],[0,96],[0,104],[25,104],[25,90],[36,81],[44,67],[12,98]] },
  corgi: { arm: [[21,40],[15,38],[13,46],[22,54],[33,54],[38,46],[33,41],[29,47]], leg: [[20,72],[13,77],[8,88],[8,93],[23,93],[28,85],[34,78],[16,90]] },
  dragon: { arm: [[34,29],[26,30],[21,38],[26,46],[39,43],[51,39],[52,32],[47,30],[45,36]], leg: [[32,67],[21,73],[14,82],[4,103],[6,109],[17,109],[21,97],[28,84],[39,75],[13,102]] },
  shadow: { arm: [[39,29],[29,29],[23,39],[27,47],[39,49],[50,46],[51,39],[46,38],[44,44]], leg: [[42,62],[33,65],[26,78],[18,93],[15,109],[27,111],[32,100],[39,89],[53,67],[23,104]] },
};

// These portraits already carry props. Use the clean guard cell for their opposite-side strikes.
const guardLimbs = {
  goblin: { arm: [[39,33],[33,34],[30,47],[38,53],[49,54],[49,47],[42,46],[45,50]], leg: [[43,59],[35,60],[27,74],[18,89],[31,91],[34,83],[41,72],[47,65],[24,88]] },
  elf: { arm: [[33,27],[28,30],[23,40],[28,48],[34,51],[38,46],[32,41],[33,47]], leg: [[39,54],[29,57],[22,66],[18,90],[28,92],[33,78],[42,66],[23,87]] },
  jackal: { arm: [[40,35],[37,37],[32,46],[39,49],[48,48],[49,42],[43,42],[47,45]], leg: [[42,58],[31,62],[24,77],[18,89],[28,91],[32,83],[37,73],[48,64],[24,88]] },
  corgi: { arm: [[38,45],[31,47],[28,54],[34,61],[43,62],[47,55],[43,48],[39,55]], leg: [[37,70],[28,72],[24,87],[31,91],[43,89],[45,81],[44,73],[33,87]] },
};

export function hasPaintedWeapon(id) {
  return Boolean(guardLimbs[id]);
}

function trace(ctx, points) {
  ctx.moveTo(...points[0]);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
}

const hungRearArm = [[34,39],[30,39],[27,43],[24,50],[24,55],[29,59],[45,59],[51,55],[51,50],[47,47],[39,49],[35,50]];

export function drawHungRearPunch(ctx, sheet, attack, scale, drawWeapon) {
  const extension = strikePose(attack);
  const angle = -.9 * extension;
  const stretch = 1 + 2.25 * Math.max(0, extension);
  const [px, py] = hungRearArm[0];
  const rest = Math.atan2(53 - py, 45 - px);
  const reach = Math.hypot(45 - px, 53 - py) * stretch;
  ctx.save();
  ctx.translate(-53 * scale, -116 * scale);
  ctx.scale(scale, scale);
  const drawCell = () => ctx.drawImage(sheet, 0, 0, 128, 128, 0, 0, 128, 128);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 128, 128);
  trace(ctx, hungRearArm);
  ctx.clip('evenodd');
  drawCell();
  ctx.restore();
  ctx.translate(px, py);
  ctx.rotate(rest + angle);
  ctx.scale(stretch, 1);
  ctx.rotate(-rest);
  ctx.translate(-px, -py);
  ctx.beginPath();
  trace(ctx, hungRearArm);
  ctx.clip();
  drawCell();
  ctx.restore();
  drawWeapon([
    (px - 53 + Math.cos(rest + angle) * reach) * scale,
    (py - 116 + Math.sin(rest + angle) * reach) * scale,
  ]);
}

export function drawStillAttack(ctx, image, width, height, fighter, drawWeapon, cell = 0) {
  const attack = fighter.attack;
  const motion = weaponMotion(attack);
  if (!attack || (!motion && (attack.pickupWeapon || !['light', 'heavy', 'kick'].includes(attack.id)))) return false;
  const kick = attack.id === 'kick';
  const heavy = attack.id === 'heavy';
  const rear = Boolean(motion) || attack.limbSide === 'right';
  const points = (cell ? guardLimbs : rear ? rearLimbs : limbs)[fighter.characterId]?.[kick ? 'leg' : 'arm'];
  if (!points) return false;
  const outline = rear ? points.slice(0, -1) : points;

  const extension = motion?.amount ?? strikePose(attack);
  if (Math.abs(extension) < .02) return false;

  const imageHeight = cell ? 96 : height * 96 / width;
  const drawImage = () => {
    if (cell) ctx.drawImage(image, 0, 0, cell, cell, 0, 0, 96, 96);
    else ctx.drawImage(image, 0, 0, 96, imageHeight);
  };
  const [pivotX, pivotY] = outline[0];
  ctx.save();
  ctx.translate(-width / 2, -height);
  ctx.scale(width / 96, width / 96);
  // Draw the body with the original limb removed, then draw that limb around its joint.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 96, imageHeight);
  trace(ctx, outline);
  ctx.clip('evenodd');
  drawImage();
  ctx.restore();
  ctx.translate(pivotX, pivotY);
  const [tipX, tipY] = points[points.length - 1];
  const restAngle = Math.atan2(tipY - pivotY, tipX - pivotX);
  const angle = rear ? (kick ? -.16 : heavy ? .12 : -.08) - restAngle : kick ? -.94 : heavy ? .42 : .23;
  const reach = kick ? .13 : heavy ? .48 : .32;
  const turn = motion ? (motion.kind === 'aim' ? (motion.angle - restAngle) * motion.amount : motion.angle) : angle * extension;
  const stretch = motion?.reach ?? 1 + reach * extension;
  ctx.rotate(turn);
  if (rear) ctx.rotate(restAngle);
  ctx.scale(stretch, 1);
  if (rear) ctx.rotate(-restAngle);
  ctx.translate(-pivotX, -pivotY);
  ctx.beginPath();
  trace(ctx, outline);
  ctx.clip();
  drawImage();
  ctx.restore();
  if (drawWeapon) {
    const distance = Math.hypot(tipX - pivotX, tipY - pivotY) * stretch;
    const direction = restAngle + turn;
    const hand = rear && !kick ? [
      -width / 2 + (pivotX + Math.cos(direction) * distance) * width / 96,
      -height + (pivotY + Math.sin(direction) * distance) * width / 96,
    ] : null;
    drawWeapon(hand);
  }
  return true;
}
