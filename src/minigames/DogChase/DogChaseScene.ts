import * as THREE from 'three';
import { GameScene } from '../../scenes/GameScene';
import { vertexColorToon } from '../../assets/materials';
import { tr, trf } from '../../i18n/i18n';
import { clamp, damp, lerp, wait } from '../../utils/math';
import { Pup } from './Pup';
import { buildHud, ChaseHud } from './hud';
import * as M from './models';
import { Ev, genCourse, Kind, LANES, LENGTH, Mark, PowerKind, tileVariant, ZONES } from './course';
import { auraRing, badgeTex, POWER_INFO, shieldBubble, SpeedLines } from './fx';
import { landmark } from '../../assets/landmarks';

// ------------------------------------------------------------------ tuning
const SPEED0 = 8.4; // start speed (u/s)
const SPEED1 = 10.8; // speed near the bakery
const DASH_K = 1.5; // sheep-buddy speed multiplier
const GRAV = 25;
const JUMP_V = 8;
const GAP0 = 5.4; // Bori's head start (abstract "gap" units)
const GAP_MAX = 7;
const CATCH = 0.75;
const RECOVER = 0.16; // gap regained per second of clean running
const HIT_LOSS = 2.4;
const PUDDLE_LOSS = 0.9;
const AHEAD = 105; // spawn distance
const HEART_CAP = 56;
const N_TILES = 6;
const SHEEP_SPEED = 1.6;
const SHEEP_TRIGGER = 26;
const STAND_H = 1.75; // Hamin's collision height
const SLIDE_H = 0.9;
const SLIDE_T = 0.72;
const RIDE_Y = 0.98; // Hamin's seat height on the sheep buddy (saddle ≈ 1.38 m at scale 1.6)
const STREAK_WINDOW = 3; // s between hearts to keep the combo
const NEAR_BONUS = 50;
const TILE_VARIANTS = 5;
/** Bakery Lane tiles whose shop slot is taken by a Higgsfield bakery landmark: [tile k, side, slot]. */
const ROADSIDE_BAKERIES: [number, -1 | 1, number][] = [[17, -1, 1], [19, 1, 2]];
/** Landmarks further than this ahead are hidden (they're fully fogged by then: fog far = 112). */
const LANDMARK_CULL = 118;

type Cls = 'low' | 'tall' | 'high' | 'sheep' | 'puddle';
type State = 'intro' | 'countdown' | 'run' | 'finish' | 'caught' | 'result';

interface ObType { kind: Kind; mesh: THREE.InstancedMesh; cap: number; list: Ob[]; hw: number; hl: number; y0: number; y1: number; cls: Cls }
interface Ob {
  t: ObType; slot: number; d: number; x: number; y: number; rot: number;
  hit: boolean; kt: number; kvx: number; kvy: number; spin: number; roll: number;
  dir: number; walking: boolean; scale: number;
  entered: boolean; nm: boolean; passed: boolean;
}
interface Hp { slot: number; d: number; x: number; y: number; ph: number; got: boolean; gt: number; pull: boolean }
interface Pk { spr: THREE.Sprite; on: boolean; d: number; x: number; kind: PowerKind; got: boolean; gt: number; ph: number }

const ri = (n: number) => Math.floor(Math.random() * n);

/** Dog Chase: a 3-lane auto-runner from Bori the puppy to the Sheep Bakery. */
export default class DogChaseScene extends GameScene {
  readonly id = 'dogchase' as const;
  readonly title = 'Dog Chase!';
  subtitle = 'Run to the Sheep Bakery!';
  music = 'chase' as const;
  explore = false;
  showPlayer = true;

  private state: State = 'intro';
  private runId = 0;
  private paused = false;
  private hud!: ChaseHud;
  private offs: (() => void)[] = [];
  private prevInput = { joy: true, swipe: true };
  private tipsOn = true;
  private pwSeen = new Set<PowerKind>();

  // world
  private tiles: THREE.Mesh[] = [];
  private tileGeos: THREE.BufferGeometry[] = [];
  /** tile k → tileGeos index of a bakery-lane variant with an empty shop slot (landmark bakery there) */
  private gapTiles = new Map<number, number>();
  /** Higgsfield landmarks (world z in userData.wz), hidden while beyond LANDMARK_CULL */
  private landmarks: THREE.Object3D[] = [];
  private backdrop!: THREE.Mesh;
  private types = new Map<Kind, ObType>();
  private obs: Ob[] = [];
  private heartMesh!: THREE.InstancedMesh;
  private hps: Hp[] = [];
  private pks: Pk[] = [];
  private pkMats = {} as Record<PowerKind, THREE.SpriteMaterial>;
  private pup!: Pup;
  private treat!: THREE.Mesh;
  /** sheep buddy (faces +X): the Higgsfield sheep + saddle, or the procedural one at scale 1.6 as fallback */
  private ride!: THREE.Object3D;
  private rideScale = 1;
  /** ride z offset from Hamin (m): puts his seat over the saddle */
  private rideSeatX = 0;
  /** grazing sheep of the meadow tiles, per tile variant (tile-local), drawn by grazerMesh */
  private grazers: M.Grazer[][] = [];
  private grazerMesh!: THREE.InstancedMesh;
  /** the sheep baker on the bakery plaza (Chef Mongmong, or the procedural baker sheep) */
  private baker!: THREE.Object3D;
  private bakerYaw = 0;
  private bakerHopT = -1;
  private bubble!: THREE.Mesh;
  private aura!: THREE.Mesh;
  private lines!: SpeedLines;
  private tmp = new THREE.Object3D();
  private v = new THREE.Vector3();

  // run state
  private evs: Ev[] = [];
  private evIdx = 0;
  private marks: Mark[] = [];
  private markIdx = 0;
  private dist = 0;
  private speed = 0;
  private slowK = 1;
  private slowT = 0;
  private dashK = 1;
  private lane = 1;
  private x = 0;
  private air = 0;
  private vy = 0;
  private fastFall = false;
  private jumpBuf = 0;
  private slideBuf = 0;
  private slideT = 0;
  private slideAmt = 0;
  private dustT = 0;
  private invuln = 0;
  private gap = GAP0;
  private pending = 0;
  private scared = false;
  private barkT = 2;
  private runTime = 0;
  private heartsGot = 0;
  private heartPts = 0;
  private bonus = 0;
  private streak = 0;
  private streakT = 0;
  private bestStreak = 0;
  private mult = 1;
  private nearMisses = 0;
  private nmChain = 0;
  private nmLastT = -9;
  private bonkT = 0;
  private hits = 0;
  private facing = Math.PI;
  private shake = 0;
  private fovKick = 0;
  private dashFov = 0;
  private linesK = 0;
  // action timestamps (runTime) for near-miss detection
  private jumpAt = -9;
  private slideAt = -9;
  private laneAt = -9;
  private laneFromX = 0;
  // power-ups
  private rideT = 0;
  private rideOff = 0;
  private rideSide = 1;
  private rideX = 0;
  private rideD = 0;
  private magT = 0;
  private starT = 0;
  private munchT = 0;
  private throwT = -1;
  private throwFrom = new THREE.Vector3();
  private pupBack = false;
  // Bori
  private pupD = 0;
  private pupX = 0;
  private pupRot = Math.PI;
  private pupTarget: { d: number; x: number; rot: number; mode: 'sit' | 'happy' | 'lick' } | null = null;
  // cutscenes
  private stopD = 0;
  private treatT = -1;
  private floatT = 0;
  private camMode: 'intro' | 'chase' | 'finish' | 'caught' = 'intro';
  private camOv = { pos: new THREE.Vector3(), look: new THREE.Vector3(), k: 100, fov: 46 };

