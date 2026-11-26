import assert from 'node:assert/strict';
import test from 'node:test';
import { Fighter, FRAME_SECONDS } from '../src/combat/fighter.js';
import { applyHit, findHit } from '../src/combat/hits.js';
import { applyControls } from '../src/game/fighter-controls.js';
import { canFollowHungLaunch, followHungLaunch, hungAirAttack, hungFollowFrames } from '../src/game/hung-air-combo.js';
import { animationName } from '../src/render/sprites.js';
import { maiPoseName } from '../src/render/mai-action-poses.js';
import { hungCrouchFrame } from '../src/render/hung-action-poses.js';
import { loadFighterConfig } from './fighter-config.mjs';

const config = await loadFighterConfig();
const world = { width: 1000, gravity: config.stage.gravity };

function fighter(id, x, facing) {
  const instance = new Fighter(config.characters[id], x, facing, config.combat);
  instance.characterId = id;
  return instance;
}

function advance(first, second, frames) {
  for (let frame = 0; frame < frames; frame++) {
    first.update(FRAME_SECONDS, world, second);
    second.update(FRAME_SECONDS, world, first);
    first.endFrame();
    second.endFrame();
  }
}

function connect(first, second, id, definition = first.attacks[id]) {
  assert(first.startAttack(id, definition, second));
  advance(first, second, definition.startup);
  const contact = findHit(first, second);
  return contact && applyHit(contact);
}

test('Mai trades strikes at flight altitude in either facing and lands after being hit', () => {
  const flightWorld = { ...world, height: 600, groundRatio: .825 };
  const controls = {
    world: flightWorld,
    jumpVelocity: config.stage.jumpVelocity,
    useAttack: (owner, target, id) => owner.startAttack(id, owner.aerialNormals?.[id] ?? owner.attacks[id], target),
  };
  for (const facing of [1, -1]) {
    for (const altitude of [-12, -110, -210]) {
      const mai = fighter('mai', 500 - 38 * facing, facing);
      const opponent = fighter('hung', 500, -facing);
      mai.awakeningLevel = 1;
      mai.awakeningBarrier = 100;
      mai.flightStamina = 100;
      mai.y = altitude;
      opponent.y = altitude === -110 ? altitude : 0;
      opponent.onGround = opponent.y === 0;
      applyControls(mai, opponent, { jump: true, attack: 'light' }, controls);
      assert(mai.freeFlying && mai.attack);
      assert(opponent.startAttack('light', opponent.attacks.light, mai));
      mai.attack.elapsed = mai.attack.startup - 1;
      mai.flightY = 0;
      mai.update(FRAME_SECONDS, flightWorld, opponent);
      opponent.attack.elapsed = opponent.attack.startup;
      assert.equal(Boolean(findHit(mai, opponent)), altitude !== -210);
      const contact = findHit(opponent, mai);
      assert.equal(Boolean(contact), altitude !== -210);
      if (!contact) continue;
      mai.escapeProtection = 1;
      assert.equal(findHit(opponent, mai), null);
      mai.escapeProtection = 0;
      applyHit(contact);
      assert(!mai.freeFlying && !mai.attack);
      for (let frame = 0; frame < 60; frame++) {
        mai.update(FRAME_SECONDS, flightWorld, opponent);
        mai.endFrame();
      }
      assert(mai.onGround && !mai.disabled);
      applyControls(mai, opponent, { direction: facing }, controls);
      assert.equal(mai.facing, facing);
    }
    const mai = fighter('mai', 500 - 48 * facing, facing);
    const opponent = fighter('hung', 500, -facing);
    mai.awakeningLevel = 1;
    mai.awakeningBarrier = 100;
    mai.flightStamina = 100;
    mai.y = -80;
    opponent.y = -80;
    opponent.onGround = false;
    applyControls(mai, opponent, { jump: true, attack: 'heavy' }, controls);
    const attack = mai.attack;
    assert.equal(attack.animation, 'maiAirSide');
    mai.flightY = 0;
    for (let frame = 0; frame < attack.startup; frame++) mai.update(FRAME_SECONDS, flightWorld, opponent);
    assert(findHit(mai, opponent));
    for (let frame = 0; frame < attack.active + attack.recovery; frame++) mai.update(FRAME_SECONDS, flightWorld, opponent);
    assert(mai.freeFlying && !mai.attack);
    applyControls(mai, opponent, { crouch: true }, controls);
    for (let frame = 0; frame < 40; frame++) mai.update(FRAME_SECONDS, flightWorld, opponent);
    assert(mai.onGround && !mai.freeFlying);
  }
});

