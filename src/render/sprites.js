import { weaponMotion } from './weapon-motion.js';
import { drawHungAlternateStrike, drawHungOverheadChop, drawHungStride, drawStillAttack, hasPaintedWeapon } from './still-attacks.js';
import { applyFighterMotion, drawLowStride } from './fighter-motion.js';
import { drawPoseSheet } from './pose-sheet.js';
import { atlasGrip, poseGrip, stillGrip } from './weapon-grips.js';
import { drawNewFighter } from './new-fighters.js';
import { drawDetailedFighter, prepareDetailedFighter, prepareSupportPoses } from './detailed-fighters.js';
import { drawHungEvolution } from './hung-evolution.js';
import { drawMaiPose, maiPosePaths } from './mai-action-poses.js';
import { applyHungRollPose, drawHungPose, hungAirborneFrame, hungCrouchFrame, hungCrouchWalkFrame, hungDodgeFrame, hungFallFrame, hungKickFrame, hungPosePaths, hungTechniqueFrame, hungTurnFrame, hungWalkFrame, maskHungScarf } from './hung-action-poses.js';

const attackClips = {
  light: ['light_punch', 1], heavy: ['heavy_punch', 2], kick: ['kick', 1],
  closeSkill: ['skill_1', 2], rangedSkill: ['skill_2', 3], ultimate: ['ultimate', 4],
};

export function loadImage(path) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load ' + path));
    image.src = path;
  });
}

async function loadAtlas(atlasPath, imagePath) {
  const response = await fetch(atlasPath);
  if (!response.ok) throw new Error('Could not load ' + atlasPath);
  const atlas = await response.json();
  const image = await loadImage(imagePath ?? new URL(atlas.meta.image, response.url).href);
  const clips = new Map();
  for (const [name, definition] of Object.entries(atlas.animations ?? {})) {
    const frames = definition.frames.map(id => atlas.frames[id]);
    if (frames.length && frames.every(entry => {
      const box = entry?.frame;
      return box && !entry.rotated && box.x >= 0 && box.y >= 0 && box.w > 0 && box.h > 0
        && box.x + box.w <= image.width && box.y + box.h <= image.height;
    })) clips.set(name, { frames, strikeFrame: definition.strikeFrame });
  }
  return { atlas, image, clips };
}

export function animationName(fighter) {
  if (fighter.knockdownOnLanding && !fighter.onGround) return 'hit';
  if (fighter.hp <= 0) return 'ko';
  if (fighter.knockdown > 0) return 'knockdown';
  if (fighter.freezeFrames || fighter.hitstun || fighter.guardBreak) return 'hit';
  if (fighter.attack) return fighter.activePulse?.animation ?? fighter.attack.animation
    ?? attackClips[fighter.attack.id]?.[0] ?? fighter.attack.id;
  if (fighter.dash) return fighter.dash.roll ? 'roll' : 'dash';
  if (!fighter.onGround) return 'jump';
  if (fighter.blocking) return 'block';
  if (fighter.charging) return 'charge';
  if (fighter.crouching) return fighter.moving ? 'crouchWalk' : 'crouch';
  return fighter.moving ? 'run' : 'idle';
}

