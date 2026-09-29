// Designed obstacle patterns + course layout for Dog Chase.
// The course is laid out once per run (a few hundred small objects, no per-frame allocations):
// themed zones → patterns picked by a difficulty curve → hearts in shapes → power-ups → a mid-run
// sheep parade. Every row is always beatable: tall things = dodge, low things = jump,
// banners = slide, sheep = dodge or hop.
import { TILE } from './models';

export type Kind = 'bench' | 'box' | 'bike' | 'pot' | 'puddle' | 'sign' | 'bag' | 'sheep' | 'banner' | 'hurdle' | 'cart';
export type PowerKind = 'bone' | 'magnet' | 'sheep' | 'star';
export type Tip = 'jump' | 'slide' | 'dodge';

export interface Ev {
  d: number;
  kind: Kind | 'heart' | 'power';
  lane: number;
  /** explicit x (hearts in shapes); otherwise the lane centre */
  x?: number;
  y?: number;
  dir?: number;
  /** extra lateral start offset for parade sheep (m, against the walking direction) */
  xo?: number;
  pw?: PowerKind;
}

export interface Mark {
  d: number;
  kind: 'zone' | 'tip' | 'event' | 'milestone' | 'final';
  text: string;
  sub?: string;
  tip?: Tip;
}

export const LANES = [-1.7, 0, 1.7];
export const N_ZONE_TILES = [5, 5, 6, 5]; // school, park, flowers, bakery → 21 tiles
export const LENGTH = TILE * 21; // 546 m → ~60 s

export interface Zone { id: 'school' | 'park' | 'flowers' | 'bakery'; from: number; tiles: number[]; name: string; sub: string; low: Kind[]; tall: Kind[] }
export const ZONES: Zone[] = [
  { id: 'school', from: 0, tiles: [3, 1], name: '🏫 School Street', sub: 'Mind the school bags!', low: ['bag', 'box', 'hurdle'], tall: ['sign', 'bike'] },
  { id: 'park', from: TILE * 5, tiles: [0], name: '🌳 Sunny Park', sub: 'Benches, puddles and flower pots!', low: ['bench', 'pot', 'hurdle'], tall: ['bike', 'sign'] },
  { id: 'flowers', from: TILE * 10, tiles: [2], name: '🌸 Flower Field', sub: 'The sheep are out for a stroll~', low: ['pot', 'hurdle', 'box'], tall: ['sign', 'bike'] },
  { id: 'bakery', from: TILE * 16, tiles: [4], name: '🧁 Bakery Lane', sub: 'Almost there! Smell the cookies~', low: ['box', 'hurdle', 'bag'], tall: ['cart', 'sign'] },
];

export function zoneAt(d: number) {
  for (let i = ZONES.length - 1; i >= 0; i--) if (d >= ZONES[i].from) return i;
  return 0;
}

/** Tile geometry variant for ground tile k (k * TILE = start distance). */
export function tileVariant(k: number) {
  const z = ZONES[zoneAt(k * TILE + 1)];
  return z.tiles[((k % z.tiles.length) + z.tiles.length) % z.tiles.length];
}

