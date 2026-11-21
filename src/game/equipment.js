export const slots = { weapon: 'Vũ khí', armor: 'Áo giáp', pants: 'Quần', helmet: 'Mũ', boots: 'Giày', ring: 'Nhẫn', charm: 'Bùa' };
export const rarities = ['Thường', 'Hiếm', 'Sử thi', 'Huyền thoại'];
export const weaponTypes = {
  blade: { name: 'Đao', image: '/assets/effects/party-sword.png', width: 80, gripX: .23, gripY: .78, tilt: -.55 },
  spear: { name: 'Thương', image: '/assets/effects/fox-spear.png', width: 108, gripX: .43, gripY: .60, tilt: .14 },
  hammer: { name: 'Búa', image: '/assets/effects/golem-hammer.png', width: 96, gripX: .205, gripY: .78, tilt: -.43 },
  staff: { name: 'Trượng', kind: 'staff', color: '#b19ae9', tilt: -.9 },
  pan: { name: 'Chảo', kind: 'pan', color: '#aa9ba0', tilt: -.83 },
  gauntlet: { name: 'Quyền giáp', kind: 'gauntlet', color: '#edbf79', tilt: 0 },
};
const fighterWeapons = {
  hung: 'gauntlet', mai: 'blade', linh: 'gauntlet', ngoc: 'hammer',
  vy: 'gauntlet', lam: 'gauntlet', diep: 'staff', golem: 'hammer',
  fox: 'spear', goblin: 'blade', elf: 'spear', jackal: 'staff',
  robot: 'gauntlet', corgi: 'pan', dragon: 'gauntlet', shadow: 'gauntlet',
  mio: 'spear', rin: 'blade', nami: 'gauntlet', yuna: 'staff', 'bang-nghi': 'staff', 'an-tin': 'gauntlet', 'ha-mien': 'gauntlet',
};
export const weaponTypeFor = id => fighterWeapons[id];
export const canEquip = (fighterId, item) => Boolean(item)
  && (item.slot !== 'weapon' || item.weaponType === weaponTypeFor(fighterId));
export const statNames = {
  attack: 'Tấn công', hp: 'Máu', defense: 'Giảm sát thương', speed: 'Tốc độ',
  cooldown: 'Giảm hồi chiêu', energy: 'Tăng nộ nhận được', crit: 'Tỷ lệ chí mạng', critDamage: 'Sát thương chí mạng',
  shield: 'Giáp đầu hiệp', regenHp: 'HP mỗi giây', regenMana: 'Nộ mỗi giây', resistCrit: 'Kháng chí mạng',
  jump: 'Sức bật', revive: 'Hồi sinh mỗi trận',
};
const caps = { attack: 65, hp: 180, defense: 30, speed: 25, cooldown: 35, energy: 65, crit: 35, critDamage: 85,
  shield: 48, regenHp: 5, regenMana: 8, resistCrit: 35, jump: 20, revive: 1 };
export const sets = {
  dawn: { name: 'Bình Minh', color: '#ffbf72', two: { attack: 7 }, four: { attack: 9, crit: 5, critDamage: 12 } },
  tide: { name: 'Thủy Triều', color: '#78d8df', two: { hp: 18 }, four: { defense: 6, cooldown: 8, energy: 10 } },
};
const items = {
  dawn: { weapon: ['Đao', { attack: 9 }], armor: ['Hộ giáp', { hp: 15, shield: 13 }],
    pants: ['Quần Tụ Khí', { regenMana: 2 }], helmet: ['Mũ Kiên Định', { resistCrit: 10 }],
    boots: ['Giày Bước Gió', { speed: 8 }], ring: ['Nhẫn', { crit: 5, critDamage: 8 }], charm: ['Bùa', { speed: 4, energy: 6 }] },
  tide: { weapon: ['Thương', { attack: 8 }], armor: ['Áo Tái Sinh', { hp: 11, defense: 4, regenHp: 1 }],
    pants: ['Quần Dẫn Nộ', { regenMana: 3 }], helmet: ['Mũ Hộ Thể', { resistCrit: 8, defense: 3 }],
    boots: ['Giày Vượt Mây', { jump: 9 }], ring: ['Nhẫn', { cooldown: 6, energy: 7 }], charm: ['Bùa', { speed: 3, crit: 3, critDamage: 6 }] },
};
export const catalog = Object.create(null);
for (let tier = 0; tier < rarities.length; tier++) {
  for (const [set, parts] of Object.entries(items)) {
    for (const [slot, [name, stats]] of Object.entries(parts)) {
      const id = [set, slot, tier].join('-');
      catalog[id] = { id, set, slot, tier, name: name + ' ' + sets[set].name,
        stats: slot === 'armor' && set === 'tide' && tier >= 2 ? { ...stats, revive: 1 } : stats,
        ...(slot === 'weapon' && { weaponType: set === 'dawn' ? 'blade' : 'spear' }) };
    }
  }
}
for (const [weaponType, set] of Object.entries({ hammer: 'dawn', staff: 'tide', pan: 'tide', gauntlet: 'dawn' })) {
  for (let tier = 0; tier < rarities.length; tier++) {
    const id = [set, weaponType, tier].join('-');
    catalog[id] = { id, set, slot: 'weapon', tier, weaponType, name: weaponTypes[weaponType].name + ' ' + sets[set].name,
      stats: items[set].weapon[1] };
  }
}

