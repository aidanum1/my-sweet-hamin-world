import * as THREE from 'three';
import { GameScene } from '../../scenes/GameScene';
import { P } from '../../assets/palette';
import { mk, rbox, cyl, sphere, torus } from '../../assets/geo';
import { room, sign, plant, sheepCushion, floorMark, heartShape } from '../../assets/props';
import { basic } from '../../assets/materials';
import { el } from '../../ui/UI';
import {
  getItem, getLook, Item, ITEMS, LOOK_MODELS, lookItemId, OutfitState, Slot, THEMES,
} from '../../characters/outfits';
import { angleDiff, pick, todayKey, wait } from '../../utils/math';
import { tr, trf } from '../../i18n/i18n';
import type { Npc } from '../../npcs/Npc';
import {
  Challenge, CHALLENGES, CHAL_TIME, DAILY_BONUS, FLAG_DAY, flagBest, judge, STAR_HEARTS, Verdict,
} from './challenges';
import { injectChallengeStyles } from './challengeStyles';
import { buildRunway, COCO_POS, judgeCorner, makeCoco, RUNWAY_END_Z } from './challengeProps';

type Tab = 'looks' | 'mix' | 'acc';
const MIX_SLOTS: { slot: Slot; label: string }[] = [
  { slot: 'top', label: '👕 Tops' }, { slot: 'bottom', label: '👖 Bottoms' }, { slot: 'shoes', label: '👟 Shoes' },
];
const ACC_SLOTS: { slot: Slot; label: string }[] = [
  { slot: 'head', label: '🎀 Head' }, { slot: 'face', label: '👓 Face' }, { slot: 'extra', label: '👜 Extras' },
];

/** ✨ Fashion Challenge round: 'intro' (Coco announces) → 'play' (timer) → 'show' (runway + verdict). */
interface ChalState { ch: Challenge; mode: 'intro' | 'play' | 'show'; time: number; start: OutfitState; tick: number; round: number }
type ChalEnd = 'keep' | 'retry' | 'new' | 'back';
const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const sameOutfit = (a: OutfitState, b: OutfitState) => JSON.stringify(a) === JSON.stringify(b);
const GREETINGS = [
  'Meow~! Hamin, it’s Fashion Challenge time! ✨',
  'Purr-fect timing, Hamin! I have a brand-new theme for you~ 🐱',
  'Ooh, my favourite model is here! Ready for a challenge? ✨',
];

/**
 * MINI GAME 2 — Dress Up Hamin.
 * Full looks are Higgsfield-generated 3D models; "Mix & Match" builds outfits from modular pieces under the
 * generated head; accessories attach to either. Tap = preview, buy with ♡, drag to rotate, ✓ to save.
 * ✨ Fashion Challenge: Coco the cat stylist gives a theme, you dress Hamin from a free "rental rack" against the
 * clock, then he walks a pop-out runway and Coco scores the look 1–5★ (see challenges.ts).
 */
export default class DressUpScene extends GameScene {
  readonly id = 'dressing' as const;
  readonly title = 'Wardrobe';
  music = 'dress' as const;
  explore = false;
  private layer: HTMLDivElement | null = null;
  private preview!: OutfitState;
  private saved!: OutfitState;
  private tab: Tab = 'looks';
  private sub: Slot = 'top';
  private turn = 0;
  private turnVel = 0;
  private dragging = false;
  private lastX = 0;
  private busy = false;
  private stageTop!: THREE.Group;
  private unsub: (() => void)[] = [];
  private loadingEl: HTMLDivElement | null = null;
  // ✨ Fashion Challenge
  private chal: ChalState | null = null;
  private hud: HTMLDivElement | null = null;
  private coco!: Npc;
  private runway!: ReturnType<typeof buildRunway>;
  private runwayTarget = 0;
  private walk: { z: number; speed: number; res: () => void; stepT: number } | null = null;
  private ending = false;

