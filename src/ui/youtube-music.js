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
  const dock = document.getElementById('youtube-music-dock');
  const nowPlaying = document.getElementById('youtube-music-now-playing');
  if (settings.youtubeMusic) field.value = 'https://youtu.be/' + settings.youtubeMusic;

  function stop(clearSavedLink = false) {
    player.replaceChildren();
    player.hidden = stopButton.hidden = open.hidden = true;
    dock.classList.remove('is-playing');
    status.textContent = '';
    setMusicPreview(false);
    if (clearSavedLink) {
      delete settings.youtubeMusic;
      saveSettings();
      field.value = '';
    }
  }

  function play(id) {
    settings.youtubeMusic = id;
    saveSettings();
    const iframe = document.createElement('iframe');
    iframe.title = 'Trình phát nhạc nền YouTube';
    iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&loop=1&playlist=${id}`;
    player.replaceChildren(iframe);
    player.hidden = false;
    stopButton.hidden = open.hidden = false;
    dock.classList.add('is-playing');
    nowPlaying.textContent = 'Đang phát nhạc nền YouTube';
    open.href = 'https://www.youtube.com/watch?v=' + id;
    status.textContent = 'Nhạc tiếp tục phát khi chuyển màn hình. Nếu video chưa chạy, hãy bấm phát trong trình nghe.';
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
    play(id);
  });
  field.addEventListener('input', () => {
    if (!field.hasAttribute('aria-invalid')) return;
    field.removeAttribute('aria-invalid');
    status.textContent = '';
  });
  stopButton.addEventListener('click', () => {
    stop(true);
    field.focus();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setMusicPreview(false);
  });
  if (settings.youtubeMusic) play(settings.youtubeMusic);
  return { stop };
}
