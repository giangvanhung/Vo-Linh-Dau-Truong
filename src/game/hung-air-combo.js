export const hungFollowFrames = 18;

export function canFollowHungLaunch(fighter, target) {
  const follow = fighter.hungFollow;
  return follow?.target === target && follow.frames > 0 && fighter.attack === follow.attack
    && !fighter.disabled && !fighter.blocking && !fighter.dash && fighter.stageCondition?.kind !== 'morph'
    && fighter.onGround && !target.onGround
    && target.hp > 0 && target.hitstun > 0;
}

export function followHungLaunch(fighter, target) {
  if (!canFollowHungLaunch(fighter, target)) return false;
  fighter.hungFollow = null;
  fighter.hungAirChain = { target, steering: 15, punchStarted: false, punched: false, finished: false };
  fighter.attack = fighter.bufferedAttack = null;
  fighter.jumpBuffer = fighter.runJump = null;
  fighter.superMotionFrames = 0;
  fighter.facing = Math.sign(target.x - fighter.x) || fighter.facing;
  // A later follow needs more lift to close the height gap. Gravity stays active for both fighters.
  fighter.vy = Math.max(-790, Math.min(-320, target.vy - (fighter.y - target.y - 16) * 6));
  fighter.onGround = false;
  fighter.crouching = false;
  return true;
}

export function hungAirAttack(fighter, target, id) {
  const chain = fighter.hungAirChain;
  if (chain?.target !== target || fighter.onGround || chain.finished) return undefined;
  if (id === 'light' && !chain.punchStarted) return fighter.airComboAttacks.light;
  if (id === 'heavy' && chain.punched) return fighter.airComboAttacks.heavy;
}

export function updateHungAirCombo(fighter, target, dt) {
  if (fighter.hungFollow && (!canFollowHungLaunch(fighter, target) || --fighter.hungFollow.frames === 0)) {
    fighter.hungFollow = null;
  }
  const chain = fighter.hungAirChain;
  if (!chain) return;
  if (fighter.disabled || fighter.onGround || fighter.dash || fighter.stageCondition?.kind === 'morph'
    || chain.target !== target || target.hp <= 0) {
    fighter.hungAirChain = null;
  } else if (chain.steering > 0) {
    chain.steering--;
    if (!fighter.airDirection && !fighter.attack && !target.onGround && target.hitstun > 0) {
      const gap = (target.x - fighter.x) * fighter.facing;
      fighter.x += fighter.facing * Math.min(360 * dt, Math.max(0, gap - 36));
    }
  }
}
