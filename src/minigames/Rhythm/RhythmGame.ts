import { tr, trf } from '../../i18n/i18n';
// Rhythm mini-game shared by the Dance and Vocal practice rooms.
//  • Dance: ← ↑ → ↓ arrow notes (swipe / arrow keys / WASD) + ♡ tap notes; Hamin performs every move you hit.
//  • Vocal: notes sit on three pitch rows (high / mid / low) that follow the melody, plus long HOLD notes.
//  • Perfects fill a FEVER gauge → ×2 score, rainbow lane, a crowd of cheering sheep, mirror flashes.
//  • Easy / Normal / Hard charts (hand-authored in charts.ts on the real music grid), best score per difficulty.
// Runs inside an explore scene: the caller's onInteract already holds game.lock(), and we keep Hamin locked
// for the whole session. Everything we touch (DOM, listeners, camera, pose, 3D fx) is restored on exit.
import * as THREE from 'three';
import type { Game } from '../../game/Game';
import type { AnimName } from '../../characters/Hamin';
import type { Expression } from '../../characters/face';
import { el } from '../../ui/UI';
import { clamp, isTouch, wait } from '../../utils/math';
import { buildChart, DIFF, DIFFS, SONGS, type ChartNote, type Difficulty, type Dir } from './charts';
import { Choreo } from './Choreo';
import { MirrorFlash, SheepCrowd } from './StageFx';
import { ARROW_SVG, injectStyle } from './style';

export type RhythmMode = 'dance' | 'vocal';

export interface RhythmOpts {
  /** Where Hamin performs (rot = facing; 0 faces the default camera). */
  spot: { x: number; z: number; rot: number };
  /** Room hooks, e.g. switch on an ON AIR light. */
  onStart?: () => void;
  onEnd?: () => void;
}

type Judge = 'perfect' | 'good' | 'miss';

interface ModeCfg {
  title: string;
  emoji: string;
  bpm: number; // fallback when the audio clock is not available (matches the synth track)
  anim: AnimName;
  charm: string;
  judge: [string, string, string];
  wrong: string;
  tip: string;
  count: string[];
  diffNote: Record<Difficulty, string>;
}

const CFG: Record<RhythmMode, ModeCfg> = {
  dance: {
    title: 'Dance Practice',
    emoji: '💃',
    bpm: 112,
    anim: 'dance',
    charm: '🎵 Music Note',
    judge: ['Perfect ♡', 'Good!', 'Miss…'],
    wrong: 'Wrong way!',
    tip: 'Swipe the way each arrow points and tap the ♡ notes. Hamin dances every move you hit!',
    count: ['5', '6', '7', '8!'],
    diffNote: {
      easy: 'Slower notes, and a wrong arrow still counts as Good ♡',
      normal: 'The full routine at a comfy groove.',
      hard: 'Fast feet and tricky combos, for dance stars! ✨',
    },
  },
  vocal: {
    title: 'Vocal Practice',
    emoji: '🎤',
    bpm: 84,
    anim: 'sing',
    charm: '🎤 Microphone',
    judge: ['Perfect ♪', 'Good~', 'Oops…'],
    wrong: 'Wrong pitch!',
    tip: 'Tap the row each note sits on: high, middle or low. Hold the long notes until they end!',
    count: ['1', '2', '3', 'Sing! ♪'],
    diffNote: {
      easy: 'Slower notes, and any row still counts as Good ♡',
      normal: 'Follow the melody up and down.',
      hard: 'Quick runs and long notes, for singing stars! ✨',
    },
  },
};

const DEBUG = new URLSearchParams(location.search).has('debug');
const TX = { dance: 58, vocal: 50 }; // target x inside the lane (px) — keep in sync with style.ts
const FEVER_BEATS = 8;
const SWIPE_PX = 22;
const KEY_DIR: Record<string, Dir> = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D' };
const KEY_TAP = ['Space', 'KeyE', 'Enter', 'KeyF', 'KeyJ', 'KeyK', 'KeyL'];
const KEY_ROW: Record<string, number> = {
  ArrowUp: 0, KeyW: 0, KeyL: 0, KeyI: 0,
  Space: 1, KeyK: 1, Enter: 1, KeyE: 1, KeyF: 1, ArrowLeft: 1, ArrowRight: 1, KeyA: 1, KeyD: 1,
  ArrowDown: 2, KeyS: 2, KeyJ: 2,
};
const ROW_COLOR = ['#ff6f91', '#8f6cdc', '#4f95e6'];
const DIR_COLOR: Record<string, string> = { L: '#ff6f91', R: '#4f95e6', U: '#e3a21f', D: '#34b67e', tap: '#ff7a93' };
const DIR_VEC: Record<Dir, [number, number]> = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] };

interface Note extends ChartNote {
  end: number;
  el: HTMLDivElement | null;
  bar: HTMLElement | null;
  state: 'wait' | 'hold' | 'done';
  src: string | null;
  tick: number;
}
interface Stats { score: number; perfect: number; good: number; miss: number; maxCombo: number; total: number; fevers: number }
interface Ptr { x: number; y: number; b: number; t: number; decided: boolean }
interface Hud {
  lane: HTMLDivElement; wrap: HTMLDivElement; targets: HTMLDivElement[]; judge: HTMLDivElement; flash: HTMLDivElement;
  score: HTMLElement; combo: HTMLElement; comboBig: HTMLDivElement; ticks: HTMLDivElement[]; prog: HTMLElement;
  fever: HTMLDivElement; feverBar: HTMLElement; edge: HTMLDivElement; rows: HTMLDivElement[];
}

type Phase = 'intro' | 'count' | 'play' | 'end' | 'done';

