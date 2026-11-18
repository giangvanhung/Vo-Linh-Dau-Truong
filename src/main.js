import { Fighter, resolveHit } from './combat.js';

const config = await fetch('/data/fighters.json').then(response => {
  if (!response.ok) throw new Error('Không tải được cấu hình trận đấu.');
  return response.json();
});
const canvas = document.querySelector('#arena');
const ctx = canvas.getContext('2d');
const ui = Object.fromEntries(['round-label','hung-wins','mai-wins','hung-health','mai-health','hung-hp','mai-hp','timer','score-hung','score-mai','callout','start-button','toast','status-text'].map(id => [id, document.getElementById(id)]));
const keys = new Set();
const world = { width: canvas.width, height: canvas.height, gravity: config.stage.gravity };
const roundLength = config.stage.roundSeconds;
let hung, mai, phase = 'intro', seconds = roundLength, winsHung = 0, winsMai = 0, round = 1;
let lastTime = 0, aiClock = .45, aiPlan = null, toastClock = 0, roundClock = 0, screenFlash = 0;
const particles = [], floaters = [];

function fighterX(side) { return canvas.width * config.stage[side === 'hung' ? 'playerStartRatio' : 'cpuStartRatio']; }
function resetFighters() {
  hung = new Fighter(config.characters.hung, fighterX('hung'), 1);
  mai = new Fighter(config.characters.mai, fighterX('mai'), -1);
  seconds = roundLength;
  aiClock = .4;
  aiPlan = null;
  particles.length = 0;
  floaters.length = 0;
  updateUI();
}
function startGame() {
  if (phase === 'over') { winsHung = 0; winsMai = 0; round = 1; }
  resetFighters();
  phase = 'fight';
  ui.callout.classList.add('hidden');
  ui.statusText.textContent = 'ĐẤU ĐI — ĐỪNG ĐỂ LỘ SƠ HỞ';
  updateUI();
}
ui.startButton.addEventListener('click', startGame);

const preventKeys = new Set([' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown']);
window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (preventKeys.has(event.key)) event.preventDefault();
  if (event.repeat) { keys.add(key); return; }
  keys.add(key);
  if (phase !== 'fight') return;
  if (key === 'w' && hung.onGround && hung.hitstun <= 0 && !hung.attacking) hung.vy = -config.stage.jumpVelocity;
  if (key === 'j') hung.startAttack('light', config.attacks.light);
  if (key === 'k') hung.startAttack('heavy', config.attacks.heavy);
  if (key === 'l') hung.startAttack('kick', config.attacks.kick);
});
window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

function update(dt) {
  if (phase !== 'fight') return;
  seconds = Math.max(0, seconds - dt);
  hung.facing = mai.x >= hung.x ? 1 : -1;
  mai.facing = hung.x >= mai.x ? 1 : -1;
  const playerStunned = hung.hitstun > 0;
  hung.blocking = keys.has('p') && !hung.attacking && !playerStunned && hung.onGround;
  hung.crouching = keys.has('s') && hung.onGround && !hung.attacking && !hung.blocking && !playerStunned;
  if (!playerStunned && !hung.attacking && !hung.blocking) {
    const direction = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    hung.x += direction * config.stage.moveSpeed * (hung.crouching ? .33 : 1) * dt;
  }
  updateCpu(dt);
  hung.update(dt, world);
  mai.update(dt, world);
  separateFighters();
  const hit1 = resolveHit(hung, mai);
  const hit2 = resolveHit(mai, hung);
  if (hit1) hitEffects(hit1, hit1.blocked);
  if (hit2) hitEffects(hit2, hit2.blocked);
  particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; });
  floaters.forEach(f => { f.y -= 28 * dt; f.life -= dt; });
  while (particles.length && particles[0].life <= 0) particles.shift();
  for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i].life <= 0) floaters.splice(i, 1);
  toastClock = Math.max(0, toastClock - dt);
  screenFlash = Math.max(0, screenFlash - dt);
  roundClock += dt;
  if (roundClock > .4) { roundClock = 0; updateUI(); }
  if (hung.hp <= 0 || mai.hp <= 0 || seconds <= 0) finishRound();
}

function updateCpu(dt) {
  aiClock -= dt;
  if (aiClock > 0) {
    if (aiPlan?.type === 'move') mai.x += aiPlan.direction * config.stage.moveSpeed * .76 * dt;
    mai.blocking = aiPlan?.type === 'block' && !mai.attacking && mai.onGround;
    return;
  }
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
    mai.startAttack(attackId, config.attacks[attackId]);
    aiClock = .38 + Math.random() * .55;
  } else {
    aiPlan = { type: 'block' }; aiClock = .18 + Math.random() * .26;
  }
}

