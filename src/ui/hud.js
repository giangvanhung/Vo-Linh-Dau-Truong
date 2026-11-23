import { FRAME_SECONDS } from '../combat/fighter.js';
import { difficultyLabels } from '../platform/settings.js';
import { keyLabel } from '../platform/keyboard.js';
import { gear } from '../game/pickups.js';
import { mainWeaponAttack } from '../game/weapon-attacks.js';
import { heroEnergyMax, nextHeroForm } from '../game/hero-form.js';

export const damageFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const cooldownFormat = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const skillBindings = { closeSkill: 'u', rangedSkill: 'i', ultimate: 'o' };

export function createHud() {
  const byId = id => document.getElementById(id);
  const ui = {};
  for (const id of ["round-label","match-format","guide-format","hung-damage-score","mai-damage-score","hung-wins","mai-wins","hung-health","mai-health","hung-hp","mai-hp","timer","score-hung","score-mai"]) {
    ui[id] = byId(id);
  }
  const meterUI = {};
  for (const side of ['hung', 'mai']) meterUI[side] = {
    hero: byId(side + '-hero-energy'),
    flight: byId(side + '-flight-stamina'),
    focus: document.getElementById(side + '-focus'),
    fill: document.getElementById(side + '-meter-fill'),
    value: document.getElementById(side + '-meter-value'),
    dash: document.getElementById(side + '-dash'),
    escape: document.getElementById(side + '-escape'),
    skills: Array.from(byId(side + '-skills').children, card => {
      card.className = 'skill-card';
      const title = document.createElement('span');
      title.className = 'skill-title';
      const key = document.createElement('kbd');
      key.className = 'skill-key';
      const name = document.createElement('span');
      name.className = 'skill-name';
      const status = document.createElement('small');
      status.className = 'skill-state';
      title.append(key, name);
      card.append(title, status);
      return { id: card.dataset.skill, card, key, name, status };
    }),
  };

  function updateRosterUI({ hung, mai, practice, difficulty, lan, team, activePlayer, activeCpu }) {
    for (const [side, fighter] of [['hung', hung], ['mai', mai]]) {
      const hud = document.querySelector('.player-' + side);
      hud.querySelector('strong').textContent = fighter.name.toUpperCase();
      hud.style.setProperty('--fighter-color', fighter.color);
      ui['score-' + side].parentElement.querySelector('.score-name').textContent = fighter.name.toUpperCase();
    }
    document.querySelector('.player-hung .player-side').textContent = team ? 'P' + (activePlayer + 1) + (activePlayer ? ' · Cuối' : ' · Còn P2') : 'P1';
    document.querySelector('.player-mai .player-side').textContent = team ? 'CPU ' + (activeCpu + 1) + (activeCpu ? ' · Cuối' : ' · Còn CPU 2') : practice ? 'BÙ NHÌN' : lan ? 'P2' : 'CPU · ' + difficultyLabels[difficulty].toUpperCase();
    document.querySelector('.controls-card .heading-note').textContent = hung.name.toUpperCase() + ' · NGƯỜI CHƠI';
    byId('heavy-control').textContent = hung.characterId === 'hung' ? hung.attacks.heavy.label : 'Đấm nặng';
    byId('kick-control').textContent = hung.attacks.kick.label;
    byId('close-control').textContent = hung.skills.closeSkill.label;
    byId('range-control').textContent = hung.skills.rangedSkill.label;
    byId('ultimate-control').textContent = hung.skills.ultimate.label + ' · ' + hung.skills.ultimate.cost;
  }
  function updateUI({ hung, mai, practice, seconds, round, winsHung, winsMai, bestOf, damageHung, damageMai }) {
    for (const [side, fighter] of [['hung', hung], ['mai', mai]]) {
      const bar = ui[side + '-health'];
      const capacity = fighter.maxHp + fighter.barrierMax;
      const width = 100 * fighter.hp / capacity + '%';
      const barrierWidth = 100 * fighter.awakeningBarrier / capacity + '%';
      const barrier = bar.nextElementSibling;
      if (barrier.style.width !== barrierWidth) barrier.style.width = barrierWidth;
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

  function updateMeterUI(fighter, side, bindings) {
    const meter = meterUI[side];
    const flight = fighter.flight;
    meter.flight.hidden = !flight;
    if (flight) {
      const bar = meter.flight.querySelector('progress');
      bar.max = flight.stamina;
      bar.value = fighter.flightStamina;
    }
    meter.hero.hidden = !fighter.heroForm;
    if (fighter.heroForm) {
      const bar = meter.hero.querySelector('progress');
      const form = fighter.activeHeroForm;
      const next = nextHeroForm(fighter);
      const charge = Math.floor(fighter.heroEnergy) + '/' + heroEnergyMax;
      bar.value = form && !next ? 100 * fighter.awakeningBarrier / fighter.barrierMax : fighter.heroEnergy;
      const label = form
        ? [form.label,
          next ? 'Cấp ' + (fighter.heroStage + 1) + ' · ' + charge : '',
          fighter.heroCounter ? 'Phản đòn sẵn sàng' : ''].filter(Boolean).join(' · ')
        : 'Biến hình · ' + charge;
      setText(meter.hero.querySelector('span'), label);
    }
    const value = Math.floor(fighter.meter);
    if (meter.fill) meter.fill.style.width = fighter.meter / fighter.meterMax * 100 + '%';
    meter.fill?.parentElement.classList.toggle('full', fighter.meter >= fighter.meterMax);
    if (meter.value) setText(meter.value, value + '/' + fighter.meterMax);
    for (const { id, card, key, name, status } of meter.skills) {
      const skill = mainWeaponAttack(fighter, id) ?? fighter.skillFor(id);
      const cooldown = fighter.cooldowns[id];
      const { required: cost } = fighter.attackMeter(id, skill);
      const state = cooldown ? 'cooldown' : fighter.meter >= cost ? 'ready' : 'meter';
      if (card.dataset.state !== state) card.dataset.state = state;
      if (key.hidden !== !bindings) key.hidden = !bindings;
      if (bindings) setText(key, keyLabel(bindings[skillBindings[id]]));
      setText(name, skill.label);
      setText(status, cooldown ? 'Đang hồi ' + cooldownFormat.format(cooldown * FRAME_SECONDS) + 's'
        : state === 'ready' ? '✓ Sẵn sàng' : 'Thiếu nộ · cần ' + cost);
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
    const activeForm = fighter.formLevel
      ? [fighter.evolving ? 'Tiến hóa cấp ' + fighter.awakeningLevel : '',
        'Giáp ' + Math.ceil(fighter.awakeningBarrier) + '/' + fighter.barrierMax].filter(Boolean).join(' · ') : '';
    const next = fighter.nextAwakening;
    const focus = fighter.awakeningReady ? 'Cấp ' + next + ' sẵn sàng'
      : fighter.charging ? 'Đang tụ khí'
      : fighter.awakeningUnlocked && next ? 'Nạp đầy để lên cấp ' + next
      : next && fighter.meter >= fighter.meterMax ? fighter.awakening.condition : '';
    const message = [activeForm, focus, status].filter(Boolean).join(' · ');
    if (meter.focus.textContent !== message) meter.focus.textContent = message;
    if (meter.dash) setText(meter.dash, fighter.dashCooldown
      ? 'Lướt ' + (fighter.dashCooldown * FRAME_SECONDS).toFixed(1) + 's'
      : 'Lướt sẵn sàng');
    if (meter.escape) setText(meter.escape, [
      fighter.escapeCooldown ? 'Thoát ' + (fighter.escapeCooldown * FRAME_SECONDS).toFixed(1) + 's' : '',
      fighter.wallEscapeCooldown ? 'Bật tường ' + (fighter.wallEscapeCooldown * FRAME_SECONDS).toFixed(1) + 's' : '',
    ].filter(Boolean).join(' · '));
  }

  function setText(element, text) {
    if (element.textContent !== text) element.textContent = text;
  }

  return { updateRosterUI, updateUI, updateMeterUI };
}
