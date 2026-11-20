import { overlapsSurface } from '../game/stages.js';
import { findContact } from './hits.js';

export function updateProjectiles(projectiles, fighters, dt, world) {
  const contacts = [];
  for (const attacker of fighters) {
    const attack = attacker.attack;
    if (!attack?.projectile || attack.elapsed !== attack.startup) continue;
    const { width, yOffset, lifetimeFrames, spawnOffset = attacker.width / 2 } = attack.projectile;
    if (attack.projectile.meterPerFrame) {
      attack.active = Math.max(1, Math.ceil(attacker.meter / attack.projectile.meterPerFrame));
      projectiles.push({ attacker, attack, facing: attack.facing, age: 0, nextHit: 0 });
      continue;
    }
    projectiles.push({
      attacker, attack, x: attacker.x + attack.facing * (spawnOffset + width / 2),
      y: attacker.y - yOffset, frames: lifetimeFrames, age: 0, facing: attack.facing, hit: false,
    });
  }
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const shot = projectiles[i];
    const { attacker, attack } = shot;
    const { meterPerFrame, pulseFrames } = attack.projectile;
    if (meterPerFrame) {
      if (attacker.attack !== attack || attacker.disabled || shot.age >= attack.active || attacker.meter <= 0) {
        attack.active = Math.min(attack.active, Math.max(1, shot.age));
        projectiles.splice(i, 1);
        continue;
      }
      attacker.meter = Math.max(0, attacker.meter - meterPerFrame);
      shot.age++;
      shot.x = attacker.x + shot.facing * attacker.width * .58;
      shot.y = attacker.y - attack.projectile.yOffset;
      const reach = shot.facing > 0 ? world.width - shot.x : shot.x;
      shot.width = Math.max(0, reach) * Math.min(1, shot.age / 7);
      const fade = Math.min(1, (attack.active - shot.age + 1) / 12);
      shot.height = attack.projectile.height * (.24 + .76 * fade) * Math.min(1, shot.age / 4);
      if (shot.age >= shot.nextHit && shot.width > 0) {
        const defender = fighters.find(fighter => fighter !== attacker);
        const hit = findContact(attacker, defender, attack, {
          x: shot.x + (shot.facing < 0 ? -shot.width : 0), y: shot.y - shot.height / 2,
          width: shot.width, height: shot.height,
        }, shot.x, -shot.facing);
        if (hit) {
          contacts.push({ ...hit, projectile: true });
          shot.nextHit = shot.age + pulseFrames;
        }
      }
      continue;
    }
    const { speed, width, height, pierce, returnAfter, delayFrames, afterfire, poolFrames } = attack.projectile;
    const reachedEdge = shot.facing > 0 ? shot.x >= world.width - width / 2 : shot.x <= width / 2;
    if (returnAfter && !shot.returned && (shot.age >= returnAfter || reachedEdge)) {
      shot.returned = true;
      shot.facing *= -1;
      shot.hit = false;
    }
    shot.age++;
    const velocity = shot.age <= (delayFrames ?? 0) ? speed * .12 : speed;
    const oldX = shot.x;
    shot.x += shot.facing * velocity * dt;
    shot.frames--;
    const defender = fighters.find(fighter => fighter !== attacker);
    if (!shot.hit) {
      const hit = findContact(attacker, defender, attack, {
        x: Math.min(oldX, shot.x) - width / 2, y: shot.y - height / 2,
        width: width + Math.abs(shot.x - oldX), height,
      }, oldX, -shot.facing);
      if (hit) {
        contacts.push({ ...hit, projectile: true });
        shot.hit = true;
        if ((!returnAfter && hit.blocked) || !pierce) shot.frames = 0;
      }
    }
    const expired = shot.frames <= 0 || shot.x < -width || shot.x > world.width + width;
    if (!shot.hit && (expired || (shot.x - defender.x) * attack.facing > (width + defender.width) / 2)) {
      attack.projectileMissed = true;
    }
    if (expired && poolFrames) {
      const platform = (world.platforms ?? []).find(surface => shot.y <= surface.y && overlapsSurface(shot.x, world.width, surface.range));
      shot.x = Math.max(42, Math.min(world.width - 42, shot.x));
      shot.y = (platform?.y ?? 0) - 9;
      shot.attack = { ...attack, damage: 2, knockback: 35, hitstun: 8, level: 'low',
        projectile: { ...attack.projectile, poolFrames: 0, speed: 0, width: 84, height: 18, pierce: true, shape: 'pool' } };
      shot.hit = false;
      shot.frames = poolFrames;
    } else if (expired && afterfire && shot.x >= 0 && shot.x <= world.width) {
      shot.attack = { ...attack, damage: 5, level: 'low', hitstun: 12, knockback: 65,
        projectile: { ...attack.projectile, afterfire: false, speed: 0, width: 65, height: 16, shape: 'embers' } };
      shot.y = -8;
      shot.hit = false;
      shot.frames = 27;
    } else if (expired) projectiles.splice(i, 1);
  }
  return contacts;
}
