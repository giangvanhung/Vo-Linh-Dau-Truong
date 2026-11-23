import { defaultBindings, assignable } from './keyboard.js';
import { themes } from './theme.js';

export const difficultyLabels = { easy: 'Dễ', normal: 'Thường', hard: 'Khó' };
export const musicChoices = {
  earrings: { title: 'Earrings — Malcolm Todd', file: 'earrings.mp3' },
  ThankYou: { title: 'Home Made Kazoku - Thank You!!', file: 'thank-you.mp3' },
  TheHero: { title: 'The Hero!! — One Punch Man', file: 'the-hero.mp3' },
  FUNKABNORMAL: { title: 'FUNK ABNORMAL - DJ V12', file: 'funk-abnormal.mp3' },
  Hero: { title: 'Hero (Prod. by Primary)', file: 'hero.mp3' },
  AiDuaEmVe: { title: 'AI ĐƯA EM VỀ (BRAZILIAN FUNK REMIX) - LOW CORTISOL FUNK', file: 'low-cortisol-funk.mp3' },
  AllIWantForChristmasIsYou: { title: 'All I Want For Christmas Is You - Mariah Carey', file: 'all-i-want.mp3' },
  wrongTimes: { title: 'Wrong Times — Puppy & Dangrangto', file: 'wrong-times.mp3' },
  nheBuong: { title: 'Nhẹ Buông — Hằng ssi & Aries tis', file: 'nhe-buong.mp3' },
  winterFunk: { title: 'Winter Funk · Võ Linh Đấu Trường', file: 'winter-funk.wav' },
  synthwave: { title: 'Synth Wave — Alex McCulloch', file: 'synthwave.mp3' },
  midnight: { title: 'Midnight Drive — congusbongus', file: 'midnight-drive.ogg' },
  aura: { title: 'Aura — Legendary Playlist', file: 'aura.mp3' },
  lookism: { title: 'Buổi biểu diễn của Park Hyung Seok — Lookism', file: 'lookism.mp3' },
  shinunogaEwa: { title: 'Shinunoga E-wa — Fujii Kaze', file: 'shinunoga-e-wa.mp3' },
  goldenBrownLoveStory: { title: 'Golden Brown × Love Story (Slowed Remix)', file: 'golden-brown-love-story.mp3' },
  yQueFue: { title: 'Y Que Fue — Don Miguelo', file: 'y-que-fue.mp3' },
  legendsNeverDie: { title: 'Legends Never Die — Black Clover AMV', file: 'legends-never-die.mp3' },
  blueBird: { title: 'Blue Bird — Naruto AMV', file: 'blue-bird.mp3' },
  loveMeNot: { title: 'Love Me Not — Neymar Edit', file: 'love-me-not.mp3' },
  semCeder: { title: 'SEM CEDER (Slowed)', file: 'sem-ceder.mp3' },
  unravel: { title: 'unravel — Tokyo Ghoul', file: 'unravel.mp3' },
  only: { title: 'ONLY — LeeHi', file: 'only.mp3' },
};
const legacyP2 = { j:'KeyZ', k:'KeyX', l:'KeyC', p:'KeyV', q:'KeyB', r:'KeyH', f:'BracketLeft', g:'BracketRight', u:'KeyN', i:'KeyM', o:'Comma', t:'Period' };
export const roundFormats = [3, 5, 7, 9];
const settingsKey = 'vo-linh-settings';

export function loadSettings() {
  const settings = { sound: true, music: 35, musicSource: 'game', musicTrack: 'earrings', musicMode: 'repeat', effects: 65, difficulty: 'normal', theme: 'auto', themeEffects: true };
  settings.roundFormats = {};
  settings.bindings = defaultBindings.map(keys => ({ ...keys }));
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey));
    if (Object.prototype.hasOwnProperty.call(themes, saved?.theme)) settings.theme = saved.theme;
    if (typeof saved?.themeEffects === 'boolean') settings.themeEffects = saved.themeEffects;
    if (typeof saved?.youtubeMusic === 'string' && /^[\w-]{11}$/.test(saved.youtubeMusic)) settings.youtubeMusic = saved.youtubeMusic;
    if (['game', 'youtube'].includes(saved?.musicSource)) settings.musicSource = saved.musicSource;
    else if (settings.youtubeMusic) settings.musicSource = 'youtube';
    if (Object.prototype.hasOwnProperty.call(musicChoices, saved?.musicTrack)) settings.musicTrack = saved.musicTrack;
    if (['repeat', 'cycle'].includes(saved?.musicMode)) settings.musicMode = saved.musicMode;
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
      const assigned = new Set(candidate.flatMap((keys, side) => Object.entries(keys)
        .filter(([action]) => action !== 'b' || assignable(saved.bindings[side]?.b)).map(([, code]) => code)));
      for (const [side, keys] of candidate.entries()) {
        if (assignable(saved.bindings[side]?.b)) continue;
        keys.b = [keys.b, 'NumpadSubtract', 'NumpadMultiply', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(key => 'Key' + key),
          ...'0123456789'.split('').map(key => 'Digit' + key)].find(code => !assigned.has(code));
        assigned.add(keys.b);
      }
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
