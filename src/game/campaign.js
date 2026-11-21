import { catalog, inventoryLimit, saveEquipment, stockSize } from './equipment.js';

const count = value => Number.isSafeInteger(value) && value > 0 ? value : 0;
const credit = (balance, amount) => Math.min(999999, balance + amount);

export function campaignProgress(state, route) {
  const saved = state.campaign;
  const results = Object.fromEntries(route.flatMap(({ id }) => {
    const result = saved?.results?.[id];
    return result ? [[id, { wins: count(result.wins), losses: count(result.losses) }]] : [];
  }));
  const pending = (Array.isArray(saved?.pending) ? saved.pending : []).filter(entry =>
    entry && Object.hasOwn(catalog, entry.item) && route.some(stage =>
      stage.id === entry.stage && stage.first.item === entry.item));
  return { serial: count(saved?.serial), results, pending };
}

export function availableStage(route, progress, index) {
  return Boolean(route[index]) && route.slice(0, index).every(({ id }) => progress.results[id]?.wins > 0);
}

export function settleStage(state, route, { index, serial, won }, persist = saveEquipment) {
  const campaign = campaignProgress(state, route);
  if (serial !== campaign.serial + 1 || !availableStage(route, campaign, index)) return null;
  const stage = route[index];
  const result = campaign.results[stage.id] ?? { wins: 0, losses: 0 };
  const first = won && !result.wins;
  const reward = first ? stage.first : won ? stage.replay : { gold: 0, material: 0 };
  const draft = { ...state, inventory: { ...state.inventory }, campaign,
    gold: credit(state.gold, reward.gold), material: credit(state.material, reward.material) };
  let item = null, reserved = false;
  if (first && reward.item) {
    if (draft.inventory[reward.item]) draft.gold = credit(draft.gold, reward.duplicateGold);
    else if (stockSize(draft) < inventoryLimit) {
      item = reward.item;
      draft.inventory[item] = 1;
    } else {
      reserved = true;
      campaign.pending.push({ stage: stage.id, item: reward.item });
    }
  }
  campaign.serial = serial;
  campaign.results[stage.id] = { wins: result.wins + Number(won), losses: result.losses + Number(!won) };
  if (!persist(draft)) return { saved: false };
  const summary = { saved: true, first, item, reserved, gold: draft.gold - state.gold,
    material: draft.material - state.material };
  Object.assign(state, draft);
  return summary;
}

export function claimReserved(state, route, persist = saveEquipment) {
  const campaign = campaignProgress(state, route);
  if (!campaign.pending.length) return { received: 0 };
  const draft = { ...state, inventory: { ...state.inventory }, campaign };
  const remaining = [];
  for (const entry of campaign.pending) {
    const { first } = route.find(stage => stage.id === entry.stage);
    if (draft.inventory[entry.item]) draft.gold = credit(draft.gold, first.duplicateGold);
    else if (stockSize(draft) < inventoryLimit) draft.inventory[entry.item] = 1;
    else remaining.push(entry);
  }
  const received = campaign.pending.length - remaining.length;
  if (!received) return { received };
  campaign.pending = remaining;
  if (!persist(draft)) return { received: 0, failed: true };
  Object.assign(state, draft);
  return { received };
}
