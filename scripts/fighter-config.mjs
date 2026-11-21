import { readFile } from 'node:fs/promises';
import { catalog } from '../src/game/equipment.js';

async function readConfig(path) {
  const file = new URL('../data/' + path, import.meta.url);
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function loadFighterConfig() {
  const [roster, { stage, stages }, combat, campaign] = await Promise.all([
    readConfig('roster.json'),
    readConfig('stages.json'),
    readConfig('combat.json'),
    readConfig('campaign.json'),
  ]);
  const entries = await Promise.all(roster.map(async id => [id, await readConfig(`characters/${id}.json`)]));
  const ids = new Set();
  const amount = value => Number.isSafeInteger(value) && value >= 0;
  if (!Array.isArray(campaign) || !campaign.length) throw new Error('Campaign requires at least one stage');
  for (const entry of campaign) {
    const { id, name, opponent, stage: arena, difficulty, bestOf, seconds, hazards, first, replay } = entry;
    if (!id || !name || ids.has(id) || !roster.includes(opponent) || !Object.hasOwn(stages, arena)
      || !['easy', 'normal', 'hard'].includes(difficulty) || ![1, 3, 5].includes(bestOf)
      || !amount(seconds) || seconds < 1 || typeof hazards !== 'boolean'
      || !Object.hasOwn(catalog, first?.item) || !amount(first?.duplicateGold)
      || ![first?.gold, first?.material, replay?.gold, replay?.material].every(amount)) {
      throw new Error('Invalid campaign stage: ' + id);
    }
    ids.add(id);
  }
  return { stage, characters: Object.fromEntries(entries), combat, stages, campaign };
}
