const attackKeys = { j: 'light', k: 'heavy', l: 'kick', u: 'closeSkill', i: 'rangedSkill', o: 'ultimate' };
const movementAliases = { ArrowLeft: 'a', ArrowRight: 'd', ArrowUp: 'w', ArrowDown: 's' };
const gameKeys = new Set(['a', 'd', 'w', 's', 'p', 'q', 't', ...Object.keys(attackKeys)]);

export function createKeyboard({ canPlay, canPause, onPause, onClear, onInput }) {
  let queuedAttack = null, queuedAction = null, queuedJump = false;
  const heldInputs = new Map();

  function gameKey(event) {
    const key = event.key?.toLowerCase();
    if (key === 'đ') return 'd';
    if (gameKeys.has(key)) return key;
    if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase();
    return movementAliases[event.code] ?? movementAliases[event.key];
  }

  function movementDirection() {
    let direction = 0;
    for (const key of heldInputs.values()) {
      if (key === 'd') direction = 1;
      if (key === 'a') direction = -1;
    }
    return direction;
  }

  function physicalKey(event) {
    return event.code && event.code !== 'Unidentified' ? event.code : null;
  }

  function isHeld(key) {
    return [...heldInputs.values()].includes(key);
  }

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && canPause()) {
      event.preventDefault();
      if (!event.repeat) onPause();
      return;
    }
    if (!canPlay()) return;
    if (event.target?.closest?.('select, input, textarea, [contenteditable="true"]')) return;
    const key = gameKey(event);
    if (!gameKeys.has(key) || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    const input = physicalKey(event) ?? key;
    if (event.repeat || heldInputs.has(input)) return;
    heldInputs.set(input, key);
    onInput?.(key === 'q' && event.shiftKey ? 'Shift+Q' : (event.key?.startsWith('Arrow')
      ? { a: '←', d: '→', w: '↑', s: '↓' }[key] : key.toUpperCase()));
    if (key === 'w') queuedJump = true;
    if (attackKeys[key]) queuedAttack = attackKeys[key];
    if (key === 'q') queuedAction = event.shiftKey ? 'enhancedDash' : 'dash';
    if (key === 't') queuedAction = 'escape';
  });
  window.addEventListener('keyup', event => {
    const code = physicalKey(event);
    const key = gameKey(event);
    if (!heldInputs.delete(code ?? key)) {
      // Some keyboard layouts and input methods omit the physical code on one event.
      for (const [input, heldKey] of heldInputs) {
        if ((code === null || input === heldKey) && heldKey === key) heldInputs.delete(input);
      }
    }
  });
  function clearInputs() {
    heldInputs.clear();
    queuedAttack = queuedAction = null;
    queuedJump = false;
    onClear();
  }

  function consumeActions() {
    const actions = {
      attack: queuedAttack, action: queuedAction, jump: queuedJump,
      guard: isHeld('p'), crouch: isHeld('s'), direction: movementDirection(),
    };
    queuedAttack = queuedAction = null;
    queuedJump = false;
    return actions;
  }

  window.addEventListener('blur', clearInputs);
  window.addEventListener('pagehide', clearInputs);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInputs();
  });

  return { clear: clearInputs, consumeActions };
}
