import { FRAME_SECONDS } from './fighter.js';

export const difficulties = {
  easy:   { reaction: [.30, .50], guard: .18, evade: .15, skill: .14, punish: .20, ultimate: .40, escape: .10, spacing: 72 },
  normal: { reaction: [.15, .25], guard: .43, evade: .50, skill: .40, punish: .60, ultimate: .65, escape: .40, spacing: 92 },
  hard:   { reaction: [.08, .15], guard: .64, evade: .72, skill: .57, punish: .86, ultimate: .80, escape: .62, spacing: 112 },
};

const unsafeMoves = new Set(['heavy', 'closeSkill', 'rangedSkill', 'ultimate']);

export class CpuController {
  constructor(level, config, random = Math.random) {
    this.profile = difficulties[level] ?? difficulties.normal;
    this.config = config;
    this.random = random;
    this.state = 'Neutral';
    this.time = 0;
    this.nextDecision = this.reaction();
    this.stateUntil = 0;
    this.offenseAfter = 0;
    this.lastMove = null;
    this.observed = new WeakMap();
    this.approachDistance = this.profile.spacing;
  }

  reaction() {
    const [min, max] = this.profile.reaction;
    return min + (max - min) * this.random();
  }

  ready(signal, response) {
    if (!signal) return false;
    if (!this.observed.has(signal)) this.observed.set(signal, {});
    const responses = this.observed.get(signal);
    const observation = responses[response] ??= { at: this.time + this.reaction(), used: false };
    return !observation.used && this.time >= observation.at;
  }

  consume(signal, response) {
    this.observed.get(signal)[response].used = true;
  }

  setState(state, duration) {
    this.state = state;
    this.stateUntil = this.time + duration;
  }

  startMove(id, state, useAttack) {
    if (!id || id === this.lastMove || this.time < this.offenseAfter || !useAttack(id)) return false;
    this.lastMove = id;
    this.setState(state, 0);
    return true;
  }

