import { Fighter } from '../combat/fighter.js';
import { availableStage, campaignProgress, claimReserved } from '../game/campaign.js';
import { catalog, equipFighter, gearItem, slots, statNames } from '../game/equipment.js';
import { difficultyLabels } from '../platform/settings.js';
import { choiceCard } from './roster-card.js';

const byId = id => document.getElementById(id);
const resourceText = reward => reward.gold + ' vàng · ' + reward.material + ' nguyên liệu';

export function createCampaignPanel(config, equipment, { show, openEquipment, start }) {
  const route = config.campaign;
  const roster = byId('campaign-fighters');
  const pagination = byId('campaign-fighter-pages');
  const cards = byId('campaign-stages');
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
      slots[slot] + ' · ' + gearItem(equipment, id).name + ' +' + equipment.inventory[id]);
    if (!preview.equipmentBase.loadout.weapon && preview.weapon) worn.unshift('Vũ khí khởi đầu · ' + preview.weapon.label);
    byId('campaign-fighter-name').textContent = character.name;
    byId('campaign-stage-name').textContent = stage.name;
    byId('campaign-rules').textContent = config.characters[stage.opponent].name + ' · ' + config.stages[stage.stage].name
      + ' · ' + difficultyLabels[stage.difficulty] + ' · Thắng ' + Math.ceil(stage.bestOf / 2)
      + ' hiệp · ' + stage.seconds + ' giây/hiệp. Hết giờ xét tỷ lệ máu. '
      + (stage.hazards ? 'Bật luật sân. ' + config.stages[stage.stage].description : 'Tắt cạm bẫy sân.')
      + ' Hộp mù tắt.';
    byId('campaign-loadout').textContent = worn.length ? worn.join(' • ') : 'Chưa mặc trang bị.';
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
      card.setAttribute('aria-pressed', String(selected === index));
      const title = document.createElement('strong');
      title.textContent = (index + 1) + ' · ' + stage.name;
      const detail = document.createElement('span');
      detail.textContent = config.characters[stage.opponent].name + ' · ' + config.stages[stage.stage].name + ' · ' + difficultyLabels[stage.difficulty];
      const status = document.createElement('span');
      status.textContent = !available ? 'Khóa · cần vượt ' + route[index - 1].name : record?.wins
        ? 'Đã vượt · Thắng ' + record.wins + ' / Thua ' + record.losses
        : record?.losses ? 'Đã mở · Thua ' + record.losses : 'Đã mở';
      const reward = document.createElement('small');
      reward.textContent = 'Lần đầu: ' + resourceText(stage.first) + ' · ' + catalog[stage.first.item].name
        + ' (đã có: +' + stage.first.duplicateGold + ' vàng). Chơi lại: ' + resourceText(stage.replay) + '.';
      card.append(title, detail, status, reward);
      card.addEventListener('click', () => {
        selected = index;
        render();
        cards.querySelector('[aria-pressed="true"]').focus();
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
    show('campaign');
  };
}
