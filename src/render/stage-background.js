import { loadImage } from './sprites.js';

const stagePropsPath = '/assets/backgrounds/stage-props.png';
// Pixel crops for the transparent scenery atlas.
const propCrops = {
  rooftop: [14, 6, 276, 288],
  ice: [292, 0, 306, 295],
  cloud: [624, 0, 236, 298],
  forge: [885, 89, 293, 198],
  lava: [1179, 11, 306, 279],
  observatory: [1503, 0, 257, 289],
  market: [0, 324, 293, 254],
  crossroads: [295, 299, 297, 284],
  meadow: [592, 359, 295, 223],
  hoian: [888, 308, 291, 274],
  paris: [1180, 306, 307, 274],
  route66: [1547, 291, 189, 293],
  football: [0, 650, 302, 218],
  harbor: [302, 654, 301, 220],
  terrace: [603, 642, 285, 233],
  skybridge: [894, 584, 278, 292],
  sunken: [1178, 609, 310, 263],
  parking: [1507, 599, 244, 283],
};

function drawStageProps(ctx, image, stage, art, width, height) {
  const [sx, sy, sw, sh] = propCrops[stage.prop];
  stage.props.forEach(([position, depth, size], index) => {
    const x = width * position;
    const y = art.y + art.height * depth;
    const tall = Math.min(art.height * size, height * .16);
    const wide = tall * sw / sh;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(index % 2 ? -1 : 1, 1);
    ctx.fillStyle = 'rgba(11, 9, 16, .40)';
    ctx.beginPath();
    ctx.ellipse(0, 0, wide * .43, Math.max(1, tall * .055), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(image, sx, sy, sw, sh, -wide / 2, -tall, wide, tall);
    ctx.restore();
  });
}

function drawLanternLight(ctx, lanterns, art, ground, height, time) {
  const colors = ['255, 174, 91', '255, 147, 83'];
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  lanterns.forEach(([u, v], index) => {
    const x = art.x + art.width * u;
    const y = art.y + art.height * v;
    const warm = colors[index % colors.length];
    const flicker = .94 + .04 * Math.sin(time / 164 + index * 2) + .02 * Math.sin(time / 69 + index);
    const radius = art.height * .134;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, radius);
    halo.addColorStop(0, 'rgba(255, 234, 182, .82)');
    halo.addColorStop(.16, 'rgba(255, 199, 125, .49)');
    halo.addColorStop(.5, 'rgba(' + warm + ', .17)');
    halo.addColorStop(1, 'transparent');
    ctx.globalAlpha = flicker;
    ctx.fillStyle = halo;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

    // Keep the soft reflection on the floor and stretch it with perspective.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, ground, ctx.canvas.width, Math.max(0, height - ground));
    ctx.clip();
    const spillX = art.x + art.width * (u < .5 ? u + .19 : u - .19);
    ctx.translate(spillX, ground + art.height * .075);
    ctx.scale(art.width * .34, art.height * .16);
    const spill = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    spill.addColorStop(0, 'rgba(' + warm + ', .34)');
    spill.addColorStop(.42, 'rgba(' + warm + ', .19)');
    spill.addColorStop(1, 'transparent');
    ctx.fillStyle = spill;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  });
  ctx.restore();
}

function drawRooftopSigns(ctx, signs, art, ground, time) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  signs.forEach(([u, v, color], index) => {
    const x = art.x + art.width * u;
    const y = art.y + art.height * v;
    const radius = art.height * .126;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    glow.addColorStop(0, color + 'c0');
    glow.addColorStop(.38, color + '62');
    glow.addColorStop(1, color + '00');
    ctx.save();
    ctx.globalAlpha = .89 + .1 * Math.sin(time / 224 + index * 2);
    ctx.translate(x, y);
    ctx.scale(radius * .7, radius * 1.45);
    ctx.fillStyle = glow;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
    ctx.save();
    ctx.translate(x, ground + art.height * .08);
    ctx.scale(radius * 1.14, radius * .65);
    ctx.globalAlpha = .44;
    ctx.fillStyle = glow;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  });
  ctx.restore();
}

