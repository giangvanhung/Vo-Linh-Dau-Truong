export const heroEnergyMax = 100;

export function gainHeroEnergy(fighter, amount) {
  if (!fighter.heroForm || fighter.heroFrames || fighter.hp <= 0) return;
  fighter.heroEnergy = Math.min(heroEnergyMax, fighter.heroEnergy + amount);
}

export function startHeroForm(fighter, duel) {
  if (!fighter.heroForm || fighter.heroEnergy < heroEnergyMax || fighter.heroFrames || !fighter.canFocus) return false;
  const form = fighter.heroForm;
  fighter.heroEnergy = 0;
  fighter.heroDuration = duel ? form.duelDuration : form.duration;
  fighter.heroFrames = fighter.heroDuration;
  fighter.maxHp += form.hp;
  fighter.hp += form.hp;
  fighter.attackLock = .24;
  fighter.chargeFrames = 0;
  return true;
}

export function tickHeroForm(fighter) {
  if (fighter.heroFrames > 0 && --fighter.heroFrames === 0) {
    fighter.maxHp -= fighter.heroForm.hp;
    fighter.hp = Math.min(fighter.hp, fighter.maxHp);
    fighter.attackLock = Math.max(.20, fighter.attackLock);
  }
}
