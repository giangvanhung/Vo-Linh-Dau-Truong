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
  const meta = document.querySelector('meta[name="theme-color"]');
  for (const [value, label] of Object.entries(themes)) {
    select.add(new Option(label, value));
  }
  select.value = settings.theme;

  let timer;
  function applyTheme() {
    window.clearTimeout(timer);
    const now = new Date();
    const automatic = settings.theme === 'auto';
    const theme = automatic ? themeForDate(now) : settings.theme;
    document.documentElement.dataset.theme = theme;
    meta.content = getComputedStyle(document.documentElement).getPropertyValue('--theme-base').trim();
    status.textContent = automatic ? `Đang dùng ${themes[theme]} theo ngày trên thiết bị.` : '';
    if (automatic) {
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = window.setTimeout(applyTheme, midnight - now);
    }
  }

  select.addEventListener('change', () => {
    settings.theme = select.value;
    saveSettings();
    applyTheme();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && settings.theme === 'auto') applyTheme();
  });
  applyTheme();
}
