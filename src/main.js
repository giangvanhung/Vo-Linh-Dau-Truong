import { FRAME_SECONDS, Fighter, findHit, applyHit, updateProjectiles } from './combat.js';

const config = await fetch('/data/fighters.json').then(response => {
  if (!response.ok) throw new Error('Không tải được cấu hình trận đấu.');
  return response.json();
});
const canvas = document.querySelector('#arena');
const ctx = canvas.getContext('2d');
const ui = Object.fromEntries(['round-label','hung-wins','mai-wins','hung-health','mai-health','hung-hp','mai-hp','timer','score-hung','score-mai','callout','start-button','toast','status-text'].map(id => [id, document.getElementById(id)]));
const meterUI = Object.fromEntries(['hung', 'mai'].map(side => [side, {
  fill: document.getElementById(side + '-meter-fill'),
  value: document.getElementById(side + '-meter-value'),
  dash: document.getElementById(side + '-dash'),
  escape: document.getElementById(side + '-escape'),
  skills: document.getElementById(side + '-skills'),
}]));
const world = { width: canvas.width, height: canvas.height, gravity: config.stage.gravity };
const roundLength = config.stage.roundSeconds;
let hung, mai, phase = 'intro', seconds = roundLength, winsHung = 0, winsMai = 0, round = 1;
let lastTime, accumulator = 0, aiClock = .45, aiPlan = null, toastClock = 0;
let hitstop = 0, shake = 0, queuedAttack = null, queuedAction = null, queuedJump = false;
const attackKeys = { j: 'light', k: 'heavy', l: 'kick', u: 'closeSkill', i: 'rangedSkill', o: 'ultimate' };
const damageFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const particles = [], floaters = [], projectiles = [], trails = [];
let screenEffect = null;

function fighterX(side) { return canvas.width * config.stage[side === 'hung' ? 'playerStartRatio' : 'cpuStartRatio']; }
function resetFighters() {
  hung = new Fighter(config.characters.hung, fighterX('hung'), 1, config.combat);
  mai = new Fighter(config.characters.mai, fighterX('mai'), -1, config.combat);
  seconds = roundLength;
  hitstop = shake = toastClock = 0;
  clearInputs();
  aiClock = .4;
  aiPlan = null;
  particles.length = 0;
  floaters.length = projectiles.length = trails.length = 0;
  screenEffect = null;
  updateUI();
}
function startGame() {
  if (phase === 'fight') return;
  if (phase === 'over') { winsHung = 0; winsMai = 0; round = 1; }
  resetFighters();
  phase = 'fight';
  ui.callout.classList.add('hidden');
  ui['status-text'].textContent = 'ĐẤU ĐI — ĐỪNG ĐỂ LỘ SƠ HỞ';
  updateUI();
}
ui['start-button'].addEventListener('click', startGame);

const movementAliases = { ArrowLeft: 'a', ArrowRight: 'd', ArrowUp: 'w', ArrowDown: 's' };
const gameKeys = new Set(['a', 'd', 'w', 's', 'p', 'q', 't', ...Object.keys(attackKeys)]);
const heldInputs = new Map();

function gameKey(event) {
  const key = event.key?.toLowerCase();
  if (key === 'đ') return 'd';
  if (gameKeys.has(key)) return key;
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase();
  return movementAliases[event.code] ?? movementAliases[event.key];
}

function movementDirection() {
  let direction = 0;
  for (const key of heldInputs.values()) {
    if (key === 'd') direction = 1;
    if (key === 'a') direction = -1;
  }
  return direction;
}

function physicalKey(event) {
  return event.code && event.code !== 'Unidentified' ? event.code : null;
}

function isHeld(key) {
  return [...heldInputs.values()].includes(key);
}

