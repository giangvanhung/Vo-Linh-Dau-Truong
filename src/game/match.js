import { FRAME_SECONDS, Fighter, findHit, applyHit, updateProjectiles } from '../combat/fighter.js';
import { updateFacing } from '../combat/positioning.js';
import { CpuController } from '../combat/cpu.js';
import { GameAudio } from '../platform/audio.js';
import { createKeyboard, defaultBindings, keyCode } from '../platform/keyboard.js';
import { createLanHost, mergeInputs } from '../platform/lan.js';
import { loadSettings, persistSettings, roundFormats } from '../platform/settings.js';
import { createArenaRenderer } from '../render/arena.js';
import { createHud, damageFormat } from '../ui/hud.js';
import { createPanels } from '../ui/panels.js';
import { createTrainingPanel } from '../ui/training-panel.js';
import { applyStageEffects, stageForMatch } from './stages.js';
import { TrainingSession } from './training.js';
import { superAttack } from './super-motion.js';
import { applyControls } from './fighter-controls.js';
import { createPickups, equippedHeavy, gear } from './pickups.js';
import { createStageBall, updateStageBall } from './stage-ball.js';
import { awardEquipment, equipFighter, loadEquipment, rarities, saveEquipment } from './equipment.js';

export function startGame(config) {
  const canvas = document.querySelector('#arena');
  const render = createArenaRenderer(canvas, config);
  const byId = id => document.getElementById(id);
  const ui = { toast: byId('toast'), 'status-text': byId('status-text') };
  const hud = createHud(config);
  const settings = loadSettings();
  const equipment = loadEquipment();
  const training = new TrainingSession();
  const canTrain = () => practice && phase === 'fight';
  const controlRules = { jumpVelocity: config.stage.jumpVelocity, useAttack, activateAwakening: requestAwakening, toast };
  const audio = new GameAudio();
  audio.configure(settings);
  for (const event of ['click', 'keydown']) {
    window.addEventListener(event, () => audio.unlock(), { capture: true });
  }
  const world = { width: canvas.width, height: canvas.height, gravity: config.stage.gravity };
  let stage = stageForMatch(config.stage, config.stages.rooftop, true);
  let stageFrame = 0;
  let ball = null;
  let partyItems = false;
  const pickups = createPickups();
  function setStage(id, hazards) {
    stage = stageForMatch(config.stage, config.stages[id], hazards);
    Object.assign(world, { platforms: stage.platforms, zone: stage.zone });
    byId('stage-name').textContent = stage.name;
  }
  const roundLength = config.stage.roundSeconds;
  // The HUD IDs identify fixed sides. The fighters on each side are selected before a match.
  let hung, mai, phase = 'menu', seconds = roundLength, winsHung = 0, winsMai = 0, round = 1;
  let playerId = 'hung', opponentId = 'mai', practice = false, lan = false, pausedPhase;
  let phaseTime = 0, nextRound = false;
  let lastTime, accumulator = 0, toastClock = 0;
  let difficulty = 'normal', cpu;
  let bestOf = 3, damageHung = 0, damageMai = 0;
  let localMode = '', teamCpuIds = [], activePlayer = 0, activeCpu = 0;
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
    const fighter = new Fighter(config.characters[id], fighterX(side), side === 'hung' ? 1 : -1, config.combat);
    fighter.characterId = id;
    if (side === 'hung' || lan || localMode === 'versus') equipFighter(fighter, equipment, id, side === 'hung' && isPve() && phase !== 'menu');
    return fighter;
  }

  function updateRoster() {
    hud.updateRosterUI({ hung, mai, practice, difficulty, lan: lan || localMode === 'versus', team: localMode === 'team', activePlayer, activeCpu });
    updateScore();
  }

  function resetFighters() {
    activePlayer = activeCpu = 0;
    hung = makeFighter(playerId, 'hung');
    mai = makeFighter(localMode === 'team' ? teamCpuIds[0] : opponentId, 'mai');
    if (practice) hung.awakeningUnlocked = true;
    seconds = roundLength;
    stageFrame = 0;
    ball = createStageBall(stage, world.width);
    pickups.reset();
    hitstop = shake = toastClock = 0;
    clearInputs();
    cpu = new CpuController(difficulty, config);
    particles.length = 0;
    floaters.length = projectiles.length = trails.length = 0;
    screenEffect = null;
    ui.toast.classList.remove('show');
    updateRoster();
  }

  function beginRound() {
    resetFighters();
    phase = 'countdown';
    phaseTime = 3;
    panels.show('');
    canvas.focus({ preventScroll: true });
    panels.showBanner('3');
    panels.setPauseAvailable(true);
    ui['status-text'].textContent = 'CHUẨN BỊ';
    audio.cue('countdown');
  }

  function startMatch() {
    if (practice) resetTrainingActivity();
    audio.unlock();
    winsHung = winsMai = damageHung = damageMai = 0;
    round = 1;
    beginRound();
  }

  function openSetup(isPractice, mode = '') {
    practice = isPractice;
    localMode = mode;
    phase = 'setup';
    soloLanButton.hidden = lan || Boolean(localMode);
    soloLanButton.textContent = soloLan ? 'Mã QR tay cầm P1' : 'Kết nối tay cầm P1';
    panels.showSetup(practice, lan, localMode);
  }

  function returnToMenu() {
    resetTrainingActivity();
    phase = 'menu';
    practice = lan = false;
    localMode = '';
    bestOf = 3;
    soloLan = false;
    roomReady = false;
    lanHost.close();
    byId('lan-details').hidden = true;
    byId('lan-details').open = false;
    byId('network-mode').textContent = 'OFFLINE';
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
      if (!byId('guide-panel').hidden) {
        panels.show('pause');
        return;
      }
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
    const roster = Object.keys(config.characters);
    if (localMode === 'team') {
      const first = roster[Math.floor(Math.random() * roster.length)];
      const remaining = roster.filter(id => id !== first);
      teamCpuIds = [first, remaining[Math.floor(Math.random() * remaining.length)]];
    }
    opponentId = opponent === 'random' ? roster[Math.floor(Math.random() * roster.length)] : opponent;
    difficulty = level;
    if (soloLan) {
      byId('lan-details').append(pairing);
      byId('lan-details').hidden = false;
    }
    startMatch();
  }

  const panels = createPanels({ characters: config.characters, stages: config.stages, settings, equipment, openSetup, openLan, returnToMenu, togglePause, startMatch, selectMatch, saveSettings, setMusicFile: (id, file) => audio.setMusicFile(id, file) });

  const pairing = byId('lan-pairing');
  const address = byId('lan-address');
  const networkLabels = { wifi: 'Wi‑Fi', ethernet: 'Ethernet (cắm dây)', virtual: 'VPN / mạng ảo', other: 'Mạng khác', online: 'Internet' };
  const networkHints = {
    wifi: 'Dùng địa chỉ này khi điện thoại và máy tính kết nối cùng Wi‑Fi.',
    ethernet: 'Dùng địa chỉ này khi dây mạng máy tính nối vào cùng router phát Wi‑Fi cho điện thoại.',
    virtual: 'Địa chỉ VPN hoặc mạng ảo. Nếu điện thoại chỉ dùng Wi‑Fi, hãy chọn địa chỉ Wi‑Fi hoặc Ethernet.',
    other: 'Nếu chưa rõ đây là mạng nào, xem tên bộ điều hợp trong cài đặt mạng của máy tính.',
    online: 'Quét mã QR bằng điện thoại có kết nối Internet. TV và điện thoại có thể dùng hai mạng khác nhau.',
  };
  const soloLanButton = byId('solo-lan-button');
  let soloLan = false;
  let addresses = [];
  let connected = [false, false];
  let roomReady = false;
  function updateLanStatus() {
    if (!roomReady) return;
    byId('lan-status').textContent = (addresses.length ? '' : 'Không tìm thấy địa chỉ IPv4 LAN. ')
      + connected.slice(0, soloLan ? 1 : 2)
        .map((online, index) => 'P' + (index + 1) + (online ? ' có tay cầm' : ' dùng bàn phím')).join(' · ');
  }
  function updateLanAddress() {
    const option = addresses[Number(address.value)];
    byId('lan-link-box').hidden = !option;
    if (!option) return;
    byId('lan-network-help').hidden = option.type === 'online';
    const link = byId('lan-link');
    link.href = link.textContent = option.link;
    byId('lan-address-hint').textContent = networkHints[option.type] ?? networkHints.other;
    const qr = byId('lan-qr');
    qr.hidden = !option.qr;
    if (option.qr) qr.src = option.qr;
  }
  const lanHost = createLanHost({
    canPlay: () => (lan || soloLan) && phase === 'fight',
    onRoom(options) {
      addresses = options;
      address.options.length = 0;
      options.forEach(({ link, name, type }, index) => {
        const label = networkLabels[type] ?? networkLabels.other;
        const adapter = name && name.toLowerCase() !== type ? ` (${name})` : '';
        address.add(new Option(`${label}${adapter} · ${new URL(link).host}`, index));
      });
      byId('lan-address-label').hidden = options.length < 2;
      roomReady = true;
      updateLanAddress();
      updateLanStatus();
    },
    onStatus(players) {
      connected = players;
      updateLanStatus();
    },
    onClose() {
      roomReady = false;
      byId('lan-status').textContent = 'Mất kết nối phòng. Bàn phím vẫn dùng được. Về menu để tạo phòng mới.';
      byId('network-mode').textContent = 'LAN · MẤT KẾT NỐI';
      byId('lan-link-box').hidden = true;
      if (soloLan) soloLanButton.hidden = false;
      ui['status-text'].textContent = 'MẤT KẾT NỐI PHÒNG LAN';
    },
  });
  address.addEventListener('change', updateLanAddress);
  soloLanButton.addEventListener('click', () => {
    soloLan = true;
    showControllerRoom();
    if (!roomReady) openControllerRoom();
  });
  byId('lan-start').addEventListener('click', () => {
    byId('lan-details').append(pairing);
    byId('lan-details').hidden = false;
    openSetup(practice);
  });
  function openControllerRoom() {
    addresses = [];
    connected = [false, false];
    roomReady = false;
    byId('lan-keyboard-help').hidden = soloLan;
    byId('lan-status').textContent = 'Đang tạo phòng…';
    byId('lan-link-box').hidden = true;
    byId('network-mode').textContent = soloLan ? 'TAY CẦM LAN' : 'LAN';
    lanHost.open({ solo: soloLan });
  }

  function showControllerRoom() {
    byId('lan-title').textContent = soloLan ? 'Kết nối tay cầm P1' : 'Đấu 2 người qua LAN';
    byId('lan-lobby').append(pairing);
    pairing.querySelectorAll('details').forEach(details => { details.open = false; });
    panels.show('lan');
    byId('lan-start').focus({ preventScroll: true });
    byId('lan-panel').scrollTop = 0;
  }

  function openLan() {
    lan = true;
    practice = false;
    phase = 'lan';
    showControllerRoom();
    openControllerRoom();
  }

  function resetTrainingActivity() {
    training.recordState = 'idle';
    training.jumpClock = 0;
    training.inputs.length = 0;
    training.clearStats();
  }

  const trainingPanel = createTrainingPanel(training, {
    canUse: canTrain,
    resetPosition() {
      if (!canTrain()) return;
      const health = [hung.hp, mai.hp];
      const energy = [hung.meter, mai.meter];
      resetTrainingActivity();
      resetFighters();
      [hung.hp, mai.hp] = health;
      [hung.meter, mai.meter] = energy;
      updateScore();
    },
    resetHealth() {
      if (!canTrain()) return;
      hung.hp = hung.maxHp;
      mai.hp = mai.maxHp;
      updateScore();
    },
    testAwakening() {
      if (!canTrain()) return;
      hung.gainMeter(config.combat.meterMax);
      hung.awakeningUnlocked = true;
      if (!hung.nextAwakening) {
        hung.awakeningLevel = 0;
        hung.awakeningFrames = 0;
        hung.maxHp = hung.baseHp;
        hung.hp = Math.min(hung.hp, hung.maxHp);
      }
      updateScore();
      canvas.focus({ preventScroll: true });
    },
    resetMeter() {
      if (!canTrain()) return;
      hung.meter = mai.meter = 0;
    },
  });

  function boundAction(event, side) {
    const code = keyCode(event);
    const action = Object.keys(settings.bindings[side]).find(id => settings.bindings[side][id] === code);
    if (action || side || lan || localMode) return action;
    const arrowAction = ({ ArrowLeft: 'a', ArrowRight: 'd', ArrowUp: 'w', ArrowDown: 's' })[code];
    return settings.bindings[0][arrowAction] === defaultBindings[0][arrowAction] ? arrowAction : undefined;
  }

  const keyboard = createKeyboard({
    canPlay: () => phase === 'fight',
    canPause: () => ['fight', 'countdown', 'paused'].includes(phase),
    onPause: togglePause,
    keyFor: event => boundAction(event, 0),
    onInput: label => { if (canTrain()) training.noteInput(label); },
    onClear: () => {
      hung.crouching = false;
      hung.superMotionFrames = hung.lastControlDirection = hung.airDirection = 0;
      hung.setGuard(false);
    },
  });

  const keyboardP2 = createKeyboard({
    canPlay: () => (lan || localMode) && phase === 'fight',
    canPause: () => false,
    keyFor: event => boundAction(event, 1),
    onClear: () => {
      mai.crouching = false;
      mai.superMotionFrames = mai.lastControlDirection = mai.airDirection = 0;
      mai.setGuard(false);
    },
  });
  function clearInputs() {
    hung.chargeFrames = mai.chargeFrames = 0;
    hung.bufferedAttack = mai.bufferedAttack = null;
    keyboard.clear();
    keyboardP2.clear();
    lanHost.clear();
  }

  function useAttack(fighter, target, id) {
    const skill = id === 'motionSuper' ? superAttack : fighter.skillFor(id);
    const equipment = id === 'heavy' ? equippedHeavy(fighter) : null;
    const started = fighter.startAttack(id, equipment ?? skill ?? fighter.attacks[id], target);
    if (started && equipment) {
      fighter.weaponUses--;
      toast(equipment.label.toUpperCase());
    }
    if (started && skill) toast(skill.label.toLocaleUpperCase('vi'));
    return started;
  }

  function activateAwakening(fighter) {
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
    if (!fighter.nextAwakening) toast('Đã đạt cấp tiến hóa tối đa', 2);
    else if (!fighter.awakeningUnlocked) toast(fighter.awakening.condition, 2.5);
    else if (fighter.meter < fighter.rules.meterMax) toast('Cần đầy nộ để tiến hóa', 2);
    else toast('Đứng vững và kết thúc đòn đang dùng để tiến hóa', 2);
    return false;
  }

  function update(dt) {
    if (phase === 'paused') return;
    if (hitstop === 0 || phase !== 'fight') animationTime += dt * 1000;
    if (phase === 'countdown') {
      phaseTime -= dt;
      const count = Math.ceil(phaseTime - 1e-8);
      if (count <= 0) {
        phase = 'fight';
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
    updateFacing(hung, mai);
    const local = keyboard.consumeActions();
    const second = keyboardP2.consumeActions();
    const input = lan || soloLan ? mergeInputs(local, lanHost.consume(0)) : local;
    const replay = practice ? training.step(input) : null;
    applyControls(hung, mai, localMode === 'team' && activePlayer ? second : input, controlRules);
    if (lan) {
      applyControls(mai, hung, mergeInputs(second, lanHost.consume(1)), controlRules);
    } else if (localMode === 'versus') {
      applyControls(mai, hung, second, controlRules);
    } else if (replay) {
      mai.lowGuardOnly = false;
      applyControls(mai, hung, { ...replay, direction: -replay.direction }, controlRules);
    } else if (practice && training.mode !== 'cpu') {
      training.controlDummy(mai, dt, config.stage.jumpVelocity);
    } else if (practice) {
      mai.lowGuardOnly = false;
      mai.crouching = false;
    }
    if (!lan && localMode !== 'versus' && !replay && (!practice || training.mode === 'cpu')) {
      const usedAwakening = Math.abs(mai.x - hung.x) > 165 && activateAwakening(mai);
      if (!usedAwakening) cpu.update(dt, mai, hung, projectiles, world, id => useAttack(mai, hung, id), () => {
        if (!mai.escapeFrom(hung)) return false;
        toast(mai.name.toUpperCase() + ' THOÁT COMBO!');
        return true;
      });
    }
    const walkingSteps = [hung.x - movementStart[0], mai.x - movementStart[1]];
    stageFrame++;
    applyStageEffects(world, hung, movementStart[0], stageFrame, dt);
    applyStageEffects(world, mai, movementStart[1], stageFrame, dt);
    const previousX = [hung.x, mai.x];
    const wasAirborne = [!hung.onGround, !mai.onGround];
    hung.update(dt, world, mai);
    mai.update(dt, world, hung);
    updateStageBall(ball, [hung, mai], world.width, dt);
    for (const [index, fighter] of [hung, mai].entries()) {
      if (wasAirborne[index] && fighter.onGround) burst(fighter.x, fighter.y - 2, 4, '#d2ba97');
      if (fighter.dash?.elapsed === 1) audio.cue('dash');
      const attack = fighter.attack;
      if (attack && attack.elapsed === attack.startup) {
        if (attack.id === 'ultimate' || attack.id === 'motionSuper') audio.cue('ultimate');
        else if (fighter.skills[attack.id]) audio.cue('skill');
      }
      const effect = attack?.effect;
      if (!effect || !fighter.attackActive) continue;
      if (attack.elapsed === attack.startup) {
        screenEffect = { ...effect, elapsed: 0 };
        burst(fighter.x, fighter.y - fighter.height / 2, effect.particles, effect.color);
      }
      if (effect.trailSeconds && previousX[index] !== fighter.x) {
        trails.push({
          from: previousX[index], to: fighter.x, y: fighter.y,
          life: effect.trailSeconds, total: effect.trailSeconds, color: effect.color,
        });
      }
    }
    updateFacing(hung, mai);
    for (const [index, fighter] of [hung, mai].entries()) {
      const step = fighter.x - movementStart[index];
      const intended = walkingSteps[index];
      fighter.moving = Math.abs(step) > .1 && Math.abs(intended) > .1 && step * intended > 0
        && fighter.onGround && !fighter.disabled
        && !fighter.attack && !fighter.dash && !fighter.blocking;
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
    const pickup = partyItems && pickups.update([hung, mai], stageFrame, world.width);
    if (pickup) {
      const { label, color } = gear[pickup.kind];
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
    const playerOut = hung.hp <= 0, cpuOut = mai.hp <= 0;
    if (seconds <= 0 || (playerOut && activePlayer) || (cpuOut && activeCpu)) return false;
    if (playerOut) {
      activePlayer = 1;
      hung = makeFighter(opponentId, 'hung');
    }
    if (cpuOut) {
      activeCpu = 1;
      mai = makeFighter(teamCpuIds[1], 'mai');
      cpu = new CpuController(difficulty, config);
    }
    hung.x = fighterX('hung');
    mai.x = fighterX('mai');
    updateFacing(hung, mai);
    clearInputs();
    projectiles.length = 0;
    updateRoster();
    toast(playerOut && cpuOut ? 'P2 VÀ CPU 2 VÀO SÂN' : playerOut ? 'P2 VÀO SÂN' : 'CPU 2 VÀO SÂN');
    return true;
  }

  function hitEffects(hit) {
    const { attacker, blocked, broken, combo, damage, x, y } = hit;
    if (!practice) {
      if (attacker === hung) damageHung += Math.round(damage * 100);
      if (attacker === mai) damageMai += Math.round(damage * 100);
    }
    if (hit.inflicted) {
      const effects = { freeze: ['ĐÓNG BĂNG', '#b1eeff'], shatter: ['VỠ BĂNG', '#a9e4ff'], poisonStun: ['CHOÁNG DO ĐỘC', '#b9f28a'] };
      const [label, color] = effects[hit.inflicted];
      toast(label);
      burst(x, y, 18, color);
    }
    const isKick = hit.attack.id === 'kick' || ['kick', 'sweep'].includes(hit.attack.animation);
    audio.cue(blocked ? 'block' : isKick ? 'kick' : hit.attack.id === 'heavy' ? 'heavy' : 'hit');
    hitstop = Math.max(hitstop, hit.hitstop);
    shake = Math.max(shake, hit.hitstop ? .14 : .07);
    if (broken) toast('VỠ THẾ THỦ!');
    else if (hit.critical && damage) toast('CHÍ MẠNG!');
    else if (combo >= 2) toast(attacker.name.toUpperCase() + ' · COMBO ' + combo + ' HIT');
    else if (blocked) toast('ĐỠ ĐÒN!');
    const sparkType = blocked ? 'guard' : isKick ? 'kick' : 'hit';
    floaters.push({ x, y: y - 18, contactY: y, life: .75, total: .75,
      text: !damage && hit.absorbed ? 'GIÁP' : '−' + damageFormat.format(damage), blocked, sparkType, facing: hit.attack.facing });
    const evolvedPunch = hit.attack.evolvedPunch && !blocked;
    burst(x, y, evolvedPunch ? 22 : blocked ? 5 : 11,
      evolvedPunch ? '#ffcc53' : blocked ? '#a9d9ff' : hit.attack.effect?.color);
  }

  function burst(x, y, count, color) {
    const ground = world.height * config.stage.groundRatio;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 55 + Math.random() * 170;
      particles.push({
        x, y: ground + y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: .18 + Math.random() * .17, size: 2 + Math.random() * 3,
        color: color ?? (i % 2 ? '#ffcb7c' : '#fff1cf'),
      });
    }
  }

  function toast(text, duration = .65) { ui.toast.textContent = text; ui.toast.classList.add('show'); toastClock = duration; }
  function finishRound() {
    phase = 'round-over';
    phaseTime = 1.35;
    clearInputs();
    mai.blocking = false;
    panels.setPauseAvailable(false);
    ui.toast.classList.remove('show');
    const knockout = hung.hp <= 0 || mai.hp <= 0;
    panels.showBanner(knockout ? 'K.O.' : 'HẾT GIỜ', true);
    audio.cue(knockout ? 'ko' : 'time');
    let lead = Math.round(hung.hp * 100) * mai.maxHp - Math.round(mai.hp * 100) * hung.maxHp;
    if (localMode === 'team') {
      const playersLeft = Number(!activePlayer) + Number(hung.hp > 0);
      const cpusLeft = Number(!activeCpu) + Number(mai.hp > 0);
      lead = knockout ? playersLeft - cpusLeft : hung.hp / hung.maxHp - mai.hp / mai.maxHp + activeCpu - activePlayer;
    }
    if (lead > 0) winsHung++;
    if (lead < 0) winsMai++;
    updateScore();
    nextRound = Math.max(winsHung, winsMai) < Math.ceil(bestOf / 2);
    const winner = localMode === 'team' ? (lead > 0 ? 'ĐỘI NGƯỜI CHƠI' : 'ĐỘI CPU') : (lead > 0 ? hung : mai).name.toUpperCase();
    ui['status-text'].textContent = lead === 0 ? 'HIỆP HÒA · ĐẤU LẠI' : winner + ' THẮNG HIỆP';
    const headToHead = lan || localMode === 'versus';
    let rewardText = '';
    if (!nextRound && isPve()) {
      const reward = awardEquipment(equipment, winsHung > winsMai);
      const saved = saveEquipment(equipment);
      rewardText = '+' + reward.gold + ' gold · +' + reward.material + ' nguyên liệu';
      if (reward.item) rewardText += ' · Mở ' + reward.item.name + ' (' + rarities[reward.item.tier] + ')';
      if (!saved) rewardText += ' · Lưu trong phiên này';
    }
    panels.setResult(
      localMode === 'team' ? (winsHung > winsMai ? 'Đội người chơi thắng' : 'Đội CPU thắng') : headToHead ? 'P' + (winsHung > winsMai ? '1' : '2') + ' thắng trận' : winsHung > winsMai ? 'Chiến thắng' : 'Thất bại',
      `${hung.name} (${headToHead ? 'P1' : 'bạn'}) ${winsHung} – ${winsMai} ${mai.name} (${headToHead ? 'P2' : 'CPU'})`,
      rewardText,
    );
    if (nextRound && lead !== 0) round++;
  }

  function frame(now) {
    if (lastTime !== undefined) accumulator += Math.min((now - lastTime) / 1000, .1);
    lastTime = now;
    const previousHP = [hung.hp, mai.hp];
    const previousDamage = damageHung + damageMai;
    const previousSecond = Math.ceil(seconds);
    while (accumulator >= FRAME_SECONDS) {
      previousPositions = [hung, mai].map(fighter => ({ fighter, x: fighter.x, y: fighter.y }));
      update(FRAME_SECONDS);
      accumulator -= FRAME_SECONDS;
    }
    if (previousHP[0] !== hung.hp || previousHP[1] !== mai.hp || previousSecond !== Math.ceil(seconds) || previousDamage !== damageHung + damageMai) updateScore();
    if (phase === 'fight') {
      const status = hung.hitstun > 0
        ? 'CHOÁNG · GIỮ A/D ĐỂ DI CHUYỂN KHI HẾT CHOÁNG'
        : 'ĐẤU ĐI — ĐỪNG ĐỂ LỘ SƠ HỞ';
      if (ui['status-text'].textContent !== status) ui['status-text'].textContent = status;
    }
    hud.updateMeterUI(hung, 'hung');
    hud.updateMeterUI(mai, 'mai');
    trainingPanel.update(practice && ['countdown', 'fight', 'paused'].includes(phase), mai);
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
    render({ stage, stageFrame, fighters, offsets, projectiles, particles, floaters, trails, shake, screenEffect, animationTime, debug, ball, drop: pickups.drop });
    if (toastClock <= 0) ui.toast.classList.remove('show');
    requestAnimationFrame(frame);
  }
  setStage('rooftop', true);
  returnToMenu();
  requestAnimationFrame(frame);
}
