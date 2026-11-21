import { stageFloorAt } from './stages.js';
import { setMainWeapon, weaponTypeFor } from './equipment.js';

export const gear = {
  shield: { label: 'Giáp hộ vệ', color: '#63bac0', image: '/assets/effects/party-shield.png' },
  heal: { label: 'Hồi máu', color: '#a5d48a', symbol: '+' },
  power: { label: 'Tăng công', color: '#e99d6a', symbol: '↑' },
  sword: { label: 'Kiếm vòng cung', color: '#edbf79', image: '/assets/effects/party-sword.png' },
  slipper: { label: 'Dép tổ ong', color: '#e6b775', uses: 4, swing: { damage: 11, startup: 9, recovery: 13, far: 59 },
    throw: { damage: 13, shape: 'slipper', speed: 610, width: 29, height: 18, gravity: 700, launchY: -55 } },
  broom: { label: 'Chổi đót', color: '#d8b85e', swing: { damage: 13, far: 106, low: true } },
  rattan: { label: 'Roi mây', color: '#c88d68', swing: { damage: 14, startup: 13, far: 138, near: 35 } },
  dogStaff: { label: 'Đả Cẩu Bổng', color: '#8bc47b', swing: { damage: 17, far: 112, guardDamage: 34, launch: 240 } },
  blaster: { label: 'Súng linh lực', color: '#be9bdb', image: '/assets/effects/party-blaster.png' },
  orb: { label: 'Cầu linh lực', color: '#7fd6ff', uses: 2,
    throw: { damage: 15, shape: 'orb', speed: 430, width: 35, height: 32 } },
  vial: { label: 'Bình độc', color: '#b2e65f', uses: 2,
    throw: { damage: 7, status: 'poison', shape: 'vial', speed: 365, width: 22, height: 25, gravity: 620, launchY: -85, poolFrames: 72 } },
  dart: { label: 'Phi tiêu', color: '#b6c9e7', uses: 3,
    throw: { damage: 8, shape: 'dart', speed: 820, width: 21, height: 19 } },
};

const crateDrops = Object.keys(gear);
const boosts = new Set(['heal', 'shield', 'power']);
const pickupRadius = 36;

function take(fighter, kind, uses = gear[kind].uses ?? 3, frames = 900) {
  if (kind === 'heal') fighter.hp = Math.min(fighter.maxHp, fighter.hp + 21);
  else if (kind === 'shield') fighter.shieldHp = 18;
  else if (kind === 'power') fighter.powerFrames = 480;
  else {
    fighter.pickupWeapon = kind;
    fighter.weaponUses = uses;
    fighter.weaponFrames = frames;
  }
}

