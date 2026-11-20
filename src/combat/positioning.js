export function updateFacing(hung, mai) {
  const gap = mai.x - hung.x;
  if (Math.abs(gap) > 4) hung.facing = Math.sign(gap);
  mai.facing = -hung.facing;
}

