import { strikePose } from './fighter-motion.js';

export function drawNewFighter(ctx, fighter, name, ground, time, drawWeapon) {
  const { index } = fighter.prototypeStyle;
  const attack = fighter.attack;
  const swing = attack ? Math.max(0, strikePose(attack)) : 0;
  const kicking = attack?.id === 'kick';
  const rear = attack?.limbSide === 'right';
  const walk = fighter.moving ? Math.sin(fighter.walkDistance / 10) : 0;
  const idle = name === 'idle' ? Math.sin(time / 175) * 1.2 : 0;
  const hero = fighter.heroFrames > 0;
  const fabric = hero ? '#334e96' : fighter.color;
  const trim = hero ? fighter.heroForm.color : fighter.glow;
  const hand = [17, -61 + idle];
  const dark = '#232238';
  ctx.save();
  ctx.translate(fighter.x, ground + fighter.y);
  ctx.scale(attack?.facing ?? fighter.facing, 1);
  if (name === 'ko' || name === 'knockdown') ctx.rotate(-1.4);
  if (name === 'crouch' || name === 'crouchWalk') ctx.scale(1, .76);
  if (name === 'hit') ctx.transform(1, 0, .12, 1, 0, 0);
  if (hero) {
    ctx.strokeStyle = trim;
    ctx.globalAlpha = .48;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, -51, 27 + Math.sin(time / 80) * 3, 53, 0, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const line = (points, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.stroke();
  };
  for (const side of [0, 1]) {
    const strike = kicking && Boolean(side) === rear ? swing : 0;
    const landing = [9 * (side ? 1 : -1) + 10 * walk * (side ? 1 : -1) + strike * (side ? 57 : 49), -4 - 41 * strike];
    line([[side ? 6 : -6, -39], [landing[0] * .52, -24 - strike * 14], landing], side ? fabric : dark, 10);
    line([landing, [landing[0] + 6, landing[1]]], dark, 6);
  }
  ctx.fillStyle = fabric;
  ctx.beginPath();
  ctx.moveTo(-15, -74 + idle);
  ctx.lineTo(13, -72 + idle);
  ctx.lineTo(13 + (index % 2 ? 4 : 10), -37);
  ctx.lineTo(-21, -36);
  ctx.closePath();
  ctx.fill();
  line([[-17, -45], [16, -45]], trim, 3);
  const skin = '#e7af94';
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(3, -85 + idle, 11, 13, .08, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = hero ? '#182750' : ['#1b756d','#31274e','#774531','#785581','#303f69','#212435'][index];
  ctx.beginPath();
  ctx.ellipse(1, -92 + idle, 14, 9, -.16, 0, 2 * Math.PI);
  ctx.fill();
  if (index === 0 || index === 3 || index === 4) line([[-9, -91], [-12, -81], [-18 - walk * 4, -67]], ctx.fillStyle, 7);
  line([[6, -86 + idle], [hero ? 14 : 10, -86 + idle]], hero ? trim : dark, hero ? 3 : 1.7);
  if (index === 2 || index === 5) line([[-9, -96], [10, -95]], trim, 3);
  if (index === 1 || index === 3) line([[-10, -74], [-22, -71 + walk * 8], [-30, -73]], trim, 4);
  for (const side of [0, 1]) {
    const strength = !kicking && Boolean(side) === rear ? swing : 0;
    const fist = [(side ? -8 : hand[0]) + strength * (side ? 60 : 37), hand[1] + (side ? 8 : 0) - strength * 5];
    line([[side ? -10 : 10, -69 + idle], [fist[0] * .62, -57 - strength * 9], fist], side ? dark : fabric, 8);
    line([[fist[0] - 2, fist[1]], fist], skin, 6);
    if (!side || strength > .3) hand.splice(0, 2, ...fist);
  }
  if (fighter.weapon || fighter.weaponUses) drawWeapon(hand);
  ctx.restore();
}
