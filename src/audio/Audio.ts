// Original, fully synthesised audio: toy piano, bells, plucks, soft pads, tiny percussion.
// No audio files, no copyrighted music. Starts only after a user gesture.

export type TrackId =
  | 'title' | 'school' | 'dance' | 'vocal' | 'cafe' | 'stage' | 'metro' | 'beach' | 'chase' | 'dress' | 'eat' | 'yard' | 'none';

export type SfxId =
  | 'pop' | 'step' | 'heart' | 'coin' | 'blip' | 'whoosh' | 'woof' | 'baa' | 'fail' | 'success' | 'tap'
  | 'perfect' | 'good' | 'miss' | 'door' | 'train' | 'chime' | 'cheer' | 'camera' | 'jump' | 'bump' | 'eat'
  | 'sparkle' | 'unlock' | 'select' | 'back' | 'count' | 'go' | 'splash' | 'squeak';

type Inst = 'bell' | 'piano' | 'pluck' | 'soft';
interface Track {
  bpm: number;
  key: number; // midi root
  chords: [number, 'M' | 'm'][]; // per bar, degree offset in semitones from key
  mel: string[]; // per bar, 8 tokens (8th notes)
  inst: Inst;
  drums?: string; // 8 chars per bar: k=kick s=snare h=hat .=none
  pad?: boolean;
  bassPat?: string; // 8 chars: r=root f=fifth o=octave .=none
  swing?: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];

const T: Record<Exclude<TrackId, 'none'>, Track> = {
  title: {
    bpm: 92, key: 72, inst: 'bell', pad: true, bassPat: 'r...f...',
    chords: [[0, 'M'], [9, 'm'], [5, 'M'], [7, 'M']],
    mel: ['3 - 5 - 1+ - 7 5', '6 - - 5 3 - - -', '4 - 6 - 1+ - 6 4', '5 - - 3 2 - 5 -'],
  },
  school: {
    bpm: 108, key: 65, inst: 'piano', drums: 'k.h.s.h.', bassPat: 'r.f.r.f.',
    chords: [[0, 'M'], [5, 'M'], [9, 'm'], [7, 'M']],
    mel: ['1 3 5 3 6 5 3 -', '4 6 1+ 6 5 - 4 3', '6 5 3 1 2 3 5 -', '5 4 3 2 1 - - -'],
  },
  yard: {
    bpm: 104, key: 67, inst: 'piano', drums: 'k...s..h', bassPat: 'r..fr.f.', pad: true,
    chords: [[0, 'M'], [4, 'm'], [5, 'M'], [7, 'M']],
    mel: ['5 - 3 5 1+ - 7 6', '5 - 3 - 2 3 - -', '6 - 4 6 1+ - 7 6', '5 3 2 3 1 - - -'],
  },
  dance: {
    bpm: 112, key: 62, inst: 'pluck', drums: 'k.hsk.hs', bassPat: 'r.ro.rfo',
    chords: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']],
    mel: ['1 - 3 5 - 3 5 6', '5 - 3 - 1 - 2 3', '3 - 5 1+ - 6 5 3', '2 3 5 - 3 2 1 -'],
  },
  vocal: {
    bpm: 84, key: 69, inst: 'piano', pad: true, bassPat: 'r...r.f.',
    chords: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']],
    mel: ['3 - - 5 3 2 1 -', '2 - - 3 5 - - -', '1 - - 3 6 5 3 -', '4 - 3 - 2 - - -'],
  },
  cafe: {
    bpm: 116, key: 70, inst: 'piano', drums: 'k.h.k.h.', bassPat: 'r.o.f.o.',
    chords: [[0, 'M'], [9, 'm'], [2, 'm'], [7, 'M']],
    mel: ['5 5 6 5 3 - 1 -', '6 6 1+ 6 5 - 3 -', '4 4 6 4 2 - 5 -', '5 4 3 2 1 - - -'],
  },
  stage: {
    bpm: 120, key: 64, inst: 'bell', drums: 'k.hsk.hs', pad: true, bassPat: 'r.ror.fo',
    chords: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']],
    mel: ['1+ - 7 - 5 - 3 5', '5 - 4 - 2 - 5 -', '6 - 5 - 3 - 1+ -', '2+ 1+ 7 5 1+ - - -'],
  },
  metro: {
    bpm: 100, key: 67, inst: 'pluck', drums: 'h.h.h.hh', bassPat: 'r...f...', pad: true,
    chords: [[0, 'M'], [2, 'm'], [4, 'm'], [5, 'M']],
    mel: ['1 3 5 1+ 5 3 - -', '2 4 6 2+ 6 4 - -', '3 5 7 3+ 7 5 - -', '4 3 2 1 - - - -'],
  },
  beach: {
    bpm: 80, key: 65, inst: 'pluck', pad: true, bassPat: 'r..f..r.',
    chords: [[0, 'M'], [5, 'M'], [0, 'M'], [7, 'M']],
    mel: ['3 - 5 - 6 - 5 -', '1+ - - 6 5 - - -', '3 - 5 - 6 - 1+ -', '2+ - 1+ - 6 - 5 -'],
  },
  chase: {
    bpm: 150, key: 67, inst: 'pluck', drums: 'kshskshs', bassPat: 'rorororo',
    chords: [[0, 'M'], [0, 'M'], [5, 'M'], [7, 'M']],
    mel: ['1 1 3 3 5 5 3 -', '1+ 7 6 5 4 3 2 -', '4 4 6 6 1+ 1+ 6 -', '5 5 7 7 2+ 1+ 7 5'],
  },
  dress: {
    bpm: 100, key: 72, inst: 'bell', pad: true, drums: '....s...', bassPat: 'r...f...',
    chords: [[0, 'M'], [4, 'm'], [5, 'M'], [7, 'M']],
    mel: ['5 3 1 3 5 - 1+ -', '7 5 3 5 7 - - -', '6 4 1 4 6 - 1+ -', '2+ 7 5 7 1+ - - -'],
  },
  eat: {
    bpm: 124, key: 67, inst: 'piano', drums: 'k.h.s.hh', bassPat: 'r.f.o.f.',
    chords: [[0, 'M'], [5, 'M'], [7, 'M'], [0, 'M']],
    mel: ['1 2 3 5 3 2 1 -', '4 5 6 1+ 6 5 4 -', '5 6 7 2+ 7 6 5 -', '1+ 5 3 5 1 - - -'],
  },
};

