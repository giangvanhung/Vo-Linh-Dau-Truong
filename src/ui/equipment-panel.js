import { buyMarketItem, buySkin, canEquip, canSellItem, dailyRefreshLimit, equipmentStats, gearItem, inventoryLimit,
  maxLevel, modelForWeapon, prepareMarket, rarities, refreshMarket, refreshPrice, sampleWeaponFor, saveEquipment, selectSkin, sellItem, sets,
  skins, slots, statNames, stockSize, upgradeCost, upgradeEquipment, validLoadout, weaponPerks, weaponPrice,
  weaponTypeFor, weaponTypes } from '../game/equipment.js';
import { createWeaponPreview } from '../render/weapon-preview.js';

const byId = id => document.getElementById('equipment-' + id);
const pageSize = 4;
const itemIcons = { weapon: '⚔', armor: '⛨', pants: 'Ⅱ', helmet: '⌂', boots: '↟', ring: '◈', charm: '✦', skin: '✧' };
const itemImages = {
  armor: '/assets/effects/party-shield.png',
};

function tile(slot, entry, label, detail, selected) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'equipment-tile';
  button.dataset.tier = entry?.tier ?? '';
  button.setAttribute('aria-pressed', String(selected));
  const image = entry && (slot === 'weapon' ? weaponTypes[entry.weaponType]?.image : itemImages[slot]);
  const icon = document.createElement(image ? 'img' : 'span');
  icon.className = 'equipment-icon';
  icon.setAttribute('aria-hidden', 'true');
  if (icon.tagName === 'IMG') {
    icon.alt = '';
    icon.draggable = false;
    icon.src = image;
  } else icon.textContent = itemIcons[slot];
  const name = document.createElement('strong');
  name.textContent = label;
  const sub = document.createElement('small');
  sub.textContent = detail;
  button.append(icon, name, sub);
  return button;
}

