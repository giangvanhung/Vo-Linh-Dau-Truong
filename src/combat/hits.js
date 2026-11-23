import { KNOCKDOWN_FRAMES } from './fighter.js';
import { gainHeroEnergy } from '../game/hero-form.js';
import { hungFollowFrames } from '../game/hung-air-combo.js';

export function findHit(attacker, defender) {
  const attack = attacker.attack;
  if (!attacker.attackActive || attack.projectile) return null;
  if (defender.onGround && (attack.hungKick === 'airJ' || attack.hungKick === 'slam')) return null;
  let hit = attack;
  const contactFor = () => {
    for (const box of attacker.attackBoxes) {
      const contact = findContact(attacker, defender, hit, box, attacker.x);
      if (contact) return contact;
    }
    return null;
  };
  if (attack.pulses) {
    const pulse = attack.pulses.indexOf(attacker.activePulse);
    if (pulse === -1 || pulse === attack.lastPulse) return null;
    hit = { ...attack, ...attack.pulses[pulse] };
    const contact = contactFor();
    return contact && { ...contact, onContact: () => { attack.lastPulse = pulse; } };
  }
  return attack.hit ? null : contactFor();
}

export function findContact(attacker, defender, attack, box, sourceX, direction) {
  if (defender.hp <= 0 || defender.knockdown > 0) return null;
  const hurt = defender.hurtbox;
  const left = Math.max(box.x, hurt.x);
  const right = Math.min(box.x + box.width, hurt.x + hurt.width);
  const top = Math.max(box.y, hurt.y);
  const bottom = Math.min(box.y + box.height, hurt.y + hurt.height);
  if (left >= right || top >= bottom) return null;
  if (defender.invulnerable) {
    if (defender.dash?.roll && defender.heroDodge !== attack) {
      defender.heroDodge = attack;
      gainHeroEnergy(defender, 11);
    }
    if (defender.characterId === 'mai' && defender.dash?.roll) defender.awakeningWindow = 150;
    return null;
  }
  return {
    attacker, defender, attack,
    blocked: defender.blocking && (!defender.lowGuardOnly || attack.level === 'low')
      && (direction ?? (Math.sign(sourceX - defender.x) || -attack.facing)) * defender.facing > 0,
    direction: direction ? -direction : attack.radial ? Math.sign(defender.x - sourceX) || attack.facing : attack.facing,
    x: (left + right) / 2,
    y: (top + bottom) / 2,
  };
}

