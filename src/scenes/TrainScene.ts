import * as THREE from 'three';
import { GameScene } from './GameScene';
import { P } from '../assets/palette';
import { mk, rbox, cyl, sphere, cone, capsule, torus } from '../assets/geo';
import { poster } from '../assets/props';
import { critter } from '../assets/landmarks';
import { toon } from '../assets/materials';
import { StaticBatcher } from '../core/StaticBatcher';
import { el } from '../ui/UI';

const V = THREE.Vector3;
const PI = Math.PI;

const DUR = 9.2; // seconds of ride
const WIN_Y0 = 1.0, WIN_Y1 = 2.25; // window opening
const WALL_Z = -1.8; // inner face of the window wall
const WINS = [-3.4, -0.4, 2.6]; // window centres (x)
const SEAT_Z = -1.2;
const HAMIN_WIN = WINS[1];
const SEAT_TOP = 0.52; // top of the pink seat cushions
const PASSENGER_H = 0.68; // sitting sheep height (≈ the procedural passenger)

interface Layer { root: THREE.Group; speed: number }

const STRAP = new THREE.BoxGeometry(0.05, 0.28, 0.025);
STRAP.userData.shared = true;

/**
 * Upper half of a sphere, for the hills whose lower half is under the sea / the fields anyway (half the triangles;
 * pays for the Higgsfield sheep passengers). Cached and shared like the geo.ts primitives.
 */
const DOMES = new Map<string, THREE.BufferGeometry>();
function dome(r: number, ws: number, hs: number) {
  const key = `${r},${ws},${hs}`;
  let g = DOMES.get(key);
  if (!g) {
    g = new THREE.SphereGeometry(r, ws, hs, 0, PI * 2, 0, PI / 2);
    g.userData.shared = true;
    DOMES.set(key, g);
  }
  return g;
}

/** Low-poly woolly sheep (passenger fallback & sheep clouds): 6 wool puffs + face + ears. */
function sheepBlob(s = 1, wool: number = P.white) {
  const g = new THREE.Group();
  g.add(mk(sphere(0.36, 10, 7), wool, [0, 0, 0], [0, 0, 0], [1.1, 0.9, 1]));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2;
    g.add(mk(sphere(0.2, 7, 5), wool, [Math.cos(a) * 0.3, 0.1 + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.26]));
  }
  g.add(mk(sphere(0.2, 8, 6), P.skin, [0.36, 0.12, 0], [0, 0, 0], [0.85, 0.9, 1]));
  g.add(mk(sphere(0.03, 4, 3), P.ink, [0.52, 0.16, -0.08]));
  g.add(mk(sphere(0.03, 4, 3), P.ink, [0.52, 0.16, 0.08]));
  for (const z of [-0.2, 0.2]) g.add(mk(sphere(0.08, 5, 3), P.skin, [0.3, 0.22, z], [0, 0, 0], [0.6, 0.4, 1.4]));
  g.scale.setScalar(s);
  return g;
}

/** Short cutscene: a ride on the Sweet Line with a parallax pastel world outside the windows. */
export default class TrainScene extends GameScene {
  readonly id = 'train' as const;
  readonly title = 'Sweet Line Train';
  music = 'metro' as const;
  ambience = 'train';
  explore = false;
  showPlayer = true;
  private layers: Layer[] = [];
  private dir = 1; // +1 → to the beach (scenery scrolls +X), -1 → back to school
  private t = 0;
  private started = false;
  private done = false;
  private shot = -1;
  private hx = 0; // Hamin seat x
  private car: THREE.Object3D | null = null;
  private straps = new THREE.Group();
  private hud: HTMLDivElement | null = null;
  private announced = false;
  private reacted = false;
  private passengers: { o: THREE.Object3D; face: number; ph: number }[] = [];

  async build() {
    this.skyArt('sky_day');
    this.light({ dir: [-3, 10, 6], shadowRange: 6, hemi: 1.1 });
    this.cam = { fov: 42 };
    this.bounds = { minX: -4.5, maxX: 4.5, minZ: -1.6, maxZ: 1.6 };
    const loads: Promise<unknown>[] = [];
    this.buildCar(loads);
    this.buildWorld();
    await Promise.all(loads);
  }

