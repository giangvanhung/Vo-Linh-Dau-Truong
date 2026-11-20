import { catalog, equipmentStats, maxLevel, rarities, saveEquipment, sets, slots, statNames,
  upgradeCost, upgradeEquipment, validLoadout } from '../game/equipment.js';

const byId = id => document.getElementById('equipment-' + id);

export function createEquipmentPanel(characters, state) {
  const fighter = byId('fighter');
  const slot = byId('slot');
  const item = byId('item');
  const equip = byId('equip');
  const upgrade = byId('upgrade');
  const notice = byId('notice');
  for (const [id, character] of Object.entries(characters)) fighter.add(new Option(character.name, id));
  for (const [id, label] of Object.entries(slots)) slot.add(new Option(label, id));
  const currentLoadout = () => validLoadout(state.inventory, state.loadouts[fighter.value]);
  const itemLabel = id => catalog[id].name + ' · ' + rarities[catalog[id].tier] + ' · +' + (state.inventory[id] - 1);

  function fillItems(selected = currentLoadout()[slot.value] ?? '') {
    item.options.length = 0;
    item.add(new Option('Để trống', ''));
    for (const [id, entry] of Object.entries(catalog)) {
      if (entry.slot === slot.value && state.inventory[id]) item.add(new Option(itemLabel(id), id));
    }
    item.value = selected;
  }

  function render() {
    const loadout = currentLoadout();
    const next = { ...loadout, [slot.value]: item.value };
    const current = equipmentStats(state, loadout);
    const after = equipmentStats(state, next);
    const candidate = catalog[item.value];
    const level = state.inventory[item.value] ?? 0;
    const canUpgrade = Boolean(candidate) && level < maxLevel;
    const cost = canUpgrade ? upgradeCost(candidate, level) : null;
    const improved = canUpgrade
      ? equipmentStats({ inventory: { ...state.inventory, [item.value]: level + 1 } }, next).stats : null;
    byId('wallet').textContent = state.gold + ' gold · ' + state.material + ' nguyên liệu · ' + state.wins + ' trận thắng PvE';
    byId('worn').textContent = Object.entries(slots).map(([id, label]) =>
      label + ' ' + (loadout[id] ? itemLabel(loadout[id]) : 'trống')).join(' / ');
    const setLabel = counts => Object.entries(sets).map(([id, set]) => {
      const count = counts[id];
      return set.name + ' ' + count + '/4' + (count >= 4 ? ' (mốc 2 + 4)' : count >= 2 ? ' (mốc 2)' : '');
    }).join(' · ');
    const setBefore = setLabel(current.counts);
    const setAfter = setLabel(after.counts);
    byId('sets').textContent = setBefore === setAfter ? setBefore : setBefore + ' → ' + setAfter;
    const table = byId('stats');
    table.textContent = '';
    for (const [stat, label] of Object.entries(statNames)) {
      const row = document.createElement('tr');
      const heading = document.createElement('th');
      heading.scope = 'row';
      heading.textContent = label;
      row.append(heading);
      for (const value of [current.stats[stat], after.stats[stat], improved?.[stat]]) {
        const cell = document.createElement('td');
        cell.textContent = value === undefined ? '—' : '+' + value + (stat === 'hp' ? '' : '%');
        row.append(cell);
      }
      table.append(row);
    }
    equip.disabled = (loadout[slot.value] ?? '') === item.value;
    equip.textContent = item.value ? 'Trang bị' : 'Tháo';
    upgrade.disabled = !cost || cost.gold > state.gold || cost.material > state.material;
    upgrade.textContent = cost ? 'Nâng cấp · ' + cost.gold + ' gold, ' + cost.material + ' NL'
      : candidate ? 'Đã tối đa +4' : 'Nâng cấp';
  }

  function refresh(selected) {
    notice.textContent = '';
    fillItems(selected);
    render();
  }
  fighter.addEventListener('change', () => refresh());
  slot.addEventListener('change', () => refresh());
  item.addEventListener('change', () => { notice.textContent = ''; render(); });
  equip.addEventListener('click', () => {
    state.loadouts[fighter.value] = validLoadout(state.inventory, { ...currentLoadout(), [slot.value]: item.value });
    const saved = saveEquipment(state);
    render();
    notice.textContent = saved ? 'Đã lưu bộ trang bị.' : 'Trang bị chỉ được lưu trong phiên này.';
  });
  upgrade.addEventListener('click', () => {
    const selected = item.value;
    if (!upgradeEquipment(state, selected)) return;
    const saved = saveEquipment(state);
    refresh(selected);
    notice.textContent = saved ? 'Đã nâng ' + itemLabel(selected) + '.' : 'Nâng cấp chỉ được lưu trong phiên này.';
  });
  return () => refresh();
}
