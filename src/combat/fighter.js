import { overlapsSurface } from '../game/stages.js';

export const FRAME_SECONDS = 1 / 60;

export class Fighter {
  constructor(config, x, facing, rules) {
    Object.assign(this, config);
    this.maxHp = config.hp;
    this.baseHp = config.hp;
    this.dashOptions = { normal: config.dash, enhanced: config.enhancedDash };
    this.rules = rules;
    this.x = x;
    this.y = 0;
    this.facing = facing;
    this.vy = 0;
    this.airDirection = 0;
    this.superMotionFrames = 0;
    this.onGround = true;
    this.moving = false;
    this.walkDistance = 0;
    this.crouching = false;
    this.blocking = false;
    this.attack = null;
    this.nextPunchSide = 'left';
    this.nextKickSide = 'left';
    this.bufferedAttack = null;
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
    this.chargeFrames = 0;
    this.awakeningFrames = 0;
    this.awakeningLevel = 0;
    this.flightTarget = null;
    this.awakeningUnlocked = false;
    this.awakeningWindow = 0;
    this.lastConfirmedAttack = null;
    this.frostStacks = 0;
    this.frostWindow = 0;
    this.freezeFrames = 0;
    this.frostImmunity = 0;
    this.poisonStacks = 0;
    this.poisonFrames = 0;
    this.shieldHp = 0;
    this.powerFrames = 0;
    this.pickupWeapon = null;
    this.weaponUses = 0;
    this.dash = null;
    this.dashCooldown = 0;
    this.cooldowns = {};
    this.escapeCooldown = 0;
    this.escapeProtection = 0;
    this.escapeRecovery = 0;
  }

  get disabled() { return this.freezeFrames > 0 || this.hitstun > 0 || this.guardBreak > 0 || this.escapeRecovery > 0 || this.hp <= 0; }
  get invulnerable() { return this.escapeProtection > 0 || (this.dash && this.dash.elapsed <= this.dash.invulnerableFrames); }
  get attacking() { return this.attack !== null; }
  get canMoveDuringAttack() {
    const attack = this.attack;
    return !attack || (!attack.groundOnly && Boolean(attack.pickupWeapon || this.attacks[attack.id]));
  }
  get attackActive() {
    const attack = this.attack;
    return attack && attack.elapsed >= attack.startup && attack.elapsed < attack.startup + attack.active;
  }

  get charging() { return this.chargeFrames > 0; }
  get awakeningForm() { return this.awakeningLevel === 2 ? this.awakening.levelTwo : this.awakening; }
  get evolution() { return this.awakeningForm?.evolution; }
  get awakeningDuration() { return this.awakeningForm?.durationFrames ?? 480; }
  get evolving() { return this.awakeningFrames > 0 && Boolean(this.evolution); }
  get canFly() { return this.evolving && Boolean(this.evolution.flightHeight); }
  get nextAwakening() {
    if (!this.awakeningLevel) return this.awakening ? 1 : 0;
    return this.awakeningLevel === 1 && this.awakening.levelTwo ? 2 : 0;
  }
  get awakeningReady() {
    return Boolean(this.nextAwakening && this.awakeningUnlocked && this.meter >= this.rules.meterMax);
  }
  get canFocus() {
    return this.onGround && !this.disabled && !this.attackLock && !this.attacking
      && !this.dash && !this.blocking && Math.abs(this.knockVelocity) < 12;
  }

  charge(held) {
    if (!held || !this.canFocus) {
      this.chargeFrames = 0;
      return;
    }
    this.chargeFrames = Math.min(60, this.chargeFrames + 1);
    if (this.chargeStyle === 'pressure') {
      if (this.chargeFrames > 30) this.gainMeter(.62);
    } else if (this.chargeFrames > 18) this.gainMeter(.45);
  }

  awaken() {
    if (!this.awakeningReady || !this.canFocus) return false;
    this.meter = 0;
    this.chargeFrames = 0;
    this.awakeningLevel = this.nextAwakening;
    this.awakeningFrames = this.awakeningDuration;
    this.attackLock = .32;
    const bonusHp = this.baseHp + (this.evolution?.bonusHp ?? 0) - this.maxHp;
    if (bonusHp > 0) {
      this.maxHp += bonusHp;
      this.hp += bonusHp;
    }
    delete this.cooldowns[this.awakeningForm.skill];
    return true;
  }

