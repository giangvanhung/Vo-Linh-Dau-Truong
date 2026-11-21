export function stageForMatch(base, stage, hazardsEnabled) {
  return { ...base, ...stage, zone: hazardsEnabled ? stage.zone : null };
}

export function overlapsSurface(x, width, range) {
  return x >= range[0] * width && x <= range[1] * width;
}

export function groundHeightAt(world, x) {
  let floor = 0;
  for (const { range, rise } of world.rises ?? []) {
    const [left, right] = range;
    const position = x / world.width;
    if (position < left || position > right) continue;
    const ramp = (right - left) * .35;
    floor = Math.min(floor, -rise * Math.min(1, (position - left) / ramp, (right - position) / ramp));
  }
  return floor;
}

export function stageFloorAt(world, x, y) {
  let floor = groundHeightAt(world, x);
  for (const platform of world.platforms ?? []) {
    if (y <= platform.y && overlapsSurface(x, world.width, platform.range)) floor = Math.min(floor, platform.y);
  }
  return floor;
}

export function zoneRanges(zone) {
  const [start, end] = zone.range;
  return zone.kind === 'vent' ? [zone.range, [1 - end, 1 - start]] : [zone.range];
}

export const stageConditions = {
  morph: { label: 'Hóa thỏ', color: '#f5adff', frames: 40 },
  stun: { label: 'Choáng', color: '#ffdf8c', frames: 11 },
  poison: { label: 'Độc', color: '#b3ec82', frames: 90 },
  slow: { label: 'Chậm 22%', color: '#91ebff', frames: 80 },
  reflect: { label: 'Phản đòn cận chiến', color: '#ffbb78', frames: 100 },
  weaken: { label: 'Giảm công 18%', color: '#c1afff', frames: 80 },
};

export function stageConditionAt(zone, frame) {
  if (!zone?.conditions?.length) return null;
  const cycle = Math.floor(frame / zone.cycle);
  const kind = zone.conditions[cycle % zone.conditions.length];
  return { kind, ...stageConditions[kind] };
}

export function zoneWarning(zone, frame) {
  const warningFrames = zone.conditions ? 58 : 48;
  return Boolean(zone.cycle && frame % zone.cycle >= zone.cycle - zone.active - warningFrames);
}

export function applyStageEffects(world, fighter, startX, frame, dt) {
  const zone = world.zone;
  if (fighter.hp <= 0 || !zone) return;
  const inside = zoneRanges(zone).some(range => overlapsSurface(fighter.x, world.width, range));
  const onFloor = fighter.onGround && Math.abs(fighter.y - groundHeightAt(world, startX)) < 5;
  if (zone.kind === 'slip') {
    if (fighter.disabled || fighter.dash || !fighter.canMoveDuringAttack || fighter.blocking || fighter.charging || !fighter.onGround) {
      fighter.slideVelocity = 0;
      return;
    }
    const intended = (fighter.x - startX) / dt;
    if (inside && onFloor) fighter.slideVelocity = (fighter.slideVelocity ?? 0) * zone.inertia + intended * (1 - zone.inertia);
    else fighter.slideVelocity = intended;
    fighter.x = startX + fighter.slideVelocity * dt;
    return;
  }
  if (inside && activeZone(zone, frame)) {
    if (zone.kind === 'wind' && !fighter.onGround) fighter.x += 105 * dt;
    if (zone.kind === 'mana' && onFloor) fighter.gainMeter(10 * dt);
    const cycle = Math.floor(frame / zone.cycle);
    if (zone.kind === 'condition' && onFloor && !fighter.disabled && !fighter.invulnerable
      && !fighter.stageCondition && fighter.lastConditionCycle !== cycle) {
      const effect = stageConditionAt(zone, frame);
      fighter.lastConditionCycle = cycle;
      fighter.stageCondition = { ...effect, remaining: effect.frames };
      if (effect.kind === 'morph' || effect.kind === 'stun') {
        fighter.attack = null;
        fighter.bufferedAttack = null;
        fighter.chargeFrames = 0;
        if (effect.kind === 'stun') fighter.blocking = false;
      }
    }
    if (zone.kind === 'lava' && fighter.y >= -8 && frame - (fighter.lastLavaTick ?? -Infinity) >= 30) {
      fighter.lastLavaTick = frame;
      fighter.hp = Math.max(0, fighter.hp - zone.damage);
      fighter.flash = .12;
      fighter.chargeFrames = 0;
    }
    if (zone.kind === 'vent' && onFloor && fighter.lastVentCycle !== cycle) {
      fighter.lastVentCycle = cycle;
      fighter.vy = -390;
      fighter.onGround = false;
      fighter.blocking = false;
      fighter.chargeFrames = 0;
    }
  }
}

export function activeZone(zone, frame) {
  return !zone.cycle || frame % zone.cycle >= zone.cycle - zone.active;
}