function selectFrame({ frames, strikeFrame }, fighter, name, elapsed) {
  const attack = fighter.attack;
  const pulse = fighter.activePulse;
  if (pulse?.animation === name) {
    const strike = strikeFrame ?? 0;
    const age = attack.elapsed - attack.startup - pulse.from;
    const offset = age === 0 ? -1 : age === pulse.to - pulse.from - 1 ? 1 : 0;
    return frames[Math.max(0, Math.min(frames.length - 1, strike + offset))];
  }
  if (attack && (attack.animation ?? attackClips[attack.id]?.[0]) === name) {
    const strike = Math.min(attack.strikeFrame ?? strikeFrame ?? attackClips[attack.id]?.[1] ?? 0, frames.length - 1);
    if (fighter.attackActive) return frames[strike];
    if (attack.elapsed < attack.startup) {
      return frames[Math.floor(attack.elapsed * strike / attack.startup)];
    }
    const recovery = attack.elapsed - attack.startup - attack.active;
    const remaining = frames.length - strike - 1;
    return frames[strike + Math.min(remaining, 1 + Math.floor(recovery * remaining / attack.recovery))];
  }
  if (fighter.dash && (name === 'dash' || name === 'roll')) {
    return frames[Math.min(frames.length - 1, Math.floor(fighter.dash.elapsed * frames.length / fighter.dash.frames))];
  }
  if (name === 'jump') return frames[fighter.vy < 0 ? 0 : frames.length - 1 - (frames.length > 2 ? 1 : 0)];
  const durations = frames.map(frame => frame.duration > 0 ? frame.duration : 100);
  const length = durations.reduce((sum, duration) => sum + duration, 0);
  let time = name === 'run' || name === 'idle'
    ? ((elapsed % length) + length) % length : Math.min(elapsed, length - 1);
  return frames[durations.findIndex(duration => (time -= duration) < 0)];
}

