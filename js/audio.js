// ============================================================
// EMBERFALL — procedural music & sound (WebAudio)
// ============================================================

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // midi to hz
const MUSIC_BOOST = 8.0;
const SFX_BOOST = 2.4;

const MOODS = {
  title: {
    bpm: 68,
    chords: [[50, 57, 62, 65], [46, 53, 58, 62], [41, 48, 53, 57], [48, 55, 60, 64]],
    pattern: [0, 2, 1, 3, 2, 1, 3, 2],
    pad: true,
    drums: false,
    swing: 0.18,
    gain: 0.55,
  },
  camp: {
    bpm: 76,
    chords: [[50, 57, 62, 65], [46, 53, 58, 62], [41, 48, 53, 57], [48, 55, 60, 64]],
    pattern: [0, 1, 2, 3, 2, 1, 3, 2],
    pad: true,
    drums: false,
    gain: 0.6,
  },
  battle: {
    bpm: 104,
    chords: [[50, 57, 62], [46, 53, 58], [41, 48, 53], [48, 55, 60]],
    pattern: [0, 2, 1, 2, 3, 2, 1, 2],
    pad: false,
    drums: true,
    gain: 0.55,
  },
  boss: {
    bpm: 124,
    chords: [[50, 53, 57], [49, 52, 56], [46, 50, 53], [45, 49, 52]],
    pattern: [0, 1, 2, 1, 0, 2, 1, 2],
    pad: true,
    drums: true,
    boss: true,
    gain: 0.6,
  },
  victory: {
    bpm: 92,
    chords: [[50, 57, 62, 65], [43, 50, 55, 59], [48, 55, 60, 64], [50, 57, 62, 67]],
    pattern: [0, 1, 2, 3, 2, 3, 1, 2],
    pad: true,
    drums: false,
    gain: 0.55,
  },
  defeat: {
    bpm: 56,
    chords: [[45, 52, 57], [41, 48, 53], [38, 45, 50], [45, 52, 56]],
    pattern: [0, 1, 2, 1, 0, 2, 1, 0],
    pad: true,
    drums: false,
    gain: 0.45,
  },
};

export class AudioEngine {
  constructor(settings = {}) {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.settings = { music: 0.5, sfx: 0.75, ...settings };
    this.muted = false;
    this.mood = 'none';
    this.step = 0;
    this.nextNoteTime = 0;
    this.timer = null;
    this.noiseBuffer = null;
    this.started = false;
    this.lastSfx = new Map();
  }

  init() {
    if (this.ctx) {
      this.unlock();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    // A gentle limiter lets the music and effects sit much louder without
    // clipping when several hit sounds overlap.
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -12;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;
    this.master.connect(this.compressor).connect(ctx.destination);
    this.musicBus = ctx.createGain();
    const moodGain = this.mood === 'none' ? 0 : (MOODS[this.mood]?.gain ?? 0.55);
    this.musicBus.gain.value = this.settings.music * MUSIC_BOOST * moodGain;
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.settings.sfx * SFX_BOOST;
    this.sfxBus.connect(this.master);
    this.noiseBuffer = this.makeNoise();
    this.started = true;
    this.step = 0;
    this.nextNoteTime = ctx.currentTime + 0.08;
    ctx.onstatechange = () => {
      if (ctx.state === 'running' && this.mood !== 'none') {
        const now = ctx.currentTime;
        if (this.nextNoteTime < now) this.nextNoteTime = now + 0.06;
        this.startScheduler();
      }
    };
    this.unlock();
  }

  // Browsers start/resume AudioContext only from a user gesture. Call this on
  // every early pointer/key event so a context that started suspended (or was
  // interrupted by the OS) always gets another chance to run.
  unlock() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const resume = () => {
      if (ctx.state === 'running') {
        if (this.mood !== 'none') this.startScheduler();
        return;
      }
      const p = ctx.resume();
      if (p && p.then) {
        p.then(() => {
          if (ctx.state === 'running' && this.mood !== 'none') {
            const now = ctx.currentTime;
            if (this.nextNoteTime < now) this.nextNoteTime = now + 0.06;
            this.startScheduler();
          }
        }).catch(() => {});
      }
    };
    resume();
  }