  update(dt, cpu, player, projectiles, world, useAttack, escape) {
    this.time += dt;
    const attack = player.attack;
    const attackReady = this.ready(attack, 'guard');
    const recovering = attack && attack.elapsed >= attack.startup + attack.active;
    const missed = recovering && unsafeMoves.has(attack.id) && !attack.hit && attack.lastPulse == null
      && (!attack.projectile || attack.projectileMissed);
    const punishReady = this.ready(missed ? attack : null, 'punish');
    const relativeX = player.x - cpu.x;
    const distance = Math.abs(relativeX);
    const towards = Math.sign(relativeX) || cpu.facing;
    const timeToHit = shot => ((cpu.x - shot.x) * shot.attack.facing
      - (shot.attack.projectile.width + cpu.hurtbox.width) / 2) / shot.attack.projectile.speed;
    const shot = projectiles.find(candidate => {
      if (candidate.attacker !== player || candidate.hit || (cpu.x - candidate.x) * candidate.attack.facing <= 0) return false;
      const eta = timeToHit(candidate);
      return eta <= .55 && eta < candidate.frames * FRAME_SECONDS
        && Math.abs(candidate.y - (cpu.y - cpu.height / 2)) < (candidate.attack.projectile.height + cpu.height) / 2;
    });
    const shotReady = this.ready(shot, 'evade');
    const comboReady = this.ready(cpu.hitstun > 0 && player.combo >= this.config.combat.escape.minCombo ? attack : null, 'escape');

    if (cpu.disabled || cpu.dash || cpu.attacking || !cpu.onGround) {
      cpu.setGuard(false);
      if (comboReady && cpu.meter >= this.config.combat.escape.cost) {
        this.consume(attack, 'escape');
        if (this.random() < this.profile.escape && escape()) this.setState('Retreat', .35);
      }
      return;
    }

    if (['Attack', 'Punish', 'Ultimate', 'Evade'].includes(this.state)) {
      this.offenseAfter = this.time + .24;
      this.setState('Retreat', .26);
    }
    if (this.state === 'Defend' && this.time < this.stateUntil && (!shot || !shotReady)) {
      cpu.setGuard(true);
      return;
    }
    cpu.setGuard(false);

    if (shotReady) {
      this.consume(shot, 'evade');
      const eta = timeToHit(shot);
      const jumpSpeed = this.config.stage.jumpVelocity;
      const jumpClearance = jumpSpeed * eta - world.gravity * eta ** 2 / 2;
      if (eta > 0 && this.random() < this.profile.evade) {
        if (jumpClearance > cpu.y - shot.y + shot.attack.projectile.height / 2 + 8) {
          cpu.vy = -jumpSpeed;
          cpu.onGround = false;
          this.setState('Evade', 0);
          return;
        }
        const dash = cpu.dashOptions.enhanced;
        if (cpu.facing === -shot.attack.facing && eta <= dash.invulnerableFrames * FRAME_SECONDS && cpu.startDash(true)) {
          this.setState('Evade', 0);
          return;
        }
      }
      if (this.random() < this.profile.guard) {
        this.setState('Defend', Math.max(0, eta) + .16);
        cpu.setGuard(true);
        return;
      }
    }

    const recoveryLeft = recovering ? attack.startup + attack.active + attack.recovery - attack.elapsed : 0;
    const move = id => cpu.skills[id] ?? cpu.attacks[id];
    const inRange = id => {
      const hit = cpu.attackBoxFor(move(id), towards);
      const hurt = player.hurtbox;
      return hit.x < hurt.x + hurt.width && hit.x + hit.width > hurt.x
        && hit.y < hurt.y + hurt.height && hit.y + hit.height > hurt.y;
    };
    const normals = ['light', 'heavy', 'kick'].filter(id => id !== this.lastMove && inRange(id));
    const ultimate = cpu.skills.ultimate;
    if (punishReady) {
      this.consume(attack, 'punish');
      if (this.random() < this.profile.punish) {
        if (inRange('ultimate') && recoveryLeft >= ultimate.startup / 2 && this.random() < this.profile.ultimate
          && this.startMove('ultimate', 'Ultimate', useAttack)) return;
        const options = this.random() < this.profile.skill ? ['closeSkill', ...normals] : normals;
        const punish = options.filter(id => id !== this.lastMove && !cpu.cooldowns[id]
          && inRange(id) && move(id).startup < recoveryLeft);
        if (this.startMove(punish[0], 'Punish', useAttack)) return;
      }
    } else if (attackReady && !recovering && !attack.projectile && distance < attack.range + cpu.width / 2 + player.width * .18
      && (attack.radial || attack.facing === -towards)) {
      this.consume(attack, 'guard');
      if (this.random() < this.profile.guard) {
        this.setState('Defend', Math.max(.20, (attack.startup + attack.active - attack.elapsed) * FRAME_SECONDS));
        cpu.setGuard(true);
        return;
      }
    }

    if (this.time >= this.stateUntil && this.time >= this.nextDecision) {
      const delay = this.reaction();
      this.nextDecision = this.time + delay;
      if (cpu.hp <= cpu.maxHp * .25 && distance < this.profile.spacing && this.random() < .5) {
        this.setState('Retreat', .20);
        return;
      }
      if (player.onGround && inRange('ultimate') && player.hitstun > ultimate.startup
        && this.random() < this.profile.ultimate && this.startMove('ultimate', 'Ultimate', useAttack)) return;
      if (player.onGround && this.random() < this.profile.skill) {
        const projectile = cpu.skills.rangedSkill.projectile;
        const skill = inRange('closeSkill') ? 'closeSkill'
          : distance > this.profile.spacing + 45 && distance < projectile.speed * projectile.lifetimeFrames * FRAME_SECONDS
            ? 'rangedSkill' : null;
        if (this.startMove(skill, 'Attack', useAttack)) return;
      }
      if (this.startMove(normals[Math.floor(this.random() * normals.length)], 'Attack', useAttack)) return;
      if (distance < this.profile.spacing - 18) {
        this.setState('Retreat', .20);
      } else if (!shot && distance > this.profile.spacing + 14) {
        this.approachDistance = this.profile.spacing;
        this.setState('Approach', delay);
        if (!attack && distance >= this.profile.spacing + cpu.dashOptions.normal.distance
          && this.random() < this.profile.evade && cpu.startDash(false)) return;
      } else if (!shot && player.onGround && distance >= this.profile.spacing && this.random() < .45) {
        this.approachDistance = Math.min(this.profile.spacing, cpu.attacks.kick.range);
        this.setState('Approach', delay);
      } else {
        this.setState('Neutral', delay);
      }
    }

    const direction = this.state === 'Approach' && distance > this.approachDistance ? towards
      : this.state === 'Retreat' && distance < this.profile.spacing + 34 ? -towards : 0;
    cpu.x += direction * cpu.moveSpeed * dt;
    cpu.clampX(world);
  }
}
