import { FRAME_SECONDS, Fighter, findHit, applyHit, updateProjectiles } from '../combat/fighter.js';
import { updateFacing, pushboxesOverlap, separateFighters } from '../combat/positioning.js';
import { CpuController } from '../combat/cpu.js';
import { GameAudio } from '../platform/audio.js';
import { createKeyboard } from '../platform/keyboard.js';
import { createLanHost, mergeInputs } from '../platform/lan.js';
import { loadSettings, persistSettings } from '../platform/settings.js';
import { createArenaRenderer } from '../render/arena.js';
import { createHud, damageFormat } from '../ui/hud.js';
import { createPanels } from '../ui/panels.js';
import { createTrainingPanel } from '../ui/training-panel.js';
import { applyStageEffects, stageForMatch } from './stages.js';
import { TrainingSession } from './training.js';

export function startGame(config) {
  const canvas = document.querySelector('#arena');
  const render = createArenaRenderer(canvas, config);
  const byId = id => document.getElementById(id);
  const ui = { toast: byId('toast'), 'status-text': byId('status-text') };
  const hud = createHud(config);
  const settings = loadSettings();
  const training = new TrainingSession();
  const canTrain = () => practice && phase === 'fight';
  const audio = new GameAudio();
  audio.configure(settings);
  const world = { width: canvas.width, height: canvas.height, gravity: config.stage.gravity };
  let stage = stageForMatch(config.stage, config.stages.rooftop, true);
  let stageFrame = 0;
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
  let hitstop = 0, shake = 0;
  let animationTime = 0;
  const particles = [], floaters = [], projectiles = [], trails = [];
  let screenEffect = null;

  function fighterX(side) { return canvas.width * config.stage[side === 'hung' ? 'playerStartRatio' : 'cpuStartRatio']; }
  function updateScore() {
    hud.updateUI({ hung, mai, practice, seconds, round, winsHung, winsMai });
  }

  function resetFighters() {
    hung = new Fighter(config.characters[playerId], fighterX('hung'), 1, config.combat);
    mai = new Fighter(config.characters[opponentId], fighterX('mai'), -1, config.combat);
    hung.characterId = playerId;
    mai.characterId = opponentId;
    seconds = roundLength;
    stageFrame = 0;
    hitstop = shake = toastClock = 0;
    clearInputs();
    cpu = new CpuController(difficulty, config);
    particles.length = 0;
    floaters.length = projectiles.length = trails.length = 0;
    screenEffect = null;
    ui.toast.classList.remove('show');
    hud.updateRosterUI({ hung, mai, practice, difficulty, lan });
    updateScore();
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
    audio.setPlaying(true);
    audio.cue('countdown');
  }

  function startMatch() {
    if (practice) resetTrainingActivity();
    audio.unlock();
    winsHung = winsMai = 0;
    round = 1;
    beginRound();
  }

  function openSetup(isPractice) {
    practice = isPractice;
    phase = 'setup';
    soloLanButton.hidden = lan;
    panels.showSetup(practice, lan);
  }

  function returnToMenu() {
    resetTrainingActivity();
    phase = 'menu';
    practice = lan = false;
    soloLan = false;
    lanHost.close();
    byId('lan-details').hidden = true;
    byId('lan-details').open = false;
    byId('network-mode').textContent = 'OFFLINE';
    winsHung = winsMai = 0;
    round = 1;
    resetFighters();
    audio.setPlaying(false);
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
      audio.setPlaying(true);
    } else if (phase === 'countdown' || phase === 'fight') {
      pausedPhase = phase;
      phase = 'paused';
      clearInputs();
      panels.hideBanner();
      panels.setPauseAvailable(false);
      audio.setPlaying(false);
      panels.show('pause');
    }
  }

  function saveSettings() {
    persistSettings(settings);
    audio.configure(settings);
    audio.unlock();
  }

  function selectMatch(player, opponent, level, stageId, hazards) {
    setStage(stageId, hazards);
    playerId = player;
    const roster = Object.keys(config.characters);
    opponentId = opponent === 'random' ? roster[Math.floor(Math.random() * roster.length)] : opponent;
    difficulty = level;
    if (soloLan) {
      byId('lan-details').append(pairing);
      byId('lan-details').hidden = false;
    }
    startMatch();
  }

  const panels = createPanels({ characters: config.characters, stages: config.stages, settings, openSetup, openLan, returnToMenu, togglePause, startMatch, selectMatch, saveSettings });

  const pairing = byId('lan-pairing');
  const address = byId('lan-address');
  const networkLabels = { wifi: 'Wi‑Fi', ethernet: 'Ethernet (cắm dây)', virtual: 'VPN / mạng ảo', other: 'Mạng khác' };
  const networkHints = {
    wifi: 'Dùng địa chỉ này khi điện thoại và máy tính kết nối cùng Wi‑Fi.',
    ethernet: 'Dùng địa chỉ này khi dây mạng máy tính nối vào cùng router phát Wi‑Fi cho điện thoại.',
    virtual: 'Địa chỉ VPN hoặc mạng ảo. Nếu điện thoại chỉ dùng Wi‑Fi, hãy chọn địa chỉ Wi‑Fi hoặc Ethernet.',
    other: 'Nếu chưa rõ đây là mạng nào, xem tên bộ điều hợp trong cài đặt mạng của máy tính.',
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
      address.replaceChildren(...options.map(({ link, name, type }, index) => {
        const label = networkLabels[type] ?? networkLabels.other;
        const adapter = name && name.toLowerCase() !== type ? ` (${name})` : '';
        return new Option(`${label}${adapter} · ${new URL(link).host}`, index);
      }));
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
    soloLanButton.hidden = true;
    byId('solo-lan-pairing').append(pairing);
    openControllerRoom();
  });
  byId('lan-start').addEventListener('click', () => {
    byId('lan-details').append(pairing);
    byId('lan-details').hidden = false;
    openSetup(false);
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

  function openLan() {
    lan = true;
    practice = false;
    phase = 'lan';
    byId('lan-lobby').append(pairing);
    panels.show('lan');
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
      hung.awakeningUsed = false;
      hung.awakeningFrames = 0;
      canvas.focus({ preventScroll: true });
    },
    resetMeter() {
      if (!canTrain()) return;
      hung.meter = mai.meter = 0;
    },
  });

  const keyboard = createKeyboard({
    canPlay: () => phase === 'fight',
    canPause: () => ['fight', 'countdown', 'paused'].includes(phase),
    onPause: togglePause,
    allowArrows: () => !lan,
    onInput: label => { if (canTrain()) training.noteInput(label); },
    onClear: () => {
      hung.crouching = false;
      hung.setGuard(false);
    },
  });

  const secondPlayerKeys = {
    ArrowLeft: 'a', ArrowRight: 'd', ArrowUp: 'w', ArrowDown: 's',
    KeyZ: 'j', KeyX: 'k', KeyC: 'l', KeyV: 'p', KeyB: 'q', KeyH: 'r', BracketLeft: 'f', BracketRight: 'g',
    KeyN: 'u', KeyM: 'i', Comma: 'o', Period: 't',
  };
  const keyboardP2 = createKeyboard({
    canPlay: () => lan && phase === 'fight',
    canPause: () => false,
    keyFor: event => secondPlayerKeys[event.code],
    onClear: () => {
      mai.crouching = false;
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
    const skill = fighter.skillFor(id);
    const started = fighter.startAttack(id, skill ?? fighter.attacks[id], target);
    if (started && skill) toast(skill.label.toLocaleUpperCase('vi'));
    return started;
  }

  function applyControls(fighter, target, input) {
    fighter.setGuard(input.guard);
    const canBuffer = !fighter.disabled && !input.guard && !input.action && !input.charge;
    if (!canBuffer) fighter.bufferedAttack = null;
    if (input.action === 'awaken' && fighter.awaken()) {
      toast(fighter.name + ' · ĐỘT PHÁ!');
      burst(fighter.x, fighter.y - 16, 26, fighter.glow);
      return;
    }
    const charge = input.charge && !input.guard && !input.jump && !input.attack && !input.action && !input.direction && !input.crouch;
    fighter.charge(charge);
    if (fighter.charging) {
      fighter.crouching = false;
      return;
    }
    if (input.jump && fighter.onGround && !fighter.disabled && !fighter.attacking && !fighter.dash && !input.guard) {
      fighter.vy = -config.stage.jumpVelocity;
      fighter.onGround = false;
    }
    if (input.action === 'dash' || input.action === 'enhancedDash') {
      const enhanced = input.action === 'enhancedDash';
      if (fighter.startDash(enhanced) && enhanced) toast('LƯỚT CƯỜNG HÓA');
    } else if (input.action === 'roll') {
      fighter.startDash(false, input.direction || -fighter.facing);
    } else if (input.action === 'escape' && fighter.escapeFrom(target)) {
      toast(fighter.name.toUpperCase() + ' THOÁT COMBO!');
    }
    if (input.attack) {
      fighter.bufferedAttack = null;
      if (!useAttack(fighter, target, input.attack) && canBuffer && fighter.attack && fighter.attacks[input.attack]) {
        const { startup, active, recovery, elapsed } = fighter.attack;
        if (startup + active + recovery - elapsed <= 6) fighter.bufferedAttack = input.attack;
      }
    } else if (fighter.bufferedAttack && !fighter.attack) {
      useAttack(fighter, target, fighter.bufferedAttack);
      fighter.bufferedAttack = null;
    }
    const canMove = !fighter.disabled && !fighter.dash && !fighter.attacking && !fighter.blocking;
    fighter.crouching = canMove && input.crouch && fighter.onGround;
    if (canMove) fighter.x += input.direction * fighter.moveSpeed * (fighter.crouching ? .33 : 1) * FRAME_SECONDS;
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
    const startingGap = mai.x - hung.x;
    const startingSide = Math.sign(startingGap) || hung.facing;
    const bodiesTouchingVertically = pushboxesOverlap(hung, mai, config.stage.pushboxHeightRatio);
    updateFacing(hung, mai);
    const local = keyboard.consumeActions();
    const input = lan || soloLan ? mergeInputs(local, lanHost.consume(0)) : local;
    const replay = practice ? training.step(input) : null;
    applyControls(hung, mai, input);
    if (lan) {
      applyControls(mai, hung, mergeInputs(keyboardP2.consumeActions(), lanHost.consume(1)));
    } else if (replay) {
      mai.lowGuardOnly = false;
      applyControls(mai, hung, { ...replay, direction: -replay.direction });
    } else if (practice && training.mode !== 'cpu') {
      training.controlDummy(mai, dt, config.stage.jumpVelocity);
    } else if (practice) {
      mai.lowGuardOnly = false;
      mai.crouching = false;
    }
    if (!lan && !replay && (!practice || training.mode === 'cpu')) cpu.update(dt, mai, hung, projectiles, world, id => useAttack(mai, hung, id), () => {
      if (!mai.escapeFrom(hung)) return false;
      toast(mai.name.toUpperCase() + ' THOÁT COMBO!');
      return true;
    });
    const walkingSteps = [hung.x - movementStart[0], mai.x - movementStart[1]];
    stageFrame++;
    applyStageEffects(world, hung, movementStart[0], stageFrame, dt);
    applyStageEffects(world, mai, movementStart[1], stageFrame, dt);
    const previousX = [hung.x, mai.x];
    hung.update(dt, world, mai);
    mai.update(dt, world, hung);
    for (const [index, fighter] of [hung, mai].entries()) {
      if (fighter.dash?.elapsed === 1) audio.cue('dash');
      const attack = fighter.attack;
      if (attack && attack.elapsed === attack.startup) {
        if (attack.id === 'ultimate') audio.cue('ultimate');
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
    separateFighters(hung, mai, world, config.stage.pushboxHeightRatio, startingSide, bodiesTouchingVertically);
    updateFacing(hung, mai);
    for (const [index, fighter] of [hung, mai].entries()) {
      const step = fighter.x - movementStart[index];
      const intended = walkingSteps[index];
      fighter.moving = Math.abs(step) > .1 && Math.abs(intended) > .1 && step * intended > 0
        && fighter.onGround && !fighter.disabled
        && !fighter.attack && !fighter.dash && !fighter.blocking && !fighter.crouching;
      if (fighter.moving) {
        const backwards = step * fighter.facing < 0;
        if (backwards !== fighter.walkBackwards) fighter.walkDistance = 0;
        fighter.walkBackwards = backwards;
        fighter.walkDistance += Math.min(Math.abs(step), Math.abs(intended));
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
    if (practice) for (const hit of hits) training.trackHit(hit, hung, mai);
    hung.endFrame();
    mai.endFrame();

    if (practice) {
      if (hung.hp <= 0) hung.hp = hung.maxHp;
      if (mai.hp <= 0) mai.hp = mai.maxHp;
    } else if (hung.hp <= 0 || mai.hp <= 0 || seconds <= 0) finishRound();
  }

  function hitEffects(hit) {
    const { attacker, blocked, broken, combo, damage, x, y } = hit;
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
    else if (combo >= 2) toast(attacker.name.toUpperCase() + ' · COMBO ' + combo + ' HIT');
    else if (blocked) toast('ĐỠ ĐÒN!');
    const sparkType = blocked ? 'guard' : isKick ? 'kick' : 'hit';
    floaters.push({ x, y: y - 18, contactY: y, life: .75, total: .75,
      text: '−' + damageFormat.format(damage), blocked, sparkType, facing: hit.attack.facing });
    burst(x, y, blocked ? 5 : 11, blocked ? '#a9d9ff' : hit.attack.effect?.color);
  }

  function burst(x, y, count, color) {
    const ground = canvas.height * config.stage.groundRatio;
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

  function toast(text) { ui.toast.textContent = text; ui.toast.classList.add('show'); toastClock = .65; }
  function finishRound() {
    phase = 'round-over';
    phaseTime = 1.35;
    clearInputs();
    mai.blocking = false;
    panels.setPauseAvailable(false);
    ui.toast.classList.remove('show');
    audio.setPlaying(false);
    const knockout = hung.hp <= 0 || mai.hp <= 0;
    panels.showBanner(knockout ? 'K.O.' : 'HẾT GIỜ', true);
    audio.cue(knockout ? 'ko' : 'time');
    const lead = Math.round(hung.hp * 100) * mai.maxHp - Math.round(mai.hp * 100) * hung.maxHp;
    if (lead > 0) winsHung++;
    if (lead < 0) winsMai++;
    updateScore();
    nextRound = Math.max(winsHung, winsMai) < config.stage.winsToMatch;
    const winner = lead > 0 ? hung : mai;
    ui['status-text'].textContent = lead === 0 ? 'HIỆP HÒA · ĐẤU LẠI' : winner.name.toUpperCase() + ' THẮNG HIỆP';
    panels.setResult(
      lan ? 'P' + (winsHung > winsMai ? '1' : '2') + ' thắng trận' : winsHung > winsMai ? 'Chiến thắng' : 'Thất bại',
      `${hung.name} (${lan ? 'P1' : 'bạn'}) ${winsHung} – ${winsMai} ${mai.name} (${lan ? 'P2' : 'CPU'})`,
    );
    if (nextRound && lead !== 0) round++;
  }

  function frame(now) {
    if (lastTime !== undefined) accumulator += Math.min((now - lastTime) / 1000, .1);
    lastTime = now;
    const previousHP = [hung.hp, mai.hp];
    const previousSecond = Math.ceil(seconds);
    while (accumulator >= FRAME_SECONDS) {
      update(FRAME_SECONDS);
      accumulator -= FRAME_SECONDS;
    }
    if (previousHP[0] !== hung.hp || previousHP[1] !== mai.hp || previousSecond !== Math.ceil(seconds)) updateScore();
    if (phase === 'fight') {
      const status = hung.hitstun > 0
        ? 'CHOÁNG · GIỮ A/D ĐỂ DI CHUYỂN KHI HẾT CHOÁNG'
        : 'ĐẤU ĐI — ĐỪNG ĐỂ LỘ SƠ HỞ';
      if (ui['status-text'].textContent !== status) ui['status-text'].textContent = status;
    }
    hud.updateMeterUI(hung, 'hung');
    hud.updateMeterUI(mai, 'mai');
    trainingPanel.update(practice && ['countdown', 'fight', 'paused'].includes(phase), mai);
    render({ stage, stageFrame, fighters: [hung, mai], projectiles, particles, floaters, trails, shake, screenEffect, animationTime, debug: practice && training.debug });
    if (toastClock <= 0) ui.toast.classList.remove('show');
    requestAnimationFrame(frame);
  }
  setStage('rooftop', true);
  returnToMenu();
  requestAnimationFrame(frame);
}