  makeNoise() {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * 1.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  setVolumes({ music, sfx }) {
    if (typeof music === 'number') this.settings.music = Math.max(0, Math.min(1, music));
    if (typeof sfx === 'number') this.settings.sfx = Math.max(0, Math.min(1, sfx));
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const moodGain = this.mood === 'none' ? 0 : (MOODS[this.mood]?.gain ?? 0.55);
    this.musicBus.gain.setTargetAtTime(this.settings.music * MUSIC_BOOST * moodGain, t, 0.08);
    this.sfxBus.gain.setTargetAtTime(this.settings.sfx * SFX_BOOST, t, 0.05);
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.04);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMood(mood) {
    if (this.mood === mood) return;
    this.mood = mood;
    if (!this.ctx) return;
    if (mood === 'none') {
      this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
      this.stopScheduler();
      return;
    }
    this.musicBus.gain.setTargetAtTime(
      this.settings.music * MUSIC_BOOST * (MOODS[mood]?.gain ?? 0.55),
      this.ctx.currentTime,
      0.2,
    );
    this.step = 0;
    this.nextNoteTime = Math.max(this.ctx.currentTime + 0.06, this.nextNoteTime);
    this.startScheduler();
    this.unlock();
  }

  startScheduler() {
    if (this.timer) return;
    this.timer = setInterval(() => this.schedule(), 80);
    this.schedule();
  }

  stopScheduler() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  schedule() {
    if (!this.ctx || !this.timer) return;
    const ctx = this.ctx;
    const config = MOODS[this.mood] || MOODS.camp;
    const stepDur = 60 / config.bpm / 2;
    while (this.nextNoteTime < ctx.currentTime + 0.28) {
      this.playStep(config, this.step, this.nextNoteTime, stepDur);
      this.step = (this.step + 1) % 16;
      this.nextNoteTime += stepDur;
    }
  }

  playStep(config, step, time, stepDur) {
    const bar = Math.floor(step / 8) % config.chords.length;
    const chord = config.chords[bar];
    const beat = step % 8;
    const patternIdx = config.pattern[beat] % chord.length;
    const note = chord[patternIdx];
    const gain = 1.0;

    // plucked lute / harp
    if (beat % 2 === 0 || this.mood === 'boss') {
      this.pluck(NOTE(note + 12), time, stepDur * 1.8, 0.055 * gain, 'triangle');
      if (beat === 0) this.pluck(NOTE(note), time, stepDur * 3, 0.04 * gain, 'sine');
    }
    // sparse melody
    if (beat === 3 || beat === 6) {
      const mel = chord[(patternIdx + 2) % chord.length] + 12;
      this.pluck(NOTE(mel), time + stepDur * 0.5, stepDur * 1.4, 0.035 * gain, 'triangle');
    }
    // pad on bar start
    if (config.pad && step % 8 === 0) {
      const dur = stepDur * 7.4;
      [0, 1, 2].forEach((i) => {
        const n = chord[i] ?? chord[0];
        this.pad(NOTE(n - 12), time, dur, 0.018 * gain, i === 0 ? 'sawtooth' : 'triangle');
      });
    }
    // drums
    if (config.drums) {
      if (step % 8 === 0) this.kick(time, 0.12);
      if (step % 8 === 4) this.snare(time, 0.055);
      if (step % 2 === 1) this.hat(time, 0.013);
      if (this.mood === 'boss' && step % 8 === 6) this.kick(time, 0.07);
    }
    if (config.boss && step % 8 === 0) {
      this.pad(NOTE(chord[0] - 24), time, stepDur * 8, 0.035, 'square');
    }
  }

  // ---- instruments ----
  pluck(freq, when, dur, gain, type = 'triangle') {
    const ctx = this.ctx;
    const t = Math.max(when, ctx.currentTime + 0.005);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(5000, freq * 7), t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(300, freq * 1.6), t + dur);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(filter).connect(g).connect(this.musicBus);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  pad(freq, when, dur, gain, type = 'sawtooth') {
    const ctx = this.ctx;
    const t = Math.max(when, ctx.currentTime + 0.005);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.max(240, freq * 4);
    filter.Q.value = 0.7;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.5);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(filter).connect(g).connect(this.musicBus);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  kick(when, gain) {
    const ctx = this.ctx;
    const t = Math.max(when, ctx.currentTime + 0.004);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(g).connect(this.musicBus);
    osc.start(t); osc.stop(t + 0.18);
  }

  snare(when, gain) {
    const ctx = this.ctx;
    const t = Math.max(when, ctx.currentTime + 0.004);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 1800; filter.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    src.connect(filter).connect(g).connect(this.musicBus);
    src.start(t); src.stop(t + 0.12);
  }

  hat(when, gain) {
    const ctx = this.ctx;
    const t = Math.max(when, ctx.currentTime + 0.004);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    src.connect(filter).connect(g).connect(this.musicBus);
    src.start(t); src.stop(t + 0.04);
  }

  // ---- sfx ----
  sfx(name) {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state !== 'running') this.unlock();
    const now = this.ctx.currentTime;
    const last = this.lastSfx.get(name) || 0;
    if (now - last < 0.028) return;
    this.lastSfx.set(name, now);
    const fn = this[`sfx_${name}`];
    if (fn) fn.call(this, now);
  }

