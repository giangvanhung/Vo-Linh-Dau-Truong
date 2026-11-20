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
    })) clips.set(name, frames);
  }
  return { atlas, image, clips };
}

export function animationName(fighter) {
  if (fighter.hp <= 0) return 'ko';
  if (fighter.freezeFrames || fighter.hitstun || fighter.guardBreak) return 'hit';
  if (fighter.attack) return fighter.attack.animation ?? attackClips[fighter.attack.id]?.[0] ?? fighter.attack.id;
  if (fighter.dash) return 'dash';
  if (!fighter.onGround) return 'jump';
  if (fighter.blocking) return 'block';
  if (fighter.crouching) return 'crouch';
  return fighter.moving ? 'run' : 'idle';
}

function selectFrame(frames, fighter, name, elapsed) {
  const attack = fighter.attack;
  if (attack && (attack.animation ?? attackClips[attack.id]?.[0]) === name) {
    const strike = Math.min(attack.strikeFrame ?? attackClips[attack.id]?.[1] ?? 0, frames.length - 1);
    if (fighter.attackActive) return frames[strike];
    if (attack.elapsed < attack.startup) {
      return frames[Math.floor(attack.elapsed * strike / attack.startup)];
    }
    const recovery = attack.elapsed - attack.startup - attack.active;
    const remaining = frames.length - strike - 1;
    return frames[strike + Math.min(remaining, 1 + Math.floor(recovery * remaining / attack.recovery))];
  }
  if (name === 'dash') return frames[Math.min(frames.length - 1, Math.floor(fighter.dash.elapsed * frames.length / fighter.dash.frames))];
  const durations = frames.map(frame => frame.duration > 0 ? frame.duration : 100);
  const length = durations.reduce((sum, duration) => sum + duration, 0);
  let time = ['idle', 'run'].includes(name) ? elapsed % length : Math.min(elapsed, length - 1);
  return frames[durations.findIndex(duration => (time -= duration) < 0)];
}

export function createSpriteRenderer(ctx, characters) {
  const sheets = new Map();
  const clocks = new WeakMap();
  for (const [id, character] of Object.entries(characters)) {
    const paths = character.sprite;
    if (!paths?.atlas) continue;
    loadAtlas(paths.atlas, paths.image)
      .then(sheet => sheets.set(id, sheet))
      .catch(() => {}); // The colored placeholder remains available.
  }

  return function draw(fighter, ground, animationTime) {
    const name = animationName(fighter);
    let clock = clocks.get(fighter);
    if (!clock || clock.name !== name) {
      clock = { name, start: animationTime };
      clocks.set(fighter, clock);
    }
    const sheet = sheets.get(fighter.characterId);
    const frames = sheet?.clips.get(name);
    if (!frames) return false;
    const entry = selectFrame(frames, fighter, name, animationTime - clock.start);
    const { x, y, w, h } = entry.frame;
    const source = entry.sourceSize ?? { w, h };
    const trim = entry.spriteSourceSize ?? { x: 0, y: 0 };
    const pivot = entry.pivot
      ? { x: entry.pivot.x * source.w, y: entry.pivot.y * source.h }
      : sheet.atlas.meta.pivotPixels ?? { x: source.w / 2, y: source.h };
    const scale = (characters[fighter.characterId].sprite?.displaySize ?? 128) / source.h;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(fighter.x), Math.round(ground + fighter.y));
    ctx.scale((fighter.attack?.facing ?? fighter.dash?.facing ?? fighter.facing) < 0 ? -1 : 1, 1);
    if (fighter.dash?.roll) {
      const progress = fighter.dash.elapsed / fighter.dash.frames;
      const tuck = Math.sin(Math.PI * progress);
      ctx.translate(0, -scale * (source.h - 24 * tuck) * .37);
      ctx.rotate(progress * 2 * Math.PI);
      ctx.scale(1 - .24 * tuck, 1 - .35 * tuck);
      ctx.translate(0, scale * source.h * .37);
    }
    if (fighter.invulnerable) ctx.globalAlpha = .78;
    if (fighter.flash > 0) ctx.filter = 'brightness(1.5)';
    ctx.drawImage(sheet.image, x, y, w, h,
      Math.round((trim.x - pivot.x) * scale), Math.round((trim.y - pivot.y) * scale), w * scale, h * scale);
    ctx.restore();
    return true;
  };
}
