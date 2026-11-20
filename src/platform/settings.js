export const difficultyLabels = { easy: 'Dễ', normal: 'Thường', hard: 'Khó' };
const settingsKey = 'vo-linh-settings';

export function loadSettings() {
  const settings = { sound: true, music: 35, effects: 65, difficulty: 'normal' };
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey));
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
  try { localStorage.setItem(settingsKey, JSON.stringify(settings)); } catch {}
}
