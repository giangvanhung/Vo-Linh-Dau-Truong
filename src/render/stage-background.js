import { loadImage } from './sprites.js';

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

  function drawStage(stage, w, h, ground, center) {
    const layers = stage.parallax.map(path => images.get(path));
    const composite = images.get(stage.background);
    ctx.fillStyle = '#191922';
    ctx.fillRect(0, 0, w, h);
    const floor = stage.artGroundRatio ?? .724;
    // Cover both sides of the floor line so cropping never moves it away from the fighters.
    const minHeight = Math.max(ground / floor, (h - ground) / (1 - floor));
    const draw = (image, shift = 0, overscan = 1) => {
      const scale = Math.max(w * overscan / image.width, minHeight / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      const top = ground - height * floor;
      ctx.drawImage(image, (w - width) / 2 + shift, top, width, height);
    };
    if (layers.length && layers.every(Boolean)) {
      layers.forEach((image, index) => {
        const shift = (w / 2 - center) * [.035, .075, .12][index];
        draw(image, Math.max(-w * .05, Math.min(w * .05, shift)), 1.10);
      });
    } else if (composite || layers[0]) {
      draw(composite ?? layers[0], 0);
    } else {
      ctx.fillStyle = '#302b37';
      ctx.fillRect(0, ground, w, h - ground);
    }
    ctx.fillStyle = 'rgba(12, 13, 22, .29)';
    ctx.fillRect(0, 0, w, h);
  }

  return (stage, floor, centerRatio) => {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    load(stage.background);
    for (const path of stage.parallax) load(path);
    const moving = stage.parallax.length > 0 && stage.parallax.every(path => images.get(path));
    const center = moving ? centerRatio * width : width / 2;
    if (previous && previous.background === stage.background && previous.parallax === stage.parallax
      && previous.ratio === stage.artGroundRatio && previous.width === width && previous.height === height
      && previous.floor === floor && previous.center === center && previous.revision === revision) return;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    drawStage(stage, width, height, floor, center);
    previous = { background: stage.background, parallax: stage.parallax, ratio: stage.artGroundRatio,
      width, height, floor, center, revision };
  };
}
