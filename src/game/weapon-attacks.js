const profiles = {
  blade: { light: ['Chém ngang', 8, 7, 83], chain: ['Chém ngược', 10, 9, 90], heavy: ['Đao bổ', 17, 15, 97] },
  spear: { light: ['Thương quét', 7, 8, 104], chain: ['Liên chọc', 9, 9, 110], heavy: ['Thương đâm', 15, 12, 124] },
  hammer: { light: ['Búa ngang', 10, 10, 77], chain: ['Búa hồi', 12, 11, 83], heavy: ['Búa giáng', 22, 19, 94] },
  staff: { light: ['Trượng vụt', 7, 7, 92], chain: ['Trượng đảo tay', 9, 8, 99], heavy: ['Trượng quét', 14, 13, 105] },
  pan: { light: ['Chảo tạt', 8, 6, 72], chain: ['Chảo vụt ngược', 9, 7, 77], heavy: ['Chảo giáng', 16, 12, 83] },
  gauntlet: { light: ['Quyền giáp thẳng', 8, 5, 62], chain: ['Quyền giáp móc', 10, 6, 66], heavy: ['Quyền giáp phá', 16, 11, 72] },
};

function strengthenSkill(fighter, attack, type) {
  const perk = fighter.weapon.perk;
  return { ...attack, mainWeapon: type, weaponPerk: perk,
    damage: Math.round(attack.damage * (perk === 'impact' ? 1.22 : 1.10)),
    status: attack.status ?? (perk === 'frost' ? 'frost' : undefined) };
}

export function mainWeaponAttack(fighter, id) {
  const type = fighter.weapon?.weaponType;
  const profile = profiles[type];
  if (!profile) return null;
  const color = fighter.glow ?? '#ffc97e';
  if (id === 'rangedSkill' && type === 'staff' && !fighter.prototypeStyle) {
    const poison = fighter.characterId === 'diep';
    return strengthenSkill(fighter, {
      label: poison ? 'Trượng Phun Độc' : 'Trượng Băng Quang', mainWeapon: type,
      damage: Math.max(14, fighter.skillFor(id).damage), startup: 16, active: 1, recovery: 20, range: 60, hitstun: 20, knockback: 115,
      hitstop: 2, guardDamage: 20, cancelInto: [], cooldownFrames: 125,
      status: poison ? 'poison' : 'frost',
      projectile: { color, shape: poison ? 'orb' : 'ice', speed: 510, width: 36, height: 28, yOffset: 62, lifetimeFrames: 76 },
    }, type);
  }
  const launcher = id === 'closeSkill' && type === 'spear' && !fighter.prototypeStyle;
  if (!launcher && id !== 'light' && id !== 'heavy') {
    const personal = fighter.skillFor(id);
    return personal ? strengthenSkill(fighter, personal, type) : null;
  }
  const chain = id === 'light' && fighter.attack?.id === 'light' && fighter.attack.mainWeapon === type;
  const [label, damage, startup, far] = launcher
    ? ['Thương hất', 18, 14, 100] : profile[chain ? 'chain' : id];
  const light = id === 'light';
  const attack = {
    mainWeapon: type, label, damage, startup, range: far, active: launcher ? 5 : 4,
    recovery: launcher ? 24 : light ? 12 : 20, hitstun: light ? 25 : 23,
    knockback: light ? 72 : 145, hitstop: light ? 2 : 4, guardDamage: light ? 13 : 25,
    animation: light && !chain ? 'light_punch' : 'heavy_punch',
    swing: launcher ? 'lift' : type === 'spear' && !light ? 'thrust' : chain ? 'reverse' : 'slash',
    cancelInto: light ? [...(chain ? [] : ['light']), 'heavy', ...(type === 'spear' ? ['closeSkill'] : type === 'staff' ? ['rangedSkill'] : [])]
      : type === 'spear' && !launcher ? ['closeSkill'] : [],
    limbBoxes: [{ near: 0, far, top: launcher ? 106 : 82, height: launcher ? 81 : 44 }],
    effect: { color, particles: light ? 5 : 11, trailSeconds: .10 },
    ...(launcher && { launch: 460, knockdownOnLanding: true, cooldownFrames: 145, groundOnly: true }),
    ...(!launcher && !light && ['hammer', 'pan'].includes(type) && { knocksDown: true }),
  };
  return launcher ? strengthenSkill(fighter, attack, type) : attack;
}
