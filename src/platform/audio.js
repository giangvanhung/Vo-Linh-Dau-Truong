const assetRoot = '/assets/audio/';
const samples = {
  hit: ['punch', .8], heavy: ['heavy', .95], kick: ['kick', .95],
  block: ['block', .65], dash: ['cast', .25, 1.65], skill: ['cast', .68],
  ultimate: ['ultimate', .95], awaken: ['awaken', .8],
};

export class GameAudio {
  buffers = new Map();

  configure(settings) {
    this.settings = settings;
    if (!this.context) return;
    this.effects.gain.value = settings.sound ? settings.effects / 100 : 0;
    this.syncMusic();
  }

  unlock() {
    if (!this.settings.sound) return;
    try {
      if (!this.context) {
        const Context = window.AudioContext ?? window.webkitAudioContext;
        this.context = new Context();
        this.track = new Audio(assetRoot + 'arena-synthwave.mp3');
        this.track.loop = true;
        this.music = this.context.createGain();
        this.effects = this.context.createGain();
        this.context.createMediaElementSource(this.track).connect(this.music);
        this.music.connect(this.context.destination);
        this.effects.connect(this.context.destination);
        this.configure(this.settings);
        for (const name of new Set(Object.values(samples).map(([name]) => name))) {
          this.loadSample(name);
        }
      }
      this.context.resume().catch(() => {});
    } catch {
      // The game remains playable in browsers without Web Audio.
    }
  }

  async loadSample(name) {
    try {
      const response = await fetch(assetRoot + name + '.ogg');
      if (!response.ok) return;
      this.buffers.set(name, await this.context.decodeAudioData(await response.arrayBuffer()));
    } catch {
      // The synthesized cue covers unsupported formats and failed loads.
    }
  }

  syncMusic() {
    const volume = this.settings.sound && this.playing ? this.settings.music / 100 : 0;
    this.music.gain.value = volume * .65;
    if (volume) this.track.play().catch(() => {});
    else this.track.pause();
  }

  tone(output, frequency, duration, volume, type = 'sine', end = frequency, delay = 0) {
    if (this.context?.state !== 'running') return;
    const note = this.context.createOscillator();
    const envelope = this.context.createGain();
    const now = this.context.currentTime + delay;
    note.type = type;
    note.frequency.setValueAtTime(frequency, now);
    note.frequency.exponentialRampToValueAtTime(end, now + duration);
    envelope.gain.setValueAtTime(volume, now);
    envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
    note.connect(envelope).connect(output);
    note.start(now);
    note.stop(now + duration);
  }

  setPlaying(playing) {
    this.playing = playing;
    if (this.context) this.syncMusic();
  }

  cue(name) {
    if (!this.settings.sound || this.context?.state !== 'running') return;
    const sample = samples[name];
    const buffer = sample && this.buffers.get(sample[0]);
    if (buffer) {
      const [, volume, rate = 1] = sample;
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = rate * (.96 + Math.random() * .08);
      gain.gain.value = volume;
      source.connect(gain).connect(this.effects);
      source.start();
      return;
    }
    const sound = {
      countdown: [440, .14, .14], fight: [740, .28, .17],
      hit: [185, .11, .18, 'triangle', 65], heavy: [130, .19, .22, 'triangle', 43],
      kick: [300, .15, .17, 'sawtooth', 70], block: [740, .10, .09, 'square', 265],
      dash: [410, .12, .07, 'triangle', 96], skill: [225, .24, .13, 'triangle', 620],
      ultimate: [125, .45, .17, 'triangle', 63], ko: [280, .52, .18, 'triangle', 55],
      time: [350, .27, .14], awaken: [210, .33, .15, 'triangle', 780],
    }[name];
    if (!sound) return;
    this.tone(this.effects, ...sound);
    if (name === 'ultimate') this.tone(this.effects, 330, .35, .09, 'triangle', 680, .06);
  }
}
