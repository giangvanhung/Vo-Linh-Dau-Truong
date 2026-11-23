import { musicChoices } from './settings.js';

const assetRoot = '/assets/audio/';
const musicOrder = Object.keys(musicChoices);
const samples = {
  hit: ['punch', .8], heavy: ['heavy', .95], kick: ['kick', .95],
  block: ['block', .65], dash: ['cast', .25, 1.65], skill: ['cast', .68],
  ultimate: ['ultimate', .95], awaken: ['awaken', .8],
};

export class GameAudio {
  buffers = new Map();
  musicFiles = new Map();

  setMusicFile(id, file) {
    const previous = this.musicFiles.get(id);
    this.musicFiles.set(id, URL.createObjectURL(file));
    this.unlock();
    if (previous) URL.revokeObjectURL(previous);
  }

  configure(settings) {
    if (this.selectedMusic !== settings.musicTrack || settings.musicMode !== 'cycle') {
      this.selectedMusic = settings.musicTrack;
      this.currentMusic = settings.musicTrack;
    }
    this.settings = settings;
    if (this.effects) this.effects.gain.value = settings.sound ? settings.effects / 100 : 0;
    this.syncMusic();
  }

  unlock() {
    if (!this.settings.sound) return;
    this.musicUnlocked = true;
    this.syncMusic();
    try {
      if (!this.context) {
        const Context = window.AudioContext ?? window.webkitAudioContext;
        this.context = new Context();
        this.effects = this.context.createGain();
        this.effects.connect(this.context.destination);
        this.configure(this.settings);
        for (const name of new Set(Object.values(samples).map(([name]) => name))) {
          this.loadSample(name);
        }
      }
      if (this.context.state !== 'running') this.context.resume().catch(() => {});
    } catch {
      // The game remains playable in browsers without Web Audio.
    }
  }

  async loadSample(name) {
    try {
      const response = await fetch(assetRoot + 'sfx/' + name + '.ogg');
      if (!response.ok) return;
      this.buffers.set(name, await this.context.decodeAudioData(await response.arrayBuffer()));
    } catch {
      // The synthesized cue covers unsupported formats and failed loads.
    }
  }

  musicSource(id) {
    const choice = musicChoices[id];
    return choice.file ? assetRoot + 'music/' + choice.file : this.musicFiles.get(id);
  }

  advanceMusic() {
    const start = musicOrder.indexOf(this.currentMusic) + 1;
    const next = musicOrder.slice(start).concat(musicOrder.slice(0, start))
      .find(id => this.musicSource(id));
    if (!next) return;
    this.currentMusic = next;
    this.syncMusic();
  }

  syncMusic() {
    if (!this.musicUnlocked) return;
    if (this.settings.musicSource === 'youtube') {
      this.track?.pause();
      return;
    }
    const src = this.musicSource(this.currentMusic);
    const volume = this.settings.sound ? this.settings.music / 100 : 0;
    if (src && volume > 0) {
      if (this.trackSource !== src) {
        this.track?.pause();
        const track = new Audio(src);
        track.addEventListener('ended', () => {
          if (this.track === track && this.settings.musicMode === 'cycle') this.advanceMusic();
        });
        this.track = track;
        this.trackSource = src;
      }
      this.track.loop = this.settings.musicMode !== 'cycle';
      this.track.volume = volume * .65;
      if (this.track.paused) this.track.play().catch(() => {});
    } else {
      this.track?.pause();
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