  onEnter(spawn: string) {
    const g = this.game;
    this.dir = spawn === 'toSchool' ? -1 : 1;
    // Hamin sits by the window, facing the direction of travel
    this.hx = this.dir > 0 ? HAMIN_WIN + 0.78 : HAMIN_WIN - 0.78;
    g.player.root.position.set(this.hx, 0, SEAT_Z);
    g.setFacing(this.dir > 0 ? -PI / 2 : PI / 2);
    g.player.play('sit', { loop: true });
    this.setShot(0, true);
    this.placeLayers();
    // skip button
    const L = g.ui.layer('train-hud');
    const skip = el('button', 'candy small', 'skip ▶▶');
    skip.style.cssText = 'position:absolute;right:calc(14px + env(safe-area-inset-right));bottom:calc(16px + env(safe-area-inset-bottom));opacity:.9';
    skip.onclick = (e) => { e.stopPropagation(); g.audio.sfx('tap'); this.finish(); };
    L.appendChild(skip);
    this.hud = L;
  }

  onExit() {
    this.hud?.remove();
    this.hud = null;
    this.game.cam.override = null;
    this.game.player.overrideExpression(null);
  }

  update(dt: number) {
    const g = this.game;
    if (!this.started) {
      this.started = true;
      g.audio.sfx('train');
      g.ui.banner('🚃 Sweet Line', this.dir > 0 ? 'Bound for Sweet Sea Beach ♡' : 'Bound for School Station ♡');
    }
    if (!this.done) this.t = Math.min(DUR, this.t + dt);
    const t = this.t;
    this.placeLayers();

    // gentle bobbing + tiny rail joints
    const joint = Math.max(0, Math.sin(this.time * 4.6)) ** 24 * 0.025;
    const bob = Math.sin(this.time * 9) * 0.008 + joint;
    if (!this.car) this.car = this.scene.getObjectByName('train-static') ?? null;
    if (this.car) {
      this.car.position.y = bob;
      this.car.updateMatrix();
    }
    g.player.root.position.y = bob;
    for (const p of this.passengers) {
      const tt = this.time + p.ph;
      const b = Math.sin(tt * 2.3); // breathing
      p.o.position.y = SEAT_TOP + bob;
      p.o.scale.set(1 - b * 0.01, 1 + b * 0.022 - joint * 2, 1 - b * 0.01);
      p.o.rotation.set(0, p.face + Math.sin(tt * 0.45) * 0.1, Math.sin(tt * 1.1) * 0.03 + joint * 1.5);
    }
    this.straps.position.y = 2.62 + bob;
    this.straps.rotation.x = Math.sin(this.time * 2.1) * 0.08 + joint * 3;

    // camera shots
    if (t > 3.1 && this.shot < 1) this.setShot(1);
    if (t > 6.2 && this.shot < 2) this.setShot(2);
    const hp = g.player.root.position;
    if (t > 6.4 && !this.reacted) {
      this.reacted = true;
      g.player.overrideExpression('happy');
      g.ui.react(hp.clone().setY(2.1), this.dir > 0 ? 'Waa~ the sea! 🌊' : 'Back to school~ ♡', 'big');
      g.fx.burst(hp.clone().setY(1.6), 'hearts', 6, 0.6);
      g.audio.sfx('sparkle');
    }
    if (t > 7.0 && !this.announced) {
      this.announced = true;
      g.audio.sfx('chime');
      this.announce(this.dir > 0 ? '🔔 Next stop: Sweet Sea Beach ♡ Please mind the fluffy gap~' : '🔔 Next stop: School Station ♡ Thank you for riding the Sweet Line~');
    }
    if (t >= DUR) this.finish();
    g.cam.update(dt);
    if (g.cam.override && (g.cam.override.k ?? 0) > 100) g.cam.override.k = 1.6;
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    this.hud?.remove();
    this.hud = null;
    const g = this.game;
    if (this.dir > 0) g.goto('beach', 'fromTrain', { text: 'Arriving at Sweet Sea Beach ♡', icon: '🌊' });
    else g.goto('metro', 'fromBeach', { text: 'Arriving at School Station ♡', icon: '🚃' });
  }

