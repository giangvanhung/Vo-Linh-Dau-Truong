import { enableMenuNavigation } from './menu-navigation.js';
import { createEquipmentPanel } from './equipment-panel.js';
import { choiceCard } from './roster-card.js';
import { createYouTubeMusic } from './youtube-music.js';
import { addPagination, connectSectionButtons } from './pagination.js';

import { ambiguousCompositionKey, assignable, bindingLabels, defaultBindings, keyCode, keyLabel } from '../platform/keyboard.js';
import { musicChoices, roundFormats } from '../platform/settings.js';
import { connectThemeSettings } from '../platform/theme.js';

const byId = id => document.getElementById(id);

function resolveChoice(id, options) {
  return id === 'random' ? options[Math.floor(Math.random() * options.length)] : id;
}

export function createPanels({ characters, stages, combat, settings, equipment, openSetup, openLan, returnToMenu, togglePause, startMatch, selectMatch, preloadFighter, saveSettings, setMusicFile }) {
  connectThemeSettings(settings, saveSettings);
  const stageWrap = byId('menu-panel').closest('.stage-wrap');
  const panels = [...stageWrap.querySelectorAll(':scope > .game-panel')];
  const gameCard = stageWrap.closest('.game-card');
  const utilityDialog = byId('utility-dialog');
  const dialogClose = byId('utility-close');
  const utilityPanels = [...utilityDialog.querySelectorAll('.utility-content')];
  const utilityTitles = { settings: 'Cài đặt', bindings: 'Phím bàn phím', guide: 'Hướng dẫn' };
  let popupTrigger;
  let pendingBinding = null;
  const utilityPages = {};
  const youtubeMusic = createYouTubeMusic(settings, saveSettings);

  function paginateUtility(name, pages, onChange) {
    const content = byId(name + '-pages');
    utilityPages[name] = addPagination(byId(name + '-panel'), pages.map(page =>
      page.dataset.pageLabel ?? page.querySelector('h3').textContent), index => {
      pages.forEach((page, position) => { page.hidden = index !== position; });
      content.scrollTop = 0;
      onChange?.();
    }, content.id);
  }
  paginateUtility('settings', [...byId('settings-pages').children]);
  paginateUtility('guide', [...byId('guide-pages').children]);

  function showUtility(name, trigger) {
    if (trigger) popupTrigger = trigger;
    byId('utility-title').textContent = utilityTitles[name];
    for (const panel of utilityPanels) panel.hidden = panel.id !== name + '-panel';
    if (!utilityDialog.open) utilityDialog.showModal();
    pendingBinding = null;
    dialogClose.focus({ preventScroll: true });
    utilityPages[name](0);
  }

  utilityDialog.addEventListener('close', () => {
    if (utilityDialog.open) return;
    for (const panel of utilityPanels) panel.hidden = true;
    pendingBinding = null;
    popupTrigger?.focus({ preventScroll: true });
    popupTrigger = null;
  });
  dialogClose.addEventListener('click', () => utilityDialog.close());
  const utilityButtons = {
    settings: ['settings-button', 'equipment-settings', 'pause-settings-button'],
    guide: ['guide-button', 'equipment-guide', 'pause-guide-button'],
  };
  for (const [name, buttons] of Object.entries(utilityButtons)) {
    for (const id of buttons) byId(id).addEventListener('click', event => showUtility(name, event.currentTarget));
  }
  enableMenuNavigation();
  const refreshEquipment = createEquipmentPanel(characters, equipment, combat);
  let equipmentReturn = returnToMenu;
  function showEquipment(fighterId, onReturn = returnToMenu) {
    equipmentReturn = onReturn;
    byId('equipment-back').textContent = onReturn === returnToMenu ? 'Về menu' : 'Về Vượt Ải';
    refreshEquipment(fighterId);
    show('equipment');
  }
  byId('equipment-button').addEventListener('click', () => showEquipment());
  byId('equipment-back').addEventListener('click', () => equipmentReturn());
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
  const setupPanel = byId('setup-panel');
  const setupContent = setupPanel.querySelector('.setup-content');
  function selectStage(id) {
    selectedStage = id;
    byId('setup-stage-title').textContent = stages[id]?.name ?? 'Ngẫu nhiên';
    byId('stage-description').textContent = stages[id]?.description ?? 'Sân đấu sẽ được chọn khi vào trận.';
  }
  const stageChoices = [...Object.entries(stages), ['random', { name: 'Ngẫu nhiên' }]];
  const stageTiles = stageChoices.map(([id, stage]) =>
    choiceCard('stage', id, stage.name, stage.background, id === selectedStage, selectStage));
  stageCards.append(...stageTiles);
  const stagesPerPage = 6;
  const stagePageLabels = Array.from({ length: Math.ceil(stageTiles.length / stagesPerPage) }, () => '');
  const showStagePage = addPagination(byId('setup-stage'), stagePageLabels, page => {
    stageTiles.forEach((tile, index) => { tile.hidden = Math.floor(index / stagesPerPage) !== page; });
    setupContent.scrollTop = 0;
  }, stageCards.id);
  selectStage(selectedStage);
  const pauseButton = byId('pause-button');
  const toggleSound = byId('toggle-sound');
  const soundSetting = byId('sound-setting');

  const roster = byId('setup-roster');
  const entries = Object.entries(characters);
  const defaultFighter = characters.hung ? 'hung' : entries[0][0];
  const selections = { player: defaultFighter, opponent: defaultFighter };
  const resetRosterPages = [];
  const pageSize = 6;
  const pageCount = Math.ceil(entries.length / pageSize);
  const sideLabels = {};
  for (const side of Object.keys(selections)) {
    const group = document.createElement('fieldset');
    group.id = 'setup-' + side;
    group.hidden = side !== 'player';
    const legend = sideLabels[side] = document.createElement('legend');
    const cards = document.createElement('div');
    cards.className = 'roster-cards';
    const name = document.createElement('strong');
    name.className = 'roster-name';
    const detail = document.createElement('p');
    const condition = document.createElement('p');
    condition.className = 'roster-detail';
    detail.className = 'roster-detail';
    function select(id) {
      selections[side] = id;
      preloadFighter(id);
      const fighter = characters[id];
      name.textContent = fighter.name;
      detail.textContent = [fighter.profile.role, fighter.prototypeStyle && fighter.profile.description,
        ...Object.values(fighter.skills).map(skill => skill.label)].filter(Boolean).join(' · ');
      condition.hidden = !fighter?.awakening && !fighter?.heroUpgrades;
      condition.textContent = fighter?.awakening
        ? 'Cấp 1 · ' + fighter.awakening.condition + (fighter.awakening.levelTwo ? ' · Cấp 2: nạp đầy nộ lần nữa' : '')
        : fighter?.heroUpgrades ? 'Biến hình: Giáp Lam → Khiên Triều → Lam Kình. Đầy năng lượng thì lên cấp trước khi dạng hiện tại hết giờ.' : '';
    }

    for (const [id, fighter] of entries) {
      const image = `/assets/characters/${id}/avatar.png`;
      cards.append(choiceCard(side + '-fighter', id, fighter.name, image, selections[side] === id, select));
    }
    let page = 0;
    const pager = document.createElement('div');
    pager.className = 'roster-pagination';
    pager.hidden = pageCount < 2;
    const pageLabel = document.createElement('span');
    pageLabel.setAttribute('aria-live', 'polite');
    const previous = document.createElement('button');
    const next = document.createElement('button');
    for (const [button, label, step] of [[previous, 'Trước', -1], [next, 'Sau', 1]]) {
      button.type = 'button';
      button.className = 'panel-button';
      button.textContent = label;
      button.addEventListener('click', () => showPage(page + step));
    }
    function showPage(index) {
      page = Math.max(0, Math.min(pageCount - 1, index));
      [...cards.children].forEach((card, index) => { card.hidden = Math.floor(index / pageSize) !== page; });
      pageLabel.textContent = `Trang ${page + 1}/${pageCount}`;
      previous.disabled = page === 0;
      next.disabled = page === pageCount - 1;
    }
    resetRosterPages.push(() => {
      const index = entries.findIndex(([id]) => id === defaultFighter);
      const card = cards.children[index];
      cards.querySelector('.is-selected')?.classList.remove('is-selected');
      card.classList.add('is-selected');
      card.querySelector('input').checked = true;
      select(defaultFighter);
      showPage(Math.floor(index / pageSize));
    });
    pager.append(previous, pageLabel, next);
    showPage(0);
    select(selections[side]);
    group.append(legend, name, cards, pager, detail, condition);
    roster.append(group);
  }
  const setupNavigation = setupPanel.querySelector('.setup-switcher');
  const showSetupSection = connectSectionButtons(setupNavigation);
  setupNavigation.addEventListener('click', () => { setupContent.scrollTop = 0; });

  function show(name, campaignFight = false) {
    const pveLobbyWasOpen = !byId('campaign-panel').hidden || !byId('equipment-panel').hidden;
    youtubeMusic.setInMatch(!name || name === 'pause');
    if (name !== 'bindings') pendingBinding = null;
    for (const panel of panels) panel.hidden = panel.id !== name + '-panel';
    stageWrap.classList.toggle('panel-open', Boolean(name));
    gameCard.classList.toggle('setup-open', name === 'setup');
    document.body.classList.toggle('setup-expanded', name === 'setup');
    gameCard.classList.toggle('lobby-open', ['menu', 'setup', 'lan', 'equipment', 'campaign'].includes(name));
    gameCard.classList.toggle('menu-open', name === 'menu');
    gameCard.classList.toggle('campaign-fight', campaignFight);
    if ((pveLobbyWasOpen || ['campaign', 'equipment'].includes(name)) && gameCard.getBoundingClientRect().top < 0) {
      gameCard.scrollIntoView({ block: 'start' });
    }
    if (name) {
      const selector = name === 'setup' ? 'input[name="player-fighter"]:checked'
        : name === 'campaign' ? '.campaign-stage[aria-pressed="true"]'
        : name === 'result' && !byId('campaign-result-actions').hidden
          ? '#campaign-result-actions .primary-button:not([hidden])'
          : 'button, select';
      byId(name + '-panel').querySelector(selector)?.focus({ preventScroll: true });
    }
  }

  function showBanner(message, finish = false) {
    banner.textContent = message;
    banner.hidden = !message;
    banner.classList.toggle('finish', finish);
  }

  function showSetup(practice, lan, localMode) {
    for (const reset of resetRosterPages) reset();
    formatMode = lan ? 'lan' : localMode || 'solo';
    format.value = settings.roundFormats[formatMode] ?? 3;
    byId('round-format-picker').hidden = practice;
    difficultySelect.value = settings.difficulty;
    byId('team-rules').hidden = localMode !== 'team';
    sideLabels.player.textContent = lan || localMode ? 'Người chơi 1' : 'Võ sĩ của bạn';
    sideLabels.opponent.textContent = lan || localMode ? 'Người chơi 2' : practice ? 'Bạn tập' : 'Đối thủ CPU';
    const playerTab = setupNavigation.querySelector('[aria-controls="setup-player"]');
    const opponentTab = setupNavigation.querySelector('[aria-controls="setup-opponent"]');
    playerTab.textContent = lan || localMode ? 'P1' : 'Võ sĩ';
    opponentTab.textContent = lan || localMode ? 'P2' : practice ? 'Bạn tập' : 'Đối thủ';
    playerTab.setAttribute('aria-label', sideLabels.player.textContent);
    opponentTab.setAttribute('aria-label', sideLabels.opponent.textContent);
    byId('difficulty-picker').hidden = practice || lan || localMode === 'versus';
    byId('setup-title').textContent = practice ? 'Chọn nhân vật luyện tập' : lan || localMode ? 'Chọn nhân vật P1 và P2' : 'Chọn nhân vật';
    showSetupSection('setup-player');
    showStagePage(Math.floor(stageChoices.findIndex(([id]) => id === selectedStage) / stagesPerPage));
    show('setup');
  }

  function updateSoundLabel() {
    toggleSound.textContent = settings.sound ? 'Tắt âm thanh' : 'Bật âm thanh';
    soundSetting.checked = settings.sound;
  }

  byId('versus-button').addEventListener('click', () => openSetup(false));
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
  const bindingPages = [];
  const bindingActions = Object.keys(bindingLabels);
  const bindingTopics = ['Di chuyển và đánh', 'Phòng thủ và nộ', 'Kỹ năng'];
  for (const side of [0, 1]) for (const [page, topic] of bindingTopics.entries()) {
    const group = document.createElement('fieldset');
    const legend = document.createElement('legend');
    group.dataset.pageLabel = 'P' + (side + 1) + ' · ' + topic;
    legend.textContent = group.dataset.pageLabel;
    group.append(legend);
    for (const action of bindingActions.slice(page * 6, page * 6 + 6)) {
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
    bindingPages.push(group);
  }
  paginateUtility('bindings', bindingPages, () => {
    if (!pendingBinding) return;
    pendingBinding = null;
    bindingStatus.textContent = 'Đã hủy đổi phím.';
  });
  window.addEventListener('keydown', event => {
    if (!pendingBinding) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat || ambiguousCompositionKey(event)) return;
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
    bindingStatus.textContent = 'Chọn thao tác cần đổi.';
    renderBindings();
    showUtility('bindings');
  });
  byId('bindings-reset').addEventListener('click', () => {
    pendingBinding = null;
    settings.bindings = defaultBindings.map(keys => ({ ...keys }));
    saveSettings();
    renderBindings();
    bindingStatus.textContent = 'Đã khôi phục phím mặc định.';
  });
  renderBindings();
  byId('bindings-back').addEventListener('click', () => {
    showUtility('settings');
    byId('bindings-button').focus({ preventScroll: true });
  });
  byId('local-button').addEventListener('click', () => openSetup(false, 'versus'));
  byId('team-button').addEventListener('click', () => openSetup(false, 'team'));
  byId('lan-button').addEventListener('click', openLan);
  byId('practice-button').addEventListener('click', () => openSetup(true));
  pauseButton.addEventListener('click', togglePause);
  byId('resume-button').addEventListener('click', togglePause);
  for (const button of document.querySelectorAll('[data-menu]')) button.addEventListener('click', returnToMenu);
  for (const button of document.querySelectorAll('[data-replay]')) button.addEventListener('click', startMatch);
  byId('start-button').addEventListener('click', () => selectMatch(
    selections.player,
    selections.opponent,
    difficultySelect.value, resolveChoice(selectedStage, stageIds), hazards.checked, byId('party-items').checked, Number(format.value),
  ));

  const musicSource = byId('music-source');
  const musicTrack = byId('music-track');
  const musicFile = byId('music-file');
  const musicStatus = byId('music-file-status');
  const fileNames = new Map();
  for (const [id, choice] of Object.entries(musicChoices)) {
    musicTrack.add(new Option(choice.title, id));
  }
  function updateMusicSelection() {
    const { link } = musicChoices[musicTrack.value];
    byId('music-file-controls').hidden = settings.musicSource === 'youtube' || !link;
    if (link) byId('music-listen-link').href = link;
    musicFile.value = '';
    musicStatus.textContent = fileNames.get(musicTrack.value) || 'Tệp chỉ dùng trong phiên này.';
  }
  function updateMusicSource() {
    const useYouTube = settings.musicSource === 'youtube';
    for (const field of document.querySelectorAll('[data-game-music]')) field.hidden = useYouTube;
    youtubeMusic.setEnabled(useYouTube);
    updateMusicSelection();
  }
  musicSource.value = settings.musicSource;
  musicTrack.value = settings.musicTrack;
  updateMusicSource();
  musicSource.addEventListener('change', () => {
    settings.musicSource = musicSource.value;
    updateMusicSource();
    saveSettings();
  });
  musicTrack.addEventListener('change', () => {
    settings.musicTrack = musicTrack.value;
    updateMusicSelection();
    saveSettings();
  });
  const musicMode = byId('music-mode');
  musicMode.value = settings.musicMode;
  musicMode.addEventListener('change', () => {
    settings.musicMode = musicMode.value;
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
    show, showSetup, showBanner, showEquipment,
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
