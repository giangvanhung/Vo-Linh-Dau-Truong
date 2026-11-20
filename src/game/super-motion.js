export const SUPER_COST = 50;
const motionFrames = 24;

export const superAttack = {
  label: 'Long Quyền Khí Pháo',
  animation: 'skill_2',
  cost: SUPER_COST,
  groundOnly: true,
  unarmed: true,
  damage: 23,
  startup: 22,
  active: 1,
  recovery: 32,
  knockback: 300,
  hitstun: 28,
  hitstop: 5,
  guardDamage: 30,
  cooldownFrames: 180,
  cancelInto: [],
  projectile: {
    shape: 'waveBeam', color: '#35b8ff', speed: 740,
    width: 220, height: 52, yOffset: 55, lifetimeFrames: 76,
    spawnOffset: 0, pierce: true,
  },
  effect: {
    color: '#7ee6ff', particles: 34, flashSeconds: .18, flashOpacity: .14,
    shakeIntensity: 22, shakeSeconds: .22,
  },
};

export function readSuperMotion(fighter, input) {
  if (!fighter.onGround || fighter.disabled || input.guard || input.action || input.charge) {
    fighter.superMotionFrames = 0;
  } else if (input.downPressed && fighter.lastControlDirection !== fighter.facing) {
    fighter.superMotionFrames = motionFrames;
  } else if (fighter.superMotionFrames > 0) {
    fighter.superMotionFrames--;
  }
  fighter.lastControlDirection = input.direction;

  if (!input.attack) return false;
  const matched = fighter.superMotionFrames > 0 &&
    input.attack === 'light' && input.direction === fighter.facing;
  fighter.superMotionFrames = 0;
  return matched;
}