window.addEventListener('keydown', event => {
  if (phase !== 'fight') return;
  const key = gameKey(event);
  if (!gameKeys.has(key) || event.ctrlKey || event.metaKey || event.altKey) return;
  event.preventDefault();
  const input = physicalKey(event) ?? key;
  if (event.repeat || heldInputs.has(input)) return;
  heldInputs.set(input, key);
  if (key === 'w') queuedJump = true;
  if (attackKeys[key]) queuedAttack = attackKeys[key];
  if (key === 'q') queuedAction = event.shiftKey ? 'enhancedDash' : 'dash';
  if (key === 't') queuedAction = 'escape';
});
window.addEventListener('keyup', event => {
  const code = physicalKey(event);
  const key = gameKey(event);
  if (!heldInputs.delete(code ?? key)) {
    // Some keyboard layouts and input methods omit the physical code on one event.
    for (const [input, heldKey] of heldInputs) {
      if ((code === null || input === heldKey) && heldKey === key) heldInputs.delete(input);
    }
  }
});
function clearInputs() {
  heldInputs.clear();
  queuedAttack = queuedAction = null;
  queuedJump = false;
  hung.crouching = false;
  hung.setGuard(false);
}
window.addEventListener('blur', clearInputs);
window.addEventListener('pagehide', clearInputs);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearInputs();
});

function useAttack(fighter, target, id) {
  const skill = fighter.skills[id];
  const started = fighter.startAttack(id, skill ?? config.attacks[id], target);
  if (started && skill) toast(skill.label.toLocaleUpperCase('vi'));
  return started;
}

function update(dt) {
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
  if (hitstop > 0) {
    hitstop--;
    return;
  }

  seconds = Math.max(0, seconds - dt);
  const startingGap = mai.x - hung.x;
  const startingSide = Math.sign(startingGap) || hung.facing;
  const bodiesTouchingVertically = pushboxesOverlap();
  updateFacing();
  hung.setGuard(isHeld('p'));
  if (queuedJump && hung.onGround && !hung.disabled && !hung.attacking && !hung.dash && !isHeld('p')) {
    hung.vy = -config.stage.jumpVelocity;
    hung.onGround = false;
  }
  queuedJump = false;
  if (queuedAction === 'dash' || queuedAction === 'enhancedDash') {
    if (hung.startDash(queuedAction === 'enhancedDash') && queuedAction === 'enhancedDash') {
      toast('LƯỚT CƯỜNG HÓA');
    }
  } else if (queuedAction === 'escape' && hung.escapeFrom(mai)) {
    toast('HÙNG THOÁT COMBO!');

  }
  queuedAction = null;
  if (queuedAttack) {
    useAttack(hung, mai, queuedAttack);
    queuedAttack = null;
  }
  hung.crouching = isHeld('s') && hung.onGround && !hung.dash && !hung.attacking && !hung.blocking && !hung.disabled;
  if (!hung.disabled && !hung.dash && !hung.attacking && !hung.blocking) {
    const direction = movementDirection();
    hung.x += direction * config.stage.moveSpeed * (hung.crouching ? .33 : 1) * dt;
  }
  updateCpu(dt);
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
  separateFighters(startingSide, bodiesTouchingVertically);
  updateFacing();
  const contacts = [
    findHit(hung, mai), findHit(mai, hung),
    ...updateProjectiles(projectiles, [hung, mai], dt, world),
  ].filter(Boolean);
  const hits = contacts.map(applyHit);
  hits.forEach(hitEffects);
  hung.endFrame();
  mai.endFrame();

  if (hung.hp <= 0 || mai.hp <= 0 || seconds <= 0) finishRound();
}

