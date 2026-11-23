import { readFile } from 'node:fs/promises';
import { catalog } from '../src/game/equipment.js';

async function readConfig(path) {
  const file = new URL('../data/' + path, import.meta.url);
  return JSON.parse(await readFile(file, 'utf8'));
}

function standardNormals(character, hung) {
  const { hungKick: horizontal, forwardStepFrames, ...sideKick } = hung.attacks.heavy;
  const { hungKick: rising, ...launcher } = hung.attacks.kick;
  const { hungKick: low, ...lowKick } = hung.crouchAttacks.heavy;
  const { hungKick: sweep, ...lowSweep } = hung.crouchAttacks.kick;
  const { light } = character.attacks;
  return {
    ...character,
    aerialNormals: character.attacks,
    attacks: {
      ...character.attacks,
      light: { ...(light.label === hung.attacks.light.label ? light : hung.attacks.light), unarmed: true },
      heavy: { ...sideKick, kickStyle: 'side' },
      kick: { ...launcher, animation: 'kick', kickStyle: 'rise' },
    },
    crouchAttacks: {
      light: { ...hung.crouchAttacks.light, ...character.crouchAttacks?.light },
      heavy: { ...lowKick, animation: 'sweep', kickStyle: 'low' },
      kick: { ...lowSweep, ...character.crouchAttacks?.kick, kickStyle: 'sweep' },
    },
  };
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
  const characters = Object.fromEntries(entries);
  for (const id of roster) {
    if (id !== 'hung') characters[id] = standardNormals(characters[id], characters.hung);
  }
  return { stage, characters, combat, stages, campaign };
}
