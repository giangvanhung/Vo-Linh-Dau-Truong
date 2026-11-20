export function createControllerLayout({ pad, reset, invalidateStick }) {
  const expand = document.querySelector('#expand-pad');
  const rotate = document.querySelector('#rotate-pad');
  const light = document.querySelector('#light-pad');
  const chooseBackground = document.querySelector('#choose-pad-bg');
  const clearBackground = document.querySelector('#clear-pad-bg');
  const backgroundFile = document.querySelector('#pad-bg-file');
  const fullscreenRoot = document.documentElement;
  let nativeFullscreen = false;

  function setExpanded(enabled) {
    invalidateStick();
    if (!enabled) setRotated(false);
    document.body.classList.toggle('pad-expanded', enabled);
    expand.setAttribute('aria-pressed', String(enabled));
    expand.textContent = enabled ? 'Thu nhỏ' : 'Toàn màn hình';
  }

  function setRotated(enabled) {
    invalidateStick();
    document.body.classList.toggle('pad-rotate', enabled);
    rotate.setAttribute('aria-pressed', String(enabled));
    rotate.textContent = enabled ? 'Bỏ xoay ngang' : 'Xoay ngang';
  }

  function fullscreenElement() {
    return document.fullscreenElement ?? document.webkitFullscreenElement;
  }

  function syncFullscreen() {
    const active = fullscreenElement() === fullscreenRoot;
    const exited = nativeFullscreen && !active;
    nativeFullscreen = active;
    if (exited) setExpanded(false);
  }

  async function exitFullscreen() {
    if (fullscreenElement() !== fullscreenRoot) return;
    const exit = document.exitFullscreen ?? document.webkitExitFullscreen;
    try {
      await exit?.call(document);
    } catch {
      // The browser can exit on its own while the connection is closing.
    }
  }

  async function toggleExpanded(enabled) {
    setExpanded(enabled);
    if (!enabled) {
      await exitFullscreen();
      return;
    }
    const request = fullscreenRoot.requestFullscreen ?? fullscreenRoot.webkitRequestFullscreen;
    try {
      await request?.call(fullscreenRoot);
      syncFullscreen();
      if (!document.body.classList.contains('pad-expanded')) await exitFullscreen();
    } catch {
      // Keep the controller expanded within the browser viewport.
    }
  }

  expand.onclick = () => {
    reset();
    void toggleExpanded(!document.body.classList.contains('pad-expanded'));
  };
  rotate.onclick = () => {
    reset();
    const enabled = !document.body.classList.contains('pad-rotate');
    setRotated(enabled);
    if (enabled && !document.body.classList.contains('pad-expanded')) void toggleExpanded(true);
  };
  window.addEventListener('resize', () => {
    invalidateStick();
    syncFullscreen();
  });

  light.onclick = () => {
    const enabled = document.body.classList.toggle('pad-light');
    light.setAttribute('aria-pressed', String(enabled));
    light.textContent = enabled ? 'Màu tối' : 'Màu sáng';
  };

  let backgroundUrl;
  chooseBackground.onclick = () => backgroundFile.click();
  function removeBackground() {
    if (backgroundUrl) URL.revokeObjectURL(backgroundUrl);
    backgroundUrl = undefined;
    pad.style.removeProperty('--pad-photo');
    clearBackground.hidden = true;
  }
  clearBackground.onclick = removeBackground;
  backgroundFile.addEventListener('change', () => {
    const file = backgroundFile.files[0];
    backgroundFile.value = '';
    if (!file) return;
    removeBackground();
    backgroundUrl = URL.createObjectURL(file);
    pad.style.setProperty('--pad-photo', `url("${backgroundUrl}")`);
    clearBackground.hidden = false;
  });

  for (const eventName of ['fullscreenchange', 'webkitfullscreenchange']) {
    document.addEventListener(eventName, syncFullscreen);
  }

  return { setExpanded, setRotated, exitFullscreen, toggleExpanded, syncFullscreen };
}
