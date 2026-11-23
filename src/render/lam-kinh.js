import { applyKickBalance, strikePose } from './fighter-motion.js';

export function drawLamKinh(ctx, fighter, pose, ground, time, drawWeapon) {
  const attack = fighter.attack;
  const motion = attack ? Math.max(0, strikePose(attack)) : 0;
  const stomping = attack?.id === 'closeSkill' && attack.radial;
  const kicking = attack?.id === 'kick' || attack?.kickStyle;
  const stride = fighter.moving ? Math.sin(fighter.walkDistance / 12) : 0;
  const preparing = stomping && attack.elapsed < attack.startup;
  const crouch = pose === 'crouch' || pose === 'crouchWalk' || (pose === 'block' && fighter.crouching);
  const kickHeight = attack?.kickStyle === 'rise' ? 43 : attack?.lowStance ? 9 : 20;
  const lift = preparing ? Math.min(17, attack.elapsed) : kickHeight * motion * Number(kicking);
  const steel = '#305676';
  const shade = '#11283e';
  const light = '#9befff';
  const plate = (points, color) => {
    ctx.beginPath();
    for (const [x, y] of points) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const box = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  ctx.save();
  ctx.translate(fighter.x, ground + fighter.y);
  ctx.scale(attack?.facing ?? fighter.facing, crouch || attack?.lowStance ? .66 : 1);
  applyKickBalance(ctx, attack);
  if (pose === 'ko' || pose === 'knockdown') ctx.rotate(-1.4);

  if (stomping) {
    const impact = attack.elapsed - attack.startup;
    ctx.globalAlpha = preparing ? .25 + attack.elapsed / 80 : Math.max(0, .6 - impact / 20);
    ctx.strokeStyle = light;
    ctx.lineWidth = preparing ? 1 : 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, preparing ? 79 : 32 + Math.min(47, impact * 7), 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  for (const side of [-1, 1]) {
    const x = side * (16 + stride * 8) + Number(side > 0 && kicking) * motion * 40;
    const foot = side > 0 ? -lift : 0;
    plate([[side * 16 - 9, -50], [side * 16 + 9, -50], [x + 9, foot - 11], [x - 10, foot - 11]], side > 0 ? steel : shade);
    plate([[x - 11, foot - 12], [x + 14, foot - 12], [x + 20, foot - 5], [x + 20, foot], [x - 13, foot]], shade);
    box(x - 3, foot - 17, 10, 4, '#72bcc9');
  }
  plate([[-28, -101], [22, -104], [33, -80], [24, -49], [-18, -49], [-33, -74]], shade);
  plate([[-23, -94], [25, -92], [29, -74], [18, -60], [-18, -60]], steel);
  box(-18, -60, 36, 5, '#5b90ad');

  // The pilot remains visible behind the rim of the clear canopy.
  plate([[-23, -101], [-14, -131], [15, -132], [28, -112], [22, -95], [-17, -95]], '#57b4cf');
  plate([[-18, -101], [-10, -125], [12, -126], [23, -111], [18, -100]], '#142f51');
  box(-8, -106, 20, 9, '#31567c');
  box(-5, -121, 13, 13, '#17283d');
  box(0, -117, 9, 8, '#e7ad93');
  box(3, -115, 9, 2, light);
  box(10, -105, 8, 3, light);
  box(-10, -124, 13, 2, '#b7f7ff');
  box(-27, -93, 8, 4, Math.sin(time / 105) > 0 ? light : '#5b90ad');

  const reach = stomping || kicking ? 0 : motion * (attack?.id === 'ultimate' ? 91 : attack?.id === 'rangedSkill' ? 74 : 41);
  const hand = [35 + reach, -62 - motion * 13];
  plate([[16, -85], [31, -87], [hand[0] + 8, hand[1] - 9], [hand[0] + 3, hand[1] + 11],
    [hand[0] - 11, hand[1] + 8], [19, -68]], steel);
  box(hand[0] - 9, hand[1] - 7, 17, 13, shade);
  box(hand[0] - 4, hand[1] - 8, 11, 3, light);
  if (fighter.weapon || fighter.weaponUses) drawWeapon(hand);
  const deployment = fighter.formAge / 14;
  if (deployment < 1) {
    ctx.globalAlpha = (1 - deployment) * .56;
    box(-40, -132 + deployment * 128, 82, 3, light);
    box(-41, -132, 2, 132, light);
    box(41, -132, 2, 132, light);
  }
  ctx.restore();
}
