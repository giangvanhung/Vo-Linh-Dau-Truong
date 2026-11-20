export function updateFacing(hung, mai) {
  hung.facing = Math.sign(mai.x - hung.x) || hung.facing;
  mai.facing = -hung.facing;
}

export function pushboxesOverlap(hung, mai, pushboxHeightRatio) {
  const higher = hung.y < mai.y ? hung : mai;
  const lower = higher === hung ? mai : hung;
  return lower.y - higher.y < lower.height * pushboxHeightRatio;
}

export function separateFighters(hung, mai, world, pushboxHeightRatio, startingSide, bodiesTouchingVertically) {
  for (const fighter of [hung, mai]) {
    const attack = fighter.attack;
    if (attack?.travel?.passesThrough && fighter.attackActive
      && attack.elapsed - attack.startup < attack.travel.frames) return;
  }
  if (!pushboxesOverlap(hung, mai, pushboxHeightRatio)) return;
  const minimum = (hung.width + mai.width) / 2 + 5;
  const gap = mai.x - hung.x;
  const direction = bodiesTouchingVertically ? startingSide : Math.sign(gap) || startingSide;
  const overlap = minimum - gap * direction;
  if (overlap <= 0) return;
  hung.x -= direction * overlap / 2;
  mai.x += direction * overlap / 2;
  hung.clampX(world);
  mai.clampX(world);
  if (Math.abs(mai.x - hung.x) < minimum) {
    mai.x = hung.x + direction * minimum;
    mai.clampX(world);
    hung.x = mai.x - direction * minimum;
  }
}

