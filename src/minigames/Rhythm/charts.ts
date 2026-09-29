// Hand-authored rhythm charts for Dance & Vocal practice.
//
// Charts are written like the synth tracks in src/audio/Audio.ts: one string per bar, 8 slots per bar
// (eighth notes), so every note sits on the real music grid. Beats are ABSOLUTE track beats
// (beat 0 = the moment playMusic(mode, true) restarts the song), which keeps the notes glued to the
// melody: the dance/vocal melodies loop every 4 bars (16 beats).
//
//   dance  (112 bpm)  o = ♡ tap   < > ^ v = swipe / arrow   * = finale ♡
//   vocal  ( 84 bpm)  h m l = tap on the high / mid / low row   H M L = hold start   - = keep holding
//
// Dance melody onsets (per bar):  A x.xx.xxx  B x.x.x.xx  C x.xx.xxx  D xxx.xxx.   (chart starts on bar C)
// Vocal melody + pitch:           A m..hmll.  B l..mH---  C l..mhhm.  D m.m.L---   (chart starts on bar B)

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];
export type Dir = 'L' | 'R' | 'U' | 'D';
export type NoteKind = 'tap' | Dir;

export interface ChartNote {
  beat: number; // absolute track beat
  kind: NoteKind;
  row: number; // vocal pitch row: 0 high · 1 mid · 2 low (dance: always 1)
  len: number; // hold length in beats (0 = tap)
  finale: boolean;
}

export interface DiffCfg {
  label: string;
  emoji: string;
  perfect: number; // seconds
  good: number;
  early: number; // pressing this early (but outside GOOD) breaks the note; 0 = never
  lenient: boolean; // wrong arrow / wrong row still counts as Good
  hearts: number; // heart reward multiplier
}

export const DIFF: Record<Difficulty, DiffCfg> = {
  easy: { label: 'Easy', emoji: '🌱', perfect: 0.1, good: 0.19, early: 0, lenient: true, hearts: 0.75 },
  normal: { label: 'Normal', emoji: '🌸', perfect: 0.085, good: 0.165, early: 0.3, lenient: false, hearts: 1 },
  hard: { label: 'Hard', emoji: '🔥', perfect: 0.07, good: 0.14, early: 0.28, lenient: false, hearts: 1.3 },
};

export interface SongChart {
  start: number; // absolute beat of the first bar
  lead: Record<Difficulty, number>; // seconds a note is visible before it reaches the heart
  bars: Record<Difficulty, string[]>;
}

export const SONGS: Record<'dance' | 'vocal', SongChart> = {
  dance: {
    start: 8, // "Ready?" bar, then a 5·6·7·8 count-in bar
    lead: { easy: 2.0, normal: 1.7, hard: 1.4 },
    bars: {
      easy: [
        // warm-up: heartbeat taps
        'o...o...', 'o...o...', 'o.o.o...', 'o...o...',
        // verse: step left, step right, a little jump
        '<...>...', 'o...o...', '<...>...', 'o.o.^...',
        // chorus: dips & jumps
        '<...>...', 'o.o.v...', '<...>...', '^...o...',
        // finale: step-touch build-up
        '<.>.<.>.', 'o.o.o.o.', '^...v...', 'o.o.o...',
        '*.......',
      ],
      normal: [
        'o.o.o.o.', 'ooo.o...', '<...>...', 'o.o.o.oo',
        '<.>.<.>.', 'ooo.^...', '<.o.>.^.', 'v.o.v.oo',
        '<.>.^.v.', 'ooo.<.>.', '<.>.^.oo', 'v.o.^.oo',
        '<.>.<.>.', 'ooo.ooo.', '^.v.^.v.', '<.>.o.oo',
        '*.......',
      ],
      hard: [
        'o.oo.ooo', 'ooo.ooo.', '<.o>.o^o', 'v.<.>.oo',
        '<.>.<.>.', 'ooo.^.v.', '<.o>.o^o', 'v.v.^.oo',
        '<.o>.<o>', 'ooo.^v^.', '^.o<.o>o', 'v.<.>.oo',
        '<><>^.v.', 'ooo.ooo.', '^v^v<.>.', '<.>.o.oo',
        '*.......',
      ],
    },
  },
  vocal: {
    start: 4, // count-in bar, then the song
    lead: { easy: 2.4, normal: 2.1, hard: 1.75 },
    bars: {
      easy: [
        'l...H---', 'L--.h.m.', 'm.m.L---', 'm...m.l.',
        'l...H---', 'L--.h.m.', 'm.m.L---', 'M---m.l.',
        'l.m.H---', 'L--.h.m.', 'm.m.L---', 'm...l...',
        'M-------',
      ],
      normal: [
        'l..mH---', 'L-.mh.m.', 'm.m.L---', 'm..hm.l.',
        'l..mH---', 'l..mhhm.', 'm.m.L---', 'M-.hmll.',
        'L-.mH---', 'l..mhhm.', 'm.m.L-h.', 'm..hmll.',
        'H-------',
      ],
      hard: [
        'l.mmH---', 'L-lmhhm.', 'mhm.L-hm', 'm.hhmll.',
        'l.lmH-mh', 'L-.mhhmm', 'mhm.L---', 'M-hhmll.',
        'l.lmH---', 'l.lmhhml', 'mhmhL---', 'm.hhmlll',
        'H-------',
      ],
    },
  },
};

const DANCE_KIND: Record<string, NoteKind> = { o: 'tap', '*': 'tap', '<': 'L', '>': 'R', '^': 'U', v: 'D' };
const ROW: Record<string, number> = { h: 0, m: 1, l: 2 };

/** Turn bar strings into notes (absolute beats, sorted). Holds may run across bar lines. */
export function buildChart(mode: 'dance' | 'vocal', diff: Difficulty): ChartNote[] {
  const song = SONGS[mode];
  const slots = song.bars[diff].join('');
  const out: ChartNote[] = [];
  for (let i = 0; i < slots.length; i++) {
    const c = slots[i];
    if (c === '.' || c === '-' || c === ' ') continue;
    const beat = song.start + i * 0.5;
    if (mode === 'dance') {
      const kind = DANCE_KIND[c];
      if (kind) out.push({ beat, kind, row: 1, len: 0, finale: c === '*' });
      continue;
    }
    const lower = c.toLowerCase();
    if (!(lower in ROW)) continue;
    let len = 0;
    if (c !== lower) {
      let j = i + 1;
      while (slots[j] === '-') j++;
      len = Math.max(1, (j - i) * 0.5);
    }
    out.push({ beat, kind: 'tap', row: ROW[lower], len, finale: false });
  }
  if (out.length) out[out.length - 1].finale = true;
  return out;
}
