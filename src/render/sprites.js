import { drawStillAttack } from './still-attacks.js';
import { applyFighterMotion, drawLowStride } from './fighter-motion.js';
import { drawPoseSheet } from './pose-sheet.js';

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
  if (fighter.hp <= 0) return 'ko';
  if (fighter.freezeFrames || fighter.hitstun || fighter.guardBreak) return 'hit';
  if (fighter.attack) return fighter.attack.animation ?? attackClips[fighter.attack.id]?.[0] ?? fighter.attack.id;
  if (fighter.dash) return fighter.dash.roll ? 'roll' : 'dash';
  if (!fighter.onGround) return 'jump';
  if (fighter.blocking) return 'block';
  if (fighter.charging) return 'charge';
  if (fighter.crouching) return fighter.moving ? 'crouchWalk' : 'crouch';
  return fighter.moving ? 'run' : 'idle';
}

function selectFrame({ frames, strikeFrame }, fighter, name, elapsed) {
  const attack = fighter.attack;
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

export function createSpriteRenderer(ctx, characters) {
  const sheets = new Map();
  const evolvedStills = new Map();
  const clocks = new WeakMap();
  for (const [id, character] of Object.entries(characters)) {
    const paths = character.sprite;
    if (paths?.still) {
      const sheet = {};
      sheets.set(id, sheet);
      if (paths.poseSheet) sheet.posePath = paths.poseSheet;
      else loadImage(paths.still).then(image => { sheet.still = image; }).catch(() => {});
      const evolved = character.awakening?.levelTwo?.evolution?.sprite;
      if (evolved) loadImage(evolved).then(image => evolvedStills.set(id, image)).catch(() => {});
      sheet.extraPath = paths.extraPoses;
      sheet.evolvedPath = character.awakening?.levelTwo?.evolution?.poseSheet;
      continue;
    }
    if (!paths?.atlas) continue;
    loadAtlas(paths.atlas, paths.image)
      .then(sheet => sheets.set(id, sheet))
      .catch(() => {}); // The colored placeholder remains available.
  }

  return function draw(fighter, ground, animationTime) {
    const name = animationName(fighter);
    let clock = clocks.get(fighter);
    if (!clock) {
      clock = { name, start: animationTime, last: animationTime, crouch: 0 };
      clocks.set(fighter, clock);
    }
    if (clock.name !== name) {
      clock.name = name;
      clock.start = animationTime;
    }
    const delta = Math.max(0, animationTime - clock.last);
    clock.last = animationTime;
    clock.crouch = name === 'crouch'
      ? Math.min(1, clock.crouch + delta / 55)
      : 0;
    const sheet = sheets.get(fighter.characterId);
    if (sheet?.posePath) {
      loadImage(sheet.posePath).then(image => { sheet.poses = image; }).catch(() => {});
      sheet.posePath = null;
    }
    if (sheet?.extraPath) {
      loadImage(sheet.extraPath).then(image => { sheet.extras = image; }).catch(() => {});
      sheet.extraPath = null;
    }
    const evolved = fighter.evolving && fighter.awakeningLevel === 2 && fighter.evolution?.sprite;
    if (evolved && sheet?.evolvedPath) {
      loadImage(sheet.evolvedPath).then(image => { sheet.evolved = image; }).catch(() => {});
      sheet.evolvedPath = null;
    }
    if (sheet?.still || sheet?.poses) {
      const poses = evolved && sheet.evolved ? sheet.evolved : sheet.poses;
      const image = evolved && !sheet.evolved ? evolvedStills.get(fighter.characterId) ?? sheet.still : sheet.still;
      const height = fighter.sprite.displaySize;
      const attack = fighter.attack;
      const sway = fighter.moving ? Math.sin(fighter.walkDistance / 9) : Math.sin(animationTime / 170) * .35;
      ctx.save();
      ctx.translate(fighter.x, ground + fighter.y);
      ctx.scale(attack?.facing ?? fighter.dash?.facing ?? fighter.facing, 1);
      if (name === 'ko') ctx.rotate(-Math.PI / 2);
      else {
        applyFighterMotion(ctx, fighter, name, height, clock.crouch, Boolean(image));
        if (name === 'run' || name === 'idle') ctx.transform(1, 0, -.035 * sway, 1 + sway * .035, 0, 0);
      }
      if (fighter.invulnerable) ctx.globalAlpha = .78;
      if (fighter.flash > 0) ctx.filter = 'brightness(1.5)';
      if (!image) drawPoseSheet(ctx, poses, evolved ? null : sheet.extras, fighter, name, height);
      else {
        const width = height * image.width / image.height;
        const articulated = image === sheet.still && name !== 'hit' && name !== 'ko'
          && drawStillAttack(ctx, image, width, height, fighter);
        if (name === 'crouchWalk') {
          drawLowStride(ctx, image, 0, 0, image.width, image.height, -width / 2, -height, width, height, fighter.walkDistance);
        } else if (!articulated) ctx.drawImage(image, -width / 2, -height, width, height);
      }
      ctx.restore();
      return true;
    }
    const clips = sheet?.clips;
    const fallback = name === 'roll' ? 'dash' : name === 'charge' ? 'block' : attackClips[fighter.attack?.id]?.[0];
    const walk = name === 'crouchWalk' ? 'run' : name;
    const clip = clips?.get(walk) ?? clips?.get(fallback) ?? clips?.get('idle');
    if (!clip) return false;
    const elapsed = walk === 'run' ? fighter.walkDistance * (name === 'crouchWalk' ? 16 : 1000 / fighter.moveSpeed)
      : animationTime - clock.start;
    const entry = selectFrame(clip, fighter, walk, elapsed);
    const { x, y, w, h } = entry.frame;
    const source = entry.sourceSize ?? { w, h };
    const trim = entry.spriteSourceSize ?? { x: 0, y: 0 };
    const pivot = entry.pivot
      ? { x: entry.pivot.x * source.w, y: entry.pivot.y * source.h }
      : sheet.atlas.meta.pivotPixels ?? { x: source.w / 2, y: source.h };
    const scale = (characters[fighter.characterId].sprite?.displaySize ?? 128) / source.h;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(fighter.x, ground + fighter.y);
    ctx.scale((fighter.attack?.facing ?? fighter.dash?.facing ?? fighter.facing) < 0 ? -1 : 1, 1);
    applyFighterMotion(ctx, fighter, name, scale * source.h, clock.crouch, false);
    if (fighter.invulnerable) ctx.globalAlpha = .78;
    if (fighter.flash > 0) ctx.filter = 'brightness(1.5)';
    ctx.drawImage(sheet.image, x, y, w, h,
      Math.round((trim.x - pivot.x) * scale), Math.round((trim.y - pivot.y) * scale), w * scale, h * scale);
    ctx.restore();
    return true;
  };
}
