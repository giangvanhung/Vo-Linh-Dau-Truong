import { FRAME_SECONDS } from '../combat/fighter.js';
import { difficultyLabels } from '../platform/settings.js';

export const damageFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

export function createHud(config) {
  const byId = id => document.getElementById(id);
  const ui = Object.fromEntries(["round-label","hung-wins","mai-wins","hung-health","mai-health","hung-hp","mai-hp","timer","score-hung","score-mai"].map(id => [id, byId(id)]));
  const meterUI = Object.fromEntries(['hung', 'mai'].map(side => [side, {
    fill: document.getElementById(side + '-meter-fill'),
    value: document.getElementById(side + '-meter-value'),
    dash: document.getElementById(side + '-dash'),
    escape: document.getElementById(side + '-escape'),
    skills: document.getElementById(side + '-skills'),
  }]));

  for (const [id, fighter] of Object.entries(config.characters)) {
    const info = document.getElementById(`profile-${id}`);
    const values = { ...fighter.profile, hp: fighter.hp, speed: `${fighter.moveSpeed} px/s` };
    for (const [field, value] of Object.entries(values)) {
      info.querySelector(`[data-stat="${field}"]`).textContent = value;
    }
  }
  const rosterInfo = byId('fighter-info');
  byId('setup-roster').append(rosterInfo);
  rosterInfo.hidden = false;

  function updateRosterUI({ hung, mai, practice, difficulty, lan }) {
    for (const [side, fighter] of [['hung', hung], ['mai', mai]]) {
      const hud = document.querySelector('.player-' + side);
      hud.querySelector('strong').textContent = fighter.name.toUpperCase();
      hud.style.setProperty('--fighter-color', fighter.color);
      ui['score-' + side].parentElement.querySelector('.score-name').textContent = fighter.name.toUpperCase();
    }
    document.querySelector('.player-mai .player-side').textContent = practice ? 'BÙ NHÌN' : lan ? 'NGƯỜI CHƠI 2' : 'CPU · ' + difficultyLabels[difficulty].toUpperCase();
    document.querySelector('.controls-card .heading-note').textContent = hung.name.toUpperCase() + ' · NGƯỜI CHƠI';
    byId('close-control').textContent = hung.skills.closeSkill.label;
    byId('range-control').textContent = hung.skills.rangedSkill.label;
    byId('ultimate-control').textContent = hung.skills.ultimate.label + ' · ' + hung.skills.ultimate.cost;
  }
  function updateUI({ hung, mai, practice, seconds, round, winsHung, winsMai }) {
    ui['hung-health'].style.width = `${100 * hung.hp / hung.maxHp}%`;
    ui['mai-health'].style.width = `${100 * mai.hp / mai.maxHp}%`;
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


  return { updateRosterUI, updateUI, updateMeterUI };
}