  private announce(text: string) {
    if (!this.hud) return;
    const pill = el('div', 'mg-pill', text);
    pill.style.cssText = 'position:absolute;left:50%;top:calc(16px + env(safe-area-inset-top));transform:translate(-50%,-12px);opacity:0;transition:all .45s cubic-bezier(.3,1.6,.5,1);white-space:normal;text-align:center;max-width:calc(100cqw - 32px);font-size:16px';
    this.hud.appendChild(pill);
    requestAnimationFrame(() => { pill.style.opacity = '1'; pill.style.transform = 'translate(-50%,0)'; });
  }

  /** Camera shots, mirrored for the return trip. */
  private setShot(i: number, snap = false) {
    this.shot = i;
    const s = this.dir; // +1: Hamin faces -X
    const hx = this.hx;
    const X = (dx: number) => hx - s * dx; // dx measured "in front of" Hamin
    let pos: THREE.Vector3, look: THREE.Vector3, fov = 42;
    if (i === 0) { pos = new V(X(0.3), 2.0, 4.6); look = new V(X(0.9), 1.3, -1.5); fov = 46; }
    else if (i === 1) { pos = new V(X(0.35), 1.85, 1.0); look = new V(X(1.4), 1.3, -5); fov = 50; }
    else { pos = new V(X(2.3), 1.6, 1.0); look = new V(X(0.2), 1.15, SEAT_Z - 0.2); fov = 42; }
    this.game.cam.override = { pos, look, k: snap ? 1000 : 1.6, fov };
  }

  private placeLayers() {
    const tt = this.dir > 0 ? this.t : DUR - this.t;
    for (const l of this.layers) l.root.position.x = l.speed * tt;
  }

