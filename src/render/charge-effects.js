const tau = Math.PI * 2;
const spiritFighters = new Set(['linh', 'vy', 'lam', 'diep', 'fox', 'dragon', 'shadow']);
const blessingFighters = new Set(['elf', 'jackal']);

function drawMaiWind(ctx, time, strength, color, height) {
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const progress = (time / 700 + i / 6) % 1;
    const radius = 18 + progress * 43;
    const y = -progress * height * .9;
    const angle = (i % 2 ? Math.PI : 0) + progress * 2.8;
    ctx.globalAlpha = Math.sin(progress * Math.PI) * strength * .72;
    ctx.strokeStyle = i % 3 === 0 ? '#ebfcff' : color;
    ctx.lineWidth = 2.4 - progress;
    ctx.beginPath();
    ctx.ellipse(0, y, radius, 7 + progress * 7, -.23, angle, angle + 1.55);
    ctx.stroke();
  }
}

function drawHungCharge(ctx, fighter, time, strength, color) {
  const height = fighter.height * (1.03 + strength * .12);
  const width = fighter.width * (1.05 + strength * .35);
  const flicker = Math.sin(Math.floor(time / 35) * 2.4);
  const facing = fighter.attack?.facing ?? fighter.dash?.facing ?? fighter.facing;
  ctx.scale(facing, 1);
  const glow = ctx.createLinearGradient(0, 0, 0, -height);
  glow.addColorStop(0, '#fff2a6');
  glow.addColorStop(.48, color);
  glow.addColorStop(1, '#ff7a2425');
  ctx.globalAlpha = strength * .47;
  ctx.fillStyle = glow;
  ctx.strokeStyle = '#ffd784';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-width * .75, -2);
  ctx.lineTo(-width * 1.13, -height * .47);
  ctx.lineTo(-width * .76, -height * .37);
  ctx.lineTo(-width * (.83 + flicker * .09), -height * .88);
  ctx.lineTo(-width * .44, -height * .69);
  ctx.lineTo(-width * .19, -height * 1.07);
  ctx.lineTo(width * .12, -height * .82);
  ctx.lineTo(width * .52, -height * (.98 - flicker * .05));
  ctx.lineTo(width * .58, -height * .56);
  ctx.lineTo(width * 1.16, -height * .76);
  ctx.lineTo(width * .94, -height * .33);
  ctx.lineTo(width * 1.18, -height * .38);
  ctx.lineTo(width * .68, -2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 10; i++) {
    const age = (time / 310 + i * .27) % 1;
    const side = i % 2 ? 1 : -1;
    const x = side * width * (.55 + (i % 4) * .13 + age * .28);
    const y = -age * height * .85;
    ctx.globalAlpha = (1 - age) * strength;
    ctx.strokeStyle = i % 3 ? '#ff9b48' : '#fff4b9';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + side * (7 + age * 8), y - 10 - age * 15);
    ctx.stroke();
  }
  const wave = (time / 430) % 1;
  ctx.globalAlpha = (1 - wave) * strength * .8;
  ctx.strokeStyle = '#ffe2a4';
  ctx.beginPath();
  ctx.ellipse(0, -2, width * (.6 + wave * .85), 4 + wave * 7, 0, 0, tau);
  ctx.stroke();
}

function drawSpirit(ctx, time, strength, color, height) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = strength * .75;
  ctx.beginPath();
  ctx.ellipse(0, -3, 35 + strength * 14, 8, 0, 0, tau);
  ctx.stroke();

  const center = -height * .56;
  for (let i = 0; i < 10; i++) {
    const progress = (time / 740 + i / 10) % 1;
    const radius = (1 - progress) * (57 + strength * 24);
    const angle = i * tau / 10 + progress * 2.7 + time / 1600;
    const x = Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius * .63;
    ctx.globalAlpha = Math.sin(progress * Math.PI) * strength;
    ctx.strokeStyle = i % 3 ? color : '#e7fff7';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - Math.sin(angle) * 17, y + Math.cos(angle) * 11, x * .69, center + (y - center) * .69);
    ctx.stroke();
  }
}

function drawBlessing(ctx, time, strength, color, height) {
  const top = -height * 1.34;
  const beam = ctx.createLinearGradient(0, top, 0, 0);
  beam.addColorStop(0, '#fff1bc');
  beam.addColorStop(.38, color);
  beam.addColorStop(1, 'transparent');
  ctx.fillStyle = beam;
  ctx.globalAlpha = .34 * strength;
  ctx.beginPath();
  ctx.moveTo(-10, top);
  ctx.lineTo(10, top);
  ctx.lineTo(36, 0);
  ctx.lineTo(-36, 0);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#ffe4a0';
  ctx.globalAlpha = .8 * strength;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const haloWidth = 22 + Math.sin(time / 190) * 3;
  ctx.ellipse(0, top, haloWidth, 5, 0, 0, tau);
  ctx.moveTo(39, -2);
  ctx.ellipse(0, -2, 39, 8, 0, 0, tau);
  ctx.stroke();

  ctx.fillStyle = '#fff4d2';
  for (let i = 0; i < 9; i++) {
    const progress = (time / 870 + i / 9) % 1;
    const x = Math.sin(i * 2.4 + time / 440) * (9 + progress * 24);
    const y = top * (1 - progress);
    ctx.globalAlpha = Math.sin(progress * Math.PI) * strength;
    ctx.fillRect(x - 3, y, 6, 1);
    ctx.fillRect(x, y - 3, 1, 7);
  }
}

export function drawChargeVariant(ctx, fighter, time, build, color) {
  const id = fighter.characterId;
  const strength = Math.min(1, .2 + build * .8);
  if (id === 'hung') drawHungCharge(ctx, fighter, time, strength, color);
  else if (id === 'mai') drawMaiWind(ctx, time, strength, color, fighter.height);
  else if (fighter.chargeStyle === 'pressure' && fighter.charging) {
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const phase = (time / 630 + i / 3) % 1;
      ctx.globalAlpha = (1 - phase) * strength;
      ctx.strokeStyle = i === 1 ? '#f24a70' : '#a773ff';
      ctx.beginPath();
      ctx.ellipse(0, -2, 20 + 145 * phase, 4 + 23 * phase, 0, 0, tau);
      ctx.stroke();
    }
    ctx.globalAlpha = strength;
    ctx.strokeStyle = '#ff6488';
    for (const side of [-1, 1]) {
      const x = side * (25 + Math.sin(time / 55 + side) * 8);
      ctx.beginPath();
      ctx.moveTo(x * 1.5, -fighter.height * .87);
      ctx.lineTo(x * .85, -fighter.height * .58);
      ctx.lineTo(x * 1.35, -fighter.height * .48);
      ctx.lineTo(x, -fighter.height * .23);
      ctx.stroke();
    }
  } else if (spiritFighters.has(id)) drawSpirit(ctx, time, strength, color, fighter.height);
  else if (blessingFighters.has(id)) drawBlessing(ctx, time, strength, color, fighter.height);
  else return false;
  return true;
}
