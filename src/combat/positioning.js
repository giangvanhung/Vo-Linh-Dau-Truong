export function updateFacing(hung, mai) {
  hung.facing = Math.sign(mai.x - hung.x) || hung.facing;
  mai.facing = -hung.facing;
}