  // ------------------------------------------------------------------ interior
  private buildCar(loads: Promise<unknown>[]) {
    const s = this.statics;
    const cream = 0xfff8ee;
    // floor, aisle, underbody
    s.add(mk(rbox(9.4, 0.2, 3.7, 0.06), P.lavender, [0, -0.1, -0.1]));
    s.add(mk(rbox(9.1, 0.02, 0.9, 0.01, 1), P.pinkSoft, [0, 0.01, 0.45]));
    s.add(mk(rbox(9.6, 0.75, 3.8, 0.2), P.mint, [0, -0.55, -0.1]));
    s.add(mk(rbox(9.64, 0.09, 3.84, 0.03, 1), P.pinkDeep, [0, -0.36, -0.1]));
    for (const x of [-3.3, -2.5, 2.5, 3.3]) s.add(mk(cyl(0.3, 0.3, 0.14, 14), P.lavenderDeep, [x, -0.95, 1.72], [PI / 2, 0, 0]));
    // window wall, built around the openings
    const T = 0.2, zc = WALL_Z - T / 2;
    s.add(mk(rbox(9.4, WIN_Y0, T, 0.05), P.pinkSoft, [0, WIN_Y0 / 2, zc]));
    s.add(mk(rbox(9.4, 3.05 - WIN_Y1, T, 0.05), cream, [0, (WIN_Y1 + 3.05) / 2, zc]));
    let x0 = -4.7;
    for (const cx of [...WINS, 5.75]) {
      const x1 = cx - 1.05;
      if (x1 > x0 + 0.01) s.add(mk(rbox(x1 - x0, WIN_Y1 - WIN_Y0, T, 0.04, 1), cream, [(x0 + x1) / 2, (WIN_Y0 + WIN_Y1) / 2, zc]));
      x0 = cx + 1.05;
    }
    for (const cx of WINS) {
      // rounded white frame + sill + tied curtains
      s.add(mk(rbox(2.2, 0.1, 0.12, 0.04, 1), P.white, [cx, WIN_Y1, WALL_Z + 0.02]));
      s.add(mk(rbox(2.3, 0.1, 0.34, 0.04, 1), P.white, [cx, WIN_Y0, WALL_Z + 0.1]));
      for (const sx of [-1, 1]) {
        s.add(mk(rbox(0.1, WIN_Y1 - WIN_Y0, 0.12, 0.04, 1), P.white, [cx + sx * 1.05, (WIN_Y0 + WIN_Y1) / 2, WALL_Z + 0.02]));
        s.add(mk(capsule(0.12, 0.75, 2, 6), P.pink, [cx + sx * 0.92, 1.8, WALL_Z + 0.12], [0, 0, sx * 0.12]));
        s.add(mk(sphere(0.06, 6, 4), P.butterDeep, [cx + sx * 0.88, 1.5, WALL_Z + 0.22]));
      }
    }
    // ceiling with light strips + ads
    s.add(mk(rbox(9.4, 0.14, 3.7, 0.05, 1), P.white, [0, 3.1, -0.1]));
    for (const z of [-0.8, 0.9]) s.add(mk(rbox(8.4, 0.05, 0.22, 0.02, 1), toon(P.butter, { emissive: 0x5a5030 }), [0, 3.02, z]));
    const ads: [number, (g: CanvasRenderingContext2D, w: number, h: number) => void][] = [
      [WINS[0], (g, w, h) => ad(g, w, h, '#bfe3ff', '🌊 Sweet Sea Beach', 'shells · waves · peach ade')],
      [WINS[1], (g, w, h) => ad(g, w, h, '#ffd6e0', '♡ Hamin Hearts ♡', 'collect them all~')],
      [WINS[2], (g, w, h) => ad(g, w, h, '#e9ddff', '🐑 Counting sheep?', 'ride the Sweet Line!')],
    ];
    for (const [cx, draw] of ads) {
      const p = poster(1.7, 0.5, draw, 256);
      p.position.set(cx, 2.66, WALL_Z + 0.01);
      this.scene.add(p);
    }
    // end walls with gangway doors
    for (const sx of [-1, 1]) {
      s.add(mk(rbox(0.2, 3.15, 3.7, 0.05), cream, [sx * 4.8, 1.55, -0.1]));
      // gangway door (light version of the world door)
      const x = sx * 4.68;
      s.add(mk(rbox(0.12, 2.5, 1.5, 0.08, 1), P.white, [x, 1.25, -0.1]));
      s.add(mk(rbox(0.12, 2.3, 1.24, 0.1, 1), P.mintDeep, [x - sx * 0.04, 1.18, -0.1]));
      s.add(mk(rbox(0.1, 0.6, 0.6, 0.12, 1), toon(0xdff1ff, { emissive: 0x223344 }), [x - sx * 0.08, 1.75, -0.1]));
      s.add(mk(sphere(0.06, 6, 4), P.butterDeep, [x - sx * 0.12, 1.1, 0.35]));
    }
    // grab rail + poles
    s.add(mk(cyl(0.035, 0.035, 9.2, 8), P.metal, [0, 2.62, 0.5], [0, 0, PI / 2]));
    for (const x of [-1.9, 1.9]) s.add(mk(cyl(0.04, 0.04, 3.1, 8), P.metal, [x, 1.55, 0.95]));
    // swinging straps (their own merged mesh so they can sway together)
    const sg = new THREE.Group();
    for (let x = -4; x <= 4.01; x += 0.8) {
      sg.add(mk(STRAP, P.white, [x, -0.16, 0]));
      sg.add(mk(torus(0.09, 0.024, 4, 12), P.pinkDeep, [x, -0.37, 0]));
    }
    const sb = new StaticBatcher();
    sb.addObject(sg);
    const strapMesh = sb.build('straps');
    if (strapMesh) this.straps.add(strapMesh);
    this.straps.position.set(0, 2.62, 0.5);
    this.addDynamic(this.straps);
    // box seats + little window tables
    for (let i = 0; i < WINS.length; i++) {
      const cx = WINS[i];
      for (const sx of [-1, 1]) {
        s.add(mk(rbox(0.78, 0.32, 1.12, 0.06, 1), P.white, [cx + sx * 0.8, 0.16, SEAT_Z]));
        s.add(mk(rbox(0.8, 0.2, 1.12, 0.09, 1), P.pink, [cx + sx * 0.8, 0.42, SEAT_Z]));
        s.add(mk(rbox(0.18, 1.0, 1.12, 0.08, 1), P.pink, [cx + sx * 1.22, 0.95, SEAT_Z]));
        s.add(mk(rbox(0.22, 0.12, 1.16, 0.05, 1), P.white, [cx + sx * 1.22, 1.47, SEAT_Z]));
      }
      s.add(mk(rbox(0.56, 0.06, 0.42, 0.03, 1), P.white, [cx, 0.8, WALL_Z + 0.22]));
      s.add(mk(cyl(0.04, 0.04, 0.8, 8), P.metal, [cx, 0.4, WALL_Z + 0.22]));
    }
    // peach ade + snack on Hamin's table
    const tx = HAMIN_WIN, tz = WALL_Z + 0.22;
    for (const [dx, c] of [[-0.12, P.peachDeep], [0.12, P.mintDeep]] as const) {
      s.add(mk(cyl(0.07, 0.06, 0.18, 10), c, [tx + dx, 0.92, tz]));
      s.add(mk(cyl(0.012, 0.012, 0.18, 5), P.pinkDeep, [tx + dx + 0.02, 1.04, tz], [0, 0, 0.3]));
    }
    // sheep passengers: the left one wears a tiny sheep hat ♡
    loads.push(this.sheepPassenger(WINS[0], -1, true), this.sheepPassenger(WINS[2], 1, false));
  }

