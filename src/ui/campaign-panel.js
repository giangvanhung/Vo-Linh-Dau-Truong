import { Fighter } from '../combat/fighter.js';
import { availableStage, campaignProgress, claimReserved } from '../game/campaign.js';
import { catalog, equipFighter, gearItem, slots, statNames } from '../game/equipment.js';
import { difficultyLabels } from '../platform/settings.js';
import { choiceCard } from './roster-card.js';
import { connectSectionButtons } from './pagination.js';

const byId = id => document.getElementById(id);
const resourceText = reward => reward.gold + ' vàng · ' + reward.material + ' nguyên liệu';

export function createCampaignPanel(config, equipment, { show, openEquipment, start }) {
  const route = config.campaign;
  const roster = byId('campaign-fighters');
  const pagination = byId('campaign-fighter-pages');
  const cards = byId('campaign-stages');
  const showSection = connectSectionButtons(byId('campaign-panel').querySelector('.section-navigation'));
  const entries = Object.entries(config.characters);
  const pageSize = 6;
  let selected = null;
  let fighterId = config.characters.hung ? 'hung' : entries[0][0];
  const fighterCards = entries.map(([id, character]) =>
    choiceCard('campaign-fighter', id, character.name, `/assets/characters/${id}/avatar.png`, id === fighterId, selectFighter));
  roster.append(...fighterCards);
  const pageButtons = Array.from({ length: Math.ceil(entries.length / pageSize) }, (_, page) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'panel-button';
    button.textContent = String(page + 1);
    button.setAttribute('aria-label', 'Trang ' + (page + 1));
    button.addEventListener('click', () => showPage(page));
    return button;
  });
  pagination.append(...pageButtons);
  pagination.hidden = pageButtons.length < 2;
  showPage(Math.floor(entries.findIndex(([id]) => id === fighterId) / pageSize));

  function showPage(page) {
    fighterCards.forEach((card, index) => { card.hidden = Math.floor(index / pageSize) !== page; });
    pageButtons.forEach((button, index) => button.setAttribute('aria-current', index === page ? 'page' : 'false'));
  }

  function selectFighter(id) {
    fighterId = id;
    renderDetails();
  }

  function renderDetails() {
    const stage = route[selected];
    const character = config.characters[fighterId];
    const preview = new Fighter(character, 0, 1, config.combat);
    preview.characterId = fighterId;
    equipFighter(preview, equipment, fighterId, true);
    const worn = Object.entries(preview.equipmentBase.loadout).map(([slot, id]) =>
      slots[slot] + ' · ' + gearItem(equipment, id).name + ' +' + (equipment.inventory[id] - 1));
    if (!preview.equipmentBase.loadout.weapon && preview.weapon) worn.unshift('Vũ khí khởi đầu · ' + preview.weapon.label);
    byId('campaign-portrait').src = '/assets/characters/' + fighterId + '/avatar.png';
    byId('campaign-fighter-name').textContent = character.name;
    byId('campaign-stage-name').textContent = stage.name;
    byId('campaign-rules').textContent = config.characters[stage.opponent].name + ' · ' + config.stages[stage.stage].name
      + ' · ' + difficultyLabels[stage.difficulty] + ' · Thắng ' + Math.ceil(stage.bestOf / 2)
      + ' hiệp · ' + stage.seconds + ' giây/hiệp';
    byId('campaign-extra-rules').textContent = 'Hết giờ xét tỷ lệ máu. '
      + (stage.hazards ? 'Bật luật sân. ' + config.stages[stage.stage].description : 'Tắt cạm bẫy sân.')
      + ' Hộp mù tắt.';
    byId('campaign-first-reward').textContent = resourceText(stage.first);
    byId('campaign-first-item').textContent = equipment.inventory[stage.first.item]
      ? '+' + stage.first.duplicateGold + ' vàng thay cho ' + catalog[stage.first.item].name
      : catalog[stage.first.item].name;
    byId('campaign-replay-reward').textContent = resourceText(stage.replay);
    byId('campaign-loadout').replaceChildren(...(worn.length ? worn : ['Chưa mặc trang bị']).map(label => {
      const item = document.createElement('li');
      item.textContent = label;
      return item;
    }));
    const stats = Object.entries(preview.equipmentStats).filter(([, value]) => value);
    byId('campaign-stats').textContent = 'Máu tối đa ' + preview.maxHp + (stats.length
      ? ' • ' + stats.map(([id, value]) => statNames[id] + ' +' + value
        + (['hp', 'shield', 'regenHp', 'regenMana', 'revive'].includes(id) ? '' : '%')).join(' • ')
      : ' • Chỉ số gốc');
  }

  function render(message = '') {
    const progress = campaignProgress(equipment, route);
    const cleared = route.filter(stage => progress.results[stage.id]?.wins > 0).length;
    if (selected === null) selected = Math.min(cleared, route.length - 1);
    byId('campaign-progress').textContent = [
      cleared === route.length ? 'Đã hoàn thành tuyến' : 'Đã vượt ' + cleared + '/' + route.length + ' ải',
      progress.pending.length ? progress.pending.length + ' vật phẩm đang chờ: ' + progress.pending.map(entry => catalog[entry.item].name).join(', ') : '',
      message,
    ].filter(Boolean).join(' · ');
    byId('campaign-claim').hidden = !progress.pending.length;
    cards.replaceChildren();
    route.forEach((stage, index) => {
      const available = availableStage(route, progress, index);
      const record = progress.results[stage.id];
      const card = document.createElement('button');
      card.className = 'campaign-stage';
      card.type = 'button';
      card.disabled = !available;
      card.dataset.stage = stage.id;
      card.dataset.state = !available ? 'locked' : record?.wins ? 'cleared' : 'open';
      card.setAttribute('aria-pressed', String(selected === index));
      const number = document.createElement('span');
      number.className = 'campaign-stage-number';
      number.textContent = String(index + 1).padStart(2, '0');
      number.setAttribute('aria-hidden', 'true');
      const title = document.createElement('strong');
      title.textContent = stage.name;
      const status = document.createElement('span');
      status.className = 'campaign-stage-status';
      status.textContent = !available ? 'Khóa · qua ải ' + index : record?.wins ? 'Đã vượt' : 'Đã mở';
      card.append(number, title, status);
      card.addEventListener('click', () => {
        selected = index;
        render();
        cards.querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
      });
      cards.append(card);
    });
    renderDetails();
  }

  byId('campaign-start').addEventListener('click', () => start(selected, fighterId));
  byId('campaign-equipment').addEventListener('click', () => openEquipment(fighterId));
  byId('campaign-claim').addEventListener('click', () => {
    const result = claimReserved(equipment, route);
    render(result.failed ? 'Chưa lưu được. Bạn có thể thử nhận lại.'
      : result.received ? 'Đã xử lý ' + result.received + ' vật phẩm chờ.' : 'Kho đã đầy. Bán bớt món để nhận.');
  });
  return (index, message) => {
    if (index !== undefined && availableStage(route, campaignProgress(equipment, route), index)) selected = index;
    render(message);
    showSection('campaign-stages');
    show('campaign');
  };
}
