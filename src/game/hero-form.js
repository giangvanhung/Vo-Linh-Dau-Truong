export const heroEnergyMax = 100;

export function nextHeroForm(fighter) {
  if (!fighter.heroFrames) return fighter.heroForm;
  const form = fighter.heroUpgrades?.[fighter.heroStage - 1];
  return form?.mech && fighter.heroMechUsed ? null : form;
}

export function gainHeroEnergy(fighter, amount) {
  if (!nextHeroForm(fighter) || fighter.hp <= 0) return;
  fighter.heroEnergy = Math.min(heroEnergyMax, fighter.heroEnergy + amount * (fighter.activeHeroForm?.energyGain ?? 1));
}

export function startHeroForm(fighter, duel) {
  const form = nextHeroForm(fighter);
  if (!form || fighter.heroEnergy < heroEnergyMax || !fighter.canFocus) return false;
  const bonusHp = form.hp - (fighter.activeHeroForm?.hp ?? 0);
  fighter.heroEnergy = 0;
  fighter.heroStage++;
  fighter.heroDuration = duel ? form.duelDuration : form.duration;
  fighter.heroFrames = fighter.heroDuration;
  fighter.maxHp += bonusHp;
  fighter.hp += bonusHp;
  if (form.mech) fighter.heroMechUsed = true;
  fighter.heroCounter = 0;
  fighter.heroGuardWindow = 0;
  for (const id of Object.keys(form.skills ?? {})) delete fighter.cooldowns[id];
  fighter.attackLock = .24;
  fighter.chargeFrames = 0;
  return true;
}

export function tickHeroForm(fighter) {
  const form = fighter.activeHeroForm;
  if (!form) return;
  if (fighter.heroCounter > 0) fighter.heroCounter--;
  if (fighter.heroGuardWindow > 0) fighter.heroGuardWindow--;
  if (--fighter.heroFrames === 0) {
    fighter.maxHp -= form.hp;
    fighter.hp = Math.min(fighter.hp, fighter.maxHp);
    fighter.attackLock = Math.max(.20, fighter.attackLock);
    fighter.heroStage = 0;
    fighter.heroEnergy = 0;
    fighter.heroCounter = 0;
    fighter.heroGuardWindow = 0;
  }
}