  /**
   * A sheep passenger on the window seat at cx + side·0.8, its back against the seat back and facing the table:
   * Higgsfield sheep_sit (≈4k tris) that rides the car's bob and sways/breathes (transforms only);
   * the procedural sheepBlob, merged into the car, as a fallback.
   */
  private async sheepPassenger(cx: number, side: -1 | 1, hat: boolean) {
    try {
      const m = await critter('sheep_sit', { h: PASSENGER_H });
      const d = new THREE.Box3().setFromObject(m).getSize(new V()).z;
      const x = cx + side * (1.13 - d / 2 - 0.03); // seat back's inner face at cx ± 1.13
      const face = -side * PI / 2;
      m.position.set(x, SEAT_TOP, SEAT_Z);
      m.rotation.y = face;
      if (hat) m.add(mk(cone(0.14, 0.24, 8), P.butter, [0, PASSENGER_H + 0.08, 0.02], [-0.12, 0, 0]));
      this.addDynamic(m);
      this.passengers.push({ o: m, face, ph: side > 0 ? 1.7 : 0 });
    } catch (e) {
      console.warn('sheep_sit failed, using the procedural passenger', e);
      const c = sheepBlob(0.95);
      c.position.set(cx + side * 0.8, 0.82, SEAT_Z);
      c.rotation.y = side < 0 ? 0 : PI;
      this.add(c);
      if (hat) this.statics.add(mk(cone(0.14, 0.24, 8), P.butter, [cx + side * 0.85, 1.32, SEAT_Z]));
    }
  }

  // ------------------------------------------------------------------ outside world (parallax layers)
  private buildWorld() {
    // the sea: a big static plane under everything
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(420, 160), toon(P.sea));
    sea.rotation.x = -PI / 2;
    sea.position.set(0, -1.35, -84);
    sea.receiveShadow = false;
    sea.userData.noShadow = true;
    this.addDynamic(sea);
    const horizon = new THREE.Mesh(new THREE.PlaneGeometry(420, 1.2), toon(P.seaDeep));
    horizon.position.set(0, -1.1, -150);
    horizon.userData.noShadow = true;
    this.addDynamic(horizon);

