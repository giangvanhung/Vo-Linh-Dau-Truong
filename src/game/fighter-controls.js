import { FRAME_SECONDS } from '../combat/fighter.js';

export function applyControls(fighter, target, input, { jumpVelocity, useAttack, activateAwakening, toast }) {
  fighter.setGuard(input.guard);
  const canBuffer = !fighter.disabled && !input.guard && !input.action && !input.charge;
  if (!canBuffer) fighter.bufferedAttack = null;
  if (input.action === 'awaken' && activateAwakening(fighter)) return;
  const charge = input.charge && !input.guard && !input.jump && !input.attack && !input.action && !input.direction && !input.crouch;
  fighter.charge(charge);
  if (fighter.charging) {
    fighter.crouching = false;
    return;
  }
  if (input.jump && fighter.onGround && !fighter.disabled && !fighter.attacking && !fighter.dash && !input.guard) {
    fighter.vy = -jumpVelocity;
    fighter.onGround = false;
  }
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
    if (!useAttack(fighter, target, input.attack) && canBuffer && fighter.attack && fighter.attacks[input.attack]) {
      const { startup, active, recovery, elapsed } = fighter.attack;
      if (startup + active + recovery - elapsed <= 8) fighter.bufferedAttack = input.attack;
    }
  } else if (fighter.bufferedAttack && !fighter.attack) {
    useAttack(fighter, target, fighter.bufferedAttack);
    fighter.bufferedAttack = null;
  }
  const canMove = !fighter.disabled && !fighter.dash && !fighter.attacking && !fighter.blocking;
  fighter.crouching = canMove && input.crouch && fighter.onGround;
  if (canMove) fighter.x += input.direction * fighter.moveSpeed * (fighter.crouching ? .33 : 1) * FRAME_SECONDS;
}
