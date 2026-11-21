import { strikePose } from './fighter-motion.js';

const strokes = {
  sweep: [-1.25, .8, 1.16],
  reverse: [1.1, -.85, 1.1],
  chop: [-2.05, 1.03, 1.18],
  thrust: [.27, -.08, 1.85],
  lift: [1.12, -1.18, 1.32],
  cast: [-1, -.18, 1.5],
};

const ease = x => x * x * (3 - 2 * x);

export function weaponMotion(attack) {
  if (!attack) return null;
  const type = attack.mainWeapon;
  const pickup = attack.pickupWeapon;
  const age = attack.elapsed - attack.startup;
  if (pickup === 'blaster') {
    const aim = age < 0 ? ease(Math.max(0, attack.elapsed / attack.startup))
      : 1 - ease(Math.max(0, Math.min(1, (age - 8) / Math.max(1, attack.recovery - 8))));
    const recoil = age < 0 ? 0 : Math.max(0, 1 - age / 8) ** 2;
    return { amount: aim, angle: -.10 - .26 * recoil, reach: 1 + .58 * aim - .32 * recoil, kind: 'aim' };
  }
  const style = type === 'staff' && attack.projectile ? 'cast'
    : attack.swing === 'slash' ? (attack.id === 'heavy' && ['blade', 'hammer', 'pan'].includes(type) ? 'chop' : 'sweep')
    : attack.swing ?? (pickup === 'broom' ? 'reverse' : ['sword', 'rattan', 'dogStaff', 'slipper'].includes(pickup) && !attack.projectile ? 'sweep' : null);
  if (!strokes[style] || type === 'gauntlet') return null;
  const [wind, follow, reach] = strokes[style];
  if (age < 0) {
    const progress = attack.elapsed / attack.startup;
    const preparation = Math.sin(Math.PI * progress);
    const strike = Math.max(0, strikePose(attack));
    return { amount: Math.max(preparation, strike), angle: wind * preparation + follow * strike,
      reach: 1 - .21 * preparation + (reach - 1) * strike, kind: style };
  }
  const extension = Math.max(0, strikePose(attack));
  return { amount: extension, angle: follow * extension, reach: 1 + (reach - 1) * extension, kind: style };
}
