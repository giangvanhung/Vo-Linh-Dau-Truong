import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Fighter } from '../src/combat/fighter.js';
import { availableStage, campaignProgress, claimReserved, settleStage } from '../src/game/campaign.js';
import { buyMarketItem, catalog, equipFighter, inventoryLimit, loadEquipment, saveEquipment, upgradeEquipment, validLoadout } from '../src/game/equipment.js';
import { loadFighterConfig } from './fighter-config.mjs';

const config = await loadFighterConfig();
const route = config.campaign;
function profile(initial) {
  let data = initial && JSON.stringify(initial);
  const storage = { getItem: () => data, setItem: (_, value) => { data = value; } };
  return { load: () => loadEquipment(storage), save: next => saveEquipment(next, storage) };
}

test('new profile can lose, retry, equip and clear all six stages with one reward per result', () => {
  const disk = profile();
  let state = disk.load();
  assert.equal(route.length, 6);
  const progress = () => campaignProgress(state, route);
  const clear = (index, serial, won = true) => settleStage(state, route, { index, serial, won }, disk.save);
  assert.equal(availableStage(route, progress(), 1), false);
  assert.equal(clear(1, 1), null);
  assert.equal(clear(0, 1, false).gold, 0);
  assert.equal(clear(0, 2).item, route[0].first.item);
  assert.equal(clear(0, 2), null);
  state = disk.load();
  assert.equal(availableStage(route, progress(), 1), true);
  assert.equal(clear(0, 2), null);
  assert.equal(clear(0, 3).gold, route[0].replay.gold);
  state.loadouts.hung.armor = route[0].first.item;
  assert(upgradeEquipment(state, route[0].first.item));
  assert(disk.save(state));
  state = disk.load();
  const fighter = new Fighter(config.characters.hung, 0, 1, config.combat);
  fighter.characterId = 'hung';
  const baseHp = fighter.maxHp;
  equipFighter(fighter, state, 'hung', true);
  assert(fighter.maxHp > baseHp);
  for (let i = 1; i < route.length; i++) assert(clear(i, i + 3).saved);
  state = disk.load();
  assert.equal(route.filter(({ id }) => progress().results[id]?.wins).length, 6);
  assert.deepEqual(progress().results[route[0].id], { wins: 2, losses: 1 });
  assert.equal(state.matches, 0);
});

test('full inventory retains the entitlement and a failed write changes no balance or progress', () => {
  const disk = profile({ version: 3, gold: 112, material: 3,
    inventory: Object.fromEntries(Object.keys(catalog).filter(id => id !== route[0].first.item)
      .slice(0, inventoryLimit).map(id => [id, 1])) });
  let state = disk.load();
  const snapshot = JSON.stringify(state);
  const result = { index: 0, serial: 1, won: true };
  assert.deepEqual(settleStage(state, route, result, () => false), { saved: false });
  assert.equal(JSON.stringify(state), snapshot);
  assert(settleStage(state, route, result, disk.save).reserved);
  state = disk.load();
  assert.equal(campaignProgress(state, route).pending.length, 1);
  assert.equal(claimReserved(state, route, disk.save).received, 0);
  delete state.inventory[Object.keys(state.inventory)[0]];
  assert.deepEqual(claimReserved(state, route, () => false), { received: 0, failed: true });
  assert.equal(claimReserved(state, route, disk.save).received, 1);
  state = disk.load();
  assert.equal(state.inventory[route[0].first.item], 1);
  assert.equal(claimReserved(state, route, disk.save).received, 0);
});

test('old equipment, balance, rolls and skins survive recording progress', () => {
  const id = route[0].first.item;
  const old = { version: 3, gold: 543, material: 11, inventory: { [id]: 3, 'm-1-1': 2 },
    rolled: { 'm-1-1': { id: 'm-1-1', baseId: 'dawn-ring-0', quality: 99 } },
    loadouts: { hung: { armor: id, ring: 'm-1-1' } }, skinsOwned: { hung: ['jade'] }, activeSkins: { hung: 'jade' } };
  const disk = profile(old);
  const state = disk.load();
  assert.equal(settleStage(state, route, { index: 0, serial: 1, won: true }, disk.save).gold,
    route[0].first.gold + route[0].first.duplicateGold);
  const reloaded = disk.load();
  assert.deepEqual(reloaded.inventory, old.inventory);
  assert.deepEqual(reloaded.loadouts.hung, old.loadouts.hung);
  assert.equal(reloaded.activeSkins.hung, 'jade');
});

test('shop rejection preserves wallet and bag, and loadout validates compatibility', () => {
  const disk = profile();
  const state = disk.load();
  state.market.offers = [
    { id: 'm-1-1', baseId: 'dawn-ring-0', quality: 100 },
    { id: 'm-1-2', baseId: 'tide-weapon-0', quality: 100 },
  ];
  const cash = state.gold;
  assert(buyMarketItem(state, 'm-1-1', 'hung'));
  assert(state.gold < cash);
  assert.equal(state.inventory['m-1-1'], 1);
  assert.deepEqual(validLoadout(state.inventory, { ring: 'm-1-1', weapon: 'tide-weapon-0' }, 'hung', state), { ring: 'm-1-1' });
  const snapshot = JSON.stringify(state);
  assert(!buyMarketItem(state, 'm-1-2', 'hung'));
  assert.equal(JSON.stringify(state), snapshot);
  state.gold = 0;
  assert(!upgradeEquipment(state, 'm-1-1'));
  assert.equal(state.inventory['m-1-1'], 1);
});
