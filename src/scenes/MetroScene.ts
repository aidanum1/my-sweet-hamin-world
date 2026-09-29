import * as THREE from 'three';
import { GameScene } from './GameScene';
import { P } from '../assets/palette';
import { mk, rbox, cyl, sphere, torus } from '../assets/geo';
import { room, sign, poster, sheepPlush, stickerPickup } from '../assets/props';
import { toon, VINYL_ROUGHNESS } from '../assets/materials';
import { canvasTex, blobShadowTex } from '../assets/textures';
import { landmark, critter } from '../assets/landmarks';
import { box as colBox, circle, Collider } from '../core/Collision';
import { StaticBatcher } from '../core/StaticBatcher';
import { wait, easeOutBack, clamp } from '../utils/math';

const V = THREE.Vector3;
const PI = Math.PI;

const W = 14, D = 12, H = 4.2;
const EDGE_Z = -3.6; // platform edge
const TRAIN_Z = -4.75;
const TRAIN_STOP_X = 0.5;
const DOOR_OFF = [-2, 2]; // door centres relative to the (procedural) train
const GATE_Z = 0.4;
const CLIP_X = 7.2; // the train is only drawn inside the station (it pops out of the tunnels)
const TICKET_X = -4.97; // ticket machine(s) centre
const BENCH_SEAT_Y = 0.52; // seat top of the left bench (metro_bench model and the procedural fallback alike)
const SHEEPY_Z = -1.15; // the waiting sheep sits between the bench's armrests (z −1.97 … −0.83)

// Higgsfield hq_train (sheep face at −X = the nose, doors on the +Z side facing the platform).
// Measurements below are in units of the model height (fit h = 1), taken from its texture.
const HQ_TRAIN_H = 3.2;
const HQ_TRAIN_LEN = 2.011; // length (X) per unit height
const HQ_TRAIN_DZ = -0.1; // tuck the car back a touch so it clears the platform lip
const HQ_TRAIN_SIDE = 0.385; // door-side surface (Z)
const HQ_TRAIN_DOORS = [{ x: -0.14, w: 0.4 }, { x: 0.595, w: 0.25 }]; // pink double doors
const HQ_DOOR_Y0 = 0.23, HQ_DOOR_Y1 = 0.755;

type TrainState = 'away' | 'arriving' | 'opening' | 'open' | 'dropoff' | 'closing' | 'departing';

/** Sweet Line station: ticket machine → gates → platform → a cute sheep train to the sea. */
export default class MetroScene extends GameScene {
  readonly id = 'metro' as const;
  readonly title = 'Sweet Line Station';
  subtitle = 'Mint platform · trains to the sea ♡';
  music = 'metro' as const;
  private train = new THREE.Group();
  private trainX = 19;
  private state: TrainState = 'away';
  private stateT = 99;
  /** per-door open/close animation (k = 0 closed … 1 open) */
  private doorAnims: ((k: number) => void)[] = [];
  /** door centres relative to the train (procedural car or the Higgsfield model) */
  private doorOff = [...DOOR_OFF];
  /** half the car length (+ nose): the train is hidden once it is fully inside a tunnel */
  private trainHalf = 5.8;
  private doorOpen = 0;
  private flaps: { pivot: THREE.Object3D; dir: number }[] = [];
  private flapCols: Collider[] = [];
  private gateOpen = false;
  private gateAnim = 1;
  private boarding = false;
  private screen!: THREE.MeshStandardMaterial;
  private prevClip = false;
  private benchModel = false;
  /** where a bought ticket pops out of the machine */
  private ticketFrom = new V(TICKET_X, 0.95, GATE_Z + 0.95);

  async build() {
    const loads: Promise<unknown>[] = [];
    this.skyArt('sky_day');
    this.light({ dir: [5, 10, 7], shadowRange: 10, hemi: 1.0 });
    this.bounds = { minX: -W / 2 + 0.2, maxX: W / 2 - 0.2, minZ: EDGE_Z + 0.3, maxZ: D / 2 + 0.1 };
    this.cam = { dist: 17, pitch: 0.62, lookY: 1.3, yawRange: 0.55, clamp: { minX: -2.2, maxX: 2.2, minZ: -1.2, maxZ: 1.6 } };
    const s = this.statics;
    const renderer = this.game.engine.renderer;
    this.prevClip = renderer.localClippingEnabled;
    renderer.localClippingEnabled = true;

    // ---------------- shell ----------------
    s.add(room({ w: W, d: D, h: H, floor: P.mint, wall: P.mint, slab: P.mintDeep, sideWalls: false }));
    s.add(mk(rbox(W + 0.4, 2.4, 0.34, 0.1, 1), P.mintDeep, [0, 1.25, -D / 2 - 0.1]));
    s.add(mk(rbox(W + 0.5, 0.16, 0.4, 0.06, 1), P.white, [0, 2.5, -D / 2 - 0.08]));
    s.add(mk(rbox(W + 0.5, 0.07, 0.38, 0.03, 1), P.pinkDeep, [0, 2.32, -D / 2 - 0.08]));
    const T = 0.3;
    const wall = (x: number, z0: number, z1: number) => {
      const d = z1 - z0;
      s.add(mk(rbox(T, H, d, 0.08, 1), P.mint, [x, H / 2, (z0 + z1) / 2]));
      s.add(mk(rbox(T + 0.14, 0.2, d + 0.06, 0.06, 1), P.white, [x, H, (z0 + z1) / 2]));
      s.add(mk(rbox(0.06, 0.24, d, 0.02, 1), P.white, [x - Math.sign(x) * 0.17, 0.2, (z0 + z1) / 2]));
      this.colliders.push(colBox(x, (z0 + z1) / 2, T, d));
    };
    wall(-W / 2 - T / 2, EDGE_Z, D / 2);
    wall(W / 2 + T / 2, EDGE_Z, 2.25);
    wall(W / 2 + T / 2, 4.75, D / 2);
    for (const sx of [-1, 1]) s.add(mk(cyl(0.22, 0.22, H + 0.2, 14), P.white, [sx * (W / 2 + T / 2), (H + 0.2) / 2, D / 2]));
    // tiled floor (one textured plane) over concourse + platform
    const fd = D / 2 - EDGE_Z;
    const tiles = canvasTex(256, 256, drawTiles);
    tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
    tiles.repeat.set(W / 2, fd / 2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, fd), new THREE.MeshStandardMaterial({ map: tiles, roughness: VINYL_ROUGHNESS }));
    floor.rotation.x = -PI / 2;
    floor.position.set(0, 0.106, (D / 2 + EDGE_Z) / 2);
    floor.receiveShadow = true;
    floor.userData.noShadow = true;
    this.scene.add(floor);