const ri = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: readonly T[]) => a[ri(a.length)];
const shuffle = <T,>(a: T[]) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = ri(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Heart y for a heart that should be collected while jumping at offset u∈[-1,1] around the apex. */
const arcY = (u: number) => 0.95 + 1.15 * (1 - u * u);

class Builder {
  evs: Ev[] = [];
  marks: Mark[] = [];
  tipsDone = new Set<Tip>();
  zone: Zone = ZONES[0];

  ob(d: number, kind: Kind, lane: number, dir?: number, xo?: number) {
    this.evs.push({ d, kind, lane, dir, xo });
  }
  low() { return pick(this.zone.low); }
  tall() { return pick(this.zone.tall); }
  heart(d: number, lane: number, y = 0.85, x?: number) {
    this.evs.push({ d, kind: 'heart', lane, y, x });
  }
  line(d: number, lane: number, n: number, gap = 2.2, y = 0.85) {
    for (let i = 0; i < n; i++) this.heart(d + i * gap, lane, y);
  }
  /** hearts along a jump arc centred on d */
  arc(d: number, lane: number) {
    for (let i = -2; i <= 2; i++) this.heart(d + i * 1.5, lane, arcY(i / 2.4));
  }
  /** hearts along a lane change from lane a to lane b (diagonal) */
  diag(d: number, a: number, b: number, n = 4, gap = 1.8) {
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      this.heart(d + i * gap, u < 0.5 ? a : b, 0.85, LANES[a] + (LANES[b] - LANES[a]) * u);
    }
  }
  power(d: number, lane: number, pw: PowerKind) {
    this.evs.push({ d, kind: 'power', lane, pw });
  }
  tip(d: number, tip: Tip) {
    if (this.tipsDone.has(tip)) return;
    this.tipsDone.add(tip);
    const text = tip === 'jump' ? '👆 Low stuff? Jump over it!' : tip === 'slide' ? '👇 Banners? Slide under them!' : '👈 👉 Big stuff? Change lanes!';
    this.marks.push({ d: d - 24, kind: 'tip', text, tip });
  }
}

type PatFn = (d: number, b: Builder) => number; // returns the pattern length (m)
interface Pat { id: string; tier: number; w: number; fn: PatFn }

const other = (l: number) => (l + 1 + ri(2)) % 3;