function updateCpu(dt) {
  if (mai.escapeFrom(hung)) toast('MAI THOÁT COMBO!');
  if (mai.disabled || mai.dash || mai.attacking) {
    mai.setGuard(false);
    return;
  }
  aiClock -= dt;
  if (aiClock > 0) {
    if (aiPlan?.type === 'move') mai.x += mai.facing * aiPlan.direction * config.stage.moveSpeed * .76 * dt;
    mai.setGuard(aiPlan?.type === 'block');
    return;
  }
  mai.setGuard(false);
  const distance = Math.abs(hung.x - mai.x);
  const inReach = distance < 125;
  const playerInStartup = hung.attack && hung.attack.elapsed < hung.attack.startup;
  const { closeSkill, rangedSkill, ultimate } = mai.skills;
  const danger = projectiles.some(shot => shot.attacker === hung && !shot.hit
    && Math.abs(shot.x - mai.x) < 155 && (mai.x - shot.x) * shot.attack.facing > 0);
  if ((danger || (playerInStartup && hung.attack.effect && distance < 340)) && Math.random() < .6) {
    aiPlan = { type: 'block' }; aiClock = .52;
    mai.setGuard(true);
  } else if (distance < ultimate.range + ultimate.travel.speed * ultimate.travel.frames * FRAME_SECONDS
    && mai.meter >= ultimate.cost && useAttack(mai, hung, 'ultimate')) {
    aiPlan = null;
  } else if (distance < closeSkill.range && Math.random() < .48 && useAttack(mai, hung, 'closeSkill')) {
    aiPlan = null;
  } else if (distance > 150 && distance < rangedSkill.projectile.speed * rangedSkill.projectile.lifetimeFrames * FRAME_SECONDS
    && Math.random() < .43 && useAttack(mai, hung, 'rangedSkill')) {
    aiPlan = null;
  } else if (inReach && playerInStartup && Math.random() < .38) {
    aiPlan = { type: 'block' }; aiClock = .22 + Math.random() * .3;
  } else if (distance > 120) {
    aiPlan = { type: 'move', direction: 1 }; aiClock = .2 + Math.random() * .35;
  } else if (distance < 67 && Math.random() < .34) {
    aiPlan = { type: 'move', direction: -1 }; aiClock = .16 + Math.random() * .22;
  } else if (Math.random() < .72) {
    aiPlan = null;
    const attackId = Math.random() < .45 ? 'light' : Math.random() < .65 ? 'kick' : 'heavy';
    useAttack(mai, hung, attackId);
    aiClock = .38 + Math.random() * .55;
  } else {
    aiPlan = { type: 'block' }; aiClock = .18 + Math.random() * .26;
  }
}

function updateFacing() {
  hung.facing = Math.sign(mai.x - hung.x) || hung.facing;
  mai.facing = -hung.facing;
}

function pushboxesOverlap() {
  const higher = hung.y < mai.y ? hung : mai;
  const lower = higher === hung ? mai : hung;
  return lower.y - higher.y < lower.height * config.stage.pushboxHeightRatio;
}

function separateFighters(startingSide, bodiesTouchingVertically) {
  for (const fighter of [hung, mai]) {
    const attack = fighter.attack;
    if (attack?.travel?.passesThrough && fighter.attackActive
      && attack.elapsed - attack.startup < attack.travel.frames) return;
  }
  if (!pushboxesOverlap()) return;
  const minimum = (hung.width + mai.width) / 2 + 5;
  const gap = mai.x - hung.x;
  const direction = bodiesTouchingVertically ? startingSide : Math.sign(gap) || startingSide;
  const overlap = minimum - gap * direction;
  if (overlap <= 0) return;
  hung.x -= direction * overlap / 2;
  mai.x += direction * overlap / 2;
  hung.clampX(world);
  mai.clampX(world);
  if (Math.abs(mai.x - hung.x) < minimum) {
    mai.x = hung.x + direction * minimum;
    mai.clampX(world);
    hung.x = mai.x - direction * minimum;
  }
}

