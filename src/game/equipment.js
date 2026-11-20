export const slots = { weapon: 'Vũ khí', armor: 'Giáp', ring: 'Nhẫn', charm: 'Bùa' };
export const rarities = ['Thường', 'Hiếm', 'Sử thi', 'Huyền thoại'];
export const statNames = {
  attack: 'Tấn công', hp: 'Máu', defense: 'Giảm sát thương', speed: 'Tốc độ',
  cooldown: 'Giảm hồi chiêu', energy: 'Tăng nộ nhận được', crit: 'Tỷ lệ chí mạng', critDamage: 'Sát thương chí mạng',
};
const caps = { attack: 65, hp: 180, defense: 30, speed: 25, cooldown: 35, energy: 65, crit: 35, critDamage: 85 };
export const sets = {
  dawn: { name: 'Bình Minh', color: '#ffbf72', two: { attack: 7 }, four: { attack: 9, crit: 5, critDamage: 12 } },
  tide: { name: 'Thủy Triều', color: '#78d8df', two: { hp: 18 }, four: { defense: 6, cooldown: 8, energy: 10 } },
};
const items = {
  dawn: { weapon: ['Đao', { attack: 9 }], armor: ['Hộ giáp', { hp: 15 }], ring: ['Nhẫn', { crit: 5, critDamage: 8 }], charm: ['Bùa', { speed: 4, energy: 6 }] },
  tide: { weapon: ['Thương', { attack: 8 }], armor: ['Áo giáp', { hp: 11, defense: 4 }], ring: ['Nhẫn', { cooldown: 6, energy: 7 }], charm: ['Bùa', { speed: 3, crit: 3, critDamage: 6 }] },
};
export const catalog = Object.create(null);
for (let tier = 0; tier < rarities.length; tier++) {
  for (const [set, parts] of Object.entries(items)) {
    for (const [slot, [name, stats]] of Object.entries(parts)) {
      const id = [set, slot, tier].join('-');
      catalog[id] = { id, set, slot, tier, name: name + ' ' + sets[set].name, stats };
    }
  }
}

const key = 'vo-linh-equipment-v1';
const starter = { 'dawn-weapon-0': 1, 'dawn-ring-0': 1, 'tide-armor-0': 1, 'tide-charm-0': 1 };
const integer = (value, limit = 999999) => Number.isSafeInteger(value) ? Math.max(0, Math.min(limit, value)) : 0;
const owns = (object, id) => Object.prototype.hasOwnProperty.call(object, id);
export const maxLevel = 5;

export function validLoadout(inventory, value) {
  const loadout = {};
  for (const slot of Object.keys(slots)) {
    const id = value?.[slot];
    if (typeof id === 'string' && owns(inventory, id) && catalog[id]?.slot === slot) loadout[slot] = id;
  }
  return loadout;
}

export function loadEquipment(storage) {
  let saved;
  try { saved = JSON.parse((storage ?? globalThis.localStorage).getItem(key)); } catch {}
  const inventory = { ...starter };
  for (const id of Object.keys(catalog)) {
    const level = integer(saved?.inventory?.[id], maxLevel);
    if (level) inventory[id] = level;
  }
  const loadouts = Object.create(null);
  for (const [id, loadout] of Object.entries(saved?.loadouts ?? {})) loadouts[id] = validLoadout(inventory, loadout);
  return { inventory, loadouts, gold: integer(saved?.gold ?? 100), material: integer(saved?.material ?? 4),
    wins: integer(saved?.wins), matches: integer(saved?.matches) };
}

export function saveEquipment(state, storage) {
  try { (storage ?? globalThis.localStorage).setItem(key, JSON.stringify(state)); return true; } catch { return false; }
}

export function equipmentStats(state, loadout) {
  const stats = {};
  for (const stat of Object.keys(statNames)) stats[stat] = 0;
  const counts = { dawn: 0, tide: 0 };
  function add(bonuses, multiplier = 1) {
    for (const [stat, amount] of Object.entries(bonuses)) stats[stat] += Math.round(amount * multiplier);
  }
  for (const id of Object.values(validLoadout(state.inventory, loadout))) {
    const item = catalog[id];
    counts[item.set]++;
    add(item.stats, 1 + item.tier * .35 + (state.inventory[id] - 1) * .22);
  }
  for (const [id, set] of Object.entries(sets)) {
    if (counts[id] >= 2) add(set.two);
    if (counts[id] >= 4) add(set.four);
  }
  for (const stat of Object.keys(stats)) stats[stat] = Math.min(caps[stat], stats[stat]);
  return { stats, counts };
}

export function upgradeCost(item, level) {
  return { gold: 45 * level + 30 * item.tier, material: level + item.tier };
}

export function upgradeEquipment(state, id) {
  const item = catalog[id];
  const level = state.inventory[id];
  if (!item || !level || level >= maxLevel) return false;
  const cost = upgradeCost(item, level);
  if (state.gold < cost.gold || state.material < cost.material) return false;
  state.gold -= cost.gold;
  state.material -= cost.material;
  state.inventory[id]++;
  return true;
}

export function awardEquipment(state, won) {
  state.matches = integer(state.matches + 1);
  if (won) state.wins = integer(state.wins + 1);
  const gold = won ? 65 : 25;
  const material = won ? 3 : 1;
  const winsToUnlock = [1, 3, 9, 17];
  const item = won ? Object.values(catalog).filter(entry => !state.inventory[entry.id]
    && state.wins >= winsToUnlock[entry.tier]).sort((a, b) => b.tier - a.tier)[0] : undefined;
  if (item) state.inventory[item.id] = 1;
  state.gold = integer(state.gold + gold);
  state.material = integer(state.material + material);
  return { gold, material, item };
}

export function equipFighter(fighter, state, id, pve) {
  const loadout = owns(state.loadouts, id) ? state.loadouts[id] : undefined;
  const { stats } = equipmentStats(state, loadout);
  const cosmetic = catalog[Object.values(validLoadout(state.inventory, loadout))[0]];
  fighter.equipmentColor = sets[cosmetic?.set]?.color;
  if (!pve) return;
  fighter.equipmentStats = stats;
  fighter.hp += stats.hp;
  fighter.maxHp += stats.hp;
  fighter.baseHp += stats.hp;
  fighter.moveSpeed *= 1 + stats.speed / 100;
}
