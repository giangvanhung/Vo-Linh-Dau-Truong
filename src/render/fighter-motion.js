const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => value * value * (3 - 2 * value);

export function strikePose({ elapsed, startup, active, recovery }) {
  if (elapsed < startup) {
    const progress = clamp(elapsed / Math.max(1, startup));
    return ease(clamp((progress - .45) / .55)) - .22 * Math.sin(Math.PI * progress);
  }
  return 1 - ease(clamp((elapsed - startup - active) / Math.max(1, recovery)));
}

export function applyFighterMotion(ctx, fighter, name, height, crouch, still) {
  if (name === 'roll') {
    const progress = clamp(fighter.dash.elapsed / fighter.dash.frames);
    const tuck = Math.sin(Math.PI * progress);
    const radius = height * .24;
    ctx.translate(0, -radius);
    ctx.rotate(ease(progress) * 2 * Math.PI);
    ctx.scale(1 - tuck * .16, 1 - tuck * (still ? .48 : .17));
    ctx.translate(0, -radius * (still ? tuck - 1 : -1));
  } else if (name === 'dash') {
    const lean = Math.sin(Math.PI * clamp(fighter.dash.elapsed / fighter.dash.frames));
    ctx.transform(1, 0, -.18 * lean, 1 - .07 * lean, 0, 0);
  } else if (name === 'jump') {
    const rise = Math.max(-1, Math.min(1, -fighter.vy / 590));
    const drift = fighter.airDirection * fighter.facing;
    ctx.transform(1 - rise * .035, 0, -.045 * rise - .09 * drift, 1 + rise * .06, 0, 0);
  } else if (name === 'charge') {
    const tension = clamp(fighter.chargeFrames / 18);
    ctx.scale(1 + tension * .045, 1 - tension * .055);
  } else if (name !== 'hit' && name !== 'ko') {
    const motion = fighter.attack ? strikePose(fighter.attack) : 0;
    ctx.transform(1 + motion * .035, 0, -motion * (still ? .15 : .045),
      1 - crouch * (still ? .28 : .06), 0, 0);
  }
}

export function drawStrikeTrail(ctx, fighter, ground) {
  const attack = fighter.attack;
  if (!attack || attack.projectile || attack.pickupWeapon || fighter.disabled || !fighter.attackActive) return;
  const kick = attack.id === 'kick';
  const punch = attack.id === 'light' || attack.id === 'heavy';
  const slash = !punch && !kick && fighter.weapon && ['closeSkill', 'ultimate'].includes(attack.id);
  if (!punch && !kick && !slash) return;
  const box = fighter.attackBoxes[0];
  if (!box) return;
  const progress = clamp((attack.elapsed - attack.startup) / Math.max(1, attack.active));
  const tip = attack.facing > 0 ? box.x + box.width : box.x;
  const color = fighter.evolving ? fighter.evolution.color : fighter.glow;
  ctx.save();
  ctx.translate(tip, ground + box.y + box.height / 2);
  ctx.scale(attack.facing, 1);
  ctx.globalAlpha = .62 * (1 - progress);
  ctx.strokeStyle = color;
  ctx.lineWidth = slash ? 4 : attack.id === 'heavy' ? 3 : 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (kick || slash) {
    const height = slash ? 25 : 11;
    ctx.moveTo(-box.width * .6, height);
    ctx.quadraticCurveTo(box.width * .18, 0, -box.width * .18, -height);
  } else {
    ctx.moveTo(-box.width * .55, 4);
    ctx.quadraticCurveTo(-box.width * .22, 3, 2, -2);
  }
  ctx.stroke();
  ctx.restore();
}
