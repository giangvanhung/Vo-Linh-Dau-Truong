import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Fighter, FRAME_SECONDS } from '../src/combat/fighter.js';
import { createPickups } from '../src/game/pickups.js';
import { applyStageEffects, groundHeightAt, stageForMatch } from '../src/game/stages.js';
import { loadFighterConfig } from './fighter-config.mjs';

const config = await loadFighterConfig();
for (const [id, stage] of Object.entries(config.stages)) {
  test(id + ': bounds, floor, hazard switch and crate', () => {
    const world = { width: 1000, ...config.stage, ...stageForMatch(config.stage, stage, true) };
    const fighter = new Fighter(config.characters.hung, 0, 1, config.combat);
    fighter.x = -25;
    fighter.clampX(world);
    assert.equal(fighter.x, fighter.width / 2);
    fighter.x = world.width + 25;
    fighter.clampX(world);
    assert.equal(fighter.x, world.width - fighter.width / 2);
    assert.equal(groundHeightAt(world, fighter.x), 0);
    assert.equal(stageForMatch(config.stage, stage, false).zone, null);
    if (world.zone) {
      const zone = world.zone;
      fighter.x = world.width * (zone.range[0] + zone.range[1]) / 2;
      fighter.onGround = zone.kind !== 'wind';
      const x = fighter.x, hp = fighter.hp;
      const frame = zone.cycle ? zone.cycle - zone.active : 1;
      applyStageEffects(world, fighter, zone.kind === 'slip' ? x - 3 : x, frame, FRAME_SECONDS);
      if (zone.kind === 'slip') assert(fighter.x < x);
      if (zone.kind === 'wind') assert(fighter.x > x);
      if (zone.kind === 'lava') assert(fighter.hp < hp);
      if (zone.kind === 'vent') assert(fighter.vy < 0);
      if (zone.kind === 'mana') assert(fighter.meter > 0);
      if (zone.kind === 'condition') assert(fighter.stageCondition?.kind);
    }
    const boxes = createPickups(() => .5);
    boxes.reset(false);
    boxes.update([], 300, world);
    assert.equal(boxes.drop, null);
    boxes.reset(true);
    boxes.update([], 180, world);
    assert(boxes.drop);
  });
}
