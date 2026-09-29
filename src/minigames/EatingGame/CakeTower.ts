// 🎂 Cake Tower — the giant layered finale cake of the Eating Game.
// Each tier is baked into its own single mesh (one draw call per tier) so layers can be nibbled away
// from the top down. The tower jiggles on every bite and eaten tiers pop off toward Hamin.
import * as THREE from 'three';
import { bakeGroup, glossyVertexMat } from '../../assets/food';
import { cone, cyl, mk, sphere, torus } from '../../assets/geo';
import { glossy } from '../../assets/materials';
import { P } from '../../assets/palette';

const PI = Math.PI;

interface TierDef { r: number; h: number; sponge: number; cream: number; deco: number; hp: number }

/** bottom → top */
const TIERS: TierDef[] = [
  { r: 0.46, h: 0.16, sponge: P.pink, cream: P.white, deco: P.strawberry, hp: 6 },
  { r: 0.38, h: 0.15, sponge: P.butter, cream: P.pinkSoft, deco: P.mintDeep, hp: 5 },
  { r: 0.3, h: 0.14, sponge: P.mint, cream: P.white, deco: P.pinkDeep, hp: 5 },
  { r: 0.23, h: 0.13, sponge: P.lavender, cream: P.white, deco: P.butterDeep, hp: 4 },
  { r: 0.16, h: 0.12, sponge: P.pinkSoft, cream: P.white, deco: P.strawberry, hp: 3 },
];
export const TOWER_TIERS = TIERS.length;

const geoCache = new Map<string, THREE.BufferGeometry>();
function baked(key: string, make: () => THREE.Group) {
  let g = geoCache.get(key);
  if (!g) {
    g = bakeGroup(make()).geometry;
    g.userData.shared = true;
    geoCache.set(key, g);
  }
  const m = new THREE.Mesh(g, glossyVertexMat());
  m.castShadow = true;
  return m;
}

function buildTier(d: TierDef, top: boolean) {
  const g = new THREE.Group();
  const m = glossy;
  const { r, h } = d;
  g.add(mk(cyl(r, r * 0.98, h * 0.8, 28), m(d.sponge), [0, h * 0.4, 0]));
  // jam / cream stripe
  g.add(mk(cyl(r * 1.012, r * 1.012, h * 0.13, 28), m(d.cream), [0, h * 0.36, 0]));
  // frosting cap + drips
  g.add(mk(cyl(r * 1.035, r * 1.035, h * 0.24, 28), m(d.cream), [0, h * 0.86, 0]));
  const drips = Math.round(r * 34);
  for (let i = 0; i < drips; i++) {
    const a = (i / drips) * PI * 2 + 0.2;
    const len = 1.3 + ((i * 7) % 5) * 0.25;
    g.add(mk(sphere(0.028, 6, 5), m(d.cream), [Math.cos(a) * r * 1.02, h * 0.72, Math.sin(a) * r * 1.02], [0, 0, 0], [1, len, 0.8]));
  }
  // deco ring on the top edge: strawberries & cream dollops
  const n = Math.max(5, Math.round(r * 22));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2;
    const rr = r * 0.82;
    if (i % 2) g.add(mk(sphere(0.034, 8, 6), m(d.cream), [Math.cos(a) * rr, h + 0.02, Math.sin(a) * rr], [0, 0, 0], [1, 0.8, 1]));
    else g.add(mk(sphere(0.032, 8, 6), m(d.deco), [Math.cos(a) * rr, h + 0.025, Math.sin(a) * rr], [0, 0, 0], [1, 1.15, 1]));
  }
  if (top) {
    // big strawberry + a heart candle
    g.add(mk(sphere(0.07, 12, 9), m(P.strawberry), [-0.03, h + 0.07, 0.02], [0, 0, 0], [1, 1.1, 1]));
    g.add(mk(cone(0.066, 0.07, 10), m(P.strawberry), [-0.03, h + 0.02, 0.02], [PI, 0, 0]));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2;
      g.add(mk(sphere(0.028, 6, 4), m(P.mintDeep), [-0.03 + Math.cos(a) * 0.03, h + 0.14, 0.02 + Math.sin(a) * 0.03], [0, -a, 0.6], [1.4, 0.4, 0.8]));
    }
    g.add(mk(cyl(0.018, 0.018, 0.16, 8), m(P.blue), [0.07, h + 0.08, -0.03]));
    g.add(mk(torus(0.018, 0.006, 4, 8), m(P.white), [0.07, h + 0.06, -0.03], [PI / 2, 0, 0]));
    g.add(mk(torus(0.018, 0.006, 4, 8), m(P.white), [0.07, h + 0.11, -0.03], [PI / 2, 0, 0]));
    g.add(mk(cone(0.026, 0.07, 8), m(0xffb347), [0.07, h + 0.2, -0.03]));
    g.add(mk(cone(0.014, 0.04, 8), m(P.butter), [0.07, h + 0.19, -0.018]));
  }
  return g;
}