function separateFighters() {
  const minimum = (hung.width + mai.width) / 2 + 5;
  const distance = Math.abs(mai.x - hung.x);
  if (distance < minimum) {
    const direction = Math.sign(mai.x - hung.x) || 1;
    const push = (minimum - distance) / 2;
    if (!hung.attacking) hung.x -= direction * push;
    if (!mai.attacking) mai.x += direction * push;
  }
}
function hitEffects(hit, blocked) {
  toast(blocked ? 'ĐỠ ĐÒN!' : `-${hit.damage} HP`);
  floaters.push({ x: hit.x, y: hit.y, life: .75, total: .75, text: blocked ? 'BLOCK' : `-${hit.damage}`, blocked });
  if (!blocked) {
    screenFlash = .07;
    for (let i = 0; i < 11; i++) {
      const a = Math.random() * Math.PI * 2, speed = 55 + Math.random() * 170;
      particles.push({ x: hit.x, y: canvas.height * config.stage.groundRatio + hit.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 20, life: .18 + Math.random() * .25, size: 2 + Math.random() * 3, color: i % 2 ? '#ffcb7c' : '#fff1cf' });
    }
  }
}
function toast(text) { ui.toast.textContent = text; ui.toast.classList.add('show'); toastClock = .65; }
function finishRound() {
  phase = 'round-over';
  hung.blocking = mai.blocking = false;
  const winner = hung.hp === mai.hp ? null : hung.hp > mai.hp ? 'hung' : 'mai';
  if (hung.hp <= 0) { winsMai++; }
  else if (mai.hp <= 0) { winsHung++; }
  else if (winner === 'hung') winsHung++;
  else winsMai++;
  updateUI();
  if (winsHung >= config.stage.winsToMatch || winsMai >= config.stage.winsToMatch) {
    phase = 'over';
    showCallout(winsHung > winsMai ? 'CHIẾN THẮNG' : 'THẤT BẠI', winsHung > winsMai ? 'Hùng đã làm chủ đấu trường.' : 'Mai đã thắng trận đấu này.', 'CHƠI LẠI');
    ui.statusText.textContent = 'TRẬN ĐẤU ĐÃ KẾT THÚC';
  } else {
    phase = 'round-over';
    const label = winner === 'hung' ? 'HÙNG THẮNG HIỆP!' : 'MAI THẮNG HIỆP!';
    const sub = `TỈ SỐ HIỆP  ${winsHung} — ${winsMai}`;
    showCallout(label, sub, 'HIỆP TIẾP THEO');
    ui.statusText.textContent = 'CHUẨN BỊ CHO HIỆP TIẾP THEO';
    round++;
  }
}
function showCallout(title, subtitle, buttonText) {
  ui.callout.querySelector('.callout-kicker').textContent = `HIỆP ${String(round).padStart(2,'0')} · KẾT THÚC`;
  ui.callout.querySelector('strong').innerHTML = title;
  ui.callout.querySelector('p').textContent = subtitle;
  ui.startButton.innerHTML = `${buttonText} <span>↗</span>`;
  ui.callout.classList.remove('hidden');
}
function updateUI() {
  ui['hung-health'].style.width = `${hung.hp}%`;
  ui['mai-health'].style.width = `${mai.hp}%`;
  ui['hung-hp'].textContent = hung.hp;
  ui['mai-hp'].textContent = mai.hp;
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
  for (const f of [hung, mai]) drawFighter(f, ground);
  for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / .35); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }
  ctx.globalAlpha = 1;
  for (const f of floaters) { ctx.globalAlpha = Math.min(1, f.life * 2); ctx.textAlign = 'center'; ctx.font = '700 14px Space Grotesk, sans-serif'; ctx.fillStyle = f.blocked ? '#9fd3f6' : '#ffd08b'; ctx.fillText(f.text, f.x, ground + f.y - (1 - f.life / f.total) * 8); }
  ctx.globalAlpha = 1;
  if (screenFlash) { ctx.fillStyle = `rgba(255,224,176,${screenFlash * .65})`; ctx.fillRect(0, 0, w, h); }
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
  if (telegraph && attack) { ctx.fillStyle = f.glow; ctx.globalAlpha = .16 + Math.sin(performance.now() / 35) * .08; ctx.fillRect(x + f.facing * 25, top + attack.yOffset * scale, f.facing * attack.range, attack.height * scale); ctx.globalAlpha = 1; }
  if (attack && f.attackActive) { ctx.fillStyle = f.glow; ctx.globalAlpha = .72; const boxX = f.facing > 0 ? x + bodyW * .18 : x - bodyW * .18 - attack.range; ctx.fillRect(boxX, top + attack.yOffset * scale, attack.range, attack.height * scale); ctx.globalAlpha = 1; }
  if (f.blocking) { ctx.strokeStyle = '#b5d9f5'; ctx.lineWidth = 3; ctx.globalAlpha = .78; ctx.beginPath(); ctx.arc(x, top + bodyH * .48, bodyW * 1.15, -1.05, 1.05); ctx.stroke(); ctx.globalAlpha = 1; }
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
}

function frame(now) { const dt = Math.min((now - lastTime) / 1000 || 0, .04); lastTime = now; update(dt); render(); if (toastClock <= 0) ui.toast.classList.remove('show'); requestAnimationFrame(frame); }
resetFighters();
requestAnimationFrame(frame);