    // ---- far: soft pastel hills + a lighthouse island (slow) ----
    const far = new THREE.Group();
    const farHills: [number, number, number, number][] = [[4, 10, 1, P.lavender], [14, 13, 0.8, P.pink], [26, 9, 1.1, P.mint], [38, 12, 0.9, P.lavender], [52, 10, 1, P.pink], [-4, 7, 1.2, P.mintDeep]];
    for (const [sx, r, sy, c] of farHills) far.add(mk(dome(r, 14, 4), c, [sx, -1.3, -58 - (sx % 3) * 3], [0, 0, 0], [1, 0.42 * sy, 0.6]));
    // lighthouse island
    far.add(mk(dome(3, 14, 4), P.sand, [-24, -1.3, -46], [0, 0, 0], [1, 0.3, 0.8]));
    far.add(mk(cyl(0.55, 0.75, 3.6, 12), P.white, [-24, 1.2, -46]));
    far.add(mk(cyl(0.58, 0.62, 0.6, 12), P.strawberry, [-24, 0.6, -46]));
    far.add(mk(cyl(0.6, 0.62, 0.5, 12), P.strawberry, [-24, 2.0, -46]));
    far.add(mk(sphere(0.5, 10, 8), toon(P.butter, { emissive: 0x665522 }), [-24, 3.25, -46]));
    far.add(mk(cone(0.7, 0.7, 12), P.strawberry, [-24, 3.9, -46]));
    this.addLayer(far, 1.1);