export class RhythmGame {
  private cfg: ModeCfg;
  private diff: Difficulty = 'normal';
  private layer!: HTMLDivElement;
  private phase: Phase = 'intro';
  private raf = 0;
  private last = 0;
  private time = 0;
  private aborted = false;
  private offs: (() => void)[] = [];
  private introResolve: ((go: boolean) => void) | null = null;
  private introPick: ((d: Difficulty) => void) | null = null;
  private frameFn: ((dt: number) => void) | null = null;
  // play state
  private notes: Note[] = [];
  private stats: Stats = { score: 0, perfect: 0, good: 0, miss: 0, maxCombo: 0, total: 0, fevers: 0 };
  private maxScore = 1;
  private combo = 0;
  private fever = 0;
  private feverEnd = -1;
  private curBeat = 0;
  private beatNow: () => number = () => 0;
  private spb = 0.5;
  private leadB = 4;
  private exprT = 0;
  private dims = { w: 600, h: 90 };
  private ptrs = new Map<number, Ptr>();
  private hud: Hud | null = null;
  private camBase = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  private choreo: Choreo;
  private crowd: SheepCrowd | null = null;
  private mirror: MirrorFlash | null = null;

  constructor(private game: Game, private mode: RhythmMode, private o: RhythmOpts) {
    this.cfg = CFG[mode];
    this.choreo = new Choreo(game, o.spot, this.cfg.anim);
    // last pick, or Easy for a first-timer (arrows / pitch rows are new)
    const saved: string = game.save.flag(`rh_${mode}_diff`, '');
    if ((DIFFS as string[]).includes(saved)) this.diff = saved as Difficulty;
    else this.diff = (game.save.data.minigames[mode]?.plays ?? 0) > 0 ? 'normal' : 'easy';
  }

  private get tx() { return TX[this.mode]; }
  private get mult() { return this.feverEnd >= 0 ? 2 : 1; }

