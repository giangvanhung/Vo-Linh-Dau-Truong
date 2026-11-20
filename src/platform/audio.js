export class GameAudio {
  configure(settings) {
    this.settings = settings;
    if (!this.context) return;
    this.music.gain.value = settings.sound && this.playing ? settings.music / 100 : 0;
    this.effects.gain.value = settings.sound ? settings.effects / 100 : 0;
  }

  unlock() {
    if (!this.settings.sound) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.music = this.context.createGain();
        this.effects = this.context.createGain();
        this.music.connect(this.context.destination);
        this.effects.connect(this.context.destination);
        this.configure(this.settings);
      }
      this.context.resume().catch(() => {});
    } catch {
      // The game remains playable in browsers without Web Audio.
    }
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
    clearInterval(this.loop);
    if (playing) {
      const bass = [110, 110, 130.81, 98];
      const melody = [440, 523.25, 659.25, 0, 392, 523.25, 587.33, 0];
      let beat = 0;
      this.loop = setInterval(() => {
        if (beat % 2 === 0) this.tone(this.music, bass[Math.floor(beat / 2) % bass.length], .24, .095, 'triangle');
        const note = melody[beat++ % melody.length];
        if (note) this.tone(this.music, note, .11, .032, 'triangle');
      }, 240);
    }
    this.configure(this.settings);
  }

  cue(name) {
    if (!this.settings.sound) return;
    const sound = {
      countdown: [440, .14, .14], fight: [740, .28, .17],
      hit: [185, .11, .18, 'triangle', 65], heavy: [130, .19, .22, 'triangle', 43],
      kick: [300, .15, .17, 'sawtooth', 70], block: [740, .10, .09, 'square', 265],
      dash: [410, .12, .07, 'triangle', 96], skill: [225, .24, .13, 'triangle', 620],
      ultimate: [125, .45, .17, 'triangle', 63], ko: [280, .52, .18, 'triangle', 55],
      time: [350, .27, .14],
    }[name];
    if (!sound) return;
    this.tone(this.effects, ...sound);
    if (name === 'ultimate') this.tone(this.effects, 330, .35, .09, 'triangle', 680, .06);
  }
}