  endAwakening() {
    this.stopFlight();
    this.awakeningFrames = 0;
    this.awakeningLevel = 0;
    this.maxHp = this.baseHp;
    this.hp = Math.min(this.hp, this.maxHp);
  }

  startFlight() {
    this.flightTarget = this.y - this.evolution.flightHeight;
    this.onGround = false;
  }

  stopFlight() {
    if (this.flightTarget === null) return;
    this.flightTarget = null;
    this.vy = Math.max(0, this.vy);
  }

  skillFor(id) {
    const skill = this.skills[id];
    if (!this.awakeningFrames || this.awakeningForm?.skill !== id) return skill;
    const { label, changes } = this.awakeningForm;
    return {
      ...skill, ...changes, label,
      ...(skill.projectile && { projectile: { ...skill.projectile, ...changes.projectile } }),
      effect: { color: this.evolution?.color ?? this.glow, particles: this.awakeningLevel === 2 ? 26 : 18, flashSeconds: .12, flashOpacity: .10,
        shakeSeconds: .14, shakeIntensity: 16, trailSeconds: .20 },
    };
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
    if ((definition.groundOnly && !this.onGround) || this.cooldowns[id] > 0 || this.meter < (definition.meterRequired ?? cost)) return false;
    const previous = this.attack;
    if (previous && (!previous.confirmed || !previous.cancelInto.includes(id)
      || target.hitstun <= definition.startup)) return false;

    if (!previous) this.combo = 0;
    this.attack = { id, ...definition, facing: this.facing, elapsed: 0, hit: false, confirmed: false,
      usesNativeWeapon: !this.weaponUses && !definition.pickupWeapon && !definition.unarmed };
    if (!definition.projectile && !definition.pickupWeapon) {
      if (id === 'light' || id === 'heavy') {
        this.attack.limbSide = this.nextPunchSide;
        this.nextPunchSide = this.nextPunchSide === 'left' ? 'right' : 'left';
      } else if (id === 'kick') {
        this.attack.limbSide = this.nextKickSide;
        this.nextKickSide = this.nextKickSide === 'left' ? 'right' : 'left';
      }
    }
    const equipment = this.equipmentStats;
    if (equipment) {
      this.attack.equipmentAttack = 1 + equipment.attack / 100;
      if (equipment.crit > 0 && Math.random() * 100 < equipment.crit) {
        this.attack.criticalMultiplier = 1.5 + equipment.critDamage / 100;
      }
    }
    if (this.powerFrames) this.attack.damage *= 1.22;
    if (this.evolving && this.evolution.damageMultiplier) this.attack.damage *= this.evolution.damageMultiplier;
    if (this.evolving && this.evolution.punchMultiplier && (id === 'light' || id === 'heavy')) {
      this.attack.evolvedPunch = true;
    }
    this.crouching = false;
    this.meter -= cost;
    if (definition.cooldownFrames) {
      this.cooldowns[id] = Math.ceil(definition.cooldownFrames * (1 - (equipment?.cooldown ?? 0) / 100));
    }
    return true;
  }

  gainMeter(amount) {
    const gain = amount * (1 + (this.equipmentStats?.energy ?? 0) / 100);
    this.meter = Math.min(this.rules.meterMax, Math.round((this.meter + gain) * 100) / 100);
  }

