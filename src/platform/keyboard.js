export const defaultBindings = [
  {a:'KeyA', d:'KeyD', w:'KeyW', s:'KeyS', j:'KeyJ', k:'KeyK', l:'KeyL', p:'KeyP', q:'KeyQ', r:'KeyR', f:'KeyF', g:'KeyG', u:'KeyU', i:'KeyI', o:'KeyO', t:'KeyT', b:'KeyB'},
  {a:'ArrowLeft', d:'ArrowRight', w:'ArrowUp', s:'ArrowDown', j:'Numpad1', k:'Numpad2', l:'Numpad3', p:'Numpad4', q:'Numpad5', r:'Numpad6', f:'Numpad0', g:'NumpadAdd', u:'Numpad7', i:'Numpad8', o:'Numpad9', t:'NumpadDecimal', b:'NumpadEnter'},
];
export const bindingLabels = {
  a:'Trái', d:'Phải', w:'Nhảy', s:'Cúi', j:'Đòn nhẹ', k:'Đòn nặng', l:'Đá', p:'Đỡ',
  q:'Lướt', r:'Lộn né', f:'Tụ khí', g:'Tiến hóa', u:'Chiêu gần', i:'Chiêu xa', o:'Tuyệt kỹ', t:'Thoát combo', b:'Thả vũ khí',
};
const legacyArrows = { 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown' };
const compositionKey = event => event.isComposing || event.keyCode === 229 || event.key === 'Process';
export const ambiguousCompositionKey = event => compositionKey(event) && (!event.code || event.code === 'Unidentified');

export function keyCode(event) {
  if (event.code && event.code !== 'Unidentified') return event.code;
  if (event.keyCode >= 65 && event.keyCode <= 90) return 'Key' + String.fromCharCode(event.keyCode);
  if (legacyArrows[event.keyCode]) return legacyArrows[event.keyCode];
  if (event.key?.toLowerCase() === 'đ') return 'KeyD';
  return /^[a-z]$/i.test(event.key) ? 'Key' + event.key.toUpperCase() : event.key;
}
export function assignable(code) {
  return /^(Key[A-Z]|Digit[0-9]|Numpad([0-9]|Add|Decimal|Subtract|Multiply|Divide|Enter)|Arrow(Left|Right|Up|Down)|Comma|Period|BracketLeft|BracketRight|Slash|Minus|Equal|Semicolon|Quote)$/.test(code);
}
export function keyLabel(code) {
  return ({ArrowLeft:'←', ArrowRight:'→', ArrowUp:'↑', ArrowDown:'↓', BracketLeft:'[', BracketRight:']', Comma:',', Period:'.'})[code]
    ?? ({NumpadAdd:'Num +', NumpadDecimal:'Num .', NumpadSubtract:'Num −', NumpadMultiply:'Num ×', NumpadDivide:'Num /', NumpadEnter:'Num Enter'})[code]
    ?? code.replace(/^(Key|Digit)/,'').replace(/^Numpad/, 'Num ');
}

const attackKeys = { j: 'light', k: 'heavy', l: 'kick', u: 'closeSkill', i: 'rangedSkill', o: 'ultimate' };
const movementAliases = { ArrowLeft: 'a', ArrowRight: 'd', ArrowUp: 'w', ArrowDown: 's' };
const gameKeys = new Set(Object.keys(bindingLabels));
const continuousKeys = new Set(['a', 'd', 's', 'p', 'f']);

export function createKeyboard({ canPlay, canPause, onPause, onClear, onInput, onCompositionIssue, keyFor, allowArrows = () => true }) {
  let queuedAttack = null, queuedAction = null, queuedJump = false;
  let attackSequence = [];
  let lastDirectionTap = null;
  let dashDirection = 0;
  let downPressed = false;
  const heldInputs = new Map();

  function gameKey(event) {
    if (keyFor) return keyFor(event);
    if (event.code?.startsWith('Arrow') && !allowArrows()) return;
    const key = event.key?.toLowerCase();
    if (key === 'đ') return 'd';
    if (gameKeys.has(key)) return key;
    if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase();
    return movementAliases[event.code] ?? movementAliases[event.key];
  }

  function movementDirection() {
    return Number(isHeld('d')) - Number(isHeld('a'));
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
    if (!canPlay() || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target?.closest?.('select, input, textarea, [contenteditable="true"]')) return;
    if (ambiguousCompositionKey(event)) {
      clearInputs();
      if (!event.repeat) onCompositionIssue?.();
      return;
    }
    const key = gameKey(event);
    if (!gameKeys.has(key)) return;
    if (!event.repeat && (compositionKey(event) || event.key?.toLowerCase() === 'đ')) onCompositionIssue?.();
    event.preventDefault();
    const input = keyCode(event) ?? key;
    if (heldInputs.has(input) || (event.repeat && !continuousKeys.has(key))) return;
    heldInputs.set(input, key);
    if (event.repeat) return;
    if (key === 'a' || key === 'd') {
      const direction = key === 'a' ? -1 : 1;
      if (lastDirectionTap?.direction === direction && event.timeStamp - lastDirectionTap.time <= 240) {
        queuedAction = 'dash';
        dashDirection = direction;
        lastDirectionTap = null;
      } else {
        lastDirectionTap = { direction, time: event.timeStamp };
      }
    }
    onInput?.(keyFor ? (key === 'q' && event.shiftKey ? 'Shift+' : '') + keyLabel(keyCode(event)) : key === 'q' && event.shiftKey ? 'Shift+Q' : (event.key?.startsWith('Arrow')
      ? { a: '←', d: '→', w: '↑', s: '↓' }[key] : key.toUpperCase()));
    if (key === 'w') queuedJump = true;
    if (key === 's') downPressed = true;
    if (attackKeys[key]) {
      queuedAttack = attackKeys[key];
      if (attackSequence.length < 3) attackSequence.push({ id: queuedAttack, crouch: isHeld('s') });
    }
    if (key === 'q') {
      queuedAction = event.shiftKey ? 'enhancedDash' : 'dash';
      dashDirection = 0;
    }
    if (key === 'r') queuedAction = 'roll';
    if (key === 'g') queuedAction = 'awaken';
    if (key === 't') queuedAction = 'escape';
    if (key === 'b') queuedAction = 'dropWeapon';
  });
  window.addEventListener('keyup', event => {
    if (heldInputs.delete(keyCode(event))) return;
    if (ambiguousCompositionKey(event)) {
      if (canPlay() && heldInputs.size) onCompositionIssue?.();
      clearInputs();
      return;
    }
    const key = gameKey(event);
    // IMEs can report a different or missing physical code on release.
    for (const [input, heldKey] of heldInputs) {
      if (heldKey === key) heldInputs.delete(input);
    }
  }, { capture: true });
  function clearInputs() {
    heldInputs.clear();
    lastDirectionTap = null;
    dashDirection = 0;
    queuedAttack = queuedAction = null;
    attackSequence = [];
    queuedJump = downPressed = false;
    onClear();
  }

  function consumeActions() {
    const actions = {
      attack: queuedAttack, attackSequence, action: queuedAction, dashDirection, jump: queuedJump, downPressed,
      ascend: isHeld('w'), charge: isHeld('f'), guard: isHeld('p'), crouch: isHeld('s'), direction: movementDirection(),
    };
    queuedAttack = queuedAction = null;
    dashDirection = 0;
    attackSequence = [];
    queuedJump = downPressed = false;
    return actions;
  }

  window.addEventListener('blur', clearInputs);
  window.addEventListener('pagehide', clearInputs);
  document.addEventListener('focusin', event => {
    if (event.target?.closest?.('select, input, textarea, [contenteditable="true"]')) clearInputs();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInputs();
  });

  return { clear: clearInputs, consumeActions };
}
