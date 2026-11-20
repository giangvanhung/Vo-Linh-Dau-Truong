const tau = Math.PI * 2;
const spiritFighters = new Set(['linh', 'vy', 'lam', 'diep', 'fox', 'dragon', 'shadow']);
const blessingFighters = new Set(['mai', 'elf', 'jackal']);

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
  if (fighter.chargeStyle === 'pressure' && fighter.charging) {
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