const PATS: Pat[] = [
  // ---- tier 0: one idea at a time
  {
    id: 'single', tier: 0, w: 3, fn: (d, b) => {
      const lane = ri(3);
      const r = Math.random();
      if (r < 0.45) { b.ob(d, b.low(), lane); b.tip(d, 'jump'); b.arc(d, lane); }
      else if (r < 0.75) { b.ob(d, b.tall(), lane); b.line(d - 3, other(lane), 3); }
      else { b.ob(d, 'banner', lane); b.tip(d, 'slide'); b.line(d - 1.5, lane, 2, 2, 0.55); }
      return 4;
    },
  },
  {
    id: 'hurdles', tier: 0, w: 2, fn: (d, b) => {
      for (let l = 0; l < 3; l++) b.ob(d, l === 1 || Math.random() < 0.5 ? 'hurdle' : b.low(), l);
      b.tip(d, 'jump');
      b.arc(d, ri(3));
      return 4;
    },
  },
  {
    id: 'bunting', tier: 0, w: 2, fn: (d, b) => {
      for (let l = 0; l < 3; l++) b.ob(d, 'banner', l);
      b.tip(d, 'slide');
      b.line(d - 2, ri(3), 3, 2, 0.55);
      return 4;
    },
  },
  {
    id: 'wall2', tier: 0, w: 2, fn: (d, b) => {
      const free = ri(3);
      for (let l = 0; l < 3; l++) if (l !== free) b.ob(d, b.tall(), l);
      b.tip(d, 'dodge');
      b.line(d - 4, free, 4, 2);
      return 4;
    },
  },
  // ---- tier 1: combine lanes & actions
  {
    id: 'zigzag', tier: 1, w: 2, fn: (d, b) => {
      const order = Math.random() < 0.5 ? [0, 1, 2] : [2, 1, 0];
      for (let i = 0; i < 3; i++) {
        const lane = order[i];
        b.ob(d + i * 8, i === 1 ? b.low() : b.tall(), lane);
      }
      // hearts snake through the free lanes
      const safe = order[2];
      b.diag(d - 6, order[0] === 0 ? 2 : 0, safe, 4, 1.6);
      return 18;
    },
  },
  {
    id: 'sheep', tier: 1, w: 2, fn: (d, b) => {
      const lane = ri(3);
      const dir = lane === 0 ? 1 : lane === 2 ? -1 : Math.random() < 0.5 ? 1 : -1;
      b.ob(d, 'sheep', lane, dir);
      b.line(d + 5, other(lane), 3);
      return 6;
    },
  },
  {
    id: 'puddles', tier: 1, w: 1, fn: (d, b) => {
      const dry = ri(3);
      for (let l = 0; l < 3; l++) if (l !== dry) b.ob(d, 'puddle', l);
      b.ob(d, b.low(), dry);
      b.arc(d, dry);
      return 4;
    },
  },
  {
    id: 'mix', tier: 1, w: 3, fn: (d, b) => {
      const ks: Kind[] = shuffle([b.low(), b.tall(), 'banner']);
      for (let l = 0; l < 3; l++) b.ob(d, ks[l], l);
      const jl = ks.findIndex((k) => k !== 'banner' && !['bike', 'sign', 'cart'].includes(k));
      if (jl >= 0) b.arc(d, jl);
      return 4;
    },
  },
  // ---- tier 2: rhythm sections
  {
    id: 'jumpSlide', tier: 2, w: 2, fn: (d, b) => {
      for (let l = 0; l < 3; l++) b.ob(d, 'hurdle', l);
      const lane = ri(3);
      b.arc(d, lane);
      for (let l = 0; l < 3; l++) b.ob(d + 9, 'banner', l);
      b.line(d + 7.5, lane, 3, 1.6, 0.55);
      return 10;
    },
  },
  {
    id: 'slalom', tier: 2, w: 2, fn: (d, b) => {
      let free = Math.random() < 0.5 ? 0 : 2;
      for (let i = 0; i < 3; i++) {
        for (let l = 0; l < 3; l++) if (l !== free) b.ob(d + i * 10, b.tall(), l);
        b.line(d + i * 10 - 2, free, 2, 2);
        free = 2 - free;
      }
      return 22;
    },
  },
  {
    id: 'tunnel', tier: 2, w: 1, fn: (d, b) => {
      const t = ri(3);
      for (let l = 0; l < 3; l++) b.ob(d, l === t ? b.tall() : 'banner', l);
      for (let l = 0; l < 3; l++) b.ob(d + 3.5, l === t ? b.tall() : 'banner', l);
      b.line(d - 1, (t + 1) % 3, 4, 1.6, 0.55);
      return 6;
    },
  },
  // ---- tier 3: faster combos
  {
    id: 'stagger', tier: 3, w: 2, fn: (d, b) => {
      const ls = shuffle([0, 1, 2]);
      b.ob(d, b.tall(), ls[0]);
      b.ob(d + 5, b.low(), ls[1]);
      b.ob(d + 10, 'banner', ls[2]);
      b.ob(d + 10, b.tall(), ls[0]);
      b.arc(d + 5, ls[1]);
      return 12;
    },
  },
  {
    id: 'sheep2', tier: 3, w: 1, fn: (d, b) => {
      b.ob(d, 'sheep', 0, 1);
      b.ob(d + 7, 'sheep', 2, -1);
      b.line(d + 1, 1, 4, 2);
      return 9;
    },
  },
  {
    id: 'hurdleRun', tier: 3, w: 1, fn: (d, b) => {
      const lane = ri(3);
      for (let i = 0; i < 3; i++) {
        for (let l = 0; l < 3; l++) b.ob(d + i * 8.5, l === lane ? 'hurdle' : b.tall(), l);
        b.arc(d + i * 8.5, lane);
      }
      return 19;
    },
  },
];

/** Big heart made of hearts (5 columns), best grabbed with the Heart Magnet. */
function heartGarden(d: number, b: Builder) {
  const rows = ['..X..', '.XXX.', 'XXXXX', 'XXXXX', '.X.X.'];
  rows.forEach((row, r) => {
    for (let c = 0; c < 5; c++) if (row[c] === 'X') b.heart(d + r * 1.8, Math.min(2, Math.round(c / 2)), 0.85, (c - 2) * 0.85);
  });
  return rows.length * 1.8;
}