  startDash(enhanced, rollDirection = 0) {
    const dash = rollDirection
      ? { frames: 18, distance: 104, invulnerableFrames: 10, roll: true }
      : this.dashOptions[enhanced ? 'enhanced' : 'normal'];
    const cost = dash.cost ?? 0;
    if (this.disabled || this.attackLock > 0 || !this.onGround || this.attacking
      || this.blocking || this.dash || this.dashCooldown > 0 || this.meter < cost) return false;

    this.meter -= cost;
    this.dashCooldown = this.dashCooldownFrames;
    this.dash = { ...dash, facing: rollDirection || this.facing, elapsed: 0 };
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
    if (this.frostWindow > 0 && --this.frostWindow === 0) this.frostStacks = 0;
    this.freezeFrames = Math.max(0, this.freezeFrames - 1);
    this.frostImmunity = Math.max(0, this.frostImmunity - 1);
    if (this.poisonFrames > 0) {
      if (--this.poisonFrames === 0) this.poisonStacks = 0;
      else if (this.poisonFrames % 30 === 0 && this.hp > 1) this.hp = Math.max(1, Math.round((this.hp - 1) * 100) / 100);
    }
    if (this.awakeningFrames > 0 && --this.awakeningFrames === 0) this.endAwakening();
    this.powerFrames = Math.max(0, this.powerFrames - 1);
    this.awakeningWindow = Math.max(0, this.awakeningWindow - 1);
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
      this.guard = Math.min(this.rules.guardMax, this.guard + this.rules.guardRegen * (this.poisonFrames ? .45 : 1) * dt);
    }
    if (this.attack) {
      const attack = this.attack;
      attack.elapsed++;
      const activeFrame = attack.elapsed - attack.startup;
      if (attack.travel?.retreatFrames && activeFrame < 0 && -activeFrame <= attack.travel.retreatFrames) {
        this.x -= attack.facing * attack.travel.speed * .55 * dt;
      }
      if (attack.travel && activeFrame >= 0 && activeFrame < attack.travel.frames) {
        let distance = attack.travel.speed * dt;
        if (Math.abs(this.y - target.y) < Math.min(this.height, target.height)) {
          const spacing = attack.travel.passesThrough
            ? -attack.travel.crossDistance
            : (this.width + target.width) / 2 + 5;
          const available = (target.x - this.x) * attack.facing - spacing;
          distance = Math.min(distance, Math.max(0, available));
        }
        this.x += attack.facing * distance;
      }
      if (this.attack.elapsed >= this.attack.startup + this.attack.active + this.attack.recovery) this.attack = null;
    }
    this.updateVertical(dt, world);
    this.x += this.knockVelocity * dt;
    this.knockVelocity *= Math.pow(0.001, dt);
    this.clampX(world);
  }

  updateVertical(dt, world) {
    if (this.flightTarget !== null) {
      if (this.canFly && !this.disabled) {
        this.y = Math.max(this.flightTarget, this.y - 245 * dt);
        this.vy = 0;
        return;
      }
      this.stopFlight();
    }
    let floor = 0;
    for (const platform of world.platforms ?? []) {
      if (this.y <= platform.y && overlapsSurface(this.x, world.width, platform.range)) floor = Math.min(floor, platform.y);
    }
    this.vy += world.gravity * dt;
    this.y = Math.min(floor, this.y + this.vy * dt);
    this.onGround = this.y === floor;
    if (this.onGround) {
      this.vy = 0;
      this.airDirection = 0;
    }
  }

  clampX(world) {
    const margin = this.width / 2 + 15;
    this.x = Math.max(margin, Math.min(world.width - margin, this.x));
  }

  get hurtbox() {
    const { width, height: standingHeight } = this.hurtboxSize;
    const height = standingHeight * (this.crouching ? .66 : 1);
    return { x: this.x - width / 2, y: this.y - height, width, height };
  }

  get attackBoxes() {
    return this.attackBoxesFor(this.attack, this.attack.facing);
  }

  attackBoxesFor(attack, facing) {
    const limbs = attack.limbBoxes ?? [undefined];
    return limbs.map(limb => this.attackBoxFor(attack, facing, limb));
  }

  attackBoxFor(attack, facing = this.facing, segment = attack.limbBoxes?.[0]) {
    const limb = segment ?? { near: this.width * .18, far: this.width * .18 + attack.range,
      top: this.height - attack.yOffset, height: attack.height };
    // Basic strikes can connect when fighters are standing on top of each other.
    const near = !attack.pickupWeapon && ['light', 'heavy', 'kick'].includes(attack.id)
      ? Math.min(0, limb.near) : limb.near;
    return {
      x: this.x + (facing > 0 ? near : -limb.far),
      y: this.y - limb.top,
      width: limb.far - near,
      height: limb.height,
    };
  }
}