  /** Full session: intro → (count-in → play → result)* → cleanup. */
  async run() {
    const g = this.game;
    const scene = g.current;
    injectStyle();
    g.ui.setHud(false);
    g.ui.setAction(null);
    g.ui.clearPrompts();
    g.input.releaseAll();
    this.layer = g.ui.layer('rh rh-' + this.mode);
    this.bindInput();
    this.placeHamin();
    if (scene) {
      this.crowd = new SheepCrowd(scene.scene, this.o.spot, this.camBase.pos);
      if (this.mode === 'dance') this.mirror = new MirrorFlash(scene.scene);
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
    if (DEBUG) (window as any).__rhythm = this; // ?debug: lets a test harness auto-play
    this.o.onStart?.();
    try {
      let intro = true;
      for (;;) {
        if (intro && !(await this.intro())) break;
        intro = false;
        const st = await this.play();
        if (!st || this.aborted || g.current !== scene) break;
        const next = await this.result(st);
        this.crowd?.show(false);
        if (next === 2 || this.aborted || g.current !== scene) break;
        intro = next === 1;
        this.placeHamin();
      }
    } finally {
      this.cleanup(scene === g.current);
    }
  }

  // ------------------------------------------------------------ setup
  private placeHamin() {
    const g = this.game;
    const { x, z, rot } = this.o.spot;
    const p = g.player;
    this.choreo.reset();
    p.stop();
    p.moveSpeed = 0;
    p.overrideExpression(null);
    // camera in front of Hamin, a little to the side, framing him above the note ribbon
    const fwd = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const vocal = this.mode === 'vocal';
    this.camBase.pos.set(x, 0, z).addScaledVector(fwd, vocal ? 6.4 : 6.2).addScaledVector(side, -0.9).setY(vocal ? 2.3 : 2.5);
    this.camBase.look.set(x, 0, z).addScaledVector(side, -0.15).setY(vocal ? 0.62 : 0.85);
    g.cam.override = { pos: this.camBase.pos.clone(), look: this.camBase.look.clone(), k: 3, fov: 38 };
  }

  private bindInput() {
    const g = this.game;
    const onKey = (e: KeyboardEvent) => {
      if (this.phase === 'done') return;
      const code = e.code;
      if (code === 'Escape' && (this.phase === 'play' || this.phase === 'count' || this.phase === 'intro')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (this.phase === 'intro') this.introResolve?.(false);
        else this.quit();
        return;
      }
      if (g.ui.modalOpen) return;
      if (this.phase === 'intro') {
        const i = DIFFS.indexOf(this.diff);
        let pick: Difficulty | null = null;
        if (code === 'ArrowLeft' || code === 'KeyA') pick = DIFFS[Math.max(0, i - 1)];
        else if (code === 'ArrowRight' || code === 'KeyD') pick = DIFFS[Math.min(DIFFS.length - 1, i + 1)];
        else if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') pick = DIFFS[+code.slice(5) - 1];
        if (pick) {
          e.preventDefault();
          if (pick !== this.diff) this.introPick?.(pick);
        } else if (code === 'Space' || code === 'Enter' || code === 'KeyE') {
          e.preventDefault();
          if (!e.repeat) this.introResolve?.(true);
        }
        return;
      }
      const dir = KEY_DIR[code];
      const row = KEY_ROW[code];
      const tap = KEY_TAP.includes(code);
      if (dir === undefined && row === undefined && !tap) return;
      e.preventDefault();
      if (e.repeat || this.phase !== 'play') return;
      const b = this.beatNow();
      if (this.mode === 'vocal') {
        if (row === undefined) return;
        this.rowPress(row);
        this.press({ row }, b, 'k' + code);
      } else {
        if (dir) this.ghost(dir);
        this.press({ dir: dir ?? 'tap' }, b, 'k' + code);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (this.mode === 'vocal' && this.phase === 'play') this.release('k' + e.code, this.beatNow());
    };
    const onDown = (e: PointerEvent) => {
      if (this.phase !== 'play' || g.ui.modalOpen) return;
      if ((e.target as HTMLElement).closest('button')) return;
      e.preventDefault();
      const b = this.beatNow();
      const src = 'p' + e.pointerId;
      if (this.mode === 'vocal') {
        const row = this.rowFromY(e.clientY);
        this.rowPress(row);
        this.press({ row }, b, src);
        return;
      }
      const p: Ptr = { x: e.clientX, y: e.clientY, b, t: performance.now(), decided: false };
      this.ptrs.set(e.pointerId, p);
      // ♡ notes react instantly; for an arrow note we wait (briefly) to see which way the finger flicks
      const near = this.nearest(b);
      if (!near || near.kind === 'tap') {
        p.decided = true;
        this.press({ dir: 'tap' }, b, src);
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = this.ptrs.get(e.pointerId);
      if (!p || p.decided || this.phase !== 'play') return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (Math.hypot(dx, dy) < SWIPE_PX) return;
      p.decided = true;
      const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'L' : 'R') : dy < 0 ? 'U' : 'D';
      this.ghost(dir);
      // judged at touch-down: that's when the player "hits" the beat, the flick just says which way
      this.press({ dir }, p.b, 'p' + e.pointerId);
    };
    const onUp = (e: PointerEvent) => {
      const p = this.ptrs.get(e.pointerId);
      this.ptrs.delete(e.pointerId);
      if (this.phase !== 'play') return;
      if (this.mode === 'vocal') this.release('p' + e.pointerId, this.beatNow());
      else if (p && !p.decided) this.press({ dir: 'tap' }, p.b, 'p' + e.pointerId);
    };
    const onBlur = () => {
      if (this.phase !== 'play') return;
      const b = this.beatNow();
      for (const n of this.notes) if (n.state === 'hold' && n.src) this.release(n.src, b);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onBlur);
    this.layer.addEventListener('pointerdown', onDown);
    this.offs.push(
      () => window.removeEventListener('keydown', onKey, true),
      () => window.removeEventListener('keyup', onKeyUp, true),
      () => window.removeEventListener('pointermove', onMove),
      () => window.removeEventListener('pointerup', onUp),
      () => window.removeEventListener('pointercancel', onUp),
      () => window.removeEventListener('blur', onBlur),
    );
  }

  // ------------------------------------------------------------ intro card
  private intro() {
    const g = this.game;
    const c = this.cfg;
    const touch = isTouch();
    this.phase = 'intro';
    const rec = g.save.data.minigames[this.mode];
    const card = el('div', 'rh-card paper');
    const colA = el('div', 'rh-col');
    const keys = this.mode === 'dance' && !touch
      ? '<p class="rh-keys"><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> <kbd>WASD</kbd> · <kbd>Space</kbd> ♡</p>'
      : '';
    colA.innerHTML = `
      <div class="rh-head"><span class="rh-emoji">${c.emoji}</span><h2 class="grad-text">${tr(c.title)}</h2></div>
      ${this.mode === 'dance' ? danceTeach() : vocalTeach(!touch)}
      <p>${tr(c.tip)}</p>${keys}`;
    const colB = el('div', 'rh-col');
    const diffs = el('div', 'rh-diffs');
    const btns = new Map<Difficulty, HTMLButtonElement>();
    for (const d of DIFFS) {
      const best = g.save.flag(`rh_${this.mode}_best_${d}`, 0);
      const b = el('button', 'rh-diff', `<i>${DIFF[d].emoji}</i><b>${tr(DIFF[d].label)}</b><small>${best > 0 ? trf('Best: {0}', best) : '—'}</small>`);
      b.dataset.d = d;
      b.onclick = () => this.introPick?.(d);
      diffs.appendChild(b);
      btns.set(d, b);
    }
    const note = el('p', 'rh-diffnote');
    const small = el('p', 'rh-small', rec?.cleared ? tr('Hit 60% accuracy to clear ✓') : trf('Hit 60% accuracy to clear and earn the {0} charm', tr(c.charm)));
    const row = el('div', 'rh-btns');
    const go = el('button', 'candy primary', tr('Start ♡'));
    const later = el('button', 'candy small', tr('Maybe later'));
    row.append(go, later);
    colB.append(diffs, note, small, row);
    card.append(colA, colB);
    this.layer.appendChild(card);
    const select = (d: Difficulty, sound: boolean) => {
      this.diff = d;
      btns.forEach((b, k) => b.classList.toggle('sel', k === d));
      note.textContent = tr(c.diffNote[d]);
      if (sound) {
        g.audio.sfx('blip');
        g.save.setFlag(`rh_${this.mode}_diff`, d);
      }
    };
    select(this.diff, false);
    this.introPick = (d) => select(d, true);
    g.player.play('wave');
    return new Promise<boolean>((res) => {
      this.introResolve = (v) => {
        this.introResolve = null;
        this.introPick = null;
        g.audio.sfx(v ? 'select' : 'back');
        card.classList.add('out');
        setTimeout(() => card.remove(), 220);
        res(v);
      };
      go.onclick = () => this.introResolve?.(true);
      later.onclick = () => this.introResolve?.(false);
    });
  }

  // ------------------------------------------------------------ gameplay HUD
  private buildHud() {
    const vocal = this.mode === 'vocal';
    this.layer.querySelectorAll('.rh-top, .rh-tapzone, .rh-wrap, .rh-edge').forEach((e) => e.remove());
    const edge = el('div', 'rh-edge');
    const tap = el('div', 'rh-tapzone');
    const top = el('div', 'mg-top rh-top');
    const left = el('div', 'rh-pills');
    const scorePill = el('div', 'mg-pill', `<small>${tr('score')}</small><b>0</b>`);
    const comboPill = el('div', 'mg-pill', `<small>${tr('combo')}</small><b>0</b>`);
    left.append(scorePill, comboPill);
    const fever = el('div', 'rh-fever', `<span class="rh-flabel">${tr('✨ FEVER')}</span><div class="rh-fg"><i></i></div><b class="rh-x2">×2</b>`);
    const right = el('div', 'rh-pills');
    const d = DIFF[this.diff];
    const dpill = el('div', 'mg-pill rh-dpill', `${d.emoji} <span>${tr(d.label)}</span>`);
    const quit = el('button', 'candy small rh-quit', '✕');
    quit.setAttribute('aria-label', tr('Stop practice'));
    quit.onclick = () => this.quit();
    right.append(dpill, quit);
    top.append(left, fever, right);
    const wrap = el('div', 'rh-wrap');
    const lane = el('div', 'rh-lane');
    const prog = el('div', 'rh-prog', '<i></i>');
    const rows: HTMLDivElement[] = [];
    if (vocal) {
      const keys = isTouch() ? ['', '', ''] : ['↑', 'Space', '↓'];
      for (let r = 0; r < 3; r++) {
        const rw = el('div', `rh-row r${r}`, keys[r] ? `<kbd>${keys[r]}</kbd>` : '');
        lane.appendChild(rw);
        rows.push(rw);
      }
    }
    const ticks: HTMLDivElement[] = [];
    for (let i = 0; i < 12; i++) {
      const t = el('div', 'rh-tick');
      lane.appendChild(t);
      ticks.push(t);
    }
    const flash = el('div', 'rh-flash');
    const targets: HTMLDivElement[] = [];
    if (vocal) {
      for (let r = 0; r < 3; r++) {
        const t = el('div', `rh-target r${r}`, '<span>♡</span>');
        t.style.top = `${((r + 0.5) * 100) / 3}%`;
        targets.push(t);
      }
    } else targets.push(el('div', 'rh-target', '<span>♡</span>'));
    const judge = el('div', 'rh-judge');
    const comboBig = el('div', 'rh-combo');
    lane.append(prog, flash, ...targets);
    wrap.append(lane, judge, comboBig);
    this.layer.append(edge, tap, top, wrap);
    this.hud = {
      lane, wrap, targets, judge, flash, ticks, comboBig, rows, edge, fever,
      prog: prog.querySelector('i')!, feverBar: fever.querySelector('.rh-fg i')!,
      score: scorePill.querySelector('b')!, combo: comboPill.querySelector('b')!,
    };
    this.measure();
  }

  private measure() {
    const lane = this.hud?.lane;
    if (lane && lane.clientWidth) this.dims = { w: lane.clientWidth, h: lane.clientHeight };
  }

  private rowY(r: number) {
    return this.mode === 'vocal' ? (this.dims.h * (r + 0.5)) / 3 : 0;
  }

  private rowFromY(clientY: number) {
    const lane = this.hud?.lane;
    if (!lane) return 1;
    const r = lane.getBoundingClientRect();
    const rel = (clientY - r.top) / Math.max(1, r.height);
    return clamp(Math.floor(rel * 3), 0, 2); // above the lane = high, below = low
  }

  // ------------------------------------------------------------ gameplay
  private async play(): Promise<Stats | null> {
    const g = this.game;
    const c = this.cfg;
    const scene = g.current;
    const song = SONGS[this.mode];
    const d = DIFF[this.diff];
    this.buildHud();
    const hud = this.hud!;
    this.notes = buildChart(this.mode, this.diff).map((n) => ({
      ...n, end: n.beat + n.len, el: null, bar: null, state: 'wait' as const, src: null, tick: n.beat + 0.5,
    }));
    this.combo = 0;
    this.fever = 0;
    this.feverEnd = -1;
    this.ptrs.clear();
    const holds = this.notes.filter((n) => n.len > 0);
    const total = this.notes.length + holds.length;
    this.stats = { score: 0, perfect: 0, good: 0, miss: 0, maxCombo: 0, total, fevers: 0 };
    let max = 0;
    for (let i = 1; i <= total; i++) max += 100 + Math.min(i, 20) * 5;
    for (const n of holds) max += (Math.ceil(n.len / 0.5) - 1) * 10;
    this.maxScore = max + 100;
    const firstBeat = this.notes[0].beat;
    const lastEnd = Math.max(...this.notes.map((n) => n.end));

    g.audio.unlock();
    g.audio.playMusic(this.mode, true); // restart so beat 0 lines up with the chart
    this.phase = 'count';
    this.choreo.reset();
    g.player.play(c.anim, { loop: true });
    const ready = el('div', 'big-center rh-count word rh-ready', tr('Ready?'));
    this.layer.appendChild(ready);
    await wait(460); // the synth track restarts ~0.4s after playMusic
    if (this.aborted || g.current !== scene) {
      ready.remove();
      return null;
    }

    // ---- clock: the synth track's beat when audio runs, otherwise a steady fallback clock
    const ctx = g.audio.ctx;
    const useAudio = !!ctx && ctx.state === 'running' && g.audio.currentTrack === this.mode && g.audio.beat() < 2;
    const bpm = useAudio ? g.audio.bpm : c.bpm;
    const lat = useAudio && ctx ? (((ctx as any).outputLatency as number) || ctx.baseLatency || 0) : 0;
    let fb = 0;
    this.beatNow = useAudio ? () => g.audio.beat() - (lat * bpm) / 60 : () => fb;
    this.spb = 60 / bpm;
    this.leadB = song.lead[this.diff] / this.spb;
    this.phase = 'play';

    return new Promise<Stats | null>((res) => {
      let lastWhole = Math.floor(this.beatNow());
      let lastCount = -1;
      let measureT = 0;
      let tickState = '';
      this.frameFn = (dt) => {
        if (this.aborted || g.current !== scene) return res(null);
        fb += dt / this.spb;
        const b = this.beatNow();
        this.curBeat = b;
        if ((measureT -= dt) <= 0) {
          measureT = 0.5;
          this.measure();
        }
        // ---- count-in (the bar before the first note), "Ready?" before that
        const ci = Math.floor(b) - (firstBeat - 4);
        if (b < firstBeat && ci !== lastCount && ci >= 0 && ci < 4) {
          lastCount = ci;
          ready.remove();
          const word = c.count[ci].length > 2;
          const t = el('div', `big-center pop rh-count${word ? ' word' : ''}`, tr(c.count[ci]));
          this.layer.appendChild(t);
          setTimeout(() => t.remove(), 780);
          g.audio.sfx(ci === 3 ? 'go' : 'count', 0.8);
          if (this.mode === 'dance') this.choreo.hop(0.08, 0.2);
        }
        if (b >= firstBeat) ready.remove();
        // ---- undecided touches become taps after a moment
        const now = performance.now();
        for (const [id, p] of this.ptrs) {
          if (!p.decided && now - p.t > 280) {
            p.decided = true;
            this.press({ dir: 'tap' }, p.b, 'p' + id);
          }
        }
        // ---- notes
        const W = this.dims.w;
        const span = Math.max(120, W - this.tx - 30);
        const pending = [...this.ptrs.values()].some((p) => !p.decided);
        for (const n of this.notes) {
          if (n.state === 'done') continue;
          let x = this.tx + ((n.beat - b) / this.leadB) * span;
          if (!n.el) {
            if (x > W + 50) continue;
            this.spawn(n);
          }
          if (n.state === 'wait') {
            const late = (b - n.beat) * this.spb;
            if (late > d.good && !(pending && late < d.good + 0.3)) {
              this.judge(n, 'miss');
              continue;
            }
          } else {
            x = this.tx;
            while (n.tick < n.end - 0.01 && b >= n.tick) {
              n.tick += 0.5;
              this.holdTick(n);
            }
            if (b >= n.end) {
              this.judge(n, 'perfect', { tail: true });
              continue;
            }
          }
          if (n.bar) n.bar.style.width = ((Math.max(0, n.end - Math.max(b, n.beat)) / this.leadB) * span).toFixed(1) + 'px';
          n.el!.style.transform = `translate(${x.toFixed(1)}px, ${this.rowY(n.row).toFixed(1)}px)`;
        }
        // ---- beat grid
        const base = Math.floor(b);
        let ts = '';
        hud.ticks.forEach((t, i) => {
          const beat = base + i;
          const x = this.tx + ((beat - b) / this.leadB) * span;
          const vis = x >= this.tx - 4 && x <= W - 10 && beat <= lastEnd + 0.5;
          t.style.display = vis ? '' : 'none';
          if (vis) t.style.transform = `translateX(${x.toFixed(1)}px)`;
          ts += beat % 4 === 0 ? '1' : '0';
        });
        if (ts !== tickState) {
          tickState = ts;
          hud.ticks.forEach((t, i) => t.classList.toggle('bar', ts[i] === '1'));
        }
        // ---- heart pulse on every beat
        const frac = b - base;
        const pulse = Math.exp(-frac * 7);
        const sc = (1 + 0.16 * pulse).toFixed(3);
        for (const t of hud.targets) t.style.setProperty('--s', sc);
        if (base !== lastWhole) {
          lastWhole = base;
          this.onBeat(base, firstBeat, lastEnd);
        }
        // ---- fever
        if (this.feverEnd >= 0) {
          hud.feverBar.style.width = (clamp((this.feverEnd - b) / FEVER_BEATS, 0, 1) * 100).toFixed(1) + '%';
          hud.edge.style.opacity = (0.55 + 0.45 * pulse).toFixed(3);
          if (b >= this.feverEnd) this.endFever();
        }
        hud.prog.style.width = (clamp((b - firstBeat) / (lastEnd - firstBeat), 0, 1) * 100).toFixed(1) + '%';
        // ---- camera groove
        const sway = (this.mode === 'dance' ? 0.35 : 0.2) * (this.feverEnd >= 0 ? 1.6 : 1);
        const ov = g.cam.override;
        if (ov) {
          ov.pos.copy(this.camBase.pos);
          ov.pos.x += Math.sin((b * Math.PI) / 4) * sway;
          ov.pos.y += Math.sin((b * Math.PI) / 2) * 0.06;
        }
        // ---- done?
        if (b > lastEnd + 1.2 && this.notes.every((n) => n.state === 'done')) res(this.stats);
      };
    }).then(async (st) => {
      this.frameFn = null;
      ready.remove();
      this.phase = 'end';
      for (const n of this.notes) n.el?.remove();
      if (st) await this.outro(st);
      return st;
    });
  }

  /** Persistent loop (intro → result): gameplay frame + Hamin's body, sheep crowd and mirror. */
  private tick = (now: number) => {
    if (this.phase === 'done') return;
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;
    this.frameFn?.(dt);
    const g = this.game;
    const beat = this.frameFn ? this.curBeat : g.audio.ctx && g.audio.currentTrack === this.mode ? g.audio.beat() : (this.time * this.cfg.bpm) / 60;
    this.choreo.update(dt);
    this.crowd?.update(dt, beat);
    this.mirror?.update(dt, beat, this.feverEnd >= 0);
    if (this.exprT > 0) {
      this.exprT -= dt;
      if (this.exprT <= 0) g.player.overrideExpression(null);
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  private onBeat(beat: number, first: number, lastEnd: number) {
    const g = this.game;
    if (beat < first - 1 || beat > lastEnd) return;
    if (this.mode === 'vocal' && beat % 2 === 0) g.fx.floatUp(this.head(), 'notes');
    if (this.feverEnd >= 0 && this.crowd) {
      const heads = this.crowd.heads();
      g.fx.floatUp(heads[beat % heads.length], beat % 2 ? 'notes' : 'hearts');
      if (beat % 4 === 0) g.audio.sfx('baa', 0.35);
    }
  }

  private spawn(n: Note) {
    const vocal = this.mode === 'vocal';
    let cls = 'rh-note';
    let inner: string;
    if (vocal) {
      cls += ` r${n.row}${n.len ? ' hold' : ''}`;
      inner = `${n.len ? '<i class="rh-bar"></i>' : ''}<b class="rh-hd"><span>♪</span></b>`;
    } else {
      cls += ` k-${n.kind}${n.finale ? ' finale' : ''}${n.beat % 1 ? ' off' : ''}`;
      inner = `<b class="rh-hd">${n.kind === 'tap' ? '<span>♡</span>' : ARROW_SVG}</b>`;
    }
    if (n.finale) cls += ' finale';
    const e = el('div', cls, inner);
    this.hud!.lane.appendChild(e);
    n.el = e;
    n.bar = e.querySelector('.rh-bar');
  }

  private nearest(b: number) {
    const d = DIFF[this.diff];
    let best: Note | null = null;
    let bd = Infinity;
    for (const n of this.notes) {
      if (n.state !== 'wait') continue;
      const a = Math.abs((b - n.beat) * this.spb);
      if (a < bd) {
        bd = a;
        best = n;
      } else if ((n.beat - b) * this.spb > d.good) break;
    }
    return bd <= Math.max(d.good, d.early) + 0.05 ? best : null;
  }

  private matches(n: Note, inp: { dir?: Dir | 'tap'; row?: number }) {
    if (this.mode === 'vocal') return inp.row === n.row;
    return n.kind === 'tap' || inp.dir === n.kind;
  }

  private press(inp: { dir?: Dir | 'tap'; row?: number }, b: number, src: string) {
    const d = DIFF[this.diff];
    let match: Note | null = null;
    let md = Infinity;
    let other: Note | null = null;
    let od = Infinity;
    let early: Note | null = null;
    for (const n of this.notes) {
      if (n.state !== 'wait') continue;
      const dt = (b - n.beat) * this.spb; // + late / − early
      if (dt > d.good) continue;
      if (dt < -d.good) {
        if (d.early && dt >= -d.early) early = n;
        break; // notes are sorted
      }
      const a = Math.abs(dt);
      if (this.matches(n, inp)) {
        if (a < md) { match = n; md = a; }
      } else if (a < od) { other = n; od = a; }
    }
    if (match) {
      match.src = src;
      this.judge(match, md <= d.perfect ? 'perfect' : 'good');
    } else if (other) {
      other.src = src;
      if (d.lenient) this.judge(other, 'good');
      else this.judge(other, 'miss', { text: this.cfg.wrong });
    } else if (early) this.judge(early, 'miss');
    else {
      // stray tap: a friendly wiggle, no penalty
      this.game.audio.sfx('tap', 0.6);
      const t = this.hud!.targets[this.mode === 'vocal' ? inp.row ?? 1 : 0];
      t.classList.remove('wiggle');
      void t.offsetWidth;
      t.classList.add('wiggle');
    }
  }

  private release(src: string, b: number) {
    const d = DIFF[this.diff];
    for (const n of this.notes) {
      if (n.state !== 'hold' || n.src !== src) continue;
      const early = (n.end - b) * this.spb;
      if (early <= d.perfect * 2) this.judge(n, 'perfect', { tail: true });
      else if (early <= d.good * 2) this.judge(n, 'good', { tail: true });
      else this.judge(n, 'miss', { tail: true, text: 'Let go too soon…' });
      this.choreo.endSustain();
    }
  }

  private holdTick(n: Note) {
    const g = this.game;
    this.stats.score += 10 * this.mult;
    this.hud!.score.textContent = String(this.stats.score);
    this.addFever(0.012);
    if (n.tick % 1 === 0) g.fx.floatUp(this.head().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, 0)), 'notes');
    this.sparks(n.row, 'good', 2);
  }

  private judge(n: Note, kind: Judge, o: { tail?: boolean; text?: string } = {}) {
    const g = this.game;
    const s = this.stats;
    const hud = this.hud!;
    const head = !o.tail;
    const hold = n.len > 0;
    const y = this.rowY(n.row);
    if (kind === 'miss') {
      n.state = 'done';
      s.miss += hold && head ? 2 : 1;
      this.combo = 0;
      const e = n.el;
      if (e) {
        e.classList.remove('holding');
        e.classList.add('missed');
        setTimeout(() => e.remove(), 450);
      }
      this.addFever(-0.22);
      if (hold && !head) this.choreo.endSustain();
    } else {
      const e = n.el;
      if (head && hold) {
        n.state = 'hold';
        e?.classList.add('holding');
      } else {
        n.state = 'done';
        if (e) {
          e.style.transform = `translate(${this.tx}px, ${y.toFixed(1)}px)`;
          e.classList.remove('holding');
          e.classList.add('hit', kind);
          setTimeout(() => e.remove(), 380);
        }
      }
      this.combo++;
      s.maxCombo = Math.max(s.maxCombo, this.combo);
      if (kind === 'perfect') s.perfect++;
      else s.good++;
      const base = (kind === 'perfect' ? 100 : 60) * (n.finale ? 2 : 1);
      s.score += (base + Math.min(this.combo, 20) * 5) * this.mult;
      this.addFever(kind === 'perfect' ? 0.09 : 0.04);
      hud.flash.className = 'rh-flash ' + kind;
      if (this.mode === 'vocal') hud.flash.style.top = y + 'px';
      void hud.flash.offsetWidth;
      hud.flash.classList.add('go');
      this.sparks(n.row, kind, kind === 'perfect' ? 7 : 4);
      const t = hud.targets[this.mode === 'vocal' ? n.row : 0];
      t.classList.add('lit');
      setTimeout(() => t.classList.remove('lit'), 140);
    }
    const [tp, tg, tm] = this.cfg.judge;
    g.ui.judge(hud.judge, kind, tr(o.text ?? (kind === 'perfect' ? tp : kind === 'good' ? tg : tm)));
    g.audio.sfx(kind);
    hud.score.textContent = String(s.score);
    hud.combo.textContent = String(this.combo);
    if (this.combo >= 3) {
      hud.comboBig.innerHTML = `${this.combo}<small>${tr('combo ♡')}</small>`;
      hud.comboBig.classList.remove('bump');
      void hud.comboBig.offsetWidth;
      hud.comboBig.classList.add('bump', 'on');
    } else hud.comboBig.classList.remove('on');
    this.reactHamin(n, kind, head);
  }

  // ------------------------------------------------------------ fever
  private addFever(v: number) {
    if (this.feverEnd >= 0 || this.phase !== 'play') return;
    this.fever = clamp(this.fever + v, 0, 1);
    const hud = this.hud!;
    hud.feverBar.style.width = (this.fever * 100).toFixed(1) + '%';
    hud.fever.classList.toggle('hot', this.fever > 0.75);
    if (this.fever >= 1) this.startFever();
  }

  private startFever() {
    const g = this.game;
    const hud = this.hud!;
    this.feverEnd = this.curBeat + FEVER_BEATS;
    this.stats.fevers++;
    this.layer.classList.add('fever');
    hud.fever.classList.remove('hot');
    hud.fever.classList.add('on');
    const t = el('div', 'rh-fevertext', tr('Fever time! ×2'));
    this.layer.appendChild(t);
    setTimeout(() => t.remove(), 1450);
    g.audio.sfx('unlock');
    setTimeout(() => g.audio.sfx('cheer', 0.9), 140);
    setTimeout(() => g.audio.sfx('sparkle'), 320);
    this.crowd?.show(true);
    if (this.crowd) {
      const h = this.crowd.heads();
      setTimeout(() => this.phase === 'play' && g.ui.react(h[0].clone().setY(1.3), tr('baa baa ♪'), 'plain'), 350);
    }
    this.mirror?.flash(1.3);
    g.fx.burst(this.head(), 'sparkles', 8, 1);
    this.expr(this.mode === 'dance' ? 'happy' : 'love', 1);
  }

  private endFever() {
    const hud = this.hud;
    this.feverEnd = -1;
    this.fever = 0;
    this.layer.classList.remove('fever');
    if (hud) {
      hud.fever.classList.remove('on', 'hot');
      hud.feverBar.style.width = '0%';
      hud.edge.style.opacity = '0';
    }
    this.crowd?.show(false);
  }

  // ------------------------------------------------------------ juice
  private sparks(row: number, kind: Judge, count: number) {
    const hud = this.hud;
    if (!hud) return;
    const glyphs = this.mode === 'vocal' ? ['♪', '♫', '✦', '♡'] : ['♡', '✦', '★', '♡'];
    const col = this.mode === 'vocal' ? ROW_COLOR[row] : kind === 'perfect' ? '#ff7a93' : '#7fb7f5';
    const x = this.tx + 4;
    const y = (this.mode === 'vocal' ? this.rowY(row) : this.dims.h / 2) + 4;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.8;
      const r = 34 + Math.random() * 30;
      const s = el('span', 'rh-spark', glyphs[i % glyphs.length]);
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      s.style.setProperty('--dx', (Math.cos(a) * r).toFixed(0) + 'px');
      s.style.setProperty('--dy', (Math.sin(a) * r - 12).toFixed(0) + 'px');
      s.style.setProperty('--r', ((Math.random() - 0.5) * 120).toFixed(0) + 'deg');
      s.style.setProperty('--c', col);
      hud.wrap.appendChild(s);
      setTimeout(() => s.remove(), 560);
    }
  }

  private ghost(dir: Dir) {
    const hud = this.hud;
    if (!hud || this.mode !== 'dance') return;
    const [vx, vy] = DIR_VEC[dir];
    const gh = el('div', `rh-ghost k-${dir}`, ARROW_SVG);
    gh.style.setProperty('--dx', vx * 46 + 'px');
    gh.style.setProperty('--dy', vy * 30 + 'px');
    gh.style.setProperty('--gc', DIR_COLOR[dir]);
    hud.lane.appendChild(gh);
    setTimeout(() => gh.remove(), 400);
  }

  private rowPress(row: number) {
    const rw = this.hud?.rows[row];
    if (!rw) return;
    rw.classList.add('press');
    setTimeout(() => rw.classList.remove('press'), 120);
  }

  private head() {
    const p = this.game.player.root.position;
    return new THREE.Vector3(p.x, 2.55, p.z);
  }

  private expr(e: Expression, t: number) {
    this.game.player.overrideExpression(e);
    this.exprT = t;
  }

  private reactHamin(n: Note, kind: Judge, head: boolean) {
    const g = this.game;
    const dance = this.mode === 'dance';
    if (kind === 'miss') {
      if (dance) {
        this.expr('surprised', 0.6);
        this.choreo.move('miss');
      } else {
        this.expr('shy', 0.7);
        this.choreo.squash(0.3);
      }
      return;
    }
    const done = n.state === 'done';
    if (n.finale && done) return this.finaleHit();
    const milestone = this.combo > 0 && this.combo % 10 === 0;
    if (milestone) {
      g.fx.burst(this.head(), 'hearts', 6, 0.8);
      g.audio.sfx('sparkle', 0.8);
      g.ui.react(this.head().setY(3), [trf('♡ {0} combo!', this.combo), '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧', tr('✨ so good ✨')][(this.combo / 10) % 3 | 0], 'big');
    }
    if (dance) {
      if (milestone && n.kind === 'tap') {
        this.expr('happy', 1);
        this.choreo.move('spin');
      } else this.choreo.move(n.kind);
      if (kind === 'perfect') {
        this.mirror?.flash(0.85);
        g.fx.burst(this.head().setY(1.2), 'sparkles', 2, 0.6);
      }
      return;
    }
    // vocal: body follows the pitch, note particles grow with the combo
    this.choreo.pitch(n.row, head && n.len > 0 && !done);
    this.expr(milestone ? 'love' : 'sing', head && n.len > 0 ? n.len * this.spb : 0.35);
    if (head) {
      const k = kind === 'perfect' ? 1 + Math.min(4, Math.floor(this.combo / 8)) : 1;
      g.fx.burst(this.head().setY(2.35 + (2 - n.row) * 0.12), 'notes', k, 0.45 + k * 0.08);
    }
    if (milestone && done) this.choreo.anim('heart', 0.8);
  }

  private finaleHit() {
    const g = this.game;
    g.audio.sfx('sparkle');
    setTimeout(() => g.audio.sfx('cheer', 0.8), 120);
    g.fx.burst(this.head(), 'confetti', 14, 1.2);
    this.mirror?.flash(1.4);
    this.crowd?.show(true);
    g.ui.react(this.head().setY(3.1), tr('Big finish! ✨'), 'big');
    this.expr(this.mode === 'dance' ? 'happy' : 'love', 1.4);
    if (this.mode === 'dance') this.choreo.move('finale');
    else this.choreo.anim('heart', 0, false);
  }

  private async outro(st: Stats) {
    const g = this.game;
    const acc = this.accuracy(st);
    this.endFever();
    g.player.overrideExpression(null);
    this.hud?.comboBig.classList.remove('on');
    const ov = g.cam.override;
    if (ov) {
      ov.pos.copy(this.camBase.pos).lerp(this.camBase.look.clone().setY(1.6), 0.25);
      ov.k = 2.5;
    }
    if (acc >= 0.6) {
      this.crowd?.show(true);
      this.choreo.anim(this.mode === 'dance' ? 'victory' : 'heart', 0, false);
      g.audio.sfx('success');
      g.fx.burst(this.head(), 'confetti', 16, 1.2);
      this.mirror?.flash(1.2);
      setTimeout(() => g.audio.sfx('cheer', acc >= 0.9 ? 0.9 : 0.6), 300);
      setTimeout(() => g.audio.sfx('baa', 0.5), 700);
    } else {
      this.crowd?.show(false);
      this.choreo.anim('shy', 0, false);
      g.audio.sfx('fail');
    }
    await wait(1600);
  }

  private accuracy(st: Stats) {
    return st.total ? (st.perfect + st.good * 0.7) / st.total : 0;
  }

  // ------------------------------------------------------------ result
  /** 0 = again, 1 = change level, 2 = done */
  private async result(st: Stats): Promise<number> {
    const g = this.game;
    const d = DIFF[this.diff];
    const acc = this.accuracy(st);
    const cleared = acc >= 0.6;
    const hearts = Math.round((5 + 15 * clamp(st.score / this.maxScore, 0, 1)) * d.hearts);
    const key = `rh_${this.mode}_best_${this.diff}`;
    const prev = g.save.flag(key, 0);
    const diffBest = st.score > prev;
    if (diffBest) g.save.setFlag(key, st.score);
    const { newBest } = g.finishMinigame(this.mode, st.score, cleared, hearts);
    this.layer.querySelectorAll('.rh-top, .rh-tapzone, .rh-wrap, .rh-edge').forEach((e) => e.remove());
    this.hud = null;
    const pct = Math.round(acc * 100);
    const full = st.miss === 0;
    const title = !cleared ? 'Almost there…' : pct >= 95 ? 'Perfect practice!' : pct >= 85 ? 'Super sweet! ♡' : 'Practice clear! ♡';
    const emoji = !cleared ? '🐑' : pct >= 95 || full ? '🌟' : this.mode === 'dance' ? '💃' : '🎤';
    const note = [
      `${d.emoji} ${tr(d.label)}`,
      diffBest || newBest ? tr('✨ New best score! ✨') : prev > 0 ? trf('Best: {0}', prev) : '',
      full ? tr('Full combo! ✨') : '',
      cleared ? '' : tr('reach 60% accuracy to clear'),
    ].filter(Boolean).join(' · ');
    const shown = g.ui.result({
      emoji,
      title,
      stats: [['Score', st.score], ['Perfect', st.perfect], ['Max combo', st.maxCombo], ['Accuracy', pct + '%']],
      reward: hearts,
      buttons: ['↻ Again', 'Change level', 'Done ♡'],
      note,
    });
    // compact variant for landscape phones (see style.ts) — the card is built synchronously
    [...document.querySelectorAll('.result')].pop()?.classList.add('rh-res');
    const idx = await shown;
    return this.aborted ? 2 : idx;
  }

  // ------------------------------------------------------------ teardown
  private quit() {
    if (this.aborted) return;
    this.aborted = true;
    this.game.audio.sfx('back');
  }

  private cleanup(sceneAlive: boolean) {
    const g = this.game;
    this.phase = 'done';
    this.frameFn = null;
    cancelAnimationFrame(this.raf);
    for (const off of this.offs) off();
    this.offs = [];
    this.layer?.remove();
    this.hud = null;
    this.crowd?.dispose();
    this.mirror?.dispose();
    this.crowd = this.mirror = null;
    if (DEBUG && (window as any).__rhythm === this) delete (window as any).__rhythm;
    const p = g.player;
    p.airborne = 0;
    p.lean = 0;
    p.root.scale.set(1, 1, 1);
    p.root.rotation.x = 0;
    if (!sceneAlive) return;
    this.choreo.release();
    g.cam.override = null;
    p.stop();
    p.overrideExpression(null);
    p.moveSpeed = 0;
    g.input.releaseAll();
    g.ui.setHud(true);
    this.o.onEnd?.();
  }
}

// ------------------------------------------------------------ intro teaching visuals
function danceTeach() {
  const chip = (k: string, label: string, i: number) =>
    `<div class="rh-mv" style="--i:${i}"><div class="rh-note k-${k}"><b class="rh-hd">${k === 'tap' ? '<span>♡</span>' : ARROW_SVG}</b></div><small>${tr(label)}</small></div>`;
  return `<div class="rh-moves">${chip('L', 'Step', 0)}${chip('U', 'Jump', 1)}${chip('tap', 'Tap', 2)}${chip('D', 'Dip', 3)}${chip('R', 'Step', 4)}</div>`;
}

function vocalTeach(keys: boolean) {
  const k = keys ? ['↑', 'Space', '↓'] : ['', '', ''];
  const rows = [0, 1, 2].map((r) => `<div class="rh-row r${r}">${k[r] ? `<kbd>${k[r]}</kbd>` : ''}</div>`).join('');
  const hearts = [0, 1, 2].map((r) => `<i class="rh-vd-t r${r}" style="top:${((r + 0.5) * 100) / 3}%">♡</i>`).join('');
  return `<div class="rh-vdemo">${rows}${hearts}
    <i class="rh-vd-n r0" style="top:16.7%">♪</i>
    <i class="rh-vd-n hold r1" style="top:50%;animation-delay:1s">♪</i>
    <i class="rh-vd-n r2" style="top:83.3%;animation-delay:2s">♪</i></div>`;
}
