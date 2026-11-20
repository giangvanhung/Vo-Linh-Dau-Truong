export const gear = {
  shield: { label: 'Giáp hộ vệ', color: '#63bac0', image: '/assets/effects/party-shield.png' },
  heal: { label: 'Hồi máu', color: '#a5d48a', symbol: '+' },
  power: { label: 'Tăng công', color: '#e99d6a', symbol: '↑' },
  sword: { label: 'Kiếm vòng cung', color: '#edbf79', image: '/assets/effects/party-sword.png' },
  slipper: { label: 'Dép tổ ong', color: '#e6b775', swing: { damage: 11, startup: 9, recovery: 13, far: 59 } },
  broom: { label: 'Chổi đót', color: '#d8b85e', swing: { damage: 13, far: 106, low: true } },
  rattan: { label: 'Roi mây', color: '#c88d68', swing: { damage: 14, startup: 13, far: 138, near: 35 } },
  dogStaff: { label: 'Đả Cẩu Bổng', color: '#8bc47b', swing: { damage: 17, far: 112, guardDamage: 34, launch: 240 } },
  blaster: { label: 'Súng linh lực', color: '#be9bdb', image: '/assets/effects/party-blaster.png' },
};

const crateDrops = Object.keys(gear);

export function createPickups(random = Math.random) {
  let drop = null;
  let nextDrop = 300;
  return {
    get drop() { return drop; },
    reset() {
      drop = null;
      nextDrop = 300;
    },
    update(fighters, frame, worldWidth) {
      if (!drop && frame >= nextDrop) {
        drop = { x: worldWidth * (.24 + random() * .52), y: -330 };
      }
      if (!drop) return null;
      drop.y = Math.min(-14, drop.y + 4);
      const fighter = fighters.filter(f => f.hp > 0 && Math.abs(f.x - drop.x) < 32
        && Math.abs(f.y - drop.y + 22) < 42)
        .sort((a, b) => Math.abs(a.x - drop.x) - Math.abs(b.x - drop.x))[0];
      if (!fighter) return null;
      const kind = crateDrops[Math.floor(random() * crateDrops.length)];
      if (kind === 'heal') fighter.hp = Math.min(fighter.maxHp, fighter.hp + 21);
      else if (kind === 'shield') fighter.shieldHp = 18;
      else if (kind === 'power') fighter.powerFrames = 480;
      else {
        fighter.pickupWeapon = kind;
        fighter.weaponUses = 3;
      }
      drop = null;
      nextDrop = frame + 420 + Math.floor(random() * 180);
      return { fighter, kind };
    },
  };
}

export function equippedHeavy(fighter) {
  const kind = fighter.pickupWeapon;
  if (!fighter.weaponUses || !kind) return null;
  const { label, color, swing } = gear[kind];
  const common = { label, color, pickupWeapon: kind, damage: 15, startup: 15, recovery: 25,
    hitstun: 18, knockback: 230, hitstop: 3, guardDamage: 23, cancelInto: [],
    effect: { color, particles: 13, trailSeconds: .14 } };
  if (kind === 'blaster') return { ...common, active: 1, level: 'mid',
    projectile: { color, shape: 'bolt', speed: 730, width: 54, height: 22, yOffset: 60, lifetimeFrames: 74 } };
  const { low, near = 5, far = 108, ...stats } = swing ?? {};
  return { ...common, ...stats, active: 6, level: low ? 'low' : 'mid',
    limbBoxes: [{ near, far, top: low ? 40 : 90, height: low ? 33 : 53 }] };
}
