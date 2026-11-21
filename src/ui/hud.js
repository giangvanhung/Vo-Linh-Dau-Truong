import { FRAME_SECONDS } from '../combat/fighter.js';
import { difficultyLabels } from '../platform/settings.js';
import { gear } from '../game/pickups.js';
import { mainWeaponAttack } from '../game/weapon-attacks.js';

export const damageFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

export function createHud(config) {
  const byId = id => document.getElementById(id);
  const ui = {};
  for (const id of ["round-label","match-format","guide-format","hung-damage-score","mai-damage-score","hung-wins","mai-wins","hung-health","mai-health","hung-hp","mai-hp","timer","score-hung","score-mai"]) {
    ui[id] = byId(id);
  }
  const meterUI = {};
  for (const side of ['hung', 'mai']) meterUI[side] = {
    hero: byId(side + '-hero-energy'),
    focus: document.getElementById(side + '-focus'),
    fill: document.getElementById(side + '-meter-fill'),
    value: document.getElementById(side + '-meter-value'),
    dash: document.getElementById(side + '-dash'),
    escape: document.getElementById(side + '-escape'),
    skills: document.getElementById(side + '-skills'),
  };

  function updateRosterUI({ hung, mai, practice, difficulty, lan, team, activePlayer, activeCpu }) {
    for (const [side, fighter] of [['hung', hung], ['mai', mai]]) {
      const hud = document.querySelector('.player-' + side);
      hud.querySelector('strong').textContent = fighter.name.toUpperCase();
      hud.style.setProperty('--fighter-color', fighter.color);
      ui['score-' + side].parentElement.querySelector('.score-name').textContent = fighter.name.toUpperCase();
    }
    document.querySelector('.player-hung .player-side').textContent = team ? 'P' + (activePlayer + 1) + (activePlayer ? ' · Cuối' : ' · Còn P2') : 'NGƯỜI CHƠI 1';
    document.querySelector('.player-mai .player-side').textContent = team ? 'CPU ' + (activeCpu + 1) + (activeCpu ? ' · Cuối' : ' · Còn CPU 2') : practice ? 'BÙ NHÌN' : lan ? 'NGƯỜI CHƠI 2' : 'CPU · ' + difficultyLabels[difficulty].toUpperCase();
    document.querySelector('.controls-card .heading-note').textContent = hung.name.toUpperCase() + ' · NGƯỜI CHƠI';
    byId('kick-control').textContent = hung.attacks.kick.label;
    byId('close-control').textContent = hung.skills.closeSkill.label;
    byId('range-control').textContent = hung.skills.rangedSkill.label;
    byId('ultimate-control').textContent = hung.skills.ultimate.label + ' · ' + hung.skills.ultimate.cost;
  }
  function updateUI({ hung, mai, practice, seconds, round, winsHung, winsMai, bestOf, damageHung, damageMai }) {
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
    setText(ui['hung-hp'], damageFormat.format(hung.hp) + ' / ' + damageFormat.format(hung.maxHp));
    setText(ui['mai-hp'], damageFormat.format(mai.hp) + ' / ' + damageFormat.format(mai.maxHp));
    setText(ui.timer, practice ? '∞' : String(Math.ceil(seconds)).padStart(2, '0'));
    setText(ui['score-hung'], String(winsHung));
    setText(ui['score-mai'], String(winsMai));
    setText(ui['hung-damage-score'], damageFormat.format(damageHung / 100));
    setText(ui['mai-damage-score'], damageFormat.format(damageMai / 100));
    const needed = Math.ceil(bestOf / 2);
    const format = practice ? 'TẬP TỰ DO' : 'BO' + bestOf + ' · THẮNG ' + needed;
    setText(ui['match-format'], format);
    setText(ui['guide-format'], format);
    setText(ui['round-label'], practice ? 'LUYỆN TẬP' : 'HIỆP ' + String(round).padStart(2, '0'));
    for (const [side, wins] of [['hung', winsHung], ['mai', winsMai]]) {
      const marker = ui[side + '-wins'];
      marker.hidden = practice;
      const label = wins + ' / ' + needed + ' hiệp thắng';
      if (marker.getAttribute('aria-label') === label) continue;
      marker.setAttribute('aria-label', label);
      marker.innerHTML = '<b>' + wins + '</b>' + Array.from({ length: needed }, (_, index) =>
        index < wins ? '<i class="won"></i>' : '<i></i>').join('');
    }
    ui.timer.style.color = seconds < 10 ? '#ef876b' : '';
  }

  function updateMeterUI(fighter, side) {
    const meter = meterUI[side];
    meter.hero.hidden = !fighter.heroForm;
    if (fighter.heroForm) {
      const bar = meter.hero.querySelector('progress');
      bar.value = fighter.heroFrames ? 100 * fighter.heroFrames / (fighter.heroDuration ?? fighter.heroForm.duration) : fighter.heroEnergy;
      setText(meter.hero.querySelector('span'), fighter.heroFrames
        ? fighter.heroForm.label + ' · ' + Math.ceil(fighter.heroFrames / 60) + 's'
        : 'Biến hình · ' + fighter.heroEnergy + '/100');
    }
    const value = Math.floor(fighter.meter);
    if (meter.fill) meter.fill.style.width = fighter.meter / config.combat.meterMax * 100 + '%';
    meter.fill?.parentElement.classList.toggle('full', fighter.meter >= config.combat.meterMax);
    if (meter.value) setText(meter.value, value + '/' + config.combat.meterMax);
    for (const indicator of meter.skills.children) {
      const id = indicator.dataset.skill;
      const skill = mainWeaponAttack(fighter, id) ?? fighter.skillFor(id);
      const cooldown = fighter.cooldowns[id];
      const ready = !cooldown && fighter.meter >= (skill.cost ?? 0);
      const status = cooldown ? (cooldown * FRAME_SECONDS).toFixed(1) + 's' : ready ? 'Sẵn sàng' : skill.cost + ' NL';
      setText(indicator, skill.label + ' · ' + status);
      indicator.classList.toggle('ready', ready);
    }
    const status = [
      fighter.stageCondition ? fighter.stageCondition.label : '',
      fighter.shieldHp > 0 ? 'Giáp ' + Math.ceil(fighter.shieldHp) : '',
      fighter.powerFrames ? '+Công ' + Math.ceil(fighter.powerFrames * FRAME_SECONDS) + 's' : '',
      fighter.weaponUses ? gear[fighter.pickupWeapon].label + ' ×' + fighter.weaponUses + ' · '
        + Math.ceil(fighter.weaponFrames * FRAME_SECONDS) + 's' : fighter.weapon?.label ?? '',
      fighter.freezeFrames ? 'Đóng băng' : fighter.frostStacks ? 'Hàn ' + fighter.frostStacks + '/3' : '',
      fighter.poisonFrames ? 'Trúng độc ' + fighter.poisonStacks + '/3' : '',
    ].filter(Boolean).join(' · ');
    const activeForm = fighter.awakeningFrames
      ? 'Cấp ' + fighter.awakeningLevel + ' · ' + (fighter.awakeningFrames * FRAME_SECONDS).toFixed(1) + 's' : '';
    const next = fighter.nextAwakening;
    const focus = fighter.awakeningReady ? 'Cấp ' + next + ' sẵn sàng'
      : fighter.charging ? 'Đang tụ khí'
      : fighter.awakeningUnlocked && next ? 'Nạp đầy để lên cấp ' + next
      : next && fighter.meter >= fighter.rules.meterMax ? fighter.awakening.condition : '';
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