/** Mid-run event: rows of sheep crossing in a parade — weave through the gaps (or hop them!). */
function sheepParade(d: number, b: Builder) {
  // [lead lane, dir]: two sheep per row → one free lane
  const rows: [number, number][] = [[1, 1], [1, -1], [2, 1], [0, -1], [1, 1]];
  rows.forEach(([lead, dir], i) => {
    const rd = d + i * 11;
    b.ob(rd, 'sheep', lead, dir, 0);
    b.ob(rd, 'sheep', lead, dir, 1.7);
    // free lane = the one not covered by the pair
    const second = lead - dir;
    const free = [0, 1, 2].find((l) => l !== lead && l !== second) ?? 1;
    b.line(rd - 2, free, 2, 2);
  });
  b.marks.push({ d: d - 34, kind: 'event', text: '🐑 Sheep parade!', sub: 'Weave through the flock (or hop over a sheep)!' });
  return rows.length * 11;
}

export function genCourse(): { evs: Ev[]; marks: Mark[] } {
  const b = new Builder();
  const L = LENGTH;
  const ZF = ZONES.map((z) => z.from);

  // ---- power-up slots (star first so everyone sees the shield early)
  const slots: [number, PowerKind][] = [
    [92, 'star'],
    [214, 'bone'],
    [ZF[2] + 66, 'sheep'], // after the parade
    [442, pick(['bone', 'magnet', 'star'] as PowerKind[])],
    [L - 80, 'sheep'], // final dash
  ];
  let slot = 0;

  // ---- set pieces
  const gardenD = ZF[1] - 8; // magnet + heart garden at the park gate
  const paradeD = ZF[2] + 14;
  let garden = false;
  let parade = false;

  let d = 34;
  // tutorial openers (school street): jump → dodge → slide
  PATS[1].fn(d, b); d += 18;
  PATS[3].fn(d, b); d += 18;
  PATS[2].fn(d, b); d += 18;

  let last = '';
  while (d < L - 30) {
    b.zone = ZONES[zoneAt(d)];
    // power-up slot reached → drop it in a lane with a little heart trail
    if (slot < slots.length && d >= slots[slot][0]) {
      const lane = ri(3);
      b.line(d - 5, lane, 2, 2);
      b.power(d, lane, slots[slot][1]);
      slot++;
      d += 10;
      continue;
    }
    if (!garden && d + 18 >= gardenD) {
      garden = true;
      b.power(d, 1, 'magnet');
      b.marks.push({ d: d - 14, kind: 'event', text: '💗 Heart garden!', sub: 'Grab the magnet, then grab ALL the hearts!' });
      d += 20;
      d += heartGarden(d, b) + 12;
      continue;
    }
    if (!parade && d + 18 >= paradeD) {
      parade = true;
      d += sheepParade(d, b) + 10;
      continue;
    }
    const p = d / L;
    const maxTier = p < 0.18 ? 0 : p < 0.4 ? 1 : p < 0.68 ? 2 : 3;
    const pool = PATS.filter((x) => x.tier <= maxTier && x.id !== last);
    let tot = 0;
    for (const x of pool) tot += x.w * (x.tier === maxTier ? 2 : 1);
    let r = Math.random() * tot;
    let pat = pool[0];
    for (const x of pool) {
      r -= x.w * (x.tier === maxTier ? 2 : 1);
      if (r <= 0) { pat = x; break; }
    }
    last = pat.id;
    const len = pat.fn(d, b);
    // spacing shrinks along the course (difficulty curve)
    d += len + 14 - p * 5 + Math.random() * 3;
  }

  // ---- announcements
  ZONES.forEach((z, i) => { if (i > 0) b.marks.push({ d: z.from + 1, kind: 'zone', text: z.name, sub: z.sub }); });
  for (let m = 100; m < L; m += 100) b.marks.push({ d: m, kind: 'milestone', text: String(m) });
  b.marks.push({ d: L - 55, kind: 'final', text: '🧁 Final dash!', sub: 'The Sheep Bakery is just ahead!' });

  b.evs.sort((a, c) => a.d - c.d);
  b.marks.sort((a, c) => a.d - c.d);
  return { evs: b.evs, marks: b.marks };
}