    // ---- sky: sheep clouds (very slow) ----
    const sky = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const c = sheepBlob(1.8 + (i % 3) * 0.5, 0xffffff);
      c.position.set(-30 + i * 12, 7 + (i % 2) * 3, -45 - (i % 3) * 6);
      sky.add(c);
    }
    this.addLayer(sky, 0.5);

    // ---- mid: countryside (houses, trees, sheep), then the beach ----
    const mid = new THREE.Group();
    mid.add(mk(rbox(58, 0.7, 20, 0.3), P.grass, [5, -1.05, -18]));
    mid.add(mk(rbox(8.5, 0.5, 20, 0.25), P.sand, [-28.5, -1.2, -18]));
    for (const [sx, sz, r, c] of [[-14, -22, 3.5, P.grassDeep], [-2, -24, 4.5, P.mint], [10, -21, 3, P.grassDeep], [22, -25, 5, P.mint], [30, -20, 3, P.grassDeep], [-20, -26, 3.2, P.mint]] as const)
      mid.add(mk(dome(r, 16, 5), c, [sx, -0.8, sz], [0, 0, 0], [1, 0.5, 0.8]));
    const roofs = [P.strawberry, P.blueDeep, P.pinkDeep, P.lavenderDeep, P.peachDeep];
    const walls = [P.cream, P.butter, P.white, P.pinkSoft, P.blueSoft];
    [-19, -11, -5, 3, 9, 17, 25].forEach((sx, i) => {
      const z = -11.5 - (i % 3) * 1.6;
      mid.add(mk(rbox(1.3, 1.0, 1.1, 0.12, 1), walls[i % 5], [sx, -0.2, z]));
      mid.add(mk(cone(1.05, 0.8, 4), roofs[i % 5], [sx, 0.7, z], [0, PI / 4, 0], [1, 1, 0.85]));
      mid.add(mk(rbox(0.3, 0.45, 0.05, 0.05, 1), P.woodDeep, [sx, -0.45, z + 0.56]));
      mid.add(mk(rbox(0.3, 0.3, 0.05, 0.05, 1), toon(0xdff1ff, { emissive: 0x334455 }), [sx + 0.38, 0, z + 0.56]));
    });
    [-22, -16, -8, -1, 6, 13, 20, 28].forEach((sx, i) => {
      const z = -10 - (i % 2) * 3.5;
      mid.add(mk(cyl(0.12, 0.16, 0.9, 6), P.woodDeep, [sx, -0.3, z]));
      mid.add(mk(sphere(0.65, 8, 6), i % 3 ? P.mintDeep : P.pink, [sx, 0.55, z]));
    });
    for (const [sx, sz] of [[-2.5, -9.5], [-1.2, -10.6], [0.8, -9.8], [15, -10.5], [16.3, -9.6]]) {
      mid.add(mk(sphere(0.34, 8, 6), P.white, [sx, -0.35, sz]));
      for (let k = 0; k < 4; k++) mid.add(mk(sphere(0.17, 6, 4), P.white, [sx + Math.cos(k * 1.6) * 0.26, -0.26, sz + Math.sin(k * 1.6) * 0.2]));
      mid.add(mk(sphere(0.18, 8, 6), P.skin, [sx - 0.36, -0.28, sz + 0.05]));
    }
    // beach umbrella + a little boat near the shore
    mid.add(mk(cyl(0.05, 0.05, 1.6, 6), P.white, [-27, -0.2, -12]));
    mid.add(mk(cone(1.1, 0.5, 10), P.strawberry, [-27, 0.8, -12]));
    mid.add(mk(rbox(1.6, 0.4, 0.6, 0.15, 1), P.white, [-36, -1.15, -14]));
    mid.add(mk(cone(0.6, 1.3, 3), P.pink, [-36, -0.25, -14]));
    this.addLayer(mid, 5);

    // ---- near: poles and bushes whizzing by, then a sea wall ----
    const near = new THREE.Group();
    near.add(mk(rbox(86, 0.4, 5, 0.15), P.grassDeep, [-23, -1.0, -4.8]));
    near.add(mk(rbox(58, 0.5, 2.2, 0.15), P.white, [-95, -0.95, -3.6]));
    near.add(mk(rbox(58, 0.35, 0.9, 0.12), P.sand, [-95, -1.05, -5.2]));
    for (let sx = -120; sx <= 18; sx += 7) {
      near.add(mk(cyl(0.09, 0.11, 3.8, 6), P.white, [sx, 0.9, -3.4]));
      near.add(mk(STRAP, P.white, [sx + 0.4, 2.7, -3.4], [0, 0, PI / 2], [1.6, 3.2, 3]));
    }
    for (let sx = -64; sx <= 18; sx += 2.6) {
      const k = Math.abs(Math.sin(sx * 1.7));
      near.add(mk(sphere(0.6 + k * 0.5, 7, 5), k > 0.7 ? P.pink : P.mintDeep, [sx, -0.55 + k * 0.3, -5.6 - k * 1.2]));
    }
    for (let sx = -122; sx <= -66; sx += 1.4) near.add(mk(cyl(0.06, 0.06, 0.8, 6), P.white, [sx, -0.3, -4.4]));
    near.add(mk(rbox(56, 0.1, 0.1, 0.04, 1), P.pinkDeep, [-94, 0.1, -4.4]));
    this.addLayer(near, 11);

    // ---- sea sparkles (under the land until the land has passed) ----
    const waves = new THREE.Group();
    for (let i = 0; i < 26; i++) {
      const sx = -60 + (i * 37) % 90, sz = -9 - ((i * 13) % 40);
      waves.add(mk(capsule(0.08, 1.2 + (i % 3) * 0.5, 2, 6), toon(0xffffff, { emissive: 0x333a44 }), [sx, -1.32, sz], [0, 0, PI / 2], [1, 1, 0.4]));
    }
    this.addLayer(waves, 2.2);
  }

  /** Merge a layer into one mesh (1 draw call) and keep it movable. */
  private addLayer(g: THREE.Group, speed: number) {
    g.traverse((o) => (o.userData.dynamic = false));
    const b = new StaticBatcher();
    b.addObject(g);
    const m = b.build('layer');
    const root = new THREE.Group();
    if (m) {
      m.castShadow = false;
      m.receiveShadow = false;
      m.userData.noShadow = true;
      root.add(m);
    }
    root.add(g); // leftovers (none expected)
    this.addDynamic(root);
    this.layers.push({ root, speed });
  }
}

function ad(g: CanvasRenderingContext2D, w: number, h: number, bg: string, title: string, sub: string) {
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  g.fillStyle = bg;
  g.fillRect(5, 5, w - 10, h - 10);
  g.textAlign = 'center';
  g.fillStyle = '#364049';
  g.font = '900 22px Nunito, sans-serif';
  g.fillText(title, w / 2, h * 0.5);
  g.font = '700 13px Nunito, sans-serif';
  g.fillStyle = '#8A99A8';
  g.fillText(sub, w / 2, h * 0.82);
}

