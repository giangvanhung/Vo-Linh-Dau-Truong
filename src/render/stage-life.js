export function drawStageLife(ctx, kind, time, width, ground) {
  if (!kind) return;
  ctx.save();
  if (kind === 'sea') {
    for (let i = 0; i < 25; i++) {
      const x = ((time * .64 + i * 67) % (width + 80)) - 40;
      const y = ground - 104 - (i % 4) * 16 + Math.sin(time / 26 + i * .7) * 10;
      ctx.fillStyle = i % 3 ? '#b7eef2' : '#82bbe0';
      ctx.globalAlpha = .28;
      ctx.beginPath();
      ctx.ellipse(x, y, 5 + i % 5, 2.1, 0, 0, Math.PI * 2);
      ctx.moveTo(x - 4, y);
      ctx.lineTo(x - 11, y - 4);
      ctx.lineTo(x - 11, y + 4);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = .34;
      ctx.strokeStyle = '#b8fbff';
      const bubbleX = (i * 139) % width + Math.sin(time / 18 + i) * 5;
      const bubbleY = ground - 13 - (time * (.35 + i % 3 * .12) + i * 29) % 245;
      ctx.beginPath();
      ctx.arc(bubbleX, bubbleY, 1.5 + i % 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    plants(ctx, width, ground, time, '#62a7a2', '#cfa2c8');
  } else {
    const birds = kind === 'garden' ? 7 : 11;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    for (let i = 0; i < birds; i++) {
      const pale = kind === 'sky' && i < 6;
      const x = ((i * 131 + time * (pale ? .72 : .44)) % (width + 96)) - 48;
      const baseY = kind === 'urban' ? ground * .23 - i % 5 * 12 : ground - 201 - i % 5 * 18;
      const y = baseY + Math.sin(time / 33 + i * .6) * 8;
      const flap = 4 * Math.sin(time / 6 + i * .8);
      ctx.strokeStyle = pale ? '#fff8e6' : '#181a27';
      ctx.globalAlpha = pale ? .7 : .62;
      ctx.beginPath();
      ctx.moveTo(x - 9, y + flap);
      ctx.quadraticCurveTo(x - 5, y - 4, x, y);
      ctx.quadraticCurveTo(x + 5, y - 4, x + 9, y + flap);
      ctx.stroke();
    }
    ctx.strokeStyle = '#dff3ec';
    ctx.globalAlpha = .18;
    for (let i = 0; i < (kind === 'urban' ? 0 : 13); i++) {
      const x = ((i * 151 + time * (1.2 + i % 4 * .22)) % (width + 76)) - 38;
      const y = ground - 40 - i % 7 * 19 + Math.sin(time / 32 + i) * 10;
      ctx.beginPath();
      ctx.moveTo(x - 18, y + 1);
      ctx.quadraticCurveTo(x, y - 5, x + 10, y);
      ctx.stroke();
    }
    if (kind === 'urban') cat(ctx, width, ground, time);
    plants(ctx, width, ground, time, kind === 'urban' ? '#777e52' : '#8ba85c', '#e2a3a5');
  }
  ctx.restore();
}

export function drawStageRain(ctx, width, ground, time, foreground = false) {
  const slope = -.22; // The rain painted into the rooftop sky leans down to the left.
  const count = Math.ceil(width / (foreground ? 29 : 21));
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const hitY = ground + (foreground ? 5 + i * 13 % 70 : -10 - i * 11 % 29);
    const speed = foreground ? .83 + i % 7 * .075 : .47 + i % 5 * .052;
    const fallTime = (hitY + 24) / speed;
    const splashTime = foreground && i % 3 !== 0 ? 144 : 0;
    const cycleTime = fallTime + splashTime + 55 + i * 17 % 150;
    const clock = time + i * 167.3;
    const age = clock % cycleTime;
    const cycle = Math.floor(clock / cycleTime);
    const seed = Math.sin(i * 127.1 + cycle * 311.7 + (foreground ? 51.3 : 0)) * 43758.54;
    const hitX = (seed - Math.floor(seed)) * (width + 60) - 30;
    const y = age * speed - 24;
    if (age < fallTime && y > 0) {
      const x = hitX + (y - hitY) * slope;
      const length = Math.min(y, speed * (12 + i * 7 % 15));
      const tailX = x - length * slope;
      const fade = Math.min(1, y / 28, (hitY - y + 3) / 18);
      ctx.globalAlpha = fade * (foreground ? .27 + i % 4 * .035 : .17 + i % 4 * .025);
      ctx.strokeStyle = foreground ? '#d6bdcf' : '#aa889d';
      ctx.lineWidth = foreground ? 1 + i % 3 * .15 : .75;
      ctx.beginPath();
      ctx.moveTo(tailX, y - length);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (splashTime && age >= fallTime && age < fallTime + splashTime) {
      const spread = (age - fallTime) / splashTime;
      ctx.globalAlpha = .42 * (1 - spread);
      ctx.strokeStyle = '#f0cddc';
      ctx.lineWidth = .8;
      ctx.beginPath();
      ctx.ellipse(hitX, hitY, 1 + spread * 5.5, .45 + spread * 1.2, 0, 0, 2 * Math.PI);
      if (spread < .46) {
        const lift = Math.sin(spread / .46 * Math.PI) * 3;
        ctx.moveTo(hitX - 2.5, hitY - lift);
        ctx.lineTo(hitX - 3.5, hitY - lift - 1.5);
        ctx.moveTo(hitX + 1.5, hitY - lift);
        ctx.lineTo(hitX + 2.5, hitY - lift - 1);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function plants(ctx, width, ground, time, leaves, petals) {
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 20; i++) {
    const x = i % 2 ? 16 + i * 3 : width - 16 - i * 3;
    const height = 9 + (i * 17) % 18;
    const sway = Math.sin(time / 20 + i * 1.7) * 6;
    ctx.globalAlpha = .44;
    ctx.strokeStyle = leaves;
    ctx.beginPath();
    ctx.moveTo(x, ground + 4);
    ctx.quadraticCurveTo(x - sway / 2, ground - height / 2, x + sway, ground - height);
    ctx.stroke();
    if (i % 4 === 0) {
      ctx.fillStyle = petals;
      ctx.beginPath();
      ctx.arc(x + sway, ground - height, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function cat(ctx, width, ground, time) {
  const travel = (time * .31) % (width * 1.6);
  const x = travel < width * .8 ? width * .1 + travel : width * 1.7 - travel;
  ctx.save();
  ctx.translate(x, ground - 64);
  ctx.scale(travel < width * .8 ? 1 : -1, 1);
  ctx.globalAlpha = .69;
  ctx.fillStyle = ctx.strokeStyle = '#2c2632';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2);
  ctx.moveTo(7, -2);
  ctx.lineTo(8, -8);
  ctx.lineTo(11, -5);
  ctx.lineTo(14, -8);
  ctx.lineTo(15, 0);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.quadraticCurveTo(-17, Math.sin(time / 16) * 5 - 5, -16, -10);
  ctx.moveTo(-5, 3);
  ctx.lineTo(-5 + Math.sin(time / 5) * 2, 7);
  ctx.moveTo(5, 3);
  ctx.lineTo(5 - Math.sin(time / 5) * 2, 7);
  ctx.stroke();
  ctx.restore();
}

export function drawMorph(ctx, fighter, ground, time) {
  ctx.save();
  ctx.translate(fighter.x, ground + fighter.y - (fighter.moving ? Math.abs(Math.sin(time / 68)) * 5 : 0));
  ctx.scale(fighter.facing, 1);
  ctx.fillStyle = '#d3a0e8';
  ctx.beginPath();
  ctx.ellipse(-17, -9, 6, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffeaf8';
  ctx.beginPath();
  ctx.ellipse(-2, -12, 17, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(10, -22, 10, 10, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -36, 4, 12, -.32, 0, Math.PI * 2);
  ctx.ellipse(13, -37, 4, 12, -.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#68476f';
  ctx.beginPath();
  ctx.arc(14, -24, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawStageCondition(ctx, fighter, ground, time) {
  const effect = fighter.stageCondition;
  if (!effect) return;
  const size = effect.kind === 'morph' ? .55 : 1;
  ctx.save();
  ctx.translate(fighter.x, ground + fighter.y);
  ctx.strokeStyle = ctx.fillStyle = effect.color;
  ctx.globalAlpha = .72;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -1, 31 * size, 6, 0, 0, 2 * Math.PI);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const angle = i * 1.26 + time / 150;
    const x = Math.cos(angle) * 28 * size;
    const y = -(14 + (time / 17 + i * 17) % 53) * size;
    ctx.fillRect(Math.round(x), Math.round(y), 3, 3);
  }
  ctx.restore();
}