test('Mai links palm, rear punch and rising kick without showing idle between the punches', () => {
  for (const facing of [1, -1]) {
    const mai = fighter('mai', 500 - 38 * facing, facing);
    const opponent = fighter('hung', 500, -facing);
    const pose = () => maiPoseName(mai, animationName(mai), 0, 0);
    assert(connect(mai, opponent, 'light')?.attack.confirmed);
    assert.equal(pose(), 'palm');
    advance(mai, opponent, 2);
    assert(mai.startAttack('light', mai.attacks.light, opponent));
    assert.equal(pose(), 'palm');
    advance(mai, opponent, 2);
    assert.equal(pose(), 'windup');
    advance(mai, opponent, mai.attack.startup - 2);
    assert.equal(pose(), 'punch');
    const contact = findHit(mai, opponent);
    assert(contact);
    applyHit(contact);
    advance(mai, opponent, 2);
    assert(mai.startAttack('kick', mai.attacks.kick, opponent));
    assert.equal(pose(), 'punch');
    advance(mai, opponent, 2);
    assert.equal(pose(), 'low');
    advance(mai, opponent, 40);
    assert.equal(pose(), 'guard');
  }
});

test('Hùng stays low when holding guard empties it, and recoils when a blow breaks it', () => {
  const first = fighter('hung', 439, 1);
  const second = fighter('hung', 500, -1);
  for (const passive of [true, false]) {
    first.guard = .3;
    first.guardBreak = 0;
    first.setGuard(false);
    first.setGuard(true);
    first.crouching = true;
    if (passive) advance(first, second, 1);
    else assert(first.spendGuard(1));
    first.crouching = false;
    assert(first.disabled && !first.blocking && first.guardReleaseRequired);
    const pose = animationName(first);
    assert.equal(pose, passive ? 'crouch' : 'hit');
    if (passive) assert.equal(hungCrouchFrame(first, pose, 0), 1);
  }
});

test('Hùng links three standing J/K/L strikes in each order after contact', () => {
  const sequences = [
    ['light', 'heavy', 'kick'], ['light', 'kick', 'heavy'],
    ['heavy', 'light', 'kick'], ['heavy', 'kick', 'light'],
    ['kick', 'light', 'heavy'], ['kick', 'heavy', 'light'],
    ['heavy', 'heavy', 'heavy'],
  ];
  for (const facing of [1, -1]) {
    for (const sequence of sequences) {
      const first = fighter('hung', 500 - 58 * facing, facing);
      const second = fighter('hung', 500, -facing);
      for (const id of sequence) {
        assert(connect(first, second, id)?.attack.confirmed, sequence.join(' → '));
        advance(first, second, 3);
      }
      assert.equal(first.combo, 3);
      assert(!first.startAttack('light', first.attacks.light, second));
      if (sequence.at(-1) === 'kick') assert(canFollowHungLaunch(first, second));
    }
  }
});

test('standing K and L complete recovery after a miss or a block', () => {
  for (const id of ['heavy', 'kick']) {
    for (const blocked of [true, false]) {
      const first = fighter('hung', 420, 1);
      const second = fighter('hung', blocked ? 471 : 600, -1);
      second.setGuard(blocked);
      assert.equal(Boolean(connect(first, second, id)?.blocked), blocked);
      advance(first, second, first.attack.active + 4);
      assert(first.attack);
      assert(!first.startAttack('light', first.attacks.light, second));
    }
  }
});

test('Hùng can step forward with standing K before impact and must plant his foot for the rest of the kick', () => {
  for (const facing of [1, -1]) {
    for (const holdDirection of [true, false]) {
      const first = fighter('hung', 500, facing);
      const second = fighter('hung', 500 + 120 * facing, -facing);
      const controls = {
        world, useAttack: (attacker, defender, id) => attacker.startAttack(id, attacker.attacks[id], defender),
      };
      const direction = holdDirection ? facing : 0;
      for (let frame = 0; frame < first.attacks.heavy.startup; frame++) {
        applyControls(first, second, { direction, attack: frame === 0 ? 'heavy' : null }, controls);
        advance(first, second, 1);
      }
      assert.equal(Boolean(findHit(first, second)), holdDirection);
      assert((first.x - 500) * facing > (holdDirection ? 40 : 0));
      const planted = first.x;
      const { active, recovery } = first.attack;
      for (let frame = 0; frame < active + recovery; frame++) {
        applyControls(first, second, { direction: facing }, controls);
        advance(first, second, 1);
      }
      assert.equal(first.x, planted);
      applyControls(first, second, { direction: facing }, controls);
      assert((first.x - planted) * facing > 0);
    }
  }
});