export function createPickups(random = Math.random) {
  let enabled = false;
  let drop = null;
  let nextDrop = 180;
  let expiresAt = 0;
  const loose = [];

  function release(fighter, frame, world, forced = false) {
    const temporary = fighter.weaponUses && fighter.pickupWeapon;
    const main = fighter.weapon;
    const add = weapon => {
      const x = Math.max(18, Math.min(world.width - 18, fighter.x + (weapon.weapon ? -1 : 1) * fighter.facing * 16));
      loose.push({ ...weapon, x, y: fighter.y - 13, ready: frame + 18, blocked: fighter });
    };
    if (temporary) {
      add({ kind: temporary, uses: fighter.weaponUses, expires: frame + fighter.weaponFrames });
      fighter.pickupWeapon = null;
      fighter.weaponUses = fighter.weaponFrames = 0;
    }
    if (main && (!temporary || forced)) {
      add({ weapon: main });
      setMainWeapon(fighter, null);
    }
    return Boolean(temporary || main);
  }

  return {
    get drop() { return drop; },
    get loose() { return loose; },
    release,
    reset(itemsEnabled, keepMainWeapons = false) {
      enabled = itemsEnabled === true;
      drop = null;
      nextDrop = 180;
      for (let index = loose.length - 1; index >= 0; index--) {
        if (!keepMainWeapons || !loose[index].weapon) loose.splice(index, 1);
        else Object.assign(loose[index], { ready: 18, blocked: null });
      }
    },
    update(fighters, frame, world) {
      const picked = [];
      const available = fighter => fighter.hp > 0 && fighter.onGround && !fighter.disabled && !fighter.attacking && !fighter.dash;
      for (let i = loose.length - 1; i >= 0; i--) {
        const item = loose[i];
        if (item.expires != null && frame >= item.expires) {
          loose.splice(i, 1);
          continue;
        }
        item.y = Math.min(stageFloorAt(world, item.x, item.y), item.y + 6);
        if (item.blocked && Math.abs(item.blocked.x - item.x) > pickupRadius + 12) item.blocked = null;
        if (frame < item.ready) continue;
        const nearby = fighters.filter(fighter => available(fighter) && fighter !== item.blocked
          && Math.abs(fighter.x - item.x) < pickupRadius && Math.abs(fighter.y - item.y) < 15
          && (item.weapon ? !fighter.weapon && item.weapon.weaponType === weaponTypeFor(fighter.characterId) : !fighter.weaponUses));
        const fighter = nearby.sort((a, b) => Math.abs(a.x - item.x) - Math.abs(b.x - item.x))[0];
        if (!fighter) continue;
        if (item.weapon) setMainWeapon(fighter, item.weapon);
        else take(fighter, item.kind, item.uses, item.expires - frame);
        picked.push({ fighter, label: item.weapon?.label ?? gear[item.kind].label, color: item.weapon?.color ?? gear[item.kind].color });
        loose.splice(i, 1);
      }
      if (!enabled) return picked;
      if (drop && frame >= expiresAt) {
        drop = null;
        nextDrop = frame + 120;
      }
      if (!drop && frame >= nextDrop) {
        const x = world.width * (.24 + random() * .52);
        const surface = stageFloorAt(world, x, -Infinity);
        drop = { x, y: Math.min(-330, surface - 100), restY: surface - 14,
          kind: crateDrops[Math.floor(random() * crateDrops.length)] };
        expiresAt = frame + 720;
      }
      if (!drop) return picked;
      drop.y = Math.min(drop.restY, drop.y + 4);
      const fighter = fighters.filter(f => available(f) && (!f.weaponUses || boosts.has(drop.kind)) && Math.abs(f.x - drop.x) < 34
        && Math.abs(f.y - drop.y + 22) < 42)
        .sort((a, b) => Math.abs(a.x - drop.x) - Math.abs(b.x - drop.x))[0];
      if (!fighter) return picked;
      const { kind } = drop;
      take(fighter, kind);
      drop = null;
      nextDrop = frame + 420 + Math.floor(random() * 180);
      picked.push({ fighter, label: gear[kind].label, color: gear[kind].color });
      return picked;
    },
  };
}

export function equippedAttack(fighter, action) {
  if (action !== 'light' && action !== 'heavy') return null;
  const kind = fighter.pickupWeapon;
  if (!fighter.weaponUses || !kind) return null;
  const { label, color, swing, throw: thrown } = gear[kind];
  const common = { label, color, pickupWeapon: kind, damage: 15, startup: 15, recovery: 25,
    critChance: { dart: 18, blaster: 15, slipper: 10, vial: 0 }[kind] ?? 8,
    hitstun: 18, knockback: 230, hitstop: 3, guardDamage: 23, cancelInto: [],
    effect: { color, particles: 13, trailSeconds: .14 } };
  if (kind === 'blaster') return { ...common, animation: 'skill_2', active: 1, level: 'mid',
    projectile: { color, shape: 'bolt', speed: 730, width: 54, height: 22, yOffset: 60, lifetimeFrames: 74 } };
  if (thrown && (action === 'heavy' || !swing)) {
    const { damage, status, ...projectile } = thrown;
    return { ...common, label: kind === 'slipper' ? 'Ném dép' : label, thrownItem: true, damage, status, startup: 10,
      recovery: 17, active: 1, animation: 'skill_2', level: 'mid',
      projectile: { ...projectile, color, yOffset: 64, lifetimeFrames: 56 } };
  }
  const { low, near = 5, far = 108, ...stats } = swing ?? {};
  return { ...common, ...stats, animation: 'heavy_punch', active: 6, level: low ? 'low' : 'mid',
    limbBoxes: [{ near, far, top: low ? 40 : 90, height: low ? 33 : 53 }] };
}