export function createSpriteRenderer(ctx, characters, drawHeld = () => {}, getHungEffects = () => null) {
  const sheets = new Map();
  const evolvedStills = new Map();
  const clocks = new WeakMap();
  const details = new Map();
  const maiPoses = [];
  const hungPoses = {};
  const maskedHungPoses = {};
  if (characters.hung) {
    for (const [kind, path] of Object.entries(hungPosePaths)) {
      loadImage(path).then(image => {
        hungPoses[kind] = image;
        maskedHungPoses[kind] = maskHungScarf(image, kind);
      }).catch(() => {});
    }
  }
  for (const [id, character] of Object.entries(characters)) {
    const paths = character.sprite;
    if (paths?.still) {
      const sheet = {};
      sheets.set(id, sheet);
      if (paths.poseSheet) sheet.posePath = paths.poseSheet;
      loadImage(paths.still).then(image => { sheet.still = image; }).catch(() => {});
      const evolved = character.awakening?.levelTwo?.evolution?.sprite;
      if (evolved) loadImage(evolved).then(image => evolvedStills.set(id, image)).catch(() => {});
      sheet.extraPath = paths.extraPoses;
      sheet.evolvedPath = character.awakening?.levelTwo?.evolution?.poseSheet;
      continue;
    }
    if (!paths?.atlas) continue;
    loadAtlas(paths.atlas, paths.image)
      .then(sheet => {
        if (id === 'hung') sheet.withoutScarf = maskHungScarf(sheet.image, 'base');
        sheets.set(id, sheet);
      })
      .catch(() => {}); // The colored placeholder remains available.
  }

  function preloadFighter(id) {
    const sheet = sheets.get(id);
    if (sheet?.posePath) {
      loadImage(sheet.posePath).then(image => { sheet.poses = image; }).catch(() => {});
      sheet.posePath = null;
    }
    if (sheet?.extraPath) {
      loadImage(sheet.extraPath).then(image => { sheet.extras = image; }).catch(() => {});
      sheet.extraPath = null;
    }
    if (id === 'mai' && characters.mai && !maiPoses.length) {
      maiPoses.length = maiPosePaths.length;
      maiPosePaths.forEach((path, index) => {
        loadImage(path).then(image => { maiPoses[index] = image; }).catch(error => console.warn(error));
      });
    }
    if (!characters[id]?.prototypeStyle || details.has(id)) return;
    details.set(id, null);
    loadImage(`/assets/characters/${id}/battle-poses.png`)
      .then(image => {
        const poses = prepareDetailedFighter(image, id);
        details.set(id, poses);
        const path = characters[id].supportPoses;
        if (path) loadImage(path).then(art => { poses.support = prepareSupportPoses(art, id); }).catch(error => console.warn(error));
      })
      .catch(error => console.warn(error));
  }
  draw.preloadFighter = preloadFighter;
  return draw;

  function draw(fighter, ground, animationTime, movementPose) {
    const drawWeapon = (hand, redraw) => drawHeld(fighter, hand, redraw);
    const filter = [fighter.skinFilter, fighter.flash > 0 && 'brightness(1.5)'].filter(Boolean).join(' ');
    const name = animationName(fighter);
    if (fighter.prototypeStyle) {
      const id = fighter.characterId;
      preloadFighter(id);
      ctx.save();
      if (filter) ctx.filter = filter;
      if (!drawDetailedFighter(ctx, details.get(id), fighter, name, ground, animationTime, drawWeapon)) {
        drawNewFighter(ctx, fighter, name, ground, animationTime, drawWeapon);
      }
      ctx.restore();
      return true;
    }
    let clock = clocks.get(fighter);
    if (!clock) {
      clock = { name, start: animationTime, last: animationTime, crouch: 0, crouchTransition: 0 };
      clocks.set(fighter, clock);
    }
    const previousName = clock.name;
    if (clock.name !== name) {
      clock.name = name;
      clock.start = animationTime;
    }
    const delta = Math.max(0, animationTime - clock.last);
    clock.last = animationTime;
    clock.crouch = name === 'crouch'
      ? Math.min(1, clock.crouch + delta / 55)
      : 0;
    if (fighter.characterId === 'mai') {
      preloadFighter('mai');
      ctx.save();
      ctx.translate(fighter.x, ground + fighter.y);
      ctx.scale(fighter.attack?.facing ?? fighter.dash?.facing ?? fighter.facing, 1);
      if (fighter.invulnerable) ctx.globalAlpha = .78;
      if (filter) ctx.filter = filter;
      const drawn = drawMaiPose(ctx, maiPoses, fighter, name, animationTime - clock.start,
        animationTime, movementPose?.stride ?? fighter.walkDistance, drawWeapon);
      ctx.restore();
      if (drawn) return true;
    }
    const sheet = sheets.get(fighter.characterId);
    if (sheet?.posePath || sheet?.extraPath) preloadFighter(fighter.characterId);
    const evolved = fighter.evolving && fighter.awakeningLevel === 2 && fighter.evolution?.sprite;
    if (evolved && sheet?.evolvedPath) {
      loadImage(sheet.evolvedPath).then(image => { sheet.evolved = image; }).catch(() => {});
      sheet.evolvedPath = null;
    }
    if (sheet?.still || sheet?.poses) {
      const poses = evolved && sheet.evolved ? sheet.evolved : sheet.poses;
      const image = evolved ? evolvedStills.get(fighter.characterId) ?? sheet.still : sheet.still;
      const height = fighter.sprite.displaySize;
      const attack = fighter.attack;
      const sway = fighter.moving ? Math.sin(fighter.walkDistance / 9) : Math.sin(animationTime / 170) * .35;
      ctx.save();
      ctx.translate(fighter.x, ground + fighter.y);
      ctx.scale(attack?.facing ?? fighter.dash?.facing ?? fighter.facing, 1);
      if (name === 'ko') ctx.rotate(-Math.PI / 2);
      else {
        applyFighterMotion(ctx, fighter, name, height, clock.crouch, !poses);
        if (name === 'run' || name === 'idle') ctx.transform(1, 0, -.035 * sway, 1 + sway * .035, 0, 0);
      }
      if (fighter.invulnerable) ctx.globalAlpha = .78;
      if (filter) ctx.filter = filter;
      const useRearLimb = attack?.limbSide === 'right' && attack.animation !== 'sweep'
        && name !== 'hit' && name !== 'ko' && name !== 'knockdown';
      const paintedWeapon = hasPaintedWeapon(fighter.characterId);
      const width = image && height * image.width / image.height;
      const hand = image && stillGrip(fighter.characterId, width, height);
      const drawAtHand = (strikeHand, redraw) => {
        const grip = strikeHand ?? hand;
        if (grip && !paintedWeapon) drawWeapon(grip, redraw);
      };
      let articulated = false;
      const weaponStrike = weaponMotion(attack) && !['hit', 'ko', 'knockdown'].includes(name);
      if (weaponStrike && !paintedWeapon && image) {
        articulated = drawStillAttack(ctx, image, width, height, fighter, drawAtHand);
      } else if ((useRearLimb || weaponStrike) && paintedWeapon && poses) {
        const size = height * 256 / 210;
        const [handX, handY] = poseGrip(fighter.characterId, 0, false);
        articulated = drawStillAttack(ctx, poses, size, size * 244 / 256, fighter,
          grip => drawWeapon(grip ?? [size * (handX / 256 - .5), size * (handY - 244) / 256]), poses.width / 4);
      } else if (useRearLimb && image) {
        articulated = drawStillAttack(ctx, image, width, height, fighter, drawAtHand);
      }
      if (!articulated && poses) drawPoseSheet(ctx, poses, evolved ? null : sheet.extras, fighter, name, height, drawWeapon);
      else if (!articulated && image) {
        const fallbackStrike = !paintedWeapon && name !== 'hit' && name !== 'ko' && name !== 'knockdown'
          && drawStillAttack(ctx, image, width, height, fighter, drawAtHand);
        if (!fallbackStrike) {
          const drawImage = () => {
            if (name === 'crouchWalk') {
              drawLowStride(ctx, image, 0, 0, image.width, image.height, -width / 2, -height, width, height, fighter.walkDistance);
            } else ctx.drawImage(image, -width / 2, -height, width, height);
          };
          drawImage();
          drawAtHand(null, drawImage);
        }
      }
      ctx.restore();
      return true;
    }
    const clips = sheet?.clips;
    const isHung = fighter.characterId === 'hung';
    if (isHung) {
      clock.crouchTransition = fighter.crouching
        ? Math.min(80, clock.crouchTransition + delta)
        : Math.max(0, clock.crouchTransition - delta * 2);
    }
    if (isHung) {
      clock.landing = previousName === 'jump' && fighter.onGround ? 50 : Math.max(0, (clock.landing ?? 0) - delta);
    }
    const hungLanding = isHung && hungPoses.landing && clock.landing > 0
      && (name === 'idle' || (name === 'run' && clock.landing >= 33));
    const hungAirborne = isHung && name === 'jump' && hungPoses.airborne
      && !fighter.weapon && !fighter.weaponUses;
    const airborneFrame = hungAirborne ? hungAirborneFrame(fighter) : -1;
    const dodgeFrame = isHung && hungPoses.dodge && fighter.dash && (name === 'dash' || name === 'roll')
      && !fighter.weapon && !fighter.weaponUses ? hungDodgeFrame(fighter.dash) : -1;
    const hungRollRecovery = isHung && hungPoses.rollRecovery && name === 'roll' && dodgeFrame < 0
      && fighter.dash.elapsed / fighter.dash.frames >= 5 / 6 && !fighter.weapon && !fighter.weaponUses;
    const hungBrake = isHung && hungPoses.dodge && name === 'dash' && dodgeFrame < 0
      && fighter.dash.elapsed / fighter.dash.frames >= .72 && !fighter.weapon && !fighter.weaponUses;
    const hungEffects = isHung ? getHungEffects() : null;
    const bodyImage = hungEffects && sheet?.withoutScarf ? sheet.withoutScarf : sheet?.image;
    const actionPoses = hungEffects ? maskedHungPoses : hungPoses;
    const fallback = name === 'roll' ? 'dash' : name === 'charge' ? (isHung ? 'idle' : 'block') : attackClips[fighter.attack?.id]?.[0];
    const hungDown = isHung && name === 'knockdown';
    const hungRise = hungDown && fighter.knockdown <= 5 && hungPoses.rollRecovery;
    const techniqueFrame = isHung && hungPoses.technique ? hungTechniqueFrame(fighter, name) : -1;
    const guardImpact = isHung && name === 'block' ? Math.min(1, fighter.attackLock / .14) : 0;
    const hitImpact = isHung && name === 'hit' ? Math.min(1, fighter.flash / .13) : 0;
    const walk = name === 'crouchWalk' ? 'run'
      : hungDown ? (fighter.knockdown > 8 ? 'ko' : 'crouch')
      : name === 'knockdown' ? 'hit' : name;
    const motion = !['hit', 'ko', 'knockdown'].includes(name) && weaponMotion(fighter.attack);
    const attack = fighter.attack;
    const heavyStanding = isHung && name === 'heavy_punch' && fighter.onGround && attack?.id === 'heavy'
      && !attack.lowStance && !attack.pickupWeapon && !attack.usesNativeWeapon;
    const heavyWindup = heavyStanding && hungPoses.heavyWindup
      && attack.elapsed >= Math.floor(attack.startup / 3) && attack.elapsed < attack.startup;
    const heavyRecovery = heavyStanding && attack.elapsed >= attack.startup + attack.active;
    const clip = (motion && clips?.get('idle')) || clips?.get(walk) || clips?.get(fallback) || clips?.get('idle');
    if (!clip) return false;
    const elapsed = walk === 'run' ? fighter.walkDistance * (name === 'crouchWalk' ? 16 : 1000 / fighter.moveSpeed)
      : animationTime - clock.start;
    const entry = hungDown && walk === 'ko' ? clip.frames.at(-1)
      : hungAirborne && !fighter.runJump && airborneFrame < 0 ? (clip.frames[1] ?? clip.frames[0])
      : hungBrake ? (clip.frames[2] ?? clip.frames.at(-1))
      : selectFrame(clip, fighter, walk, elapsed);
    const { x, y, w, h } = entry.frame;
    const source = entry.sourceSize ?? { w, h };
    const trim = entry.spriteSourceSize ?? { x: 0, y: 0 };
    const pivot = entry.pivot
      ? { x: entry.pivot.x * source.w, y: entry.pivot.y * source.h }
      : sheet.atlas.meta.pivotPixels ?? { x: source.w / 2, y: source.h };
    const scale = (characters[fighter.characterId].sprite?.displaySize ?? 128) / source.h;
    const hungStride = isHung && (['run', 'crouch', 'crouchWalk'].includes(name) || (name === 'jump' && fighter.runJump));
    const kickFrame = isHung && actionPoses.kick ? hungKickFrame(fighter, name) : -1;
    const kickSettle = isHung && name === 'kick' && fighter.onGround && attack?.id === 'kick'
      && !attack.pickupWeapon && !attack.lowStance && hungPoses.kick && hungPoses.landing
      && attack.elapsed >= attack.startup + attack.active + Math.ceil(attack.recovery * .40)
      && attack.elapsed < attack.startup + attack.active + Math.ceil(attack.recovery * .40) + 3;
    const crouchFrame = isHung && hungPoses.crouch
      ? (name === 'sweep' && actionPoses.kick && kickFrame < 0 ? 1 : hungCrouchFrame(fighter, name, clock.crouchTransition)) : -1;
    const crouchWalkFrame = isHung && name === 'crouchWalk' && actionPoses.crouchWalk
      ? hungCrouchWalkFrame(movementPose?.stride ?? fighter.walkDistance) : -1;
    const standingWalkFrame = isHung && name === 'run' && actionPoses.walk
      ? hungWalkFrame(movementPose?.stride ?? fighter.walkDistance) : -1;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(fighter.x, ground + fighter.y);
    ctx.scale((fighter.attack?.facing ?? fighter.dash?.facing ?? fighter.facing) < 0 ? -1 : 1, 1);
    if (dodgeFrame === 1) applyHungRollPose(ctx, fighter.dash, scale);
    if (hungBrake) ctx.translate(-5 * scale, scale);
    if (hungRollRecovery) {
      const rise = (fighter.dash.elapsed - fighter.dash.frames * 5 / 6) / (fighter.dash.frames / 6);
      ctx.scale(1, 1 + .10 * rise);
    }
    if (guardImpact) ctx.transform(1, 0, .05 * guardImpact, 1 - .065 * guardImpact, 0, 0);
    if (hitImpact) ctx.transform(1, 0, .11 * hitImpact, 1 - .035 * hitImpact, 0, 0);
    if (techniqueFrame < 0 && !kickSettle && !heavyStanding && !hungLanding && !hungBrake && !hungRollRecovery && dodgeFrame < 0 && airborneFrame < 0 && kickFrame < 0 && crouchFrame < 0 && !hungStride && !hungDown) applyFighterMotion(ctx, fighter, name, scale * source.h, clock.crouch, false);
    if (fighter.invulnerable) ctx.globalAlpha = .78;
    if (filter) ctx.filter = filter;
    if (hungDown && hungPoses.fall) {
      const age = Math.max(0, fighter.knockdownFrames - fighter.knockdown);
      const falling = Math.max(0, 1 - age / 8);
      ctx.translate(-4 * falling * scale, -17 * falling * falling * scale);
      if (hungRise) drawHungPose(ctx, hungPoses.rollRecovery, 'rollRecovery', 0, scale);
      else drawHungPose(ctx, hungPoses.fall, 'fall', hungFallFrame(fighter.knockdown, fighter.knockdownFrames), scale);
      ctx.restore();
      return true;
    }
    const pose = techniqueFrame >= 0 ? drawHungPose(ctx, hungPoses.technique, 'technique', techniqueFrame, scale)
      : heavyWindup ? drawHungPose(ctx, hungPoses.heavyWindup, 'heavyWindup', 0, scale)
      : hungLanding || kickSettle ? drawHungPose(ctx, hungPoses.landing, 'landing', 0, scale)
      : hungRollRecovery ? drawHungPose(ctx, hungPoses.rollRecovery, 'rollRecovery', 0, scale)
      : dodgeFrame >= 0 ? drawHungPose(ctx, hungPoses.dodge, 'dodge', dodgeFrame, scale)
      : airborneFrame >= 0 ? drawHungPose(ctx, hungPoses.airborne, 'airborne', airborneFrame, scale)
      : kickFrame >= 0 ? drawHungPose(ctx, actionPoses.kick, 'kick', kickFrame, scale)
      : crouchFrame >= 0 ? drawHungPose(ctx, actionPoses.crouch, 'crouch', crouchFrame, scale)
      : crouchWalkFrame >= 0 ? drawHungPose(ctx, actionPoses.crouchWalk, 'crouchWalk', crouchWalkFrame, scale)
      : standingWalkFrame >= 0 ? drawHungPose(ctx, actionPoses.walk, 'walk', standingWalkFrame, scale)
      : isHung && !heavyRecovery && !motion && !(name === 'kick' && actionPoses.kick && fighter.onGround)
        && drawHungPose(ctx, actionPoses.turn, 'turn', hungTurnFrame(fighter.attack, name), scale);
    if (pose) {
      const crouchPunch = crouchFrame === 2 || crouchFrame === 3;
      const swap = crouchPunch && (crouchFrame === 3) !== (fighter.attack.limbSide === 'right');
      const hands = swap ? [pose.front, pose.rear] : [pose.rear, pose.front];
      const [rear, front] = hands.map(([u, v]) => [u * scale, v * scale]);
      drawHungEvolution(ctx, hungEffects, fighter, animationTime, 0, 0, 0, scale,
        front, rear, [pose.rear, pose.chest], Boolean(heavyWindup || hungLanding || hungRollRecovery || kickSettle) || techniqueFrame >= 0 || airborneFrame >= 0 || dodgeFrame >= 0);
      ctx.restore();
      return true;
    }
    const left = Math.round((trim.x - pivot.x) * scale);
    const top = Math.round((trim.y - pivot.y) * scale);
    if (isHung && name === 'skill_1' && attack?.visual === 'overheadBlade') {
      drawHungOverheadChop(ctx, bodyImage, attack, scale, drawWeapon, (front, rear) => {
        drawHungEvolution(ctx, hungEffects, fighter, animationTime, 0, -53 * scale, -116 * scale, front, rear);
      });
      ctx.restore();
      return true;
    }
    if (hungStride) {
      drawHungStride(ctx, bodyImage, fighter, scale, drawWeapon, (front, rear) => {
        drawHungEvolution(ctx, hungEffects, fighter, animationTime, 0, -53 * scale, -116 * scale, front, rear);
      }, movementPose);
      ctx.restore();
      return true;
    }
    if (isHung && !attack?.pickupWeapon
      && (name === 'crouchPunch' || name === 'sweep'
        || (name === 'kick' && attack?.id === 'kick')
        || (!motion && attack?.limbSide && ['light_punch', 'heavy_punch'].includes(name)))) {
      let visibleAttack = attack;
      if (heavyRecovery) {
        const firstRecovery = attack.startup + attack.active;
        const age = attack.elapsed - firstRecovery;
        const retraction = Math.min(1, .2 + age / Math.min(9, attack.recovery));
        visibleAttack = { ...attack, elapsed: firstRecovery + retraction * attack.recovery };
      }
      drawHungAlternateStrike(ctx, bodyImage, visibleAttack, scale, drawWeapon, fist => {
        const rear = attack.limbSide === 'right';
        const grip = !rear && fist ? fist : [23 * scale, -74 * scale];
        drawHungEvolution(ctx, hungEffects, fighter, animationTime, 0, -53 * scale, -116 * scale, grip, rear && fist ? fist : null);
      }, heavyRecovery);
      ctx.restore();
      return true;
    }
    const drawImage = () => ctx.drawImage(bodyImage, x, y, w, h, left, top, w * scale, h * scale);
    const hand = atlasGrip(fighter.characterId, entry.frame);
    const grip = !hungDown && hand && [left + hand[0] * scale, top + hand[1] * scale];
    if (grip && motion?.amount > .02) {
      drawAtlasWeaponArm(ctx, drawImage, drawWeapon, grip, scale, motion);
    } else {
      drawImage();
      if (grip) drawWeapon(grip, drawImage);
    }
    if (isHung && !hungDown) drawHungEvolution(ctx, hungEffects, fighter, animationTime, x / 128 + y / 16, left, top, scale, grip);
    ctx.restore();
    return true;
  };
}

