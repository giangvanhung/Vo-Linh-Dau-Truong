import { enableMenuNavigation } from './menu-navigation.js';
import { createEquipmentPanel } from './equipment-panel.js';

import { assignable, bindingLabels, defaultBindings, keyCode, keyLabel } from '../platform/keyboard.js';
import { musicChoices, roundFormats } from '../platform/settings.js';

const byId = id => document.getElementById(id);

function resolveChoice(id, options) {
  return id === 'random' ? options[Math.floor(Math.random() * options.length)] : id;
}

function choiceCard(group, id, name, image, checked, onSelect) {
  const card = document.createElement('label');
  card.className = 'roster-card';
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = group;
  radio.value = id;
  radio.checked = checked;
  radio.addEventListener('change', () => onSelect(id));
  const preview = document.createElement(image ? 'img' : 'span');
  preview.className = 'roster-portrait';
  if (image) {
    preview.loading = 'lazy';
    preview.decoding = 'async';
    preview.src = image;
    preview.alt = '';
  } else {
    preview.textContent = '?';
    preview.setAttribute('aria-hidden', 'true');
  }
  const label = document.createElement('span');
  label.textContent = name;
  card.append(radio, preview, label);
  return card;
}

export function createPanels({ characters, stages, settings, equipment, openSetup, openLan, returnToMenu, togglePause, startMatch, selectMatch, saveSettings, setMusicFile }) {
  const panels = [...document.querySelectorAll('.game-panel')];
  const stageWrap = panels[0].closest('.stage-wrap');
  enableMenuNavigation();
  const refreshEquipment = createEquipmentPanel(characters, equipment);
  byId('equipment-button').addEventListener('click', () => {
    refreshEquipment();
    show('equipment');
  });
  const banner = byId('fight-banner');
  const format = byId('round-format');
  let formatMode = 'solo';
  for (const rounds of roundFormats) format.add(new Option('BO' + rounds + ' · Thắng ' + Math.ceil(rounds / 2), rounds));
  format.addEventListener('change', () => {
    settings.roundFormats[formatMode] = Number(format.value);
    saveSettings();
  });
  const difficultySelect = byId('cpu-difficulty');
  const stageCards = byId('stage-cards');
  const stageIds = Object.keys(stages);
  let selectedStage = stageIds[0];
  const hazards = byId('stage-hazards');
  function selectStage(id) {
    selectedStage = id;
    byId('stage-description').textContent = stages[id]?.description ?? 'Sân đấu sẽ được chọn khi vào trận.';
  }
  for (const [id, stage] of [...Object.entries(stages), ['random', { name: 'Ngẫu nhiên' }]]) {
    stageCards.append(choiceCard('stage', id, stage.name, stage.background, id === selectedStage, selectStage));
  }
  selectStage(selectedStage);
  const pauseButton = byId('pause-button');
  const toggleSound = byId('toggle-sound');
  const soundSetting = byId('sound-setting');

  const roster = byId('setup-roster');
  const entries = Object.entries(characters);
  const fighterIds = Object.keys(characters);
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
        : 'Võ sĩ sẽ được chọn khi vào trận.';
      condition.hidden = !fighter?.awakening;
      condition.textContent = fighter?.awakening
        ? 'Cấp 1 · ' + fighter.awakening.condition + (fighter.awakening.levelTwo ? ' · Cấp 2: nạp đầy nộ lần nữa' : '')
        : '';
    }

    const options = [...entries, ['random', { name: 'Ngẫu nhiên' }]];
    for (const [id, fighter] of options) {
      const image = id === 'random' ? null : `/assets/characters/${id}/avatar.png`;
      cards.append(choiceCard(side + '-fighter', id, fighter.name, image, selections[side] === id, select));
    }
    select(selections[side]);
    group.append(legend, cards, detail, condition);
    roster.append(group);
  }

  function show(name) {
    if (name !== 'bindings') pendingBinding = null;
    for (const panel of panels) panel.hidden = panel.id !== name + '-panel';
    stageWrap.classList.toggle('panel-open', Boolean(name));
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

  function showSetup(practice, lan, localMode) {
    formatMode = lan ? 'lan' : localMode || 'solo';
    format.value = settings.roundFormats[formatMode] ?? 3;
    byId('round-format-picker').hidden = practice;
    difficultySelect.value = settings.difficulty;
    byId('team-rules').hidden = localMode !== 'team';
    sideLabels.player.textContent = lan || localMode ? 'Người chơi 1' : 'Võ sĩ của bạn';
    sideLabels.opponent.textContent = lan || localMode ? 'Người chơi 2' : practice ? 'Bạn tập' : 'Đối thủ CPU';
    byId('difficulty-picker').hidden = practice || lan || localMode === 'versus';
    byId('setup-title').textContent = practice ? 'Chọn nhân vật luyện tập' : lan || localMode ? 'Chọn nhân vật P1 và P2' : 'Chọn nhân vật';
    show('setup');
  }

  function updateSoundLabel() {
    toggleSound.textContent = settings.sound ? 'Tắt âm thanh' : 'Bật âm thanh';
    soundSetting.checked = settings.sound;
  }

  byId('versus-button').addEventListener('click', () => openSetup(false));
  let pendingBinding = null;
  const bindingButtons = [];
  const bindingStatus = byId('binding-status');
  function renderBindings() {
    for (const key of document.querySelectorAll('[data-binding]')) {
      key.textContent = keyLabel(settings.bindings[0][key.dataset.binding]);
    }
    for (const { side, action, button } of bindingButtons) {
      button.textContent = bindingLabels[action] + ' · ' + keyLabel(settings.bindings[side][action]);
    }
  }
  for (const side of [0, 1]) {
    const group = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'Người chơi ' + (side + 1);
    group.append(legend);
    for (const action of Object.keys(bindingLabels)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'panel-button';
      const binding = { side, action, button };
      bindingButtons.push(binding);
      button.addEventListener('click', () => {
        pendingBinding = binding;
        bindingStatus.textContent = 'P' + (side + 1) + ' · ' + bindingLabels[action] + '. Nhấn phím mới hoặc Esc để hủy.';
      });
      group.append(button);
    }
    byId('binding-fields').append(group);
  }
  window.addEventListener('keydown', event => {
    if (!pendingBinding) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    const { side, action } = pendingBinding;
    const code = keyCode(event);
    if (code === 'Escape') {
      pendingBinding = null;
      bindingStatus.textContent = 'Đã hủy đổi phím.';
      return;
    }
    if (!assignable(code) || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) {
      bindingStatus.textContent = 'Hãy chọn một phím chữ, số, mũi tên hoặc dấu câu. Esc để hủy.';
      return;
    }
    if (settings.bindings.some((keys, index) => Object.entries(keys).some(
      ([id, key]) => key === code && (index !== side || id !== action),
    ))) {
      bindingStatus.textContent = 'Phím ' + keyLabel(code) + ' đang dùng. Hãy chọn phím khác.';
      return;
    }
    settings.bindings[side][action] = code;
    pendingBinding = null;
    saveSettings();
    renderBindings();
    bindingStatus.textContent = 'Đã lưu phím ' + keyLabel(code) + '.';
  }, true);
  byId('bindings-button').addEventListener('click', () => {
    bindingStatus.textContent = 'Chọn thao tác cần đổi. Giữ Shift với phím Lướt để lướt mạnh. Phím Num nằm ở cụm số bên phải.';
    renderBindings();
    show('bindings');
  });
  byId('bindings-reset').addEventListener('click', () => {
    pendingBinding = null;
    settings.bindings = defaultBindings.map(keys => ({ ...keys }));
    saveSettings();
    renderBindings();
    bindingStatus.textContent = 'Đã khôi phục phím mặc định.';
  });
  renderBindings();
  byId('bindings-back').addEventListener('click', () => show('settings'));
  byId('local-button').addEventListener('click', () => openSetup(false, 'versus'));
  byId('team-button').addEventListener('click', () => openSetup(false, 'team'));
  byId('lan-button').addEventListener('click', openLan);
  byId('practice-button').addEventListener('click', () => openSetup(true));
  byId('settings-button').addEventListener('click', () => show('settings'));
  byId('guide-button').addEventListener('click', () => show('guide'));
  pauseButton.addEventListener('click', togglePause);
  byId('resume-button').addEventListener('click', togglePause);
  for (const button of document.querySelectorAll('[data-menu]')) button.addEventListener('click', returnToMenu);
  for (const button of document.querySelectorAll('[data-replay]')) button.addEventListener('click', startMatch);
  byId('start-button').addEventListener('click', () => selectMatch(
    resolveChoice(selections.player, fighterIds),
    selections.opponent,
    difficultySelect.value, resolveChoice(selectedStage, stageIds), hazards.checked, byId('party-items').checked, Number(format.value),
  ));

  const musicTrack = byId('music-track');
  const musicFile = byId('music-file');
  const musicStatus = byId('music-file-status');
  const fileNames = new Map();
  for (const [id, choice] of Object.entries(musicChoices)) {
    musicTrack.add(new Option(choice.title, id));
  }
  function updateMusicSelection() {
    const { link } = musicChoices[musicTrack.value];
    byId('music-file-controls').hidden = !link;
    if (link) byId('music-listen-link').href = link;
    musicFile.value = '';
    musicStatus.textContent = fileNames.get(musicTrack.value) || 'Tệp chỉ dùng trong phiên này.';
  }
  musicTrack.value = settings.musicTrack;
  updateMusicSelection();
  musicTrack.addEventListener('change', () => {
    settings.musicTrack = musicTrack.value;
    updateMusicSelection();
    saveSettings();
  });
  musicFile.addEventListener('change', () => {
    const file = musicFile.files[0];
    if (!file) return;
    fileNames.set(musicTrack.value, file.name);
    setMusicFile(musicTrack.value, file);
    updateMusicSelection();
  });

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
    setResult(title, score, reward = '') {
      byId('result-title').textContent = title;
      byId('result-score').textContent = score;
      byId('result-reward').textContent = reward;
      byId('result-reward').hidden = !reward;
    },
  };
}
