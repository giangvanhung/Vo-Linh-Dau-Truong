import { FRAME_SECONDS } from '../combat/fighter.js';

export function createTrainingPanel(training, controls) {
  const byId = id => document.getElementById(id);
  const panel = byId('training-panel');
  const record = byId('record-input');
  const play = byId('play-input');
  const format = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

  byId('dummy-mode').addEventListener('change', event => { training.mode = event.target.value; });
  byId('training-debug').addEventListener('change', event => {
    training.debug = event.target.checked;
    byId('training-legend').hidden = !training.debug;
  });
  byId('reset-position').addEventListener('click', controls.resetPosition);
  byId('reset-health').addEventListener('click', controls.resetHealth);
  byId('reset-meter').addEventListener('click', controls.resetMeter);
  record.addEventListener('click', () => { if (controls.canUse()) training.toggleRecord(); });
  play.addEventListener('click', () => { if (controls.canUse()) training.togglePlayback(); });

  function update(visible, dummy) {
    panel.hidden = !visible;
    if (!visible) return;
    const { hits, advantage, inputs, recording, recordState } = training;
    const active = controls.canUse();
    for (const id of ['reset-position', 'reset-health', 'reset-meter']) byId(id).disabled = !active;
    record.disabled = !active || recordState === 'playing';
    play.disabled = !active || recordState === 'recording' || !recording.length;
    record.textContent = recordState === 'recording' ? 'Dừng ghi' : 'Ghi input';
    play.textContent = recordState === 'playing' ? 'Dừng phát' : 'Phát cho bù nhìn';
    const elapsed = recordState === 'playing' ? training.playhead : recording.length;
    const duration = (elapsed * FRAME_SECONDS).toFixed(1);
    const label = { idle: 'Đã ghi', recording: 'Đang ghi', playing: 'Đang phát' }[recordState];
    const values = {
      'record-status': recording.length ? `${label} · ${duration} / 10 giây` : 'Tối đa 10 giây',
      'training-combo': String(hits.length),
      'training-damage': format.format(hits.reduce((total, hit) => total + hit, 0)),
      'training-hits': hits.map(hit => format.format(hit)).join(' → ') || '—',
      'training-stun': dummy.hitstun + 'f',
      'training-advantage': advantage === null ? '—' : (advantage > 0 ? '+' : '') + advantage + 'f',
      'training-inputs': inputs.join(' → ') || '—',
    };
    for (const [id, value] of Object.entries(values)) {
      const element = byId(id);
      if (element.textContent !== value) element.textContent = value;
    }
  }

  return { update };
}
