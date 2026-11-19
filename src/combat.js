export const FRAME_SECONDS = 1 / 60;

export class Fighter {
  constructor(config, x, facing, rules) {
    Object.assign(this, config);
    this.rules = rules;
    this.x = x;
    this.y = 0;
    this.facing = facing;
    this.vy = 0;
    this.onGround = true;
    this.crouching = false;
    this.blocking = false;
    this.attack = null;
    this.hitstun = 0;
    this.knockVelocity = 0;
    this.flash = 0;
    this.attackLock = 0;
    this.guard = rules.guardMax;
    this.guardBreak = 0;
    this.guardReleaseRequired = false;
    this.guardRegenDelay = 0;
    this.combo = 0;
    this.meter = 0;
    this.dash = null;
    this.dashCooldown = 0;
    this.cooldowns = {};
    this.escapeCooldown = 0;
    this.escapeProtection = 0;
    this.escapeRecovery = 0;
  }

  get disabled() { return this.hitstun > 0 || this.guardBreak > 0 || this.escapeRecovery > 0 || this.hp <= 0; }
  get invulnerable() { return this.escapeProtection > 0 || (this.dash && this.dash.elapsed <= this.dash.invulnerableFrames); }
  get attacking() { return this.attack !== null; }
  get attackActive() {
    const attack = this.attack;
    return attack && attack.elapsed >= attack.startup && attack.elapsed < attack.startup + attack.active;
  }

  setGuard(held) {
    if (!held) this.guardReleaseRequired = false;
    this.blocking = held && !this.guardReleaseRequired && !this.disabled
      && !this.attacking && !this.dash && this.onGround && this.guard > 0;
  }

  spendGuard(amount) {
    this.guard = Math.max(0, this.guard - amount);
    this.guardRegenDelay = this.rules.guardRegenDelay;
    if (this.guard > 0) return false;
    this.guardBreak = this.rules.guardBreakFrames;
    this.guardReleaseRequired = true;
    this.blocking = false;
    return true;
  }

  startAttack(id, definition, target) {
    if (this.disabled || this.dash || this.attackLock > 0 || this.blocking) return false;
    const cost = definition.cost ?? 0;
    if ((definition.groundOnly && !this.onGround) || this.cooldowns[id] > 0 || this.meter < cost) return false;
    const previous = this.attack;
    if (previous && (!previous.confirmed || !previous.cancelInto.includes(id)
      || target.hitstun <= definition.startup)) return false;

    if (!previous) this.combo = 0;
    this.attack = { id, ...definition, facing: this.facing, elapsed: 0, hit: false, confirmed: false };
    this.crouching = false;
    this.meter -= cost;
    if (definition.cooldownFrames) this.cooldowns[id] = definition.cooldownFrames;
    return true;
  }

  gainMeter(amount) {
    this.meter = Math.min(this.rules.meterMax, Math.round((this.meter + amount) * 100) / 100);
  }

  startDash(enhanced) {
    const dash = enhanced ? this.rules.enhancedDash : this.rules.dash;
    const cost = dash.cost ?? 0;
    if (this.disabled || this.attackLock > 0 || !this.onGround || this.attacking
      || this.blocking || this.dash || this.dashCooldown > 0 || this.meter < cost) return false;

    this.meter -= cost;
    this.dashCooldown = this.rules.dashCooldownFrames;
    this.dash = { ...dash, facing: this.facing, elapsed: 0 };
    this.crouching = false;
    this.knockVelocity = 0;
    return true;
  }

  escapeFrom(attacker) {
    const escape = this.rules.escape;
    if (this.hp <= 0 || this.hitstun <= 0 || attacker.combo < escape.minCombo
      || this.escapeCooldown > 0 || this.meter < escape.cost) return false;

    this.meter -= escape.cost;
    this.escapeCooldown = escape.cooldownFrames;
    this.escapeProtection = escape.invulnerableFrames;
    this.escapeRecovery = escape.recoveryFrames;
    this.hitstun = 0;
    this.attack = null;
    this.flash = 0;
    this.knockVelocity = (Math.sign(this.x - attacker.x) || -this.facing) * escape.pushSpeed;
    attacker.combo = 0;
    if (attacker.attack) attacker.attack.confirmed = false;
    return true;
  }

