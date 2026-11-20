export function faceOpponent(fighter, opponent) {
  const gap = opponent.x - fighter.x;
  if (Math.abs(gap) > 4 && !fighter.attack && !fighter.dash && !fighter.disabled) {
    fighter.facing = Math.sign(gap);
  }
}

