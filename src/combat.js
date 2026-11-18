export class Fighter {
  constructor(config, x, facing) {
    Object.assign(this, config);
    this.x = x;
    this.facing = facing;
    this.hp = config.hp;
    this.vy = 0;
    this.onGround = true;
    this.crouching = false;
    this.blocking = false;
    this.attack = null;
    this.hitstun = 0;
    this.knockVelocity = 0;
    this.flash = 0;
    this.attackLock = 0;
  }
  startAttack(id, definition) {
    if (this.hp <= 0 || this.attack || this.hitstun > 0 || this.attackLock > 0 || this.blocking) return false;
    this.attack = { id, ...definition, elapsed: 0, hit: false };
    this.crouching = false;
    return true;
  }
  update(dt, world) {
    this.flash = Math.max(0, this.flash - dt);
    this.attackLock = Math.max(0, this.attackLock - dt);
    this.hitstun = Math.max(0, this.hitstun - dt);
    if (this.attack) {
      this.attack.elapsed += dt * 60;
      if (this.attack.elapsed >= this.attack.startup + this.attack.active + this.attack.recovery) this.attack = null;
    }
    this.vy += world.gravity * dt;
    this.y = (this.y ?? 0) + this.vy * dt;
    if (this.y >= 0) { this.y = 0; this.vy = 0; this.onGround = true; }
    if (Math.abs(this.knockVelocity) > 1) this.x += this.knockVelocity * dt;
    this.knockVelocity *= Math.pow(0.001, dt);
    this.x = Math.max(this.width / 2 + 15, Math.min(world.width - this.width / 2 - 15, this.x));
  }
  get attacking() { return this.attack !== null; }
  get attackActive() { return this.attack && this.attack.elapsed >= this.attack.startup && this.attack.elapsed < this.attack.startup + this.attack.active; }
}

export function resolveHit(attacker, defender) {
  const attack = attacker.attack;
  if (!attack || !attacker.attackActive || attack.hit) return null;
  const dx = defender.x - attacker.x;
  const gap = dx * attacker.facing;
  const defenderIsLow = defender.crouching && defender.onGround;
  const overlapsHeight = defenderIsLow ? attack.yOffset + attack.height > attacker.height * .62 : true;
  if (gap < 0 || gap > attack.range + defender.width / 2 || !overlapsHeight) return null;
  attack.hit = true;
  if (defender.blocking && defender.onGround && !defenderIsLow) {
    defender.hp = Math.max(0, defender.hp - attack.blockDamage);
    defender.knockVelocity = attacker.facing * attack.knockback * .16;
    defender.attackLock = Math.max(defender.attackLock, .14);
    return { blocked: true, damage: attack.blockDamage, x: defender.x, y: -defender.height * .7 };
  }
  defender.hp = Math.max(0, defender.hp - attack.damage);
  defender.hitstun = attack.hitstun / 60;
  defender.knockVelocity = attacker.facing * attack.knockback;
  defender.attack = null;
  defender.flash = .13;
  return { blocked: false, damage: attack.damage, x: defender.x, y: -defender.height * .76 };
}
