import { catalog, equipmentStats, maxLevel, rarities, saveEquipment, sets, slots, statNames,
  upgradeCost, upgradeEquipment, validLoadout } from '../game/equipment.js';

const byId = id => document.getElementById('equipment-' + id);
const itemIcons = { weapon: '⚔', armor: '⛨', ring: '◈', charm: '✦' };
const itemImages = {
  weapon: '/assets/effects/party-sword.png',
  armor: '/assets/effects/party-shield.png',
};

function tile(slot, entry, label, detail, selected) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'equipment-tile';
  button.dataset.tier = entry?.tier ?? '';
  button.setAttribute('aria-pressed', String(selected));
  const icon = document.createElement(entry && itemImages[slot] ? 'img' : 'span');
  icon.className = 'equipment-icon';
  icon.setAttribute('aria-hidden', 'true');
  if (icon.tagName === 'IMG') {
    icon.alt = '';
    icon.draggable = false;
    icon.src = slot === 'weapon' && entry.set === 'tide' ? '/assets/effects/fox-spear.png' : itemImages[slot];
  } else icon.textContent = itemIcons[slot];
  const name = document.createElement('strong');
  name.textContent = label;
  const sub = document.createElement('small');
  sub.textContent = detail;
  button.append(icon, name, sub);
  return button;
}

export function createEquipmentPanel(characters, state) {
  const fighter = byId('fighter');
  const item = byId('item');
  const worn = byId('worn');
  const portrait = byId('portrait');
  const equip = byId('equip');
  const upgrade = byId('upgrade');
  const notice = byId('notice');
  for (const [id, character] of Object.entries(characters)) fighter.add(new Option(character.name, id));
  let slot = 'weapon';
  let selected = '';
  let draggedItem = null;
  const currentLoadout = () => validLoadout(state.inventory, state.loadouts[fighter.value]);
  const itemLabel = id => catalog[id].name + ' · ' + rarities[catalog[id].tier] + ' · +' + (state.inventory[id] - 1);

  function applySelection() {
    if ((currentLoadout()[slot] ?? '') === selected) return;
    state.loadouts[fighter.value] = validLoadout(state.inventory, { ...currentLoadout(), [slot]: selected });
    const saved = saveEquipment(state);
    render();
    notice.textContent = saved ? 'Đã lưu bộ trang bị.' : 'Trang bị chỉ được lưu trong phiên này.';
    item.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
  }

  function renderTiles(loadout) {
    const active = document.activeElement;
    const focused = worn.contains(active) || item.contains(active) ? active.dataset.gearFocus : null;
    worn.replaceChildren();
    item.replaceChildren();
    for (const [id, label] of Object.entries(slots)) {
      const entry = catalog[loadout[id]];
      const button = tile(id, entry, label, entry?.name ?? 'Ô trống', id === slot);
      button.dataset.gearFocus = 'slot-' + id;
      button.addEventListener('click', () => {
        slot = id;
        refresh();
      });
      const acceptsDrop = () => draggedItem?.fighterId === fighter.value && catalog[draggedItem.id]?.slot === id;
      button.addEventListener('dragover', event => {
        if (!acceptsDrop()) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        button.classList.add('equipment-drop-target');
      });
      button.addEventListener('dragleave', event => {
        if (!button.contains(event.relatedTarget)) button.classList.remove('equipment-drop-target');
      });
      button.addEventListener('drop', event => {
        if (!acceptsDrop()) return;
        event.preventDefault();
        slot = id;
        selected = draggedItem.id;
        draggedItem = null;
        button.classList.remove('equipment-drop-target');
        applySelection();
      });
      worn.append(button);
    }
    const items = Object.values(catalog)
      .filter(entry => entry.slot === slot && state.inventory[entry.id])
      .sort((a, b) => b.tier - a.tier);
    for (const entry of [...items, null]) {
      const id = entry?.id ?? '';
      const detail = entry ? (loadout[slot] === id ? 'Đang mặc · ' : '') + '+' + (state.inventory[id] - 1) : 'Tháo trang bị';
      const button = tile(slot, entry, entry?.name ?? 'Ô trống', detail, selected === id);
      button.dataset.gearFocus = 'item-' + id;
      if (entry) {
        button.draggable = true;
        button.addEventListener('dragstart', event => {
          if (!event.dataTransfer) return;
          draggedItem = { id, fighterId: fighter.value };
          event.dataTransfer.setData('text/plain', entry.name);
          event.dataTransfer.effectAllowed = 'copy';
        });
        button.addEventListener('dragend', () => {
          draggedItem = null;
          for (const target of worn.children) target.classList.remove('equipment-drop-target');
        });
      }
      button.addEventListener('click', () => {
        selected = id;
        notice.textContent = '';
        render();
      });
      item.append(button);
    }
    if (focused) [...worn.children, ...item.children].find(button => button.dataset.gearFocus === focused)
      ?.focus({ preventScroll: true });
  }

  function render() {
    const loadout = currentLoadout();
    renderTiles(loadout);
    const next = { ...loadout, [slot]: selected };
    const current = equipmentStats(state, loadout);
    const after = equipmentStats(state, next);
    const candidate = catalog[selected];
    const level = state.inventory[selected] ?? 0;
    const canUpgrade = Boolean(candidate) && level < maxLevel;
    const cost = canUpgrade ? upgradeCost(candidate, level) : null;
    const improved = canUpgrade
      ? equipmentStats({ inventory: { ...state.inventory, [selected]: level + 1 } }, next).stats : null;
    byId('wallet').textContent = state.gold + ' vàng · ' + state.material + ' nguyên liệu · ' + state.wins + ' trận thắng';
    byId('inventory-title').textContent = 'Kho · ' + slots[slot];
    byId('selection').textContent = candidate?.name ?? 'Ô ' + slots[slot].toLowerCase() + ' trống';
    byId('rarity').textContent = candidate ? rarities[candidate.tier] + ' · +' + (level - 1) : '';
    byId('rarity').dataset.tier = candidate?.tier ?? '';
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
      const values = [current.stats[stat], after.stats[stat], improved?.[stat]];
      for (const [index, value] of values.entries()) {
        const cell = document.createElement('td');
        cell.textContent = value === undefined ? '—' : '+' + value + (stat === 'hp' ? '' : '%');
        if (index > 0 && value !== undefined) {
          if (value > values[index - 1]) cell.className = 'equipment-gain';
          if (value < values[index - 1]) cell.className = 'equipment-loss';
        }
        row.append(cell);
      }
      table.append(row);
    }
    equip.disabled = (loadout[slot] ?? '') === selected;
    equip.textContent = selected ? 'Trang bị' : 'Tháo';
    upgrade.disabled = !cost || cost.gold > state.gold || cost.material > state.material;
    upgrade.textContent = cost ? 'Nâng cấp · ' + cost.gold + ' vàng, ' + cost.material + ' NL'
      : candidate ? 'Đã tối đa +4' : 'Nâng cấp';
  }

  function refresh() {
    notice.textContent = '';
    selected = currentLoadout()[slot] ?? '';
    portrait.src = '/assets/characters/' + fighter.value + '/avatar.png';
    render();
  }
  fighter.addEventListener('change', () => refresh());
  equip.addEventListener('click', applySelection);
  upgrade.addEventListener('click', () => {
    if (!upgradeEquipment(state, selected)) return;
    const saved = saveEquipment(state);
    render();
    notice.textContent = saved ? 'Đã nâng ' + itemLabel(selected) + '.' : 'Nâng cấp chỉ được lưu trong phiên này.';
    if (upgrade.disabled) item.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
  });
  return () => refresh();
}
