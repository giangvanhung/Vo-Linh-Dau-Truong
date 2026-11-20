import { FRAME_SECONDS, Fighter, findHit, applyHit, updateProjectiles } from '../combat/fighter.js';
import { updateFacing, pushboxesOverlap, separateFighters } from '../combat/positioning.js';
import { CpuController } from '../combat/cpu.js';
import { GameAudio } from '../platform/audio.js';
import { createKeyboard } from '../platform/keyboard.js';
import { loadSettings, persistSettings } from '../platform/settings.js';
import { createArenaRenderer } from '../render/arena.js';
import { createHud, damageFormat } from '../ui/hud.js';
import { createPanels } from '../ui/panels.js';
import { createTrainingPanel } from '../ui/training-panel.js';
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
  const roundLength = config.stage.roundSeconds;
  // The HUD IDs identify fixed sides. The fighters on each side are selected before a match.
  let hung, mai, phase = 'menu', seconds = roundLength, winsHung = 0, winsMai = 0, round = 1;
  let playerId = 'hung', opponentId = 'mai', practice = false, pausedPhase;
  let phaseTime = 0, nextRound = false;
  let lastTime, accumulator = 0, toastClock = 0;
  let difficulty = 'normal', cpu;
  let hitstop = 0, shake = 0;
  const particles = [], floaters = [], projectiles = [], trails = [];
  let screenEffect = null;

  function fighterX(side) { return canvas.width * config.stage[side === 'hung' ? 'playerStartRatio' : 'cpuStartRatio']; }
  function updateScore() {
    hud.updateUI({ hung, mai, practice, seconds, round, winsHung, winsMai });
  }

  function resetFighters() {
    hung = new Fighter(config.characters[playerId], fighterX('hung'), 1, config.combat);
    mai = new Fighter(config.characters[opponentId], fighterX('mai'), -1, config.combat);
    seconds = roundLength;
    hitstop = shake = toastClock = 0;
    keyboard.clear();
    cpu = new CpuController(difficulty, config);
    particles.length = 0;
    floaters.length = projectiles.length = trails.length = 0;
    screenEffect = null;
    ui.toast.classList.remove('show');
    hud.updateRosterUI({ hung, mai, practice, difficulty });
    updateScore();
  }

  function beginRound() {
    resetFighters();
    phase = 'countdown';
    phaseTime = 3;
    panels.show('');
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
    panels.showSetup(practice);
  }

  function returnToMenu() {
    resetTrainingActivity();
    phase = 'menu';
    practice = false;
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
      panels.restoreBanner();
      panels.setPauseAvailable(true);
      audio.unlock();
      audio.setPlaying(true);
    } else if (phase === 'countdown' || phase === 'fight') {
      pausedPhase = phase;
      phase = 'paused';
      keyboard.clear();
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

  function selectMatch(player, opponent, level) {
    playerId = player;
    const roster = Object.keys(config.characters);
    opponentId = opponent === 'random' ? roster[Math.floor(Math.random() * roster.length)] : opponent;
    difficulty = level;
    startMatch();
  }

  const panels = createPanels({ settings, openSetup, returnToMenu, togglePause, startMatch, selectMatch, saveSettings });

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
    resetMeter() {
      if (!canTrain()) return;
      hung.meter = mai.meter = 0;
    },
  });

  const keyboard = createKeyboard({
    canPlay: () => phase === 'fight',
    canPause: () => ['fight', 'countdown', 'paused'].includes(phase),
    onPause: togglePause,
    onInput: label => { if (canTrain()) training.noteInput(label); },
    onClear: () => {
      hung.crouching = false;
      hung.setGuard(false);
    },
  });

  function useAttack(fighter, target, id) {
    const skill = fighter.skills[id];
    const started = fighter.startAttack(id, skill ?? fighter.attacks[id], target);
    if (started && skill) toast(skill.label.toLocaleUpperCase('vi'));
    return started;
  }

  function applyControls(fighter, target, input) {
    fighter.setGuard(input.guard);
    if (input.jump && fighter.onGround && !fighter.disabled && !fighter.attacking && !fighter.dash && !input.guard) {
      fighter.vy = -config.stage.jumpVelocity;
      fighter.onGround = false;
    }
    if (input.action === 'dash' || input.action === 'enhancedDash') {
      const enhanced = input.action === 'enhancedDash';
      if (fighter.startDash(enhanced) && enhanced) toast('LƯỚT CƯỜNG HÓA');
    } else if (input.action === 'escape' && fighter.escapeFrom(target)) {
      toast(fighter.name.toUpperCase() + ' THOÁT COMBO!');
    }
    if (input.attack) useAttack(fighter, target, input.attack);
    const canMove = !fighter.disabled && !fighter.dash && !fighter.attacking && !fighter.blocking;
    fighter.crouching = canMove && input.crouch && fighter.onGround;
    if (canMove) fighter.x += input.direction * fighter.moveSpeed * (fighter.crouching ? .33 : 1) * FRAME_SECONDS;
  }

  function update(dt) {
    if (phase === 'paused') return;
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
    if (phase === 'round-over') {
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
    const startingGap = mai.x - hung.x;
    const startingSide = Math.sign(startingGap) || hung.facing;
    const bodiesTouchingVertically = pushboxesOverlap(hung, mai, config.stage.pushboxHeightRatio);
    updateFacing(hung, mai);
    const input = keyboard.consumeActions();
    const replay = practice ? training.step(input) : null;
    applyControls(hung, mai, input);
    if (replay) {
      mai.lowGuardOnly = false;
      applyControls(mai, hung, { ...replay, direction: -replay.direction });
    } else if (practice && training.mode !== 'cpu') {
      training.controlDummy(mai, dt, config.stage.jumpVelocity);
    } else if (practice) {
      mai.lowGuardOnly = false;
      mai.crouching = false;
    }
    if (!replay && (!practice || training.mode === 'cpu')) cpu.update(dt, mai, hung, projectiles, world, id => useAttack(mai, hung, id), () => {
      if (!mai.escapeFrom(hung)) return false;
      toast(mai.name.toUpperCase() + ' THOÁT COMBO!');
      return true;
    });
    const previousX = [hung.x, mai.x];
    hung.update(dt, world, mai);
    mai.update(dt, world, hung);
    for (const [index, fighter] of [hung, mai].entries()) {
      const attack = fighter.attack;
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
    audio.cue(blocked ? 'block' : 'hit');
    hitstop = Math.max(hitstop, hit.hitstop);
    if (hit.hitstop) shake = .14;
    if (broken) toast('VỠ THẾ THỦ!');
    else if (combo >= 2) toast(attacker.name.toUpperCase() + ' · COMBO ' + combo + ' HIT');
    else if (blocked) toast('ĐỠ ĐÒN!');
    floaters.push({ x, y, life: .75, total: .75, text: '−' + damageFormat.format(damage), blocked });
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
    keyboard.clear();
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
      winsHung > winsMai ? 'Chiến thắng' : 'Thất bại',
      `${hung.name} (bạn) ${winsHung} – ${winsMai} ${mai.name} (CPU)`,
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
    render({ fighters: [hung, mai], projectiles, particles, floaters, trails, shake, screenEffect, debug: practice && training.debug });
    if (toastClock <= 0) ui.toast.classList.remove('show');
    requestAnimationFrame(frame);
  }
  returnToMenu();
  requestAnimationFrame(frame);
}