const key = 'vo-linh-equipment-v1';
const starter = { 'dawn-weapon-0': 1, 'dawn-ring-0': 1, 'tide-armor-0': 1, 'tide-charm-0': 1 };
const integer = (value, limit = 999999) => Number.isSafeInteger(value) ? Math.max(0, Math.min(limit, value)) : 0;
const owns = (object, id) => Object.prototype.hasOwnProperty.call(object, id);
export const maxLevel = 5;
export const inventoryLimit = 32;
export const dailyRefreshLimit = 10;
export const refreshPrice = 20;
export const weaponPerks = {
  edge: { name: 'Sắc Bén', description: '+8 điểm % chí mạng khi ra đòn bằng vũ khí.' },
  surge: { name: 'Dội Nộ', description: 'Kỹ năng vũ khí trúng đích hồi thêm 4 nộ.' },
  impact: { name: 'Xung Lực', description: 'Kỹ năng vũ khí gây 122% sát thương gốc.' },
  frost: { name: 'Hàn Ấn', description: 'Kỹ năng vũ khí chưa có trạng thái sẽ tích hàn khi trúng.' },
};
export const skins = {
  original: { name: 'Nguyên bản', price: 0, filter: '' },
  jade: { name: 'Lục Ngọc', price: 125, filter: 'hue-rotate(105deg) saturate(1.12)' },
  dusk: { name: 'Hoàng Hôn', price: 180, filter: 'hue-rotate(235deg) saturate(1.32)' },
  silver: { name: 'Ngân Ảnh', price: 220, filter: 'saturate(.18) brightness(1.18)' },
};
const validRoll = roll => /^m-\d+-\d+$/.test(roll?.id) && Boolean(catalog[roll.baseId])
  && Number.isInteger(roll.quality) && roll.quality >= 85 && roll.quality <= 125
  && (!roll.perk || owns(weaponPerks, roll.perk));

export function gearItem(state, id) {
  if (catalog[id]) return catalog[id];
  const roll = state?.rolled?.[id] ?? state?.market?.offers?.find(offer => offer.id === id);
  if (!roll) return undefined;
  const base = catalog[roll.baseId];
  const stats = Object.fromEntries(Object.entries(base.stats).map(([key, amount]) =>
    [key, key === 'revive' ? amount : Math.max(1, Math.round(amount * roll.quality / 100))]));
  return { ...base, id, stats, perk: roll.perk, quality: roll.quality };
}

export const stockSize = state => Object.keys(state.inventory).length;
export const sampleWeaponFor = fighterId => Object.values(catalog)
  .find(item => item.slot === 'weapon' && item.tier === 0 && item.weaponType === weaponTypeFor(fighterId));

export function validLoadout(inventory, value, fighterId, state) {
  const loadout = {};
  for (const slot of Object.keys(slots)) {
    const id = value?.[slot];
    const item = typeof id === 'string' && gearItem(state, id);
    if (inventory[id] > 0 && item?.slot === slot
      && (fighterId === undefined || canEquip(fighterId, item))) loadout[slot] = id;
  }
  return loadout;
}