function hitEffects(hit) {
  const { attacker, blocked, broken, combo, damage, x, y } = hit;
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
  clearInputs();
  mai.blocking = false;
  const winner = hung.hp === mai.hp ? null : hung.hp > mai.hp ? 'hung' : 'mai';
  if (winner === null) {
    showCallout('HIỆP HÒA', 'Hai bên còn cùng lượng máu.', 'ĐẤU LẠI HIỆP');
    ui['status-text'].textContent = 'ĐẤU LẠI HIỆP NÀY';
    return;
  }
  if (winner === 'hung') winsHung++;
  else winsMai++;
  updateUI();
  if (winsHung >= config.stage.winsToMatch || winsMai >= config.stage.winsToMatch) {
    phase = 'over';
    showCallout(winsHung > winsMai ? 'CHIẾN THẮNG' : 'THẤT BẠI', winsHung > winsMai ? 'Hùng đã làm chủ đấu trường.' : 'Mai đã thắng trận đấu này.', 'CHƠI LẠI');
    ui['status-text'].textContent = 'TRẬN ĐẤU ĐÃ KẾT THÚC';
  } else {
    phase = 'round-over';
    const label = winner === 'hung' ? 'HÙNG THẮNG HIỆP!' : 'MAI THẮNG HIỆP!';
    const sub = `TỈ SỐ HIỆP  ${winsHung} — ${winsMai}`;
    showCallout(label, sub, 'HIỆP TIẾP THEO');
    ui['status-text'].textContent = 'CHUẨN BỊ CHO HIỆP TIẾP THEO';
    round++;
  }
}
function showCallout(title, subtitle, buttonText) {
  ui.callout.querySelector('.callout-kicker').textContent = `HIỆP ${String(round).padStart(2,'0')} · KẾT THÚC`;
  ui.callout.querySelector('strong').innerHTML = title;
  ui.callout.querySelector('p').textContent = subtitle;
  ui['start-button'].innerHTML = `${buttonText} <span>↗</span>`;
  ui.callout.classList.remove('hidden');
}
function updateUI() {
  ui['hung-health'].style.width = `${hung.hp}%`;
  ui['mai-health'].style.width = `${mai.hp}%`;
  ui['hung-hp'].textContent = damageFormat.format(hung.hp);
  ui['mai-hp'].textContent = damageFormat.format(mai.hp);
  ui.timer.textContent = String(Math.ceil(seconds)).padStart(2, '0');
  ui['score-hung'].textContent = winsHung;
  ui['score-mai'].textContent = winsMai;
  ui['round-label'].textContent = `HIỆP ${String(round).padStart(2, '0')}`;
  ui['hung-wins'].innerHTML = `${winsHung > 0 ? '<span class="won">◆</span>' : '◇'} ${winsHung > 1 ? '<span class="won">◆</span>' : '◇'}`;
  ui['mai-wins'].innerHTML = `${winsMai > 0 ? '<span class="won">◆</span>' : '◇'} ${winsMai > 1 ? '<span class="won">◆</span>' : '◇'}`;
  ui.timer.style.color = seconds < 10 ? '#ef876b' : '';
}

function render() {
  const w = canvas.width, h = canvas.height, ground = h * config.stage.groundRatio;
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#27212f'); bg.addColorStop(.48, '#28212a'); bg.addColorStop(1, '#181820'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  drawMoon(w * .5, h * .22);
  drawArchitecture(w, h);
  ctx.fillStyle = '#201e27'; ctx.fillRect(0, ground, w, h - ground);
  ctx.fillStyle = '#483740'; ctx.fillRect(0, ground, w, 2);
  ctx.fillStyle = '#d5a176'; ctx.globalAlpha = .12; ctx.fillRect(w * .16, ground + 1, w * .68, 1); ctx.globalAlpha = 1;
  for (let i = 0; i < 7; i++) { ctx.strokeStyle = `rgba(229,161,113,${.09 - i * .009})`; ctx.beginPath(); ctx.moveTo(w / 2, ground); ctx.lineTo(w * i / 6, h); ctx.stroke(); }
  ctx.save();
  if (shake) ctx.translate(Math.sin(shake * 180) * shake * 25, 0);
  if (screenEffect && screenEffect.elapsed < screenEffect.shakeSeconds) {
    const remaining = screenEffect.shakeSeconds - screenEffect.elapsed;
    ctx.translate(Math.sin(remaining * 180) * remaining * screenEffect.shakeIntensity, 0);
  }
  for (const trail of trails) {
    ctx.globalAlpha = trail.life / trail.total;
    ctx.fillStyle = trail.color;
    ctx.fillRect(Math.min(trail.from, trail.to), ground + trail.y - 11, Math.abs(trail.to - trail.from), 11);
  }
  ctx.globalAlpha = 1;
  for (const shot of projectiles) drawProjectile(shot, ground);
  for (const f of [hung, mai]) drawFighter(f, ground);
  for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / .35); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }
  ctx.globalAlpha = 1;
  for (const f of floaters) { ctx.globalAlpha = Math.min(1, f.life * 2); ctx.textAlign = 'center'; ctx.font = '700 14px Space Grotesk, sans-serif'; ctx.fillStyle = f.blocked ? '#9fd3f6' : '#ffd08b'; ctx.fillText(f.text, f.x, ground + f.y - (1 - f.life / f.total) * 8); }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (screenEffect && screenEffect.elapsed < screenEffect.flashSeconds) {
    ctx.globalAlpha = screenEffect.flashOpacity * (1 - screenEffect.elapsed / screenEffect.flashSeconds);
    ctx.fillStyle = screenEffect.color;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
}