  endFrame() {
    for (const id of Object.keys(this.cooldowns)) {
      if (--this.cooldowns[id] <= 0) delete this.cooldowns[id];
    }
    if (this.dash && this.dash.elapsed >= this.dash.frames) this.dash = null;
    this.escapeProtection = Math.max(0, this.escapeProtection - 1);
    this.escapeRecovery = Math.max(0, this.escapeRecovery - 1);
    this.dashCooldown = Math.max(0, this.dashCooldown - 1);
    this.escapeCooldown = Math.max(0, this.escapeCooldown - 1);
  }

  update(dt, world, target) {
    if (this.dash) {
      this.x += this.dash.facing * this.dash.distance / this.dash.frames;
      this.dash.elapsed++;
    }
    this.flash = Math.max(0, this.flash - dt);
    this.attackLock = Math.max(0, this.attackLock - dt);
    this.hitstun = Math.max(0, this.hitstun - 1);
    this.guardBreak = Math.max(0, this.guardBreak - 1);
    this.guardRegenDelay = Math.max(0, this.guardRegenDelay - dt);
    if (this.blocking) {
      this.spendGuard(this.rules.guardDrain * dt);
    } else if (this.guardBreak === 0 && this.guardRegenDelay === 0) {
      this.guard = Math.min(this.rules.guardMax, this.guard + this.rules.guardRegen * dt);
    }
    if (this.attack) {
      const attack = this.attack;
      attack.elapsed++;
      const activeFrame = attack.elapsed - attack.startup;
      if (attack.travel && activeFrame >= 0 && activeFrame < attack.travel.frames) {
        this.x += attack.facing * attack.travel.speed * dt;
        if (Math.abs(this.y - target.y) < Math.min(this.height, target.height)) {
          const spacing = attack.travel.passesThrough
            ? -attack.travel.crossDistance
            : (this.width + target.width) / 2 + 5;
          const limit = target.x - attack.facing * spacing;
          this.x = attack.facing > 0 ? Math.min(this.x, limit) : Math.max(this.x, limit);
        }
      }
      if (this.attack.elapsed >= this.attack.startup + this.attack.active + this.attack.recovery) this.attack = null;
    }
    this.vy += world.gravity * dt;
    this.y = Math.min(0, this.y + this.vy * dt);
    this.onGround = this.y === 0;
    if (this.onGround) this.vy = 0;
    this.x += this.knockVelocity * dt;
    this.knockVelocity *= Math.pow(0.001, dt);
    this.clampX(world);
  }

  clampX(world) {
    const margin = this.width / 2 + 15;
    this.x = Math.max(margin, Math.min(world.width - margin, this.x));
  }

  get hurtbox() {
    const height = this.height * (this.crouching ? .66 : 1);
    return { x: this.x - this.width / 2, y: this.y - height, width: this.width, height };
  }

  get attackBox() {
    const attack = this.attack;
    const edge = this.x + attack.facing * this.width * .18;
    return {
      x: attack.radial ? this.x - attack.range : attack.facing > 0 ? edge : edge - attack.range,
      y: this.y - this.height + attack.yOffset,
      width: attack.range * (attack.radial ? 2 : 1),
      height: attack.height,
    };
  }
}

export function findHit(attacker, defender) {
  const attack = attacker.attack;
  if (!attacker.attackActive || attack.projectile) return null;
  let hit = attack;
  if (attack.pulses) {
    const frame = attack.elapsed - attack.startup;
    const pulse = attack.pulses.findIndex(({ from, to }) => frame >= from && frame < to);
    if (pulse === -1 || pulse === attack.lastPulse) return null;
    hit = { ...attack, ...attack.pulses[pulse] };
    const contact = findContact(attacker, defender, hit, attacker.attackBox, attacker.x);
    return contact && { ...contact, onContact: () => { attack.lastPulse = pulse; } };
  }
  return attack.hit ? null : findContact(attacker, defender, hit, attacker.attackBox, attacker.x);
}