    // ---------------- tracks, platform edge, tunnels ----------------
    const bedTex = canvasTex(256, 64, drawTrackBed);
    bedTex.wrapS = THREE.RepeatWrapping;
    bedTex.repeat.set(W / 2, 1);
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(W, -D / 2 - EDGE_Z), new THREE.MeshStandardMaterial({ map: bedTex, roughness: VINYL_ROUGHNESS }));
    bed.rotation.x = -PI / 2;
    bed.position.set(0, 0.105, (-D / 2 + EDGE_Z) / 2);
    bed.userData.noShadow = true;
    bed.receiveShadow = true;
    this.scene.add(bed);
    for (const z of [TRAIN_Z - 0.55, TRAIN_Z + 0.55]) s.add(mk(rbox(W, 0.08, 0.1, 0.03, 1), P.lavenderDeep, [0, 0.15, z]));
    s.add(mk(rbox(W, 0.14, 0.4, 0.05, 1), P.white, [0, 0.1, EDGE_Z + 0.18]));
    s.add(mk(rbox(W, 0.03, 0.26, 0.01, 1), P.butter, [0, 0.17, EDGE_Z + 0.45]));
    // the "fluffy line" (please stand behind it~)
    for (let x = -W / 2 + 0.3; x < W / 2; x += 0.55) s.add(mk(sphere(0.11, 5, 3), P.white, [x, 0.17, EDGE_Z + 0.78], [0, 0, 0], [1, 0.7, 1]));
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 + 0.1);
      s.add(mk(rbox(0.5, 3.0, 0.45, 0.1, 1), P.white, [x, 1.5, EDGE_Z - 0.1]));
      s.add(mk(rbox(0.5, 3.0, 0.45, 0.1, 1), P.white, [x, 1.5, -D / 2 + 0.1]));
      s.add(mk(rbox(0.55, 0.5, EDGE_Z + D / 2 + 0.2, 0.12, 1), P.mintDeep, [x, 3.15, (EDGE_Z - D / 2) / 2]));
      const mouth = mk(rbox(0.1, 2.9, EDGE_Z + D / 2 - 0.35, 0.04, 1), 0xa9c9d9, [sx * (W / 2 + 0.3), 1.45, (EDGE_Z - D / 2) / 2]);
      s.add(mouth);
    }

    // ---------------- back wall: station sign + route map ----------------
    const nameSign = sign('🐑 School Station', 2.8, 0.62, { bg: '#FFFFFF', border: '#8FDCBC' });
    nameSign.position.set(-3.8, 3.35, -D / 2 + 0.03);
    this.scene.add(nameSign);
    const map = poster(5.2, 0.95, drawRouteMap, 512);
    map.position.set(2.6, 3.35, -D / 2 + 0.05);
    this.scene.add(map);
    s.add(mk(rbox(5.4, 1.12, 0.06, 0.05, 1), P.white, [2.6, 3.35, -D / 2 + 0.01]));

    // ---------------- pillars + benches on the platform ----------------
    for (const sx of [-1, 1]) {
      s.add(mk(cyl(0.3, 0.3, H, 16), P.mintDeep, [sx * 3.6, H / 2, -1.9]));
      s.add(mk(cyl(0.42, 0.42, 0.2, 16), P.white, [sx * 3.6, 0.2, -1.9]));
      s.add(mk(cyl(0.42, 0.36, 0.25, 16), P.white, [sx * 3.6, H - 0.12, -1.9]));
      this.colliders.push(circle(sx * 3.6, -1.9, 0.38));
      const ps = sign('🌊 to Sweet Sea Beach', 1.5, 0.42, { bg: '#FFFFFF', border: '#9FD8F2' });
      ps.position.set(sx * 3.6, 2.5, -1.58);
      this.scene.add(ps);
      // mint station bench (Higgsfield sam_3_3d), facing the middle of the platform; procedural bench as a fallback
      loads.push(this.prop('metro_bench', sx * 6.3, -1.4, { w: 1.5 }, -sx * PI / 2, 'box').then((m) => {
        if (m) {
          this.benchModel = true;
          this.noShadowProp(m, 1.7, 1.05);
          return;
        }
        // light bench (seat, back, two white legs)
        const b = new THREE.Group();
        b.add(mk(rbox(1.8, 0.12, 0.5, 0.05, 1), P.pink, [0, 0.45, 0]));
        b.add(mk(rbox(1.8, 0.4, 0.1, 0.05, 1), P.pink, [0, 0.78, -0.22]));
        for (const lx of [-0.7, 0.7]) b.add(mk(rbox(0.12, 0.42, 0.42, 0.04, 1), P.white, [lx, 0.21, 0]));
        b.position.set(sx * 6.3, 0, -1.4);
        b.rotation.y = -sx * PI / 2;
        this.add(b, 'box');
      }));
    }
    // sheep passenger waiting on the left bench (Higgsfield sheep_sit; procedural sheep as a fallback),
    // with a little butter suitcase beside it on the seat
    s.add(mk(rbox(0.3, 0.2, 0.14, 0.05, 1), P.butter, [-6.25, BENCH_SEAT_Y + 0.1, SHEEPY_Z - 0.45], [0, PI / 2, 0]));
    loads.push(this.buildSheepy());

    // ---------------- gate line ----------------
    const barrier = (x0: number, x1: number) => {
      const w = x1 - x0, cx = (x0 + x1) / 2;
      s.add(mk(rbox(w, 0.85, 0.22, 0.08, 1), P.mintDeep, [cx, 0.43, GATE_Z]));
      s.add(mk(rbox(w + 0.04, 0.1, 0.3, 0.05, 1), P.white, [cx, 0.9, GATE_Z]));
      this.colliders.push(colBox(cx, GATE_Z, w, 0.3));
    };
    barrier(-W / 2, -2.0);
    barrier(2.0, W / 2);
    for (const x of [-1.8, 0, 1.8]) {
      s.add(mk(rbox(0.36, 1.05, 1.3, 0.1, 1), P.white, [x, 0.53, GATE_Z]));
      s.add(mk(rbox(0.38, 0.12, 1.32, 0.05, 1), P.mintDeep, [x, 1.08, GATE_Z]));
      s.add(mk(cyl(0.12, 0.12, 0.03, 14), toon(P.pinkDeep, { emissive: 0x662233 }), [x, 1.15, GATE_Z + 0.35]));
      s.add(mk(rbox(0.22, 0.1, 0.16, 0.03, 1), toon(P.blue, { emissive: 0x223355 }), [x, 1.19, GATE_Z - 0.2], [-0.4, 0, 0]));
      this.colliders.push(colBox(x, GATE_Z, 0.36, 1.3));
    }
    // gate flaps (dynamic, animated)
    const flapMat = toon(P.pink);
    for (const lane of [-0.9, 0.9]) {
      for (const side of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(lane + side * 0.72, 0.72, GATE_Z + 0.1);
        const f = mk(rbox(0.66, 0.42, 0.07, 0.03, 1), flapMat, [-side * 0.33, 0, 0]);
        f.userData.dynamic = true;
        pivot.add(f);
        const heart = mk(sphere(0.07, 8, 6), toon(P.white), [-side * 0.5, 0.05, 0.04], [0, 0, 0], [1, 1, 0.4]);
        heart.userData.dynamic = true;
        pivot.add(heart);
        this.addDynamic(pivot);
        this.flaps.push({ pivot, dir: -side });
      }
      const c = colBox(lane, GATE_Z, 1.44, 0.26);
      this.flapCols.push(c);
      this.colliders.push(c);
    }
    // gate arch + sign
    for (const x of [-2.05, 2.05]) s.add(mk(cyl(0.08, 0.08, 2.5, 10), P.white, [x, 1.25, GATE_Z]));
    s.add(mk(rbox(4.4, 0.16, 0.16, 0.06, 1), P.mintDeep, [0, 2.5, GATE_Z]));
    const gs = sign('🎫 Ticket Gates ♡', 2.2, 0.5, { bg: '#FFFFFF', border: '#8FDCBC' });
    gs.position.set(0, 2.85, GATE_Z + 0.02);
    this.scene.add(gs);
    // sheep clock on the arch
    s.add(mk(cyl(0.3, 0.3, 0.1, 18), P.white, [1.55, 2.85, GATE_Z], [PI / 2, 0, 0]));
    for (let i = 0; i < 7; i++) { const a = (i / 7) * PI * 2; s.add(mk(sphere(0.1, 5, 3), P.white, [1.55 + Math.cos(a) * 0.31, 2.85 + Math.sin(a) * 0.31, GATE_Z - 0.02])); }
    s.add(mk(rbox(0.03, 0.18, 0.02, 0.01, 1), P.ink, [1.55, 2.9, GATE_Z + 0.07]));
    s.add(mk(rbox(0.13, 0.03, 0.02, 0.01, 1), P.ink, [1.6, 2.85, GATE_Z + 0.07]));

    // ---------------- ticket machines ----------------
    this.screen = new THREE.MeshStandardMaterial({ color: 0xdff4ff, emissive: 0x3a6070, roughness: 0.4 });
    const machine = (x: number, body: number, trim: number) => {
      const g = new THREE.Group();
      g.add(mk(rbox(1.0, 1.85, 0.7, 0.14, 1), body, [0, 0.93, 0]));
      g.add(mk(rbox(1.04, 0.14, 0.74, 0.06, 1), trim, [0, 1.88, 0]));
      g.add(mk(rbox(0.3, 0.05, 0.08, 0.02, 1), P.ink, [0.22, 0.95, 0.36]));
      g.add(mk(rbox(0.4, 0.12, 0.1, 0.03, 1), trim, [-0.1, 0.62, 0.36]));
      g.add(mk(cyl(0.05, 0.05, 0.04, 8), P.butterDeep, [0.3, 1.2, 0.36], [PI / 2, 0, 0]));
      // sheep topper
      g.add(mk(sphere(0.2, 7, 5), P.white, [0, 2.1, 0]));
      for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2; g.add(mk(sphere(0.1, 5, 3), P.white, [Math.cos(a) * 0.17, 2.15, Math.sin(a) * 0.14])); }
      g.add(mk(sphere(0.12, 8, 6), P.skin, [0, 2.1, 0.17], [0, 0, 0], [1, 0.9, 0.8]));
      g.add(mk(sphere(0.02, 4, 3), P.ink, [-0.04, 2.13, 0.27]));
      g.add(mk(sphere(0.02, 4, 3), P.ink, [0.04, 2.13, 0.27]));
      g.position.set(x, 0, GATE_Z + 0.52);
      this.add(g, 'box');
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.42), this.screen);
      sc.position.set(x, 1.42, GATE_Z + 0.89);
      this.scene.add(sc);
    };
    // one big mint ticket machine (Higgsfield sam_3_3d; 1.44 × 2.0 × 1.27) backed onto the gate barrier;
    // the two procedural machines are the fallback
    const tmD = 1.27;
    loads.push(this.prop('ticket_machine', TICKET_X, GATE_Z + 0.17 + tmD / 2, { h: 2.0 }, 0, 'box').then((m) => {
      if (m) {
        this.noShadowProp(m, 1.9, 1.75);
        this.ticketFrom.set(TICKET_X, 0.62, GATE_Z + 0.17 + tmD - 0.1); // the dispenser tray
        return;
      }
      machine(-5.6, P.pink, P.pinkDeep);
      machine(-4.35, P.blueSoft, P.blueDeep);
    }));
    const tm = sign('🎫 Tickets', 1.3, 0.38, { bg: '#FFFFFF', border: '#FF9DB3' });
    tm.position.set(TICKET_X, 2.62, GATE_Z + 0.2);
    this.scene.add(tm);

    // ---------------- stairs up to the schoolyard ----------------
    for (let i = 0; i < 6; i++) {
      const h = 0.35 * (i + 1);
      s.add(mk(rbox(0.47, h, 2.3, 0.05, 1), i % 2 ? P.white : P.mint, [5.15 + i * 0.45, h / 2, 3.5]));
    }
    for (const z of [2.3, 4.7]) {
      s.add(mk(rbox(2.9, 0.12, 0.12, 0.05, 1), P.white, [6.3, 1.9, z], [0, 0, 0.66]));
      s.add(mk(cyl(0.05, 0.05, 1.0, 8), P.white, [4.95, 0.5, z]));
      s.add(mk(sphere(0.09, 6, 4), P.pinkDeep, [4.95, 1.02, z]));
    }
    this.colliders.push(colBox(6.4, 3.5, 3.0, 2.5));
    const up = sign('🌳 Schoolyard ↑', 1.7, 0.45, { bg: '#FFFFFF', border: '#8FDCBC' });
    up.position.set(4.95, 2.35, 4.95);
    this.scene.add(up);
    s.add(mk(cyl(0.04, 0.04, 2.2, 8), P.white, [4.2, 1.1, 4.95]));
    s.add(mk(cyl(0.04, 0.04, 2.2, 8), P.white, [5.7, 1.1, 4.95]));
    this.door('yard', 'metro', new V(4.45, 0, 3.5), 'Back to the Schoolyard', 1.35);

    // travel poster + plants
    const tp = poster(1.3, 1.8, drawBeachPoster, 256);
    tp.position.set(-W / 2 + 0.02, 1.9, 3.2);
    tp.rotation.y = PI / 2;
    this.scene.add(tp);
    s.add(mk(rbox(0.06, 1.95, 1.45, 0.03, 1), P.white, [-W / 2 + 0.0, 1.9, 3.2]));

    // ---------------- the train ----------------
    loads.push(this.buildTrain());

    await Promise.all(loads);

    // ---------------- NPC, collectibles ----------------
    this.spawnNpcs({ choo: [-2.75, 1.7, 0.45] });
    const st = stickerPickup('🎫');
    st.position.set(5.6, 1.1, -2.7);
    this.collectible('sticker', 'stk_metro', st, 'Ticket sticker', '🎫');
    const pl = sheepPlush(0.95);
    // the Higgsfield bench has legs at its ends: the plushie naps just in front of the seat instead
    if (this.benchModel) pl.position.set(5.72, 0.06, -1.62);
    else pl.position.set(6.35, 0.06, -2.05);
    pl.rotation.y = -PI / 2;
    this.collectible('plush', 'plush_metro', pl, 'a sheep plushie napping under the bench', '🐑');

    this.spawns = {
      default: { x: 4.0, z: 3.5, rot: -PI / 2 },
      map: { x: 4.0, z: 3.5, rot: -PI / 2 },
      fromBeach: { x: TRAIN_STOP_X + this.doorOff[0], z: EDGE_Z + 1.0, rot: 0 },
    };

    // ---------------- interactions ----------------
    const game = this.game;
    this.interact({
      id: 'ticket', pos: new V(TICKET_X, 0, GATE_Z + 1.5), radius: 1.5, label: '🎫 Get a ticket', height: 2.5,
      onInteract: () => this.buyTicket(),
    });
    this.interact({
      id: 'gate', pos: new V(0, 0, GATE_Z + 0.9), radius: 1.9, label: '🚪 Tap your ticket', height: 1.9,
      enabled: () => !this.gateOpen,
      onInteract: () => this.tapGate(),
    });
    this.doorOff.forEach((off, i) => {
      this.interact({
        id: 'board' + i, pos: new V(TRAIN_STOP_X + off, 0, EDGE_Z + 0.4), radius: 1.2, label: '🚃 Board the train', height: 2.6,
        enabled: () => this.state === 'open',
        onInteract: () => this.board(TRAIN_STOP_X + off),
      });
    });

    this.onUpdate((dt, t) => {
      this.updateTrain(dt);
      this.updateGate(dt);
      this.screen.emissive.setHex(Math.sin(t * 3) > 0.6 ? 0x4a7a8a : 0x3a6070);
      // walking up to an open door = boarding
      const p = game.player.root.position;
      if (this.state === 'open' && !this.boarding && !game.locked && p.z < EDGE_Z + 0.75) {
        for (const off of this.doorOff) if (Math.abs(p.x - (TRAIN_STOP_X + off)) < 0.7) { this.board(TRAIN_STOP_X + off); break; }
      }
    });
  }

  onEnter(spawn: string) {
    if (spawn === 'fromBeach') {
      // arriving by train: it's waiting with open doors, then leaves
      this.trainX = TRAIN_STOP_X;
      this.state = 'dropoff';
      this.stateT = 0;
      this.doorOpen = 1;
      this.openGate(true);
      this.game.player.play('happy');
    }
    this.placeTrain();
  }

  onExit() {
    this.game.engine.renderer.localClippingEnabled = this.prevClip;
    this.game.cam.override = null;
  }

  /**
   * The sheep waiting on the left bench: Higgsfield sheep_sit (≈4k tris) with its back to the backrest (front face
   * x ≈ −6.51), turned a little toward the camera. It breathes, sways and bounces happily while a train pulls in.
   * The model is static, so all of that is transforms. Procedural (merged, still) sheep as a fallback.
   */
  private async buildSheepy() {
    const x = -6.3, face = PI / 2 - 0.3;
    try {
      const sheep = await critter('sheep_sit', { h: 0.62 });
      // like the bench under it: no shadow pass (budget), still receives shadows
      sheep.traverse((o) => {
        if (!(o as THREE.Mesh).isMesh) return;
        o.castShadow = false;
        o.userData.noShadow = true;
      });
      sheep.position.set(x, BENCH_SEAT_Y - 0.01, SHEEPY_Z);
      sheep.rotation.y = face;
      this.addDynamic(sheep);
      let excite = 0;
      this.onUpdate((dt, t) => {
        const want = this.state === 'arriving' || this.state === 'opening' ? 1 : 0;
        excite += (want - excite) * Math.min(1, dt * 3);
        const b = Math.sin(t * 2.1); // breathing
        const hop = Math.abs(Math.sin(t * 7)) * 0.05 * excite;
        const land = (1 - Math.abs(Math.sin(t * 7))) ** 6 * excite; // squish as it lands
        sheep.position.y = BENCH_SEAT_Y - 0.01 + hop;
        sheep.scale.set(1 - b * 0.01 + land * 0.05, 1 + b * 0.022 - land * 0.08, 1 - b * 0.01 + land * 0.05);
        sheep.rotation.set(0, face + Math.sin(t * 0.37) * 0.14 + excite * 0.15, Math.sin(t * 0.9) * 0.035);
      });
    } catch (e) {
      console.warn('sheep_sit failed, using the procedural sheep', e);
      const sheepy = new THREE.Group();
      sheepy.add(mk(sphere(0.3, 10, 8), P.white, [0, 0.72, 0]));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; sheepy.add(mk(sphere(0.14, 6, 4), P.white, [Math.cos(a) * 0.24, 0.8 + Math.sin(a * 2) * 0.04, Math.sin(a) * 0.22])); }
      sheepy.add(mk(sphere(0.17, 8, 6), P.skin, [0, 0.82, 0.26], [0, 0, 0], [1, 0.9, 0.85]));
      sheepy.add(mk(sphere(0.025, 5, 3), P.ink, [-0.06, 0.85, 0.4]));
      sheepy.add(mk(sphere(0.025, 5, 3), P.ink, [0.06, 0.85, 0.4]));
      sheepy.position.set(x, 0, SHEEPY_Z);
      sheepy.rotation.y = face;
      this.add(sheepy);
    }
  }

  /**
   * Triangle budget (~120k incl. Hamin + shadow pass): the Higgsfield props here still receive shadows but skip
   * the shadow pass; a soft blob (2 tris) grounds them instead. w/d = blob size in the prop's own frame.
   */
  private noShadowProp(m: THREE.Object3D, w: number, d: number) {
    m.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      o.castShadow = false;
      o.userData.noShadow = true;
    });
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobShadowTex(), transparent: true, depthWrite: false }));
    blob.rotation.x = -PI / 2;
    blob.position.y = 0.125; // just above the tiles
    blob.userData.noShadow = true;
    m.add(blob);
  }

  // ------------------------------------------------------------------ train
  /** The Higgsfield sheep train (hq_train) rides in this.train; the procedural car is the fallback. */
  private async buildTrain() {
    const clip = [new THREE.Plane(new V(-1, 0, 0), CLIP_X), new THREE.Plane(new V(1, 0, 0), CLIP_X)];
    let car: THREE.Group | null = null;
    try {
      car = await landmark('hq_train', { h: HQ_TRAIN_H });
    } catch (e) {
      console.warn('landmark failed', 'hq_train', e);
    }
    if (car) this.buildHqTrain(car, clip);
    else this.buildProceduralTrain(clip);
    this.train.position.set(this.trainX, 0.12, TRAIN_Z);
    this.addDynamic(this.train);
  }

  private buildHqTrain(car: THREE.Group, clip: THREE.Plane[]) {
    const s = HQ_TRAIN_H;
    const dx = -TRAIN_STOP_X; // centred in the station once it has stopped
    // own material copies so only this car clips at the tunnel mouths (the texture stays shared/cached).
    // Triangle budget: the 15k-tri car skips the shadow pass and gets a soft blob underneath instead.
    car.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.clippingPlanes = clip;
      mat.userData = {};
      m.material = mat;
      m.castShadow = false;
      m.userData.noShadow = true;
    });
    car.position.set(dx, 0, HQ_TRAIN_DZ);
    this.train.add(car);
    this.trainHalf = Math.abs(dx) + (HQ_TRAIN_LEN * s) / 2 + 0.1;
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(HQ_TRAIN_LEN * s * 1.05, 0.82 * s * 1.3),
      new THREE.MeshBasicMaterial({ map: blobShadowTex(), transparent: true, depthWrite: false, clippingPlanes: clip }),
    );
    blob.rotation.x = -PI / 2;
    blob.position.set(dx, 0.012, HQ_TRAIN_DZ);
    blob.userData.noShadow = true;
    this.train.add(blob);
    // the model's pink doors are painted on: while they open, pink leaves appear over them and tuck into
    // the car body, revealing the lavender inside
    const panelMat = new THREE.MeshStandardMaterial({ color: P.pinkDeep, roughness: VINYL_ROUGHNESS, clippingPlanes: clip });
    const winMat = new THREE.MeshStandardMaterial({ color: 0xc9c2ea, emissive: 0x2a2640, roughness: VINYL_ROUGHNESS, clippingPlanes: clip });
    const insideMat = new THREE.MeshStandardMaterial({ color: 0xcdbfe8, emissive: 0x3a3050, roughness: VINYL_ROUGHNESS, clippingPlanes: clip });
    const y0 = HQ_DOOR_Y0 * s, dh = (HQ_DOOR_Y1 - HQ_DOOR_Y0) * s, zs = HQ_TRAIN_DZ + HQ_TRAIN_SIDE * s;
    this.doorOff = [];
    for (const d of HQ_TRAIN_DOORS) {
      const cx = dx + d.x * s, dw = d.w * s;
      this.doorOff.push(cx);
      const inside = new THREE.Mesh(rbox(dw * 0.96, dh * 0.97, 0.04, 0.03, 1), insideMat);
      inside.position.set(cx, y0 + dh / 2, zs + 0.02);
      this.train.add(inside);
      const leaves = [-1, 1].map((sx) => {
        const pivot = new THREE.Group(); // outer edge of the doorway
        pivot.position.set(cx + (sx * dw) / 2, y0 + dh / 2, zs + 0.055);
        const leaf = new THREE.Mesh(rbox(dw / 2, dh, 0.05, 0.03, 1), panelMat);
        leaf.position.x = (-sx * dw) / 4;
        pivot.add(leaf);
        const win = new THREE.Mesh(rbox(dw * 0.23, dh * 0.44, 0.03, 0.04, 1), winMat);
        win.position.set((-sx * dw) / 4, dh * 0.19, 0.03);
        pivot.add(win);
        this.train.add(pivot);
        return pivot;
      });
      this.doorAnims.push((k) => {
        const on = k > 0.001;
        inside.visible = on;
        for (const l of leaves) {
          l.visible = on;
          l.scale.x = 1 - k * 0.94;
        }
      });
    }
  }

  private buildProceduralTrain(clip: THREE.Plane[]) {
    const g = new THREE.Group();
    const cream = 0xfffaf2;
    g.add(mk(rbox(10.4, 2.0, 2.1, 0.4), cream, [0, 1.35, 0]));
    g.add(mk(rbox(10.1, 0.32, 1.85, 0.15), P.mint, [0, 2.45, 0]));
    g.add(mk(rbox(10.44, 0.3, 2.14, 0.12), P.mintDeep, [0, 0.82, 0]));
    g.add(mk(rbox(10.44, 0.08, 2.14, 0.03, 1), P.pinkDeep, [0, 1.05, 0]));
    g.add(mk(rbox(9.6, 0.3, 1.8, 0.1, 1), P.metal, [0, 0.28, 0]));
    for (const x of [-3.9, -3.0, 3.0, 3.9]) {
      g.add(mk(cyl(0.26, 0.26, 0.12, 14), P.lavenderDeep, [x, 0.28, 0.95], [PI / 2, 0, 0]));
      g.add(mk(cyl(0.1, 0.1, 0.14, 8), P.white, [x, 0.28, 0.97], [PI / 2, 0, 0]));
    }
    const glass = toon(0xcfeaff, { emissive: 0x2a4a66 });
    for (const x of [-3.9, 0, 3.9]) {
      g.add(mk(rbox(1.35, 0.8, 0.06, 0.1, 1), P.white, [x, 1.62, 1.04]));
      g.add(mk(rbox(1.2, 0.66, 0.06, 0.1, 1), glass, [x, 1.62, 1.06]));
    }
    for (const off of DOOR_OFF) {
      g.add(mk(rbox(1.4, 1.95, 0.05, 0.06, 1), P.white, [off, 1.3, 1.04]));
      g.add(mk(rbox(1.24, 1.82, 0.05, 0.05, 1), 0xcdbfe8, [off, 1.27, 1.05]));
    }
    // sheep nose (front = -X): rounded cab, face, woolly top and ears
    g.add(mk(sphere(1.05, 16, 12), cream, [-5.05, 1.35, 0], [0, 0, 0], [0.62, 0.98, 1]));
    g.add(mk(sphere(1.02, 12, 8), P.mintDeep, [-5.05, 0.82, 0], [0, 0, 0], [0.6, 0.18, 1.02]));
    g.add(mk(rbox(0.12, 0.55, 1.2, 0.06, 1), glass, [-5.6, 1.95, 0], [0, 0, -0.35]));
    for (const [z, x] of [[0.42, -5.62], [0.8, -5.45]] as const) {
      g.add(mk(sphere(0.085, 8, 6), P.ink, [x, 1.4, z], [0, 0, 0], [0.6, 1.2, 1]));
      g.add(mk(sphere(0.07, 6, 4), P.blush, [x + 0.04, 1.22, z + 0.06], [0, 0, 0], [0.5, 0.7, 1]));
    }
    g.add(mk(torus(0.1, 0.022, 4, 10, PI), P.ink, [-5.6, 1.25, 0.62], [0, -0.9, PI]));
    for (let i = 0; i < 6; i++) g.add(mk(sphere(0.2, 8, 6), P.white, [-4.6 - (i % 3) * 0.28, 2.55 + Math.floor(i / 3) * 0.14, -0.3 + (i % 3) * 0.3 + Math.floor(i / 3) * 0.15]));
    for (const z of [-0.75, 0.75]) g.add(mk(sphere(0.16, 8, 6), P.skin, [-4.9, 2.3, z], [0, 0, 0], [0.6, 0.4, 1.4]));
    g.add(mk(sphere(0.12, 8, 6), toon(P.butter, { emissive: 0x665522 }), [-5.62, 0.98, 0.3]));
    // tail end
    g.add(mk(rbox(0.3, 1.9, 2.0, 0.14, 1), P.mint, [5.2, 1.3, 0]));
    g.add(mk(sphere(0.1, 6, 4), toon(P.strawberry, { emissive: 0x551122 }), [5.36, 0.95, 0.6]));
    // roof bits
    g.add(mk(rbox(1.4, 0.18, 0.9, 0.06, 1), P.white, [1.5, 2.68, 0]));
    g.add(mk(rbox(1.4, 0.18, 0.9, 0.06, 1), P.white, [-2.2, 2.68, 0]));

    const batch = new StaticBatcher();
    batch.addObject(g);
    const body = batch.build('metro-train');
    const clipMat = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: VINYL_ROUGHNESS, clippingPlanes: clip, clipShadows: true });
    if (body) {
      body.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: VINYL_ROUGHNESS, clippingPlanes: clip, clipShadows: true });
      this.train.add(body);
    }
    // sliding door panels
    const panelMat = clipMat(P.pink);
    const winMat = clipMat(0xdff1ff);
    for (const off of DOOR_OFF) {
      const mkPanel = (sx: number) => {
        const p = new THREE.Group();
        p.add(new THREE.Mesh(rbox(0.6, 1.78, 0.06, 0.04, 1), panelMat));
        const w = new THREE.Mesh(rbox(0.38, 0.55, 0.03, 0.05, 1), winMat);
        w.position.set(0, 0.35, 0.03);
        p.add(w);
        p.position.set(off + sx * 0.31, 1.27, 1.09);
        this.train.add(p);
        return p;
      };
      const l = mkPanel(-1), r = mkPanel(1);
      this.doorAnims.push((k) => {
        l.position.x = off - 0.31 - k * 0.56;
        r.position.x = off + 0.31 + k * 0.56;
      });
    }
    // destination board
    const dest = sign('🌊 Sweet Sea Beach', 1.5, 0.3, { bg: '#FFFFFF', border: '#FF9DB3' });
    (dest.material as THREE.MeshBasicMaterial).clippingPlanes = clip;
    dest.position.set(0, 2.2, 1.075);
    this.train.add(dest);
  }

  private placeTrain() {
    this.train.position.x = this.trainX;
    // hidden once it is completely inside a tunnel (the clip planes hide the rest)
    this.train.visible = Math.abs(this.trainX) < CLIP_X + this.trainHalf;
    for (const f of this.doorAnims) f(this.doorOpen);
  }

  private setState(s: TrainState) {
    this.state = s;
    this.stateT = 0;
  }

  private updateTrain(dt: number) {
    this.stateT += dt;
    const g = this.game;
    const t = this.stateT;
    const p = g.player.root.position;
    switch (this.state) {
      case 'away':
        this.trainX = 19;
        if (t > 3 && p.z < GATE_Z - 0.3 && !this.boarding) {
          this.setState('arriving');
          g.audio.sfx('train');
          g.ui.toast('🚃', 'The Sweet Line train is arriving~ Please stand behind the fluffy line ♡');
        }
        break;
      case 'arriving': {
        const k = clamp(t / 3.4, 0, 1);
        this.trainX = TRAIN_STOP_X + (19 - TRAIN_STOP_X) * Math.pow(1 - k, 3);
        if (k >= 1) this.setState('opening');
        break;
      }
      case 'opening':
        if (t > 0.35) {
          this.doorOpen = Math.min(1, this.doorOpen + dt * 2.2);
          if (this.doorOpen >= 1) {
            this.setState('open');
            g.audio.sfx('door');
            g.audio.sfx('chime');
          }
        }
        break;
      case 'dropoff':
        if (t > 1.4) this.setState('closing');
        break;
      case 'closing':
        this.doorOpen = Math.max(0, this.doorOpen - dt * 2.2);
        if (this.doorOpen <= 0 && t > 0.8) {
          this.setState('departing');
          g.audio.sfx('train');
        }
        break;
      case 'departing': {
        const k = clamp(t / 3.4, 0, 1);
        this.trainX = TRAIN_STOP_X - (19 + TRAIN_STOP_X) * k * k * k;
        if (k >= 1) this.setState('away');
        break;
      }
    }
    // tiny idle rumble while stopped
    this.train.position.y = 0.12 + (this.state === 'arriving' || this.state === 'departing' ? Math.sin(this.stateT * 30) * 0.012 : 0);
    this.placeTrain();
  }

  private async board(doorX: number) {
    if (this.boarding) return;
    const g = this.game;
    this.boarding = true;
    g.lock();
    try {
      g.ui.setAction(null);
      g.ui.prompt('near', null);
      const p = g.player;
      this.bounds = { ...this.bounds, minZ: TRAIN_Z };
      g.faceTo(doorX, TRAIN_Z);
      const from = p.root.position.clone();
      const to = new V(doorX, 0, EDGE_Z + 0.02);
      p.moveSpeed = 2.4;
      g.audio.sfx('door');
      for (let i = 1; i <= 24; i++) {
        p.root.position.lerpVectors(from, to, i / 24);
        await wait(22);
      }
      p.moveSpeed = 0;
      p.play('happy');
      g.ui.react(p.root.position.clone().setY(2.7), '♪ Let’s go~');
      await wait(350);
    } finally {
      g.unlock();
    }
    g.goto('train', 'toBeach', { text: 'Next stop: Sweet Sea Beach ♡', icon: '🚃' });
  }

  // ------------------------------------------------------------------ ticket + gate
  private async buyTicket() {
    const g = this.game;
    const p = g.player;
    g.setFacing(PI);
    if (g.save.flag('ticket', false)) {
      p.play('happy');
      g.ui.toast('🎫', 'You already have a Sweet Line pass ♡ Tap it at the gate!');
      return;
    }
    await p.playAsync('interact');
    g.audio.sfx('coin');
    // a little ticket pops out of the slot and hops into Hamin's hand
    const tk = new THREE.Group();
    tk.add(mk(rbox(0.34, 0.02, 0.2, 0.01, 1), P.butter));
    tk.add(mk(rbox(0.34, 0.025, 0.05, 0.01, 1), P.pinkDeep));
    const from = this.ticketFrom.clone();
    const to = p.root.position.clone().setY(2.6);
    tk.position.copy(from);
    this.scene.add(tk);
    for (let i = 1; i <= 30; i++) {
      const k = i / 30;
      tk.position.lerpVectors(from, to, k).setY(from.y + (to.y - from.y) * k + Math.sin(k * PI) * 0.8);
      tk.rotation.set(k * PI * 2, k * PI * 3, 0);
      await wait(16);
    }
    tk.removeFromParent();
    g.fx.burst(to, 'sparkles', 10);
    g.audio.sfx('chime');
    g.save.setFlag('ticket', true);
    p.play('happy');
    g.ui.react(to.clone().setY(2.9), '🎫 ♡');
    g.ui.toast('🎫', 'Got a Sweet Line ticket! Tap it at the gate ♡', true);
    g.addHearts(2, p.root.position);
  }

  private async tapGate() {
    const g = this.game;
    const p = g.player;
    g.setFacing(PI);
    if (!g.save.flag('ticket', false)) {
      p.play('surprised');
      g.audio.sfx('miss');
      g.ui.react(p.root.position.clone().setY(2.7), '?', 'plain');
      g.ui.toast('🎫', 'No ticket yet! Try the machines on the left ♡');
      return;
    }
    await p.playAsync('interact');
    g.audio.sfx('perfect');
    this.openGate(false);
    g.fx.burst(new V(0, 1.3, GATE_Z), 'sparkles', 12, 1.5);
    g.ui.react(p.root.position.clone().setY(2.7), 'beep ♡');
    g.ui.toast('🚪', 'Beep! Have a sweet trip ♡');
  }

  private openGate(instant: boolean) {
    if (this.gateOpen) return;
    this.gateOpen = true;
    this.gateAnim = instant ? 1 : 0;
    for (const c of this.flapCols) {
      const i = this.colliders.indexOf(c);
      if (i >= 0) this.colliders.splice(i, 1);
    }
    this.updateGate(0);
  }

  private updateGate(dt: number) {
    if (!this.gateOpen) return;
    this.gateAnim = Math.min(1, this.gateAnim + dt * 2.2);
    const k = easeOutBack(this.gateAnim);
    for (const f of this.flaps) {
      f.pivot.rotation.y = f.dir * (PI / 2) * k;
      f.pivot.scale.y = 1 + Math.sin(this.gateAnim * PI) * 0.15;
    }
  }
}