function drawProjectile({ x, y, attack }, ground) {
  const { color, width, height, pierce } = attack.projectile;
  ctx.save();
  ctx.shadowColor = ctx.fillStyle = color;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.ellipse(x, ground + y, width / 2, height / 2, pierce ? -.22 * attack.facing : 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMoon(x, y) { ctx.save(); ctx.shadowBlur = 50; ctx.shadowColor = '#d89676'; ctx.fillStyle = '#c99b82'; ctx.globalAlpha = .6; ctx.beginPath(); ctx.arc(x, y, 48, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = .2; ctx.fillStyle = '#fae2c9'; ctx.beginPath(); ctx.arc(x - 12, y - 8, 38, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
function drawArchitecture(w, h) {
  ctx.fillStyle = '#181720';
  ctx.beginPath(); ctx.moveTo(0, h * .52); ctx.lineTo(w * .15, h * .32); ctx.lineTo(w * .25, h * .52); ctx.lineTo(w * .37, h * .36); ctx.lineTo(w * .49, h * .52); ctx.lineTo(w * .63, h * .34); ctx.lineTo(w * .76, h * .52); ctx.lineTo(w * .87, h * .3); ctx.lineTo(w, h * .49); ctx.lineTo(w, h * .79); ctx.lineTo(0, h * .79); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#51404a'; ctx.globalAlpha = .52; ctx.lineWidth = 2;
  for (const x of [w * .12, w * .25, w * .75, w * .88]) { ctx.beginPath(); ctx.moveTo(x, h * .31); ctx.lineTo(x, h * .77); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 12, h * .4); ctx.lineTo(x, h * .34); ctx.lineTo(x + 12, h * .4); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 22; i++) { const x = (i * 173 + 47) % w, y = (i * 71 + 31) % (h * .55); ctx.fillStyle = i % 3 ? '#edbd87' : '#aac9e0'; ctx.globalAlpha = .25 + (i % 4) * .08; ctx.fillRect(x, y, 2, 2); }
  ctx.globalAlpha = 1;
}
function drawFighter(f, ground) {
  const x = f.x, footY = ground + f.y, scale = f.crouching ? .66 : 1, isHung = f === hung;
  const bodyW = f.width, bodyH = f.height * scale, top = footY - bodyH;
  const attack = f.attack, telegraph = attack && attack.elapsed < attack.startup;
  ctx.save();
  ctx.globalAlpha = .34; ctx.fillStyle = '#050509'; ctx.beginPath(); ctx.ellipse(x, ground + 2, 43, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  if (telegraph && attack.effect) {
    const progress = attack.elapsed / attack.startup;
    ctx.strokeStyle = attack.effect.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, top + bodyH / 2, bodyH * .57, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();
  }
  if (attack && !attack.projectile && (telegraph || f.attackActive)) {
    const box = f.attackBox;
    ctx.fillStyle = f.glow;
    ctx.globalAlpha = telegraph ? .15 : .65;
    ctx.fillRect(box.x, ground + box.y, box.width, box.height);
    ctx.globalAlpha = 1;
  }
  if (f.blocking) {
    ctx.strokeStyle = '#b5d9f5';
    ctx.lineWidth = 3;
    const angle = f.facing > 0 ? 0 : Math.PI;
    ctx.beginPath();
    ctx.arc(x, top + bodyH * .48, bodyW * 1.15, angle - 1.05, angle + 1.05);
    ctx.stroke();
  }
  ctx.fillStyle = '#383542';
  ctx.fillRect(x - 24, top - 17, 48, 4);
  ctx.fillStyle = '#9bd3ff';
  ctx.fillRect(x - 24, top - 17, 48 * f.guard / config.combat.guardMax, 4);
  if (f.guardBreak > 0) {
    ctx.fillStyle = '#ffca79';
    ctx.textAlign = 'center';
    ctx.font = '700 10px sans-serif';
    ctx.fillText('VỠ THỦ', x, top - 35);
  }
  ctx.save();
  if (f.flash) {
    ctx.translate(x, footY);
    ctx.rotate(-Math.sign(f.knockVelocity) * f.flash * 1.3);
    ctx.translate(-x, -footY);
  }
  if (f.invulnerable) ctx.globalAlpha = .65;
  ctx.shadowBlur = 18; ctx.shadowColor = f.flash ? '#fff' : f.glow; ctx.fillStyle = f.flash ? '#fff2dc' : f.color;
  const bodyX = x - bodyW / 2, shoulderY = top + bodyH * .26;
  ctx.fillRect(bodyX, top + bodyH * .26, bodyW, bodyH * .5);
  ctx.fillRect(bodyX + 2, top + bodyH * .76, bodyW * .34, bodyH * .24);
  ctx.fillRect(x + bodyW * .16, top + bodyH * .76, bodyW * .34, bodyH * .24);
  ctx.fillRect(bodyX - 5, top + bodyH * .03, bodyW + 10, bodyH * .08);
  ctx.fillRect(bodyX + 4, top - 12, bodyW - 8, 16);
  ctx.fillStyle = '#211c26'; ctx.fillRect(f.facing > 0 ? x + 5 : x - 9, top - 7, 4, 2);
  ctx.shadowBlur = 0;
  const armY = shoulderY + bodyH * .12, armLength = attack && (f.attackActive || telegraph) ? Math.min(attack.range * .7, 54) : 15;
  ctx.fillStyle = f.flash ? '#fff2dc' : f.glow;
  if (attack?.id === 'kick' && (f.attackActive || telegraph)) {
    ctx.fillRect(x + f.facing * 3, top + bodyH * .67, f.facing * Math.min(attack.range * .7, 61), 10);
  } else {
    const armX = f.facing > 0 ? x + bodyW * .25 : x - bodyW * .25 - armLength;
    ctx.fillRect(armX, armY, armLength, 12);
  }
  ctx.textAlign = 'center'; ctx.font = '700 10px "Be Vietnam Pro",sans-serif'; ctx.fillStyle = '#f4edf0'; ctx.globalAlpha = .92; ctx.fillText(isHung ? 'HÙNG' : 'MAI', x, top - 22); ctx.globalAlpha = 1;
  ctx.restore();
  ctx.restore();
}

function updateMeterUI(fighter, side) {
  const meter = meterUI[side];
  const value = Math.floor(fighter.meter);
  if (meter.fill) meter.fill.style.width = fighter.meter / config.combat.meterMax * 100 + '%';
  if (meter.value) meter.value.textContent = value + '/' + config.combat.meterMax;
  for (const indicator of meter.skills.children) {
    const id = indicator.dataset.skill;
    const skill = fighter.skills[id];
    const cooldown = fighter.cooldowns[id];
    const ready = !cooldown && fighter.meter >= (skill.cost ?? 0);
    const status = cooldown ? (cooldown * FRAME_SECONDS).toFixed(1) + 's' : ready ? 'Sẵn sàng' : skill.cost + ' NL';
    indicator.textContent = skill.label + ' · ' + status;
    indicator.classList.toggle('ready', ready);
  }
  if (meter.dash) meter.dash.textContent = fighter.dashCooldown
    ? 'Lướt ' + (fighter.dashCooldown * FRAME_SECONDS).toFixed(1) + 's'
    : 'Lướt sẵn sàng';
  if (meter.escape) meter.escape.textContent = fighter.escapeCooldown
    ? 'Thoát ' + (fighter.escapeCooldown * FRAME_SECONDS).toFixed(1) + 's'
    : '';
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
  if (previousHP[0] !== hung.hp || previousHP[1] !== mai.hp || previousSecond !== Math.ceil(seconds)) updateUI();
  if (phase === 'fight') {
    const status = hung.hitstun > 0
      ? 'CHOÁNG · GIỮ A/D ĐỂ DI CHUYỂN KHI HẾT CHOÁNG'
      : 'ĐẤU ĐI — ĐỪNG ĐỂ LỘ SƠ HỞ';
    if (ui['status-text'].textContent !== status) ui['status-text'].textContent = status;
  }
  updateMeterUI(hung, 'hung');
  updateMeterUI(mai, 'mai');
  render();
  if (toastClock <= 0) ui.toast.classList.remove('show');
  requestAnimationFrame(frame);
}
resetFighters();
requestAnimationFrame(frame);
