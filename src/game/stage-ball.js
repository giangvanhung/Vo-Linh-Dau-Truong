export const ballRadius = 12;

export function createStageBall(stage, width) {
  return stage.football ? { x: width / 2, y: 0, vx: 0, vy: 0, spin: 0, kicks: new WeakSet() } : null;
}

export function updateStageBall(ball, fighters, width, dt) {
  if (!ball) return;
  for (const fighter of fighters) {
    const attack = fighter.attack;
    if (attack?.id !== 'kick' || !fighter.attackActive || ball.kicks.has(attack)) continue;
    const distance = (ball.x - fighter.x) * attack.facing;
    if (distance < 0 || distance > fighter.width + ballRadius || Math.abs(fighter.y - ball.y) > 60) continue;
    ball.kicks.add(attack);
    ball.vx = 370 * attack.facing;
    ball.vy = -210;
  }
  if (!ball.vx && !ball.vy) return;
  ball.x += ball.vx * dt;
  ball.spin += ball.vx * dt / ballRadius;
  if (ball.x < ballRadius || ball.x > width - ballRadius) {
    ball.x = Math.max(ballRadius, Math.min(width - ballRadius, ball.x));
    ball.vx *= -.68;
  }
  if (ball.y < 0 || ball.vy < 0) {
    ball.vy += 760 * dt;
    ball.y += ball.vy * dt;
    if (ball.y >= 0) {
      ball.y = 0;
      ball.vy = ball.vy > 65 ? -ball.vy * .4 : 0;
    }
  }
  ball.vx *= Math.exp(-(ball.y === 0 ? 3.1 : .7) * dt);
  if (Math.abs(ball.vx) < 3) ball.vx = 0;
}
