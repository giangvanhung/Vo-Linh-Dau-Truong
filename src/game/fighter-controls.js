import { FRAME_SECONDS } from '../combat/fighter.js';
import { readSuperMotion, superAttackFor } from './super-motion.js';
import { followHungLaunch } from './hung-air-combo.js';

export function applyControls(fighter, target, input, { jumpVelocity, world, useAttack, activateAwakening, dropWeapon, toast }) {
  if (input.direction && !input.guard && !fighter.disabled && !fighter.attacking && !fighter.dash) {
    fighter.facing = input.direction;
  }
  fighter.setGuard(input.guard);
  const freshFollow = input.attackSequence?.length
    ? input.attackSequence.some(press => press.id === 'kick' && !press.crouch)
    : input.attack === 'kick' && !input.crouch;
  if (freshFollow && !input.guard && !input.action && !input.charge && followHungLaunch(fighter, target)) return;
  const canBuffer = !fighter.disabled && !input.guard && !input.action && !input.charge;
  if (!canBuffer) fighter.bufferedAttack = null;
  const superMotion = readSuperMotion(fighter, input);
  const runDrift = fighter.runJump ? fighter.runJump.direction * Math.max(0, 1 - fighter.runJump.frames / 10) : 0;
  fighter.airDirection = !fighter.onGround && !fighter.disabled ? input.direction || runDrift : 0;
  if (input.action === 'awaken' && activateAwakening(fighter)) return;
  if (input.action === 'dropWeapon' && dropWeapon(fighter)) return;
  const charge = input.charge && !input.guard && !input.jump && !input.attack && !input.action && !input.direction && !input.crouch;
  fighter.charge(charge);
  if (fighter.charging) {
    fighter.crouching = false;
    return;
  }
  if (input.jump && (!input.guard || fighter.disabled)
    && fighter.tryAwakeningAirStep(target, jumpVelocity, input.direction)) {
    toast('KHINH CÔNG');
    return;
  }
  const hasRunningJump = fighter.characterId === 'hung' || fighter.characterId === 'mai';
  if (hasRunningJump) {
    if (fighter.disabled || input.guard) fighter.jumpBuffer = null;
    else if (input.jump && (fighter.onGround || fighter.vy > 0)) fighter.jumpBuffer = { direction: input.direction, frames: 8 };
    else if (fighter.jumpBuffer && --fighter.jumpBuffer.frames <= 0) fighter.jumpBuffer = null;
  }
  const beginFlight = input.jump && fighter.flight && fighter.canFly && !fighter.freeFlying
    && fighter.stageCondition?.kind !== 'morph';
  if ((beginFlight || ((input.jump || fighter.jumpBuffer) && fighter.onGround)) && !fighter.disabled
    && fighter.canMoveDuringAttack && !fighter.dash && !input.guard) {
    const direction = input.direction || fighter.jumpBuffer?.direction || (hasRunningJump && fighter.moving ? fighter.facing : 0);
    const runningJump = hasRunningJump && direction && !fighter.crouching;
    if (runningJump) fighter.runJump = { direction, stride: fighter.walkDistance, frames: 0 };
    fighter.jumpBuffer = null;
    if (beginFlight || (fighter.canFly && !fighter.flight)) fighter.startFlight();
    else fighter.vy = -jumpVelocity * fighter.jumpMultiplier;
    fighter.airDirection = direction;
    fighter.superMotionFrames = 0;
    fighter.onGround = false;
  }
  if (fighter.freeFlying) {
    fighter.flightX = input.direction || 0;
    fighter.flightY = Number(Boolean(input.crouch)) - Number(Boolean(input.ascend || input.jump));
  } else if (input.crouch) fighter.stopFlight();
  if (input.action === 'dash' || input.action === 'enhancedDash') {
    const enhanced = input.action === 'enhancedDash';
    if (fighter.startDash(enhanced, 0, input.dashDirection || fighter.facing) && enhanced) toast('LƯỚT CƯỜNG HÓA');
  } else if (input.action === 'roll') {
    fighter.startDash(false, input.direction || -fighter.facing);
  } else if (input.action === 'escape') {
    const escaped = fighter.escapeFrom(target, world?.width);
    if (escaped) {
      toast(escaped === 'wall' ? 'BẬT TƯỜNG THOÁT GÓC!' : fighter.name.toUpperCase() + ' THOÁT COMBO!');
      return;
    }
  }
  const crouch = input.crouch && !input.jump && fighter.onGround;
  if (input.attack) {
    if (superMotion && !input.jump) {
      if (useAttack(fighter, target, 'motionSuper')) {
        fighter.bufferedAttack = null;
        return;
      }
      const superAttack = superAttackFor(fighter);
      const { required } = fighter.attackMeter('motionSuper', superAttack);
      if (!fighter.disabled && !fighter.attacking && fighter.meter < required) {
        toast(`Cần ${required} nộ để tung ${superAttack.label}`);
      }
    }
  }
  if (canBuffer && fighter.crouchAttacks && (fighter.attacks[input.attack] || fighter.bufferedAttack?.queue)) {
    const queue = fighter.bufferedAttack?.queue ?? [];
    if (input.attack && !fighter.attacks[input.attack]) {
      fighter.bufferedAttack = null;
      useAttack(fighter, target, input.attack);
    } else {
      if (input.attack) {
        const presses = input.attackSequence?.length ? input.attackSequence : [{ id: input.attack, crouch }];
        const limit = fighter.attack ? 2 : 3;
        for (const press of presses) {
          if (queue.length >= limit) break;
          if (fighter.attacks[press.id]) queue.push({ ...press, crouch: press.crouch && fighter.onGround, frames: 32 });
        }
      }
      // A second standing L after a launcher requires a fresh press during the follow window.
      while (fighter.attack?.hungKick === 'launch' && queue[0]?.id === 'kick' && !queue[0].crouch) queue.shift();
      const next = queue[0];
      if (next && (useAttack(fighter, target, next.id, next.crouch) || --next.frames <= 0 || !fighter.attack)) queue.shift();
      fighter.bufferedAttack = queue.length ? { queue } : null;
    }
  } else if (input.attack) {
    fighter.bufferedAttack = null;
    if (!useAttack(fighter, target, input.attack, crouch) && canBuffer && fighter.attack && fighter.attacks[input.attack]) {
      const { startup, active, recovery, elapsed } = fighter.attack;
      const remaining = startup + active + recovery - elapsed;
      const followupKick = input.attack === 'kick' && ['light', 'heavy', 'kick'].includes(fighter.attack.id);
      const anticipatingHit = (followupKick || fighter.attack.cancelInto.includes(input.attack)) && Math.abs(startup - elapsed) <= 8;
      if (remaining <= 8 || anticipatingHit) fighter.bufferedAttack = { id: input.attack, frames: 8 };
    }
  } else if (fighter.bufferedAttack) {
    const buffered = fighter.bufferedAttack;
    if (useAttack(fighter, target, buffered.id) || --buffered.frames <= 0) fighter.bufferedAttack = null;
  }
  const canSteer = !fighter.disabled && !fighter.dash && !fighter.blocking;
  const canMove = canSteer && fighter.canMoveDuringAttack;
  const crouchGuard = fighter.blocking;
  fighter.crouching = fighter.attacking ? Boolean(fighter.attack.lowStance) : Boolean((canMove || crouchGuard) && crouch);
  if (canMove && !fighter.freeFlying) {
    const direction = fighter.onGround ? input.direction : fighter.airDirection;
    fighter.x += direction * fighter.walkingSpeed * (fighter.crouching ? .33 : 1) * FRAME_SECONDS;
  } else if (canSteer && fighter.onGround && fighter.attack?.forwardStepFrames > fighter.attack?.elapsed
    && input.direction === fighter.attack.facing) {
    fighter.advanceTowardOpponent(target, input.direction, fighter.walkingSpeed * FRAME_SECONDS);
  }
}
