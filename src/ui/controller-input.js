export function createControllerInput({ pad, send, supportsDirectionBatch, onChange }) {
  const stick = document.querySelector('#stick');
  const arrows = pad.querySelector('.direction');
  const directionMode = document.querySelector('#direction-mode');
  const directions = new Set();
  let stickPointer = null;
  let stickRect;
  const pointers = new Map();
  const portrait = matchMedia('(orientation: portrait)');

  function reset() {
    for (const button of pointers.values()) button.classList.remove('is-down');
    pointers.clear();
    directions.clear();
    stickPointer = null;
    stickRect = undefined;
    centerStick();
    onChange();
    send({ type: 'reset' });
  }

  directionMode.onclick = () => {
    reset();
    const enabled = stick.hidden;
    stick.hidden = !enabled;
    arrows.hidden = enabled;
    directionMode.setAttribute('aria-pressed', String(enabled));
    directionMode.textContent = enabled ? 'Nút hướng' : 'Joystick';
  };

  function centerStick() {
    stick.style.setProperty('--stick-x', '0px');
    stick.style.setProperty('--stick-y', '0px');
  }

  function updateDirections(next) {
    const changes = [];
    for (const button of directions) {
      if (!next.has(button)) changes.push([button, false]);
    }
    for (const button of next) {
      if (!directions.has(button)) changes.push([button, true]);
    }
    if (!changes.length) return;
    if (supportsDirectionBatch() && changes.length > 1) send({ type: 'direction', changes });
    else for (const [button, down] of changes) send({ type: 'input', button, down });
    directions.clear();
    for (const button of next) directions.add(button);
    onChange();
  }

  function moveStick(event) {
    if (event.pointerId !== stickPointer) return;
    const rect = stickRect ??= stick.getBoundingClientRect();
    const screenX = event.clientX - rect.left - rect.width / 2;
    const screenY = event.clientY - rect.top - rect.height / 2;
    const rotated = portrait.matches && document.body.classList.contains('pad-rotate');
    const x = rotated ? screenY : screenX;
    const y = rotated ? -screenX : screenY;
    const travel = rect.width * 0.28;
    const scale = Math.min(1, travel / Math.max(1, Math.hypot(x, y)));
    stick.style.setProperty('--stick-x', x * scale + 'px');
    stick.style.setProperty('--stick-y', y * scale + 'px');
    const next = new Set();
    const horizontal = x < 0 ? 'a' : 'd';
    const vertical = y < 0 ? 'w' : 's';
    if (Math.abs(x) > travel * (directions.has(horizontal) ? .22 : .34)) next.add(horizontal);
    if (Math.abs(y) > travel * (directions.has(vertical) ? .30 : .48)) next.add(vertical);
    updateDirections(next);
  }

  stick.addEventListener('pointerdown', event => {
    if (event.button !== 0 || stickPointer !== null) return;
    event.preventDefault();
    stickRect = undefined;
    stickPointer = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    moveStick(event);
  });
  stick.addEventListener('pointermove', moveStick);
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stick.addEventListener(eventName, event => {
      if (event.pointerId !== stickPointer) return;
      stickPointer = null;
      centerStick();
      updateDirections(new Set());
    });
  }

  pad.addEventListener('pointerdown', event => {
    const button = event.target.closest('[data-key]');
    if (!button || event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    const alreadyHeld = [...pointers.values()].includes(button);
    pointers.set(event.pointerId, button);
    button.classList.add('is-down');
    if (!alreadyHeld) send({ type: 'input', button: button.dataset.key, down: true });
    if (!alreadyHeld) onChange();
  });

  function release(event) {
    const button = pointers.get(event.pointerId);
    if (!button) return;
    pointers.delete(event.pointerId);
    if ([...pointers.values()].includes(button)) return;
    button.classList.remove('is-down');
    send({ type: 'input', button: button.dataset.key, down: false });
    onChange();
  }

  for (const event of ['pointerup','pointercancel','lostpointercapture']) pad.addEventListener(event, release);
  pad.addEventListener('contextmenu', event => event.preventDefault());
  portrait.addEventListener?.('change', reset);

  return {
    reset,
    invalidateStick() { stickRect = undefined; },
    held() {
      const keys = new Set(directions);
      for (const button of pointers.values()) keys.add(button.dataset.key);
      return keys;
    },
  };
}
