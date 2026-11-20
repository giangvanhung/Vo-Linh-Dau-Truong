export function stageForMatch(base, stage, hazardsEnabled) {
  return { ...base, ...stage, zone: hazardsEnabled ? stage.zone : null };
}

export function overlapsSurface(x, width, range) {
  return x >= range[0] * width && x <= range[1] * width;
}

export function zoneRanges(zone) {
  const [start, end] = zone.range;
  return zone.kind === 'vent' ? [zone.range, [1 - end, 1 - start]] : [zone.range];
}

export function applyStageEffects(world, fighter, startX, frame, dt) {
  const zone = world.zone;
  if (fighter.hp <= 0 || !zone) return;
  const inside = zoneRanges(zone).some(range => overlapsSurface(fighter.x, world.width, range));
  if (zone.kind === 'slip') {
    if (fighter.disabled || fighter.dash || fighter.attacking || fighter.blocking || fighter.charging || !fighter.onGround) {
      fighter.slideVelocity = 0;
      return;
    }
    const intended = (fighter.x - startX) / dt;
    if (inside && fighter.y === 0) fighter.slideVelocity = (fighter.slideVelocity ?? 0) * zone.inertia + intended * (1 - zone.inertia);
    else fighter.slideVelocity = intended;
    fighter.x = startX + fighter.slideVelocity * dt;
    return;
  }
  if (inside && activeZone(zone, frame)) {
    if (zone.kind === 'wind' && !fighter.onGround) fighter.x += 105 * dt;
    const cycle = Math.floor(frame / zone.cycle);
    if (zone.kind === 'vent' && fighter.onGround && fighter.y === 0 && fighter.lastVentCycle !== cycle) {
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