function tokenToMidi(tok: string, key: number): number | null {
  if (tok === '-' || tok === '~') return null;
  let oct = 0;
  let t = tok;
  while (t.endsWith('+')) { oct += 12; t = t.slice(0, -1); }
  while (t.endsWith('_')) { oct -= 12; t = t.slice(0, -1); }
  const d = parseInt(t, 10);
  if (!d) return null;
  return key + MAJOR[(d - 1) % 7] + Math.floor((d - 1) / 7) * 12 + oct;
}
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioSystem {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private musicFade!: GainNode;
  private noiseBuf!: AudioBuffer;
  private track: Track | null = null;
  private trackId: TrackId = 'none';
  private step = 0;
  private nextTime = 0;
  private trackStart = 0;
  private timer = 0;
  private amb: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private vol = { master: 0.8, music: 0.6, sfx: 0.8, muted: false };
  private wantTrack: TrackId = 'none';
  private wantAmb: string | null = null;

  /** Call from a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.connect(this.master);
    this.musicBus = c.createGain();
    this.musicFade = c.createGain();
    this.musicBus.connect(this.musicFade);
    this.musicFade.connect(comp);
    this.sfxBus = c.createGain();
    this.sfxBus.connect(comp);
    // noise
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.timer = window.setInterval(() => this.schedule(), 25);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
    if (this.wantTrack !== 'none') this.playMusic(this.wantTrack, true);
    if (this.wantAmb) this.ambience(this.wantAmb);
  }

  setVolumes(v: { master: number; music: number; sfx: number; muted: boolean }) {
    this.vol = { ...v };
    this.applyVolumes();
  }
  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : this.vol.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
  }

  get currentTrack() { return this.trackId; }

  playMusic(id: TrackId, force = false) {
    this.wantTrack = id;
    if (!this.ctx) return;
    if (id === this.trackId && !force) return;
    const c = this.ctx;
    const t = c.currentTime;
    this.musicFade.gain.cancelScheduledValues(t);
    this.musicFade.gain.setValueAtTime(this.musicFade.gain.value, t);
    this.musicFade.gain.linearRampToValueAtTime(0, t + 0.35);
    const start = t + 0.4;
    setTimeout(() => {
      this.trackId = id;
      this.track = id === 'none' ? null : T[id];
      this.step = 0;
      this.nextTime = Math.max(c.currentTime + 0.05, start);
      this.trackStart = this.nextTime;
      this.musicFade.gain.cancelScheduledValues(c.currentTime);
      this.musicFade.gain.setValueAtTime(0, c.currentTime);
      this.musicFade.gain.linearRampToValueAtTime(1, c.currentTime + 0.6);
    }, 380);
  }

  /** Current beat position of the playing track (for rhythm games). */
  beat() {
    if (!this.ctx || !this.track) return 0;
    return ((this.ctx.currentTime - this.trackStart) * this.track.bpm) / 60;
  }
  get bpm() { return this.track?.bpm ?? 120; }
  now() { return this.ctx?.currentTime ?? performance.now() / 1000; }

  private schedule() {
    const c = this.ctx;
    const tr = this.track;
    if (!c || !tr) return;
    const stepDur = 60 / tr.bpm / 2;
    while (this.nextTime < c.currentTime + 0.12) {
      const bars = tr.mel.length;
      const bar = Math.floor(this.step / 8) % bars;
      const s = this.step % 8;
      const t = this.nextTime + (s % 2 ? (tr.swing ?? 0) * stepDur : 0);
      const [cdeg, ctype] = tr.chords[bar % tr.chords.length];
      const root = tr.key + cdeg - 12;
      // melody
      const tok = tr.mel[bar].split(' ')[s];
      const m = tok ? tokenToMidi(tok, tr.key) : null;
      if (m !== null) {
        let len = 1;
        const toks = tr.mel[bar].split(' ');
        while (s + len < 8 && toks[s + len] === '-') len++;
        this.note(tr.inst, hz(m), t, Math.min(len, 3) * stepDur, 0.16);
      }
      // bass
      const bp = tr.bassPat?.[s];
      if (bp && bp !== '.') {
        const off = bp === 'f' ? 7 : bp === 'o' ? 12 : 0;
        this.note('bass', hz(root - 12 + off), t, stepDur * 1.6, 0.16);
      }
      // pad on bar start
      if (tr.pad && s === 0) {
        const third = ctype === 'M' ? 4 : 3;
        for (const iv of [0, third, 7]) this.note('pad', hz(root + 12 + iv), t, stepDur * 8, 0.035);
      }
      // drums
      const dch = tr.drums?.[s];
      if (dch === 'k') this.kick(t, 0.35);
      else if (dch === 's') this.snare(t, 0.14);
      if (dch === 'h' || dch === 's') this.hat(t, 0.05);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private env(g: GainNode, t: number, a: number, peak: number, dur: number, rel = 0.08) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.3), t + a + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur + rel);
  }

  private note(inst: Inst | 'bass' | 'pad', f: number, t: number, dur: number, vol: number, bus?: AudioNode) {
    const c = this.ctx!;
    const out = bus ?? this.musicBus;
    const g = c.createGain();
    g.connect(out);
    const end = t + dur + 0.6;
    const osc = (type: OscillatorType, freq: number, gain = 1, det = 0) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = det;
      if (gain !== 1) {
        const gg = c.createGain();
        gg.gain.value = gain;
        o.connect(gg);
        gg.connect(g);
      } else o.connect(g);
      o.start(t);
      o.stop(end);
      return o;
    };
    switch (inst) {
      case 'bell': {
        osc('sine', f);
        osc('sine', f * 2.01, 0.25);
        osc('sine', f * 3.98, 0.08);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.5, dur * 2.5));
        break;
      }
      case 'piano': {
        osc('triangle', f);
        osc('sine', f * 2, 0.18);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol * 1.1, t + 0.006);
        g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.18);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
        break;
      }
      case 'pluck': {
        const o = osc('square', f, 0.4);
        void o;
        osc('triangle', f, 0.8);
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(f * 6, t);
        lp.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.25);
        g.disconnect();
        g.connect(lp);
        lp.connect(out);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol * 0.9, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(0.5, dur + 0.25));
        break;
      }
      case 'soft': {
        osc('sine', f);
        this.env(g, t, 0.02, vol, dur);
        break;
      }
      case 'bass': {
        osc('sine', f);
        osc('triangle', f, 0.3);
        this.env(g, t, 0.01, vol, dur * 0.7, 0.1);
        break;
      }
      case 'pad': {
        osc('sawtooth', f, 0.5, -7);
        osc('sawtooth', f, 0.5, 7);
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 900;
        g.disconnect();
        g.connect(lp);
        lp.connect(out);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.4);
        g.gain.linearRampToValueAtTime(vol * 0.8, t + dur - 0.2);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
        break;
      }
    }
  }

  private noise(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, out?: AudioNode, q = 1) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    src.connect(f);
    f.connect(g);
    g.connect(out ?? this.musicBus);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
    return { f, g };
  }
  private kick(t: number, v: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.2);
  }
  private snare(t: number, v: number) { this.noise(t, 0.12, v, 'bandpass', 2400, undefined, 0.8); }
  private hat(t: number, v: number) { this.noise(t, 0.04, v, 'highpass', 7500); }

  // ---------- SFX ----------
  sfx(id: SfxId, vol = 1) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + 0.005;
    const b = this.sfxBus;
    const n = (m: number, at: number, dur: number, v: number, inst: Inst | 'bass' = 'bell') => this.note(inst, hz(m), t + at, dur, v * vol, b);
    const sweep = (f0: number, f1: number, dur: number, v: number, type: OscillatorType = 'sine', at = 0) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t + at);
      o.frequency.exponentialRampToValueAtTime(f1, t + at + dur);
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(v * vol, t + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      o.connect(g);
      g.connect(b);
      o.start(t + at);
      o.stop(t + at + dur + 0.02);
    };
    switch (id) {
      case 'pop': sweep(500, 1100, 0.08, 0.25); break;
      case 'tap': sweep(900, 1300, 0.05, 0.12, 'triangle'); break;
      case 'select': n(84, 0, 0.1, 0.18); n(88, 0.06, 0.1, 0.15); break;
      case 'back': n(86, 0, 0.1, 0.15); n(81, 0.06, 0.1, 0.12); break;
      case 'step': this.noise(t, 0.05, 0.05 * vol, 'lowpass', 900, b); break;
      case 'blip': sweep(700 + Math.random() * 250, 760 + Math.random() * 250, 0.045, 0.07, 'square'); break;
      case 'heart': n(88, 0, 0.1, 0.2); n(92, 0.07, 0.1, 0.2); n(95, 0.14, 0.2, 0.2); break;
      case 'coin': n(91, 0, 0.06, 0.2); n(96, 0.06, 0.2, 0.2); break;
      case 'sparkle': for (let i = 0; i < 5; i++) n(96 + i * 2, i * 0.04, 0.08, 0.08); break;
      case 'chime': n(84, 0, 0.3, 0.2); n(88, 0.12, 0.3, 0.2); n(91, 0.24, 0.5, 0.2); break;
      case 'unlock': n(79, 0, 0.1, 0.2); n(84, 0.08, 0.1, 0.2); n(88, 0.16, 0.1, 0.2); n(91, 0.24, 0.4, 0.22); n(96, 0.32, 0.6, 0.15); break;
      case 'success': n(72, 0, 0.12, 0.2, 'piano'); n(76, 0.12, 0.12, 0.2, 'piano'); n(79, 0.24, 0.12, 0.2, 'piano'); n(84, 0.36, 0.5, 0.24, 'piano'); break;
      case 'fail': n(67, 0, 0.18, 0.18, 'piano'); n(66, 0.2, 0.18, 0.18, 'piano'); n(65, 0.4, 0.5, 0.18, 'piano'); break;
      case 'perfect': n(91, 0, 0.1, 0.22); n(96, 0.05, 0.2, 0.2); break;
      case 'good': n(88, 0, 0.12, 0.2); break;
      case 'miss': sweep(300, 180, 0.15, 0.15, 'triangle'); break;
      case 'whoosh': this.noise(t, 0.35, 0.18 * vol, 'bandpass', 1200, b, 0.6).f.frequency.exponentialRampToValueAtTime(300, t + 0.35); break;
      case 'door': n(76, 0, 0.12, 0.15, 'piano'); n(83, 0.1, 0.25, 0.15, 'piano'); break;
      case 'woof': sweep(420, 260, 0.1, 0.35, 'sawtooth'); sweep(460, 280, 0.12, 0.3, 'sawtooth', 0.16); this.noise(t, 0.08, 0.1 * vol, 'bandpass', 800, b); break;
      case 'baa': {
        const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
        o.type = 'sawtooth'; o.frequency.value = 520; lfo.frequency.value = 22; lg.gain.value = 30;
        lfo.connect(lg); lg.connect(o.frequency);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 * vol, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(lp); lp.connect(g); g.connect(b); o.start(t); lfo.start(t); o.stop(t + 0.55); lfo.stop(t + 0.55);
        break;
      }
      case 'squeak': sweep(1200, 1800, 0.1, 0.12, 'sine'); sweep(1800, 1300, 0.08, 0.1, 'sine', 0.1); break;
      case 'train': this.noise(t, 1.2, 0.08 * vol, 'lowpass', 400, b); n(79, 0, 0.3, 0.15); n(76, 0.3, 0.6, 0.15); break;
      case 'cheer': for (let i = 0; i < 6; i++) this.noise(t + i * 0.05, 0.6, 0.05 * vol, 'bandpass', 1200 + Math.random() * 1500, b, 2); n(84, 0, 0.2, 0.1); n(91, 0.15, 0.4, 0.1); break;
      case 'camera': this.noise(t, 0.06, 0.25 * vol, 'highpass', 3000, b); this.noise(t + 0.09, 0.08, 0.2 * vol, 'highpass', 2000, b); break;
      case 'jump': sweep(350, 800, 0.15, 0.18, 'triangle'); break;
      case 'bump': sweep(200, 90, 0.18, 0.3, 'sine'); this.noise(t, 0.1, 0.1 * vol, 'lowpass', 600, b); break;
      case 'eat': this.noise(t, 0.06, 0.12 * vol, 'bandpass', 1500, b); this.noise(t + 0.12, 0.06, 0.1 * vol, 'bandpass', 1300, b); sweep(600, 900, 0.08, 0.1, 'sine', 0.2); break;
      case 'splash': this.noise(t, 0.4, 0.2 * vol, 'lowpass', 1500, b); break;
      case 'count': n(81, 0, 0.12, 0.2, 'piano'); break;
      case 'go': n(88, 0, 0.12, 0.22, 'piano'); n(93, 0.1, 0.3, 0.22, 'piano'); break;
    }
  }

  /** Looping ambience: 'waves' | 'crowd' | 'train' | null */
  ambience(kind: string | null) {
    this.wantAmb = kind;
    const c = this.ctx;
    if (!c) return;
    if (this.amb) {
      const a = this.amb;
      a.gain.gain.setTargetAtTime(0, c.currentTime, 0.3);
      setTimeout(() => a.src.stop(), 1500);
      this.amb = null;
    }
    if (!kind) return;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = kind === 'waves' ? 600 : kind === 'train' ? 250 : 1200;
    const g = c.createGain();
    g.gain.value = 0;
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = kind === 'waves' ? 0.12 : kind === 'train' ? 2.2 : 0.3;
    lg.gain.value = kind === 'waves' ? 0.05 : 0.015;
    lfo.connect(lg);
    lg.connect(g.gain);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    g.gain.setTargetAtTime(kind === 'waves' ? 0.07 : 0.035, c.currentTime, 0.5);
    src.start();
    lfo.start();
    this.amb = { src, gain: g };
  }
}
