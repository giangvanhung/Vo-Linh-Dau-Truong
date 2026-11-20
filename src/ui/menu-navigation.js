const directions = {
  ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0],
};
const remoteKeys = {
  13: 'Enter', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown',
};

export function enableMenuNavigation() {
  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const panel = document.querySelector('.game-panel:not([hidden])');
    if (!panel) return;

    const key = directions[event.key] || event.key === 'Enter'
      ? event.key : remoteKeys[event.keyCode];
    const current = document.activeElement;
    const tv = document.body.classList.contains('tv-layout');
    const fullscreen = document.getElementById('game-fullscreen');
    if (key === 'Enter' && (panel.contains(current) || current === fullscreen)
      && current.matches(tv ? 'button, a[href], input[type="radio"], input[type="checkbox"]' : 'input[type="radio"], input[type="checkbox"]')) {
      event.preventDefault();
      if (!event.repeat) current.click();
      return;
    }
    const direction = directions[key];
    if (!direction) return;
    // Keep native adjustment keys for selects and sliders.
    if (current?.matches('select') && direction[1]) return;
    if (current?.matches('input[type="range"]') && direction[0]) return;

    const controls = [...panel.querySelectorAll('button, select, input, a[href], summary'),
      fullscreen].filter(element => {
      if (!element || element.disabled || element.closest('[hidden]')) return false;
      return element.getClientRects().length > 0;
    });
    event.preventDefault();
    if (!controls.includes(current)) {
      const first = controls.find(element => element.matches('input[type="radio"]:checked')) ?? controls[0];
      first?.focus();
      return;
    }

    const origin = controlRect(current);
    const [dx, dy] = direction;
    let best;
    let bestScore = Infinity;
    for (const control of controls) {
      if (control === current) continue;
      const rect = controlRect(control);
      const x = (rect.left + rect.right - origin.left - origin.right) / 2;
      const y = (rect.top + rect.bottom - origin.top - origin.bottom) / 2;
      const forward = dx * x + dy * y;
      if (forward <= 2) continue;
      const across = Math.abs(dy * x + dx * y);
      const score = forward + across * 3;
      if (score >= bestScore) continue;
      bestScore = score;
      best = control;
    }
    best?.focus();
  });
}

function controlRect(control) {
  return (control.closest('.roster-card') ?? control).getBoundingClientRect();
}
