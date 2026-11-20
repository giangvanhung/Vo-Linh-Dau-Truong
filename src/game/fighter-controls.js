import { FRAME_SECONDS } from '../combat/fighter.js';
import { readSuperMotion, SUPER_COST } from './super-motion.js';

export function applyControls(fighter, target, input, { jumpVelocity, useAttack, activateAwakening, toast }) {
  if (input.direction && !input.guard && !fighter.disabled && !fighter.attacking && !fighter.dash) {
    fighter.facing = input.direction;
  }
  fighter.setGuard(input.guard);
  const canBuffer = !fighter.disabled && !input.guard && !input.action && !input.charge;
  if (!canBuffer) fighter.bufferedAttack = null;
  const superMotion = readSuperMotion(fighter, input);
  fighter.airDirection = !fighter.onGround && !fighter.disabled ? input.direction : 0;
  if (input.action === 'awaken' && activateAwakening(fighter)) return;
  const charge = input.charge && !input.guard && !input.jump && !input.attack && !input.action && !input.direction && !input.crouch;
  fighter.charge(charge);
  if (fighter.charging) {
    fighter.crouching = false;
    return;
  }
  if (input.jump && fighter.onGround && !fighter.disabled && fighter.canMoveDuringAttack && !fighter.dash && !input.guard) {
    if (fighter.canFly) fighter.startFlight();
    else fighter.vy = -jumpVelocity;
    fighter.airDirection = input.direction;
    fighter.superMotionFrames = 0;
    fighter.onGround = false;
  }
  if (input.crouch) fighter.stopFlight();
  if (input.action === 'dash' || input.action === 'enhancedDash') {
    const enhanced = input.action === 'enhancedDash';
    if (fighter.startDash(enhanced) && enhanced) toast('LƯỚT CƯỜNG HÓA');
  } else if (input.action === 'roll') {
    fighter.startDash(false, input.direction || -fighter.facing);
  } else if (input.action === 'escape' && fighter.escapeFrom(target)) {
    toast(fighter.name.toUpperCase() + ' THOÁT COMBO!');
  }
  if (input.attack) {
    fighter.bufferedAttack = null;
    if (superMotion && !input.jump) {
      if (useAttack(fighter, target, 'motionSuper')) return;
      if (!fighter.disabled && !fighter.attacking && fighter.meter < SUPER_COST) {
        toast(`Cần ${SUPER_COST} nộ để tung Long Quyền Khí Pháo`);
      }
    }
    if (!useAttack(fighter, target, input.attack) && canBuffer && fighter.attack && fighter.attacks[input.attack]) {
      const { startup, active, recovery, elapsed } = fighter.attack;
      if (startup + active + recovery - elapsed <= 8) fighter.bufferedAttack = input.attack;
    }
  } else if (fighter.bufferedAttack && !fighter.attack) {
    useAttack(fighter, target, fighter.bufferedAttack);
    fighter.bufferedAttack = null;
  }
  const canMove = !fighter.disabled && !fighter.dash && fighter.canMoveDuringAttack && !fighter.blocking;
  fighter.crouching = canMove && !fighter.attacking && input.crouch && fighter.onGround;
  if (canMove) {
    const direction = fighter.onGround ? input.direction : fighter.airDirection;
    fighter.x += direction * fighter.moveSpeed * (fighter.crouching ? .33 : 1) * FRAME_SECONDS;
  }
}
