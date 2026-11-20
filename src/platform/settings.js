import { defaultBindings, assignable } from './keyboard.js';

export const difficultyLabels = { easy: 'Dễ', normal: 'Thường', hard: 'Khó' };
export const musicChoices = {
  synthwave: { title: 'Synth Wave — Alex McCulloch', file: 'arena-synthwave.mp3' },
  midnight: { title: 'Midnight Drive — congusbongus', file: 'midnight-drive.ogg' },
  wrongTimes: { title: 'Wrong Times — Puppy & Dangrangto', link: 'https://www.youtube.com/watch?v=1MPKmdbUZcs' },
  earrings: { title: 'Earrings — Malcolm Todd', link: 'https://malcolmtodd.lnk.to/Earrings' },
  nheBuong: { title: 'Nhẹ Buông — Hằng ssi & Aries tis', link: 'https://open.spotify.com/album/73XwoxQIvQMy31ruwvDw7G' },
};
const legacyP2 = { j:'KeyZ', k:'KeyX', l:'KeyC', p:'KeyV', q:'KeyB', r:'KeyH', f:'BracketLeft', g:'BracketRight', u:'KeyN', i:'KeyM', o:'Comma', t:'Period' };
export const roundFormats = [3, 5, 7, 9];
const settingsKey = 'vo-linh-settings';

export function loadSettings() {
  const settings = { sound: true, music: 35, musicTrack: 'synthwave', effects: 65, difficulty: 'normal' };
  settings.roundFormats = {};
  settings.bindings = defaultBindings.map(keys => ({ ...keys }));
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey));
    if (Object.prototype.hasOwnProperty.call(musicChoices, saved?.musicTrack)) settings.musicTrack = saved.musicTrack;
    for (const mode of ['solo', 'versus', 'team', 'lan']) {
      const value = saved?.roundFormats?.[mode];
      if (roundFormats.includes(value)) settings.roundFormats[mode] = value;
    }
    if (Array.isArray(saved?.bindings)) {
      const candidate = defaultBindings.map((keys, side) => Object.fromEntries(Object.entries(keys).map(
        ([action, code]) => {
          const custom = saved.bindings[side]?.[action];
          const oldDefault = side === 1 && saved.bindingVersion !== 2 && custom === legacyP2[action];
          return [action, assignable(custom) && !oldDefault ? custom : code];
        },
      )));
      const values = candidate.flatMap(Object.values);
      if (new Set(values).size === values.length) settings.bindings = candidate;
    }
    if (typeof saved?.sound === 'boolean') settings.sound = saved.sound;
    for (const key of ['music', 'effects']) {
      if (Number.isFinite(saved?.[key])) settings[key] = Math.max(0, Math.min(100, saved[key]));
    }
    if (Object.prototype.hasOwnProperty.call(difficultyLabels, saved?.difficulty)) settings.difficulty = saved.difficulty;
  } catch {
    // Storage may be unavailable in private or embedded sessions.
  }
  return settings;
}

export function persistSettings(settings) {
  try { localStorage.setItem(settingsKey, JSON.stringify({ ...settings, bindingVersion: 2 })); } catch {}
}
