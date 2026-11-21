import { Fighter } from '../combat/fighter.js';
import { modelForWeapon, skins } from '../game/equipment.js';
import { mainWeaponAttack } from '../game/weapon-attacks.js';
import { drawHeldWeapon } from './held-weapon.js';
import { createSpriteRenderer, loadImage } from './sprites.js';

export function createWeaponPreview(canvas, panel, characters, rules, state) {
  const ctx = canvas.getContext('2d');
  const renderers = new Map();
  const images = new Map();
  let current;
  let request = 0;
  let animationStart = null;
  let nextStrike = 0;
  let chain = 0;
  const target = { hitstun: 120, onGround: true };

  function startStrike(fighter, id) {
    delete fighter.cooldowns[id];
    return fighter.startAttack(id, mainWeaponAttack(fighter, id) ?? fighter.attacks[id] ?? fighter.skillFor(id), target);
  }

  function draw(time) {
    request = 0;
    if (panel.hidden || !current) return;
    const { fighter, render } = current;
    if (fighter.attack) {
      animationStart ??= time;
      const { startup, active, recovery } = fighter.attack;
      fighter.attack.elapsed = Math.floor((time - animationStart) * .055);
      if (chain && fighter.attack.elapsed >= startup + active + 1) {
        fighter.attack.confirmed = true;
        chain--;
        if (startStrike(fighter, 'light')) animationStart = time;
        else chain = 0;
      }
      if (fighter.attack.elapsed >= startup + active + recovery) fighter.attack = null;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2 - 19, canvas.height - 17);
    ctx.scale(.86, .86);
    render(fighter, 0, time);
    ctx.restore();
    request = requestAnimationFrame(draw);
  }

  return {
    show(id, itemId, skin) {
      if (current?.id !== id || current?.itemId !== itemId) {
        const fighter = new Fighter(characters[id], 0, 1, rules);
        fighter.characterId = id;
        fighter.weapon = modelForWeapon(id, itemId, state.inventory[itemId], state);
        const path = fighter.weapon?.image;
        if (path && !images.has(path)) {
          images.set(path, null);
          loadImage(path).then(image => images.set(path, image)).catch(() => {});
        }
        if (!renderers.has(id)) {
          renderers.set(id, createSpriteRenderer(ctx, { [id]: characters[id] },
            (subject, hand, redraw) => drawHeldWeapon(ctx, images, subject, hand, redraw)));
        }
        current = { id, itemId, fighter, render: renderers.get(id) };
        nextStrike = 0;
        chain = 0;
      }
      current.fighter.skinFilter = skins[skin]?.filter;
      if (!request) request = requestAnimationFrame(draw);
    },
    strike() {
      if (!current) return;
      const { fighter } = current;
      const type = fighter.weapon?.weaponType;
      const strikes = type === 'staff' ? ['light', 'heavy', 'rangedSkill']
        : type === 'spear' ? ['light', 'heavy', 'closeSkill'] : ['light', 'heavy', 'kick'];
      const id = fighter.characterId === 'hung' ? 'light' : strikes[nextStrike++ % strikes.length];
      fighter.attack = null;
      chain = fighter.characterId === 'hung' ? 2 : 0;
      startStrike(fighter, id);
      animationStart = null;
    },
  };
}