function drawAtlasWeaponArm(ctx, drawImage, drawWeapon, [x, y], scale, motion) {
  // The forward arm in the atlas guard frame ends at the measured weapon grip.
  const dx = 19 * scale;
  const dy = -6 * scale;
  const shoulderX = x - dx;
  const shoulderY = y - dy;
  function outline() {
    ctx.moveTo(shoulderX, shoulderY - 5 * scale);
    ctx.lineTo(x + 7 * scale, y - 7 * scale);
    ctx.lineTo(x + 9 * scale, y + 5 * scale);
    ctx.lineTo(shoulderX - 2 * scale, shoulderY + 7 * scale);
    ctx.closePath();
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(-250 * scale, -250 * scale, 500 * scale, 500 * scale);
  outline();
  ctx.clip('evenodd');
  drawImage();
  ctx.restore();
  const rest = Math.atan2(dy, dx);
  const angle = rest + (motion.kind === 'aim' ? (motion.angle - rest) * motion.amount : motion.angle);
  const reach = Math.hypot(dx, dy) * motion.reach;
  function drawArm() {
    ctx.save();
    ctx.translate(shoulderX, shoulderY);
    ctx.rotate(angle);
    ctx.scale(motion.reach, 1);
    ctx.rotate(-rest);
    ctx.translate(-shoulderX, -shoulderY);
    ctx.beginPath();
    outline();
    ctx.clip();
    drawImage();
    ctx.restore();
  }
  drawArm();
  drawWeapon([shoulderX + Math.cos(angle) * reach, shoulderY + Math.sin(angle) * reach], drawArm);
}
