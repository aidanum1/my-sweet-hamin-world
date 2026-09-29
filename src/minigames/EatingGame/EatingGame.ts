import { tr, trf } from '../../i18n/i18n';
import { toAppX, toAppY } from '../../core/Viewport';
// Feed Hamin! — the cafeteria "Lunch Parade" timing mini-game.
// Food rides a pastel conveyor toward Hamin's plate; tap when it is inside the ring.
// Extras: cravings (thought bubble → big bonus), spicy peppers & tiny sheep to skip, strawberry milk slow-mo,
// star candy Yummy Fever, doubles/triples as lunch rush builds up, and a mash-tap Cake Tower finale.
// Runs inside the CafeteriaScene (not a separate scene): the scene owns the conveyor prop and forwards update(dt).
import * as THREE from 'three';
import type { Game } from '../../game/Game';
import { el } from '../../ui/UI';
import { basic } from '../../assets/materials';
import { P } from '../../assets/palette';
import { torus, circle } from '../../assets/geo';
import { FOOD, GOLDEN_CAKE, SHEEP_HELPER, SPICY_PEPPER, STAR_CANDY, FoodDef, bakedFood, preloadSheep, sheepHelper, sheepWalk } from '../../assets/food';
import { clamp, easeOutBack, pick } from '../../utils/math';
import { injectEatingStyle } from './style';
import { Crumbs } from './Crumbs';
import { CakeTower } from './CakeTower';

export interface EatingSetup {
  /** belt surface height, belt centre line z, spawn x (inside the hatch), exit x (basket) */
  beltY: number;
  beltZ: number;
  x0: number;
  x1: number;
  /** x of the ring / Hamin's plate */
  ringX: number;
  /** where Hamin sits (facing +Z, toward the camera); y lifts him onto a tall stool */
  seat: { x: number; z: number; y?: number };
  /** where Hamin stands after the game */
  exit: { x: number; z: number; rot: number };
  /** belt speed callback (the scene scrolls its belt texture) */
  setBelt: (speed: number) => void;
  /** called when the game starts / ends (hide decor foods, etc.) */
  onActive?: (active: boolean) => void;
}

type Kind = 'food' | 'gold' | 'sheep' | 'pepper' | 'milk' | 'star';
type Judge = 'perfect' | 'good' | 'miss';

interface Item {
  kind: Kind;
  def: FoodDef;
  obj: THREE.Object3D;
  halo: THREE.Mesh | null;
  x: number;
  y: number;
  vy: number;
  vx: number;
  spin: number;
  state: 'belt' | 'missed' | 'hop' | 'fall' | 'fly' | 'gone';
  age: number;
  wander: number;
  life: number;
  hop: number;
  from: THREE.Vector3;
  fxAcc: number;
}

// ---------------------------------------------------------------- tuning
const ROUND = 70;
/** the parade stops sending food… */
const LAST_SPAWN = 59;
/** …and the Cake Tower rolls in */
const FINALE_AT = 60.5;
const TOWER_ARRIVE = 0.95;
const DOUBLES_AT = 30;
const RUSH_AT = 45;
const CLEAR_SCORE = 5000;
const FEVER_TIME = 6.5;
const SLOW_TIME = 5;
const SLOW_K = 0.55;
const HELD_SCALE = 0.6;
const HOP_TIME = 0.2;
const HAND_OFS = new THREE.Vector3(0, -0.08, 0.06);

/** The belt sheep helper: the full-detail Higgsfield sheep (one at a time, seen up close). */
const SHEEP_MODEL = 'sheep' as const;

const HALO_CRAVE = 0xff5f8a;
const HALO_MILK = 0x7fb7f5;
const HALO_GOLD = 0xffc93d;

/** Strawberry milk is the slow-mo special, so it never rides as ordinary food. */
const MILK = FOOD.find((f) => f.id === 'milk')!;
const REGULAR = FOOD.filter((f) => f !== MILK);
const CAKE_BITE = FOOD.find((f) => f.id === 'cake')!;

const YUM_GOOD = ['nom~', 'mm! ♡', '(˘ڡ˘)'];
const MISS = ['ah… (´・ω・`)', 'wait for me~', 'my food… 🥺'];
const TOWER_YUM = ['nom nom!', 'more! ♡', '(๑´ڡ`๑) ♡', 'so fluffy~ ♡'];
const FIRE = [0xff7a4d, 0xffb347, 0xffe07a, 0xff5f73];
const STEAM = [0xffffff, 0xf3f0f7, 0xffeef2];

/** The "Feed Hamin" eating game. */
export class EatingGame {
  active = false;
  private phase: 'off' | 'intro' | 'count' | 'play' | 'end' = 'off';
  private layer: HTMLDivElement | null = null;
  private unsub: (() => void)[] = [];
  private items: Item[] = [];
  private pending: { in: number }[] = [];
  private jobs: { t: number; fn: () => void }[] = [];
  private fx = new THREE.Group();
  private hoop: THREE.Mesh;
  private hoopMat: THREE.MeshBasicMaterial;
  private pad: THREE.Mesh;
  private crumbs = new Crumbs(150);
  private sheep: THREE.Group | null = null;
  private tower: CakeTower | null = null;
  // round state
  private t = 0;
  private time = 0;
  private frozen = false;
  private speed = 1.3;
  private slowK = 1;
  private spawnIn = 0;
  private score = 0;
  private shownScore = 0;
  private combo = 0;
  private bestCombo = 0;
  private perfects = 0;
  private goods = 0;
  private misses = 0;
  private bites = 0;
  private golds = 0;
  private goldSpawned = 0;
  private sheepTapped = 0;
  private sheepSaved = 0;
  private peppers = 0;
  private dodged = 0;
  private craves = 0;
  private happy = 50;
  private full = 0;
  private tummies = 0;
  private fever = 0;
  private slow = 0;
  private hot = 0;
  private shake = 0;
  private milkCool = 0;
  private starCool = 0;
  private pepperCool = 0;
  private milkSpawned = 0;
  private starSpawned = 0;
  private lastKind: Kind = 'food';
  private lastFood = '';
  // cravings
  private crave: FoodDef | null = null;
  private lastCrave: FoodDef | null = null;
  private craveT = 0;
  private craveNext = 6;
  private craveDue = 0;
  private craveFirst = true;
  // phases
  private saidDoubles = false;
  private saidRush = false;
  private finale: '' | 'arrive' | 'mash' = '';
  private towerT = 0;
  private towerBites = 0;
  private towerDone = false;
  // juice
  private held: THREE.Object3D | null = null;
  private heldDef: FoodDef | null = null;
  private heldAge = 0;
  private heldBit = false;
  private heldSpicy = false;
  private hoopFlash = 0;
  private hoopFlashColor = new THREE.Color();
  private hoopPop = 0;
  private sq = 0;
  private sqV = 0;
  private wig = 0;
  private steamAcc = 0;
  private fireAcc = 0;
  private lastFrame = performance.now();
  private hud: Record<string, HTMLElement> = {};
  private thinkPos = new THREE.Vector3();
  private sayBusy = 0;
  private sayStack = 0;

  constructor(private game: Game, private scene: THREE.Scene, private cfg: EatingSetup) {
    this.fx.name = 'eating-game';
    // tap ring: an upright hoop the food passes through + a glowing pad on the belt
    this.hoopMat = new THREE.MeshBasicMaterial({ color: P.pinkDeep });
    this.hoop = new THREE.Mesh(torus(0.3, 0.035, 8, 32), this.hoopMat);
    this.hoop.position.set(cfg.ringX, cfg.beltY + 0.27, cfg.beltZ + 0.02);
    this.hoop.userData.noShadow = true;
    this.pad = new THREE.Mesh(circle(0.3, 28), basic(P.pink, 0.55));
    this.pad.rotation.x = -Math.PI / 2;
    this.pad.position.set(cfg.ringX, cfg.beltY + 0.012, cfg.beltZ);
    this.pad.userData.noShadow = true;
    this.pad.renderOrder = 2;
    this.crumbs.floor = cfg.beltY + 0.03;
    this.fx.add(this.hoop, this.pad, this.crumbs.mesh);
    this.fx.visible = false;
    const sy = cfg.seat.y ?? 0;
    this.thinkPos.set(cfg.seat.x + 0.7, sy + 1.72, cfg.seat.z + 0.3);
    scene.add(this.fx);
  }

