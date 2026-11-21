import { strikePose } from './fighter-motion.js';

const strokes = {
  sweep: [-1.25, .8, 1.16],
  reverse: [1.1, -.85, 1.1],
  chop: [-2.05, 1.03, 1.18],
  thrust: [.27, -.08, 1.85],
  lift: [1.12, -1.18, 1.32],
  cast: [-1, -.18, 1.5],
  staffSweep: [-1.55, 1.04, 1.26],
  staffReturn: [1.28, -1.2, 1.3],
  rattanSnap: [-2.05, .6, 1.42],
  broomSweep: [1.36, .48, 1.16],
};
const pickupStrokes = { dogStaff: 'staffSweep', rattan: 'rattanSnap', broom: 'broomSweep' };

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
    : type === 'staff' && attack.swing === 'slash' ? 'staffSweep'
    : type === 'staff' && attack.swing === 'reverse' ? 'staffReturn'
    : attack.swing === 'slash' ? (attack.id === 'heavy' && ['blade', 'hammer', 'pan'].includes(type) ? 'chop' : 'sweep')
    : attack.swing ?? pickupStrokes[pickup] ?? (['sword', 'slipper'].includes(pickup) && !attack.projectile ? 'sweep' : null);
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