function buildPlate() {
  const g = new THREE.Group();
  g.add(mk(cyl(0.56, 0.5, 0.04, 32), glossy(P.white), [0, 0.02, 0]));
  g.add(mk(torus(0.54, 0.018, 5, 32), glossy(P.pinkSoft), [0, 0.04, 0], [PI / 2, 0, 0]));
  return g;
}

interface Tier {
  mesh: THREE.Mesh;
  def: TierDef;
  hp: number;
  y: number;
  state: 'on' | 'fly' | 'gone';
  t: number;
  from: THREE.Vector3;
  jolt: number;
}

export interface BiteResult {
  /** world position of the bite (top of the tier being eaten) */
  pos: THREE.Vector3;
  colors: number[];
  cleared: boolean;
  done: boolean;
  /** index (0 = bottom) of the tier that was bitten */
  tier: number;
}

export class CakeTower {
  readonly group = new THREE.Group();
  private body = new THREE.Group();
  private tiers: Tier[] = [];
  private wob = 0;
  private wobV = 0;
  private side = 1;
  /** where cleared tiers fly to (world) */
  target = new THREE.Vector3();

  constructor() {
    this.group.name = 'cake-tower';
    this.group.add(this.body);
    const plate = baked('plate', buildPlate);
    this.body.add(plate);
    let y = 0.04;
    TIERS.forEach((d, i) => {
      const mesh = baked('tier' + i, () => buildTier(d, i === TIERS.length - 1));
      mesh.position.y = y;
      this.body.add(mesh);
      this.tiers.push({ mesh, def: d, hp: d.hp, y, state: 'on', t: 0, from: new THREE.Vector3(), jolt: 0 });
      y += d.h + 0.005;
    });
  }

  /** index of the top-most uneaten tier, −1 when the whole tower is gone */
  get top() {
    for (let i = this.tiers.length - 1; i >= 0; i--) if (this.tiers[i].state === 'on') return i;
    return -1;
  }
  get eaten() { return this.tiers.filter((t) => t.state !== 'on').length; }
  get total() { return this.tiers.length; }

  /** Take one bite out of the top tier. */
  bite(): BiteResult | null {
    const i = this.top;
    if (i < 0) return null;
    const t = this.tiers[i];
    t.hp--;
    t.jolt = 1;
    this.wobV += 5.5;
    this.side = -this.side;
    const pos = new THREE.Vector3((Math.random() - 0.5) * t.def.r * 0.9, t.y + t.def.h + 0.02, t.def.r * 0.6);
    this.body.localToWorld(pos);
    const colors = [t.def.sponge, t.def.cream, t.def.deco];
    let cleared = false;
    if (t.hp <= 0) {
      cleared = true;
      t.state = 'fly';
      t.t = 0;
      t.from.copy(t.mesh.position);
      this.wobV += 4;
    }
    return { pos, colors, cleared, done: this.top < 0, tier: i };
  }

  update(dt: number, time: number) {
    // jelly wobble spring
    this.wobV += (-140 * this.wob - 9 * this.wobV) * dt;
    this.wob += this.wobV * dt;
    const w = this.wob;
    this.body.scale.set(1 + w * 0.05, 1 - w * 0.07, 1 + w * 0.05);
    this.body.rotation.z = w * 0.035 * this.side;
    const localTarget = this.body.worldToLocal(this.target.clone());
    for (const t of this.tiers) {
      if (t.state === 'on') {
        // shrink as it is nibbled + a squashy jolt per bite
        t.jolt = Math.max(0, t.jolt - dt * 6);
        const left = 0.55 + 0.45 * (t.hp / t.def.hp);
        const j = Math.sin(t.jolt * PI) * 0.12;
        t.mesh.scale.set(left * (1 + j), 1 - j * 0.8, left * (1 + j));
        t.mesh.rotation.y = Math.sin(time * 1.5 + t.y * 10) * 0.05;
      } else if (t.state === 'fly') {
        t.t += dt / 0.45;
        const k = Math.min(1, t.t);
        t.mesh.position.lerpVectors(t.from, localTarget, k * k);
        t.mesh.position.y += Math.sin(k * PI) * 0.5;
        const s = (k < 0.2 ? 0.55 + k * 2.5 : 1.05 * (1 - k)) + 0.001;
        t.mesh.scale.setScalar(s);
        t.mesh.rotation.y += dt * 9;
        if (k >= 1) {
          t.state = 'gone';
          t.mesh.visible = false;
        }
      }
    }
  }
}
