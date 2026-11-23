import { Fighter, FRAME_SECONDS } from '../combat/fighter.js';
import { modelForWeapon, skins } from '../game/equipment.js';
import { equippedAttack, gear } from '../game/pickups.js';
import { createCombatEffects } from './combat-effects.js';
import { mainWeaponAttack } from '../game/weapon-attacks.js';
import { drawHeldWeapon } from './held-weapon.js';
import { createSpriteRenderer, loadImage } from './sprites.js';

export function createWeaponPreview(canvas, panel, characters, rules, state) {
  const ctx = canvas.getContext('2d');
  const renderers = new Map();
  const images = new Map();
  const { drawProjectile } = createCombatEffects(ctx, images);
  let current;
  let request = 0;
  let animationStart = null;
  let nextStrike = 0;
  let chain = 0;
  const target = { hitstun: 120, onGround: true };

  function startStrike(fighter, id) {
    delete fighter.cooldowns[id];
    fighter.meter = rules.meterMax;
    return fighter.startAttack(id, equippedAttack(fighter, id) ?? mainWeaponAttack(fighter, id) ?? fighter.attacks[id] ?? fighter.skillFor(id), target);
  }

  function draw(time) {
    request = 0;
    if (panel.hidden || !current) return;
    const { fighter, render } = current;
    if (fighter.attack) {
      animationStart ??= time;
      const { startup, active, recovery } = fighter.attack;
      fighter.attack.elapsed = Math.floor((time - animationStart) / (1000 * FRAME_SECONDS));
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
    ctx.translate(canvas.width * .32, canvas.height - 17);
    ctx.scale(.86, .86);
    render(fighter, 0, time);
    const attack = fighter.attack;
    if (attack?.projectile && attack.elapsed >= attack.startup) {
      const age = attack.elapsed - attack.startup;
      const { speed, width, height, yOffset, gravity, launchY = 0,
        spawnOffset = fighter.width / 2, lifetimeFrames } = attack.projectile;
      const flightTime = age * FRAME_SECONDS;
      const y = -yOffset + launchY * flightTime + (gravity ?? 0) * flightTime * (flightTime + FRAME_SECONDS) / 2;
      if (age < lifetimeFrames && (!gravity || y + height / 2 < 0)) {
        drawProjectile({ x: spawnOffset + width / 2 + flightTime * speed, y, age,
          facing: 1, attack, attacker: fighter }, 0);
      }
    }
    ctx.restore();
    request = requestAnimationFrame(draw);
  }

  return {
    show(id, itemId, skin, pickup) {
      if (current?.id !== id || current?.itemId !== itemId || current?.pickup !== pickup) {
        const fighter = new Fighter(characters[id], 0, 1, rules);
        fighter.characterId = id;
        fighter.nativeWeaponArt = null;
        fighter.weapon = modelForWeapon(id, itemId, state.inventory[itemId], state);
        if (pickup) {
          fighter.pickupWeapon = pickup;
          fighter.weaponUses = 1;
        }
        const path = pickup ? gear[pickup].image : fighter.weapon?.image;
        if (path && !images.has(path)) {
          images.set(path, null);
          loadImage(path).then(image => images.set(path, image)).catch(() => {});
        }
        if (!renderers.has(id)) {
          renderers.set(id, createSpriteRenderer(ctx, { [id]: characters[id] },
            (subject, hand, redraw) => drawHeldWeapon(ctx, images, subject, hand, redraw)));
        }
        current = { id, itemId, pickup, fighter, render: renderers.get(id) };
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
        : type === 'spear' ? ['light', 'heavy', 'closeSkill']
          : type ? ['light', 'heavy'] : ['light', 'heavy', 'kick'];
      const hungCombo = fighter.characterId === 'hung' && !fighter.weapon && !fighter.weaponUses;
      const actions = fighter.weaponUses ? ['light', 'heavy'] : strikes;
      const id = hungCombo ? 'light' : actions[nextStrike++ % actions.length];
      fighter.attack = null;
      chain = hungCombo ? 2 : 0;
      animationStart = null;
      if (startStrike(fighter, id)) return fighter.attack.label;
    },
  };
}
