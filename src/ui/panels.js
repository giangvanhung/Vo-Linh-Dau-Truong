const byId = id => document.getElementById(id);

export function createPanels({ settings, openSetup, openLan, returnToMenu, togglePause, startMatch, selectMatch, saveSettings }) {
  const panels = [...document.querySelectorAll('.game-panel')];
  const banner = byId('fight-banner');
  const difficultySelect = byId('cpu-difficulty');
  const pauseButton = byId('pause-button');
  const toggleSound = byId('toggle-sound');
  const soundSetting = byId('sound-setting');

  function show(name) {
    for (const panel of panels) panel.hidden = panel.id !== name + '-panel';
    if (name) byId(name + '-panel').querySelector('button, select')?.focus({ preventScroll: true });
  }

  function showBanner(message, finish = false) {
    banner.textContent = message;
    banner.hidden = !message;
    banner.classList.toggle('finish', finish);
  }

  function showSetup(practice, lan) {
    difficultySelect.value = settings.difficulty;
    byId('difficulty-picker').hidden = practice || lan;
    byId('setup-title').textContent = practice ? 'Chọn nhân vật luyện tập' : lan ? 'Chọn nhân vật P1 và P2' : 'Chọn nhân vật';
    show('setup');
  }

  function updateSoundLabel() {
    toggleSound.textContent = settings.sound ? 'Tắt âm thanh' : 'Bật âm thanh';
    soundSetting.checked = settings.sound;
  }

  byId('versus-button').addEventListener('click', () => openSetup(false));
  byId('lan-button').addEventListener('click', openLan);
  byId('practice-button').addEventListener('click', () => openSetup(true));
  byId('settings-button').addEventListener('click', () => show('settings'));
  byId('guide-button').addEventListener('click', () => show('guide'));
  pauseButton.addEventListener('click', togglePause);
  byId('resume-button').addEventListener('click', togglePause);
  for (const button of document.querySelectorAll('[data-menu]')) button.addEventListener('click', returnToMenu);
  for (const button of document.querySelectorAll('[data-replay]')) button.addEventListener('click', startMatch);
  byId('start-button').addEventListener('click', () => selectMatch(
    byId('player-select').value,
    byId('opponent-select').value,
    difficultySelect.value,
  ));

  for (const [key, field] of Object.entries({
    sound: soundSetting, music: byId('music-setting'),
    effects: byId('effects-setting'), difficulty: byId('default-difficulty'),
  })) {
    if (key === 'sound') field.checked = settings.sound;
    else field.value = settings[key];
    field.addEventListener('input', () => {
      settings[key] = key === 'sound' ? field.checked : key === 'difficulty' ? field.value : Number(field.value);
      updateSoundLabel();
      saveSettings();
    });
  }
  updateSoundLabel();
  toggleSound.addEventListener('click', () => {
    settings.sound = !settings.sound;
    updateSoundLabel();
    saveSettings();
  });

  return {
    show, showSetup, showBanner,
    bannerMessage: () => banner.textContent,
    hideBanner: () => { banner.hidden = true; },
    restoreBanner: () => { banner.hidden = !banner.textContent; },
    setPauseAvailable: available => { pauseButton.hidden = !available; },
    setResult(title, score) {
      byId('result-title').textContent = title;
      byId('result-score').textContent = score;
    },
  };
}
