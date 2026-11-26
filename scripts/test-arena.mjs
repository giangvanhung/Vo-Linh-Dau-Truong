import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Fighter, FRAME_SECONDS } from '../src/combat/fighter.js';
import { findHit } from '../src/combat/hits.js';
import { createPickups } from '../src/game/pickups.js';
import { applyStageEffects, groundHeightAt, stageForMatch } from '../src/game/stages.js';
import { drawMaiPose, maiPoseName } from '../src/render/mai-action-poses.js';
import { animationName } from '../src/render/sprites.js';
import { loadFighterConfig } from './fighter-config.mjs';

const config = await loadFighterConfig();

test('Mai kicks use their own timing, grounded contact and mirrored reach', () => {
  for (const facing of [1, -1]) {
    for (const [group, id, startup] of [
      ['attacks', 'heavy', 9], ['attacks', 'kick', 11],
      ['crouchAttacks', 'heavy', 7], ['crouchAttacks', 'kick', 8],
      ['aerialNormals', 'heavy', 9], ['aerialNormals', 'kick', 7],
    ]) {
      const mai = new Fighter(config.characters.mai, 300, facing, config.combat);
      const opponent = new Fighter(config.characters.hung, 300 + 42 * facing, -facing, config.combat);
      mai.characterId = 'mai';
      if (group === 'aerialNormals') {
        mai.onGround = false;
        mai.y = -25;
      }
      const definition = mai[group][id];
      assert.equal(definition.startup, startup);
      assert(mai.startAttack(id, definition, opponent));
      mai.attack.elapsed = startup - 1;
      assert.equal(findHit(mai, opponent), null);
      mai.attack.elapsed = startup;
      assert(findHit(mai, opponent), `${group} ${id} facing ${facing}`);
      if (group === 'crouchAttacks') assert.equal(maiPoseName(mai, animationName(mai), 0, 0), 'sweep');
      mai.attack.elapsed += definition.active;
      assert.equal(findHit(mai, opponent), null);
    }
  }
});

test('Mai draws the side and rising frames at their ultimate pulse boundaries', () => {
  const mai = new Fighter(config.characters.mai, 300, 1, config.combat);
  const opponent = new Fighter(config.characters.hung, 342, -1, config.combat);
  mai.characterId = 'mai';
  mai.meter = mai.meterMax;
  const definition = mai.skills.ultimate;
  assert(mai.startAttack('ultimate', definition, opponent));
  const crops = [];
  const grips = [];
  const context = { save() {}, restore() {}, drawImage: (_, x, y) => crops.push([x, y]) };
  for (const pulse of definition.pulses.slice(1)) {
    mai.attack.elapsed = definition.startup + pulse.from;
    assert(findHit(mai, opponent));
    assert(drawMaiPose(context, [null, null, null, {}], mai, animationName(mai), 0, 0, 0,
      grip => grips.push(grip)));
  }
  assert.deepEqual(crops, [[512, 0], [512, 512]]);
  assert(grips.every(([x, y]) => x > 0 && y < 0));
});

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
