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

  tone(output, frequency, duration, volume, type = 'sine') {
    if (this.context?.state !== 'running') return;
    const note = this.context.createOscillator();
    const envelope = this.context.createGain();
    const now = this.context.currentTime;
    note.type = type;
    note.frequency.value = frequency;
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
      const notes = [110, 165, 130.81, 146.83, 110, 196, 130.81, 98];
      let beat = 0;
      this.loop = setInterval(() => this.tone(this.music, notes[beat++ % notes.length], .24, .13, 'triangle'), 260);
    }
    this.configure(this.settings);
  }

  cue(name) {
    if (!this.settings.sound) return;
    const [frequency, duration, volume] = {
      countdown: [440, .14, .14], fight: [740, .28, .17], hit: [120, .12, .19],
      block: [290, .09, .12], ko: [70, .55, .22], time: [350, .27, .14],
    }[name];
    this.tone(this.effects, frequency, duration, volume, 'triangle');
  }
}
