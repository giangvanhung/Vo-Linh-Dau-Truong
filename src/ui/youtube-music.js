export function youtubeVideoId(value) {
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const hosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'];
    const id = url.hostname === 'youtu.be' && parts.length === 1 ? parts[0]
      : hosts.includes(url.hostname) && parts[0] === 'watch' && parts.length === 1 ? url.searchParams.get('v')
      : hosts.includes(url.hostname) && parts.length === 2 && ['shorts', 'live', 'embed'].includes(parts[0]) ? parts[1]
      : null;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function createYouTubeMusic(settings, saveSettings) {
  const byId = id => document.getElementById('youtube-music-' + id);
  const section = document.getElementById('youtube-music');
  const form = byId('form');
  const field = byId('link');
  const error = byId('error');
  const player = byId('player');
  const details = byId('details');
  const toggle = byId('toggle');
  const stopButton = byId('stop');
  const open = byId('open');
  const dock = byId('dock');
  let inMatch = false;
  if (settings.youtubeMusic) field.value = 'https://youtu.be/' + settings.youtubeMusic;

  function setExpanded(expanded) {
    if (!expanded && details.contains(document.activeElement)) toggle.focus({ preventScroll: true });
    details.hidden = !expanded;
    dock.classList.toggle('is-collapsed', !expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.textContent = expanded ? 'Thu gọn' : 'Hiện';
    toggle.setAttribute('aria-label', expanded ? 'Thu gọn trình phát YouTube' : 'Hiện trình phát YouTube');
  }

  function setInMatch(active) {
    if (active === inMatch) return;
    inMatch = active;
    dock.classList.toggle('in-match', inMatch);
    setExpanded(!inMatch);
  }

  function unload() {
    player.replaceChildren();
    dock.classList.remove('is-playing');
  }

  function stop() {
    unload();
    delete settings.youtubeMusic;
    saveSettings();
    field.value = '';
  }

  function play(id) {
    const iframe = document.createElement('iframe');
    iframe.title = 'Trình phát nhạc nền YouTube';
    iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&loop=1&playlist=${id}`;
    player.replaceChildren(iframe);
    dock.classList.add('is-playing');
    setExpanded(!inMatch);
    open.href = 'https://www.youtube.com/watch?v=' + id;
  }

  function setEnabled(enabled) {
    section.hidden = !enabled;
    if (!enabled) unload();
    else if (settings.youtubeMusic) play(settings.youtubeMusic);
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (section.hidden) return;
    const id = youtubeVideoId(field.value);
    if (!id) {
      field.setAttribute('aria-invalid', 'true');
      error.textContent = 'Dán link của một video YouTube để tiếp tục.';
      error.hidden = false;
      field.focus();
      return;
    }

    field.removeAttribute('aria-invalid');
    error.hidden = true;
    settings.youtubeMusic = id;
    saveSettings();
    play(id);
  });
  field.addEventListener('input', () => {
    if (!field.hasAttribute('aria-invalid')) return;
    field.removeAttribute('aria-invalid');
    error.hidden = true;
  });
  toggle.addEventListener('click', () => setExpanded(details.hidden));
  stopButton.addEventListener('click', () => {
    stop();
    if (field.closest('dialog')?.open) field.focus();
  });
  return { setEnabled, setInMatch };
}
