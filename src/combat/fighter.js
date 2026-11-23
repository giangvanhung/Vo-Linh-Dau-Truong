import { groundHeightAt, stageFloorAt } from '../game/stages.js';
import { endHeroForm, tickHeroForm } from '../game/hero-form.js';
import { updateHungAirCombo } from '../game/hung-air-combo.js';

export const FRAME_SECONDS = 1 / 60;
export const KNOCKDOWN_FRAMES = 38;
const specialSkills = new Set(['closeSkill', 'rangedSkill', 'ultimate', 'motionSuper']);
const hungGroundChainLimit = 3;

function isHungStandingNormal(id, definition) {
  return !definition.lowStance && !definition.pickupWeapon && !definition.projectile
    && (definition.hungKick === 'heavy' || definition.hungKick === 'launch' || (id === 'light' && !definition.hungKick));
}

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
    this.airStepWindow = 0;
    this.airStepUsed = false;
    this.runJump = null;
    this.jumpBuffer = null;
    this.moving = false;
    this.walkDistance = 0;
    this.crouching = false;
    this.blocking = false;
    this.attack = null;
    this.hungFollow = this.hungAirChain = null;
    this.nextPunchSide = 'left';
    this.nextKickSide = 'left';
    this.bufferedAttack = null;
    this.hitstun = 0;
    this.knockdown = 0;
    this.knockdownOnLanding = false;
    this.kickWallBounce = null;
    this.knockVelocity = 0;
    this.flash = 0;
    this.attackLock = 0;
    this.guard = rules.guardMax;
    this.guardBreak = 0;
    this.crouchGuardFatigue = false;
    this.guardReleaseRequired = false;
    this.guardRegenDelay = 0;
    this.combo = 0;
    this.meter = 0;
    this.chargeFrames = 0;
    this.formAge = 0;
    this.awakeningLevel = 0;
    this.awakeningBarrier = 0;
    this.flightTarget = null;
    this.flightStamina = 0;
    this.freeFlying = false;
    this.flightX = this.flightY = 0;
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
    this.wallEscapeCooldown = 0;
    this.escapeProtection = 0;
    this.escapeRecovery = 0;
  }

  get disabled() { return this.knockdown > 0 || this.knockdownOnLanding || this.freezeFrames > 0
    || this.hitstun > 0 || this.guardBreak > 0 || this.escapeRecovery > 0 || this.hp <= 0 || this.stageCondition?.kind === 'stun'; }
  get invulnerable() { return this.escapeProtection > 0 || (this.dash && this.dash.elapsed <= this.dash.invulnerableFrames); }
  get attacking() { return this.attack !== null; }
  get canMoveDuringAttack() {
    const attack = this.attack;
    if (attack?.hungKick === 'slam') return false;
    if (attack?.plantFoot && this.onGround && attack.elapsed >= attack.advanceFrames
      && attack.elapsed < attack.startup + attack.active + Math.ceil(attack.recovery * .56)) return false;
    return !attack || (!attack.groundOnly && Boolean(attack.pickupWeapon || this.attacks[attack.id]));
  }
  get attackActive() {
    const attack = this.attack;
    if (this.onGround && (attack?.hungKick === 'airJ' || attack?.hungKick === 'slam')) return false;
    return attack && attack.elapsed >= attack.startup && attack.elapsed < attack.startup + attack.active;
  }

  get charging() { return this.chargeFrames > 0; }
  get activeHeroForm() {
    if (!this.heroStage) return null;
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
  get evolving() { return this.awakeningLevel > 0 && Boolean(this.evolution); }
  get formLevel() { return this.awakeningLevel || this.heroStage; }
  get meterMax() { return this.rules.meterMax + this.formLevel * 25; }
  get barrierMax() {
    if (!this.formLevel) return 0;
    return this.awakeningForm?.barrierHp
      ?? (([0, 24, 36, 46][this.formLevel]) + (this.activeHeroForm?.hp ?? this.evolution?.bonusHp ?? 0));
  }
  get flight() { return this.evolving ? this.evolution.flight : null; }
  get canFly() { return this.evolving && (this.flight ? this.flightStamina >= 15 : Boolean(this.evolution.flightHeight)); }
  get nextAwakening() {
    if (!this.awakeningLevel) return this.awakening ? 1 : 0;
    return this.awakeningLevel === 1 && this.awakening.levelTwo ? 2 : 0;
  }
  get awakeningReady() {
    return Boolean(this.nextAwakening && this.awakeningUnlocked && this.meter >= this.meterMax);
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
    this.chargeFrames = 0;
    this.awakeningLevel = this.nextAwakening;
    this.refreshFormResources();
    this.flightStamina = this.flight?.stamina ?? 0;
    this.attackLock = .32;
    delete this.cooldowns[this.awakeningForm.skill];
    return true;
  }

  endAwakening() {
    this.stopFlight();
    this.airStepWindow = 0;
    this.awakeningLevel = 0;
    this.flightStamina = 0;
    this.clearFormResources();
  }

  refreshFormResources() {
    this.formAge = 0;
    this.awakeningBarrier = this.barrierMax;
    this.meter = 8;
  }

  clearFormResources() {
    this.formAge = 0;
    this.awakeningBarrier = 0;
    this.meter = Math.min(this.meter, this.meterMax);
  }

  checkAwakeningBreak() {
    if (!this.formLevel || (this.hp > 0 && !this.knockdown && this.awakeningBarrier > 0)) return;
    if (this.heroStage) endHeroForm(this);
    else this.endAwakening();
  }

  startFlight() {
    if (this.flight) {
      this.freeFlying = true;
      this.vy = 0;
      this.runJump = null;
    } else this.flightTarget = this.y - this.evolution.flightHeight;
    this.onGround = false;
  }

  tryAwakeningAirStep(target, jumpVelocity, direction) {
    const step = this.awakening?.airStep;
    if (!step || !this.evolving || this.hp <= 0 || this.stageCondition?.kind === 'morph'
      || this.dash || this.blocking || this.airStepUsed || this.cooldowns.airStep) return false;
    if (!this.airStepWindow) {
      this.airStepWindow = step.inputFrames;
      return false;
    }

    if (this.disabled) {
      target.combo = 0;
      if (target.attack) target.attack.confirmed = false;
    }
    this.airStepWindow = 0;
    this.airStepUsed = true;
    this.cooldowns.airStep = step.cooldownFrames;
    this.escapeProtection = Math.max(this.escapeProtection, step.invulnerableFrames);
    this.hitstun = this.knockdown = this.freezeFrames = this.guardBreak = this.escapeRecovery = this.attackLock = 0;
    this.knockdownOnLanding = false;
    this.kickWallBounce = null;
    if (this.stageCondition?.kind === 'stun') this.stageCondition = null;
    this.knockVelocity = 0;
    this.attack = this.bufferedAttack = null;
    this.crouching = false;
    this.superMotionFrames = 0;
    this.stopFlight();
    this.vy = -jumpVelocity * this.jumpMultiplier * step.jumpScale;
    this.airDirection = direction;
    this.runJump = null;
    this.jumpBuffer = null;
    this.onGround = false;
    return true;
  }

  stopFlight() {
    if (this.flightTarget === null && !this.freeFlying) return;
    this.flightTarget = null;
    this.freeFlying = false;
    this.flightX = this.flightY = 0;
    this.vy = Math.max(0, this.vy);
  }

  skillFor(id) {
    const skill = this.skills[id];
    if (this.heroUpgrades && this.activeHeroForm) {
      return this.activeHeroForm.skills?.[id === 'closeSkill' && this.heroCounter ? 'counter' : id] ?? skill;
    }
    if (this.heroStage && id === 'rangedSkill') return {
      ...skill, label: 'Lôi Mạch', damage: skill.damage + 3, startup: Math.max(10, skill.startup - 3),
      projectile: { ...skill.projectile, shape: 'piercingRay', speed: skill.projectile.speed * 1.18, color: this.heroForm.color },
    };
    if (this.heroStage && id === 'closeSkill') return {
      ...skill, label: 'Cầu Chì Bật', damage: skill.damage + 2, knockback: skill.knockback + 30,
      effect: { ...skill.effect, color: this.heroForm.color },
    };
    if (!this.evolving || this.awakeningForm?.skill !== id) return skill;
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

  spendGuard(amount, draining = false) {
    this.guard = Math.max(0, this.guard - amount);
    this.guardRegenDelay = this.rules.guardRegenDelay;
    if (this.guard > 0) return false;
    this.guardBreak = this.rules.guardBreakFrames;
    this.crouchGuardFatigue = draining && this.characterId === 'hung' && this.crouching;
    this.guardReleaseRequired = true;
    this.blocking = false;
    return true;
  }

  attackMeter(id, definition) {
    const surcharge = this.formLevel && specialSkills.has(id) ? 10 + this.formLevel * 5 : 0;
    const cost = definition.cost ?? 0;
    return { cost: cost + surcharge, required: (definition.meterRequired ?? cost) + surcharge };
  }

  startAttack(id, definition, target) {
    if (this.disabled || this.stageCondition?.kind === 'morph' || this.dash || this.attackLock > 0 || this.blocking) return false;
    const airComboMove = definition.hungKick === 'airJ' || definition.hungKick === 'slam';
    if (airComboMove && (!this.hungAirChain || this.onGround)) return false;
    const { cost, required } = this.attackMeter(id, definition);
    if ((definition.groundOnly && !this.onGround) || this.cooldowns[id] > 0 || this.meter < required) return false;
    const previous = this.attack;
    const hungGroundNormal = this.characterId === 'hung' && this.onGround && isHungStandingNormal(id, definition);
    const hungGroundLink = hungGroundNormal && previous?.hungGroundChain > 0;
    if (previous) {
      const normalLink = previous.advance && definition.advance && this.onGround &&
        previous.elapsed >= previous.startup + (previous.confirmed ? 2 : previous.active);
      const confirmedLink = (!previous.advance || !definition.advance) && previous.confirmed && target.hitstun > definition.startup;
      const airLink = definition.hungKick === 'slam' && previous.hungKick === 'airJ'
        && previous.confirmed && previous.elapsed >= previous.startup + 2;
      const kickLink = id === 'kick' && !definition.hungKick && !previous.hungKick && ['light', 'heavy', 'kick'].includes(previous.id)
        && !previous.pickupWeapon && !previous.projectile && !definition.pickupWeapon && !definition.projectile
        && previous.confirmed && this.combo < 3 && previous.elapsed >= previous.startup + 2
        && target.hitstun > definition.startup && this.onGround && target.onGround;
      let link = kickLink || (previous.cancelInto.includes(id) && (normalLink || confirmedLink));
      if (definition.hungKick === 'slam') link = airLink;
      if (hungGroundLink) {
        link = previous.hungGroundChain < hungGroundChainLimit && previous.confirmed
          && previous.elapsed >= previous.startup + 2 && target.hp > 0 && target.hitstun > definition.startup
          && (previous.hungKick !== 'launch' || definition.hungKick !== 'launch');
      }
      if (!link) return false;
    }

    if (!previous && !airComboMove) this.combo = 0;
    this.attack = { id, ...definition, facing: this.facing, elapsed: 0, hit: false, confirmed: false,
      usesNativeWeapon: Boolean(this.weapon) && !this.weaponUses && !definition.pickupWeapon && !definition.unarmed };
    this.attack.lightStrikeDrop = this.lightStrikeDrop(this.attack, target);
    if (hungGroundNormal) {
      this.attack.hungGroundChain = (previous?.hungGroundChain ?? 0) + 1;
      if (hungGroundLink) {
        this.attack.advance = (definition.advance ?? 0) + 24;
        this.attack.advanceFrames = definition.advanceFrames ?? definition.startup;
        if (!target.onGround && definition.limbBoxes) {
          this.attack.limbBoxes = definition.limbBoxes.map(box => ({ ...box, top: box.top + 34, height: box.height + 34 }));
        }
      }
      if (this.attack.hungGroundChain >= hungGroundChainLimit) {
        this.attack.cancelInto = [];
        if (id === 'light') this.attack.hitstun = Math.min(11, this.attack.hitstun);
      }
    } else if (definition.advance && !definition.hungKick) {
      this.attack.normalChain = (previous?.normalChain ?? 0) + 1;
      if (this.attack.normalChain >= 3) {
        this.attack.cancelInto = [];
        this.attack.recovery = Math.max(12, this.attack.recovery);
        this.attack.hitstun = Math.min(11, this.attack.hitstun);
      }
    }
    if (this.unarmedChain && !hungGroundNormal && !definition.hungKick && !definition.mainWeapon && !definition.pickupWeapon && id === 'light') {
      const punch = (previous?.newPunch ?? 0) + 1;
      this.attack.newPunch = punch;
      this.attack.cancelInto = punch === 1 ? ['light', 'kick'] : ['kick'];
      if (punch === 2) {
        this.attack.damage += 1;
        this.attack.limbBoxes = definition.limbBoxes?.map(box => ({ ...box, far: box.far + 5 }));
      }
    }
    if (this.unarmedChain && id === 'kick' && !definition.hungKick) {
      const rear = this.nextKickSide === 'right';
      this.attack.damage += rear ? 2 : 0;
      this.attack.recovery += rear ? 3 : 0;
      this.attack.limbBoxes = definition.limbBoxes?.map(box => ({ ...box, far: box.far + (rear ? 8 : 0) }));
    }
    if (previous && this.onGround && target.onGround && !definition.projectile
      && !definition.travel && !definition.pickupWeapon) this.attack.followThrough = true;
    if (!definition.projectile && !definition.pickupWeapon) {
      if (id === 'kick' || (definition.hungKick && id === 'heavy')) {
        this.attack.limbSide = this.nextKickSide;
        this.nextKickSide = this.nextKickSide === 'left' ? 'right' : 'left';
      } else if (id === 'light' || id === 'heavy') {
        this.attack.limbSide = this.nextPunchSide;
        this.nextPunchSide = this.nextPunchSide === 'left' ? 'right' : 'left';
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
    if (definition.hungKick === 'airJ') this.hungAirChain.punchStarted = true;
    if (definition.hungKick === 'slam') {
      this.hungAirChain.finished = true;
      this.vy = Math.max(this.vy, 50);
    }
    if (this.evolving && this.evolution.damageMultiplier) this.attack.damage *= this.evolution.damageMultiplier;
    if (this.evolving && this.evolution.punchMultiplier && (id === 'light' || id === 'heavy')) {
      if (definition.hungKick && definition.hungKick !== 'airJ') this.attack.evolvedKick = true;
      else this.attack.evolvedPunch = true;
    }
    this.crouching = Boolean(definition.lowStance);
    this.meter -= cost;
    if (definition.cooldownFrames) {
      this.cooldowns[id] = Math.ceil(definition.cooldownFrames * (1 - (equipment?.cooldown ?? 0) / 100));
    }
    return true;
  }

  gainMeter(amount) {
    const gain = amount * (1 + (this.equipmentStats?.energy ?? 0) / 100);
    this.meter = Math.min(this.meterMax, Math.round((this.meter + gain) * 100) / 100);
  }

  startDash(enhanced, rollDirection = 0, direction = this.facing) {
    if (this.activeHeroForm?.mech || this.freeFlying) return false;
    const dash = rollDirection
      ? { frames: 18, distance: 104, invulnerableFrames: 10, roll: true }
      : this.dashOptions[enhanced ? 'enhanced' : 'normal'];
    const cost = dash.cost ?? 0;
    if (this.disabled || this.stageCondition?.kind === 'morph' || this.attackLock > 0 || !this.onGround || this.attacking
      || this.blocking || this.dash || this.dashCooldown > 0 || this.meter < cost) return false;

    this.meter -= cost;
    this.dashCooldown = this.dashCooldownFrames;
    this.dash = { ...dash, facing: rollDirection || direction, elapsed: 0 };
    if (!rollDirection) this.facing = direction;
    this.crouching = false;
    this.knockVelocity = 0;
    return true;
  }

  wallEscapeDirection(attacker, width) {
    if (this.hp <= 0 || this.knockdown || this.wallEscapeCooldown
      || !(this.hitstun || this.guardBreak || this.knockdownOnLanding)) return 0;
    const wallRange = this.width / 2 + 28;
    const inward = this.x <= wallRange ? 1 : this.x >= width - wallRange ? -1 : 0;
    const gap = (attacker.x - this.x) * inward;
    return gap >= 0 && gap <= 108 ? inward : 0;
  }

  escapeFrom(attacker, width) {
    const escape = this.rules.escape;
    const wall = this.wallEscapeDirection(attacker, width);
    if (!wall && (this.hp <= 0 || this.hitstun <= 0 || attacker.combo < escape.minCombo
      || this.escapeCooldown > 0 || this.meter < escape.cost)) return false;

    if (wall) {
      this.wallEscapeCooldown = 360;
      this.stopFlight();
      this.vy = -490;
      this.onGround = false;
      this.guardBreak = 0;
    } else {
      this.meter -= escape.cost;
      this.escapeCooldown = escape.cooldownFrames;
    }
    this.escapeProtection = wall ? 23 : escape.invulnerableFrames;
    this.escapeRecovery = escape.recoveryFrames;
    this.hitstun = 0;
    this.attack = null;
    this.flash = 0;
    this.knockVelocity = wall ? wall * 1060 : (Math.sign(this.x - attacker.x) || -this.facing) * escape.pushSpeed;
    this.knockdownOnLanding = false;
    this.kickWallBounce = null;
    this.hungFollow = this.hungAirChain = null;
    attacker.combo = 0;
    if (attacker.hungFollow?.target === this) attacker.hungFollow = null;
    if (attacker.hungAirChain?.target === this) attacker.hungAirChain = null;
    if (attacker.attack) attacker.attack.confirmed = false;
    return wall ? 'wall' : 'combo';
  }

  endFrame() {
    tickHeroForm(this);
    this.airStepWindow = Math.max(0, this.airStepWindow - 1);
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
      if (stats?.regenMana) this.meter = Math.min(this.meterMax, this.meter + stats.regenMana);
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
    if (this.formLevel) this.formAge++;
    const flight = this.flight;
    if (flight && this.onGround) {
      this.flightStamina = Math.min(flight.stamina, this.flightStamina + flight.regen * FRAME_SECONDS);
    }
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
    this.wallEscapeCooldown = Math.max(0, this.wallEscapeCooldown - 1);
  }

  update(dt, world, target) {
    updateHungAirCombo(this, target, dt);
    if (this.dash) {
      this.x += this.dash.facing * this.dash.distance / this.dash.frames;
      this.dash.elapsed++;
    }
    this.flash = Math.max(0, this.flash - dt);
    this.attackLock = Math.max(0, this.attackLock - dt);
    this.hitstun = Math.max(0, this.hitstun - 1);
    if (this.kickWallBounce !== 'legacy' && (!this.hitstun || this.hp <= 0)) this.kickWallBounce = null;
    this.guardBreak = Math.max(0, this.guardBreak - 1);
    this.guardRegenDelay = Math.max(0, this.guardRegenDelay - dt);
    if (this.blocking) {
      this.spendGuard(this.rules.guardDrain * dt, true);
    } else if (this.guardBreak === 0 && this.guardRegenDelay === 0) {
      this.guard = Math.min(this.rules.guardMax, this.guard + this.rules.guardRegen * (this.poisonFrames ? .45 : 1) * dt);
    }
    if (this.attack) {
      const attack = this.attack;
      attack.elapsed++;
      const activeFrame = attack.elapsed - attack.startup;
      if (attack.hungKick === 'slam' && activeFrame === 0) this.vy = Math.max(this.vy, 270);
      const advanceFrames = attack.advanceFrames ?? attack.startup + attack.active - 1;
      if (attack.advance && this.onGround && attack.elapsed <= advanceFrames) {
        this.advanceTowardOpponent(target, attack.facing, attack.advance / advanceFrames);
      } else if (!attack.advance && attack.followThrough && activeFrame <= 0 && this.onGround && target.onGround
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
    if (this.freeFlying && (this.disabled || this.stageCondition?.kind === 'morph')) this.stopFlight();
    if (this.freeFlying) {
      const flight = this.flight;
      const speed = flight.speed / Math.max(1, Math.hypot(this.flightX, this.flightY));
      this.x += this.flightX * speed * dt;
      this.clampX(world);
      const floor = stageFloorAt(world, this.x, this.y);
      const ceiling = Math.min(floor, this.height + 8 - world.height * world.groundRatio);
      this.y = Math.max(ceiling, Math.min(floor, this.y + this.flightY * speed * dt));
      this.flightStamina = Math.max(0, this.flightStamina - flight.drain * dt);
      if ((this.flightY > 0 && this.y >= floor) || this.flightStamina === 0) this.stopFlight();
    }
    this.x += this.knockVelocity * dt;
    this.knockVelocity *= Math.pow(0.001, dt);
    const unclampedX = this.x;
    this.clampX(world);
    const wallRebound = this.kickWallBounce && unclampedX !== this.x;
    if (wallRebound) {
      const inward = unclampedX > this.x ? -1 : 1;
      this.knockVelocity = inward * Math.max(480, Math.abs(this.knockVelocity) * .72);
      if (this.kickWallBounce !== 'slam') this.vy = Math.min(this.vy, -170);
      this.kickWallBounce = null;
    }
    this.updateVertical(dt, world);
    this.checkAwakeningBreak();
    return wallRebound;
  }

  updateVertical(dt, world) {
    if (this.freeFlying) return;
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
      this.hungAirChain = null;
      if (this.runJump) this.walkDistance = this.runJump.stride;
      this.runJump = null;
      this.airStepUsed = false;
      this.vy = 0;
      this.airDirection = 0;
      if (this.knockdownOnLanding) {
        this.knockdownOnLanding = false;
        this.kickWallBounce = null;
        if (this.hp > 0) this.knockdown = this.knockdownFrames ?? KNOCKDOWN_FRAMES;
        this.hitstun = 0;
      }
    } else if (this.runJump) this.runJump.frames++;
  }

  clampX(world) {
    const margin = this.width / 2;
    this.x = Math.max(margin, Math.min(world.width - margin, this.x));
  }

  advanceTowardOpponent(target, direction, step) {
    const gap = (target.x - this.x) * direction - (this.width + target.width) / 2;
    const distance = Math.abs(this.y - target.y) < this.height ? Math.min(step, Math.max(0, gap)) : step;
    this.x += direction * distance;
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
    const attack = this.attack;
    const pulse = this.activePulse;
    return this.attackBoxesFor(pulse?.limbBoxes ? { ...attack, limbBoxes: pulse.limbBoxes } : attack, attack.facing);
  }

  get activePulse() {
    const attack = this.attack;
    if (!attack?.pulses) return null;
    const age = attack.elapsed - attack.startup;
    return attack.pulses.find(({ from, to }) => age >= from && age < to);
  }

  lightStrikeDrop(attack, target) {
    if (attack.id !== 'light' || attack.projectile || attack.pickupWeapon || attack.lowStance
      || !this.onGround || !target?.onGround || Math.abs(this.y - target.y) > 10) return 0;
    const standingHeight = target.hurtboxSize.height;
    if (standingHeight > this.hurtboxSize.height - 12) return 0;
    const limb = attack.limbBoxes?.[0];
    const center = limb ? limb.top - limb.height / 2 : this.height - attack.yOffset - attack.height / 2;
    // Aim at the standing opponent's upper torso at startup. Ducking or jumping
    // during the attack still changes the defender's actual collision box.
    const torso = standingHeight * .82 + this.y - target.y;
    return Math.max(0, Math.min(26, center - torso));
  }

  attackBoxesFor(attack, facing, target) {
    const limbs = attack.limbBoxes ?? [undefined];
    const drop = attack.lightStrikeDrop ?? this.lightStrikeDrop(attack, target);
    return limbs.map(limb => this.attackBoxFor(attack, facing, limb, drop));
  }

  attackBoxFor(attack, facing = this.facing, segment = attack.limbBoxes?.[0], drop = attack.lightStrikeDrop ?? 0) {
    const limb = segment ?? { near: this.width * .18, far: this.width * .18 + attack.range,
      top: this.height - attack.yOffset, height: attack.height };
    // Basic strikes can connect when fighters are standing on top of each other.
    const near = !attack.pickupWeapon && ['light', 'heavy', 'kick'].includes(attack.id)
      ? Math.min(0, limb.near) : limb.near;
    return {
      x: this.x + (facing > 0 ? near : -limb.far),
      y: this.y - limb.top + drop,
      width: limb.far - near,
      height: limb.height,
    };
  }
}