// ------------------------------------------------------------------ canvas art
function drawTiles(g: CanvasRenderingContext2D, w: number) {
  const t = w / 2;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    g.fillStyle = (i + j) % 2 ? '#bfeed8' : '#fbfffd';
    g.fillRect(i * t, j * t, t, t);
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.fillRect(i * t + 14, j * t + 14, t * 0.3, 6);
  }
  g.strokeStyle = '#a5dcc3';
  g.lineWidth = 6;
  for (let k = 0; k <= 2; k++) {
    g.beginPath(); g.moveTo(k * t, 0); g.lineTo(k * t, w); g.stroke();
    g.beginPath(); g.moveTo(0, k * t); g.lineTo(w, k * t); g.stroke();
  }
}

function drawTrackBed(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#dcdcee';
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(160,160,200,.35)';
  for (let i = 0; i < 160; i++) g.fillRect((i * 53) % w, (i * 29) % h, 3, 3);
  g.fillStyle = '#ebc9a0';
  for (let x = 12; x < w; x += 64) g.fillRect(x, h * 0.12, 22, h * 0.76);
}

function drawRouteMap(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#8fdcbc';
  g.fillRect(0, 0, w, 16);
  g.font = '900 13px Nunito, sans-serif';
  g.fillStyle = '#ffffff';
  g.textAlign = 'left';
  g.fillText('SWEET LINE · route map', 10, 12);
  const y = h * 0.52;
  g.strokeStyle = '#8fdcbc';
  g.lineWidth = 10;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(40, y); g.lineTo(w - 40, y); g.stroke();
  const stops = ['School', 'Candy Park', 'Cloud Hill', 'Sweet Sea Beach'];
  g.textAlign = 'center';
  stops.forEach((n, i) => {
    const x = 40 + (i * (w - 80)) / (stops.length - 1);
    g.fillStyle = i === 0 ? '#ff9db3' : i === stops.length - 1 ? '#7cc3ea' : '#ffffff';
    g.strokeStyle = '#364049';
    g.lineWidth = 3;
    g.beginPath(); g.arc(x, y, 11, 0, PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#364049';
    g.font = '800 15px Nunito, sans-serif';
    g.fillText(n, x, y + 30);
  });
  g.font = '800 13px Nunito, sans-serif';
  g.fillStyle = '#ff7a93';
  g.fillText('▲ you are here', 40 + 10, y - 18);
}

function drawBeachPoster(g: CanvasRenderingContext2D, w: number, h: number) {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#bfe3ff');
  grd.addColorStop(0.55, '#ffe3ec');
  grd.addColorStop(0.56, '#7cc3ea');
  grd.addColorStop(0.8, '#9fd8f2');
  grd.addColorStop(0.81, '#ffeccb');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff3b0';
  g.beginPath(); g.arc(w * 0.7, h * 0.3, 34, 0, PI * 2); g.fill();
  g.fillStyle = '#ffffff';
  for (const [x, y, r] of [[50, 70, 18], [70, 64, 22], [92, 72, 16]]) { g.beginPath(); g.arc(x, y, r, 0, PI * 2); g.fill(); }
  g.fillStyle = '#ffffff';
  g.fillRect(w * 0.2, h * 0.64, 60, 5);
  g.fillRect(w * 0.55, h * 0.7, 70, 5);
  g.textAlign = 'center';
  g.font = '900 30px Nunito, sans-serif';
  g.lineWidth = 8;
  g.strokeStyle = '#ffffff';
  g.strokeText('Sweet Sea', w / 2, h * 0.9);
  g.fillStyle = '#ff7a93';
  g.fillText('Sweet Sea', w / 2, h * 0.9);
  g.font = '800 16px Nunito, sans-serif';
  g.fillStyle = '#364049';
  g.fillText('only 1 stop by Sweet Line ♡', w / 2, h * 0.97);
}
