import { FRAME_SECONDS, Fighter } from '../combat/fighter.js';
import { findHit, applyHit } from '../combat/hits.js';
import { updateProjectiles } from '../combat/projectiles.js';
import { faceOpponent } from '../combat/positioning.js';
import { canFollowHungLaunch, hungAirAttack } from './hung-air-combo.js';
import { CpuController } from '../combat/cpu.js';
import { GameAudio } from '../platform/audio.js';
import { createKeyboard, defaultBindings, keyCode, keyLabel } from '../platform/keyboard.js';
import { mergeInputs } from '../platform/lan.js';
import { loadSettings, persistSettings, roundFormats } from '../platform/settings.js';
import { createArenaRenderer } from '../render/arena.js';
import { createHud, damageFormat } from '../ui/hud.js';
import { createControllerPairing } from '../ui/controller-pairing.js';
import { createPanels } from '../ui/panels.js';
import { createTrainingPanel } from '../ui/training-panel.js';
import { applyStageEffects, groundHeightAt, stageForMatch } from './stages.js';
import { createTrainingActions, TrainingSession } from './training.js';
import { TeamRoster } from './team-roster.js';
import { superAttackFor } from './super-motion.js';
import { applyControls } from './fighter-controls.js';
import { createPickups, equippedAttack } from './pickups.js';
import { mainWeaponAttack } from './weapon-attacks.js';
import { heroEnergyMax, nextHeroForm, startHeroForm } from './hero-form.js';
import { createStageBall, updateStageBall } from './stage-ball.js';
import { awardEquipment, catalog, equipFighter, loadEquipment, rarities, reviveFighter, saveEquipment, setMainWeapon } from './equipment.js';
import { availableStage, campaignProgress, settleStage } from './campaign.js';
import { createCampaignPanel } from '../ui/campaign-panel.js';

