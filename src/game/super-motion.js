export const SUPER_COST = 50;
const motionFrames = 24;

export const superAttack = {
  label: 'Long Quyền Khí Pháo',
  animation: 'skill_2',
  meterRequired: SUPER_COST,
  groundOnly: true,
  unarmed: true,
  damage: 8,
  startup: 22,
  active: 1,
  recovery: 32,
  knockback: 135,
  hitstun: 13,
  hitstop: 2,
  guardDamage: 10,
  cooldownFrames: 180,
  cancelInto: [],
  projectile: {
    shape: 'channelBeam', color: '#35b8ff', height: 52, yOffset: 55,
    meterPerFrame: 1, pulseFrames: 20,
  },
  effect: {
    color: '#7ee6ff', particles: 34, flashSeconds: .18, flashOpacity: .14,
    shakeIntensity: 22, shakeSeconds: .22,
  },
};

const fireGuardian = {
  label: 'Hỏa Pháp Tướng',
  animation: 'block',
  visual: 'fireGuardian',
  cost: SUPER_COST,
  groundOnly: true,
  unarmed: true,
  damage: 20,
  startup: 18,
  active: 4,
  recovery: 24,
  knockback: 240,
  hitstun: 24,
  hitstop: 3,
  guardDamage: 23,
  cooldownFrames: 210,
  cancelInto: [],
  limbBoxes: [{ near: 9, far: 137, top: 105, height: 68 }],
  effect: {
    color: '#ffb45f', particles: 25, flashSeconds: .13, flashOpacity: .12,
    shakeIntensity: 19, shakeSeconds: .17,
  },
};

export function superAttackFor(fighter) {
  if (fighter.characterId === 'hung') return fireGuardian;
  if (fighter.characterId === 'mai') return crosswind;
  return superAttack;
}

const crosswind = {
  label: 'Phong Ảnh Trảm',
  animation: 'maiCrosswind',
  visual: 'maiWindSlash',
  cost: SUPER_COST,
  groundOnly: true,
  unarmed: true,
  damage: 19,
  startup: 12,
  active: 10,
  recovery: 19,
  travel: { speed: 830, frames: 10, passesThrough: false },
  knockback: 205,
  hitstun: 24,
  hitstop: 4,
  guardDamage: 25,
  cooldownFrames: 210,
  cancelInto: [],
  limbBoxes: [{ near: 6, far: 58, top: 87, height: 41 }],
  effect: { color: '#a8eaff', particles: 22, trailSeconds: .25, shakeSeconds: .15, shakeIntensity: 18 },
};

export function readSuperMotion(fighter, input) {
  if (!fighter.onGround || fighter.disabled || input.guard || input.action || input.charge) {
    fighter.superMotionFrames = 0;
  } else if (input.downPressed) {
    fighter.superMotionFrames = motionFrames;
  } else if (fighter.superMotionFrames > 0) {
    fighter.superMotionFrames--;
  }
  if (!input.attack) return false;
  const matched = fighter.superMotionFrames > 0 &&
    input.attack === 'light' && input.direction === fighter.facing;
  fighter.superMotionFrames = 0;
  return matched;
}
