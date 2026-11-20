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

function trace(ctx, points) {
  ctx.moveTo(...points[0]);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
}

export function drawStillAttack(ctx, image, width, height, fighter) {
  const attack = fighter.attack;
  if (!attack || attack.pickupWeapon || !['light', 'heavy', 'kick'].includes(attack.id)) return false;
  const kick = attack.id === 'kick';
  const heavy = attack.id === 'heavy';
  const outline = limbs[fighter.characterId]?.[kick ? 'leg' : 'arm'];
  if (!outline) return false;

  const extension = strikePose(attack);
  if (Math.abs(extension) < .02) return false;

  const imageHeight = height * 96 / width;
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
  ctx.drawImage(image, 0, 0, 96, imageHeight);
  ctx.restore();
  ctx.translate(pivotX, pivotY);
  const angle = kick ? -1.15 : heavy ? .42 : .23;
  const reach = kick ? .13 : heavy ? .48 : .32;
  ctx.rotate(angle * extension);
  ctx.scale(1 + reach * extension, 1);
  ctx.translate(-pivotX, -pivotY);
  ctx.beginPath();
  trace(ctx, outline);
  ctx.clip();
  ctx.drawImage(image, 0, 0, 96, imageHeight);
  ctx.restore();
  return true;
}