export function applyHit(contact) {
  const { attacker, defender, attack, blocked } = contact;
  const rules = attacker.rules;
  const basicKick = attack.id === 'kick' && !attack.hungKick && !attack.pickupWeapon && !contact.projectile;
  contact.onContact?.();
  attack.hit = true;
  attack.confirmed = !blocked;
  const continuingKick = !basicKick || defender.hitstun > 0 || defender.knockdownOnLanding;
  const combo = blocked ? 0 : contact.projectile || !continuingKick ? 1 : attacker.combo + 1;
  if (!contact.projectile || !attacker.attacking) attacker.combo = combo;
  const scale = rules.comboScaling[Math.min(combo - 1, rules.comboScaling.length - 1)];
  // Apply chip separately from the damage that passes through guard.
  const evolution = (attack.evolvedPunch || attack.evolvedKick) && !contact.projectile ? attacker.evolution : null;
  const multiplier = blocked ? 1 - rules.blockReduction + rules.chipRate : scale * (evolution?.punchMultiplier ?? 1);
  const previousHP = defender.hp;
  const attackBonus = attack.equipmentAttack ?? 1;
  const critical = blocked ? 1 : attack.criticalRoll < attack.criticalChance - (defender.equipmentStats?.resistCrit ?? 0)
    ? attack.criticalPower : attack.criticalMultiplier ?? 1;
  const defense = (1 - (defender.equipmentStats?.defense ?? 0) / 100) * (defender.armor ?? 1)
    * (defender.activeHeroForm?.defense ?? 1);
  const weakened = attacker.stageCondition?.kind === 'weaken' ? .82 : 1;
  const incoming = Math.round(attack.damage * multiplier * attackBonus * critical * defense * weakened * 100) / 100;
  const barrier = Math.min(defender.awakeningBarrier, incoming);
  defender.awakeningBarrier = Math.round((defender.awakeningBarrier - barrier) * 100) / 100;
  const shield = Math.min(defender.shieldHp, incoming - barrier);
  defender.shieldHp = Math.round((defender.shieldHp - shield) * 100) / 100;
  const absorbed = barrier + shield;
  defender.hp = Math.max(0, Math.round((previousHP - incoming + absorbed) * 100) / 100);
  if (defender.kickWallBounce !== 'legacy') defender.kickWallBounce = null;
  defender.knockVelocity = contact.direction * attack.knockback * (blocked ? .16 : 1);
  const damage = Math.round((previousHP - defender.hp) * 100) / 100;
  if (blocked) gainHeroEnergy(defender, 8);
  else if (damage > 0) gainHeroEnergy(attacker, Math.min(14, 6 + Math.round(damage / 3)) + (defender.hp <= 0 ? 16 : 0));
  const reflected = !blocked && !contact.projectile && damage > 0 && defender.stageCondition?.kind === 'reflect'
    ? Math.min(5, Math.round(damage * .20), Math.max(0, attacker.hp - 1)) : 0;
  if (reflected) {
    attacker.hp = Math.round((attacker.hp - reflected) * 100) / 100;
    defender.stageCondition = null;
  }
  let inflicted;
  if (!blocked) {
    if (evolution?.lifeSteal && attacker.hp > 0) {
      attacker.hp = Math.min(attacker.maxHp, Math.round((attacker.hp + damage * evolution.lifeSteal) * 100) / 100);
    }
    if (defender.freezeFrames) {
      defender.freezeFrames = 0;
      inflicted = 'shatter';
    }
    if (attack.status === 'frost' && !defender.frostImmunity) {
      defender.frostWindow = 240;
      if (++defender.frostStacks >= 3) {
        defender.frostStacks = 0;
        defender.freezeFrames = 45;
        defender.frostImmunity = 140;
        defender.knockVelocity = 0;
        attacker.awakeningUnlocked = true;
        inflicted = 'freeze';
      }
    }
    if (attack.status === 'poison') {
      defender.poisonFrames = 210;
      if (++defender.poisonStacks >= 3) {
        defender.poisonStacks = 0;
        attacker.awakeningUnlocked = true;
        inflicted = 'poisonStun';
      }
    }
  }
  if (!attack.projectile?.meterPerFrame) attacker.gainMeter(damage * rules.meterOnDeal);
  if (!blocked && attack.weaponPerk === 'surge') attacker.gainMeter(4);
  defender.gainMeter(blocked ? rules.meterOnBlock : damage * rules.meterOnReceive);
  const broken = blocked && defender.spendGuard(attack.guardDamage);
  if (blocked && !broken && defender.heroGuardWindow > 0) {
    defender.heroGuardWindow = 0;
    defender.heroCounter = 60;
    delete defender.cooldowns.closeSkill;
  }
  if (blocked && !broken && defender.characterId === 'hung') defender.awakeningWindow = 150;
  if (broken && attacker.characterId === 'ngoc') attacker.awakeningUnlocked = true;
  if (blocked) {
    defender.attackLock = .14;
  } else {
    defender.stopFlight();
    defender.attack = null;
    defender.dash = null;
    defender.hungFollow = defender.hungAirChain = null;
    defender.chargeFrames = 0;
    const kickFinisher = basicKick && combo >= 3 && !inflicted && attacker.onGround && defender.onGround;
    const standingKick = kickFinisher && !attack.lowStance;
    if (kickFinisher) attack.cancelInto = [];
    const lift = standingKick ? Math.max(355, attack.launch ?? 0) : basicKick ? 0 : attack.launch;
    if (lift) {
      defender.vy = -lift;
      defender.onGround = false;
    }
    if (attack.hungKick === 'launch' && !inflicted && defender.hp > 0 && attacker.attack === attack && !attacker.disabled) {
      attacker.hungFollow = { target: defender, attack, frames: hungFollowFrames };
    }
    if (attack.hungKick === 'airJ' && attacker.hungAirChain?.target === defender) {
      attacker.hungAirChain.punched = true;
      // A single lift gives the finisher room before the next landing.
      defender.vy = Math.min(defender.vy, -135);
    }
    if (attack.hungKick === 'slam' && !defender.onGround && defender.hp > 0) {
      defender.vy = 850;
      defender.knockdownOnLanding = true;
      defender.kickWallBounce = 'slam';
    }
    if (standingKick) {
      defender.knockVelocity = contact.direction * Math.max(660, attack.knockback);
      defender.kickWallBounce = 'legacy';
    }
    if (attack.hungKick === 'heavy' && defender.hp > 0 && !inflicted) defender.kickWallBounce = 'heavy';
    if ((standingKick || (!basicKick && attack.knockdownOnLanding)) && !defender.onGround) defender.knockdownOnLanding = true;
    if ((attacker.characterId === 'hung' && attacker.awakeningWindow && attack.id === 'heavy'
      && (!attack.hungKick || attack.hungKick === 'heavy'))
      || (attacker.characterId === 'mai' && attacker.awakeningWindow)
      || (attacker.characterId === 'linh' && combo >= 2 && attacker.lastConfirmedAttack === 'kick' && attack.id === 'closeSkill')
      || attacker.awakening?.unlockAttack === attack.id) {
      attacker.awakeningUnlocked = true;
    }
    if (attacker.characterId === 'vy' && attack.level === 'low' && !contact.projectile) {
      attacker.awakeningWindow = 150;
      attacker.awakeningSide = Math.sign(defender.x - attacker.x);
    }
    attacker.lastConfirmedAttack = attack.id;
    const normal = !contact.projectile && !attack.pickupWeapon && ['light', 'heavy', 'kick'].includes(attack.id);
    const grounded = attacker.onGround && defender.onGround && !lift;
    const finisher = normal && !attack.hungKick && combo >= 3 && attack.id === 'heavy' && !attack.cancelInto.length;
    const knockdown = grounded && defender.hp > 0 && !inflicted
      && (basicKick ? kickFinisher : finisher || attack.knocksDown);
    if (knockdown) {
      defender.knockdown = defender.knockdownFrames ?? KNOCKDOWN_FRAMES;
      defender.knockVelocity = contact.direction * Math.min(attack.knockback, 70);
      defender.hitstun = 0;
      defender.bufferedAttack = null;
    } else {
      if (normal && grounded && !inflicted && attack.hungKick !== 'heavy') defender.knockVelocity *= .36;
      defender.hitstun = inflicted === 'poisonStun' ? Math.max(42, attack.hitstun) : attack.hitstun;
    }
    defender.crouching = false;
    defender.flash = .13;
  }
  defender.checkAwakeningBreak();

  return {
    ...contact, combo, broken, inflicted,
    damage, reflected, critical: critical > 1,
    absorbed,
    hitstop: blocked ? 0 : attack.hitstop,
  };
}
