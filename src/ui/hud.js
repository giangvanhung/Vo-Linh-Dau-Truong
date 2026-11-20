import { FRAME_SECONDS } from '../combat/fighter.js';
import { difficultyLabels } from '../platform/settings.js';
import { gear } from '../game/pickups.js';

export const damageFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

export function createHud(config) {
  const byId = id => document.getElementById(id);
  const ui = {};
  for (const id of ["round-label","hung-wins","mai-wins","hung-health","mai-health","hung-hp","mai-hp","timer","score-hung","score-mai"]) {
    ui[id] = byId(id);
  }
  const meterUI = {};
  for (const side of ['hung', 'mai']) meterUI[side] = {
    focus: document.getElementById(side + '-focus'),
    fill: document.getElementById(side + '-meter-fill'),
    value: document.getElementById(side + '-meter-value'),
    dash: document.getElementById(side + '-dash'),
    escape: document.getElementById(side + '-escape'),
    skills: document.getElementById(side + '-skills'),
  };

  function updateRosterUI({ hung, mai, practice, difficulty, lan }) {
    for (const [side, fighter] of [['hung', hung], ['mai', mai]]) {
      const hud = document.querySelector('.player-' + side);
      hud.querySelector('strong').textContent = fighter.name.toUpperCase();
      hud.style.setProperty('--fighter-color', fighter.color);
      ui['score-' + side].parentElement.querySelector('.score-name').textContent = fighter.name.toUpperCase();
    }
    document.querySelector('.player-mai .player-side').textContent = practice ? 'BÙ NHÌN' : lan ? 'NGƯỜI CHƠI 2' : 'CPU · ' + difficultyLabels[difficulty].toUpperCase();
    document.querySelector('.controls-card .heading-note').textContent = hung.name.toUpperCase() + ' · NGƯỜI CHƠI';
    byId('kick-control').textContent = hung.attacks.kick.label;
    byId('close-control').textContent = hung.skills.closeSkill.label;
    byId('range-control').textContent = hung.skills.rangedSkill.label;
    byId('ultimate-control').textContent = hung.skills.ultimate.label + ' · ' + hung.skills.ultimate.cost;
  }
  function updateUI({ hung, mai, practice, seconds, round, winsHung, winsMai }) {
    for (const [side, fighter] of [['hung', hung], ['mai', mai]]) {
      const bar = ui[side + '-health'];
      const width = 100 * fighter.hp / fighter.maxHp + '%';
      if (bar.style.width !== width) {
        bar.style.width = width;
        bar.parentElement.style.setProperty('--remaining-hp', width);
      }
    }
    ui['hung-health'].classList.toggle('critical', hung.hp <= hung.maxHp * .25);
    ui['mai-health'].classList.toggle('critical', mai.hp <= mai.maxHp * .25);
    ui['hung-hp'].textContent = damageFormat.format(hung.hp);
    ui['mai-hp'].textContent = damageFormat.format(mai.hp);
    ui.timer.textContent = practice ? '∞' : String(Math.ceil(seconds)).padStart(2, '0');
    ui['score-hung'].textContent = winsHung;
    ui['score-mai'].textContent = winsMai;
    ui['round-label'].textContent = practice ? 'LUYỆN TẬP' : `HIỆP ${String(round).padStart(2, '0')}`;
    ui['hung-wins'].innerHTML = `${winsHung > 0 ? '<span class="won">◆</span>' : '◇'} ${winsHung > 1 ? '<span class="won">◆</span>' : '◇'}`;
    ui['mai-wins'].innerHTML = `${winsMai > 0 ? '<span class="won">◆</span>' : '◇'} ${winsMai > 1 ? '<span class="won">◆</span>' : '◇'}`;
    ui.timer.style.color = seconds < 10 ? '#ef876b' : '';
  }

  function updateMeterUI(fighter, side) {
    const meter = meterUI[side];
    const value = Math.floor(fighter.meter);
    if (meter.fill) meter.fill.style.width = fighter.meter / config.combat.meterMax * 100 + '%';
    meter.fill?.parentElement.classList.toggle('full', fighter.meter >= config.combat.meterMax);
    if (meter.value) setText(meter.value, value + '/' + config.combat.meterMax);
    for (const indicator of meter.skills.children) {
      const id = indicator.dataset.skill;
      const skill = fighter.skillFor(id);
      const cooldown = fighter.cooldowns[id];
      const ready = !cooldown && fighter.meter >= (skill.cost ?? 0);
      const status = cooldown ? (cooldown * FRAME_SECONDS).toFixed(1) + 's' : ready ? 'Sẵn sàng' : skill.cost + ' NL';
      setText(indicator, skill.label + ' · ' + status);
      indicator.classList.toggle('ready', ready);
    }
    const status = [
      fighter.shieldHp > 0 ? 'Giáp ' + Math.ceil(fighter.shieldHp) : '',
      fighter.powerFrames ? '+Công ' + Math.ceil(fighter.powerFrames * FRAME_SECONDS) + 's' : '',
      fighter.weaponUses ? gear[fighter.pickupWeapon].label + ' ×' + fighter.weaponUses : '',
      fighter.freezeFrames ? 'Đóng băng' : fighter.frostStacks ? 'Hàn ' + fighter.frostStacks + '/3' : '',
      fighter.poisonFrames ? 'Trúng độc ' + fighter.poisonStacks + '/3' : '',
    ].filter(Boolean).join(' · ');
    const activeForm = fighter.awakeningFrames
      ? 'Cấp ' + fighter.awakeningLevel + ' · ' + (fighter.awakeningFrames * FRAME_SECONDS).toFixed(1) + 's' : '';
    const next = fighter.nextAwakening;
    const focus = fighter.awakeningReady ? 'Cấp ' + next + ' sẵn sàng'
      : fighter.charging ? 'Đang tụ khí'
      : fighter.awakeningUnlocked && next ? 'Nạp đầy để lên cấp ' + next : '';
    const message = [activeForm, focus, status].filter(Boolean).join(' · ');
    if (meter.focus.textContent !== message) meter.focus.textContent = message;
    if (meter.dash) setText(meter.dash, fighter.dashCooldown
      ? 'Lướt ' + (fighter.dashCooldown * FRAME_SECONDS).toFixed(1) + 's'
      : 'Lướt sẵn sàng');
    if (meter.escape) setText(meter.escape, fighter.escapeCooldown
      ? 'Thoát ' + (fighter.escapeCooldown * FRAME_SECONDS).toFixed(1) + 's'
      : '');
  }

  function setText(element, text) {
    if (element.textContent !== text) element.textContent = text;
  }

  return { updateRosterUI, updateUI, updateMeterUI };
}
