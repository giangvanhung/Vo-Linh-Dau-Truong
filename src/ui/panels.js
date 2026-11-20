const byId = id => document.getElementById(id);

function pickAnother(options, current) {
  const choices = options.filter(id => id !== current);
  return choices[Math.floor(Math.random() * choices.length)] ?? current;
}

export function createPanels({ characters, stages, settings, openSetup, openLan, returnToMenu, togglePause, startMatch, selectMatch, saveSettings }) {
  const panels = [...document.querySelectorAll('.game-panel')];
  const banner = byId('fight-banner');
  const difficultySelect = byId('cpu-difficulty');
  const stageSelect = byId('stage-select');
  const hazards = byId('stage-hazards');
  stageSelect.replaceChildren(...Object.entries(stages).map(([id, stage]) => new Option(stage.name, id)));
  function describeStage() {
    byId('stage-description').textContent = stages[stageSelect.value].description;
  }
  stageSelect.addEventListener('change', describeStage);
  byId('random-stage').addEventListener('click', () => {
    stageSelect.value = pickAnother(Object.keys(stages), stageSelect.value);
    describeStage();
  });
  describeStage();
  const pauseButton = byId('pause-button');
  const toggleSound = byId('toggle-sound');
  const soundSetting = byId('sound-setting');

  const roster = byId('setup-roster');
  const entries = Object.entries(characters);
  const selections = { player: 'hung', opponent: 'random' };
  const sideLabels = {};
  for (const side of Object.keys(selections)) {
    const group = document.createElement('fieldset');
    const legend = sideLabels[side] = document.createElement('legend');
    const cards = document.createElement('div');
    cards.className = 'roster-cards';
    const detail = document.createElement('p');
    const condition = document.createElement('p');
    condition.className = 'roster-detail';
    detail.className = 'roster-detail';
    function select(id) {
      selections[side] = id;
      const fighter = characters[id];
      detail.textContent = fighter
        ? [fighter.profile.role, ...Object.values(fighter.skills).map(skill => skill.label)].join(' · ')
        : 'Game chọn đối thủ khi bắt đầu trận.';
      condition.hidden = !fighter?.awakening;
      condition.textContent = fighter?.awakening ? 'Đột phá · ' + fighter.awakening.condition : '';
    }

    const options = side === 'player' ? entries : [...entries, ['random', { name: 'Ngẫu nhiên' }]];
    for (const [id, fighter] of options) {
      const card = document.createElement('label');
      card.className = 'roster-card';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = side + '-fighter';
      radio.value = id;
      radio.checked = selections[side] === id;
      radio.addEventListener('change', () => select(id));
      const portrait = document.createElement(id === 'random' ? 'span' : 'img');
      portrait.className = 'roster-portrait';
      if (id === 'random') {
        portrait.textContent = '?';
        portrait.setAttribute('aria-hidden', 'true');
      } else {
        portrait.src = `/assets/characters/${id}/avatar.png`;
        portrait.alt = '';
      }
      const name = document.createElement('span');
      name.textContent = fighter.name;
      card.append(radio, portrait, name);
      cards.append(card);
    }
    select(selections[side]);
    group.append(legend, cards);
    if (side === 'player') {
      const randomButton = document.createElement('button');
      randomButton.type = 'button';
      randomButton.className = 'panel-button';
      randomButton.textContent = 'Võ sĩ P1 ngẫu nhiên';
      randomButton.addEventListener('click', () => {
        const id = pickAnother(Object.keys(characters), selections.player);
        const radio = [...cards.querySelectorAll('input')].find(input => input.value === id);
        radio.click();
      });
      group.append(randomButton);
    }
    group.append(detail, condition);
    roster.append(group);
  }

  function show(name) {
    for (const panel of panels) panel.hidden = panel.id !== name + '-panel';
    if (name) {
      const selector = name === 'setup' ? 'input[name="player-fighter"]:checked' : 'button, select';
      byId(name + '-panel').querySelector(selector)?.focus({ preventScroll: true });
    }
  }

  function showBanner(message, finish = false) {
    banner.textContent = message;
    banner.hidden = !message;
    banner.classList.toggle('finish', finish);
  }

  function showSetup(practice, lan) {
    difficultySelect.value = settings.difficulty;
    sideLabels.player.textContent = lan ? 'Người chơi 1' : 'Võ sĩ của bạn';
    sideLabels.opponent.textContent = lan ? 'Người chơi 2' : practice ? 'Bạn tập' : 'Đối thủ CPU';
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
    selections.player,
    selections.opponent,
    difficultySelect.value, stageSelect.value, hazards.checked,
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