  sfx_jump(t) { this.tone({ freq: 250, to: 540, dur: 0.14, gain: 0.14, type: 'square', when: t }); }
  sfx_doubleJump(t) { this.tone({ freq: 420, to: 820, dur: 0.16, gain: 0.12, type: 'triangle', when: t }); }
  sfx_dash(t) { this.noise({ when: t, dur: 0.2, gain: 0.13, filter: 'bandpass', freq: 1800, to: 500, q: 1.2 }); }
  sfx_land(t) { this.tone({ freq: 110, to: 60, dur: 0.1, gain: 0.1, type: 'sine', when: t }); }
  sfx_sword(t) {
    this.noise({ when: t, dur: 0.18, gain: 0.2, filter: 'highpass', freq: 1500, to: 5200, q: 0.75 });
    this.tone({ freq: 760, to: 300, dur: 0.11, gain: 0.08, type: 'triangle', when: t });
    this.tone({ freq: 130, to: 58, dur: 0.08, gain: 0.05, type: 'sine', when: t });
  }
  sfx_hit(t) {
    this.tone({ freq: 170, to: 62, dur: 0.14, gain: 0.24, type: 'sine', when: t });
    this.noise({ when: t, dur: 0.1, gain: 0.18, filter: 'bandpass', freq: 900, q: 0.7 });
  }
  sfx_hurt(t) {
    this.tone({ freq: 240, to: 90, dur: 0.3, gain: 0.18, type: 'sawtooth', when: t });
    this.noise({ when: t, dur: 0.16, gain: 0.12, filter: 'lowpass', freq: 900 });
  }
  sfx_coin(t) {
    this.tone({ freq: 1160, dur: 0.07, gain: 0.06, type: 'square', when: t });
    this.tone({ freq: 1740, dur: 0.09, gain: 0.045, type: 'square', when: t + 0.04 });
  }
  sfx_material(t) {
    this.tone({ freq: 880, to: 1320, dur: 0.16, gain: 0.06, type: 'sine', when: t });
    this.tone({ freq: 1760, dur: 0.1, gain: 0.025, type: 'triangle', when: t + 0.05 });
  }
  sfx_chest(t) {
    [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.18, gain: 0.06, type: 'triangle', when: t + i * 0.07 }));
    this.noise({ when: t, dur: 0.2, gain: 0.08, filter: 'bandpass', freq: 1200 });
  }
  sfx_potion(t) {
    this.tone({ freq: 320, to: 620, dur: 0.25, gain: 0.075, type: 'sine', when: t });
    this.tone({ freq: 620, to: 900, dur: 0.2, gain: 0.045, type: 'sine', when: t + 0.12 });
  }
  sfx_skill(t) {
    this.noise({ when: t, dur: 0.5, gain: 0.22, filter: 'bandpass', freq: 300, to: 2400, q: 0.8 });
    this.tone({ freq: 90, to: 48, dur: 0.5, gain: 0.2, type: 'sine', when: t });
  }
  sfx_fireball(t) {
    this.noise({ when: t, dur: 0.32, gain: 0.17, filter: 'lowpass', freq: 1900, to: 280 });
    this.tone({ freq: 320, to: 110, dur: 0.26, gain: 0.11, type: 'sawtooth', when: t });
    this.tone({ freq: 1100, to: 480, dur: 0.12, gain: 0.035, type: 'sine', when: t });
  }
  sfx_arrow(t) {
    this.noise({ when: t, dur: 0.14, gain: 0.12, filter: 'highpass', freq: 2600, to: 6800 });
    this.tone({ freq: 620, to: 310, dur: 0.09, gain: 0.045, type: 'triangle', when: t });
    this.tone({ freq: 1500, dur: 0.035, gain: 0.018, type: 'sine', when: t });
  }
  sfx_explode(t) {
    this.tone({ freq: 100, to: 38, dur: 0.5, gain: 0.25, type: 'sine', when: t });
    this.noise({ when: t, dur: 0.5, gain: 0.2, filter: 'lowpass', freq: 1800, to: 180 });
  }
  sfx_checkpoint(t) {
    [392, 523, 659, 784].forEach((f, i) => this.tone({ freq: f, dur: 0.5, gain: 0.04, type: 'sine', when: t + i * 0.1 }));
  }
  sfx_portal(t) {
    [523, 784, 1046, 1318].forEach((f, i) => this.tone({ freq: f, dur: 0.5, gain: 0.04, type: 'triangle', when: t + i * 0.08 }));
  }
  sfx_levelup(t) {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone({ freq: f, dur: 0.3, gain: 0.055, type: 'triangle', when: t + i * 0.09 }));
  }
  sfx_ui(t) {
    this.tone({ freq: 540, to: 700, dur: 0.07, gain: 0.055, type: 'triangle', when: t });
    this.tone({ freq: 1080, dur: 0.045, gain: 0.016, type: 'sine', when: t + 0.018 });
  }
  sfx_uiHover(t) {
    this.tone({ freq: 720, to: 800, dur: 0.045, gain: 0.016, type: 'sine', when: t });
  }
  sfx_boss(t) {
    this.tone({ freq: 70, to: 35, dur: 1.2, gain: 0.28, type: 'sawtooth', when: t });
    this.noise({ when: t, dur: 1.2, gain: 0.12, filter: 'lowpass', freq: 600, to: 120 });
  }
  sfx_roar(t) {
    this.tone({ freq: 82, to: 42, dur: 1.5, gain: 0.24, type: 'sawtooth', when: t });
    this.tone({ freq: 120, to: 55, dur: 1.4, gain: 0.1, type: 'square', when: t });
    this.noise({ when: t, dur: 1.2, gain: 0.08, filter: 'lowpass', freq: 900, to: 200 });
  }
  sfx_death(t) {
    [330, 262, 196, 147].forEach((f, i) => this.tone({ freq: f, dur: 0.5, gain: 0.06, type: 'triangle', when: t + i * 0.12 }));
  }

  tone({ freq, to, dur = 0.2, gain = 0.1, type = 'sine', when = 0 }) {
    const ctx = this.ctx;
    const t = Math.max(when, ctx.currentTime + 0.004);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  noise({ when = 0, dur = 0.2, gain = 0.1, filter = 'bandpass', freq = 1000, to = null, q = 0.8 }) {
    const ctx = this.ctx;
    const t = Math.max(when, ctx.currentTime + 0.004);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(Math.max(60, to), t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}