export function loadEquipment(storage) {
  let saved;
  try { saved = JSON.parse((storage ?? globalThis.localStorage).getItem(key)); } catch {}
  const inventory = saved?.version >= 2 ? {} : { ...starter };
  const rolled = Object.create(null);
  for (const roll of Object.values(saved?.rolled ?? {})) if (validRoll(roll) && integer(saved?.inventory?.[roll.id], maxLevel)) rolled[roll.id] = roll;
  for (const id of [...Object.keys(catalog), ...Object.keys(rolled)]) {
    const level = integer(saved?.inventory?.[id], maxLevel);
    if (level) inventory[id] = level;
  }
  const loadouts = Object.create(null);
  const market = saved?.market;
  const state = { version: 3, inventory, rolled, loadouts, gold: integer(saved?.gold ?? 100), material: integer(saved?.material ?? 4),
    wins: integer(saved?.wins), matches: integer(saved?.matches), skinsOwned: Object.create(null), activeSkins: Object.create(null),
    market: { day: typeof market?.day === 'string' ? market.day : '', refreshes: integer(market?.refreshes, dailyRefreshLimit),
      serial: integer(market?.serial), offers: Array.isArray(market?.offers) ? market.offers.filter(validRoll).slice(0, 12) : [] } };
  for (const id of Object.keys(fighterWeapons)) {
    loadouts[id] = validLoadout(inventory, saved?.loadouts?.[id], id, state);
    const owned = saved?.skinsOwned?.[id];
    if (Array.isArray(owned)) state.skinsOwned[id] = [...new Set(owned.filter(skin => owns(skins, skin) && skin !== 'original'))];
    if (state.skinsOwned[id]?.includes(saved?.activeSkins?.[id])) state.activeSkins[id] = saved.activeSkins[id];
  }
  return state;
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
  for (const id of Object.values(validLoadout(state.inventory, loadout, undefined, state))) {
    const item = gearItem(state, id);
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
  const item = gearItem(state, id);
  const level = state.inventory[id];
  if (!item || !level || level >= maxLevel) return false;
  const cost = upgradeCost(item, level);
  if (state.gold < cost.gold || state.material < cost.material) return false;
  state.gold -= cost.gold;
  state.material -= cost.material;
  state.inventory[id]++;
  return true;
}

export function weaponPrice(item, level = 1) {
  const buy = Math.round((item.slot === 'weapon' ? [72, 145, 270, 475] : [58, 120, 220, 385])[item.tier]
    * ((item.quality ?? 100) / 100) + (item.perk ? 12 : 0));
  let sell = Math.floor(buy / 2);
  for (let rank = 1; rank < level; rank++) sell += Math.floor(upgradeCost(item, rank).gold / 4);
  return { buy, sell };
}

function rollStock(state, random) {
  const serial = ++state.market.serial;
  const groups = [...Object.keys(weaponTypes).map(type => item => item.weaponType === type),
    ...Object.keys(slots).filter(slot => slot !== 'weapon').map(slot => item => item.slot === slot)];
  const bases = Object.values(catalog);
  state.market.offers = groups.map((group, index) => {
    const chance = random();
    const tier = chance < .64 ? 0 : chance < .89 ? 1 : chance < .98 ? 2 : 3;
    const pool = bases.filter(item => item.tier === tier && group(item));
    const base = pool[Math.floor(random() * pool.length)];
    const perks = Object.keys(weaponPerks);
    return { id: 'm-' + serial + '-' + index, baseId: base.id, quality: 85 + Math.floor(random() * 41),
      ...(base.slot === 'weapon' && { perk: perks[Math.floor(random() * perks.length)] }) };
  });
}

export function prepareMarket(state, now = new Date(), random = Math.random) {
  const day = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  if (day <= state.market.day) return false;
  state.market.day = day;
  state.market.refreshes = 0;
  rollStock(state, random);
  return true;
}

export function refreshMarket(state, now = new Date(), random = Math.random) {
  prepareMarket(state, now, random);
  if (state.gold < refreshPrice || state.market.refreshes >= dailyRefreshLimit) return false;
  state.gold -= refreshPrice;
  state.market.refreshes++;
  rollStock(state, random);
  return true;
}

export function buyMarketItem(state, id, fighterId) {
  const offerIndex = state.market.offers.findIndex(offer => offer.id === id);
  const item = gearItem(state, id);
  if (offerIndex < 0 || !canEquip(fighterId, item) || state.inventory[id] || stockSize(state) >= inventoryLimit) return false;
  const { buy } = weaponPrice(item);
  if (state.gold < buy) return false;
  state.gold -= buy;
  const [roll] = state.market.offers.splice(offerIndex, 1);
  state.rolled[id] = roll;
  state.inventory[id] = 1;
  return true;
}

export function canSellItem(state, id) {
  return Boolean(gearItem(state, id)) && state.inventory[id] > 0
    && !Object.values(state.loadouts).some(loadout => Object.values(loadout).includes(id));
}

export function sellItem(state, id) {
  if (!canSellItem(state, id)) return false;
  state.gold = integer(state.gold + weaponPrice(gearItem(state, id), state.inventory[id]).sell);
  delete state.inventory[id];
  delete state.rolled[id];
  return true;
}

export function buySkin(state, fighterId, skin) {
  if (!weaponTypeFor(fighterId) || !owns(skins, skin) || !skins[skin].price || state.gold < skins[skin].price) return false;
  const owned = state.skinsOwned[fighterId] ??= [];
  if (owned.includes(skin)) return false;
  state.gold -= skins[skin].price;
  owned.push(skin);
  return true;
}

export function selectSkin(state, fighterId, skin) {
  if (!weaponTypeFor(fighterId) || !owns(skins, skin) || (skin !== 'original' && !state.skinsOwned[fighterId]?.includes(skin))) return false;
  state.activeSkins[fighterId] = skin;
  return true;
}

export function awardEquipment(state, won, difficulty) {
  state.matches = integer(state.matches + 1);
  if (won) state.wins = integer(state.wins + 1);
  const gold = won ? ({ easy: 18, normal: 25, hard: 34 }[difficulty] ?? 25) : 5;
  const material = won ? 3 : 1;
  const winsToUnlock = [1, 3, 9, 17];
  const item = won && stockSize(state) < inventoryLimit ? Object.values(catalog).filter(entry => !state.inventory[entry.id]
    && state.wins >= winsToUnlock[entry.tier]).sort((a, b) => b.tier - a.tier)[0] : undefined;
  if (item) state.inventory[item.id] = 1;
  state.gold = integer(state.gold + gold);
  state.material = integer(state.material + material);
  return { gold, material, item };
}

export function equipFighter(fighter, state, id, pve, armed = pve) {
  const loadout = validLoadout(state.inventory, state.loadouts[id], id, state);
  const cosmetic = gearItem(state, Object.values(loadout)[0]);
  fighter.equipmentColor = sets[cosmetic?.set]?.color;
  fighter.skinFilter = skins[state.activeSkins[id]]?.filter;
  if (pve) fighter.equipmentBase = { loadout, state, moveSpeed: fighter.moveSpeed };
  const weaponId = loadout.weapon ?? fighter.starterWeapon;
  setMainWeapon(fighter, armed ? modelForWeapon(id, weaponId, state.inventory[weaponId], state) : null, true);
  fighter.shieldHp = fighter.equipmentStats?.shield ?? 0;
}

export function modelForWeapon(fighterId, itemId, level = 1, state) {
  const item = gearItem(state, itemId);
  if (item?.slot !== 'weapon' || !canEquip(fighterId, item)) return null;
  const critical = { blade: 17, spear: 13, hammer: 10, staff: 12, pan: 8, gauntlet: 19 }[item.weaponType];
  return { ...weaponTypes[item.weaponType], itemId, level, weaponType: item.weaponType, label: item.name, color: sets[item.set].color,
    perk: item.perk, critChance: critical + item.tier * 2 + (item.perk === 'edge' ? 8 : 0) };
}

export function setMainWeapon(fighter, weapon, heal = false) {
  fighter.weapon = weapon;
  const base = fighter.equipmentBase;
  if (!base) return;
  const inventory = weapon ? { ...base.state.inventory, [weapon.itemId]: weapon.level } : base.state.inventory;
  const { stats } = equipmentStats({ ...base.state, inventory }, { ...base.loadout, weapon: weapon?.itemId });
  const bonusDelta = stats.hp - (fighter.equipmentStats?.hp ?? 0);
  fighter.equipmentStats = stats;
  fighter.maxHp += bonusDelta;
  fighter.baseHp += bonusDelta;
  fighter.hp = Math.min(fighter.maxHp, fighter.hp + (heal ? bonusDelta : 0));
  fighter.moveSpeed = base.moveSpeed * (1 + stats.speed / 100);
}

export function reviveFighter(fighter, revivedSlots) {
  if (fighter.hp > 0 || !fighter.equipmentStats?.revive || revivedSlots.has(fighter.matchSlot)) return false;
  revivedSlots.add(fighter.matchSlot);
  fighter.hp = Math.ceil(fighter.maxHp * .28);
  fighter.knockdown = fighter.hitstun = fighter.freezeFrames = fighter.guardBreak = fighter.poisonFrames = 0;
  fighter.knockdownOnLanding = false;
  fighter.stageCondition = null;
  fighter.attack = fighter.dash = null;
  fighter.knockVelocity = 0;
  fighter.escapeProtection = 42;
  return true;
}