export function createEquipmentPanel(characters, state, combat) {
  const fighter = byId('fighter');
  const item = byId('item');
  const worn = byId('worn');
  const portrait = byId('portrait');
  const equip = byId('equip');
  const upgrade = byId('upgrade');
  const buy = byId('buy');
  const sell = byId('sell');
  const notice = byId('notice');
  const preview = createWeaponPreview(byId('preview'), byId('panel'), characters, combat, state);
  const filterSlot = byId('filter-slot');
  const filterTier = byId('filter-tier');
  const panel = byId('panel');
  const pagination = byId('pagination');
  const pagePicker = byId('page');
  const previousPage = byId('page-prev');
  const nextPage = byId('page-next');
  const viewButtons = [...panel.querySelectorAll('[data-equipment-view]')];
  let page = 0;

  function selectView(view) {
    panel.dataset.view = view;
    for (const button of viewButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.equipmentView === view));
    }
  }
  for (const button of viewButtons) {
    button.addEventListener('click', () => selectView(button.dataset.equipmentView));
  }

  function turnPage(index) {
    const active = document.activeElement;
    page = index;
    render();
    if ((active === previousPage && previousPage.disabled) || (active === nextPage && nextPage.disabled)) {
      pagePicker.focus({ preventScroll: true });
    }
  }
  previousPage.addEventListener('click', () => turnPage(page - 1));
  nextPage.addEventListener('click', () => turnPage(page + 1));
  pagePicker.addEventListener('change', () => turnPage(Number(pagePicker.value)));
  for (const [id, character] of Object.entries(characters)) fighter.add(new Option(character.name, id));
  for (const [id, label] of Object.entries(slots)) filterSlot.add(new Option(label, id));
  for (const [tier, label] of rarities.entries()) filterTier.add(new Option(label, tier));
  let slot = 'weapon';
  let selected = '';
  let draggedItem = null;
  let shop = false;
  let skinMode = false;
  let compatibleOnly = true;
  let previewWeaponId;
  const previewMode = byId('preview-mode');
  const entryFor = id => gearItem(state, id);
  const currentLoadout = () => validLoadout(state.inventory, state.loadouts[fighter.value], fighter.value, state);
  const itemLabel = id => entryFor(id).name + ' · ' + rarities[entryFor(id).tier] + ' · +' + (state.inventory[id] - 1);
  const skinOwned = id => id === 'original' || Boolean(state.skinsOwned[fighter.value]?.includes(id));

  function choices() {
    if (shop) return state.market.offers.map(offer => entryFor(offer.id)).filter(entry =>
      (!filterSlot.value || entry.slot === filterSlot.value)
      && (!filterTier.value || entry.tier === Number(filterTier.value))
      && (!compatibleOnly || canEquip(fighter.value, entry)));
    return Object.keys(state.inventory).map(entryFor).filter(entry =>
      entry?.slot === slot && canEquip(fighter.value, entry)).sort((a, b) => b.tier - a.tier);
  }

  function pageItems(entries) {
    const total = Math.max(1, Math.ceil(entries.length / pageSize));
    page = Math.min(Math.max(0, page), total - 1);
    if (pagePicker.options.length !== total) {
      pagePicker.replaceChildren(...Array.from({ length: total }, (_, index) => new Option(index + 1, index)));
    }
    pagePicker.value = String(page);
    byId('page-count').textContent = '/ ' + total;
    previousPage.disabled = page === 0;
    nextPage.disabled = page === total - 1;
    pagination.hidden = total === 1;
    return entries.slice(page * pageSize, (page + 1) * pageSize);
  }

  function inspect(id) {
    selected = id;
    notice.textContent = '';
    if (viewButtons[0].getClientRects().length) {
      selectView('details');
      viewButtons.find(button => button.dataset.equipmentView === 'details').focus({ preventScroll: true });
    }
    render();
  }

  function applySelection() {
    if ((currentLoadout()[slot] ?? '') === selected) return;
    if (selected && !canEquip(fighter.value, entryFor(selected))) return;
    state.loadouts[fighter.value] = validLoadout(state.inventory, { ...currentLoadout(), [slot]: selected }, fighter.value, state);
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
      const entry = entryFor(loadout[id]);
      const button = tile(id, entry, label, entry?.name ?? 'Ô trống', id === slot);
      button.dataset.gearFocus = 'slot-' + id;
      button.addEventListener('click', () => {
        shop = skinMode = false;
        slot = id;
        refresh();
        selectView('list');
        if (!worn.getClientRects().length) {
          (item.querySelector('[aria-pressed="true"]') ?? item.querySelector('button'))?.focus({ preventScroll: true });
        }
      });
      const acceptsDrop = () => draggedItem?.fighterId === fighter.value && entryFor(draggedItem.id)?.slot === id
        && canEquip(fighter.value, entryFor(draggedItem.id));
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
        shop = skinMode = false;
        slot = id;
        selected = draggedItem.id;
        draggedItem = null;
        button.classList.remove('equipment-drop-target');
        applySelection();
      });
      worn.append(button);
    }
    if (skinMode) {
      for (const [id, skin] of pageItems(Object.entries(skins))) {
        const button = tile('skin', null, skin.name, (state.activeSkins[fighter.value] ?? 'original') === id
          ? 'Đang dùng' : skinOwned(id) ? 'Đã sở hữu' : skin.price + ' vàng', selected === id);
        button.dataset.gearFocus = 'skin-' + id;
        button.querySelector('.equipment-icon').style.filter = skin.filter;
        button.addEventListener('click', () => inspect(id));
        item.append(button);
      }
      if (focused) [...item.children].find(button => button.dataset.gearFocus === focused)?.focus({ preventScroll: true });
      return;
    }
    const items = choices();
    if (shop && !items.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Không có mặt hàng khớp bộ lọc.';
      item.append(empty);
    }
    for (const entry of pageItems(shop ? items : [null, ...items])) {
      const id = entry?.id ?? '';
      const level = state.inventory[id];
      const detail = !entry ? 'Tháo trang bị' : shop
        ? rarities[entry.tier] + ' · ' + weaponPrice(entry).buy + ' vàng'
        : (loadout[slot] === id ? 'Đang mặc · ' : '') + '+' + (level - 1);
      const button = tile(entry?.slot ?? slot, entry, entry?.name ?? 'Ô trống', detail, selected === id);
      button.dataset.gearFocus = 'item-' + id;
      if (entry && !shop) {
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
      button.addEventListener('click', () => inspect(id));
      item.append(button);
    }
    if (focused) [...worn.children, ...item.children].find(button => button.dataset.gearFocus === focused)
      ?.focus({ preventScroll: true });
  }

  function render() {
    panel.dataset.shop = String(shop || skinMode);
    const loadout = currentLoadout();
    renderTiles(loadout);
    const candidate = !skinMode && entryFor(selected);
    const skin = skinMode ? skins[selected] : null;
    const previewState = shop && candidate && !state.inventory[selected]
      ? { ...state, inventory: { ...state.inventory, [selected]: 1 } } : state;
    const eligible = canEquip(fighter.value, candidate);
    const next = skinMode || (shop && !eligible) ? loadout : { ...loadout, [candidate?.slot ?? slot]: selected };
    previewWeaponId = next.weapon;
    showPreview();
    const current = equipmentStats(state, loadout);
    const after = equipmentStats(previewState, next);
    const level = state.inventory[selected] ?? 0;
    const canUpgrade = Boolean(candidate) && level > 0 && level < maxLevel && !shop && !skinMode;
    const cost = canUpgrade ? upgradeCost(candidate, level) : null;
    const improved = canUpgrade
      ? equipmentStats({ ...state, inventory: { ...state.inventory, [selected]: level + 1 } }, next).stats : null;
    const count = stockSize(state);
    byId('wallet').textContent = state.gold + ' vàng · ' + state.material + ' nguyên liệu · Kho ' + count + '/' + inventoryLimit;
    byId('inventory-title').textContent = skinMode ? 'Skin võ sĩ' : shop ? 'Hàng hôm nay' : 'Kho · ' + slots[slot];
    byId('inventory-tab').setAttribute('aria-pressed', String(!shop && !skinMode));
    byId('shop-tab').setAttribute('aria-pressed', String(shop));
    byId('skins-tab').setAttribute('aria-pressed', String(skinMode));
    byId('filters').hidden = !shop;
    byId('filter').setAttribute('aria-pressed', String(compatibleOnly));
    byId('refresh').textContent = 'Đổi hàng · ' + refreshPrice + ' vàng';
    byId('refresh').disabled = state.gold < refreshPrice || state.market.refreshes >= dailyRefreshLimit;
    byId('refresh-status').textContent = (dailyRefreshLimit - state.market.refreshes) + '/' + dailyRefreshLimit + ' lượt đổi hôm nay';
    byId('class').textContent = 'Vũ khí tương thích · ' + (weaponTypes[weaponTypeFor(fighter.value)]?.name ?? '—');
    byId('selection').textContent = skin?.name ?? candidate?.name ?? (shop ? 'Chọn một mặt hàng' : 'Ô ' + slots[slot].toLowerCase() + ' trống');
    byId('rarity').textContent = candidate ? [rarities[candidate.tier], level ? '+' + (level - 1) : '',
      candidate.quality ? 'Chất lượng ' + candidate.quality + '%' : ''].filter(Boolean).join(' · ') : '';
    byId('rarity').dataset.tier = candidate?.tier ?? '';
    const weapon = modelForWeapon(fighter.value, candidate?.id, level, state);
    const perk = weaponPerks[candidate?.perk];
    byId('perk').textContent = [
      skinMode ? 'Ngoại hình cho ' + characters[fighter.value].name : '',
      shop && candidate && !eligible ? 'Cần võ sĩ dùng ' + weaponTypes[candidate.weaponType]?.name : '',
      weapon ? 'Chí mạng gốc ' + weapon.critChance + '%' : '',
      perk ? perk.name + ' · ' + perk.description : '',
    ].filter(Boolean).join(' · ');
    byId('stat-details').hidden = skinMode;
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
        const flatStat = ['hp', 'shield', 'regenHp', 'regenMana', 'revive'].includes(stat);
        cell.textContent = value === undefined ? '—' : '+' + value + (flatStat ? '' : '%');
        if (index > 0 && value !== undefined) {
          if (value > values[index - 1]) cell.className = 'equipment-gain';
          if (value < values[index - 1]) cell.className = 'equipment-loss';
        }
        row.append(cell);
      }
      table.append(row);
    }
    equip.disabled = skinMode ? (state.activeSkins[fighter.value] ?? 'original') === selected : (loadout[slot] ?? '') === selected;
    equip.hidden = shop || (skinMode && !skinOwned(selected));
    upgrade.hidden = shop || skinMode;
    buy.hidden = skinMode ? skinOwned(selected) : !shop || !candidate;
    sell.hidden = shop || skinMode || !candidate || level === 0;
    const price = candidate ? weaponPrice(candidate, level) : null;
    buy.disabled = skinMode ? !skin || state.gold < skin.price : !price || !eligible || count >= inventoryLimit || state.gold < price.buy;
    sell.disabled = !canSellItem(state, selected);
    buy.textContent = skinMode ? 'Mua skin · ' + skin?.price + ' vàng'
      : count >= inventoryLimit ? 'Kho đã đầy' : price ? 'Mua · ' + price.buy + ' vàng' : 'Mua';
    sell.textContent = sell.disabled ? 'Tháo trước khi bán' : 'Bán · ' + price?.sell + ' vàng';
    equip.textContent = skinMode ? (equip.disabled ? 'Đang dùng skin' : 'Dùng skin')
      : selected ? (equip.disabled ? 'Đã trang bị' : 'Trang bị') : 'Tháo trang bị';
    upgrade.disabled = !cost || cost.gold > state.gold || cost.material > state.material;
    upgrade.textContent = cost ? 'Nâng cấp · ' + cost.gold + ' vàng, ' + cost.material + ' NL'
      : candidate ? 'Đã tối đa +4' : 'Nâng cấp';
    byId('action-item').textContent = byId('selection').textContent;
    let hint = '';
    if (!buy.hidden && buy.disabled) {
      if (!skinMode && !eligible) hint = 'Võ sĩ hiện tại không dùng được món này.';
      else if (!skinMode && count >= inventoryLimit) hint = 'Kho đầy. Hãy bán bớt vật phẩm.';
      else if (skinMode ? skin : price) hint = 'Thiếu vàng để mua.';
    } else if (!upgrade.hidden && cost && upgrade.disabled) {
      const missing = [];
      if (cost.gold > state.gold) missing.push((cost.gold - state.gold) + ' vàng');
      if (cost.material > state.material) missing.push((cost.material - state.material) + ' nguyên liệu');
      hint = 'Cần thêm ' + missing.join(' và ') + ' để nâng cấp.';
    } else if (!shop && !skinMode && !candidate) {
      hint = 'Chọn ô và vật phẩm trong kho.';
    }
    byId('action-hint').textContent = hint;
  }

  function refresh() {
    notice.textContent = '';
    if (shop && prepareMarket(state)) saveEquipment(state);
    selected = skinMode ? state.activeSkins[fighter.value] ?? 'original' : shop ? choices()[0]?.id ?? '' : currentLoadout()[slot] ?? '';
    portrait.src = '/assets/characters/' + fighter.value + '/avatar.png';
    const selectedIndex = skinMode ? Object.keys(skins).indexOf(selected) : !shop && selected
      ? choices().findIndex(entry => entry.id === selected) + 1 : 0;
    page = Math.floor(Math.max(0, selectedIndex) / pageSize);
    render();
  }
  fighter.addEventListener('change', () => refresh());
  function showPreview() {
    const mode = previewMode.value;
    const sample = mode === 'equipment' && !previewWeaponId ? sampleWeaponFor(fighter.value) : null;
    const itemId = mode === 'equipment' ? previewWeaponId ?? sample?.id : undefined;
    const pickup = mode === 'blaster' ? mode : undefined;
    preview.show(fighter.value, itemId, skinMode ? selected : state.activeSkins[fighter.value], pickup);
    const label = pickup ? 'Súng linh lực · Vật phẩm trong trận'
      : sample ? 'Vũ khí mẫu · ' + sample.name : entryFor(itemId)?.name ?? 'Tay không';
    byId('preview-label').textContent = label;
    byId('preview').setAttribute('aria-label', characters[fighter.value].name + ' · ' + label);
  }
  previewMode.addEventListener('change', showPreview);
  byId('preview-strike').addEventListener('click', () => preview.strike());
  byId('inventory-tab').addEventListener('click', () => { shop = skinMode = false; selectView('fighter'); refresh(); });
  byId('shop-tab').addEventListener('click', () => { shop = true; skinMode = false; selectView('list'); refresh(); });
  byId('skins-tab').addEventListener('click', () => { shop = false; skinMode = true; selectView('list'); refresh(); });
  byId('filter').addEventListener('click', () => { compatibleOnly = !compatibleOnly; refresh(); });
  filterSlot.addEventListener('change', refresh);
  filterTier.addEventListener('change', refresh);
  byId('refresh').addEventListener('click', () => {
    if (refreshMarket(state)) { refresh(); persist('Đã đổi hàng.'); }
  });
  function persist(message) {
    const saved = saveEquipment(state);
    notice.textContent = message + (saved ? '' : ' Đã cập nhật trong phiên này.');
  }
  buy.addEventListener('click', () => {
    if (shop && prepareMarket(state)) {
      refresh();
      persist('Đã lên hàng ngày mới. Chọn lại món bạn muốn mua.');
      return;
    }
    const name = skinMode ? skins[selected]?.name : entryFor(selected)?.name;
    if (skinMode ? !buySkin(state, fighter.value, selected) : !buyMarketItem(state, selected, fighter.value)) return;
    if (skinMode) selectSkin(state, fighter.value, selected);
    refresh();
    persist('Đã mua ' + name + '.');
    (item.querySelector('[aria-pressed="true"]') ?? byId('shop-tab')).focus();
  });
  sell.addEventListener('click', () => {
    const name = entryFor(selected)?.name;
    if (!sellItem(state, selected)) return;
    refresh();
    persist('Đã bán ' + name + '.');
    item.querySelector('[aria-pressed="true"]')?.focus();
  });
  equip.addEventListener('click', () => {
    if (!skinMode) return applySelection();
    if (selectSkin(state, fighter.value, selected)) { render(); persist('Đã dùng ' + skins[selected].name + '.'); }
  });
  upgrade.addEventListener('click', () => {
    if (!upgradeEquipment(state, selected)) return;
    const saved = saveEquipment(state);
    render();
    notice.textContent = saved ? 'Đã nâng ' + itemLabel(selected) + '.' : 'Nâng cấp chỉ được lưu trong phiên này.';
    if (upgrade.disabled) item.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
  });
  return fighterId => {
    if (fighterId && characters[fighterId]) {
      fighter.value = fighterId;
      fighter.dispatchEvent(new Event('change'));
    }
    selectView(shop || skinMode ? 'list' : 'fighter');
    refresh();
  };
}
