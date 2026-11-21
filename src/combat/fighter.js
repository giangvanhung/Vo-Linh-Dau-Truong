import { groundHeightAt, stageFloorAt } from '../game/stages.js';
import { tickHeroForm } from '../game/hero-form.js';

export const FRAME_SECONDS = 1 / 60;
export const KNOCKDOWN_FRAMES = 38;

export class Fighter {
  constructor(config, x, facing, rules) {
    Object.assign(this, config);
    this.weapon = null;
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
    this.knockdown = 0;
    this.knockdownOnLanding = false;
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
    this.regenFrames = 0;
    this.heroEnergy = 0;
    this.heroFrames = 0;
    this.heroStage = 0;
    this.heroMechUsed = false;
    this.heroCounter = 0;
    this.heroGuardWindow = 0;
    this.stageCondition = null;
    this.pickupWeapon = null;
    this.weaponUses = 0;
    this.weaponFrames = 0;
    this.dash = null;
    this.dashCooldown = 0;
    this.cooldowns = {};
    this.escapeCooldown = 0;
    this.escapeProtection = 0;
    this.escapeRecovery = 0;
  }

  get disabled() { return this.knockdown > 0 || this.knockdownOnLanding || this.freezeFrames > 0
    || this.hitstun > 0 || this.guardBreak > 0 || this.escapeRecovery > 0 || this.hp <= 0 || this.stageCondition?.kind === 'stun'; }
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
  get activeHeroForm() {
    if (!this.heroFrames) return null;
    return this.heroStage === 1 ? this.heroForm : this.heroUpgrades?.[this.heroStage - 2];
  }
  get jumpMultiplier() { return (1 + (this.equipmentStats?.jump ?? 0) / 100) * (this.activeHeroForm?.jump ?? 1); }
  get walkingSpeed() {
    const kind = this.stageCondition?.kind;
    return this.moveSpeed * (kind === 'slow' ? .78 : kind === 'morph' ? .88 : 1)
      * (this.activeHeroForm?.speed ?? 1);
  }
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
    return this.onGround && !this.disabled && this.stageCondition?.kind !== 'morph' && !this.attackLock && !this.attacking
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
    if (this.heroUpgrades && this.activeHeroForm) {
      return this.activeHeroForm.skills?.[id === 'closeSkill' && this.heroCounter ? 'counter' : id] ?? skill;
    }
    if (this.heroFrames && id === 'rangedSkill') return {
      ...skill, label: 'Lôi Mạch', damage: skill.damage + 3, startup: Math.max(10, skill.startup - 3),
      projectile: { ...skill.projectile, shape: 'piercingRay', speed: skill.projectile.speed * 1.18, color: this.heroForm.color },
    };
    if (this.heroFrames && id === 'closeSkill') return {
      ...skill, label: 'Cầu Chì Bật', damage: skill.damage + 2, knockback: skill.knockback + 30,
      effect: { ...skill.effect, color: this.heroForm.color },
    };
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
    const wasBlocking = this.blocking;
    if (!held) this.guardReleaseRequired = false;
    this.blocking = held && !this.guardReleaseRequired && !this.disabled
      && !this.attacking && !this.dash && this.onGround && this.guard > 0;
    if (this.activeHeroForm?.skills?.counter) {
      if (!this.blocking) this.heroGuardWindow = 0;
      else if (!wasBlocking) this.heroGuardWindow = 9;
    }
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
    if (this.disabled || this.stageCondition?.kind === 'morph' || this.dash || this.attackLock > 0 || this.blocking) return false;
    const cost = definition.cost ?? 0;
    if ((definition.groundOnly && !this.onGround) || this.cooldowns[id] > 0 || this.meter < (definition.meterRequired ?? cost)) return false;
    const previous = this.attack;
    if (previous && (!previous.confirmed || !previous.cancelInto.includes(id)
      || target.hitstun <= definition.startup)) return false;