export function startGame(config) {
  const canvas = document.querySelector('#arena');
  const render = createArenaRenderer(canvas, config);
  const byId = id => document.getElementById(id);
  const ui = { toast: byId('toast'), 'status-text': byId('status-text') };
  const keyboardHint = byId('keyboard-hint');
  const windowsKeyboard = /Windows/i.test(navigator.userAgent);
  byId('pause-keyboard-hint').hidden = !windowsKeyboard;
  const hud = createHud();
  const settings = loadSettings();
  const equipment = loadEquipment();
  const training = new TrainingSession();
  const canTrain = () => practice && phase === 'fight';
  const dropWeaponButton = byId('drop-weapon');
  const transformButton = byId('hero-transform');
  const audio = new GameAudio();
  audio.configure(settings);
  for (const event of ['click', 'keydown']) {
    window.addEventListener(event, () => audio.unlock(), { capture: true });
  }
  const world = { width: canvas.width, height: canvas.height, groundRatio: config.stage.groundRatio, gravity: config.stage.gravity };
  const controlRules = { jumpVelocity: config.stage.jumpVelocity, world, useAttack, activateAwakening: requestAwakening, dropWeapon, toast };
  const minimumArenaWidth = world.width;
  let stage = stageForMatch(config.stage, config.stages.rooftop, true);
  let stageFrame = 0;
  let ball = null;
  let partyItems = false;
  const pickups = createPickups();
  const issuedWeapons = new Set();
  const revivedSlots = new Set();
  const mechSlots = new Set();
  function setStage(id, hazards) {
    stage = stageForMatch(config.stage, config.stages[id], hazards);
    document.querySelector('.season-arena').dataset.climate = stage.seasonClimate ?? 'outdoor';
    Object.assign(world, { platforms: stage.platforms, rises: stage.rises, zone: stage.zone });
    byId('stage-name').textContent = stage.name;
  }
  const roundLength = config.stage.roundSeconds;
  // The HUD IDs identify fixed sides. The fighters on each side are selected before a match.
  let hung, mai, phase = 'menu', seconds = roundLength, winsHung = 0, winsMai = 0, round = 1;
  let playerId = 'hung', opponentId = 'mai', practice = false, lan = false, pausedPhase;
  let phaseTime = 0, nextRound = false;
  let lastTime, accumulator = 0, toastClock = 0, keyboardHintUntil = 0;
  let difficulty = 'normal', cpu;
  let campaignRun = null, pendingCampaign = null;
  let bestOf = 3, damageHung = 0, damageMai = 0;
  let localMode = '';
  const team = new TeamRoster();
  const isPve = () => !practice && !lan && localMode !== 'versus';
  let hitstop = 0, shake = 0;
  let animationTime = 0;
  let previousPositions = [];
  const particles = [], floaters = [], projectiles = [], trails = [];
  let screenEffect = null;

  function fighterX(side) { return world.width * config.stage[side === 'hung' ? 'playerStartRatio' : 'cpuStartRatio']; }
  function updateScore() {
    hud.updateUI({ hung, mai, practice, seconds, round, winsHung, winsMai, bestOf, damageHung, damageMai });
  }

  function makeFighter(id, side) {
    render.preloadFighter(id);
    const fighter = new Fighter(config.characters[id], fighterX(side), side === 'hung' ? 1 : -1, config.combat);
    fighter.y = groundHeightAt(world, fighter.x);
    fighter.characterId = id;
    fighter.matchSlot = side + ':' + (side === 'hung' ? team.activePlayer : team.activeCpu);
    fighter.heroMechUsed = mechSlots.has(fighter.matchSlot);
    if (side === 'hung' || lan || localMode === 'versus') {
      const slot = fighter.matchSlot + ':' + id;
      equipFighter(fighter, equipment, id, side === 'hung' && isPve() && phase !== 'menu',
        phase !== 'menu' && !issuedWeapons.has(slot));
      if (fighter.weapon) issuedWeapons.add(slot);
    }
    return fighter;
  }

  function updateRoster() {
    hud.updateRosterUI({ hung, mai, practice, difficulty, lan: lan || localMode === 'versus', team: localMode === 'team', activePlayer: team.activePlayer, activeCpu: team.activeCpu });
    updateScore();
  }

  function resetFighters(keepMainWeapons = false) {
    const heroEnergy = keepMainWeapons ? [hung, mai].map(fighter => fighter.heroEnergy) : [0, 0];
    const carried = keepMainWeapons ? [hung, mai].map((fighter, side) => {
      if (!(side ? team.activeCpu : team.activePlayer)) return fighter.weapon;
      pickups.release(fighter, stageFrame, world, true);
      return null;
    }) : [];
    if (!keepMainWeapons) issuedWeapons.clear();
    if (!keepMainWeapons) revivedSlots.clear();
    if (!keepMainWeapons) mechSlots.clear();
    team.reset();
    hung = makeFighter(playerId, 'hung');
    mai = makeFighter(localMode === 'team' ? team.cpuIds[0] : opponentId, 'mai');
    hung.heroEnergy = hung.heroForm ? heroEnergy[0] : 0;
    mai.heroEnergy = mai.heroForm ? heroEnergy[1] : 0;
    if (carried[0]) setMainWeapon(hung, carried[0], true);
    if (carried[1]) setMainWeapon(mai, carried[1], true);
    if (practice) hung.awakeningUnlocked = true;
    seconds = campaignRun?.stage.seconds ?? roundLength;
    stageFrame = 0;
    world.stageFrame = 0;
    ball = createStageBall(stage, world.width);
    pickups.reset(partyItems, keepMainWeapons);
    hitstop = shake = toastClock = 0;
    clearInputs();
    cpu = new CpuController(difficulty, config);
    particles.length = 0;
    floaters.length = projectiles.length = trails.length = 0;
    screenEffect = null;
    ui.toast.classList.remove('show');
    updateRoster();
  }

  function beginRound(fitViewport = false) {
    panels.show('');
    if (fitViewport) {
      // Keep a fixed physics size during the match, including when the TV enters fullscreen.
      const viewportWidth = canvas.clientWidth * world.height / Math.max(1, canvas.clientHeight);
      world.width = Math.min(1600, Math.max(minimumArenaWidth, Math.round(viewportWidth)));
    }
    resetFighters(!fitViewport);
    phase = 'countdown';
    phaseTime = 3;
    canvas.focus({ preventScroll: true });
    panels.showBanner('3');
    panels.setPauseAvailable(true);
    ui['status-text'].textContent = 'CHUẨN BỊ';
    if (round === 1 && hung.quote) toast(hung.quote, 2);
    audio.cue('countdown');
  }

  function startMatch() {
    keyboardHintUntil = 0;
    if (campaignRun) campaignRun.serial = campaignProgress(equipment, config.campaign).serial + 1;
    if (practice) training.resetActivity();
    audio.unlock();
    winsHung = winsMai = damageHung = damageMai = 0;
    round = 1;
    beginRound(true);
  }

  function openSetup(isPractice, mode = '') {
    campaignRun = null;
    practice = isPractice;
    localMode = mode;
    phase = 'setup';
    pairing.updateSetupButton(lan || Boolean(localMode));
    panels.showSetup(practice, lan, localMode);
  }

  function returnToMenu() {
    training.resetActivity();
    phase = 'menu';
    campaignRun = null;
    practice = lan = false;
    localMode = '';
    partyItems = false;
    bestOf = 3;
    pairing.close();
    winsHung = winsMai = damageHung = damageMai = 0;
    round = 1;
    resetFighters();
    panels.showBanner('');
    panels.setPauseAvailable(false);
    ui['status-text'].textContent = 'CHỌN CHẾ ĐỘ CHƠI';
    panels.show('menu');
  }

  function togglePause() {
    if (phase === 'paused') {
      phase = pausedPhase;
      panels.show('');
      canvas.focus({ preventScroll: true });
      panels.restoreBanner();
      panels.setPauseAvailable(true);
      audio.unlock();
    } else if (phase === 'countdown' || phase === 'fight') {
      pausedPhase = phase;
      phase = 'paused';
      clearInputs();
      panels.hideBanner();
      panels.setPauseAvailable(false);
      panels.show('pause');
    }
  }

  function saveSettings() {
    persistSettings(settings);
    audio.configure(settings);
    audio.unlock();
  }

  function selectMatch(player, opponent, level, stageId, hazards, items, rounds) {
    setStage(stageId, hazards);
    partyItems = items;
    bestOf = roundFormats.includes(rounds) ? rounds : 3;
    playerId = player;
    if (localMode === 'team') team.selectCpu(config.characters.hung ? 'hung' : player);
    opponentId = opponent;
    difficulty = level;
    if (pairing.solo) pairing.moveToDetails();
    startMatch();
  }

  const panels = createPanels({ characters: config.characters, stages: config.stages, combat: config.combat,
    preloadFighter: render.preloadFighter,
    settings, equipment, openSetup, openLan, returnToMenu, togglePause, startMatch, selectMatch, saveSettings,
    setMusicFile: (id, file) => audio.setMusicFile(id, file),
    setMusicPreview: active => audio.setMusicPreview(active) });

  const showCampaign = createCampaignPanel(config, equipment, {
    show: panels.show,
    openEquipment: fighter => panels.showEquipment(fighter, () => openCampaign()),
    start: startCampaign,
  });

  function openCampaign(index) {
    const saved = !pendingCampaign || saveCampaignResult();
    phase = 'campaign';
    campaignRun = null;
    lan = practice = false;
    localMode = '';
    pairing.close();
    panels.showBanner('');
    panels.setPauseAvailable(false);
    showCampaign(index, saved ? '' : 'Kết quả đang chờ lưu. Bấm Vào ải để thử lưu lại trước khi chơi.');
  }

  function startCampaign(index, fighter) {
    if (pendingCampaign && !saveCampaignResult()) return;
    const progress = campaignProgress(equipment, config.campaign);
    if (phase !== 'campaign' || !availableStage(config.campaign, progress, index) || !config.characters[fighter]) return;
    const stage = config.campaign[index];
    campaignRun = { index, stage };
    setStage(stage.stage, stage.hazards);
    playerId = fighter;
    opponentId = stage.opponent;
    difficulty = stage.difficulty;
    bestOf = stage.bestOf;
    partyItems = false;
    startMatch();
  }

  function saveCampaignResult() {
    if (!pendingCampaign) return true;
    const { index, serial, won, score } = pendingCampaign;
    const reward = settleStage(equipment, config.campaign, { index, serial, won });
    const saved = Boolean(reward?.saved);
    const next = won && index + 1 < config.campaign.length;
    const complete = won && !next;
    byId('campaign-save').hidden = saved;
    byId('campaign-next').hidden = !saved || !next;
    byId('campaign-replay').disabled = !saved;
    byId('campaign-replay').textContent = won ? 'Chơi lại' : 'Thử lại';
    byId('campaign-replay').classList.toggle('primary-button', saved && !next && !complete);
    byId('campaign-replay').classList.toggle('panel-button', !saved || next || complete);
    byId('campaign-list').classList.toggle('primary-button', saved && complete);
    byId('campaign-list').classList.toggle('panel-button', !saved || !complete);
    byId('campaign-result-stage').textContent = config.campaign[index].name;
    byId('campaign-result-stage').hidden = false;
    byId('campaign-payout').hidden = !saved || !won;
    const message = [];
    if (saved) {
      if (won) {
        byId('campaign-payout-title').textContent = reward.first ? 'Đã nhận thưởng lần đầu' : 'Đã nhận thưởng chơi lại';
        byId('campaign-payout-gold').textContent = '+' + reward.gold;
        byId('campaign-payout-material').textContent = '+' + reward.material;
        byId('campaign-payout-gear').hidden = !reward.item;
        byId('campaign-payout-item').textContent = reward.item ? catalog[reward.item].name : '';
      } else message.push('Thắng trận để nhận thưởng của ải.');
      if (reward.reserved) message.push('Kho đầy. ' + catalog[config.campaign[index].first.item].name + ' đang chờ nhận ở danh sách ải.');
      if (next && reward.first) message.push('Đã mở ' + config.campaign[index + 1].name);
      if (complete) message.push('Có thể chơi lại mọi ải đã mở.');
      pendingCampaign = null;
    } else message.push('Chưa lưu kết quả hoặc cộng thưởng. Bạn có thể thử lưu lại.');
    panels.setResult(complete && saved ? 'Hoàn thành tuyến Vượt Ải' : won ? 'Vượt ải thành công' : 'Chưa vượt ải', score, message.join(' · '));
    return saved;
  }

  byId('campaign-button').addEventListener('click', () => openCampaign());
  byId('campaign-list').addEventListener('click', () => { if (campaignRun) openCampaign(campaignRun.index); });
  byId('campaign-next').addEventListener('click', () => { if (campaignRun) openCampaign(campaignRun.index + 1); });
  byId('campaign-replay').addEventListener('click', () => { if (phase === 'over' && !pendingCampaign) startMatch(); });
  byId('campaign-result-equipment').addEventListener('click', () => {
    if (!campaignRun) return;
    const { index } = campaignRun;
    panels.showEquipment(playerId, () => openCampaign(index));
  });
  byId('campaign-save').addEventListener('click', saveCampaignResult);

  const pairing = createControllerPairing({
    byId,
    canPlay: solo => (lan || solo) && phase === 'fight',
    onContinue: () => openSetup(practice),
    showLobby: () => panels.show('lan'),
  });

  function openLan() {
    campaignRun = null;
    lan = true;
    practice = false;
    phase = 'lan';
    pairing.open();
  }

  const trainingPanel = createTrainingPanel(training, createTrainingActions(training, {
    canUse: canTrain,
    fighters: () => [hung, mai],
    resetFighters,
    updateScore,
    focusArena: () => canvas.focus({ preventScroll: true }),
  }));

  function boundAction(event, side) {
    const code = keyCode(event);
    const action = Object.keys(settings.bindings[side]).find(id => settings.bindings[side][id] === code);
    if (action || side || lan || localMode) return action;
    const arrowAction = ({ ArrowLeft: 'a', ArrowRight: 'd', ArrowUp: 'w', ArrowDown: 's' })[code];
    return settings.bindings[0][arrowAction] === defaultBindings[0][arrowAction] ? arrowAction : undefined;
  }

  function showCompositionHint() {
    keyboardHintUntil = performance.now() + 7000;
  }

  const keyboard = createKeyboard({
    canPlay: () => phase === 'fight',
    canPause: () => !byId('utility-dialog').open && ['fight', 'countdown', 'paused'].includes(phase),
    onPause: togglePause,
    onCompositionIssue: showCompositionHint,
    keyFor: event => boundAction(event, 0),
    onInput: label => { if (canTrain()) training.noteInput(label); },
    onClear: () => {
      hung.crouching = false;
      hung.superMotionFrames = hung.airDirection = 0;
      hung.setGuard(false);
    },
  });

  const keyboardP2 = createKeyboard({
    canPlay: () => (lan || localMode) && phase === 'fight',
    canPause: () => false,
    onCompositionIssue: showCompositionHint,
    keyFor: event => boundAction(event, 1),
    onClear: () => {
      mai.crouching = false;
      mai.superMotionFrames = mai.airDirection = 0;
      mai.setGuard(false);
    },
  });
  function clearInputs() {
    hung.chargeFrames = mai.chargeFrames = 0;
    hung.bufferedAttack = mai.bufferedAttack = null;
    keyboard.clear();
    keyboardP2.clear();
    pairing.clear();
  }

  function useAttack(fighter, target, id, crouch = false) {
    const skill = id === 'motionSuper' ? superAttackFor(fighter) : fighter.skillFor(id);
    const crouchAttack = crouch && fighter.onGround ? fighter.crouchAttacks?.[id] : undefined;
    const airAttack = hungAirAttack(fighter, target, id);
    if (fighter.hungAirChain && (id === 'light' || id === 'heavy') && !airAttack) return false;
    const normal = fighter.attacks[id];
    const equipment = crouchAttack || airAttack ? undefined : equippedAttack(fighter, id);
    const main = crouchAttack || airAttack || normal?.hungKick ? undefined : mainWeaponAttack(fighter, id);
    const started = fighter.startAttack(id, airAttack ?? crouchAttack ?? equipment ?? main ?? skill ?? normal, target);
    if (started && equipment) {
      fighter.weaponUses = equipment.projectile?.shape === 'slipper' ? 0 : fighter.weaponUses - 1;
      toast(equipment.label.toUpperCase());
    }
    if (started && !equipment && (main || skill)) toast((main ?? skill).label.toLocaleUpperCase('vi'));
    return started;
  }

  function dropWeapon(fighter) {
    if (phase !== 'fight' || fighter.disabled || fighter.attacking || fighter.dash) return false;
    if (!pickups.release(fighter, stageFrame, world)) return false;
    toast(fighter.name + ' · Thả vũ khí');
    return true;
  }
  dropWeaponButton.addEventListener('click', () => {
    dropWeapon(hung);
    canvas.focus({ preventScroll: true });
  });

  function activateAwakening(fighter) {
    if (fighter.heroForm) {
      if (!startHeroForm(fighter)) return false;
      const form = fighter.activeHeroForm;
      if (form.mech) mechSlots.add(fighter.matchSlot);
      audio.cue('awaken');
      burst(fighter.x, fighter.y - 34, form.mech ? 60 : 44, form.color);
      toast(fighter.quote + ' · ' + form.label.toLocaleUpperCase('vi'));
      return true;
    }
    if (!fighter.awaken()) return false;
    audio.cue('awaken');
    toast(fighter.name + ' · TIẾN HÓA CẤP ' + fighter.awakeningLevel + '!');
    const color = fighter.evolution?.color ?? fighter.glow;
    const advanced = fighter.awakeningLevel === 2;
    burst(fighter.x, fighter.y - 16, advanced ? 64 : 38, color);
    shake = Math.max(shake, advanced ? .34 : .24);
    return true;
  }

  function requestAwakening(fighter) {
    if (activateAwakening(fighter)) return true;
    if (practice && fighter === mai) return false;
    if (fighter.heroForm) {
      const next = nextHeroForm(fighter);
      toast(next ? 'Cần đầy năng lượng và đứng vững · ' + Math.floor(fighter.heroEnergy) + '/' + heroEnergyMax
        : fighter.heroMechUsed && fighter.heroStage === 2 ? 'Lam Kình đã dùng trong trận này'
        : fighter.activeHeroForm.label + ' đang hoạt động');
      return false;
    }
    if (!fighter.nextAwakening) toast('Đã đạt cấp tiến hóa tối đa', 2);
    else if (!fighter.awakeningUnlocked) toast(fighter.awakening.condition, 2.5);
    else if (fighter.meter < fighter.meterMax) toast('Cần đầy nộ để tiến hóa', 2);
    else toast('Đứng vững và kết thúc đòn đang dùng để tiến hóa', 2);
    return false;
  }

  transformButton.addEventListener('click', () => {
    if (phase === 'fight' && requestAwakening(hung)) updateScore();
    canvas.focus({ preventScroll: true });
  });

  function update(dt) {
    if (phase === 'paused') return;
    if (hitstop === 0 || phase !== 'fight') animationTime += dt * 1000;
    if (phase === 'countdown') {
      phaseTime -= dt;
      const count = Math.ceil(phaseTime - 1e-8);
      if (count <= 0) {
        phase = 'fight';
        if (round === 1 && windowsKeyboard) showCompositionHint();
        phaseTime = .6;
        panels.showBanner('FIGHT');
        audio.cue('fight');
      } else if (panels.bannerMessage() !== String(count)) {
        panels.showBanner(String(count));
        audio.cue('countdown');
      }
      return;
    }
    if (screenEffect) screenEffect.elapsed += dt;
    for (let i = trails.length - 1; i >= 0; i--) {
      trails[i].life -= dt;
      if (trails[i].life <= 0) trails.splice(i, 1);
    }
    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; });
    floaters.forEach(f => { f.y -= 28 * dt; f.life -= dt; });
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
    for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i].life <= 0) floaters.splice(i, 1);
    toastClock = Math.max(0, toastClock - dt);
    shake = Math.max(0, shake - dt);
    if (phase === 'round-over') {
      for (const fighter of [hung, mai]) {
        fighter.updateVertical(dt, world);
        fighter.flash = Math.max(0, fighter.flash - dt);
        fighter.moving = false;
      }
      phaseTime -= dt;
      if (phaseTime <= 0) {
        if (nextRound) beginRound();
        else {
          phase = 'over';
          panels.showBanner('');
          panels.show('result');
        }
      }
      return;
    }
    if (phase !== 'fight') return;
    if (!practice) seconds = Math.max(0, seconds - dt);
    if (hitstop > 0) {
      hitstop--;
      if (!practice && seconds <= 0) finishRound();
      return;
    }

    if (phaseTime > 0) {
      phaseTime -= dt;
      if (phaseTime <= 0) panels.showBanner('');
    }
    const movementStart = [hung.x, mai.x];
    const local = keyboard.consumeActions();
    const second = keyboardP2.consumeActions();
    const input = lan || pairing.solo ? mergeInputs(local, pairing.consume(0)) : local;
    const replay = practice ? training.step(input) : null;
    const autoFaceOpponent = !lan && localMode !== 'versus' && !replay;
    if (autoFaceOpponent) faceOpponent(mai, hung);
    applyControls(hung, mai, localMode === 'team' && team.activePlayer ? second : input, controlRules);
    if (lan) {
      applyControls(mai, hung, mergeInputs(second, pairing.consume(1)), controlRules);
    } else if (localMode === 'versus') {
      applyControls(mai, hung, second, controlRules);
    } else if (replay) {
      mai.lowGuardOnly = false;
      applyControls(mai, hung, { ...replay, direction: -replay.direction, dashDirection: -replay.dashDirection }, controlRules);
    } else if (practice && training.mode !== 'cpu') {
      training.controlDummy(mai, dt, config.stage.jumpVelocity);
    } else if (practice) {
      mai.lowGuardOnly = false;
      mai.crouching = false;
    }
    if (!lan && localMode !== 'versus' && !replay && (!practice || training.mode === 'cpu')) {
      const usedAwakening = Math.abs(mai.x - hung.x) > 165 && activateAwakening(mai);
      if (!usedAwakening) cpu.update(dt, mai, hung, projectiles, world, id => useAttack(mai, hung, id), () => {
        const escaped = mai.escapeFrom(hung, world.width);
        if (!escaped) return false;
        toast(escaped === 'wall' ? 'BẬT TƯỜNG THOÁT GÓC!' : mai.name.toUpperCase() + ' THOÁT COMBO!');
        return true;
      });
    }
    const walkingSteps = [hung.x - movementStart[0], mai.x - movementStart[1]];
    stageFrame++;
    world.stageFrame = stageFrame;
    applyStageEffects(world, hung, movementStart[0], stageFrame, dt);
    applyStageEffects(world, mai, movementStart[1], stageFrame, dt);
    const previousX = [hung.x, mai.x];
    const wasAirborne = [!hung.onGround, !mai.onGround];
    const wallRebounds = [hung.update(dt, world, mai), mai.update(dt, world, hung)];
    updateStageBall(ball, [hung, mai], world.width, dt);
    for (const [index, fighter] of [hung, mai].entries()) {
      if (wallRebounds[index]) {
        const edge = fighter.x < world.width / 2 ? 0 : world.width;
        burst(edge, fighter.y - fighter.height * .56, 14, '#ffd6a3');
        shake = Math.max(shake, .16);
      }
      if (wasAirborne[index] && fighter.onGround) burst(fighter.x, fighter.y - 2, 4, '#d2ba97');
      if (fighter.dash?.elapsed === 1) audio.cue('dash');
      const attack = fighter.attack;
      if (attack && attack.elapsed === attack.startup) {
        if (attack.id === 'ultimate' || attack.id === 'motionSuper') audio.cue('ultimate');
        else if (fighter.skills[attack.id]) audio.cue('skill');
      }
      const effect = attack?.effect;
      if (!effect || !fighter.attackActive) continue;
      const finishingRush = attack.visual === 'fireRush' && attack.elapsed === attack.startup + attack.pulses.at(-1).from;
      if (finishingRush || (attack.elapsed === attack.startup && attack.visual !== 'fireRush')) {
        screenEffect = { ...effect, elapsed: 0 };
        const impactX = fighter.x + (finishingRush || attack.visual === 'fireGuardian' ? attack.facing * 42 : 0);
        burst(impactX, fighter.y - fighter.height / 2, effect.particles, effect.color);
      }
      if (effect.trailSeconds && previousX[index] !== fighter.x) {
        trails.push({
          from: previousX[index], to: fighter.x, y: fighter.y,
          life: effect.trailSeconds, total: effect.trailSeconds, color: effect.color,
        });
      }
    }
    if (autoFaceOpponent) faceOpponent(mai, hung);
    for (const [index, fighter] of [hung, mai].entries()) {
      const step = fighter.x - movementStart[index];
      const intended = walkingSteps[index];
      fighter.moving = Math.abs(step) > .1 && Math.abs(intended) > .1 && step * intended > 0
        && fighter.onGround && !fighter.disabled
        && fighter.canMoveDuringAttack && !fighter.dash && !fighter.blocking;
      if (fighter.moving) {
        fighter.walkDistance += Math.sign(step) * fighter.facing * Math.min(Math.abs(step), Math.abs(intended));
      } else {
        fighter.walkDistance = 0;
      }
    }
    for (const [fighter, target] of [[hung, mai], [mai, hung]]) {
      if (fighter.characterId === 'vy' && fighter.awakeningWindow
        && (target.x - fighter.x) * fighter.awakeningSide < -8) fighter.awakeningUnlocked = true;
    }
    const contacts = [
      findHit(hung, mai), findHit(mai, hung),
      ...updateProjectiles(projectiles, [hung, mai], dt, world),
    ].filter(Boolean);
    const hits = contacts.map(applyHit);
    hits.forEach(hitEffects);
    if (hung.hp <= 0 || mai.hp <= 0) {
      hung.hungFollow = hung.hungAirChain = mai.hungFollow = mai.hungAirChain = null;
    }
    for (const fighter of [hung, mai]) {
      if (fighter.knockdown || fighter.hp <= 0) pickups.release(fighter, stageFrame, world, true);
      if (reviveFighter(fighter, revivedSlots)) toast(fighter.name.toUpperCase() + ' · HỒI SINH');
    }
    for (const pickup of pickups.update([hung, mai], stageFrame, world)) {
      const { label, color } = pickup;
      toast(pickup.fighter.name + ' · ' + label.toUpperCase());
      burst(pickup.fighter.x, pickup.fighter.y - 22, 18, color);
    }
    if (practice) for (const hit of hits) training.trackHit(hit, hung, mai);
    hung.endFrame();
    mai.endFrame();

    if (practice) {
      if (hung.hp <= 0) hung.hp = hung.maxHp;
      if (mai.hp <= 0) mai.hp = mai.maxHp;
    } else if (seconds <= 0 || hung.hp <= 0 || mai.hp <= 0) {
      if (localMode !== 'team' || !callReserves()) finishRound();
    }
  }

  function callReserves() {
    const reserves = team.callReserves(hung, mai, seconds, opponentId, makeFighter);
    if (!reserves) return false;
    hung = reserves.player;
    mai = reserves.cpu;
    if (reserves.cpuOut) cpu = new CpuController(difficulty, config);
    hung.x = fighterX('hung');
    mai.x = fighterX('mai');
    for (const fighter of [hung, mai]) {
      fighter.y = groundHeightAt(world, fighter.x);
      fighter.vy = 0;
      fighter.onGround = true;
    }
    clearInputs();
    projectiles.length = 0;
    updateRoster();
    toast(reserves.message);
    return true;
  }

  function hitEffects(hit) {
    const { attacker, blocked, broken, combo, damage, x, y } = hit;
    if (!practice) {
      if (attacker === hung) damageHung += Math.round(damage * 100);
      if (attacker === mai) damageMai += Math.round(damage * 100);
      if (attacker === hung) damageMai += Math.round(hit.reflected * 100);
      if (attacker === mai) damageHung += Math.round(hit.reflected * 100);
    }
    if (hit.inflicted) {
      const effects = { freeze: ['ĐÓNG BĂNG', '#b1eeff'], shatter: ['VỠ BĂNG', '#a9e4ff'], poisonStun: ['CHOÁNG DO ĐỘC', '#b9f28a'] };
      const [label, color] = effects[hit.inflicted];
      toast(label);
      burst(x, y, 18, color);
    }
    const isKick = hit.attack.id === 'kick' || (hit.attack.hungKick && hit.attack.hungKick !== 'airJ')
      || ['kick', 'sweep'].includes(hit.attack.animation);
    audio.cue(blocked ? 'block' : isKick ? 'kick' : hit.attack.id === 'heavy' ? 'heavy' : 'hit');
    hitstop = Math.max(hitstop, hit.hitstop);
    shake = Math.max(shake, hit.hitstop ? .14 : .07);
    if (hit.reflected) {
      toast('PHẢN ĐÒN · ' + damageFormat.format(hit.reflected));
      burst(attacker.x, attacker.y - attacker.height * .55, 9, '#ffbb78');
    } else if (broken) toast('VỠ THẾ THỦ!');
    else if (hit.critical && damage) toast('CHÍ MẠNG!');
    else if (combo >= 2) toast(attacker.name.toUpperCase() + ' · COMBO ' + combo + ' HIT');
    else if (blocked) toast('ĐỠ ĐÒN!');
    const sparkType = blocked ? 'guard' : isKick ? 'kick' : 'hit';
    floaters.push({ x, y: y - 18, contactY: y, life: .75, total: .75,
      text: !damage && hit.absorbed ? 'GIÁP' : '−' + damageFormat.format(damage), blocked, sparkType, facing: hit.attack.facing });
    const evolvedPunch = hit.attack.evolvedPunch && !blocked;
    burst(x, y, evolvedPunch ? 22 : blocked ? 5 : 11,
      evolvedPunch ? '#ffcc53' : blocked ? '#a9d9ff' : hit.attack.effect?.color,
      evolvedPunch ? hit.direction : 0);
  }

  function burst(x, y, count, color, punchDirection = 0) {
    const ground = world.height * config.stage.groundRatio;
    for (let i = 0; i < count; i++) {
      const angle = punchDirection ? -.2 - Math.random() * .85 : Math.random() * Math.PI * 2;
      const speed = 55 + Math.random() * 170;
      particles.push({
        x, y: ground + y, vx: Math.cos(angle) * speed * (punchDirection || 1),
        vy: Math.sin(angle) * speed - (punchDirection ? 48 : 0),
        life: .18 + Math.random() * .17, size: 2 + Math.random() * 3,
        color: color ?? (i % 2 ? '#ffcb7c' : '#fff1cf'),
      });
    }
  }

  function toast(text, duration = .65) { ui.toast.textContent = text; ui.toast.classList.add('show'); toastClock = duration; }
  function finishRound() {
    phase = 'round-over';
    phaseTime = 1.35;
    hung.stopFlight();
    mai.stopFlight();
    hung.hungFollow = hung.hungAirChain = mai.hungFollow = mai.hungAirChain = null;
    clearInputs();
    mai.blocking = false;
    panels.setPauseAvailable(false);
    ui.toast.classList.remove('show');
    const knockout = hung.hp <= 0 || mai.hp <= 0;
    panels.showBanner(knockout ? 'K.O.' : 'HẾT GIỜ', true);
    audio.cue(knockout ? 'ko' : 'time');
    let lead = Math.round(hung.hp * 100) * mai.maxHp - Math.round(mai.hp * 100) * hung.maxHp;
    if (localMode === 'team') lead = team.lead(hung, mai, knockout);
    if (lead > 0) winsHung++;
    if (lead < 0) winsMai++;
    updateScore();
    nextRound = Math.max(winsHung, winsMai) < Math.ceil(bestOf / 2);
    const winner = localMode === 'team' ? (lead > 0 ? 'ĐỘI NGƯỜI CHƠI' : 'ĐỘI CPU') : (lead > 0 ? hung : mai).name.toUpperCase();
    const headToHead = lan || localMode === 'versus';
    const sideLabel = lead > 0 ? 'P1' : headToHead ? 'P2' : 'CPU';
    ui['status-text'].textContent = lead === 0 ? 'Hiệp hòa · Đấu lại'
      : (localMode === 'team' ? winner : sideLabel + ' · ' + (lead > 0 ? hung.name : mai.name)) + ' thắng hiệp';
    if (!nextRound && campaignRun) {
      const won = winsHung > winsMai;
      pendingCampaign = { index: campaignRun.index, serial: campaignRun.serial, won,
        score: hung.name + ' ' + winsHung + ' – ' + winsMai + ' ' + mai.name + ' (CPU)' };
      byId('quick-result-actions').hidden = true;
      byId('campaign-result-actions').hidden = false;
      saveCampaignResult();
      return;
    }
    byId('quick-result-actions').hidden = false;
    byId('campaign-result-actions').hidden = true;
    let rewardText = '';
    if (!nextRound && isPve()) {
      const reward = awardEquipment(equipment, winsHung > winsMai, difficulty);
      const saved = saveEquipment(equipment);
      rewardText = '+' + reward.gold + ' gold · +' + reward.material + ' nguyên liệu';
      if (reward.item) rewardText += ' · Mở ' + reward.item.name + ' (' + rarities[reward.item.tier] + ')';
      if (!saved) rewardText += ' · Lưu trong phiên này';
    }
    panels.setResult(
      localMode === 'team' ? (winsHung > winsMai ? 'Đội người chơi thắng' : 'Đội CPU thắng') : headToHead ? 'P' + (winsHung > winsMai ? '1' : '2') + ' thắng trận' : winsHung > winsMai ? 'Chiến thắng' : 'Thất bại',
      (localMode === 'team' ? 'Đội người chơi' : 'P1 · ' + hung.name) + ' ' + winsHung + ' – ' + winsMai
        + (localMode === 'team' ? ' Đội CPU' : (headToHead ? ' P2 · ' : ' CPU · ') + mai.name),
      rewardText,
    );
    if (nextRound && lead !== 0) round++;
  }

  function frame(now) {
    if (lastTime !== undefined) accumulator += Math.min((now - lastTime) / 1000, .1);
    lastTime = now;
    const previousHP = [hung.hp, mai.hp];
    const previousBarriers = [hung.awakeningBarrier, mai.awakeningBarrier];
    const previousDamage = damageHung + damageMai;
    const previousSecond = Math.ceil(seconds);
    while (accumulator >= FRAME_SECONDS) {
      previousPositions = [hung, mai].map(fighter => ({
        fighter, x: fighter.x, y: fighter.y, stride: fighter.walkDistance, moving: fighter.moving,
      }));
      update(FRAME_SECONDS);
      accumulator -= FRAME_SECONDS;
    }
    if (previousHP[0] !== hung.hp || previousHP[1] !== mai.hp
      || previousBarriers[0] !== hung.awakeningBarrier || previousBarriers[1] !== mai.awakeningBarrier
      || previousSecond !== Math.ceil(seconds) || previousDamage !== damageHung + damageMai) updateScore();
    dropWeaponButton.hidden = phase !== 'fight' || !(hung.weapon || hung.weaponUses);
    dropWeaponButton.disabled = Boolean(hung.disabled || hung.attacking || hung.dash);
    const formReady = hung.heroForm ? nextHeroForm(hung) && hung.heroEnergy >= heroEnergyMax : hung.awakeningReady;
    transformButton.hidden = phase !== 'fight' || !formReady;
    const transformLabel = hung.heroUpgrades ? 'BIẾN HÌNH CẤP ' + (hung.heroStage + 1)
      : hung.heroForm ? 'BIẾN HÌNH' : 'TIẾN HÓA CẤP ' + hung.nextAwakening;
    if (transformButton.firstElementChild.textContent !== transformLabel) transformButton.firstElementChild.textContent = transformLabel;
    transformButton.disabled = !hung.canFocus;
    if (phase === 'fight') {
      const status = hung.hitstun > 0
        ? 'CHOÁNG · GIỮ A/D ĐỂ DI CHUYỂN KHI HẾT CHOÁNG'
        : 'ĐẤU ĐI — ĐỪNG ĐỂ LỘ SƠ HỞ';
      if (ui['status-text'].textContent !== status) ui['status-text'].textContent = status;
    }
    hud.updateMeterUI(hung, 'hung', settings.bindings[localMode === 'team' ? team.activePlayer : 0]);
    hud.updateMeterUI(mai, 'mai', lan || localMode === 'versus' ? settings.bindings[1] : null);
    const followHint = phase === 'fight' && canFollowHungLaunch(hung, mai) ? keyLabel(settings.bindings[0].l) : '';
    trainingPanel.update(practice && ['countdown', 'fight', 'paused'].includes(phase), hung, mai, followHint);
    const fighters = [hung, mai];
    const debug = practice && training.debug;
    const remaining = 1 - accumulator / FRAME_SECONDS;
    const offsets = fighters.map((fighter, index) => {
      const previous = previousPositions[index];
      if (previous?.fighter !== fighter || phase !== 'fight' || hitstop || debug) return [0, 0];
      const dx = previous.x - fighter.x, dy = previous.y - fighter.y;
      if (Math.hypot(dx, dy) > 24) return [0, 0]; // Snap across teleports.
      return [dx * remaining, dy * remaining];
    });
    const movementPoses = fighters.map((fighter, index) => {
      const previous = previousPositions[index];
      if (!['hung', 'mai'].includes(fighter.characterId) || phase !== 'fight' || hitstop || debug || previous?.fighter !== fighter) return null;
      const stride = previous.moving && fighter.moving
        ? fighter.walkDistance + (previous.stride - fighter.walkDistance) * remaining : fighter.walkDistance;
      return { stride, jumpFrames: Math.max(0, (fighter.runJump?.frames ?? 0) - remaining) };
    });
    if (!['menu', 'setup', 'lan', 'campaign'].includes(phase)) render({ stage, stageFrame, width: world.width, fighters, offsets, movementPoses, projectiles, particles, floaters, trails,
      shake, screenEffect, animationTime, debug, ball, drop: pickups.drop, looseWeapons: pickups.loose,
      seasonActive: phase === 'fight' || phase === 'countdown' || phase === 'paused' });
    if (toastClock <= 0) ui.toast.classList.remove('show');
    keyboardHint.hidden = phase !== 'fight' || now >= keyboardHintUntil;
    requestAnimationFrame(frame);
  }
  setStage('rooftop', true);
  returnToMenu();
  requestAnimationFrame(frame);
}