test('Hùng may only follow a confirmed launcher once before the window expires', () => {
  const first = fighter('hung', 439, 1);
  const second = fighter('hung', 500, -1);
  assert.equal(Boolean(canFollowHungLaunch(first, second)), false);
  assert.equal(connect(first, second, 'kick').blocked, false);
  assert.equal(first.hungFollow.frames, hungFollowFrames);
  advance(first, second, hungFollowFrames);
  assert(!followHungLaunch(first, second));
  advance(first, second, 60);
  assert(first.onGround && second.onGround);
  assert.equal(second.knockdown, 0);

  first.x = 439;
  second.x = 500;
  second.setGuard(true);
  assert.equal(connect(first, second, 'kick').blocked, true);
  assert(!followHungLaunch(first, second));
  second.setGuard(false);
  advance(first, second, 10);
  assert(first.attacking);
  assert(connect(second, first, 'light'));
  assert.equal(first.attack, null);
});

test('an incoming hit cancels both Hùng follow states', () => {
  for (const chased of [false, true]) {
    const first = fighter('hung', 436, 1);
    const second = fighter('hung', 500, -1);
    assert(connect(first, second, 'kick'));
    if (chased) {
      advance(first, second, 5);
      assert(followHungLaunch(first, second));
    }
    const interrupt = fighter('mai', first.x - 38, 1);
    assert(interrupt.startAttack('light', interrupt.attacks.light, first));
    interrupt.attack.elapsed = interrupt.attack.startup;
    assert(chased ? first.hungAirChain : first.hungFollow);
    const contact = findHit(interrupt, first);
    assert(contact);
    applyHit(contact);
    assert(first.hitstun > 0);
    assert.equal(first.hungFollow, null);
    assert.equal(first.hungAirChain, null);
    assert(!followHungLaunch(first, second));
  }
});

test('Hùng’s standing K rebounds from either wall only on an unblocked hit', () => {
  for (const facing of [1, -1]) {
    for (const blocked of [false, true]) {
      const edge = facing > 0 ? 979 : 21;
      const first = fighter('hung', edge - 63 * facing, facing);
      const second = fighter('hung', edge - 12 * facing, -facing);
      second.setGuard(blocked);
      assert.equal(connect(first, second, 'heavy').blocked, blocked);
      advance(first, second, 8);
      if (!blocked) {
        assert(second.knockVelocity * facing < 0);
        assert(!second.onGround);
      }
      assert.equal(second.kickWallBounce, null);
      advance(first, second, 55);
      assert(second.onGround);
      assert.equal(second.knockdown, 0);
    }
  }

  const first = fighter('hung', 449, 1);
  const second = fighter('hung', 500, -1);
  assert(connect(first, second, 'heavy'));
  advance(first, second, 30);
  assert.equal(second.kickWallBounce, null);
  assert(second.onGround);
});

test('the aerial K knocks down on landing only after contact', () => {
  for (const miss of [false, true]) {
    const first = fighter('hung', 936, 1);
    const second = fighter('hung', 979, -1);
    assert(connect(first, second, 'kick'));
    advance(first, second, 5);
    assert(followHungLaunch(first, second));
    assert(!followHungLaunch(first, second));
    advance(first, second, 8);
    assert(connect(first, second, 'light', hungAirAttack(first, second, 'light')));
    assert.equal(first.combo, 2);
    assert.equal(second.knockdownOnLanding, false);
    advance(first, second, 3);
    if (miss) first.x -= 185;
    const finish = connect(first, second, 'heavy', hungAirAttack(first, second, 'heavy'));
    assert.equal(Boolean(finish), !miss);
    assert.equal(second.knockdownOnLanding, !miss);
    advance(first, second, 1);
    if (!miss) {
      assert(second.knockVelocity < 0);
      assert(second.vy > 0);
    }
    advance(first, second, 45);
    assert(first.onGround && second.onGround);
    assert.equal(second.knockdown > 0, !miss);
    assert.equal(first.hungAirChain, null);
    assert.equal(first.canMoveDuringAttack, true);
    for (const subject of [first, second]) {
      assert(subject.x >= subject.width / 2 && subject.x <= world.width - subject.width / 2);
    }
  }
});