function findContact(attacker, defender, attack, box, sourceX, direction) {
  if (defender.invulnerable || defender.hp <= 0) return null;
  const hurt = defender.hurtbox;
  const left = Math.max(box.x, hurt.x);
  const right = Math.min(box.x + box.width, hurt.x + hurt.width);
  const top = Math.max(box.y, hurt.y);
  const bottom = Math.min(box.y + box.height, hurt.y + hurt.height);
  if (left >= right || top >= bottom) return null;
  return {
    attacker, defender, attack,
    blocked: defender.blocking && (direction ?? (Math.sign(sourceX - defender.x) || -attack.facing)) * defender.facing > 0,
    direction: direction ? -direction : attack.radial ? Math.sign(defender.x - sourceX) || attack.facing : attack.facing,
    x: (left + right) / 2,
    y: (top + bottom) / 2,
  };
}

export function applyHit(contact) {
  const { attacker, defender, attack, blocked } = contact;
  const rules = attacker.rules;
  contact.onContact?.();
  attack.hit = true;
  attack.confirmed = !blocked;
  const combo = blocked ? 0 : contact.projectile ? 1 : attacker.combo + 1;
  if (!contact.projectile || !attacker.attacking) attacker.combo = combo;
  const scale = rules.comboScaling[Math.min(combo - 1, rules.comboScaling.length - 1)];
  // Apply chip separately from the damage that passes through guard.
  const multiplier = blocked ? 1 - rules.blockReduction + rules.chipRate : scale;
  const previousHP = defender.hp;
  defender.hp = Math.max(0, Math.round((previousHP - attack.damage * multiplier) * 100) / 100);
  defender.knockVelocity = contact.direction * attack.knockback * (blocked ? .16 : 1);
  const damage = Math.round((previousHP - defender.hp) * 100) / 100;
  attacker.gainMeter(damage * rules.meterOnDeal);
  defender.gainMeter(blocked ? rules.meterOnBlock : damage * rules.meterOnReceive);
  const broken = blocked && defender.spendGuard(attack.guardDamage);
  if (blocked) {
    defender.attackLock = .14;
  } else {
    defender.attack = null;
    defender.dash = null;
    defender.hitstun = attack.hitstun;
    defender.crouching = false;
    defender.flash = .13;
  }

  return {
    ...contact, combo, broken,
    damage,
    hitstop: blocked ? 0 : attack.hitstop,
  };
}

export function updateProjectiles(projectiles, fighters, dt, world) {
  const contacts = [];
  for (const attacker of fighters) {
    const attack = attacker.attack;
    if (!attack?.projectile || attack.elapsed !== attack.startup) continue;
    const { width, yOffset, lifetimeFrames } = attack.projectile;
    projectiles.push({
      attacker, attack, x: attacker.x + attack.facing * (attacker.width + width) / 2,
      y: attacker.y - yOffset, frames: lifetimeFrames, hit: false,
    });
  }
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const shot = projectiles[i];
    const { attacker, attack } = shot;
    const { speed, width, height, pierce } = attack.projectile;
    const oldX = shot.x;
    shot.x += attack.facing * speed * dt;
    shot.frames--;
    if (!shot.hit) {
      const defender = fighters.find(fighter => fighter !== attacker);
      const hit = findContact(attacker, defender, attack, {
        x: Math.min(oldX, shot.x) - width / 2, y: shot.y - height / 2,
        width: width + Math.abs(shot.x - oldX), height,
      }, oldX, -attack.facing);
      if (hit) {
        contacts.push({ ...hit, projectile: true });
        shot.hit = true;
        if (hit.blocked || !pierce) shot.frames = 0;
      }
    }
    if (shot.frames <= 0 || shot.x < -width || shot.x > world.width + width) projectiles.splice(i, 1);
  }
  return contacts;
}