function drawRooftopMoon(ctx, width, ground) {
  const x = width * .57;
  const y = ground * .19;
  const radius = Math.max(11, Math.min(28, ground * .057, width * .06));
  const halo = ctx.createRadialGradient(x, y, radius * .65, x, y, radius * 3.1);
  halo.addColorStop(0, '#e8cbd66c');
  halo.addColorStop(.46, '#daa8bd30');
  halo.addColorStop(1, '#bc86ac00');
  ctx.save();
  ctx.fillStyle = halo;
  ctx.fillRect(x - radius * 3.1, y - radius * 3.1, radius * 6.2, radius * 6.2);
  const face = ctx.createRadialGradient(x - radius * .24, y - radius * .25, 0, x, y, radius);
  face.addColorStop(0, '#fff0de');
  face.addColorStop(.78, '#e7c9c7');
  face.addColorStop(1, '#c694b3');
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  const patches = [[-.29, -.15, .36, .22], [.23, .38, .28, .19], [.34, -.34, .24, .28], [-.33, .36, .17, .12]];
  ctx.fillStyle = '#95698440';
  for (const [u, v, w, h] of patches) {
    ctx.beginPath();
    ctx.ellipse(x + radius * u, y + radius * v, radius * w, radius * h, -.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawRainSky(ctx, width, ground, time) {
  drawRooftopMoon(ctx, width, ground);
  const span = width + 400;
  ctx.save();
  for (let cloud = 0; cloud < 5; cloud++) {
    const center = ((cloud * span / 5 + time * (.016 + .003 * cloud)) % span) - 200;
    const top = ground * (.10 + cloud % 3 * .095);
    for (let lobe = 0; lobe < 3; lobe++) {
      ctx.save();
      ctx.translate(center + (lobe - 1) * 68, top + Math.sin(lobe + cloud) * 15);
      ctx.scale(120 - lobe * 16, Math.max(13, ground * (.17 - .025 * lobe)));
      const bank = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      bank.addColorStop(0, cloud % 2 ? '#88788a62' : '#2019249c');
      bank.addColorStop(.64, cloud % 2 ? '#6d617450' : '#27202c60');
      bank.addColorStop(1, 'transparent');
      ctx.fillStyle = bank;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawRooftopTrees(ctx, image, art, ground) {
  const treeWidth = image.width * .43;
  for (const [u, size, facing] of [[.29, .34, 1], [.72, .32, -1]]) {
    const height = art.height * size;
    const width = treeWidth * height / image.height;
    ctx.save();
    ctx.globalAlpha = .88;
    ctx.translate(art.x + art.width * u, ground - art.height * .024);
    ctx.scale(facing, 1);
    ctx.drawImage(image, 0, 0, treeWidth, image.height, -width / 2, -height, width, height);
    ctx.restore();
  }
}

const rooftopSpectators = [
  [60, 13, 500, 565], [788, 107, 303, 472], [216, 598, 225, 633], [797, 586, 252, 636],
];

function drawRooftopSpectators(ctx, image, art, ground) {
  const draw = (u, feet, size, person) => {
    const [x, y, sourceWidth, sourceHeight] = rooftopSpectators[person];
    const height = art.height * size;
    const width = height * sourceWidth / sourceHeight;
    ctx.save();
    ctx.translate(art.x + art.width * u, feet);
    ctx.drawImage(image, x, y, sourceWidth, sourceHeight, -width / 2, -height, width, height);
    ctx.restore();
  };
  for (const [u, size, person, depth] of [
    [.202, .164, 0, .017], [.304, .132, 2, .009], [.372, .098, 1, .028],
    [.661, .097, 1, .026], [.735, .135, 3, .012], [.808, .126, 2, .018],
  ]) {
    draw(u, ground + art.height * depth, size, person);
  }

  ctx.save();
  const railingY = art.y + art.height * .331;
  ctx.beginPath();
  ctx.rect(art.x + art.width * .915, art.y + art.height * .235, art.width * .052, art.height * .096);
  ctx.clip();
  draw(.927, railingY + art.height * .033, .094, 2);
  draw(.949, railingY + art.height * .033, .1, 3);
  ctx.restore();
}

export function createStageBackground(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const images = new Map();
  let previous;
  let revision = 0;

  function load(path) {
    if (!path || images.has(path)) return;
    images.set(path, null);
    loadImage(path).then(image => {
      images.set(path, image);
      revision++;
    }).catch(error => console.warn(error));
  }

  function drawStage(stage, w, h, ground, center, lightTime) {
    const layers = stage.parallax.map(path => images.get(path));
    const composite = images.get(stage.background);
    ctx.fillStyle = '#191922';
    ctx.fillRect(0, 0, w, h);
    const floor = stage.artGroundRatio ?? .724;
    // Cover both sides of the floor line so cropping never moves it away from the fighters.
    const minHeight = Math.max(ground / floor, (h - ground) / (1 - floor));
    const bounds = (image, shift = 0, overscan = 1) => {
      const scale = Math.max(w * overscan / image.width, minHeight / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      const x = (w - width) / 2 + shift;
      const y = ground - height * floor;
      return { x, y, width, height };
    };
    const draw = (image, art) => ctx.drawImage(image, art.x, art.y, art.width, art.height);
    const scenery = images.get(stage.railingScenery);
    const spectators = images.get(stage.spectators);
    let lanternArt;
    if (layers.length && layers.every(Boolean)) {
      layers.forEach((image, index) => {
        const shift = (w / 2 - center) * [.035, .075, .12][index];
        const art = bounds(image, Math.max(-w * .05, Math.min(w * .05, shift)), 1.10);
        if (index === 1 && scenery) drawRooftopTrees(ctx, scenery, art, art.y + art.height * .724);
        draw(image, art);
        if (index === 0 && stage.weather === 'rain') drawRainSky(ctx, w, ground, lightTime);
        if (index === 1) lanternArt = art;
      });
      if (spectators && lanternArt) {
        drawRooftopSpectators(ctx, spectators, lanternArt, lanternArt.y + lanternArt.height * .724);
      }
    } else if (composite || layers[0]) {
      const image = composite ?? layers[0];
      const art = bounds(image);
      draw(image, art);
      if (composite) lanternArt = art;
      if (stage.weather === 'rain') drawRainSky(ctx, w, ground, lightTime);
    } else {
      ctx.fillStyle = '#302b37';
      ctx.fillRect(0, ground, w, h - ground);
    }
    const props = images.get(stagePropsPath);
    if (props && stage.props && propCrops[stage.prop] && lanternArt) {
      drawStageProps(ctx, props, stage, lanternArt, w, h);
    }
    ctx.fillStyle = 'rgba(12, 13, 22, .29)';
    ctx.fillRect(0, 0, w, h);
    if (stage.lanterns && lanternArt) drawLanternLight(ctx, stage.lanterns, lanternArt, ground, h, lightTime);
    if (stage.signs && lanternArt) drawRooftopSigns(ctx, stage.signs, lanternArt, ground, lightTime);
  }

  return (stage, floor, centerRatio, time) => {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    load(stage.background);
    load(stage.railingScenery);
    load(stage.spectators);
    if (stage.props) load(stagePropsPath);
    for (const path of stage.parallax) load(path);
    const moving = stage.parallax.length > 0 && stage.parallax.every(path => images.get(path));
    const center = moving ? centerRatio * width : width / 2;
    const lightTime = stage.lanterns ? Math.floor(time / 60) * 60 : 0;
    if (previous && previous.background === stage.background && previous.parallax === stage.parallax
      && previous.ratio === stage.artGroundRatio && previous.width === width && previous.height === height
      && previous.floor === floor && previous.center === center && previous.revision === revision
      && previous.lanterns === stage.lanterns && previous.signs === stage.signs
      && previous.weather === stage.weather && previous.railingScenery === stage.railingScenery
      && previous.spectators === stage.spectators
      && previous.props === stage.props
      && previous.lightTime === lightTime) return;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    drawStage(stage, width, height, floor, center, lightTime);
    previous = { background: stage.background, parallax: stage.parallax, ratio: stage.artGroundRatio,
      width, height, floor, center, revision, lanterns: stage.lanterns, signs: stage.signs, weather: stage.weather,
      railingScenery: stage.railingScenery, spectators: stage.spectators, props: stage.props, lightTime };
  };
}