  // ------------------------------------------------------------------ flow
  /** Full session: intro card → rounds (replayable) → cleanup. */
  async run() {
    if (this.active) return;
    const g = this.game;
    this.active = true;
    this.cfg.onActive?.(true);
    void preloadSheep(SHEEP_MODEL); // normally already loaded by the scene; the first sheep rides in after 8 s
    injectEatingStyle();
    g.ui.setHud(false);
    g.ui.setAction(null);
    g.ui.clearPrompts();
    g.input.releaseAll();
    this.layer = g.ui.layer('eat-mg');
    this.fx.visible = true;
    // seat Hamin, facing the camera
    const p = g.player;
    p.stop();
    p.moveSpeed = 0;
    p.root.position.set(this.cfg.seat.x, this.cfg.seat.y ?? 0, this.cfg.seat.z);
    g.setFacing(0);
    p.play('sit', { loop: true });
    this.updateCam(true);
    g.ui.rotateHint();

    // input: pointerdown anywhere on the tap layer, Space / E / Enter
    const tap = el('div', 'eat-tap');
    this.layer.appendChild(tap);
    tap.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.phase !== 'play') return;
      this.tapFx(toAppX(e.clientX), toAppY(e.clientY));
      this.onTap();
    });
    this.unsub.push(g.input.on('key', (k) => {
      if (k === 'Space' || k === 'KeyE' || k === 'Enter') this.onTap();
    }));

    this.aborted = false;
    try {
      let go = await this.intro();
      while (go && !this.aborted) {
        await this.playRound();
        if (this.aborted) break;
        go = await this.results();
      }
    } finally {
      this.cleanup();
    }
  }

  private intro() {
    const g = this.game;
    return new Promise<boolean>((res) => {
      this.phase = 'intro';
      const best = g.save.data.minigames.eating?.best ?? 0;
      const card = el('div', 'eat-card paper');
      card.innerHTML = `
        <div class="hero">🍱</div>
        <h2 class="grad-text">Lunch Parade!</h2>
        <div class="sub">Chef Mongmong is sending out lunch ♡ Feed Hamin!</div>
        <div class="eat-steps">
          <div class="eat-step"><span class="ico"><i class="ring"></i><i class="slide">🥟</i></span><span>Tap when the food is inside the ring!</span></div>
          <div class="eat-step"><span class="ico"><i class="bub">🍙</i></span><span>Feed Hamin what he’s craving for a big bonus!</span></div>
          <div class="eat-step"><span class="ico">🌶️🐑<i class="no">❌</i></span><span>Let spicy peppers and tiny sheep pass by!</span></div>
          <div class="eat-step"><span class="ico">🍓🥛</span><span>Strawberry milk slows the belt down.</span></div>
          <div class="eat-step"><span class="ico">⭐</span><span>Star candy starts Yummy Fever ×2!</span></div>
          <div class="eat-step"><span class="ico">🎂</span><span>Finale: tap tap tap to eat the Cake Tower!</span></div>
        </div>
        <div class="eat-best">${tr('Combos make Hamin happy 😊 · every bite fills his tummy 🍚')}${best ? ' · ' + trf('Best: {0}', `<b>${best}</b>`) : ''}</div>`;
      const btns = el('div', 'btns');
      const start = el('button', 'candy primary', '♡ Start!');
      const later = el('button', 'candy', 'Maybe later');
      btns.append(start, later);
      card.appendChild(btns);
      this.layer!.appendChild(card);
      const done = (v: boolean) => {
        g.audio.sfx(v ? 'select' : 'back');
        card.remove();
        this.introResolve = null;
        res(v);
      };
      start.onclick = (e) => { e.stopPropagation(); done(true); };
      later.onclick = (e) => { e.stopPropagation(); done(false); };
      this.introResolve = () => done(true);
    });
  }
  private introResolve: (() => void) | null = null;

  private async playRound() {
    const g = this.game;
    this.resetRound();
    this.buildHud();
    this.phase = 'count';
    g.audio.playMusic('eat');
    g.player.play('sit', { loop: true });
    await g.ui.countdown(this.layer!);
    if (this.aborted || !this.active) return;
    this.phase = 'play';
    this.lastFrame = performance.now();
    g.player.play('happy', { onEnd: () => this.sit() });
    await new Promise<void>((res) => (this.roundDone = res));
  }
  private roundDone: (() => void) | null = null;

  private async results() {
    const g = this.game;
    this.phase = 'end';
    const score = Math.round(this.score);
    const cleared = score >= CLEAR_SCORE;
    const hearts = clamp(Math.round(score / 250), 5, 40);
    const r = g.finishMinigame('eating', score, cleared, hearts);
    g.audio.sfx(cleared ? 'success' : 'fail');
    if (cleared) {
      g.player.play('victory', { onEnd: () => this.sit() });
      g.fx.burst(this.mouthPos(), 'confetti', 20);
    } else g.player.play('tired', { onEnd: () => this.sit() });
    const tw = this.tower;
    const b = await g.ui.result({
      emoji: cleared ? (this.towerDone ? '🎂' : this.golds ? '🍰' : '🍱') : '🥟',
      title: cleared ? (r.newBest ? 'New best! So full~ ♡' : this.towerDone ? 'Cake Tower cleared! ♡' : 'Yummy lunch! ♡') : 'Still a little hungry…',
      stats: [
        ['Score', score],
        ['Best combo', this.bestCombo],
        ['Cravings', this.craves + ' ♡'],
        ['Hearts', '+' + hearts + ' ♡'],
      ],
      reward: hearts,
      note: [
        this.bites === 1 ? tr('1 bite') : trf('{0} bites', this.bites),
        this.tummies === 1 ? tr('1 full tummy') : trf('{0} full tummies', this.tummies),
        this.towerDone ? tr('🎂 Cake Tower cleared!') : tw ? trf('🎂 Cake Tower: {0}/{1} layers', tw.eaten, tw.total) : '',
        this.golds ? trf('✨ {0} golden cake', this.golds) : '',
        this.peppers ? trf('🌶️ spicy bites: {0}', this.peppers) : this.dodged ? tr('🌶️ no spicy bites ♡') : '',
        this.sheepTapped ? trf('🐑 nibbled {0}×', this.sheepTapped) : this.sheepSaved ? tr('🐑 no sheep were eaten ♡') : '',
        cleared ? '' : trf('reach {0} to clear', CLEAR_SCORE),
      ].filter(Boolean).join(' · '),
      buttons: ['🔁 Replay', '✓ Done'],
    });
    return b === 0;
  }

  private aborted = false;
  /** Scene is being torn down mid-game (e.g. menu → title): stop without touching the camera/player. */
  abort() {
    if (!this.active) return;
    this.aborted = true;
    this.introResolve?.();
    this.roundDone?.();
    this.roundDone = null;
    this.cleanup();
  }

  private cleanup() {
    const g = this.game;
    if (this.phase === 'off' && !this.active) return;
    this.phase = 'off';
    this.active = false;
    for (const u of this.unsub) u();
    this.unsub = [];
    this.clearBelt();
    this.jobs = [];
    this.layer?.remove();
    this.layer = null;
    this.hud = {};
    this.fx.visible = false;
    this.cfg.setBelt(0.35);
    this.cfg.onActive?.(false);
    g.ui.setHud(true);
    const p = g.player;
    p.root.scale.set(1, 1, 1);
    p.root.rotation.z = 0;
    if (this.aborted) return;
    this.held = null;
    p.holdRight(null);
    p.overrideExpression(null);
    p.stop();
    p.moveSpeed = 0;
    p.root.position.set(this.cfg.exit.x, 0, this.cfg.exit.z);
    g.setFacing(this.cfg.exit.rot);
    g.cam.override = null;
    g.cam.snap(p.root.position);
    g.audio.playMusic('cafe');
  }

  // ------------------------------------------------------------------ round
  private clearBelt() {
    for (const it of this.items) {
      it.obj.removeFromParent();
      it.halo?.removeFromParent();
    }
    this.items = [];
    this.pending = [];
    this.sheep = null;
    this.tower?.group.removeFromParent();
    this.tower = null;
    this.crumbs.clear();
    this.hoop.visible = this.pad.visible = true;
  }

  private resetRound() {
    this.clearBelt();
    this.jobs = [];
    Object.assign(this, {
      t: 0, time: 0, frozen: false, speed: 1.3, slowK: 1, spawnIn: 0.2, score: 0, shownScore: 0, combo: 0, bestCombo: 0, perfects: 0, goods: 0, misses: 0, bites: 0,
      golds: 0, goldSpawned: 0, sheepTapped: 0, sheepSaved: 0, peppers: 0, dodged: 0, craves: 0, happy: 50, full: 0, tummies: 0,
      fever: 0, slow: 0, hot: 0, shake: 0, milkCool: 0, starCool: 0, pepperCool: 0, milkSpawned: 0, starSpawned: 0, lastKind: 'food', lastFood: '',
      crave: null, lastCrave: null, craveT: 0, craveNext: 5.5, craveDue: 0, craveFirst: true,
      saidDoubles: false, saidRush: false, finale: '', towerT: 0, towerBites: 0, towerDone: false,
      sq: 0, sqV: 0, wig: 0, hoopPop: 0, sayBusy: 0, sayStack: 0,
    });
    this.dropHeld();
    const p = this.game.player;
    p.overrideExpression(null);
    p.root.scale.set(1, 1, 1);
    p.root.rotation.z = 0;
  }

  private dropHeld() {
    this.held = null;
    this.heldDef = null;
    this.game.player.holdRight(null);
  }

  private holdFood(def: FoodDef, spicy = false) {
    const held = bakedFood(def);
    held.scale.setScalar(HELD_SCALE);
    held.position.copy(HAND_OFS);
    held.rotation.set(0.3, 0, 0);
    this.game.player.holdRight(held);
    this.held = held;
    this.heldDef = def;
    this.heldAge = 0;
    this.heldBit = false;
    this.heldSpicy = spicy;
  }

  private updateHeld(dt: number) {
    const h = this.held!;
    this.heldAge += dt;
    const a = this.heldAge;
    if (a > 0.8 || !h.parent) return this.dropHeld();
    const k = clamp(a / 0.26, 0, 1);
    const up = k * k * (3 - 2 * k) * (a < 0.52 ? 1 : clamp((0.8 - a) / 0.28, 0, 1));
    const anchor = h.parent;
    anchor.updateWorldMatrix(true, false);
    const target = anchor.worldToLocal(this.mouthPos(-0.12, 0.42));
    h.position.lerpVectors(HAND_OFS, target, up * 0.92);
    const bite = a < 0.3 ? 1 : Math.max(0.2, 1 - (a - 0.3) * 1.6);
    h.scale.setScalar(HELD_SCALE * bite * (1 + Math.sin(a * 40) * 0.04 * (a > 0.3 ? 1 : 0)));
    // CHOMP: crumbs fly, cheeks bulge
    if (!this.heldBit && a >= 0.3) {
      this.heldBit = true;
      const def = this.heldDef;
      this.crumbs.emit(this.mouthPos(-0.1, 0.5), def?.crumbs ?? [P.cream, P.butter], 9, 'crumb', { dir: new THREE.Vector3(0, 0, 0.5) });
      this.game.audio.sfx('eat', 0.8);
      this.squash(0.9);
      if (this.heldSpicy) this.spicy();
    }
  }

  // ------------------------------------------------------------------ HUD
  private buildHud() {
    const L = this.layer!;
    for (const e of [...L.children]) if (!e.classList.contains('eat-tap')) e.remove();
    const top = el('div', 'mg-top');
    const score = el('div', 'mg-pill eat-score', '<small>score</small><b>0</b>');
    const timer = el('div', 'mg-pill eat-timer', `<small>time</small><b>${ROUND}</b>`);
    const meters = el('div', 'eat-meters');
    const happy = el('div', 'eat-meter-row', '<span>😊</span><div class="meter"><i style="width:50%"></i></div>');
    const full = el('div', 'eat-meter-row', '<span>🍚</span><div class="meter mint"><i style="width:0%"></i></div>');
    meters.append(happy, full);
    top.append(score, timer, meters);
    const tintSlow = el('div', 'eat-tint slow');
    const tintFever = el('div', 'eat-tint fever');
    const combo = el('div', 'eat-combo');
    combo.style.opacity = '0';
    const status = el('div', 'eat-status');
    const hint = el('div', 'eat-hint', document.body.classList.contains('touch') ? 'Tap anywhere when the food is in the ring ♡' : 'Press Space, E or click when the food is in the ring ♡');
    const think = el('div', 'eat-think', '<i class="d2"></i><i class="d1"></i><div class="cloud"><span class="em"></span><span class="heart">💗</span></div>');
    L.append(tintSlow, tintFever, think, top, combo, status, hint);
    this.hud = {
      score: score.querySelector('b')!, scorePill: score, timer: timer.querySelector('b')!, timerPill: timer,
      happy: happy.querySelector('i')!, happyMeter: happy.querySelector('.meter')!, full: full.querySelector('i')!, combo, hint, status,
      tintSlow, tintFever, think, thinkEm: think.querySelector('.em')!,
    };
    this.later(4, () => this.phase === 'play' && !this.finale && (hint.style.opacity = '0.75'));
  }

  private updateHud() {
    const h = this.hud;
    if (!h.score) return;
    const s = Math.round(this.score);
    if (s !== this.shownScore) {
      this.shownScore = s;
      h.score.textContent = String(s);
      bump(h.scorePill);
    }
    const left = Math.max(0, Math.ceil(ROUND - this.t));
    if (h.timer.textContent !== String(left)) {
      h.timer.textContent = String(left);
      h.timerPill.classList.toggle('low', left <= 10);
      if (left <= 5 && left > 0 && !this.towerDone) this.game.audio.sfx('count', 0.45);
    }
    h.happy.style.width = this.happy.toFixed(0) + '%';
    h.happyMeter.classList.toggle('fever', this.fever > 0);
    h.full.style.width = this.full.toFixed(0) + '%';
    if (h.feverBar) h.feverBar.style.width = clamp((this.fever / FEVER_TIME) * 100, 0, 100).toFixed(1) + '%';
    if (h.slowBar) h.slowBar.style.width = clamp((this.slow / SLOW_TIME) * 100, 0, 100).toFixed(1) + '%';
  }

  private comboMult() { return 1 + Math.min(10, Math.floor(this.combo / 5)) * 0.1; }

  private setCombo(broke = 0) {
    const c = this.hud.combo;
    if (!c) return;
    c.classList.remove('bump', 'break', 't2', 't3');
    if (this.combo >= 3) {
      c.innerHTML = `${this.combo} combo ♡<small>×${this.comboMult().toFixed(1)}</small>`;
      c.style.opacity = '1';
      if (this.combo >= 25) c.classList.add('t3');
      else if (this.combo >= 10) c.classList.add('t2');
      void c.offsetWidth;
      c.classList.add('bump');
    } else if (broke >= 5) {
      // the old combo tumbles away
      void c.offsetWidth;
      c.classList.add('break');
    } else c.style.opacity = '0';
  }

  private addScore(n: number) {
    this.score = Math.max(0, this.score + n);
  }

  private pts(pos: THREE.Vector3, text: string, cls = '') {
    if (!this.layer) return;
    const s = this.project(pos);
    if (!s) return;
    const e = el('div', 'eat-pts ' + cls, text);
    e.style.left = s.x + (Math.random() - 0.5) * 16 + 'px';
    e.style.top = s.y + 'px';
    this.layer.appendChild(e);
    setTimeout(() => e.remove(), cls.includes('big') ? 1450 : 950);
  }

  private banner(title: string, sub = '', cls = '') {
    if (!this.layer) return;
    const b = el('div', 'eat-banner ' + cls, `<b>${title}</b>${sub ? `<br><small>${sub}</small>` : ''}`);
    this.layer.appendChild(b);
    setTimeout(() => b.remove(), 2400);
  }

  private project(v: THREE.Vector3) {
    const p = v.clone().project(this.game.engine.camera);
    if (p.z > 1 || p.z < -1) return null;
    return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
  }

  // ------------------------------------------------------------------ per-frame
  update(dt: number) {
    if (!this.active) return;
    const g = this.game;
    this.lastFrame = performance.now();
    if (this.phase === 'play' && g.ui.modalOpen) {
      this.cfg.setBelt(0);
      this.updateCam(false);
      return; // paused by the menu
    }
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt);
    this.sayBusy = Math.max(0, this.sayBusy - dt);
    this.updateCam(false);
    this.runJobs(dt);
    this.updateHoop(dt);
    if (this.held) this.updateHeld(dt);
    this.updateHamin(dt);
    if (this.phase === 'play') this.updatePlay(dt);
    const belt = this.phase === 'play' ? (this.finale === 'mash' ? 0 : this.finale ? 1.2 : this.beltV) : this.phase === 'end' ? 0.35 : 0.6;
    this.cfg.setBelt(belt);
    this.moveItems(dt);
    this.updateTower(dt);
    this.crumbs.update(dt);
    this.updateThink();
  }

  private get beltV() { return this.speed * this.slowK; }

  private updatePlay(dt: number) {
    if (!this.frozen) this.t += dt;
    const t = this.t;
    const k = clamp(t / LAST_SPAWN, 0, 1);
    this.speed = 1.3 + 1.5 * Math.pow(k, 1.15);
    // strawberry-milk slow-mo eases in and out
    if (this.slow > 0) {
      this.slow -= dt;
      if (this.slow <= 0) this.endSlow();
    }
    this.slowK += ((this.slow > 0 ? SLOW_K : 1) - this.slowK) * Math.min(1, dt * 5);
    if (!this.finale) {
      const bdt = dt * this.slowK; // "belt time" keeps spacing identical in slow-mo
      this.spawnIn -= bdt;
      if (this.spawnIn <= 0 && t < LAST_SPAWN) this.spawnGroup();
      for (const p of this.pending) {
        p.in -= bdt;
        if (p.in <= 0) {
          const c = this.chooseKind(true);
          this.spawnItem(c.kind, c.def);
        }
      }
      this.pending = this.pending.filter((p) => p.in > 0);
      this.milkCool -= dt;
      this.starCool -= dt;
      this.pepperCool -= dt;
      this.updateCraving(dt);
      if (!this.saidDoubles && t >= DOUBLES_AT) {
        this.saidDoubles = true;
        this.banner('✨ Double bites! ✨', 'Two foods in a row, tap tap!');
        this.game.audio.sfx('chime', 0.8);
      }
      if (!this.saidRush && t >= RUSH_AT) {
        this.saidRush = true;
        this.banner('🔥 Lunch rush! 🔥', '', 'hot');
        this.game.audio.sfx('go', 0.8);
      }
      if (t >= FINALE_AT) this.startFinale();
    }
    if (this.fever > 0) {
      this.fever -= dt;
      if (this.fever <= 0) this.endFever(true);
    }
    // happiness gently settles
    if (this.fever <= 0 && this.happy > 45) this.happy = Math.max(45, this.happy - dt * 1.2);
    if (this.t >= ROUND) this.finishRound();
    this.updateHud();
  }

  private goodDist() { return Math.max(0.3, this.beltV * 0.14); }
  private perfectDist() { return Math.max(0.12, this.beltV * 0.062); }

  private updateHoop(dt: number) {
    const zone = this.goodDist();
    const s = zone / 0.3;
    const near = this.phase === 'play' && this.items.some((i) => i.state === 'belt' && i.kind !== 'sheep' && i.kind !== 'pepper' && Math.abs(i.x - this.cfg.ringX) < zone);
    this.hoopPop = Math.max(0, this.hoopPop - dt * 5);
    const pulse = 1 + Math.sin(this.time * 6.2) * 0.03 + (near ? 0.06 : 0) + Math.sin(this.hoopPop * Math.PI) * 0.22;
    this.hoop.scale.setScalar(s * pulse);
    this.pad.scale.setScalar(s * (near ? 1.1 : 1) * (1 + this.hoopPop * 0.15));
    if (this.hoopFlash > 0) {
      this.hoopFlash -= dt;
      this.hoopMat.color.copy(this.hoopFlashColor);
    } else if (this.fever > 0) this.hoopMat.color.setHSL((this.time * 0.9) % 1, 0.85, 0.72);
    else this.hoopMat.color.setHex(near ? 0xff7a93 : P.pinkDeep);
  }

  // ------------------------------------------------------------------ spawning
  private spawnGroup() {
    const t = this.t;
    const k = clamp(t / LAST_SPAWN, 0, 1);
    // gap shrinks from ~1.35 s to ~0.65 s, with a little swing
    const gap = (1.35 - 0.7 * k) * (0.85 + Math.random() * 0.3);
    const first = this.chooseKind(false);
    let n = 1;
    if (first.kind !== 'sheep' && first.kind !== 'gold' && t > DOUBLES_AT && t < LAST_SPAWN - 1.5) {
      const r = Math.random();
      if (t > RUSH_AT && r < 0.14) n = 3;
      else if (r < (t > RUSH_AT ? 0.45 : 0.3)) n = 2;
    }
    this.spawnItem(first.kind, first.def);
    let at = 0;
    for (let i = 1; i < n; i++) {
      at += 0.4 + Math.random() * 0.06;
      this.pending.push({ in: at });
    }
    this.spawnIn = gap + at + (n > 1 ? 0.3 : 0);
  }

  private chooseKind(follower: boolean): { kind: Kind; def: FoodDef } {
    const t = this.t;
    const last = this.lastKind;
    const roll = (p: number) => Math.random() < p;
    let kind: Kind = 'food';
    if (!follower && t > 8 && last !== 'sheep' && !this.sheep && roll(0.085)) kind = 'sheep';
    else if (t > 16 && last !== 'pepper' && this.pepperCool <= 0 && roll(0.1 + 0.07 * clamp((t - 16) / 40, 0, 1))) kind = 'pepper';
    else if (!follower && t > 11 && this.milkCool <= 0 && this.slow <= 0 && (roll(0.08) || (this.milkSpawned === 0 && t > 19))) kind = 'milk';
    else if (!follower && t > 22 && this.starCool <= 0 && this.fever <= 0 && (roll(0.07) || (this.starSpawned === 0 && t > 33))) kind = 'star';
    else if (!follower && t > 9 && this.goldSpawned < 2 && last !== 'gold' && (roll(0.03) || (this.goldSpawned === 0 && t > 40 && roll(0.3)))) kind = 'gold';
    this.lastKind = kind;
    let def: FoodDef;
    switch (kind) {
      case 'sheep': def = SHEEP_HELPER; break;
      case 'pepper': def = SPICY_PEPPER; this.pepperCool = 2.2; break;
      case 'milk': def = MILK; this.milkCool = 13; this.milkSpawned++; break;
      case 'star': def = STAR_CANDY; this.starCool = 18; this.starSpawned++; break;
      case 'gold': def = GOLDEN_CAKE; this.goldSpawned++; break;
      default: {
        const c = this.crave;
        this.craveDue--;
        if (c && (this.craveDue <= 0 || Math.random() < 0.2)) {
          def = c;
          this.craveDue = 3 + Math.floor(Math.random() * 3);
        } else def = pick(REGULAR.filter((f) => f.id !== this.lastFood && f !== c));
        this.lastFood = def.id;
      }
    }
    return { kind, def };
  }

  private spawnItem(kind: Kind, def: FoodDef) {
    let obj: THREE.Object3D;
    if (kind === 'sheep') {
      obj = sheepHelper(SHEEP_MODEL); // Higgsfield sheep, procedural fallback if it failed to load
      obj.traverse((o) => ((o as THREE.Mesh).castShadow = true));
      obj.rotation.y = Math.PI / 2;
      this.sheep = obj as THREE.Group;
      this.game.audio.sfx('baa', 0.6);
    } else {
      obj = bakedFood(def);
      obj.rotation.y = kind === 'star' ? 0 : (Math.random() - 0.5) * 0.4;
      if (kind === 'milk' || kind === 'star') this.game.audio.sfx('sparkle', 0.5);
    }
    let halo: THREE.Mesh | null = null;
    if (kind !== 'sheep' && kind !== 'pepper') {
      halo = new THREE.Mesh(haloGeo(), basic(HALO_GOLD));
      halo.rotation.x = -Math.PI / 2;
      halo.renderOrder = 2;
      halo.userData.noShadow = true;
      halo.visible = false;
      this.fx.add(halo);
    }
    const x = this.cfg.x0;
    obj.position.set(x, this.cfg.beltY, this.cfg.beltZ);
    obj.scale.setScalar(0.4);
    this.fx.add(obj);
    this.items.push({
      kind, def, obj, halo, x, y: 0, vy: 0, vx: 0, spin: 0, state: 'belt', age: 0, wander: Math.random() * 6, life: 0, hop: 0, from: new THREE.Vector3(), fxAcc: 0,
    });
  }

  private isCraved(it: Item) { return !!this.crave && it.kind === 'food' && it.def === this.crave; }

  private moveItems(dt: number) {
    const c = this.cfg;
    const g = this.game;
    const zone = this.goodDist();
    const v = this.phase === 'play' ? (this.finale ? 2.2 : this.beltV) : 0.9;
    for (const it of this.items) {
      it.age += dt;
      const o = it.obj;
      if (it.state === 'belt' || it.state === 'missed') {
        let vx = v;
        let bob = 0;
        const craved = this.isCraved(it);
        if (it.kind === 'sheep') {
          // the little helper toddles about on the belt: sometimes walks back, sometimes hurries
          vx += Math.sin(it.age * 1.7 + it.wander) * 0.45 - 0.1;
          sheepWalk(o, it.age * 14); // legs (procedural) or waddle + hop (model)
          o.rotation.y = Math.PI / 2 + Math.sin(it.age * 3) * 0.25;
        } else if (it.kind === 'gold') {
          o.rotation.y += dt * 2.2;
          this.sparkleFrom(it, dt, 6);
        } else if (it.kind === 'star') {
          bob = Math.abs(Math.sin(it.age * 5)) * 0.09;
          o.rotation.y = Math.sin(it.age * 3) * 0.5;
          o.rotation.z = Math.sin(it.age * 5) * 0.12;
          this.sparkleFrom(it, dt, 5);
        } else if (it.kind === 'pepper') {
          // grumpy jitter + little flame sparks
          o.rotation.z = Math.sin(it.age * 24) * 0.07;
          it.fxAcc += dt * 7;
          if (it.fxAcc > 1 && it.state === 'belt') {
            it.fxAcc = 0;
            this.crumbs.emit(o.position.clone().add(new THREE.Vector3(0.03, 0.4, 0)), FIRE, 1, 'spark', { jitter: 0.03 });
          }
        } else if (it.kind === 'milk') {
          o.rotation.z = Math.sin(it.age * 3) * 0.1;
        } else if (craved && it.state === 'belt') {
          // the craved food does happy little hops
          bob = Math.abs(Math.sin(it.age * 7)) * 0.06;
          it.fxAcc += dt * 1.6;
          if (it.fxAcc > 1) {
            it.fxAcc = 0;
            g.fx.floatUp(o.position.clone().add(new THREE.Vector3(0, 0.45, 0)), 'hearts');
          }
        } else if (this.fever > 0 && it.state === 'belt') this.sparkleFrom(it, dt, 1.4);
        // glowing halo under specials / craved food / everything during fever
        if (it.halo) {
          const col = it.kind === 'milk' ? HALO_MILK : it.kind === 'star' || it.kind === 'gold' ? HALO_GOLD : craved ? HALO_CRAVE : this.fever > 0 ? HALO_GOLD : 0;
          it.halo.visible = !!col && it.state === 'belt';
          if (col) {
            it.halo.material = basic(col);
            it.halo.scale.setScalar((0.9 + Math.sin(this.time * 8 + it.wander) * 0.12) * Math.min(1, it.age * 5));
            it.halo.position.set(it.x + vx * dt, c.beltY + 0.016, c.beltZ);
          }
        }
        it.x += vx * dt;
        o.position.set(it.x, c.beltY + bob, c.beltZ);
        // squash-bounce in on spawn
        const pop = Math.min(1, it.age * 5);
        o.scale.setScalar(0.4 + 0.6 * pop + Math.sin(pop * Math.PI) * 0.15);
        if (it.state === 'belt' && this.phase === 'play' && !this.finale && it.x > c.ringX + zone * 1.05) {
          if (it.kind === 'sheep') this.sheepSafe(it);
          else if (it.kind === 'pepper') this.pepperSkip(it);
          else this.miss(it, true);
        }
        if (it.x >= c.x1) {
          it.state = 'fall';
          it.vy = 0.6;
          it.vx = v;
        }
      } else if (it.state === 'hop') {
        // squash on the belt, then stretch and fly into Hamin's hand
        it.hop += dt / HOP_TIME;
        const k = Math.min(1, it.hop);
        if (k < 0.3) {
          const a = Math.sin((k / 0.3) * Math.PI);
          o.scale.set(1 + 0.4 * a, 1 - 0.38 * a, 1 + 0.4 * a);
        } else {
          const m = (k - 0.3) / 0.7;
          o.position.lerpVectors(it.from, this.mouthPos(-0.35, 0.42), m);
          o.position.y += Math.sin(m * Math.PI) * 0.3;
          const s = 1 + (HELD_SCALE - 1) * m;
          o.scale.set(s * 0.85, s * 1.25, s * 0.85);
        }
        if (k >= 1) {
          it.state = 'gone';
          this.holdFood(it.def, it.kind === 'pepper');
        }
      } else if (it.state === 'fall') {
        it.vy -= 9 * dt;
        it.y += it.vy * dt;
        it.x += it.vx * dt;
        o.position.set(it.x, c.beltY + it.y, c.beltZ);
        o.rotation.z -= dt * 3;
        if (it.y < -0.7) it.state = 'gone';
      } else if (it.state === 'fly') {
        // sheep hopping away in fright
        it.vy -= 9 * dt;
        it.y += it.vy * dt;
        it.x += it.vx * dt;
        o.position.set(it.x, c.beltY + it.y, c.beltZ + it.life);
        it.life += dt * 1.6;
        o.rotation.x += it.spin * dt;
        if (it.y < -1) it.state = 'gone';
      }
    }
    for (const it of this.items) if (it.state === 'gone') {
      it.obj.removeFromParent();
      it.halo?.removeFromParent();
      if (it.obj === this.sheep) this.sheep = null;
    }
    this.items = this.items.filter((i) => i.state !== 'gone');
  }

  private sparkleFrom(it: Item, dt: number, rate: number) {
    if (it.state !== 'belt' || Math.random() > dt * rate) return;
    const o = it.obj;
    this.game.fx.floatUp(o.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.4, 0)), 'sparkles');
  }

  // ------------------------------------------------------------------ cravings
  private updateCraving(dt: number) {
    if (!this.crave) {
      this.craveNext -= dt;
      if (this.craveNext <= 0) this.newCrave();
      return;
    }
    this.craveT -= dt;
    if (this.craveT <= 0 && !this.items.some((i) => i.state === 'belt' && this.isCraved(i))) this.dropCrave(true);
  }

  private newCrave() {
    const c = pick(REGULAR.filter((f) => f !== this.lastCrave));
    this.crave = c;
    this.lastCrave = c;
    this.craveT = 10 + Math.random() * 3;
    this.craveDue = 1 + Math.floor(Math.random() * 2);
    const th = this.hud.think;
    if (!th) return;
    this.hud.thinkEm.textContent = c.emoji;
    th.className = 'eat-think';
    void th.offsetWidth;
    th.classList.add('show');
    this.game.audio.sfx('pop', 0.6);
    if (this.craveFirst) {
      this.craveFirst = false;
      this.say('Hmm… I’m craving something! 💭', '', true);
    }
  }

  private satisfyCrave(def: FoodDef) {
    const g = this.game;
    this.craves++;
    this.crave = null;
    this.craveNext = 1.8 + Math.random() * 1.2;
    const th = this.hud.think;
    if (th) {
      th.className = 'eat-think yay';
      this.later(0.55, () => th.classList.contains('yay') && (th.className = 'eat-think'));
    }
    const mouth = this.mouthPos();
    g.ui.react(this.thinkPos.clone().setY(this.thinkPos.y + 0.3), trf('Yay, {0}! ♡', tr(def.name)), 'big');
    g.fx.burst(mouth, 'hearts', 10, 0.9);
    this.wig = 1;
    g.player.overrideExpression('love');
    this.later(1.6, () => this.fever <= 0 && this.hot <= 0 && g.player.overrideExpression(null));
  }

  /** The craving passes (timed out, or the finale starts). */
  private dropCrave(sad: boolean) {
    this.crave = null;
    this.craveNext = 1.4;
    const th = this.hud.think;
    if (!th) return;
    th.className = sad ? 'eat-think sad' : 'eat-think';
    if (sad) this.later(0.75, () => th.classList.contains('sad') && (th.className = 'eat-think'));
  }

  private updateThink() {
    const th = this.hud.think;
    if (!th || !th.className.includes(' ')) return;
    const s = this.project(this.thinkPos);
    if (s) th.style.transform = `translate(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px)`;
    if (this.crave && this.phase === 'play') {
      const c = this.cfg;
      const zone = this.goodDist();
      const eager = this.items.some((i) => i.state === 'belt' && this.isCraved(i) && i.x > c.ringX - 1.7 && i.x < c.ringX + zone);
      th.classList.toggle('eager', eager);
    }
  }

  // ------------------------------------------------------------------ input & judging
  private onTap() {
    if (this.phase === 'intro') {
      // keyboard start
      if (this.introResolve) this.introResolve();
      return;
    }
    if (this.phase !== 'play' || this.game.ui.modalOpen) return;
    if (this.finale) {
      if (this.finale === 'mash') this.towerBite();
      return;
    }
    const c = this.cfg;
    // extrapolate belt positions to the exact tap moment (smooth at 30 fps)
    const late = Math.min(0.05, (performance.now() - this.lastFrame) / 1000);
    let best: Item | null = null;
    let bd = Infinity;
    for (const it of this.items) {
      if (it.state !== 'belt') continue;
      const d = Math.abs(it.x + this.beltV * late - c.ringX);
      if (d < bd) { bd = d; best = it; }
    }
    if (!best || bd > 0.95) {
      this.game.audio.sfx('tap', 0.5);
      return;
    }
    const zone = this.goodDist();
    if (best.kind === 'sheep' || best.kind === 'pepper') {
      if (bd <= zone * 1.1) {
        if (best.kind === 'sheep') this.sheepBite(best);
        else this.pepperBite(best);
      } else this.game.audio.sfx('tap', 0.5);
      return;
    }
    if (bd <= this.perfectDist()) this.eat(best, 'perfect');
    else if (bd <= zone) this.eat(best, 'good');
    else this.miss(best, false);
  }

  private ringPos(dy = 0.55) { return new THREE.Vector3(this.cfg.ringX, this.cfg.beltY + dy, this.cfg.beltZ); }

  private eat(it: Item, j: Judge) {
    const g = this.game;
    const p = g.player;
    const kind = it.kind;
    const gold = kind === 'gold';
    const crave = this.isCraved(it);
    const special = kind === 'milk' || kind === 'star';
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    if (j === 'perfect') this.perfects++;
    else this.goods++;
    this.bites++;
    const mult = this.comboMult() * (this.fever > 0 ? 2 : 1);
    let base = gold ? (j === 'perfect' ? 600 : 400) : special ? (j === 'perfect' ? 150 : 100) : j === 'perfect' ? 100 : 50;
    if (crave) base = j === 'perfect' ? 250 : 150;
    const gain = Math.round(base * mult);
    this.addScore(gain);
    this.pts(this.ringPos(), '+' + gain, gold ? 'gold' : crave ? 'crave' : j === 'perfect' ? '' : 'good');
    // meters
    this.happy = Math.min(100, this.happy + (j === 'perfect' ? 5 : 2.5) + Math.min(this.combo, 20) * 0.25 + (gold ? 25 : 0) + (crave ? 12 : 0));
    this.full += gold ? 10 : 4;
    if (this.full >= 100) {
      this.full = 0;
      this.tummies++;
      this.addScore(300);
      g.audio.sfx('unlock');
      this.say('So full~ +300 (っ˘ڡ˘ς)', 'big', true);
      g.fx.burst(this.mouthPos(), 'hearts', 10);
    }
    // judge text & sound
    g.ui.judge(this.layer!, j, gold ? (j === 'perfect' ? 'GOLDEN ✨ Perfect!' : 'GOLDEN ✨ Yum!') : crave ? (j === 'perfect' ? 'Craving ♡ Perfect!' : 'Craving ♡ Yum!') : undefined);
    g.audio.sfx(j === 'perfect' ? 'perfect' : 'good');
    g.audio.sfx('pop', 0.5);
    this.flashHoop(gold || kind === 'star' ? 0xffd24a : crave ? 0xff5f8a : kind === 'milk' ? 0x9fd0ff : j === 'perfect' ? 0xff7a93 : P.blueDeep);
    this.hoopPop = 1;
    // the food squashes, then hops into Hamin's hand
    it.state = 'hop';
    it.hop = 0;
    it.from.copy(it.obj.position);
    if (it.halo) it.halo.visible = false;
    p.play('sitEat', { onEnd: () => (gold || crave ? p.play('heart', { onEnd: () => this.sit() }) : this.sit()) });
    const mouth = this.mouthPos();
    g.fx.burst(this.ringPos(0.3), 'sparkles', gold ? 12 : j === 'perfect' ? 5 : 3, 0.6);
    if (gold) {
      this.golds++;
      g.audio.sfx('sparkle');
      g.audio.sfx('chime');
      g.fx.burst(mouth, 'sparkles', 16, 1.4);
      g.fx.burst(mouth, 'hearts', 8);
      this.say(GOLDEN_CAKE.yum, 'big', true);
      p.overrideExpression('love');
      this.wig = 1;
      this.later(2.2, () => this.fever <= 0 && this.hot <= 0 && p.overrideExpression(null));
    } else if (crave) {
      g.audio.sfx('coin');
      g.audio.sfx('heart', 0.8);
      this.satisfyCrave(it.def);
    } else if (kind === 'milk') {
      this.later(0.3, () => this.startSlow());
    } else if (kind === 'star') {
      this.later(0.3, () => this.startFever());
    } else if (j === 'perfect') {
      g.fx.burst(mouth, 'hearts', 3, 0.6);
      if (this.combo % 5 === 0 || Math.random() < 0.3) this.say(it.def.yum);
    } else if (Math.random() < 0.25) this.say(pick(YUM_GOOD), 'plain');
    if (this.combo > 0 && this.combo % 10 === 0) {
      g.ui.react(this.ringPos(1.0).setX(this.cfg.ringX + 1.25), trf('{0} combo! ♡', this.combo), 'big');
      g.fx.burst(mouth, 'confetti', 12);
      g.audio.sfx('heart');
      this.wig = Math.max(this.wig, 0.7);
    }
    if (this.happy >= 100 && this.fever <= 0) this.startFever();
    this.setCombo();
  }

  private breakCombo() {
    const had = this.combo;
    this.combo = 0;
    this.setCombo(had);
    return had;
  }

  private miss(it: Item, passed: boolean) {
    const g = this.game;
    const craved = this.isCraved(it);
    it.state = 'missed';
    this.misses++;
    const had = this.breakCombo();
    this.happy = Math.max(0, this.happy - (had >= 10 ? 14 : 9));
    g.ui.judge(this.layer!, 'miss', passed ? 'Miss…' : had ? (it.x < this.cfg.ringX ? 'Too early!' : 'Too late!') : undefined);
    g.audio.sfx('miss', 0.8);
    this.flashHoop(0xc9c2d8);
    if (craved) {
      const th = this.hud.think;
      if (th) {
        th.classList.remove('shake');
        void th.offsetWidth;
        th.classList.add('shake');
      }
      this.say('aww… I wanted that! 🥺', 'plain', true);
    } else if (passed && (had >= 5 || Math.random() < 0.3)) this.say(pick(MISS), 'plain');
    if (!g.player.currentAction || g.player.currentAction === 'sit') {
      g.player.overrideExpression('tired');
      this.later(0.7, () => this.fever <= 0 && this.hot <= 0 && g.player.currentAction === 'sit' && g.player.overrideExpression(null));
    }
  }

  private sheepBite(it: Item) {
    const g = this.game;
    this.sheepTapped++;
    this.breakCombo();
    this.addScore(-200);
    this.happy = Math.max(0, this.happy - 20);
    g.ui.judge(this.layer!, 'miss', 'Baa?! −200');
    g.audio.sfx('baa');
    g.audio.sfx('bump', 0.6);
    this.flashHoop(0xc9c2d8);
    this.shake = 0.25;
    const sp = it.obj.position.clone().setY(it.obj.position.y + 0.5);
    this.pts(sp, '−200', 'bad');
    g.ui.react(sp, 'Baa?! 🐑💦', 'big');
    g.fx.burst(sp, 'sparkles', 8, 0.5);
    g.player.overrideExpression(null);
    g.player.play('surprised', { onEnd: () => { this.sit(); if (this.active) this.say('sorry, little sheep! (>_<)', 'plain'); } });
    // the helper leaps off the belt
    it.state = 'fly';
    it.vy = 3.4;
    it.vx = -0.4;
    it.spin = -6;
    it.life = 0;
  }

  private sheepSafe(it: Item) {
    const g = this.game;
    it.state = 'missed';
    this.sheepSaved++;
    this.addScore(50);
    g.audio.sfx('baa', 0.5);
    const at = it.obj.position.clone().setY(it.obj.position.y + 0.6);
    this.pts(at, '+50', 'mint');
    g.ui.react(at.setY(at.y + 0.3), 'thank you~ +50 🐑♡', 'plain');
  }

  private pepperBite(it: Item) {
    const g = this.game;
    this.peppers++;
    this.breakCombo();
    this.addScore(-150);
    this.happy = Math.max(0, this.happy - 12);
    g.ui.judge(this.layer!, 'miss', 'Spicy!! −150');
    g.audio.sfx('squeak');
    this.flashHoop(0xff8a5a);
    this.pts(this.ringPos(), '−150', 'bad');
    it.state = 'hop';
    it.hop = 0;
    it.from.copy(it.obj.position);
    g.player.play('sitEat', { onEnd: () => this.sit() });
  }

  /** The pepper got eaten: red-hot Hamin breathes fire and steams from the ears. */
  private spicy() {
    const g = this.game;
    this.hot = 1.9;
    this.shake = 0.5;
    g.audio.sfx('bump', 0.8);
    g.audio.sfx('whoosh');
    if (this.layer) {
      const hot = el('div', 'eat-hot');
      this.layer.appendChild(hot);
      setTimeout(() => hot.remove(), 1450);
    }
    this.say('🥵 Spicy!!', 'big', true);
    g.player.overrideExpression('surprised');
    g.player.play('surprised', { onEnd: () => this.sit() });
    this.later(1.4, () => this.say('water… 💦', 'plain'));
  }

  private pepperSkip(it: Item) {
    const g = this.game;
    it.state = 'missed';
    this.dodged++;
    this.addScore(30);
    g.audio.sfx('pop', 0.45);
    this.pts(it.obj.position.clone().setY(it.obj.position.y + 0.55), '+30', 'mint');
    if (this.dodged === 1 || Math.random() < 0.25) this.say('phew~ nice skip! 🌶️', 'plain');
  }

  // ------------------------------------------------------------------ specials
  private startFever() {
    const g = this.game;
    const was = this.fever > 0;
    this.fever = FEVER_TIME;
    this.happy = 100;
    if (was) {
      g.audio.sfx('sparkle');
      return;
    }
    g.audio.sfx('unlock');
    g.audio.sfx('cheer', 0.7);
    this.say('Yummy Fever! ×2 ✧*。', 'big', true);
    g.fx.burst(this.mouthPos(), 'hearts', 12);
    g.player.overrideExpression('love');
    this.wig = 1;
    const pill = el('div', 'eat-pill fever', '<span>✨ Yummy Fever ×2 ✨</span><i></i>');
    this.hud.status?.appendChild(pill);
    this.hud.fever = pill;
    this.hud.feverBar = pill.querySelector('i')!;
    this.hud.tintFever?.classList.add('on');
  }

  private endFever(natural: boolean) {
    if (natural) this.happy = 60;
    this.fever = 0;
    this.hud.fever?.remove();
    delete this.hud.fever;
    delete this.hud.feverBar;
    this.hud.tintFever?.classList.remove('on');
    if (this.hot <= 0) this.game.player.overrideExpression(null);
  }

  private startSlow() {
    const g = this.game;
    this.slow = SLOW_TIME;
    g.audio.sfx('whoosh', 0.7);
    g.audio.sfx('chime', 0.8);
    this.say('Slow-mo~ (˘ω˘)', 'big', true);
    if (!this.hud.slow) {
      const pill = el('div', 'eat-pill slow', '<span>🥛 Slow-mo~</span><i></i>');
      this.hud.status?.appendChild(pill);
      this.hud.slow = pill;
      this.hud.slowBar = pill.querySelector('i')!;
    }
    this.hud.tintSlow?.classList.add('on');
  }

  private endSlow() {
    this.slow = 0;
    this.hud.slow?.remove();
    delete this.hud.slow;
    delete this.hud.slowBar;
    this.hud.tintSlow?.classList.remove('on');
  }

  // ------------------------------------------------------------------ Cake Tower finale
  private startFinale() {
    const g = this.game;
    const c = this.cfg;
    this.finale = 'arrive';
    this.towerT = 0;
    if (this.crave) this.dropCrave(false);
    this.endSlow();
    for (const it of this.items) if (it.state === 'belt') it.state = 'missed';
    this.pending = [];
    const tw = new CakeTower();
    tw.group.position.set(c.x0, c.beltY, c.beltZ);
    tw.group.scale.setScalar(0.3);
    tw.target.copy(this.mouthPos(-0.15, 0.4));
    this.fx.add(tw.group);
    this.tower = tw;
    this.hoop.visible = this.pad.visible = false;
    this.banner('🎂 Cake Tower! 🎂', 'Tap tap tap as fast as you can! ♡', 'cake');
    g.audio.sfx('whoosh');
    g.audio.sfx('chime');
    this.say('Cake!! ✧*。', 'big', true);
    g.player.overrideExpression('love');
    this.wig = 1;
    const h = this.hud;
    if (h.hint) {
      h.hint.textContent = 'Tap tap tap as fast as you can! ♡';
      h.hint.classList.add('mash');
      h.hint.style.opacity = '1';
    }
    if (this.layer) {
      const pips = el('div', 'eat-tower', Array.from({ length: tw.total }, () => '<span>🍰</span>').join(''));
      this.layer.appendChild(pips);
      h.tower = pips;
      this.updatePips();
    }
  }

  private updatePips() {
    const tw = this.tower;
    const pips = this.hud.tower;
    if (!tw || !pips) return;
    const e = tw.eaten;
    [...pips.children].forEach((s, i) => {
      s.classList.toggle('done', i < e);
      s.classList.toggle('cur', i === e && this.finale === 'mash');
    });
  }

  private updateTower(dt: number) {
    const tw = this.tower;
    if (!tw) return;
    if (this.finale === 'arrive') {
      this.towerT += dt;
      const k = clamp(this.towerT / TOWER_ARRIVE, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      tw.group.position.x = THREE.MathUtils.lerp(this.cfg.x0, this.cfg.ringX, e);
      tw.group.scale.setScalar((0.3 + 0.7 * easeOutBack(k)) * 0.95);
      if (k >= 1) {
        this.finale = 'mash';
        this.game.audio.sfx('go');
        this.crumbs.emit(tw.group.position.clone().setY(this.cfg.beltY + 0.1), [P.pink, P.butter, P.mint, P.lavender, P.white], 16, 'crumb', { speed: 1.8 });
        this.updatePips();
        this.game.player.overrideExpression(null);
      }
    }
    tw.update(dt, this.time);
  }

  private towerBite() {
    const tw = this.tower;
    if (!tw || this.towerDone) return;
    const r = tw.bite();
    if (!r) return;
    const g = this.game;
    const p = g.player;
    this.towerBites++;
    this.bites++;
    const mult = this.fever > 0 ? 2 : 1;
    const gain = 40 * mult;
    this.addScore(gain);
    this.pts(r.pos.clone().setY(r.pos.y + 0.15), '+' + gain);
    this.crumbs.emit(r.pos, r.colors, 7, 'crumb', { speed: 1.6 });
    g.audio.sfx('blip');
    if (this.towerBites % 2) g.audio.sfx('eat', 0.6);
    p.play('sitEat', { onEnd: () => this.sit() });
    this.squash(0.45);
    if (this.towerBites % 3 === 1) this.holdFood(CAKE_BITE);
    this.happy = Math.min(100, this.happy + 1.5);
    const c = this.hud.combo;
    if (c) {
      c.classList.remove('bump', 'break', 't2', 't3');
      c.textContent = trf('{0} bites', this.towerBites);
      c.style.opacity = '1';
      if (this.towerBites >= 15) c.classList.add('t3');
      void c.offsetWidth;
      c.classList.add('bump');
    }
    if (r.cleared) {
      const bonus = 150 * mult;
      this.addScore(bonus);
      this.pts(r.pos.clone().setY(r.pos.y + 0.45), '+' + bonus, 'gold');
      g.audio.sfx('pop');
      g.audio.sfx('coin');
      g.fx.burst(r.pos, 'sparkles', 8, 0.8);
      this.shake = 0.15;
      this.wig = 0.6;
      this.say(pick(TOWER_YUM), 'plain');
      this.updatePips();
    }
    if (r.done) this.towerCleared();
  }

  private towerCleared() {
    const g = this.game;
    const p = g.player;
    this.towerDone = true;
    this.frozen = true;
    const left = Math.max(0, ROUND - this.t);
    const bonus = 800 + Math.ceil(left) * 100;
    this.addScore(bonus);
    const mouth = this.mouthPos();
    this.pts(mouth.clone().setY(mouth.y + 0.2), '+' + bonus, 'gold big');
    g.audio.sfx('success');
    g.audio.sfx('cheer');
    g.fx.burst(mouth, 'confetti', 24, 1.4);
    g.fx.burst(mouth, 'hearts', 12);
    this.crumbs.emit(this.ringPos(0.2), [P.pink, P.butter, P.mint, P.lavender, P.white, P.strawberry], 30, 'crumb', { speed: 2.2 });
    p.overrideExpression('love');
    p.play('victory', { onEnd: () => this.sit() });
    this.wig = 1;
    this.shake = 0.3;
    if (this.layer) {
      const c = el('div', 'big-center pop', 'Cake Tower cleared! ♡');
      c.style.fontSize = 'clamp(30px, 7cqw, 54px)';
      c.style.whiteSpace = 'nowrap';
      c.style.animationDuration = '1.6s';
      this.layer.appendChild(c);
      setTimeout(() => c.remove(), 1650);
    }
    if (this.hud.hint) this.hud.hint.style.opacity = '0';
    this.later(1.7, () => this.finishRound());
  }

  private finishRound() {
    if (this.phase !== 'play') return;
    this.phase = 'end';
    if (!this.frozen) this.t = ROUND;
    this.updateHud();
    if (this.fever > 0) this.endFever(false);
    this.endSlow();
    if (this.crave) this.dropCrave(false);
    this.game.player.overrideExpression(null);
    this.dropHeld();
    const c = el('div', 'big-center pop', 'Gochisousama! ♡');
    c.style.fontSize = 'clamp(34px, 8cqw, 60px)';
    this.layer?.appendChild(c);
    this.game.audio.sfx('go');
    for (const it of this.items) if (it.state === 'belt') it.state = 'missed';
    this.later(1.4, () => {
      c.remove();
      this.hud.combo?.remove();
      this.hud.hint?.remove();
      this.hud.tower?.remove();
      this.roundDone?.();
      this.roundDone = null;
    });
  }

  // ------------------------------------------------------------------ Hamin juice
  private squash(amount: number) {
    this.sqV += amount;
  }

  private updateHamin(dt: number) {
    const p = this.game.player;
    // soft squash-and-stretch spring (cheeks-full bounce on every bite)
    this.sqV += (-150 * this.sq - 11 * this.sqV) * dt;
    this.sq = clamp(this.sq + this.sqV * dt, -0.2, 0.2);
    this.wig = Math.max(0, this.wig - dt * 1.4);
    const hot = this.hot > 0 ? Math.min(1, this.hot) : 0;
    if (this.phase !== 'off') {
      p.root.scale.set(1 + this.sq * 0.6, 1 - this.sq, 1 + this.sq * 0.6);
      p.root.rotation.z = Math.sin(this.time * 20) * 0.06 * this.wig + Math.sin(this.time * 47) * 0.03 * hot;
    }
    if (this.hot > 0) {
      this.hot -= dt;
      const sy = this.cfg.seat.y ?? 0;
      // steam puffs from the top of his head
      this.steamAcc += dt * 22;
      while (this.steamAcc > 1) {
        this.steamAcc--;
        const side = Math.random() < 0.5 ? -1 : 1;
        this.crumbs.emit(new THREE.Vector3(this.cfg.seat.x + side * (0.26 + Math.random() * 0.06), sy + 2.02 + Math.random() * 0.1, this.cfg.seat.z + 0.05), STEAM, 1, 'steam', {
          dir: new THREE.Vector3(side * 0.8, 0.5, 0.1), jitter: 0.03, size: 0.1,
        });
      }
      // a short burst of fire breath toward the camera
      if (this.hot > 1.05) {
        this.fireAcc += dt * 50;
        while (this.fireAcc > 1) {
          this.fireAcc--;
          this.crumbs.emit(this.mouthPos(-0.16, 0.5), FIRE, 1, 'fire', {
            dir: new THREE.Vector3((Math.random() - 0.5) * 1.6, -0.9 - Math.random() * 0.6, 1.4), jitter: 0.03, size: 0.085, life: 0.6,
          });
        }
      }
      if (this.hot <= 0 && this.fever <= 0) p.overrideExpression(null);
    }
  }

  // ------------------------------------------------------------------ helpers
  /** Tiny dt-driven scheduler (pauses with the game, cleared on reset / cleanup). */
  private later(sec: number, fn: () => void) {
    this.jobs.push({ t: sec, fn });
  }

  private runJobs(dt: number) {
    if (!this.jobs.length) return;
    const due: (() => void)[] = [];
    this.jobs = this.jobs.filter((j) => {
      j.t -= dt;
      if (j.t <= 0) {
        due.push(j.fn);
        return false;
      }
      return true;
    });
    for (const fn of due) fn();
  }

  private sit() {
    if (!this.active) return;
    this.game.player.play('sit', { loop: true });
  }

  /**
   * Hamin says something in the speech spot left of his head. Chatter is dropped while the spot is busy;
   * important lines stack just below the previous bubble instead.
   */
  private say(text: string, style: '' | 'big' | 'plain' = '', important = false) {
    if (!this.active || this.phase === 'off') return;
    if (this.sayBusy > 0 && !important) return;
    const stack = this.sayBusy > 0 ? (this.sayStack + 1) % 3 : 0;
    this.sayStack = stack;
    this.sayBusy = 1.25;
    this.game.ui.react(this.sayPos(-stack * 0.32), text, style);
  }

  /** Speech-bubble spot left of Hamin's head (the craving cloud lives on the right, the timer above). */
  private sayPos(dy = 0) {
    return new THREE.Vector3(this.cfg.seat.x - 0.85, 1.95 + dy + (this.cfg.seat.y ?? 0), this.cfg.seat.z + 0.3);
  }

  private mouthPos(dy = 0, dz = 0.3) {
    return new THREE.Vector3(this.cfg.seat.x, 1.7 + dy + (this.cfg.seat.y ?? 0), this.cfg.seat.z + dz);
  }

  private flashHoop(c: number) {
    this.hoopFlash = 0.18;
    this.hoopFlashColor.setHex(c);
  }

  private tapFx(x: number, y: number) {
    if (!this.layer) return;
    const r = el('div', 'eat-tapfx');
    r.style.left = x + 'px';
    r.style.top = y + 'px';
    this.layer.appendChild(r);
    setTimeout(() => r.remove(), 380);
  }

  /** Close-up framing that keeps the belt (hatch → basket) and Hamin on screen, in landscape and portrait. */
  private updateCam(snap: boolean) {
    const g = this.game;
    const c = this.cfg;
    const aspect = g.engine.camera.aspect || 1.6;
    // 0 = wide landscape, 1 = tall portrait
    const tall = clamp((1.5 - aspect) / 0.95, 0, 1);
    const fov = 36 + tall * 16;
    const seatY = c.seat.y ?? 0;
    // landscape: straight-on dollhouse view of the whole belt.
    // portrait: swing round so the belt recedes toward the hatch and food comes "down the lane" at you.
    const yaw = 0.06 + tall * 0.74;
    const span = (c.x1 - c.x0) / 2 + 0.7;
    const hTan = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect;
    const dist = THREE.MathUtils.lerp(clamp(span / hTan, 4.6, 7.8), 7.6, tall);
    const lookX = THREE.MathUtils.lerp((c.x0 + c.x1) / 2, c.ringX - 0.55, tall);
    const look = new THREE.Vector3(lookX, 1.12 + seatY * 0.6 + tall * 0.08, c.beltZ - 0.3 - tall * 0.2);
    const pitch = 0.36 + tall * 0.16;
    // Hamin turns to smile at the camera
    if (this.phase !== 'off') g.setFacing(tall * 0.7);
    const pos = new THREE.Vector3(
      look.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      look.y + Math.sin(pitch) * dist,
      look.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    if (this.shake > 0) {
      const a = Math.min(1, this.shake * 2.5) * 0.07;
      pos.x += (Math.random() - 0.5) * a;
      pos.y += (Math.random() - 0.5) * a;
    }
    const o = g.cam.override;
    if (o && !snap) {
      o.pos.copy(pos);
      o.look.copy(look);
      o.fov = fov;
    } else g.cam.override = { pos, look, k: snap ? 2.5 : 4, fov };
  }
}

let ringGeo: THREE.RingGeometry | null = null;
/** Flat ring drawn on the belt under special / craved food. */
function haloGeo() {
  if (!ringGeo) {
    ringGeo = new THREE.RingGeometry(0.21, 0.3, 28);
    ringGeo.userData.shared = true;
  }
  return ringGeo;
}

function bump(e: HTMLElement) {
  e.classList.remove('bump');
  void e.offsetWidth;
  e.classList.add('bump');
}
