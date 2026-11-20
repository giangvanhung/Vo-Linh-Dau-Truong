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
