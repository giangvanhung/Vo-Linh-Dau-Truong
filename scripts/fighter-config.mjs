import { readFile } from 'node:fs/promises';

async function readConfig(path) {
  const file = new URL('../data/' + path, import.meta.url);
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function loadFighterConfig() {
  const [roster, { stage, stages }, combat] = await Promise.all([
    readConfig('roster.json'),
    readConfig('stages.json'),
    readConfig('combat.json'),
  ]);
  const entries = await Promise.all(roster.map(async id => [id, await readConfig(`characters/${id}.json`)]));
  return { stage, characters: Object.fromEntries(entries), combat, stages };
}