  // ------------------------------------------------------------------ build
  async build() {
    const loads: Promise<unknown>[] = [];
    // Higgsfield sheep (obstacles, grazers, ride buddy, baker): awaited below, before any run starts
    const sheepAssets = M.loadSheepAssets();
    this.sky('#9fd0ff', '#ffe9f0', '#d8eaff');
    this.light({ dir: [3, 10, 6], shadowRange: 10, hemi: 1.15 });
    this.scene.fog = new THREE.Fog(0xffe6ef, 48, 112);
    this.bounds = { minX: -4, maxX: 4, minZ: -LENGTH - 30, maxZ: 20 };
    this.tmp.rotation.order = 'YXZ'; // instance transforms: yaw, then roll/pitch about the object's own axes

    // recycled ground tiles (themed variants per zone); the meadow's grazing sheep are instanced separately
    for (let v = 0; v < TILE_VARIANTS; v++) {
      const gz: M.Grazer[] = [];
      this.tileGeos.push(M.tileGeo(v, undefined, gz));
      this.grazers.push(gz);
    }
    for (let i = 0; i < N_TILES; i++) {
      const t = new THREE.Mesh(this.tileGeos[0], vertexColorToon());
      t.receiveShadow = true;
      t.userData.noShadow = true; // don't cast (flat ground); receive only
      this.tiles.push(t);
      this.scene.add(t);
    }
    // far hills + cloud sheep, no fog
    const bm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, fog: false });
    this.backdrop = new THREE.Mesh(M.backdropGeo(), bm);
    this.backdrop.userData.noShadow = true;
    this.scene.add(this.backdrop);

    // finish line + Sheep Bakery
    const bk = M.bakeryGroup();
    bk.group.position.z = -LENGTH;
    this.scene.add(bk.group);
    // Higgsfield bakery (sam_3_3d) replaces the procedural bakery building; the procedural one stays as fallback
    loads.push(landmark('bakery', { h: 6.4 }).then((m) => {
      m.position.set(0, 0, M.BAKERY_Z);
      m.userData.wz = -LENGTH + M.BAKERY_Z;
      bk.group.add(m);
      this.landmarks.push(m);
      bk.building.removeFromParent();
      bk.building.geometry.dispose();
      // the model's sheep face fills the roof → the name sign moves to a little signboard beside the door
      const sw = 2.9, sy = 1.95;
      const stand = M.signStand(sw, sy);
      stand.position.set(4.7, 0, M.BAKERY_Z + 2.5);
      stand.rotation.y = -0.3;
      stand.add(bk.sign);
      bk.sign.position.set(0, sy, 0);
      bk.sign.scale.setScalar(sw / 4.6);
      bk.group.add(stand);
    }).catch((e) => console.warn('landmark failed', 'bakery', e)));
    // …and two more stand in Bakery Lane, each filling an emptied shop slot of one tile (tiles stay pooled)
    for (const [k, side, slot] of ROADSIDE_BAKERIES) {
      if (tileVariant(k) !== 4) continue;
      loads.push(landmark('bakery', { w: 4.4, h: 4.6 }).then((m) => {
        m.position.set(side * (M.SHOP_X - 0.2), 0, -(k * M.TILE + M.SHOP_Z0 + slot * M.SHOP_DZ));
        m.rotation.y = -side * Math.PI / 2;
        m.userData.wz = m.position.z;
        // like the procedural shops (baked into the tiles, which don't cast), stay out of the shadow pass
        m.traverse((o) => {
          (o as THREE.Mesh).castShadow = false;
          o.userData.noShadow = true;
        });
        this.scene.add(m);
        this.landmarks.push(m);
        this.gapTiles.set(k, this.tileGeos.length);
        this.tileGeos.push(M.tileGeo(4, { side, slot }));
      }).catch((e) => console.warn('landmark failed', 'bakery', e)));
    }

    // the sheep models (each one null → its procedural fallback)
    const sa = await sheepAssets;
    // one sheep geometry (faces +X) for the obstacle sheep and the grazers: Higgsfield sheep_lo or procedural
    const sheepGeo = sa.lo?.geometry ?? M.bakeGeo(M.sheepModel());
    const sheepMat = sa.lo?.material ?? vertexColorToon();

    // the sheep baker on the bakery plaza: Chef Mongmong
    this.baker = sa.baker ?? M.bakerSheepModel();
    this.baker.position.copy(M.BAKER_POS);
    // facing Hamin + Bori where they stop after the finish line (local z ≈ -8)
    this.bakerYaw = Math.atan2(0.6 - M.BAKER_POS.x, -8 - M.BAKER_POS.z);
    this.baker.rotation.y = this.bakerYaw;
    this.baker.userData.wz = -LENGTH + M.BAKER_POS.z;
    bk.group.add(this.baker);
    this.landmarks.push(this.baker);

    // pooled obstacles: one InstancedMesh per type
    const def: [Kind, THREE.BufferGeometry, number, number, number, number, number, Cls, THREE.Material?][] = [
      // kind, geometry, pool, half-width, half-length, y0, y1 (vertical span that bumps), class, material
      ['bench', M.benchModel(), 8, 0.68, 0.3, 0, 0.75, 'low'],
      ['box', M.boxModel(), 12, 0.45, 0.38, 0, 0.55, 'low'],
      ['bike', M.bikeModel(), 10, 0.8, 0.25, 0, 99, 'tall'],
      ['pot', M.potModel(), 10, 0.38, 0.36, 0, 0.6, 'low'],
      ['puddle', M.puddleModel(), 8, 0.72, 0.55, 0, 0.12, 'puddle'],
      ['sign', M.signModel(), 10, 0.52, 0.35, 0, 99, 'tall'],
      ['bag', M.bagModel(), 10, 0.45, 0.3, 0, 0.5, 'low'],
      ['sheep', sheepGeo, 14, 0.42, 0.34, 0, 0.62, 'sheep', sheepMat],
      ['banner', M.bannerModel(), 12, 0.7, 0.2, 1.12, 99, 'high'],
      ['hurdle', M.hurdleModel(), 12, 0.62, 0.14, 0, 0.62, 'low'],
      ['cart', M.cartModel(), 8, 0.68, 0.42, 0, 99, 'tall'],
    ];
    for (const [kind, geo, n, hw, hl, y0, y1, cls, mat] of def) {
      const mesh = new THREE.InstancedMesh(geo, mat ?? vertexColorToon(), n);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.count = 0; // only active instances are drawn (compacted list)
      this.scene.add(mesh);
      this.types.set(kind, { kind, mesh, cap: n, list: [], hw, hl, y0, y1, cls });
    }
    // grazing sheep beside the meadow tiles (placed per tile in updateTiles; they don't cast, like the tiles)
    const perTile = Math.max(0, ...this.grazers.map((l) => l.length));
    this.grazerMesh = new THREE.InstancedMesh(sheepGeo, sheepMat, Math.max(1, perTile * N_TILES));
    this.grazerMesh.frustumCulled = false;
    this.grazerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.grazerMesh.userData.noShadow = true;
    this.grazerMesh.count = 0;
    this.grazerMesh.visible = false;
    this.scene.add(this.grazerMesh);
    this.heartMesh = new THREE.InstancedMesh(M.heartModel(), vertexColorToon(), HEART_CAP);
    this.heartMesh.frustumCulled = false;
    this.heartMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.heartMesh.count = 0;
    this.scene.add(this.heartMesh);

    // power-up badges (sprites; pooled)
    for (const k of Object.keys(POWER_INFO) as PowerKind[]) {
      this.pkMats[k] = new THREE.SpriteMaterial({ map: badgeTex(k), transparent: true, depthWrite: false, fog: false });
    }
    for (let i = 0; i < 3; i++) {
      const spr = new THREE.Sprite(this.pkMats.star);
      spr.visible = false;
      spr.renderOrder = 4;
      spr.userData.noShadow = true;
      this.scene.add(spr);
      this.pks.push({ spr, on: false, d: 0, x: 0, kind: 'star', got: false, gt: 0, ph: 0 });
    }

    // Bori + his treat
    this.pup = new Pup(1.15);
    this.scene.add(this.pup.root);
    this.treat = new THREE.Mesh(M.treatModel(), vertexColorToon());
    this.treat.scale.setScalar(1.35);
    this.treat.visible = false;
    this.scene.add(this.treat);

    // sheep buddy (Higgsfield sheep + saddle; procedural buddy at 1.6× as fallback), star bubble, magnet aura, speed lines
    if (sa.ride) {
      this.ride = sa.ride.group;
      this.rideScale = 1;
      this.rideSeatX = sa.ride.seatX;
    } else {
      this.ride = new THREE.Mesh(M.rideSheepModel(), vertexColorToon());
      this.ride.castShadow = true;
      this.rideScale = 1.6;
      this.rideSeatX = 0.08;
    }
    this.ride.visible = false;
    this.ride.rotation.order = 'YXZ'; // x = waddle about its own forward axis
    this.scene.add(this.ride);
    this.bubble = shieldBubble();
    this.scene.add(this.bubble);
    this.aura = auraRing();
    this.scene.add(this.aura);
    this.lines = new SpeedLines();
    this.scene.add(this.lines.mesh);

    await Promise.all(loads);
    this.spawns.default = { x: 0, z: 0, rot: Math.PI };
  }

  // ------------------------------------------------------------------ lifecycle
  onEnter() {
    const g = this.game;
    this.prevInput = { joy: g.input.joystickEnabled, swipe: g.input.swipeCam };
    g.input.joystickEnabled = false;
    g.input.swipeCam = false;
    g.input.releaseAll();
    this.tipsOn = true;
    this.pwSeen.clear();

    this.hud = buildHud(g.ui.layer('dc-layer'), ZONES.slice(1).map((z) => z.from / LENGTH));
    const h = this.hud;
    h.startBtn.onclick = () => { g.audio.sfx('select'); this.startCountdown(); };
    h.backBtn.onclick = () => { g.audio.sfx('back'); this.leave(); };
    h.pauseBtn.onclick = () => this.pause();
    const pad = (b: HTMLButtonElement, fn: () => void) => {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); b.classList.add('down'); fn(); });
      const up = () => b.classList.remove('down');
      b.addEventListener('pointerup', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('pointercancel', up);
    };
    pad(h.left, () => this.onSwipe('left'));
    pad(h.right, () => this.onSwipe('right'));
    pad(h.jump, () => this.onSwipe('up'));
    pad(h.slide, () => this.onSwipe('down'));
    this.offs.push(g.input.on('swipe', (d) => this.onSwipe(d)));
    this.offs.push(g.input.on('key', (k) => {
      if (this.state === 'intro' && !g.ui.modalOpen && (k === 'Enter' || k === 'Space')) { g.audio.sfx('select'); this.startCountdown(); }
      if (this.state === 'run' && k === 'KeyP') this.pause();
    }));

    this.resetRun();
    this.state = 'intro';
    this.camMode = 'intro';
    this.camOv.k = 100;
    g.player.play('scared', { loop: true });
    this.pup.mode = 'happy';
    h.showStart(g.save.data.minigames.dogchase?.best ?? 0);
    g.ui.rotateHint();
    this.placeActors(0);
    this.updateCamera(0.016);
  }

  onExit() {
    const g = this.game;
    this.runId++;
    for (const off of this.offs) off();
    this.offs = [];
    this.hud?.layer.remove();
    g.input.joystickEnabled = this.prevInput.joy;
    g.input.swipeCam = this.prevInput.swipe;
    g.cam.override = null;
    const p = g.player;
    p.overrideExpression(null);
    p.lean = 0;
    p.running = false;
    p.airborne = 0;
    p.moveSpeed = 0;
    p.root.rotation.x = 0;
    p.root.position.y = 0;
    p.root.scale.set(1, 1, 1);
    p.stop();
  }

  dispose() {
    super.dispose();
    // variants / badge materials that were not attached to anything at teardown
    for (const geo of this.tileGeos) geo.dispose();
    for (const m of Object.values(this.pkMats)) { m.map?.dispose(); m.dispose(); }
  }

  private leave() {
    const g = this.game;
    this.runId++;
    this.state = 'result';
    // come back next to Bori in the yard
    if (!g.prevScene || g.prevScene.id === 'yard') g.prevScene = { id: 'yard', spawn: 'dogchase' };
    g.returnFromMinigame();
  }

  private async pause() {
    if (this.state !== 'run' || this.paused) return;
    const g = this.game;
    this.paused = true;
    g.audio.sfx('select');
    const run = this.runId;
    const b = await g.ui.result({ emoji: '⏸', title: 'Paused', stats: [['Hearts', this.heartsGot], ['Run', Math.floor((this.dist / LENGTH) * 100) + '%']], reward: 0, buttons: ['▶ Keep running', 'Leave'], note: 'Bori is waiting patiently… (wag wag)' });
    if (run !== this.runId) return;
    this.paused = false;
    if (b === 1) this.leave();
  }

  // ------------------------------------------------------------------ run setup
  private resetRun() {
    this.runId++;
    // pools back
    for (const o of this.obs) this.freeOb(o);
    this.obs.length = 0;
    this.hps.length = 0;
    this.heartMesh.count = 0;
    for (const pk of this.pks) { pk.on = false; pk.spr.visible = false; }
    const c = genCourse();
    this.evs = c.evs;
    this.evIdx = 0;
    this.marks = c.marks;
    this.markIdx = 0;
    this.dist = 0;
    this.speed = 0;
    this.slowK = 1;
    this.slowT = 0;
    this.dashK = 1;
    this.lane = 1;
    this.x = 0;
    this.air = 0;
    this.vy = 0;
    this.fastFall = false;
    this.jumpBuf = 0;
    this.slideBuf = 0;
    this.slideT = 0;
    this.slideAmt = 0;
    this.invuln = 0;
    this.gap = GAP0;
    this.pending = 0;
    this.scared = false;
    this.barkT = 2;
    this.runTime = 0;
    this.heartsGot = 0;
    this.heartPts = 0;
    this.bonus = 0;
    this.streak = 0;
    this.streakT = 0;
    this.bestStreak = 0;
    this.mult = 1;
    this.nearMisses = 0;
    this.nmChain = 0;
    this.nmLastT = -9;
    this.hits = 0;
    this.facing = Math.PI;
    this.shake = 0;
    this.fovKick = 0;
    this.dashFov = 0;
    this.linesK = 0;
    this.jumpAt = this.slideAt = this.laneAt = -9;
    this.rideT = this.magT = this.starT = this.munchT = this.rideOff = 0;
    this.throwT = -1;
    this.pupBack = false;
    this.paused = false;
    this.pupD = -this.behind();
    this.pupX = 0;
    this.pupRot = Math.PI;
    this.pupTarget = null;
    this.treatT = -1;
    this.bakerHopT = -1;
    this.treat.visible = false;
    this.ride.visible = false;
    this.bubble.visible = false;
    this.aura.visible = false;
    this.pup.mode = 'happy';
    this.pup.pace = 1;
    this.hud?.clearFx();
    this.tiles.forEach((t, i) => (t.userData.k = i - 1));
    this.updateTiles();
    const p = this.game.player;
    p.stop();
    p.overrideExpression(null);
    p.moveSpeed = 0;
    p.airborne = 0;
    p.lean = 0;
    p.running = false;
    p.root.rotation.x = 0;
    p.root.scale.set(1, 1, 1);
  }

  private async startCountdown() {
    if (this.state !== 'intro' && this.state !== 'result') return;
    const g = this.game;
    this.state = 'countdown';
    const run = this.runId;
    this.hud.hideStart();
    this.hud.showPlay(true);
    this.camMode = 'chase';
    this.camOv.k = 100; // cut straight to the chase camera
    g.player.play('scared', { loop: true });
    this.pup.mode = 'happy';
    g.ui.react(this.v.set(this.pupX, 1.5, -this.pupD), 'Woof! ♡', 'big');
    g.audio.sfx('woof');
    await g.ui.countdown(this.hud.layer);
    if (run !== this.runId) return;
    this.state = 'run';
    this.camOv.k = 9;
    this.pup.mode = 'run';
    g.player.play('chase', { loop: true });
    this.scared = true;
    this.hud.announce(tr(ZONES[0].name), tr(ZONES[0].sub));
  }

  // ------------------------------------------------------------------ input
  private onSwipe(dir: 'left' | 'right' | 'up' | 'down') {
    if (this.state !== 'run' || this.paused || this.game.ui.modalOpen) return;
    const g = this.game;
    if (dir === 'left' || dir === 'right') {
      const nl = this.lane + (dir === 'left' ? -1 : 1);
      if (nl < 0 || nl > 2) return;
      this.laneFromX = LANES[this.lane];
      this.laneAt = this.runTime;
      this.lane = nl;
      g.audio.sfx('tap', 0.6);
    } else if (dir === 'up') {
      this.jumpBuf = 0.2;
      this.slideBuf = 0;
    } else {
      // slide (duck under banners); in the air it first pulls Hamin down fast
      if (this.rideT > 0) return;
      this.jumpBuf = 0;
      this.slideBuf = 0.3;
      if (this.air > 0) this.fastFall = true;
    }
  }

  // ------------------------------------------------------------------ spawning / pools
  private spawnEv(e: Ev) {
    const x = e.x ?? LANES[e.lane];
    if (e.kind === 'heart') {
      if (this.hps.length >= HEART_CAP) return;
      this.hps.push({ slot: this.hps.length, d: e.d, x, y: e.y ?? 0.85, ph: Math.random() * 6, got: false, gt: 0, pull: false });
      this.heartMesh.count = this.hps.length;
      return;
    }
    if (e.kind === 'power') {
      const pk = this.pks.find((p) => !p.on);
      if (!pk || !e.pw) return;
      pk.on = true;
      pk.got = false;
      pk.gt = 0;
      pk.d = e.d;
      pk.x = x;
      pk.kind = e.pw;
      pk.ph = Math.random() * 6;
      pk.spr.material = this.pkMats[e.pw];
      pk.spr.visible = true;
      return;
    }
    const t = this.types.get(e.kind)!;
    if (t.list.length >= t.cap) return;
    const slot = t.list.length;
    const dir = e.dir ?? 1;
    const isSheep = e.kind === 'sheep';
    const small = e.kind === 'box' || e.kind === 'pot' || e.kind === 'bag';
    const ob: Ob = {
      t, slot, d: e.d,
      x: isSheep ? x - dir * (SHEEP_SPEED * (SHEEP_TRIGGER / 9.5) + (e.xo ?? 0)) : x,
      y: 0,
      rot: isSheep ? (dir > 0 ? 0 : Math.PI) : small ? (Math.random() - 0.5) * 0.6 : (e.kind === 'bike' || e.kind === 'cart') && Math.random() < 0.5 ? Math.PI : 0,
      hit: false, kt: 0, kvx: 0, kvy: 0, spin: 0, roll: 0, dir, walking: false, scale: 1,
      entered: false, nm: false, passed: false,
    };
    t.list.push(ob);
    t.mesh.count = t.list.length;
    this.obs.push(ob);
  }

  /** Swap-remove so active instances stay packed in [0, count). Matrices are rewritten every frame. */
  private freeOb(o: Ob) {
    const l = o.t.list;
    const last = l.pop()!;
    if (last !== o) { l[o.slot] = last; last.slot = o.slot; }
    o.t.mesh.count = l.length;
  }

  // ------------------------------------------------------------------ per frame
  update(dt: number) {
    const g = this.game;
    const frozen = this.paused || (g.ui.modalOpen > 0 && this.state === 'run');
    const sdt = frozen ? 0 : dt;
    switch (this.state) {
      case 'run': this.stepRun(sdt); break;
      case 'finish': this.stepCutscene(sdt, 2.2); break;
      case 'caught': this.stepCutscene(sdt, 5); break;
      default: break;
    }
    this.stepObstacles(sdt);
    this.stepHearts(sdt);
    this.stepPickups(sdt);
    this.stepPup(sdt);
    this.stepBaker(sdt);
    this.updateTiles();
    this.placeActors(sdt);
    this.updateCamera(sdt);
    g.cam.update(dt);
    const lk = this.state === 'run' ? (this.rideT > 0 ? 1 : clamp((this.speed - 10.1) / 1.6, 0, 0.45)) : 0;
    this.linesK = damp(this.linesK, lk, 5, sdt);
    this.lines.update(sdt, this.linesK, this.speed, g.engine.camera);
    this.hud.tick(sdt);
    if (this.state === 'run' || this.state === 'countdown') {
      const prog = clamp(this.dist / LENGTH, 0, 1);
      this.hud.set({
        score: this.liveScore(),
        hearts: this.heartsGot,
        mult: this.mult,
        prog,
        gapFrac: clamp(this.gap / GAP_MAX, 0, 1),
        meters: Math.min(this.dist, LENGTH),
        total: LENGTH,
        danger: this.state === 'run' && this.gap < 2.6,
      });
      const h = this.hud;
      h.setPower('sheep', this.rideT / POWER_INFO.sheep.dur);
      h.setPower('magnet', this.magT / POWER_INFO.magnet.dur);
      h.setPower('star', this.starT / POWER_INFO.star.dur);
      h.setPower('bone', this.throwT >= 0 ? 1 : this.munchT / POWER_INFO.bone.dur);
    }
  }

  private liveScore() {
    return Math.floor(this.dist) + this.heartPts + this.bonus;
  }

  /** Visual distance of Bori behind Hamin for a given gap. */
  private behind(gap = this.gap) {
    return 0.95 + gap * 0.3;
  }

  private stepRun(dt: number) {
    if (dt === 0) return;
    const g = this.game;
    const p = g.player;
    this.runTime += dt;
    const prog = this.dist / LENGTH;
    const nominal = lerp(SPEED0, SPEED1, clamp(prog, 0, 1));
    if (this.slowT > 0) this.slowT -= dt;
    else this.slowK = damp(this.slowK, 1, 2.2, dt);
    const riding = this.rideT > 0;
    this.dashK = damp(this.dashK, riding ? DASH_K : 1, riding ? 4 : 2, dt);
    this.speed = nominal * this.slowK * this.dashK;
    this.dist += this.speed * dt;
    this.invuln -= dt;
    this.bonkT -= dt;

    // power-up timers
    if (this.rideT > 0) { this.rideT -= dt; if (this.rideT <= 0) this.endRide(true); }
    if (this.magT > 0) { this.magT -= dt; if (this.magT <= 0) this.aura.visible = false; }
    if (this.starT > 0) { this.starT -= dt; if (this.starT <= 0) this.bubble.visible = false; }
    if (this.streak > 0) {
      this.streakT += dt;
      if (this.streakT > STREAK_WINDOW) this.breakStreak();
    }

    // lanes
    const px = this.x;
    this.x = damp(this.x, LANES[this.lane], 14, dt);
    p.lean = damp(p.lean, clamp(((this.x - px) / dt) * 0.03, -0.2, 0.2), 12, dt);

    // jump (buffered so a slightly early press still counts)
    const stumbling = p.currentAction === 'stumble';
    if (this.jumpBuf > 0) {
      this.jumpBuf -= dt;
      if (this.air <= 0 && !stumbling) {
        this.jumpBuf = 0;
        this.vy = JUMP_V;
        this.air = 0.001;
        this.fastFall = false;
        this.slideT = 0;
        this.jumpAt = this.runTime;
        g.audio.sfx('jump', 0.8);
        if (!riding) p.stop();
      }
    }
    // slide (buffered: pressing it mid-air slams down and slides on landing)
    if (this.slideBuf > 0) {
      this.slideBuf -= dt;
      if (this.air <= 0 && !stumbling && !riding) {
        this.slideBuf = 0;
        if (this.slideT <= 0) this.slideAt = this.runTime;
        this.slideT = SLIDE_T;
        g.audio.sfx('whoosh', 0.55);
        p.overrideExpression('happy');
      }
    }
    if (this.slideT > 0) {
      this.slideT -= dt;
      this.dustT -= dt;
      if (this.dustT <= 0) {
        this.dustT = 0.16;
        this.fx(this.v.set(this.x, 0.15, -this.dist + 0.3), 'sparkles', 1, 0.5, 10);
      }
      if (this.slideT <= 0) p.overrideExpression(null);
    }
    if (this.air > 0) {
      this.vy -= GRAV * (this.fastFall ? 2.4 : 1) * dt;
      this.air += this.vy * dt;
      if (this.air <= 0) {
        this.air = 0;
        this.vy = 0;
        this.fastFall = false;
        g.audio.sfx('step', 1);
      }
    }

    // animation: ride / slide / scared "chase" pose when Bori is close / confident run
    if (this.scared ? this.gap > 3.9 : this.gap < 3.2) this.scared = !this.scared;
    const act = p.currentAction;
    if (act !== 'stumble') {
      if (riding) {
        if (act !== 'sit') p.play('sit', { loop: true });
      } else if (this.slideT > 0) {
        if (act !== 'jump') p.play('jump', { loop: true });
      } else if (this.air > 0) {
        if (act) p.stop();
        p.moveSpeed = this.speed;
      } else if (this.scared) {
        if (act !== 'chase') p.play('chase', { loop: true });
        p.stridePhase += dt * (4 + this.speed * 1.6);
      } else {
        if (act) p.stop();
        p.running = true;
        p.moveSpeed = this.speed;
      }
    }

    // Bori closes in / falls back
    if (this.slowT <= 0 && this.slowK > 0.9) this.gap = Math.min(GAP_MAX, this.gap + RECOVER * dt);
    if (this.munchT > 0) {
      this.munchT -= dt;
      this.gap = Math.min(GAP_MAX, this.gap + 1.1 * dt);
      if (this.munchT <= 0) this.endMunch();
    }
    if (riding) this.gap = Math.min(GAP_MAX, this.gap + 0.9 * dt);
    if (this.pending > 0) {
      const take = Math.min(this.pending, dt * 3.5);
      this.gap -= take;
      this.pending -= take;
    }
    if (this.pupBack || this.munchT > 0) this.gap = Math.max(this.gap, CATCH + 0.3);
    this.barkT -= dt;
    if (this.barkT <= 0 && this.gap < 3.2 && this.munchT <= 0) {
      this.barkT = 2.4 + Math.random() * 2;
      g.audio.sfx('woof', 0.55);
      if (Math.random() < 0.5) g.ui.react(this.v.set(this.pupX, 1.7, -this.pupD), Math.random() < 0.5 ? 'Woof! ♡' : 'Wan wan!', 'plain');
    }
    this.stepThrow(dt);

    // spawn ahead + course announcements
    while (this.evIdx < this.evs.length && this.evs[this.evIdx].d - this.dist < AHEAD) this.spawnEv(this.evs[this.evIdx++]);
    while (this.markIdx < this.marks.length && this.marks[this.markIdx].d <= this.dist) this.onMark(this.marks[this.markIdx++]);

    if (this.gap <= CATCH) { this.caught(); return; }
    if (this.dist >= LENGTH) this.finish();
  }

  private onMark(m: Mark) {
    const g = this.game;
    const h = this.hud;
    const at = this.v.set(this.x, 2.6, -this.dist - 2);
    switch (m.kind) {
      case 'zone':
        h.announce(tr(m.text), m.sub ? tr(m.sub) : '');
        g.audio.sfx('chime', 0.8);
        this.fx(at, 'confetti', 8, 1.6, 22);
        break;
      case 'event':
        h.announce(tr(m.text), m.sub ? tr(m.sub) : '', 'event');
        g.audio.sfx(m.text.startsWith('🐑') ? 'baa' : 'sparkle', 0.9);
        break;
      case 'final':
        h.announce(tr(m.text), m.sub ? tr(m.sub) : '');
        g.audio.sfx('go', 0.8);
        g.audio.sfx('woof', 0.5);
        this.fx(at, 'confetti', 10, 1.6, 22);
        break;
      case 'tip':
        if (this.tipsOn) h.announce(tr(m.text), '', 'tip', true);
        break;
      case 'milestone':
        h.pop(trf('{0} m! ♡', m.text), 'blue');
        g.audio.sfx('coin', 0.5);
        this.fx(at, 'confetti', 5, 1.2);
        break;
    }
  }

  private stepCutscene(dt: number, k: number) {
    if (dt === 0) return;
    const p = this.game.player;
    const nd = damp(this.dist, this.stopD, k, dt);
    this.speed = (nd - this.dist) / dt;
    this.dist = nd;
    this.x = damp(this.x, this.state === 'finish' ? 0 : this.x, 4, dt);
    p.lean = damp(p.lean, 0, 8, dt);
    if (this.air > 0) {
      this.vy -= GRAV * dt;
      this.air = Math.max(0, this.air + this.vy * dt);
    }
    if (!p.currentAction) {
      p.moveSpeed = this.speed;
      p.running = this.speed > 4.6;
    }
    // treat toss
    if (this.treatT >= 0) {
      this.treatT += dt;
      const u = clamp(this.treatT / 0.7, 0, 1);
      this.treat.visible = u < 1;
      // tossed from the baker's paws to Bori
      const bx = M.BAKER_POS.x;
      const bz = -LENGTH + M.BAKER_POS.z + 0.35;
      this.treat.position.set(lerp(bx, this.pupX, u), lerp(1.3, 1.25, u) + Math.sin(u * Math.PI) * 1.5, lerp(bz, -this.pupD - 0.3, u));
      this.treat.rotation.set(this.treatT * 7, this.treatT * 3, 0);
    }
    if (this.state === 'caught' && this.pup.mode === 'lick') {
      this.floatT -= dt;
      if (this.floatT <= 0) {
        this.floatT = 0.28;
        this.game.fx.floatUp(this.v.set(this.x + (Math.random() - 0.5) * 0.8, 1.3 + Math.random() * 0.4, -this.dist + 0.5), 'hearts');
      }
    }
  }

  private stepObstacles(dt: number) {
    const tmp = this.tmp;
    const run = this.state === 'run';
    const t0 = this.time;
    const cutscene = this.state === 'finish' || this.state === 'caught';
    for (let i = this.obs.length - 1; i >= 0; i--) {
      const o = this.obs[i];
      if ((o.d < this.dist - 14 && !cutscene) || (o.hit && o.scale <= 0)) {
        this.freeOb(o);
        this.obs.splice(i, 1);
      }
    }
    const top = this.air + (this.slideT > 0 ? SLIDE_H : STAND_H);
    for (const o of this.obs) {
      const ot = o.t;
      const kind = ot.kind;
      let bob = 0;
      // sheep are static models: they trot with hops + waddle + squash & stretch, and look around while waiting
      let wad = 0;
      let yaw = 0;
      let sy = 1;
      let sxz = 1;
      if (kind === 'sheep') {
        if (!o.walking && o.d - this.dist < SHEEP_TRIGGER) o.walking = true;
        const ph = t0 * 9 + o.slot;
        if (o.walking) {
          o.x += o.dir * SHEEP_SPEED * (o.hit ? 2.4 : 1) * dt;
          const h = Math.abs(Math.sin(ph)); // 0 = feet down, 1 = top of the hop
          bob = h * 0.08;
          wad = Math.cos(ph) * 0.1; // weight shifts onto the landing side
          const q = (1 - h) ** 3;
          sy = 1 - q * 0.09 + h * 0.04;
          sxz = 1 + q * 0.05;
        } else {
          sy = 1 + Math.sin(t0 * 2.4 + o.slot) * 0.025;
          sxz = 1 - (sy - 1) * 0.5;
          yaw = Math.sin(t0 * 0.9 + o.slot * 1.7) * 0.3;
        }
        if (o.y > 0.02) {
          // bonked into the air: startled stretch
          sy = 1.12;
          sxz = 0.94;
        }
      }
      if (o.hit) {
        o.kt += dt;
        if (kind === 'sheep') {
          o.kvy -= 18 * dt;
          o.y = Math.max(0, o.y + o.kvy * dt);
        } else if (kind !== 'puddle') {
          o.x += o.kvx * dt;
          o.kvy -= 16 * dt;
          o.y += o.kvy * dt;
          o.roll += o.spin * dt;
          o.scale = clamp(1 - (o.kt - 0.45) / 0.35, 0, 1);
        }
      } else if (run) {
        const band = Math.abs(o.d - this.dist) < ot.hl + 0.32;
        if (band && !o.entered) {
          o.entered = true;
          o.nm = this.nearCheck(o);
        }
        if (band && Math.abs(o.x - this.x) < ot.hw + 0.3 && this.air < ot.y1 && top > ot.y0) {
          o.nm = false;
          if (this.rideT > 0) this.bonk(o, true);
          else if (this.invuln <= 0) this.hitOb(o);
        }
        if (!o.passed && o.d < this.dist - ot.hl - 0.32) {
          o.passed = true;
          if (o.nm && !o.hit) this.nearMiss(o);
        }
      }
      tmp.position.set(o.x, o.y + bob, -o.d);
      tmp.rotation.set(wad, o.rot + yaw, o.roll); // (order YXZ: `wad` rolls about the sheep's own forward axis)
      const s = Math.max(0.0001, o.scale);
      tmp.scale.set(s * sxz, s * sy, s * sxz);
      tmp.updateMatrix();
      ot.mesh.setMatrixAt(o.slot, tmp.matrix);
    }
    for (const t of this.types.values()) t.mesh.instanceMatrix.needsUpdate = true;
  }

  /** At the moment an obstacle reaches Hamin: was it dodged at the very last moment? */
  private nearCheck(o: Ob) {
    const cls = o.t.cls;
    if (cls === 'puddle' || this.rideT > 0 || this.invuln > 0) return false;
    const now = this.runTime;
    if (Math.abs(o.x - this.x) < o.t.hw + 0.3) {
      if ((cls === 'low' || cls === 'sheep') && this.air > 0) return now - this.jumpAt < 0.26;
      if (cls === 'high' && this.slideT > 0) return now - this.slideAt < 0.26;
      return false;
    }
    return now - this.laneAt < 0.3 && Math.abs(o.x - this.laneFromX) < 0.7;
  }

  private nearMiss(o: Ob) {
    const g = this.game;
    this.nearMisses++;
    this.nmChain = this.runTime - this.nmLastT < 2.2 ? this.nmChain + 1 : 1;
    this.nmLastT = this.runTime;
    const n = NEAR_BONUS * Math.min(3, this.nmChain);
    this.bonus += n;
    this.hud.pop(this.nmChain > 1 ? trf('Super close! +{0}', n) : trf('So close! +{0}', n), 'gold');
    g.audio.sfx('coin', 0.7);
    this.fx(this.v.set(o.x, 0.9, -o.d), 'sparkles', 3, 0.8);
    this.fovKick = Math.max(this.fovKick, 2.5);
    this.gap = Math.min(GAP_MAX, this.gap + 0.12);
  }

  /** Knock an obstacle away harmlessly (sheep buddy / star shield). */
  private bonk(o: Ob, score: boolean) {
    const g = this.game;
    o.hit = true;
    if (o.t.cls === 'puddle') {
      this.fx(this.v.set(o.x, 0.3, -o.d), 'sparkles', 4, 0.7);
      g.audio.sfx('splash', 0.5);
      return;
    }
    const side = o.x >= this.x ? 1 : -1;
    if (o.t.kind === 'sheep') {
      o.kvy = 4.5;
      o.dir = side;
      o.rot = side > 0 ? 0 : Math.PI;
      g.audio.sfx('baa', 0.8);
    } else {
      o.kvx = side * 5;
      o.kvy = 6;
      o.spin = side * -9;
      g.audio.sfx('pop', 0.9);
    }
    this.fx(this.v.set(o.x, 1, -o.d), 'sparkles', 3, 1);
    if (score) {
      this.bonus += 20;
      if (this.bonkT <= 0) {
        this.bonkT = 0.35;
        this.hud.pop(trf('Boing! +{0}', 20), 'mint');
      }
      this.shake = Math.max(this.shake, 0.12);
    }
  }

  private hitOb(o: Ob) {
    const g = this.game;
    const p = g.player;
    const hp = this.v.set(this.x, 2.5, -this.dist);
    if (o.t.cls === 'puddle') {
      o.hit = true;
      g.audio.sfx('splash');
      this.fx(this.v.set(this.x, 0.3, -this.dist), 'sparkles', 8, 0.8);
      this.slowK = Math.min(this.slowK, 0.62);
      this.slowT = 0.5;
      this.pending += PUDDLE_LOSS;
      this.invuln = 0.4;
      p.overrideExpression('surprised');
      setTimeout(() => this.state === 'run' && this.slideT <= 0 && p.overrideExpression(null), 700);
      g.ui.react(hp.set(this.x, 2.5, -this.dist), 'Splash! 💦', 'plain');
      return;
    }
    if (this.starT > 0) {
      // the star shield takes the bump
      this.starT = 0;
      this.bubble.visible = false;
      this.invuln = 0.9;
      this.bonk(o, false);
      g.audio.sfx('sparkle');
      this.fx(this.v.set(this.x, 1.1, -this.dist), 'sparkles', 12, 1.4, 22);
      this.hud.pop(tr('⭐ The star shield saved you!'), 'blue');
      this.fovKick = Math.max(this.fovKick, 3);
      return;
    }
    o.hit = true;
    this.hits++;
    this.invuln = 1.0;
    this.slowK = 0.4;
    this.slowT = 0.45;
    this.pending += HIT_LOSS;
    this.shake = 0.3;
    this.slideT = 0;
    this.slideBuf = 0;
    this.breakStreak();
    if (this.vy > 0) this.vy = 0;
    const side = o.x >= this.x ? 1 : -1;
    if (o.t.kind === 'sheep') {
      o.kvy = 4.5;
      o.dir = side;
      o.rot = side > 0 ? 0 : Math.PI;
      g.audio.sfx('baa');
      g.ui.react(this.v.set(o.x, 1.6, -o.d), 'Baa?! 🐑', 'plain');
    } else {
      o.kvx = side * 3.5;
      o.kvy = 4.8;
      o.spin = side * -7;
      g.audio.sfx('bump');
      this.fx(this.v.set(o.x, 0.8, -o.d), 'sparkles', 6);
    }
    p.overrideExpression(null);
    p.play('stumble');
    g.ui.react(hp.set(this.x, 2.6, -this.dist), ['Oof! >_<', 'Eek!', 'Oops!', 'Ah-!'][ri(4)], 'plain');
  }

  /** Live particle count (each sprite is a draw call, so run-time bursts are capped). */
  private fxLive() {
    return (this.game.fx as unknown as { active?: unknown[] }).active?.length ?? 0;
  }

  private fx(pos: THREE.Vector3, kind: 'hearts' | 'sparkles' | 'confetti', n: number, spread = 1, cap = 16) {
    const k = Math.min(n, cap - this.fxLive());
    if (k > 0) this.game.fx.burst(pos, kind, k, spread);
  }

  private breakStreak() {
    this.streak = 0;
    this.streakT = 0;
    this.mult = 1;
  }

  private stepHearts(dt: number) {
    const tmp = this.tmp;
    const run = this.state === 'run';
    const t0 = this.time;
    for (let i = this.hps.length - 1; i >= 0; i--) {
      const h = this.hps[i];
      if (h.d < this.dist - 14 || (h.got && h.gt > 0.3)) this.hps.splice(i, 1);
    }
    this.heartMesh.count = this.hps.length;
    const riding = this.rideT > 0;
    // vertical pickup window: centre + half-height (taller while perched on the sheep buddy)
    const bodyY = this.air + (this.slideT > 0 ? 0.5 : riding ? 1.35 : 1.0);
    const reach = riding ? 1.45 : 0.85;
    const mag = run && this.magT > 0;
    for (let i = 0; i < this.hps.length; i++) {
      const h = this.hps[i];
      h.slot = i;
      let s = 1;
      if (h.got) {
        h.gt += dt;
        h.y += dt * 5;
        h.d = damp(h.d, this.dist, 10, dt);
        h.x = damp(h.x, this.x, 10, dt);
        s = 1 - h.gt / 0.3;
      } else {
        if (mag && h.d - this.dist < 12 && h.d - this.dist > -1.5) h.pull = true;
        if (h.pull && run) {
          h.x = damp(h.x, this.x, 7, dt);
          h.y = damp(h.y, bodyY + (riding ? 0.6 : 0), 7, dt);
          h.d = damp(h.d, this.dist + 0.2, 4.5, dt);
        }
        if (run && Math.abs(h.d - this.dist) < 0.8 && Math.abs(h.x - this.x) < 0.9 && Math.abs(bodyY - h.y) < reach) this.getHeart(h);
      }
      tmp.position.set(h.x, h.y + Math.sin(t0 * 3 + h.ph) * 0.08, -h.d);
      tmp.rotation.set(0, t0 * 2.6 + h.ph, 0);
      tmp.scale.setScalar(Math.max(0.0001, s * (1 + (h.got ? 0.4 : 0))));
      tmp.updateMatrix();
      this.heartMesh.setMatrixAt(h.slot, tmp.matrix);
    }
    this.heartMesh.instanceMatrix.needsUpdate = true;
  }

  private getHeart(h: Hp) {
    const g = this.game;
    h.got = true;
    this.heartsGot++;
    this.streak++;
    this.streakT = 0;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    const m = Math.min(5, 1 + Math.floor(this.streak / 8));
    if (m > this.mult) {
      this.hud.pop(trf('Heart combo ×{0}!', m), '');
      this.hud.comboBump();
      g.audio.sfx('sparkle', 0.8);
      this.fx(this.v.set(this.x, 1.8, -this.dist), 'hearts', 4, 1);
    }
    this.mult = m;
    this.heartPts += 20 * m;
    g.audio.sfx('heart', 0.5);
    this.fx(this.v.set(h.x, h.y, -h.d), 'sparkles', 1, 0.6, 10);
  }

  // ------------------------------------------------------------------ power-ups
  private stepPickups(dt: number) {
    const run = this.state === 'run';
    const t0 = this.time;
    for (const pk of this.pks) {
      if (!pk.on) continue;
      if (!pk.got) {
        if (pk.d < this.dist - 10 || (this.state !== 'run' && this.state !== 'countdown' && this.state !== 'intro')) {
          pk.on = false;
          pk.spr.visible = false;
          continue;
        }
        const pulse = 1 + Math.sin(t0 * 5 + pk.ph) * 0.06;
        pk.spr.position.set(pk.x, 1.45 + Math.sin(t0 * 3 + pk.ph) * 0.14, -pk.d);
        pk.spr.scale.setScalar(1.55 * pulse);
        if (run && Math.abs(pk.d - this.dist) < 0.95 && Math.abs(pk.x - this.x) < 1.0 && this.air < 2.4) {
          pk.got = true;
          pk.gt = 0;
          this.activate(pk.kind);
        }
      } else {
        pk.gt += dt;
        const u = pk.gt / 0.3;
        pk.spr.position.set(this.x, 2.4 + u * 0.8, -this.dist);
        pk.spr.scale.setScalar(Math.max(0.001, 1.4 * (u < 0.3 ? 1 + u * 1.5 : 1.45 * (1 - (u - 0.3) / 0.7))));
        if (u >= 1) { pk.on = false; pk.spr.visible = false; }
      }
    }
  }

  private activate(kind: PowerKind) {
    const g = this.game;
    const info = POWER_INFO[kind];
    g.audio.sfx('unlock', 0.8);
    this.fx(this.v.set(this.x, 1.4, -this.dist), 'sparkles', 8, 1.3, 22);
    // first time per visit: explain it in the ribbon; afterwards just a quick pop
    if (!this.pwSeen.has(kind)) {
      this.pwSeen.add(kind);
      this.hud.announce(tr(info.name), tr(info.hint), 'event');
    } else this.hud.pop(tr(info.name), 'mint');
    this.bonus += 30;
    this.fovKick = Math.max(this.fovKick, 3);
    const tip = this.v.set(this.x, 2.7, -this.dist - 0.5);
    switch (kind) {
      case 'bone':
        // toss it back to Bori (he stops to munch when it lands)
        this.throwT = 0;
        this.throwFrom.set(this.x + 0.3, 1.3 + this.air, -this.dist);
        this.treat.visible = true;
        g.ui.react(tip, 'Here, Bori! 🦴', '');
        break;
      case 'magnet':
        this.magT = info.dur;
        this.aura.visible = true;
        break;
      case 'sheep':
        if (this.rideT <= 0) {
          g.audio.sfx('baa');
          this.fx(this.v.set(this.x, 0.8, -this.dist), 'confetti', 10, 1.4);
        }
        this.rideT = info.dur;
        this.rideOff = 0;
        this.slideT = 0;
        this.slideBuf = 0;
        this.ride.visible = true;
        g.audio.sfx('whoosh', 0.8);
        g.player.overrideExpression('happy');
        break;
      case 'star':
        this.starT = info.dur;
        this.bubble.visible = true;
        g.audio.sfx('sparkle');
        break;
    }
  }

  private endRide(hop: boolean) {
    const g = this.game;
    const p = g.player;
    this.rideT = 0;
    if (!this.ride.visible || this.rideOff > 0) return;
    this.fx(this.v.set(this.x, 0.8, -this.dist), 'sparkles', 6, 1.2);
    p.overrideExpression(null);
    if (p.currentAction === 'sit') p.stop();
    if (!hop) this.ride.visible = false;
    else {
      // the sheep buddy trots off to the roadside, waving its tail
      this.rideOff = 0.9;
      this.rideSide = this.x > 0.5 ? 1 : this.x < -0.5 ? -1 : Math.random() < 0.5 ? 1 : -1;
      this.rideX = this.x;
      this.rideD = this.dist;
      // hop off the sheep; a short grace period so landing is fair
      this.air = Math.max(this.air, RIDE_Y);
      this.vy = 4;
      this.invuln = Math.max(this.invuln, 0.8);
      g.audio.sfx('baa', 0.7);
      g.ui.react(this.v.set(this.x + 0.6, 2.2, -this.dist), 'Thanks, sheepy! ♡', '');
    }
  }

  /** Bone treat flying back to Bori. */
  private stepThrow(dt: number) {
    if (this.throwT < 0) return;
    this.throwT += dt;
    const u = clamp(this.throwT / 0.55, 0, 1);
    const tx = this.pupX;
    const tz = -(this.pupD + 0.52);
    const f = this.throwFrom;
    this.treat.position.set(lerp(f.x, tx, u), lerp(f.y, 0.1, u) + Math.sin(u * Math.PI) * 1.5, lerp(f.z, tz, u));
    this.treat.rotation.set(this.throwT * 9, this.throwT * 4, 0);
    if (u >= 1) {
      this.throwT = -1;
      this.munchT = POWER_INFO.bone.dur;
      this.pupBack = false;
      const g = this.game;
      g.audio.sfx('eat');
      g.audio.sfx('woof', 0.6);
      this.fx(this.v.set(this.pupX, 1.0, -this.pupD), 'hearts', 6, 0.9);
      g.ui.react(this.v.set(this.pupX, 1.6, -this.pupD), 'Nom nom ♡', 'big');
    }
  }

  private endMunch() {
    this.munchT = 0;
    this.pupBack = true;
    this.treat.visible = false;
    this.game.audio.sfx('woof', 0.45);
  }

  private stepPup(dt: number) {
    const pup = this.pup;
    if (this.pupTarget) {
      const tg = this.pupTarget;
      const dd = tg.d - this.pupD;
      const dx = tg.x - this.pupX;
      const far = Math.hypot(dd, dx);
      if (far > 0.15) {
        this.pupD = damp(this.pupD, tg.d, 4, dt);
        this.pupX = damp(this.pupX, tg.x, 4, dt);
        pup.mode = 'run';
        pup.pace = 1;
        this.pupRot = Math.atan2(dx, -dd);
      } else {
        pup.mode = tg.mode;
        this.pupRot = damp(this.pupRot, tg.rot, 8, dt);
      }
    } else if (this.munchT > 0 && this.state === 'run') {
      // sitting where the bone landed, munching away while Hamin escapes
      pup.mode = 'munch';
      this.pupRot = damp(this.pupRot, Math.PI, 6, dt);
      this.treat.visible = true;
      this.treat.position.set(this.pupX, 0.1, -(this.pupD + 0.52));
      this.treat.rotation.set(Math.PI / 2, 0, 0.3 + Math.sin(this.time * 11) * 0.08);
    } else if (this.state === 'run' || this.state === 'countdown' || this.state === 'intro') {
      const target = this.dist - this.behind();
      if (this.pupBack && this.state === 'run') {
        // sprinting back after his snack
        this.pupD = Math.min(target, this.pupD + (this.speed + 8) * dt);
        if (this.pupD >= target - 0.01) this.pupBack = false;
        pup.mode = 'run';
        pup.pace = 1.7;
      } else {
        this.pupD = target;
        if (this.state === 'run') pup.mode = 'run';
        pup.pace = this.state === 'run' ? clamp(this.speed / 9, 0.6, 1.4) * (this.pending > 0 ? 1.3 : 1) : 1;
      }
      this.pupX = damp(this.pupX, this.x, 3, dt);
      this.pupRot = Math.PI + (this.x - this.pupX) * 0.3;
    }
    pup.update(dt);
  }

  private placeActors(dt: number) {
    const p = this.game.player;
    const riding = this.rideT > 0 && this.ride.visible;
    // slide = squishy crouch-dash: lean in and scrunch down like a mochi (reads well from the chase cam)
    this.slideAmt = damp(this.slideAmt, this.slideT > 0 ? 1 : 0, 20, Math.max(dt, 0.0001));
    const sa = this.slideAmt;
    const wob = this.slideT > 0 ? Math.sin(this.time * 30) * 0.03 : 0;
    p.root.position.set(this.x, 0.05 * sa, -this.dist);
    p.root.rotation.set(-0.7 * sa, this.facing, 0);
    p.root.scale.set(1 + 0.12 * sa - wob, 1 - 0.34 * sa + wob, 1 + 0.12 * sa);
    const bob = riding ? Math.abs(Math.sin(this.time * 13)) * 0.09 : 0;
    p.airborne = this.air + (riding ? RIDE_Y + bob : 0);
    const rs = this.rideScale;
    if (riding) {
      // galloping: rocking-horse pitch + a little squash on every landing
      const q = (1 - Math.abs(Math.sin(this.time * 13))) ** 3;
      this.ride.position.set(this.x, this.air + bob * 0.6, -this.dist + this.rideSeatX);
      this.ride.rotation.set(0, Math.PI / 2, Math.sin(this.time * 13) * 0.06 + p.lean * 0.5);
      this.ride.scale.set(rs * (1 + q * 0.03), rs * (1 - q * 0.025), rs * (1 + q * 0.03));
    } else if (this.rideOff > 0) {
      this.rideOff -= dt;
      const t = 0.9 - this.rideOff;
      const sd = this.rideSide;
      this.ride.position.set(this.rideX + sd * t * 5.5, Math.abs(Math.sin(t * 16)) * 0.25, -(this.rideD + t * 8));
      this.ride.rotation.set(Math.cos(t * 16) * 0.12, Math.PI / 2 - sd * 0.9, 0);
      this.ride.scale.setScalar(rs * clamp(this.rideOff / 0.35, 0.001, 1));
      if (this.rideOff <= 0) this.ride.visible = false;
    }
    if (this.bubble.visible) {
      this.floatT -= dt;
      if (this.floatT <= 0 && dt > 0 && this.fxLive() < 12) {
        this.floatT = 0.5;
        const a = Math.random() * Math.PI * 2;
        this.game.fx.floatUp(this.v.set(this.x + Math.cos(a) * 0.9, this.air + 0.4 + Math.random() * 1.2, -this.dist + Math.sin(a) * 0.5), 'sparkles');
      }
      const s = 1 + Math.sin(this.time * 6) * 0.03;
      this.bubble.position.set(this.x, this.air + (sa > 0.5 ? 0.55 : 1.0) + (riding ? RIDE_Y : 0), -this.dist);
      this.bubble.scale.set(s * (1 + sa * 0.1), s * (1 - sa * 0.45), s);
      const u = (this.bubble.material as THREE.ShaderMaterial).uniforms;
      u.uOp.value = this.starT < 2.5 && Math.sin(this.time * 18) > 0 ? 0.35 : 1;
      u.uT.value = this.time;
    }
    if (this.aura.visible) {
      this.aura.position.set(this.x, 0.06, -this.dist);
      this.aura.rotation.z = this.time * 3;
      const s = 1 + Math.sin(this.time * 8) * 0.08;
      this.aura.scale.set(s, s, 1);
    }
    this.pup.root.position.set(this.pupX, 0, -this.pupD);
    this.pup.root.rotation.y = this.pupRot;
    this.backdrop.position.set(this.x * 0.3, 0, -this.dist - 125);
  }

  private updateTiles() {
    const T = M.TILE;
    for (const t of this.tiles) {
      let k = t.userData.k as number;
      while ((k + 1) * T < this.dist - 14) k += N_TILES;
      t.userData.k = k;
      t.position.z = -k * T;
      t.visible = k * T < LENGTH - 0.01;
      t.geometry = this.tileGeos[this.gapTiles.get(k) ?? tileVariant(Math.max(0, k))];
    }
    for (const m of this.landmarks) m.visible = -this.dist - m.userData.wz < LANDMARK_CULL;
    this.placeGrazers();
  }

  /** Grazing sheep of the visible meadow tiles (≤ 1 per tile, so they're simply re-placed every frame). */
  private placeGrazers() {
    const gm = this.grazerMesh;
    if (!gm) return;
    const tmp = this.tmp;
    const t0 = this.time;
    let n = 0;
    for (const t of this.tiles) {
      if (!t.visible) continue;
      const k = t.userData.k as number;
      const list = this.gapTiles.has(k) ? undefined : this.grazers[tileVariant(Math.max(0, k))];
      if (!list) continue;
      for (let i = 0; i < list.length && n < gm.instanceMatrix.count; i++) {
        const g = list[i];
        const ph = k * 2.3 + i * 1.3;
        // mostly calm (breathing, looking around); every few seconds a happy little hop
        const u = ((((t0 + ph) % 4.5) + 4.5) % 4.5) / 0.42;
        let y = 0;
        let sy = 1 + Math.sin(t0 * 2.2 + ph) * 0.025;
        if (u < 1) {
          y = Math.sin(u * Math.PI) * 0.18;
          sy = 1.08;
        } else if (u < 1.5) sy = 1 - Math.sin((u - 1) * 2 * Math.PI) * 0.1; // landing squash
        const sxz = 1 - (sy - 1) * 0.5;
        tmp.position.set(g.x, y, t.position.z + g.z);
        tmp.rotation.set(0, g.rot + Math.sin(t0 * 0.6 + ph) * 0.35, 0);
        tmp.scale.set(sxz, sy, sxz);
        tmp.updateMatrix();
        gm.setMatrixAt(n++, tmp.matrix);
      }
    }
    gm.count = n;
    gm.visible = n > 0;
    if (n > 0) gm.instanceMatrix.needsUpdate = true;
  }

  /** The baker on the bakery plaza: breathing + a little sway; hops when tossing Bori's treat. */
  private stepBaker(dt: number) {
    const b = this.baker;
    if (!b || !b.visible) return;
    const t = this.time;
    let y = 0;
    let sq = 0;
    if (this.bakerHopT >= 0) {
      this.bakerHopT += dt;
      const u = this.bakerHopT / 0.5;
      if (u < 1) y = Math.sin(u * Math.PI) * 0.32;
      else if (u < 1.4) sq = Math.sin(((u - 1) / 0.4) * Math.PI) * 0.1;
      else this.bakerHopT = -1;
    }
    const br = Math.sin(t * 2.6) * 0.022 - sq;
    b.position.y = y;
    b.rotation.set(0, this.bakerYaw + Math.sin(t * 0.7) * 0.12, Math.sin(t * 1.3) * 0.04);
    b.scale.set(1 - br * 0.5, 1 + br, 1 - br * 0.5);
  }

  private updateCamera(dt: number) {
    const g = this.game;
    const o = this.camOv;
    const a = g.engine.camera.aspect;
    const port = a < 1 ? Math.min(1, (1 - a) * 1.6) : 0;
    const hz = -this.dist;
    switch (this.camMode) {
      case 'intro':
        o.pos.set(2.3 + port * 0.5, 2.0 + port * 1.2, hz - 5.6 - port * 3);
        o.look.set(0, 1.05, hz + 1.2);
        o.fov = 40 + port * 14;
        break;
      case 'chase': {
        this.shake = Math.max(0, this.shake - dt);
        this.fovKick = damp(this.fovKick, 0, 3.5, dt);
        this.dashFov = damp(this.dashFov, this.rideT > 0 ? 9 : 0, this.rideT > 0 ? 4 : 2, dt);
        const sh = this.shake > 0 ? Math.sin(this.time * 60) * this.shake * 0.35 : 0;
        o.pos.set(this.x * 0.45 + 0.8 + sh, 6.0 + port * 2.6 - this.dashFov * 0.05, hz + 9.6 + port * 3.5);
        o.look.set(this.x * 0.55, 0.7 + this.air * 0.25 - this.slideAmt * 0.15, hz - 5.5);
        o.fov = 46 + port * 14 + this.fovKick + this.dashFov;
        break;
      }
      case 'finish':
        o.pos.set(-2.9 - port, 2.7 + port, hz + 7.2 + port * 3);
        o.look.set(0.5, 1.5, hz - 0.8);
        o.fov = 40 + port * 14;
        o.k = 2.5;
        break;
      case 'caught':
        o.pos.set(this.x + 4.8 + port, 2.4 + port, hz + 2.0 + port * 2);
        o.look.set(this.x - 0.35, 0.8, hz + 0.6);
        o.fov = 40 + port * 14;
        o.k = 2.5;
        break;
    }
    g.cam.override = o;
    if (o.k > 20) {
      // snap on the first frame, then ease
      g.cam.update(1);
      o.k = 5;
    }
  }

  /** Drop every running power-up / slide (endings). */
  private clearPowers() {
    this.endRide(false);
    this.magT = 0;
    this.starT = 0;
    this.munchT = 0;
    this.throwT = -1;
    this.pupBack = false;
    this.slideT = 0;
    this.slideBuf = 0;
    this.treat.visible = false;
    this.bubble.visible = false;
    this.aura.visible = false;
    this.hud.clearFx();
    const p = this.game.player;
    p.overrideExpression(null);
    if (p.currentAction === 'jump' || p.currentAction === 'sit') p.stop();
  }

  // ------------------------------------------------------------------ endings
  private async finish() {
    const g = this.game;
    const p = g.player;
    const run = this.runId;
    this.state = 'finish';
    this.clearPowers();
    this.tipsOn = false;
    this.stopD = LENGTH + 8.5;
    this.hud.showPlay(false);
    g.audio.sfx('success');
    g.fx.burst(this.v.set(0, 3.4, -LENGTH), 'confetti', 26, 2);
    g.ui.judge(this.hud.layer, 'perfect', 'Safe! ♡');
    if (p.currentAction === 'chase' || p.currentAction === 'stumble') p.stop();
    p.running = true;
    // Bori keeps running happily behind
    this.pupTarget = { d: this.stopD - 1.3, x: 1.3, rot: Math.atan2(-1.3, -1.3), mode: 'sit' };
    await wait(1100);
    if (run !== this.runId) return;
    this.camMode = 'finish';
    await wait(500);
    if (run !== this.runId) return;
    // turn around, celebrate
    this.facing = -0.35;
    p.play('victory');
    p.overrideExpression('happy');
    g.audio.sfx('cheer');
    g.fx.burst(this.v.set(0, 2.2, -this.dist), 'confetti', 20, 1.6);
    await wait(900);
    if (run !== this.runId) return;
    // the baker sheep tosses Bori a treat
    g.audio.sfx('baa');
    g.ui.react(this.v.set(M.BAKER_POS.x, 2.2, -LENGTH + M.BAKER_POS.z), 'Here, Bori! 🦴', 'plain');
    this.treatT = 0;
    this.bakerHopT = 0;
    await wait(750);
    if (run !== this.runId) return;
    this.treat.visible = false;
    this.treatT = -1;
    this.pupTarget.mode = 'happy';
    g.audio.sfx('woof');
    g.fx.burst(this.v.set(this.pupX, 1.2, -this.pupD), 'hearts', 10);
    g.ui.react(this.v.set(this.pupX, 1.7, -this.pupD), 'Woof woof! ♡ (yummy!)', 'big');
    p.play('happy');
    await wait(1300);
    if (run !== this.runId) return;
    g.fx.burst(this.v.set(0, 2.4, -this.dist), 'confetti', 16, 1.5);
    p.play('heart');
    await wait(1100);
    if (run !== this.runId) return;
    this.showResult(true);
  }

  private async caught() {
    const g = this.game;
    const p = g.player;
    const run = this.runId;
    this.state = 'caught';
    this.clearPowers();
    this.tipsOn = false;
    this.stopD = this.dist + 1.6;
    this.hud.showPlay(false);
    g.audio.sfx('woof');
    this.pupTarget = { d: this.stopD - 0.95, x: this.x - 0.3, rot: 2.84, mode: 'lick' };
    g.ui.react(this.v.set(this.pupX, 1.6, -this.pupD), 'Gotcha! ♡', 'big');
    if (p.currentAction) p.stop();
    await wait(450);
    if (run !== this.runId) return;
    p.play('stumble');
    this.camMode = 'caught';
    await wait(600);
    if (run !== this.runId) return;
    this.facing = 0.55;
    p.play('sit', { loop: true });
    p.overrideExpression('tired');
    g.audio.sfx('squeak');
    await wait(900);
    if (run !== this.runId) return;
    g.fx.burst(this.v.set(this.x, 1.4, -this.dist + 0.5), 'hearts', 10);
    g.ui.react(this.v.set(this.x, 2.2, -this.dist), 'Hehe~ that tickles! ♡', 'big');
    p.overrideExpression('happy');
    await wait(1400);
    if (run !== this.runId) return;
    g.audio.sfx('woof', 0.8);
    g.ui.react(this.v.set(this.pupX, 1.7, -this.pupD), 'Lick lick ♡', 'plain');
    await wait(1100);
    if (run !== this.runId) return;
    this.showResult(false);
  }

  private async showResult(cleared: boolean) {
    const g = this.game;
    const run = this.runId;
    this.state = 'result';
    const hc = this.heartsGot;
    let score = this.liveScore();
    if (cleared) score += 300 + Math.round(this.gap * 40) + (this.hits === 0 ? 200 : 0);
    const reward = 10 + Math.round(hc / 3) + (cleared ? 15 : 0);
    const r = g.finishMinigame('dogchase', score, cleared, reward);
    const bestLine = r.newBest ? tr('✨ New best score! ✨') : trf('Best: {0}', r.best);
    const msg = cleared ? tr('Bori got a treat and is wagging like crazy!') : tr('Bori just wanted to play… (wag wag)');
    const btn = await g.ui.result({
      emoji: cleared ? '🧁' : '🐶',
      title: cleared ? 'Safe at the Sheep Bakery!' : 'Bori caught you! ♡',
      stats: [
        ['Score', score],
        ['Hearts', hc],
        ['Best streak', this.bestStreak],
        ['Near misses', this.nearMisses],
        [cleared ? 'Bumps' : 'Ran', cleared ? this.hits : Math.floor((Math.min(this.dist, LENGTH) / LENGTH) * 100) + '%'],
      ],
      reward,
      buttons: ['↻ Retry', 'Back'],
      note: bestLine + ' · ' + msg,
    });
    if (run !== this.runId) return;
    if (btn === 0) {
      this.resetRun();
      this.state = 'result';
      this.camMode = 'chase';
      this.camOv.k = 100;
      this.startCountdown();
    } else this.leave();
  }
}
