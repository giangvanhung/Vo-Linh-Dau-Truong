export const evolutionFist = '/assets/effects/hung-evolution-fist.png';
export const advancedAura = '/assets/effects/evolution-level-two.png';

export function createEvolutionEffects(ctx, images, drawFighter) {
  function drawEvolutionWings(fighter, ground, time) {
    const image = images.get(fighter.evolution.wings);
    if (!image) return;
    const pulse = Math.sin(time / 105);
    const progress = Math.min(1, (fighter.awakeningDuration - fighter.awakeningFrames + 1) / 12, fighter.awakeningFrames / 20);
    const width = fighter.height * (1.42 + pulse * .09) * (.62 + .38 * progress);
    const height = width * image.height / image.width;
    ctx.save();
    ctx.translate(fighter.x - fighter.facing * 8, ground + fighter.y - fighter.hurtbox.height * .67);
    ctx.scale(fighter.facing, 1);
    ctx.rotate(pulse * .055);
    ctx.globalAlpha = progress * (.94 + pulse * .06);
    ctx.drawImage(image, -width * .66, -height * .83, width, height);
    ctx.restore();
  }

  function drawEvolutionBody(fighter, ground, time) {
    if (!fighter.evolving || fighter.hp <= 0) {
      drawFighter(fighter, ground, time);
      return;
    }

    const age = fighter.awakeningDuration - fighter.awakeningFrames;
    const blend = Math.min(1, age / 14, fighter.awakeningFrames / 18);
    const { body, color = '#ffcc53', scale = 1, overlay, halo } = fighter.evolution;
    const size = 1 + blend * (scale - 1);
    const feet = ground + fighter.y;
    const aura = fighter.awakeningLevel === 2 && images.get(advancedAura);
    if (aura && blend > 0) {
      const width = fighter.height * (1.65 + .1 * Math.sin(time / 160));
      const height = width * aura.height / aura.width;
      ctx.save();
      ctx.globalAlpha = .58 * blend;
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(aura, fighter.x - width / 2, feet - height * .89, width, height);
      ctx.restore();
    }
    if (overlay?.behind) drawEvolutionOverlay(fighter, ground, time, blend, overlay);
    ctx.save();
    ctx.translate(fighter.x, feet);
    ctx.scale(size, size);
    ctx.translate(-fighter.x, -feet);
    drawFighter(fighter, ground, time);
    ctx.restore();

    if (body) drawEvolutionEquipment(fighter, ground, time, blend, body, color);
    if (overlay && !overlay.behind) drawEvolutionOverlay(fighter, ground, time, blend, overlay);
    if (halo && !fighter.dash?.roll) {
      const y = feet - fighter.hurtbox.height * size - 15 + Math.sin(time / 180) * 2;
      ctx.save();
      ctx.globalAlpha = blend;
      ctx.shadowColor = halo;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = halo;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(fighter.x, y, 18, 5, -.08, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (age < 24) {
      const wave = age / 24;
      ctx.save();
      ctx.globalAlpha = (1 - wave) * .85;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3 - 2 * wave;
      ctx.beginPath();
      ctx.ellipse(fighter.x, feet, 14 + wave * 100, 4 + wave * 18, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEvolutionEquipment(fighter, ground, time, blend, body, color) {
    const torso = ground + fighter.hurtbox.y + fighter.hurtbox.height * .36;
    ctx.save();
    ctx.translate(fighter.x, torso);
    ctx.scale(fighter.attack?.facing ?? fighter.dash?.facing ?? fighter.facing, 1);
    ctx.globalAlpha = blend;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 9;
    ctx.lineWidth = 1.5;
    if (body === 'armor') {
      if (!fighter.dash?.roll) {
        ctx.fillStyle = '#5b301e';
        ctx.beginPath();
        ctx.moveTo(-18, -9);
        ctx.lineTo(-9, -13);
        ctx.lineTo(0, -6);
        ctx.lineTo(10, -13);
        ctx.lineTo(19, -8);
        ctx.lineTo(11, 8);
        ctx.lineTo(0, 14);
        ctx.lineTo(-11, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      if (fighter.attack?.evolvedPunch) {
        const box = fighter.attackBoxFor(fighter.attack, fighter.attack.facing);
        const reach = Math.min(1, fighter.attack.elapsed / Math.max(1, fighter.attack.startup));
        const tip = (fighter.attack.facing > 0 ? box.x + box.width - fighter.x : fighter.x - box.x) * reach;
        ctx.beginPath();
        ctx.moveTo(9, 4);
        ctx.lineTo(tip * .55, Math.sin(time / 19) * 7);
        ctx.lineTo(tip, ground + box.y + box.height / 2 - torso);
        ctx.stroke();
      }
    } else if (body === 'viking' && !fighter.dash?.roll) {
      const head = -fighter.hurtbox.height * .37;
      const shieldX = -fighter.width * .53;
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#343940';
      ctx.beginPath();
      ctx.ellipse(0, head, 16, 13, 0, Math.PI, 2 * Math.PI);
      ctx.lineTo(16, head + 3);
      ctx.lineTo(-16, head + 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#d4ab66';
      ctx.fillRect(3, head - 10, 4, 19);
      ctx.fillStyle = '#70432e';
      ctx.beginPath();
      ctx.ellipse(shieldX, 11, 18, 21, -.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#d4ab66';
      ctx.fillRect(shieldX - 13, 9, 26, 4);
      ctx.beginPath();
      ctx.arc(shieldX, 11, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (body === 'sword') {
      const angle = time / 240;
      ctx.translate(Math.cos(angle) * 35, Math.sin(angle) * 13);
      ctx.rotate(-.55 + Math.sin(angle) * .24);
      ctx.fillStyle = '#dafaff';
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(5, -14);
      ctx.lineTo(2, 11);
      ctx.lineTo(-4, 15);
      ctx.lineTo(-5, -11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(-8, 11, 16, 2);
    }
    ctx.restore();
  }

  function drawEvolutionOverlay(fighter, ground, time, blend, overlay) {
    const image = images.get(overlay.image);
    if (!image) return;
    const facing = fighter.attack?.facing ?? fighter.dash?.facing ?? fighter.facing;
    const pulse = Math.sin(time / 115);
    const active = fighter.attackActive;
    const width = fighter.height * overlay.width * (1 + pulse * .04 + (active ? .12 : 0));
    const height = width * image.height / image.width;
    ctx.save();
    ctx.translate(fighter.x + facing * fighter.height * (overlay.x + (active ? .12 : 0)),
      ground + fighter.y - fighter.height * overlay.y + pulse * 3);
    ctx.scale(facing, 1);
    ctx.rotate(pulse * .09);
    ctx.globalAlpha = blend * (active ? 1 : .87);
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();
  }

  function drawEvolutionFist(fighter, ground, time) {
    const image = images.get(evolutionFist);
    if (!image) return;
    const { attack } = fighter;
    const box = fighter.attackBoxFor(attack, attack.facing);
    const reach = Math.min(1, attack.elapsed / Math.max(1, attack.startup));
    const handX = attack.facing > 0 ? box.x + box.width : box.x;
    const size = (attack.id === 'heavy' ? 62 : 48) + Math.sin(time / 34) * 4;
    ctx.save();
    ctx.translate(fighter.x + (handX - fighter.x) * reach, ground + box.y + box.height / 2);
    ctx.rotate(time / 115 * attack.facing);
    ctx.globalAlpha = fighter.attackActive ? 1 : .7;
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  return { drawEvolutionBody, drawEvolutionFist, drawEvolutionWings };
}
