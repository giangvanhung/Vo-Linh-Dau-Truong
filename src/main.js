import { FRAME_SECONDS, Fighter, findHit, applyHit } from './combat.js';

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
}]));
const keys = new Set();
const world = { width: canvas.width, height: canvas.height, gravity: config.stage.gravity };
const roundLength = config.stage.roundSeconds;
let hung, mai, phase = 'intro', seconds = roundLength, winsHung = 0, winsMai = 0, round = 1;
let lastTime, accumulator = 0, aiClock = .45, aiPlan = null, toastClock = 0;
let hitstop = 0, shake = 0, queuedAttack = null, queuedAction = null;
const attackKeys = { j: 'light', k: 'heavy', l: 'kick' };
const damageFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const particles = [], floaters = [];

function fighterX(side) { return canvas.width * config.stage[side === 'hung' ? 'playerStartRatio' : 'cpuStartRatio']; }
function resetFighters() {
  hung = new Fighter(config.characters.hung, fighterX('hung'), 1, config.combat);
  mai = new Fighter(config.characters.mai, fighterX('mai'), -1, config.combat);
  seconds = roundLength;
  hitstop = shake = toastClock = 0;
  queuedAttack = queuedAction = null;
  aiClock = .4;
  aiPlan = null;
  particles.length = 0;
  floaters.length = 0;
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
const gameKeys = new Set(['a', 'd', 'w', 's', 'j', 'k', 'l', 'p', 'o', 't', 'u']);
const heldInputs = new Map();

function gameKey(event) {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase();
  return movementAliases[event.code] ?? movementAliases[event.key] ?? event.key?.toLowerCase();
}

window.addEventListener('keydown', event => {
  if (phase !== 'fight') return;
  const key = gameKey(event);
  if (!gameKeys.has(key) || event.ctrlKey || event.metaKey || event.altKey) return;
  event.preventDefault();
  heldInputs.set(event.code || key, key);
  keys.add(key);
  if (event.repeat) return;
  if (key === 'w' && !hitstop && hung.onGround && !hung.disabled && !hung.attacking && !hung.dash && !keys.has('p')) {
    hung.vy = -config.stage.jumpVelocity;
    hung.onGround = false;
  }
  if (attackKeys[key]) queuedAttack = attackKeys[key];
  if (key === 'o') queuedAction = event.shiftKey ? 'enhancedDash' : 'dash';
  if (key === 't') queuedAction = 'escape';
  if (key === 'u') queuedAction = 'ultimate';
});
window.addEventListener('keyup', event => {
  const input = event.code || gameKey(event);
  const key = heldInputs.get(input);
  heldInputs.delete(input);
  if (key && ![...heldInputs.values()].includes(key)) keys.delete(key);
});
window.addEventListener('blur', () => {
  heldInputs.clear();
  keys.clear();
  queuedAttack = queuedAction = null;
});

function update(dt) {
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
  hung.facing = mai.x >= hung.x ? 1 : -1;
  mai.facing = -hung.facing;
  hung.setGuard(keys.has('p'));
  if (queuedAction === 'dash' || queuedAction === 'enhancedDash') {
    if (hung.startDash(queuedAction === 'enhancedDash') && queuedAction === 'enhancedDash') {
      toast('LƯỚT CƯỜNG HÓA');
    }
  } else if (queuedAction === 'escape' && hung.escapeFrom(mai)) {
    toast('HÙNG THOÁT COMBO!');
  } else if (queuedAction === 'ultimate' && hung.startUltimate(config.attacks.heavy, mai)) {
    toast('TUYỆT CHIÊU!');
  }
  queuedAction = null;
  if (queuedAttack) {
    hung.startAttack(queuedAttack, config.attacks[queuedAttack], mai);
    queuedAttack = null;
  }
  hung.crouching = keys.has('s') && hung.onGround && !hung.dash && !hung.attacking && !hung.blocking && !hung.disabled;
  if (!hung.disabled && !hung.dash && !hung.attacking && !hung.blocking) {
    const direction = Number(keys.has('d')) - Number(keys.has('a'));
    hung.x += direction * config.stage.moveSpeed * (hung.crouching ? .33 : 1) * dt;
  }
  updateCpu(dt);
  hung.update(dt, world);
  mai.update(dt, world);
  if (hung.dash && Math.abs(hung.y - mai.y) < Math.min(hung.height, mai.height)) {
    const spacing = (hung.width + mai.width) / 2 + 5;
    const limit = mai.x - hung.dash.facing * spacing;
    hung.x = hung.dash.facing > 0 ? Math.min(hung.x, limit) : Math.max(hung.x, limit);
    hung.clampX(world);
  }
  separateFighters();
  const contacts = [findHit(hung, mai), findHit(mai, hung)].filter(Boolean);
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
    if (aiPlan?.type === 'move') mai.x += aiPlan.direction * config.stage.moveSpeed * .76 * dt;
    mai.setGuard(aiPlan?.type === 'block');
    return;
  }
  mai.setGuard(false);
  const distance = Math.abs(hung.x - mai.x);
  const inReach = distance < 125;
  const playerInStartup = hung.attack && hung.attack.elapsed < hung.attack.startup;
  if (inReach && playerInStartup && Math.random() < .38) {
    aiPlan = { type: 'block' }; aiClock = .22 + Math.random() * .3;
  } else if (distance > 120) {
    aiPlan = { type: 'move', direction: Math.sign(hung.x - mai.x) }; aiClock = .2 + Math.random() * .35;
  } else if (distance < 67 && Math.random() < .34) {
    aiPlan = { type: 'move', direction: -Math.sign(hung.x - mai.x) }; aiClock = .16 + Math.random() * .22;
  } else if (Math.random() < .72) {
    aiPlan = null;
    const attackId = Math.random() < .45 ? 'light' : Math.random() < .65 ? 'kick' : 'heavy';
    mai.startAttack(attackId, config.attacks[attackId], hung);
    aiClock = .38 + Math.random() * .55;
  } else {
    aiPlan = { type: 'block' }; aiClock = .18 + Math.random() * .26;
  }
}

function separateFighters() {
  if (Math.abs(hung.y - mai.y) >= Math.min(hung.height, mai.height)) return;
  const minimum = (hung.width + mai.width) / 2 + 5;
  const gap = mai.x - hung.x;
  const overlap = minimum - Math.abs(gap);
  if (overlap <= 0) return;
  const direction = Math.sign(gap) || 1;
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
  const ground = canvas.height * config.stage.groundRatio;
  for (let i = 0; i < (blocked ? 5 : 11); i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 55 + Math.random() * 170;
    particles.push({
      x, y: ground + y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: .18 + Math.random() * .17, size: 2 + Math.random() * 3,
      color: blocked ? '#a9d9ff' : i % 2 ? '#ffcb7c' : '#fff1cf',
    });
  }
}

function toast(text) { ui.toast.textContent = text; ui.toast.classList.add('show'); toastClock = .65; }
function finishRound() {
  phase = 'round-over';
  hung.blocking = mai.blocking = false;
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
  for (const f of [hung, mai]) drawFighter(f, ground);
  for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / .35); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }
  ctx.globalAlpha = 1;
  for (const f of floaters) { ctx.globalAlpha = Math.min(1, f.life * 2); ctx.textAlign = 'center'; ctx.font = '700 14px Space Grotesk, sans-serif'; ctx.fillStyle = f.blocked ? '#9fd3f6' : '#ffd08b'; ctx.fillText(f.text, f.x, ground + f.y - (1 - f.life / f.total) * 8); }
  ctx.globalAlpha = 1;
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
  if (attack && (telegraph || f.attackActive)) {
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
