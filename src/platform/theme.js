export const themes = {
  auto: 'Tự động theo ngày',
  classic: 'Cổ điển',
  spring: 'Xuân hoa đào',
  summer: 'Hè biển xanh',
  autumn: 'Thu lá hổ phách',
  winter: 'Đông tuyết',
  christmas: 'Giáng sinh',
  blocks: 'Thung lũng khối vuông',
};

export function themeForDate(date) {
  const month = date.getMonth() + 1;
  if (month === 12 && date.getDate() <= 26) return 'christmas';
  if (month >= 11 || month <= 2) return 'winter';
  if (month <= 4) return 'spring';
  if (month <= 8) return 'summer';
  return 'autumn';
}

export function connectThemeSettings(settings, saveSettings) {
  const select = document.getElementById('theme-setting');
  const status = document.getElementById('theme-status');
  const effectsButton = document.getElementById('theme-effects');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (select) {
    for (const [value, label] of Object.entries(themes)) select.add(new Option(label, value));
    select.value = settings.theme;
  }
  for (const scene of document.querySelectorAll('.season-scene')) {
    const count = scene.classList.contains('season-arena') ? 12 : 32;
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('i');
      particle.className = 'season-particle';
      particle.style.left = `${(i * 61 % 103) / 103 * 100}%`;
      particle.style.setProperty('--size', `${2 + i % 5}px`);
      particle.style.setProperty('--drift', `${(i % 2 ? -1 : 1) * (18 + i % 7 * 8)}px`);
      particle.style.setProperty('--duration', `${7 + i % 11 * .8}s`);
      particle.style.setProperty('--delay', `-${i * 29 % 127 / 10}s`);
      scene.append(particle);
    }
  }

  let timer;
  function applyTheme() {
    window.clearTimeout(timer);
    const now = new Date();
    const automatic = settings.theme === 'auto';
    const theme = automatic ? themeForDate(now) : settings.theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themeEffects = settings.themeEffects ? 'on' : 'off';
    meta.content = getComputedStyle(document.documentElement).getPropertyValue('--theme-base').trim();
    if (status) status.textContent = automatic ? `Đang dùng ${themes[theme]} theo ngày trên thiết bị.` : '';
    if (effectsButton) {
      effectsButton.setAttribute('aria-pressed', String(settings.themeEffects));
      effectsButton.firstElementChild.textContent = settings.themeEffects ? 'Bật' : 'Tắt';
    }
    if (automatic) {
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = window.setTimeout(applyTheme, midnight - now);
    }
  }

  select?.addEventListener('change', () => {
    settings.theme = select.value;
    saveSettings();
    applyTheme();
  });
  effectsButton?.addEventListener('click', () => {
    settings.themeEffects = !settings.themeEffects;
    saveSettings();
    applyTheme();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && settings.theme === 'auto') applyTheme();
  });
  applyTheme();
}