  build() {
    this.skyArt('sky_title');
    this.light({ dir: [3, 9, 8], shadowRange: 5, env: 0.7 });
    const s = this.statics;
    s.add(room({ w: 10, d: 7, floor: P.pinkSoft, floor2: 0xfff0f4, tiles: true, wall: P.lavender, wall2: 0xf1e8ff, slab: P.blueSoft }));
    // arched mirror + vanity
    s.add(mk(rbox(2.6, 3.2, 0.2, 0.9), P.white, [-3.2, 1.9, -3.35]));
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.7), new THREE.MeshStandardMaterial({ color: 0xdff0ff, roughness: 0.05, metalness: 0.2, envMapIntensity: 1.4 }));
    mirror.position.set(-3.2, 1.95, -3.23);
    this.scene.add(mirror);
    for (let i = 0; i < 7; i++) s.add(mk(sphere(0.09, 8, 6), 0xfff6c9, [-3.2 + Math.cos(Math.PI * (i / 6)) * 1.25, 1.9 + Math.sin(Math.PI * (i / 6)) * 1.6, -3.2]));
    // clothes racks with little hanging garments
    for (const x of [2.6, 4]) {
      s.add(mk(cyl(0.04, 0.04, 2.1, 8), P.metal, [x - 0.65, 1.05, -3]));
      s.add(mk(cyl(0.04, 0.04, 2.1, 8), P.metal, [x + 0.65, 1.05, -3]));
      s.add(mk(cyl(0.035, 0.035, 1.4, 8), P.metal, [x, 2.05, -3], [0, 0, Math.PI / 2]));
      const cols = [P.pink, P.blue, P.butter, P.mint, P.lavenderDeep];
      for (let i = 0; i < 5; i++) {
        s.add(mk(torus(0.06, 0.012, 4, 10, Math.PI), P.metal, [x - 0.5 + i * 0.25, 2.02, -3]));
        s.add(mk(rbox(0.22, 0.6, 0.12, 0.05), cols[(i + (x > 3 ? 2 : 0)) % 5], [x - 0.5 + i * 0.25, 1.65, -3]));
      }
    }
    s.add(plant(P.pinkDeep, P.mintDeep).translateX(-4.4).translateZ(1.8));
    s.add(sheepCushion().translateX(4.2).translateZ(1.6));
    const title = sign('✨ Hamin’s Wardrobe ✨', 3, 0.7, { bg: '#FFFFFF', border: '#E6B2FF' });
    title.position.set(0.3, 3.05, -3.33);
    this.scene.add(title);
    // turntable pedestal
    this.stageTop = new THREE.Group();
    this.stageTop.add(mk(cyl(1.25, 1.35, 0.3, 36), P.white, [0, 0.15, 0]));
    this.stageTop.add(mk(cyl(1.1, 1.1, 0.06, 36), P.pink, [0, 0.32, 0]));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.stageTop.add(mk(sphere(0.07, 8, 6), i % 2 ? P.butter : P.white, [Math.cos(a) * 1.2, 0.31, Math.sin(a) * 1.2]));
    }
    this.stageTop.traverse((o) => ((o as THREE.Mesh).userData.dynamic = true));
    this.scene.add(this.stageTop);
    const glow = floorMark(P.pinkDeep, 1.8);
    glow.position.y = -0.1;
    this.scene.add(glow);
    // floating hearts decoration
    for (const [x, y, z, c] of [[-1.9, 2.4, -1, P.pinkDeep], [2, 2.7, -1.2, P.strawberry], [1.5, 1.5, 0.6, P.pink]] as const) {
      const h = heartShape(c, 0.35);
      h.position.set(x, y, z);
      h.userData.dynamic = true;
      this.scene.add(h);
      const b = y;
      this.onUpdate((_dt, t) => { h.position.y = b + Math.sin(t * 1.5 + x) * 0.12; h.rotation.y = Math.sin(t + x) * 0.5; });
    }
    // ✨ Fashion Challenge: Coco the judge on her stool + the pop-out runway
    s.add(judgeCorner());
    this.coco = makeCoco();
    this.scene.add(this.coco.root);
    this.npcs.push(this.coco);
    this.runway = buildRunway();
    this.scene.add(this.runway.root);
    this.spawns = { default: { x: 0, z: 0, rot: 0 } };
    void basic;
  }

  onEnter() {
    const g = this.game;
    injectChallengeStyles();
    this.saved = { ...g.save.data.outfit };
    this.preview = { ...this.saved };
    this.tab = this.preview.look ? 'looks' : 'mix';
    g.player.root.position.set(0, 0.35, 0);
    g.player.root.rotation.y = 0;
    g.player.play('wave');
    this.frameCamera();
    this.buildUI();
    // drag to rotate
    const cv = g.engine.canvas;
    const down = (e: PointerEvent) => { if (this.chal && this.chal.mode !== 'play') return; this.dragging = true; this.lastX = e.clientX; };
    const move = (e: PointerEvent) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      this.lastX = e.clientX;
      this.turnVel = dx * 0.012;
      this.turn += dx * 0.012;
    };
    const up = () => (this.dragging = false);
    cv.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    this.unsub.push(() => { cv.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); });
    this.unsub.push(g.input.on('menu', () => (this.chal ? this.quitChallenge() : this.leave())));
    this.unsub.push(g.input.on('swipe', (d) => {
      if (this.chal && this.chal.mode !== 'play') return;
      if (d === 'left') this.turn -= 0.6;
      if (d === 'right') this.turn += 0.6;
    }));
    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => { if (!this.chal || this.chal.mode === 'play') this.frameCamera(); };

  private frameCamera() {
    const portrait = innerHeight > innerWidth;
    // keep Hamin in the upper part of the screen above the wardrobe panel
    this.game.cam.override = portrait
      ? { pos: new THREE.Vector3(0, 2.2, 7.4), look: new THREE.Vector3(0, 0.55, 0), k: 5, fov: 38 }
      : { pos: new THREE.Vector3(-1.6, 1.9, 6.2), look: new THREE.Vector3(0.9, 1.25, 0), k: 5, fov: 36 };
  }

  // ------------------------------------------------------------------ UI
  private owned(id: string) { return this.game.save.data.owned.includes(id); }

  private buildUI() {
    this.layer?.remove();
    const L = this.game.ui.layer('wardrobe');
    this.layer = L;
    L.innerHTML = '';
    const c = this.chal;
    if (c && c.mode !== 'play') {
      // Coco is talking / runway show: keep the screen clear
      this.loadingEl = el('div', 'wd-loading hidden', '✨ changing clothes…');
      L.appendChild(this.loadingEl);
      return;
    }
    const top = el('div', 'mg-top');
    const back = el('button', 'icon-btn', '✕');
    back.setAttribute('aria-label', c ? 'Quit challenge' : 'Close wardrobe');
    back.onclick = () => (this.chal ? this.quitChallenge() : this.leave());
    const hearts = el('div', 'mg-pill', `♡ ${this.game.save.data.hearts}`);
    hearts.id = 'wd-hearts';
    const rot = el('div', '');
    rot.style.cssText = 'display:flex;gap:8px';
    const rl = el('button', 'icon-btn', '⟲');
    const rr = el('button', 'icon-btn', '⟳');
    rl.onclick = () => (this.turn -= Math.PI / 4);
    rr.onclick = () => (this.turn += Math.PI / 4);
    rot.append(rl, rr);
    const left = el('div', '');
    left.style.cssText = 'display:flex;gap:8px;align-items:center';
    if (c) left.append(back);
    else {
      const chalBtn = el('button', 'candy small primary dc-chal-btn', '✨ Challenge');
      chalBtn.setAttribute('aria-label', 'Fashion Challenge');
      chalBtn.onclick = () => this.openPicker();
      left.append(back, hearts, chalBtn);
    }
    top.append(left, rot);
    L.appendChild(top);

    const panel = el('div', 'wd-panel paper');
    const tabs = el('div', 'tabs');
    const tabDefs: [Tab, string][] = [['looks', '✨ Looks'], ['mix', '🧩 Mix & Match'], ['acc', '🎀 Accessories']];
    for (const [t, label] of tabDefs) {
      const b = el('button', 'tab' + (t === this.tab ? ' on' : ''), label);
      b.onclick = () => {
        this.game.audio.sfx('tap');
        this.tab = t;
        this.sub = t === 'acc' ? 'head' : 'top';
        this.buildUI();
      };
      tabs.appendChild(b);
    }
    panel.appendChild(tabs);
    if (this.tab !== 'looks') {
      const subs = el('div', 'tabs wd-sub');
      for (const s of this.tab === 'mix' ? MIX_SLOTS : ACC_SLOTS) {
        const b = el('button', 'tab' + (s.slot === this.sub ? ' on' : ''), s.label);
        b.onclick = () => { this.game.audio.sfx('tap'); this.sub = s.slot; this.buildUI(); };
        subs.appendChild(b);
      }
      panel.appendChild(subs);
    }
    const grid = el('div', 'wd-grid');
    if (c) grid.appendChild(el('div', 'dc-rack', '🏷️ Rental rack: everything is free to try during the challenge!'));
    if (this.tab === 'looks') {
      for (const l of LOOK_MODELS) {
        const theme = THEMES.find((t) => t.id === l.theme);
        this.card(grid, lookItemId(l.id), l.emoji, l.name, theme ? `${theme.emoji} ${theme.label}` : '', l.price, this.preview.look === l.id, () => this.previewLook(l.id));
      }
    } else if (this.tab === 'mix') {
      const note = el('div', 'wd-note', this.preview.look ? '🧩 Mixing pieces switches to the modular body (with Hamin’s real 3D head).' : '');
      if (this.preview.look) grid.appendChild(note);
      for (const it of ITEMS.filter((i) => i.slot === this.sub)) this.itemCard(grid, it);
    } else {
      this.card(grid, '', '🚫', 'None', '', 0, !this.preview[this.sub as 'head'], () => this.previewItem(this.sub, ''));
      for (const it of ITEMS.filter((i) => i.slot === this.sub)) this.itemCard(grid, it);
    }
    panel.appendChild(grid);
    // action row
    const act = el('div', 'wd-actions');
    if (c) {
      const reset = el('button', 'candy small', '↺ Reset');
      reset.onclick = () => { this.game.audio.sfx('back'); this.apply({ ...c.start }); };
      const submit = el('button', 'candy primary dc-submit', '✨ Show Coco!');
      submit.onclick = () => void this.submit();
      act.append(reset, submit);
      panel.appendChild(act);
      L.appendChild(panel);
      this.loadingEl = el('div', 'wd-loading hidden', '✨ changing clothes…');
      L.appendChild(this.loadingEl);
      return;
    }
    const locked = this.lockedPieces();
    const cost = locked.reduce((a, id) => a + this.price(id), 0);
    const reset = el('button', 'candy small', '↺ Undo');
    reset.onclick = () => { this.game.audio.sfx('back'); this.apply({ ...this.saved }); };
    const buy = el('button', 'candy small blue', `Unlock all · ♡ ${cost}`);
    buy.classList.toggle('hidden', !locked.length);
    buy.onclick = () => this.buy(locked, cost);
    const save = el('button', 'candy primary', locked.length ? '🔒 Unlock to save' : '✓ Save look');
    (save as HTMLButtonElement).disabled = locked.length > 0;
    save.onclick = () => this.saveLook();
    act.append(reset, buy, save);
    panel.appendChild(act);
    L.appendChild(panel);
    this.loadingEl = el('div', 'wd-loading hidden', '✨ changing clothes…');
    L.appendChild(this.loadingEl);
  }

  private price(id: string) {
    if (id.startsWith('look_')) return getLook(id.slice(5))?.price ?? 0;
    return Math.max(0, getItem(id)?.price ?? 0);
  }

  /** Earned-only pieces (negative price, e.g. the Mic Charm) — never sold. */
  private isReward(id: string) { return !id.startsWith('look_') && (getItem(id)?.price ?? 0) < 0; }

  private itemCard(grid: HTMLElement, it: Item) {
    const theme = THEMES.find((t) => t.id === it.theme);
    const on = !this.preview.look || it.slot === 'head' || it.slot === 'face' || it.slot === 'extra' ? this.preview[it.slot] === it.id : false;
    this.card(grid, it.id, it.emoji, it.name, theme ? `${theme.emoji} ${theme.label}` : '', it.price, on, () => this.previewItem(it.slot, it.id));
  }

  private card(grid: HTMLElement, id: string, emoji: string, name: string, sub: string, price: number, on: boolean, fn: () => void) {
    const owned = !id || this.owned(id);
    const special = price < 0;
    const rental = !!this.chal;
    const tag = owned ? '' : rental ? '<i class="price dc-rent">🏷️</i>' : `<i class="price">${special ? '🎤 Vocal reward' : `♡ ${price}`}</i>`;
    const c = el('button', 'wd-card' + (on ? ' on' : '') + (owned || rental ? '' : ' locked'),
      `<span class="e">${emoji}</span><b>${name}</b><small>${sub}</small>${tag}`);
    c.onclick = () => {
      if (special && !owned && !rental) { this.game.ui.toast('🎤', 'Clear Vocal Practice to unlock this charm!'); this.game.audio.sfx('miss'); return; }
      this.game.audio.sfx('select');
      fn();
    };
    grid.appendChild(c);
  }

  private lockedPieces() {
    const o = this.preview;
    const ids: string[] = [];
    if (o.look) ids.push(lookItemId(o.look));
    else ids.push(o.top, o.bottom, o.shoes);
    ids.push(o.head, o.face, o.extra);
    return ids.filter((id) => id && !this.owned(id));
  }

  private previewLook(id: string) {
    this.apply({ ...this.preview, look: id });
  }

  private previewItem(slot: Slot, id: string) {
    const o = { ...this.preview, [slot]: id } as OutfitState;
    if (slot === 'top' || slot === 'bottom' || slot === 'shoes') o.look = '';
    this.apply(o);
  }

  private async apply(o: OutfitState) {
    if (this.busy) return;
    this.busy = true;
    this.preview = o;
    this.loadingEl?.classList.remove('hidden');
    await this.game.dressHamin(o);
    this.loadingEl?.classList.add('hidden');
    this.game.player.play('spin');
    this.game.fx.burst(new THREE.Vector3(0, 1.6, 0), 'sparkles', 8);
    this.busy = false;
    this.buildUI();
    this.cocoReact(o);
  }

  private buy(ids: string[], cost: number): boolean {
    const g = this.game;
    if (g.save.data.hearts < cost) {
      g.audio.sfx('miss');
      g.ui.toast('💗', `You need ${cost - g.save.data.hearts} more ♡ — play mini-games to earn hearts!`);
      g.player.play('shy');
      return false;
    }
    g.save.spend(cost);
    for (const id of ids) if (!g.save.data.owned.includes(id)) g.save.data.owned.push(id);
    g.save.save();
    g.audio.sfx('unlock');
    g.ui.toast('🛍️', 'Unlocked! It’s yours forever ♡', true);
    g.fx.burst(new THREE.Vector3(0, 1.4, 0), 'confetti', 16);
    this.buildUI();
    return true;
  }

  private async saveLook() {
    if (this.busy || this.lockedPieces().length) return;
    const g = this.game;
    this.busy = true;
    g.save.data.outfit = { ...this.preview };
    this.saved = { ...this.preview };
    const firstDress = !g.save.data.flags.dressed;
    g.save.setFlag('dressed', true);
    g.save.save();
    g.audio.sfx('success');
    // spin → pose → happy
    await g.player.playAsync('spin');
    g.fx.burst(new THREE.Vector3(0, 1.4, 0), 'confetti', 18);
    await g.player.playAsync('pose');
    g.ui.react(new THREE.Vector3(0, 2.8, 0), '✨ NEW! ✨', 'big');
    g.fx.burst(new THREE.Vector3(0, 1.6, 0), 'hearts', 10);
    await g.player.playAsync('happy');
    g.ui.toast('👗', 'Look saved!', false);
    if (firstDress) g.collect('charm', 'charm_dress', null, 'Ribbon charm', '🎀');
    this.busy = false;
  }

  private async leave() {
    if (this.chal) return this.quitChallenge();
    if (this.busy) return;
    const g = this.game;
    g.audio.sfx('back');
    if (JSON.stringify(this.preview) !== JSON.stringify(this.saved)) await g.dressHamin(this.saved);
    this.busy = true;
    await wait(50);
    g.returnFromMinigame();
  }

  // ================================================================== ✨ FASHION CHALLENGE
  private chalBadge(id: string) {
    const best = this.game.save.flag<number>(flagBest(id), 0);
    return `<span class="st">${'<em>★</em>'.repeat(best)}${'★'.repeat(5 - best)}</span>`;
  }

  /** Theme picker: Coco's cards with the best stars earned per theme. */
  private openPicker() {
    const g = this.game;
    if (this.busy || this.chal || g.ui.modalOpen) return;
    g.audio.sfx('select');
    const body = el('div', 'dc-pick');
    const intro = el('div', 'dc-intro', `<span class="dc-portrait big">🐱</span><span>${tr('Coco the stylist has a theme for you! Dress Hamin before time runs out, then strut down the runway.')}</span>`);
    const dailyReady = g.save.flag(FLAG_DAY, '') !== todayKey();
    const daily = el('div', 'dc-daily' + (dailyReady ? '' : ' done'),
      dailyReady ? trf('🎁 Daily bonus: +{0} ♡ for your first 3★ look today!', DAILY_BONUS) : tr('✅ Daily bonus collected — see you tomorrow!'));
    const grid = el('div', 'dc-grid');
    const m = g.ui.modal('✨ Fashion Challenge', body, { wide: true });
    for (const ch of CHALLENGES) {
      const best = g.save.flag<number>(flagBest(ch.id), 0);
      const b = el('button', 'dc-theme' + (best >= 5 ? ' best' : ''),
        `<span class="e">${ch.emoji}</span><b>${tr(ch.name)}</b>${this.chalBadge(ch.id)}${best ? '' : `<i class="new">${tr('NEW')}</i>`}`);
      b.onclick = () => { m.close(); void this.startChallenge(ch); };
      grid.appendChild(b);
    }
    const surprise = el('button', 'candy blue small dc-surprise', '🎲 Surprise me!');
    surprise.onclick = () => {
      // prefer themes that still have stars to win
      const open = CHALLENGES.filter((c) => g.save.flag<number>(flagBest(c.id), 0) < 5);
      m.close();
      void this.startChallenge(pick(open.length ? open : CHALLENGES));
    };
    body.append(intro, daily, grid, surprise);
  }

  private cocoHead() { return this.coco.root.position.clone().setY(this.coco.root.position.y + this.coco.rig.height + 0.25); }

  /** Live hints while styling: Coco hearts pieces that fit the theme and frowns at odd ones. */
  private cocoReact(o: OutfitState) {
    const c = this.chal;
    if (!c || c.mode !== 'play') {
      if (Math.random() < 0.3) this.coco.react('hop');
      return;
    }
    const v = judge(c.ch, o, c.start);
    const bad = v.reasons.some((r) => r.tone === 'bad' && r.icon === '😿');
    const good = v.stars >= 4;
    if (bad) this.game.ui.react(this.cocoHead(), '😿', 'plain');
    else if (good) { this.game.ui.react(this.cocoHead(), '♡', ''); this.coco.react('hop'); }
    else if (v.stars >= 3) this.game.ui.react(this.cocoHead(), '✨', 'plain');
    else this.game.ui.react(this.cocoHead(), '🤔', 'plain');
  }

  /** Turn Hamin to face an angle via the shortest way round. */
  private faceAngle(a: number) {
    const r = this.game.player.root.rotation.y;
    this.turnVel = 0;
    this.turn = r + angleDiff(r, a);
  }

  private walkTo(z: number, speed: number) {
    this.walk?.res();
    return new Promise<void>((res) => { this.walk = { z, speed, res, stepT: 0 }; });
  }

  private flash() {
    if (!this.hud) return;
    const f = el('div', 'dc-flash');
    this.hud.appendChild(f);
    this.game.audio.sfx('camera', 0.6);
    setTimeout(() => f.remove(), 520);
  }

  private async startChallenge(ch: Challenge, round = 1) {
    const g = this.game;
    if (this.busy || this.chal) return;
    const c: ChalState = { ch, mode: 'intro', time: CHAL_TIME, start: { ...this.preview }, tick: 0, round };
    this.chal = c;
    this.buildUI();
    this.hud?.remove();
    this.hud = g.ui.layer('dc-layer');
    g.audio.sfx('chime');
    this.coco.react('hop');
    // look at Coco while she explains the theme
    const portrait = innerHeight > innerWidth;
    g.cam.override = portrait
      ? { pos: V3(-0.6, 2.2, 6.4), look: V3(-0.9, 0.9, -0.6), k: 3, fov: 42 }
      : { pos: V3(0.1, 1.7, 4.4), look: V3(-1.0, 1.05, -0.7), k: 3, fov: 36 };
    this.faceAngle(Math.max(-0.7, Math.atan2(COCO_POS.x, COCO_POS.z) * 0.3)); // a little nod toward Coco
    g.player.play('wave');
    const lines = round === 1
      ? [pick(GREETINGS), ...ch.story, trf('You have {0} seconds, and the whole rental rack is yours! ✨', CHAL_TIME)]
      : ['Round two! Show me something even cuter~ ✨'];
    await g.ui.dialogue('Coco', lines, { portrait: '🐱' });
    if (this.chal !== c) return;
    this.faceAngle(0);
    this.frameCamera();
    this.buildHud(c);
    await g.ui.countdown(this.hud!);
    if (this.chal !== c) return;
    c.mode = 'play';
    this.buildUI();
  }

  private buildHud(c: ChalState) {
    if (!this.hud) return;
    const sw = c.ch.palette.map((p) => `<i style="background:#${p.toString(16).padStart(6, '0')}"></i>`).join('');
    const card = el('div', 'dc-hud paper');
    card.innerHTML = `<div class="dc-hud-top"><span class="dc-portrait">🐱</span>
      <div class="dc-hud-t"><small>${tr('Coco’s theme')}</small><b>${c.ch.emoji} ${tr(c.ch.name)}</b></div>
      <div class="dc-timer" id="dc-time">${this.fmtTime(c.time)}</div></div>
      <div class="dc-hud-row"><span class="dc-swatches">${sw}</span><span>${tr(c.ch.tip)}</span></div>
      <div class="meter" id="dc-meter"><i style="width:100%"></i></div>`;
    this.hud.appendChild(card);
  }

  private fmtTime(t: number) {
    const s = Math.ceil(t);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  private tickTimer(c: ChalState, dt: number) {
    const g = this.game;
    if (this.busy || g.ui.modalOpen || g.ui.dialogueOpen) return; // loading a look or a popup: pause
    c.time = Math.max(0, c.time - dt);
    const s = Math.ceil(c.time);
    const tEl = document.getElementById('dc-time');
    if (tEl) {
      const txt = this.fmtTime(c.time);
      if (tEl.textContent !== txt) tEl.textContent = txt;
      tEl.classList.toggle('hurry', s <= 10);
      tEl.closest('.dc-hud')?.classList.toggle('hurry', s <= 10);
    }
    const bar = document.querySelector<HTMLElement>('#dc-meter i');
    if (bar) bar.style.width = `${(c.time / CHAL_TIME) * 100}%`;
    if (s !== c.tick) {
      c.tick = s;
      if (s === 10 || (s <= 5 && s > 0)) g.audio.sfx('count', s <= 5 ? 0.8 : 0.5);
    }
    if (c.time <= 0) void this.submit(true);
  }

  private async submit(timeUp = false) {
    const c = this.chal;
    if (!c || c.mode !== 'play') return;
    const g = this.game;
    c.mode = 'show';
    this.dragging = false;
    this.buildUI();
    this.hud?.querySelector('.dc-hud')?.remove();
    if (timeUp) {
      g.audio.sfx('go');
      g.ui.banner(tr('⏰ Time’s up!'), tr('Let’s see the look!'));
      await wait(1100);
    }
    while (this.busy) await wait(50);
    this.busy = true;
    await this.runwayShow(c);
    if (this.chal !== c) return;
    await this.showVerdict(c, judge(c.ch, this.preview, c.start));
  }

  /** Camera swoop, runway roll-out, walk, spin & pose under the flashes. */
  private async runwayShow(c: ChalState) {
    const g = this.game;
    const p = g.player;
    this.faceAngle(0);
    p.stop();
    g.ui.banner(tr('✨ Runway time! ✨'), `${c.ch.emoji} ${tr(c.ch.name)}`);
    g.audio.sfx('whoosh');
    this.runwayTarget = 1;
    g.cam.override = { pos: V3(3.6, 3.2, 5.4), look: V3(0, 0.9, 1.3), k: 2.2, fov: 40 };
    this.coco.react('hop');
    await wait(1000);
    // swoop down to the end of the runway while Hamin struts forward
    g.cam.override = { pos: V3(0.15, 1.3, 7.8), look: V3(0, 1.2, 1.5), k: 1.5, fov: 34 };
    await this.walkTo(RUNWAY_END_Z, 1.3);
    const head = V3(0, 2.1, RUNWAY_END_Z);
    g.cam.override = { pos: V3(-0.35, 1.5, 6.9), look: V3(0, 1.3, RUNWAY_END_Z), k: 2.6, fov: 32 };
    this.flash();
    g.fx.burst(head, 'sparkles', 14);
    await p.playAsync('spin');
    this.flash();
    g.fx.burst(head, 'sparkles', 10);
    await p.playAsync('pose');
    this.flash();
    await wait(160);
    this.flash();
    g.fx.burst(head, 'confetti', 22);
    g.ui.react(this.cocoHead(), '✨ !! ✨', 'big');
    this.coco.react('hop');
    await wait(500);
    // frame Hamin + Coco on the left, verdict card on the right
    const portrait = innerHeight > innerWidth;
    g.cam.override = portrait
      ? { pos: V3(-0.6, 2.4, 9.6), look: V3(-0.5, 0.7, 2.0), k: 2.5, fov: 40 }
      : { pos: V3(-1.2, 1.75, 8.4), look: V3(1.25, 1.2, 1.9), k: 2.5, fov: 38 };
  }

  private async showVerdict(c: ChalState, v: Verdict) {
    const g = this.game;
    const ch = c.ch;
    // records & rewards
    const best = g.save.flag<number>(flagBest(ch.id), 0);
    const newBest = v.stars > best;
    if (newBest) g.save.setFlag(flagBest(ch.id), v.stars);
    const daily = v.stars >= 3 && g.save.flag(FLAG_DAY, '') !== todayKey();
    if (daily) g.save.setFlag(FLAG_DAY, todayKey());
    g.save.setFlag('dressChalPlays', g.save.flag<number>('dressChalPlays', 0) + 1);
    const hearts = STAR_HEARTS[v.stars] + (daily ? DAILY_BONUS : 0);

    const panel = el('div', 'dc-verdict paper');
    panel.innerHTML = `<div class="dc-v-head"><span class="dc-portrait big">🐱</span><div><small>${tr('Coco’s verdict')} · ${ch.emoji} ${tr(ch.name)}</small>
      <h2 class="grad-text">${v.title}</h2></div></div>`;
    const stars = el('div', 'dc-stars');
    const starEls: HTMLElement[] = [];
    for (let i = 0; i < 5; i++) { const s = el('i', '', '★'); starEls.push(s); stars.appendChild(s); }
    panel.appendChild(stars);
    this.hud?.appendChild(panel);

    for (let i = 0; i < v.stars; i++) {
      await wait(i ? 330 : 450);
      starEls[i].classList.add('on');
      g.audio.sfx('perfect', 0.8);
      g.fx.burst(V3(0, 2.2, RUNWAY_END_Z), 'sparkles', 5);
      this.coco.react('hop');
    }
    await wait(300);
    const p = g.player;
    if (v.stars >= 4) {
      g.audio.sfx('cheer');
      g.fx.burst(V3(0, 1.6, RUNWAY_END_Z), 'hearts', 14);
      p.play(v.stars === 5 ? 'victory' : 'heart');
      this.coco.def.idle = 'cheer';
    } else if (v.stars === 3) {
      g.audio.sfx('success');
      p.play('happy');
    } else {
      g.audio.sfx('fail');
      p.play('shy');
    }
    g.ui.react(this.cocoHead(), v.stars >= 4 ? '♡♡♡' : v.stars === 3 ? '♡' : '😹', v.stars >= 4 ? 'big' : '');

    const ul = el('ul', 'dc-reasons');
    v.reasons.slice(0, 6).forEach((r, i) => {
      const li = el('li', r.tone, `<span>${r.icon}</span><span>${r.text}</span>`);
      li.style.animationDelay = `${i * 0.12}s`;
      ul.appendChild(li);
    });
    panel.appendChild(ul);
    const reward = el('div', 'dc-reward', trf('+{0} ♡ Hamin Hearts', hearts));
    reward.style.animationDelay = `${v.reasons.length * 0.12}s`;
    panel.appendChild(reward);
    const extras = el('div', 'dc-extras');
    if (daily) extras.appendChild(el('span', '', trf('🎁 Daily style bonus +{0} ♡', DAILY_BONUS)));
    if (newBest && best) extras.appendChild(el('span', '', tr('🏅 New best for this theme!')));
    else if (newBest && v.stars >= 3) extras.appendChild(el('span', '', tr('🏅 First clear for this theme!')));
    if (extras.children.length) panel.appendChild(extras);
    g.addHearts(hearts, V3(0, 0.6, RUNWAY_END_Z));

    // what next?
    const btns = el('div', 'dc-btns');
    btns.style.animationDelay = `${v.reasons.length * 0.12 + 0.2}s`;
    // rental pieces to buy (special rewards like the Mic Charm can't be bought — they're left off when keeping)
    const locked = this.lockedPieces().filter((id) => !this.isReward(id));
    const cost = locked.reduce((a, id) => a + this.price(id), 0);
    const unchanged = sameOutfit(this.preview, this.saved);
    const keep = el('button', 'candy primary', locked.length ? trf('🛍️ Unlock & keep this look · ♡ {0}', cost) : tr('💖 Keep this look'));
    keep.onclick = () => {
      if (locked.length && !this.buy(locked, cost)) return;
      void this.endChallenge('keep');
    };
    const again = el('button', unchanged ? 'candy primary' : 'candy small', '🔁 Try again');
    again.onclick = () => void this.endChallenge('retry');
    const next = el('button', 'candy small blue', '🎲 New theme');
    next.onclick = () => void this.endChallenge('new');
    const done = el('button', 'candy small', '↩ Wardrobe');
    done.onclick = () => void this.endChallenge('back');
    if (unchanged) btns.append(again, next, done); // already wearing the saved look
    else btns.append(keep, again, next, done);
    panel.appendChild(btns);
  }

  /** Walk back to the pedestal, tidy up, then keep / retry / pick a new theme / restore the saved look. */
  private async endChallenge(next: ChalEnd) {
    const c = this.chal;
    if (!c || this.ending) return;
    this.ending = true;
    const g = this.game;
    g.audio.sfx('tap');
    this.coco.def.idle = 'bob';
    this.hud?.remove();
    this.hud = null;
    this.frameCamera();
    g.player.stop();
    this.faceAngle(Math.PI);
    await wait(220);
    await this.walkTo(0, 2);
    this.faceAngle(0);
    this.runwayTarget = 0;
    this.chal = null;
    this.busy = false;
    this.ending = false;
    if (next === 'retry') {
      await this.startChallenge(c.ch, c.round + 1);
      return;
    }
    if (next === 'keep') {
      const rewards = this.lockedPieces().filter((id) => this.isReward(id));
      if (rewards.length) {
        const o = { ...this.preview };
        for (const sl of ['head', 'face', 'extra'] as const) if (rewards.includes(o[sl])) o[sl] = '';
        g.ui.toast('🎤', 'Clear Vocal Practice to unlock this charm!');
        await this.apply(o);
      } else this.buildUI();
      await this.saveLook();
      return;
    }
    if (!sameOutfit(this.preview, this.saved)) await this.apply({ ...this.saved });
    else this.buildUI();
    if (next === 'new') this.openPicker();
  }

  /** ✕ / Esc during a round. */
  private async quitChallenge() {
    const c = this.chal;
    if (!c || c.mode !== 'play') return;
    const g = this.game;
    g.audio.sfx('back');
    const ok = await g.ui.confirm('Quit the challenge?', 'Hamin will change back into the saved look.', 'Quit', 'Keep styling');
    if (!ok || this.chal !== c || c.mode !== 'play') return;
    this.hud?.remove();
    this.hud = null;
    this.chal = null;
    while (this.busy) await wait(50);
    if (!sameOutfit(this.preview, this.saved)) await this.apply({ ...this.saved });
    else this.buildUI();
  }

  update(dt: number) {
    const c = this.chal;
    if (!this.dragging) {
      this.turnVel *= Math.pow(0.02, dt);
      this.turn += this.turnVel * dt * 2;
    }
    const p = this.game.player;
    p.root.rotation.y += (this.turn - p.root.rotation.y) * Math.min(1, dt * 10);
    if (!c || c.mode === 'play') this.stageTop.rotation.y = p.root.rotation.y;
    // runway roll-out
    const rk = this.runway.k;
    if (rk !== this.runwayTarget) {
      const nk = rk + (this.runwayTarget - rk) * Math.min(1, dt * 3.5);
      this.runway.open(Math.abs(nk - this.runwayTarget) < 0.003 ? this.runwayTarget : nk);
    }
    // strut along the runway
    const w = this.walk;
    if (w) {
      const pos = p.root.position;
      const d = w.z - pos.z;
      const step = w.speed * dt;
      if (Math.abs(d) <= step) {
        pos.z = w.z;
        p.moveSpeed = 0;
        this.walk = null;
        w.res();
      } else {
        pos.z += Math.sign(d) * step;
        p.moveSpeed = w.speed;
        w.stepT -= dt;
        if (w.stepT <= 0) { w.stepT = 0.36; this.game.audio.sfx('step'); }
      }
    }
    if (c?.mode === 'play') this.tickTimer(c, dt);
    const h = document.getElementById('wd-hearts');
    if (h) h.textContent = `♡ ${this.game.save.data.hearts}`;
    this.game.cam.update(dt);
  }

  onExit() {
    for (const u of this.unsub) u();
    this.unsub = [];
    window.removeEventListener('resize', this.onResize);
    this.layer?.remove();
    this.layer = null;
    this.hud?.remove();
    this.hud = null;
    this.chal = null;
    this.walk = null;
    this.game.player.moveSpeed = 0;
    this.game.cam.override = null;
  }
}
