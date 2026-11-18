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
    const previous = this.attack;
    if (previous && (!previous.confirmed || !previous.cancelInto.includes(id)
      || target.hitstun <= definition.startup)) return false;

    if (!previous) this.combo = 0;
    this.attack = { id, ...definition, facing: this.facing, elapsed: 0, hit: false, confirmed: false };
    this.crouching = false;
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

  startUltimate(heavy, target) {
    const ultimate = this.rules.ultimate;
    if (!this.onGround || this.attacking || this.meter < ultimate.cost) return false;
    if (!this.startAttack('ultimate', { ...heavy, ...ultimate }, target)) return false;

    this.meter -= ultimate.cost;
    return true;
  }

  endFrame() {
    if (this.dash && this.dash.elapsed >= this.dash.frames) this.dash = null;
    this.escapeProtection = Math.max(0, this.escapeProtection - 1);
    this.escapeRecovery = Math.max(0, this.escapeRecovery - 1);
    this.dashCooldown = Math.max(0, this.dashCooldown - 1);
    this.escapeCooldown = Math.max(0, this.escapeCooldown - 1);
  }

  update(dt, world) {
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
      this.attack.elapsed++;
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
      x: attack.facing > 0 ? edge : edge - attack.range,
      y: this.y - this.height + attack.yOffset,
      width: attack.range,
      height: attack.height,
    };
  }
}

export function findHit(attacker, defender) {
  const attack = attacker.attack;
  if (!attacker.attackActive || attack.hit || defender.invulnerable) return null;
  const box = attacker.attackBox;
  const hurt = defender.hurtbox;
  const left = Math.max(box.x, hurt.x);
  const right = Math.min(box.x + box.width, hurt.x + hurt.width);
  const top = Math.max(box.y, hurt.y);
  const bottom = Math.min(box.y + box.height, hurt.y + hurt.height);
  if (left >= right || top >= bottom) return null;
  return {
    attacker, defender, attack,
    blocked: defender.blocking && (attacker.x - defender.x) * defender.facing > 0,
    x: (left + right) / 2,
    y: (top + bottom) / 2,
  };
}

export function applyHit(contact) {
  const { attacker, defender, attack, blocked } = contact;
  const rules = attacker.rules;
  attack.hit = true;
  attack.confirmed = !blocked;
  const combo = blocked ? 0 : attacker.combo + 1;
  attacker.combo = combo;
  const scale = rules.comboScaling[Math.min(combo - 1, rules.comboScaling.length - 1)];
  // Apply chip separately from the damage that passes through guard.
  const multiplier = blocked ? 1 - rules.blockReduction + rules.chipRate : scale;
  const previousHP = defender.hp;
  defender.hp = Math.max(0, Math.round((previousHP - attack.damage * multiplier) * 100) / 100);
  defender.knockVelocity = attack.facing * attack.knockback * (blocked ? .16 : 1);
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
