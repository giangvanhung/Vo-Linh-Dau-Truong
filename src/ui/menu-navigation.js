const directions = {
  ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0],
};
const remoteKeys = {
  13: 'Enter', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown',
};
const confirmKeys = new Set(['Enter', 'Accept', 'Select', 'OK']);

export function enableMenuNavigation() {
  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const current = document.activeElement;
    const pairing = current.closest('.lan-details:not([hidden])');
    const dialog = document.querySelector('#utility-dialog[open]');
    const panel = dialog ?? pairing ?? document.querySelector('.game-panel:not([hidden])');
    if (!panel) return;

    const key = confirmKeys.has(event.key) ? 'Enter' : directions[event.key] ? event.key : remoteKeys[event.keyCode];
    const tv = document.body.classList.contains('tv-layout');
    const fullscreen = document.getElementById('game-fullscreen');
    if (key === 'Enter' && (panel.contains(current) || current === fullscreen)
      && current.matches(tv || dialog || panel.id === 'lan-panel' || pairing
        ? 'button, summary, a[href], input[type="radio"], input[type="checkbox"]'
        : 'input[type="radio"], input[type="checkbox"]')) {
      event.preventDefault();
      if (!event.repeat) current.click();
      return;
    }
    const direction = directions[key];
    if (!direction) return;
    // TV remotes can leave a select vertically and change its value horizontally.
    if (current?.matches('select')) {
      if (!tv && direction[1]) return;
      if (tv && direction[0]) {
        event.preventDefault();
        const index = current.selectedIndex + direction[0];
        if (current.options[index] && !current.options[index].disabled) {
          current.selectedIndex = index;
          current.dispatchEvent(new Event('input', { bubbles: true }));
          current.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }
    }
    if (current?.matches('input[type="range"]') && direction[0]) return;
    if (current.matches('[data-menu-scroll]') && direction[1]) {
      const atTop = current.scrollTop <= 0;
      const atBottom = current.scrollTop + current.clientHeight >= current.scrollHeight - 1;
      if (direction[1] < 0 ? !atTop : !atBottom) {
        event.preventDefault();
        current.scrollTop += direction[1] * 72;
        return;
      }
    }

    const controls = [...panel.querySelectorAll('button, select, input, a[href], summary, [data-menu-scroll]'),
      ...(dialog ? [] : [fullscreen])].filter(element => {
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
