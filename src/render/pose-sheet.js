import { strikePose } from './fighter-motion.js';

const basePoses = {
  idle: 0, run: 1, crouch: 2, jump: 3, light_punch: 4, heavy_punch: 5, kick: 6, roll: 7,
  block: 0, dash: 1, ko: 0, hit: 0,
};
const extraPoses = {
  charge: 0, cast: 1, slash: 2, ultimate: 3, high_jump: 4, block: 5, hit: 6, run_step: 7,
};

export function poseName(fighter, name, extras) {
  if (name === 'hit' || name === 'ko') return name;
  const attack = fighter.attack;
  if (attack) {
    const action = name === 'ultimate' ? 'ultimate'
      : attack.pickupWeapon === 'blaster' || attack.projectile || name === 'skill_2' ? 'cast'
      : attack.pickupWeapon || (fighter.weapon && name === 'skill_1') ? 'slash'
      : name === 'sweep' ? 'kick' : name;
    if (strikePose(attack) < .35) {
      if (!fighter.onGround) return 'jump';
      if (extras && ['cast', 'ultimate'].includes(action) && attack.elapsed < attack.startup) return 'charge';
      return 'idle';
    }
    return action;
  }
  if (name === 'jump' && fighter.vy < 0) return 'high_jump';
  if (name === 'roll') {
    const progress = fighter.dash.elapsed / fighter.dash.frames;
    if (progress < .12 || progress > .88) return 'crouch';
  }
  if (name === 'run' && Math.floor(Math.abs(fighter.walkDistance) / 24) % 2) return 'run_step';
  return name;
}

const fallback = { charge: 'block', high_jump: 'jump', run_step: 'run',
  cast: 'light_punch', slash: 'heavy_punch', ultimate: 'heavy_punch', skill_1: 'heavy_punch' };

export function drawPoseSheet(ctx, sheet, extras, fighter, name, height) {
  const pose = poseName(fighter, name, Boolean(extras));
  const useExtra = Boolean(extras) && extraPoses[pose] !== undefined;
  const image = useExtra ? extras : sheet;
  const index = useExtra ? extraPoses[pose] : basePoses[fallback[pose] ?? pose] ?? 0;
  const cell = image.width / 4;
  const size = height * 256 / 210;
  ctx.drawImage(image, (index % 4) * cell, Math.floor(index / 4) * cell, cell, cell,
    -size / 2, -size * 244 / 256, size, size);
}
