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

export function createYouTubeMusic(settings, saveSettings, setMusicPreview) {
  const byId = id => document.getElementById('youtube-music-' + id);
  const form = byId('form');
  const field = byId('link');
  const status = byId('status');
  const player = byId('player');
  const stopButton = byId('stop');
  const open = byId('open');
  if (settings.youtubeMusic) field.value = 'https://youtu.be/' + settings.youtubeMusic;

  function stop() {
    if (player.hidden) return;
    player.replaceChildren();
    player.hidden = stopButton.hidden = open.hidden = true;
    status.textContent = '';
    setMusicPreview(false);
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const id = youtubeVideoId(field.value);
    if (!id) {
      field.setAttribute('aria-invalid', 'true');
      status.textContent = 'Dán link của một video YouTube để tiếp tục.';
      field.focus();
      return;
    }

    field.removeAttribute('aria-invalid');
    setMusicPreview(true);
    settings.youtubeMusic = id;
    saveSettings();
    const iframe = document.createElement('iframe');
    iframe.title = 'Trình phát nhạc YouTube';
    iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&loop=1&playlist=${id}`;
    player.replaceChildren(iframe);
    player.hidden = stopButton.hidden = open.hidden = false;
    open.href = 'https://www.youtube.com/watch?v=' + id;
    status.textContent = 'Nếu video chưa chạy, bấm nút phát trên trình phát. Video chặn nhúng có thể mở trên YouTube.';
    player.scrollIntoView({ block: 'nearest' });
  });
  field.addEventListener('input', () => {
    if (!field.hasAttribute('aria-invalid')) return;
    field.removeAttribute('aria-invalid');
    status.textContent = '';
  });
  stopButton.addEventListener('click', () => {
    stop();
    field.focus();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  return { stop };
}