    if (!previous) this.combo = 0;
    this.attack = { id, ...definition, facing: this.facing, elapsed: 0, hit: false, confirmed: false,
      usesNativeWeapon: Boolean(this.weapon) && !this.weaponUses && !definition.pickupWeapon && !definition.unarmed };
    if (this.characterId === 'hung' && id === 'light' && !definition.pickupWeapon) {
      const punch = (previous?.punchChain ?? 0) + 1;
      this.attack.punchChain = punch;
      this.attack.cancelInto = definition.cancelInto.filter(move => move !== 'light');
      if (punch < 3) this.attack.cancelInto.unshift('light');
      else {
        this.attack.cancelInto = [];
        this.attack.recovery = Math.max(16, this.attack.recovery);
        this.attack.hitstun = Math.min(11, this.attack.hitstun);
      }
    }
    if (this.unarmedChain && !definition.mainWeapon && !definition.pickupWeapon && id === 'light') {
      const punch = (previous?.newPunch ?? 0) + 1;
      this.attack.newPunch = punch;
      this.attack.cancelInto = punch === 1 ? ['light', 'kick'] : ['kick'];
      if (punch === 2) {
        this.attack.damage += 1;
        this.attack.limbBoxes = definition.limbBoxes?.map(box => ({ ...box, far: box.far + 5 }));
      }
    }
    if (this.unarmedChain && id === 'kick') {
      const rear = this.nextKickSide === 'right';
      this.attack.damage += rear ? 2 : 0;
      this.attack.recovery += rear ? 3 : 0;
      this.attack.limbBoxes = definition.limbBoxes?.map(box => ({ ...box, far: box.far + (rear ? 8 : 0) }));
    }
    if (previous && this.onGround && target.onGround && !definition.projectile
      && !definition.travel && !definition.pickupWeapon) this.attack.followThrough = true;
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
    if (equipment) this.attack.equipmentAttack = 1 + equipment.attack / 100;
    const weaponCrit = definition.mainWeapon ? this.weapon?.critChance ?? 0 : definition.critChance ?? 0;
    this.attack.criticalChance = Math.min(60, weaponCrit + (equipment?.crit ?? 0));
    if (this.attack.criticalChance) {
      const strength = { blade: 1.50, spear: 1.55, hammer: 1.72, staff: 1.48, pan: 1.68, gauntlet: 1.43 };
      this.attack.criticalRoll = Math.random() * 100;
      this.attack.criticalPower = (strength[definition.mainWeapon] ?? 1.5) + (equipment?.critDamage ?? 0) / 100;
    }
    if (this.powerFrames) this.attack.damage *= 1.22;
    if (this.activeHeroForm) this.attack.damage *= this.activeHeroForm.damage;
    if (definition.heroCounter) this.heroCounter = 0;
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
    if (this.activeHeroForm?.mech) return false;
    const dash = rollDirection
      ? { frames: 18, distance: 104, invulnerableFrames: 10, roll: true }
      : this.dashOptions[enhanced ? 'enhanced' : 'normal'];
    const cost = dash.cost ?? 0;
    if (this.disabled || this.stageCondition?.kind === 'morph' || this.attackLock > 0 || !this.onGround || this.attacking
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
    this.knockdownOnLanding = false;
    attacker.combo = 0;
    if (attacker.attack) attacker.attack.confirmed = false;
    return true;
  }

  endFrame() {
    tickHeroForm(this);
    if (this.stageCondition) {
      const effect = this.stageCondition;
      if (--effect.remaining % 30 === 0 && effect.kind === 'poison' && this.hp > 1) {
        this.hp = Math.max(1, this.hp - 1);
      }
      if (!effect.remaining) this.stageCondition = null;
    }
    if (this.hp > 0 && ++this.regenFrames >= 60) {
      this.regenFrames = 0;
      const stats = this.equipmentStats;
      if (stats?.regenHp) this.hp = Math.min(this.maxHp, this.hp + stats.regenHp);
      if (stats?.regenMana) this.meter = Math.min(this.rules.meterMax, this.meter + stats.regenMana);
    }
    if (this.weaponFrames > 0 && --this.weaponFrames === 0) this.weaponUses = 0;
    this.knockdown = Math.max(0, this.knockdown - 1);
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
      if (attack.followThrough && activeFrame <= 0 && this.onGround && target.onGround
        && Math.abs(this.y - target.y) < 12) {
        const gap = (target.x - this.x) * attack.facing - (this.width + target.width) / 2;
        this.x += attack.facing * Math.max(0, Math.min(gap, 18 / Math.max(1, attack.startup)));
      }
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
    this.x += this.knockVelocity * dt;
    this.knockVelocity *= Math.pow(0.001, dt);
    this.clampX(world);
    this.updateVertical(dt, world);
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
    const floor = stageFloorAt(world, this.x, this.y);
    const walkingDownRamp = this.onGround && this.y < floor && floor - this.y <= 5
      && floor === groundHeightAt(world, this.x);
    this.vy += world.gravity * dt;
    this.y = walkingDownRamp ? floor : Math.min(floor, this.y + this.vy * dt);
    this.onGround = this.y === floor;
    if (this.onGround) {
      this.vy = 0;
      this.airDirection = 0;
      if (this.knockdownOnLanding && this.hp > 0) {
        this.knockdownOnLanding = false;
        this.knockdown = KNOCKDOWN_FRAMES;
        this.hitstun = 0;
      }
    }
  }

  clampX(world) {
    const margin = this.width / 2 + 15;
    this.x = Math.max(margin, Math.min(world.width - margin, this.x));
  }

  get hurtbox() {
    const { width: standingWidth, height: standingHeight } = this.hurtboxSize;
    const morph = this.stageCondition?.kind === 'morph';
    const mech = this.activeHeroForm?.mech && !morph;
    const width = standingWidth * (morph ? .86 : mech ? 1.5 : 1);
    const height = standingHeight * (morph ? .68 : (this.crouching ? .66 : 1) * (mech ? 1.32 : 1));
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
