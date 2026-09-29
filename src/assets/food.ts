// Chunky, glossy, oversized toy food (ART_BIBLE FOOD_STYLE). Every builder returns a Group with its base on
// y = 0, centred on the origin, "front" facing +Z and about 0.35–0.5 units wide.
// `matte: true` builds the same food with the batchable vinyl material (for static room decoration).
import * as THREE from 'three';
import { cone, cyl, mk, rbox, sphere, torus, V3 } from './geo';
import { glossy, toon, vertexColorToon } from './materials';
import { P } from './palette';
import { StaticBatcher } from '../core/StaticBatcher';
import { critter, type CritterId } from './landmarks';

const PI = Math.PI;

export interface FoodOpts { matte?: boolean }
type M = (c: number) => THREE.Material;

export interface FoodDef {
  id: string;
  name: string;
  emoji: string;
  /** reaction kaomoji when Hamin eats it */
  yum: string;
  build: (o?: FoodOpts) => THREE.Group;
  /** crumb colours sprinkled when it is bitten (eating game juice) */
  crumbs?: number[];
}

const matOf = (o?: FoodOpts): M => (o?.matte ? (c) => toon(c) : (c) => glossy(c));

// ------------------------------------------------------------------ shared shapes
const extCache = new Map<string, THREE.BufferGeometry>();
function shared(key: string, make: () => THREE.BufferGeometry) {
  let g = extCache.get(key);
  if (!g) {
    g = make();
    g.userData.shared = true;
    extCache.set(key, g);
  }
  return g;
}

/** Rounded cake wedge (sector) extruded upward, tip at the origin pointing −Z. */
function wedge(r: number, h: number, ang = 0.9) {
  return shared(`wedge${r},${h},${ang}`, () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.absarc(0, 0, r, PI / 2 - ang / 2, PI / 2 + ang / 2, false);
    s.lineTo(0, 0);
    const bev = Math.min(0.025, h * 0.3);
    const g = new THREE.ExtrudeGeometry(s, { depth: h - bev * 2, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 2, curveSegments: 8 });
    g.rotateX(-PI / 2); // extrude along +Y, shape's +Y → −Z
    g.translate(0, bev, 0);
    g.computeVertexNormals();
    return g;
  });
}

/** Soft rounded triangle (onigiri) standing up, facing +Z. */
function roundTri(s: number, depth: number) {
  return shared(`tri${s},${depth}`, () => {
    const sh = new THREE.Shape();
    const r = s * 0.28;
    const pts: [number, number][] = [];
    for (let i = 0; i < 3; i++) {
      const a = PI / 2 + (i * PI * 2) / 3;
      pts.push([Math.cos(a) * s, Math.sin(a) * s]);
    }
    for (let i = 0; i < 3; i++) {
      const [x, y] = pts[i];
      const cx = x * (1 - r / s), cy = y * (1 - r / s);
      const a0 = PI / 2 + (i * PI * 2) / 3 - PI / 3;
      if (i === 0) sh.moveTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
      sh.absarc(cx, cy, r, a0, a0 + (PI * 2) / 3, false);
    }
    const bev = depth * 0.35;
    const g = new THREE.ExtrudeGeometry(sh, { depth: depth - bev * 2, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 3, curveSegments: 6 });
    g.center();
    g.computeVertexNormals();
    return g;
  });
}

/** Tiny sticker face: two glossy eyes, blush and a smile arc. `z` = front surface. */
function face(g: THREE.Group, m: M, y: number, z: number, s = 1, mouth: 'smile' | 'o' = 'smile') {
  const f = new THREE.Group();
  f.position.set(0, y, z);
  f.scale.setScalar(s);
  f.add(mk(sphere(0.022, 7, 5), m(P.ink), [-0.055, 0.02, 0], [0, 0, 0], [1, 1.25, 0.6]));
  f.add(mk(sphere(0.022, 7, 5), m(P.ink), [0.055, 0.02, 0], [0, 0, 0], [1, 1.25, 0.6]));
  f.add(mk(sphere(0.008, 4, 3), m(P.white), [-0.05, 0.03, 0.013]));
  f.add(mk(sphere(0.008, 4, 3), m(P.white), [0.06, 0.03, 0.013]));
  f.add(mk(sphere(0.026, 6, 4), m(P.blush), [-0.095, -0.015, -0.004], [0, 0, 0], [1.2, 0.7, 0.4]));
  f.add(mk(sphere(0.026, 6, 4), m(P.blush), [0.095, -0.015, -0.004], [0, 0, 0], [1.2, 0.7, 0.4]));
  if (mouth === 'smile') f.add(mk(torus(0.022, 0.007, 4, 8, PI), m(P.ink), [0, -0.012, 0.002], [0, 0, PI]));
  else f.add(mk(sphere(0.014, 6, 5), m(P.strawberryDeep), [0, -0.02, 0.002], [0, 0, 0], [1, 1.2, 0.5]));
  g.add(f);
  return f;
}

function strawberry(g: THREE.Group, m: M, pos: V3, s = 1) {
  const b = new THREE.Group();
  b.position.set(pos[0], pos[1], pos[2]);
  b.scale.setScalar(s);
  b.add(mk(sphere(0.06, 10, 8), m(P.strawberry), [0, 0.05, 0], [0, 0, 0], [1, 1.15, 1]));
  b.add(mk(cone(0.058, 0.07, 10), m(P.strawberry), [0, 0.0, 0], [PI, 0, 0]));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2;
    b.add(mk(sphere(0.025, 6, 4), m(P.mintDeep), [Math.cos(a) * 0.025, 0.115, Math.sin(a) * 0.025], [0, -a, 0.6], [1.4, 0.4, 0.8]));
  }
  for (const [x, y, z] of [[0.03, 0.07, 0.05], [-0.035, 0.04, 0.05], [0.0, 0.02, 0.055]] as const)
    b.add(mk(sphere(0.007, 4, 3), m(P.butter), [x, y, z]));
  g.add(b);
  return b;
}

// ------------------------------------------------------------------ foods
export function dumpling(o?: FoodOpts) {
  const m = matOf(o);
  const g = new THREE.Group();
  g.add(mk(sphere(0.2, 14, 9), m(P.cream), [0, 0.1, 0], [0, 0, 0], [1.2, 0.72, 0.95]));
  // crimped ridge
  for (let i = 0; i < 7; i++) {
    const x = -0.18 + i * 0.06;
    const y = 0.21 + Math.sin((i / 6) * PI) * 0.04;
    g.add(mk(sphere(0.045, 8, 6), m(0xfff9ef), [x, y, -0.02], [0, 0, (i - 3) * -0.15], [0.8, 1.1, 0.7]));
  }
  face(g, m, 0.1, 0.185, 1);
  return g;
}

export function noodleBowl(o?: FoodOpts) {
  const m = matOf(o);
  const g = new THREE.Group();
  g.add(mk(cyl(0.27, 0.16, 0.2, 20), m(P.blue), [0, 0.12, 0]));
  g.add(mk(cyl(0.12, 0.14, 0.03, 16), m(P.blueDeep), [0, 0.015, 0]));
  g.add(mk(torus(0.265, 0.025, 6, 22), m(P.white), [0, 0.22, 0], [PI / 2, 0, 0]));
  g.add(mk(cyl(0.25, 0.25, 0.02, 20), m(P.peach), [0, 0.2, 0]));
  // noodles
  for (const [x, z, r] of [[-0.06, 0.02, 0.09], [0.05, -0.05, 0.08], [0.02, 0.07, 0.07], [-0.1, -0.08, 0.06]] as const)
    g.add(mk(torus(r, 0.018, 5, 14), m(P.butter), [x, 0.22, z], [PI / 2, 0, 0]));
  // egg
  g.add(mk(sphere(0.07, 12, 8), m(P.white), [0.12, 0.23, 0.07], [0, 0, 0], [1, 0.45, 1.25]));
  g.add(mk(sphere(0.035, 10, 6), m(P.butterDeep), [0.12, 0.25, 0.07], [0, 0, 0], [1, 0.5, 1]));
  // naruto
  g.add(mk(cyl(0.055, 0.055, 0.025, 14), m(P.white), [-0.12, 0.225, 0.08], [0.2, 0, 0]));
  g.add(mk(torus(0.03, 0.009, 4, 12), m(P.pinkDeep), [-0.12, 0.24, 0.083], [PI / 2 + 0.2, 0, 0]));
  // scallion bits
  for (const [x, z] of [[0.0, 0.14], [0.08, -0.12], [-0.05, -0.13], [0.16, -0.04]] as const)
    g.add(mk(cyl(0.018, 0.018, 0.015, 8), m(P.mintDeep), [x, 0.225, z]));
  // chopsticks
  g.add(mk(cyl(0.012, 0.009, 0.5, 6), m(P.woodDeep), [0.02, 0.26, -0.1], [0.1, 0, PI / 2 - 0.25]));
  g.add(mk(cyl(0.012, 0.009, 0.5, 6), m(P.woodDeep), [0.02, 0.27, -0.14], [0.1, 0, PI / 2 - 0.18]));
  return g;
}

export function riceBall(o?: FoodOpts) {
  const m = matOf(o);
  const g = new THREE.Group();
  g.add(mk(roundTri(0.2, 0.15), m(P.white), [0, 0.17, 0]));
  g.add(mk(rbox(0.19, 0.12, 0.17, 0.03, 1), m(0x5a6b72), [0, 0.07, 0]));
  // sesame seeds
  for (const [x, y] of [[-0.08, 0.26], [0.07, 0.22], [0.0, 0.3], [-0.03, 0.2]] as const)
    g.add(mk(sphere(0.01, 4, 3), m(P.woodDeep), [x, y, 0.07], [0, 0, 0.6], [1, 1.7, 1]));
  face(g, m, 0.17, 0.078, 0.95);
  return g;
}

export function drumstick(o?: FoodOpts) {
  const m = matOf(o);
  const g = new THREE.Group();
  const d = new THREE.Group();
  d.add(mk(sphere(0.15, 12, 8), m(0xf4b27a), [0, 0, 0], [0, 0, 0], [1, 1.25, 0.95]));
  d.add(mk(sphere(0.08, 10, 8), m(0xf8c690), [-0.05, 0.07, 0.1], [0, 0, 0], [1, 1, 0.6]));
  d.add(mk(cyl(0.035, 0.035, 0.18, 8), m(P.cream), [0, 0.22, 0]));
  d.add(mk(sphere(0.042, 8, 6), m(P.white), [-0.03, 0.32, 0]));
  d.add(mk(sphere(0.042, 8, 6), m(P.white), [0.03, 0.32, 0]));
  // little paper frill
  d.add(mk(cyl(0.05, 0.04, 0.05, 10), m(P.pink), [0, 0.2, 0]));
  d.position.set(0, 0.15, 0);
  d.rotation.z = -0.9;
  g.add(d);
  return g;
}

function cakeSlice(o: FoodOpts | undefined, gold: boolean) {
  const m: M = gold ? (c) => toon(c, { rough: 0.25, emissive: 0x3a2600 }) : matOf(o);
  const g = new THREE.Group();
  const R = 0.34;
  const sponge = gold ? 0xffe28a : P.butter;
  const cream = gold ? 0xfff4c4 : P.pinkSoft;
  const jam = gold ? 0xffc94d : P.strawberry;
  const top = gold ? 0xfff0b0 : P.white;
  const inner = new THREE.Group();
  inner.add(mk(wedge(R, 0.08), m(sponge), [0, 0.0, 0]));
  inner.add(mk(wedge(R * 0.98, 0.03), m(jam), [0, 0.075, 0]));
  inner.add(mk(wedge(R * 0.99, 0.035), m(cream), [0, 0.1, 0]));
  inner.add(mk(wedge(R, 0.08), m(sponge), [0, 0.13, 0]));
  inner.add(mk(wedge(R * 1.01, 0.05), m(top), [0, 0.2, 0]));
  // cream dollops along the back arc
  for (let i = 0; i < 3; i++) {
    const a = PI / 2 + (i - 1) * 0.28;
    inner.add(mk(sphere(0.04, 8, 6), m(top), [Math.cos(a) * R * 0.85, 0.265, -Math.sin(a) * R * 0.85], [0, 0, 0], [1, 0.8, 1]));
  }
  strawberry(inner, m, [0, 0.27, -R * 0.62], gold ? 1.2 : 1.1);
  if (gold) {
    // sparkly star topper
    const st = new THREE.Group();
    st.position.set(0.08, 0.42, -R * 0.55);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2;
      st.add(mk(cone(0.03, 0.08, 4), m(0xffd24a), [Math.sin(a) * 0.04, Math.cos(a) * 0.04, 0], [0, 0, -a]));
    }
    st.add(mk(sphere(0.04, 8, 6), m(0xffe07a), [0, 0, 0]));
    inner.add(st);
  }
  // tip toward the viewer so the layers show
  inner.rotation.y = PI;
  inner.position.z = -R * 0.45;
  g.add(inner);
  return g;
}
export const cake = (o?: FoodOpts) => cakeSlice(o, false);
export const goldenCake = (o?: FoodOpts) => cakeSlice(o, true);

export function milkCarton(o?: FoodOpts) {
  const m = matOf(o);
  const g = new THREE.Group();
  g.add(mk(rbox(0.22, 0.28, 0.22, 0.04, 1), m(P.pink), [0, 0.14, 0]));
  // gable roof
  g.add(mk(rbox(0.16, 0.16, 0.22, 0.03, 1), m(P.pinkSoft), [0, 0.28, 0], [0, 0, PI / 4], [1, 1, 0.98]));
  g.add(mk(rbox(0.04, 0.05, 0.2, 0.015, 1), m(P.pinkSoft), [0, 0.39, 0]));
  // label
  g.add(mk(rbox(0.18, 0.13, 0.02, 0.01, 1), m(P.white), [0, 0.14, 0.11]));
  strawberry(g, m, [0, 0.12, 0.13], 0.6);
  // straw
  g.add(mk(cyl(0.012, 0.012, 0.2, 6), m(P.lavender), [0.07, 0.42, 0.05], [0, 0, -0.2]));
  return g;
}

export function iceCream(o?: FoodOpts) {
  const m = matOf(o);
  const g = new THREE.Group();
  g.add(mk(cone(0.11, 0.3, 12), m(P.butterDeep), [0, 0.15, 0], [PI, 0, 0]));
  for (let i = 0; i < 3; i++) g.add(mk(torus(0.1 - i * 0.03, 0.008, 4, 12), m(P.woodDeep), [0, 0.26 - i * 0.07, 0], [PI / 2, 0, 0]));
  g.add(mk(sphere(0.12, 12, 8), m(P.mint), [0, 0.35, 0]));
  g.add(mk(sphere(0.11, 12, 8), m(P.pink), [0, 0.5, 0]));
  // drips
  for (const [x, z] of [[0.08, 0.06], [-0.07, 0.08]] as const) g.add(mk(sphere(0.03, 6, 5), m(P.mint), [x, 0.29, z], [0, 0, 0], [1, 1.6, 1]));
  g.add(mk(sphere(0.035, 8, 6), m(P.strawberry), [0.02, 0.62, 0]));
  g.add(mk(cyl(0.004, 0.004, 0.06, 4), m(P.mintDeep), [0.03, 0.67, 0], [0, 0, -0.4]));
  // sprinkles
  for (const [x, y, z, c] of [[0.05, 0.55, 0.08, P.blue], [-0.06, 0.52, 0.07, P.butter], [0.0, 0.58, 0.09, P.lavenderDeep], [0.08, 0.48, 0.03, P.mintDeep]] as const)
    g.add(mk(cyl(0.008, 0.008, 0.03, 4), m(c), [x, y, z], [0.4, 0, 0.8]));
  face(g, m, 0.5, 0.1, 0.8);
  return g;
}

export function peach(o?: FoodOpts) {
  const m = matOf(o);
  const g = new THREE.Group();
  g.add(mk(sphere(0.17, 14, 9), m(P.peachDeep), [-0.035, 0.17, 0], [0, 0, 0], [0.8, 1, 0.95]));
  g.add(mk(sphere(0.17, 14, 9), m(0xffc8a8), [0.035, 0.17, 0], [0, 0, 0], [0.8, 1, 0.95]));
  g.add(mk(sphere(0.06, 8, 6), m(P.pink), [0.02, 0.25, 0.1], [0, 0, 0], [1, 1, 0.4]));
  g.add(mk(cyl(0.012, 0.015, 0.06, 6), m(P.woodDeep), [0, 0.35, 0]));
  g.add(mk(sphere(0.06, 8, 6), m(P.mintDeep), [0.06, 0.36, 0], [0, 0, -0.5], [1.4, 0.35, 0.7]));
  return g;
}

export function apple(o?: FoodOpts) {
  const m = matOf(o);
  const g = new THREE.Group();
  g.add(mk(sphere(0.17, 14, 9), m(P.strawberry), [0, 0.16, 0], [0, 0, 0], [1, 0.92, 1]));
  g.add(mk(sphere(0.05, 8, 6), m(0xffb0c0), [-0.06, 0.24, 0.11], [0, 0, 0], [1, 1, 0.4]));
  g.add(mk(cyl(0.012, 0.015, 0.08, 6), m(P.woodDeep), [0, 0.32, 0], [0, 0, 0.2]));
  g.add(mk(sphere(0.055, 8, 6), m(P.mintDeep), [-0.05, 0.33, 0], [0, 0, 0.5], [1.4, 0.35, 0.7]));
  face(g, m, 0.15, 0.165, 0.9);
  return g;
}

export function lunchbox(o?: FoodOpts) {
  const m = matOf(o);
  const g = new THREE.Group();
  g.add(mk(rbox(0.48, 0.13, 0.34, 0.05, 1), m(P.pink), [0, 0.065, 0]));
  g.add(mk(rbox(0.44, 0.03, 0.3, 0.012, 1), m(P.white), [0, 0.12, 0]));
  g.add(mk(rbox(0.02, 0.05, 0.3, 0.008, 1), m(P.pinkSoft), [0.02, 0.14, 0]));
  // rice + tiny heart
  g.add(mk(rbox(0.2, 0.05, 0.26, 0.025, 1), m(P.white), [-0.11, 0.155, 0]));
  g.add(mk(sphere(0.022, 8, 6), m(P.strawberry), [-0.11, 0.185, 0.02]));
  // tamagoyaki
  for (const z of [-0.07, 0.0]) g.add(mk(rbox(0.09, 0.06, 0.06, 0.02, 1), m(P.butter), [0.08, 0.165, z]));
  // octopus sausage
  g.add(mk(sphere(0.04, 10, 8), m(P.strawberry), [0.17, 0.18, 0.07], [0, 0, 0], [1, 1.1, 1]));
  // broccoli
  for (const [x, z] of [[0.08, 0.09], [0.12, 0.1]] as const) g.add(mk(sphere(0.03, 8, 6), m(P.mintDeep), [x, 0.18, z]));
  // lid leaning behind
  g.add(mk(rbox(0.48, 0.05, 0.34, 0.025, 1), m(P.lavender), [0, 0.2, -0.22], [-1.2, 0, 0]));
  return g;
}

/** Hanami dango: pink / white / mint mochi balls on a skewer, the middle one smiling. */
export function dango(o?: FoodOpts) {
  const m = matOf(o);
  const g = new THREE.Group();
  const d = new THREE.Group();
  d.add(mk(cyl(0.013, 0.011, 0.6, 6), m(P.woodDeep), [0, 0.3, 0]));
  const cols = [P.mintDeep, P.white, P.pink];
  cols.forEach((c, i) => d.add(mk(sphere(0.088, 12, 9), m(c), [0, 0.14 + i * 0.155, 0], [0, 0, 0], [1, 0.94, 0.95])));
  face(d, m, 0.29, 0.083, 0.72);
  d.rotation.z = -0.12;
  g.add(d);
  return g;
}

/** Wobbly custard pudding (purin) with caramel top, cream and a cherry. */
export function pudding(o?: FoodOpts) {
  const m = matOf(o);
  const g = new THREE.Group();
  g.add(mk(cyl(0.23, 0.21, 0.03, 20), m(P.white), [0, 0.015, 0]));
  g.add(mk(cyl(0.135, 0.17, 0.2, 20), m(P.butter), [0, 0.13, 0]));
  g.add(mk(cyl(0.136, 0.14, 0.045, 20), m(0xe8a462), [0, 0.245, 0]));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2 + 0.3;
    g.add(mk(sphere(0.026, 6, 5), m(0xe8a462), [Math.cos(a) * 0.14, 0.215, Math.sin(a) * 0.14], [0, 0, 0], [1, 1.7, 1]));
  }
  g.add(mk(sphere(0.065, 10, 8), m(P.white), [0, 0.29, 0], [0, 0, 0], [1, 0.75, 1]));
  g.add(mk(sphere(0.036, 8, 6), m(P.strawberry), [0.01, 0.345, 0]));
  g.add(mk(cyl(0.004, 0.004, 0.06, 4), m(P.mintDeep), [0.02, 0.39, 0], [0, 0, -0.4]));
  face(g, m, 0.12, 0.158, 0.85);
  return g;
}

/** Upright ring donut with pink icing and sprinkles, facing the viewer. */
export function donut(o?: FoodOpts) {
  const m = matOf(o);
  const g = new THREE.Group();
  const d = new THREE.Group();
  d.position.y = 0.2;
  d.add(mk(torus(0.12, 0.078, 10, 22), m(0xf2c28a)));
  d.add(mk(torus(0.12, 0.074, 8, 22), m(P.pink), [0, 0.004, 0.032], [0, 0, 0], [1, 1, 0.8]));
  const sc = [P.blue, P.butter, P.mintDeep, P.white, P.lavenderDeep];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * PI * 2 + 0.2;
    const rr = 0.12 + (i % 2 ? 0.035 : -0.03);
    d.add(mk(cyl(0.008, 0.008, 0.035, 4), m(sc[i % sc.length]), [Math.cos(a) * rr, Math.sin(a) * rr, 0.09], [0.3, 0, a + 0.9]));
  }
  g.add(d);
  return g;
}

/** "Don't eat me!" spicy pepper: a curly red chili with fiery little brows and a flame on its head. */
export function spicyPepper(o?: FoodOpts) {
  const m = matOf(o);
  const g = new THREE.Group();
  const red = 0xff5f73;
  const pts: [number, number, number][] = [
    [-0.13, 0.145, 0.13], [-0.05, 0.14, 0.125], [0.03, 0.125, 0.11], [0.1, 0.105, 0.088], [0.16, 0.095, 0.064], [0.2, 0.11, 0.045], [0.225, 0.145, 0.03],
  ];
  for (const [x, y, r] of pts) g.add(mk(sphere(r, 12, 9), m(red), [x, y, 0], [0, 0, 0], [1, 1, 0.9]));
  // stem cap
  g.add(mk(sphere(0.075, 10, 8), m(P.mintDeep), [-0.225, 0.16, 0], [0, 0, 0.3], [0.55, 1.1, 1.05]));
  g.add(mk(cyl(0.018, 0.022, 0.1, 6), m(0x6fc49f), [-0.275, 0.2, 0], [0, 0, 1.0]));
  face(g, m, 0.13, 0.108, 0.85, 'o');
  // fiery brows
  g.add(mk(rbox(0.05, 0.014, 0.012, 0.005, 1), m(P.ink), [-0.047, 0.178, 0.1], [0, 0, -0.45]));
  g.add(mk(rbox(0.05, 0.014, 0.012, 0.005, 1), m(P.ink), [0.047, 0.178, 0.1], [0, 0, 0.45]));
  // little flame
  g.add(mk(cone(0.05, 0.13, 8), m(0xffa24d), [0.02, 0.33, 0]));
  g.add(mk(cone(0.028, 0.075, 8), m(P.butter), [0.02, 0.315, 0.025]));
  g.add(mk(cone(0.03, 0.08, 8), m(0xffa24d), [0.09, 0.28, 0], [0, 0, -0.4]));
  return g;
}

/** Five-point puffy star. */
function starGeo(R: number, r: number, depth: number) {
  return shared(`star${R},${r},${depth}`, () => {
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = PI / 2 + (i * PI) / 5;
      const rr = i % 2 ? r : R;
      if (i === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    sh.closePath();
    const bev = depth * 0.42;
    const g = new THREE.ExtrudeGeometry(sh, { depth: depth - bev * 2, bevelEnabled: true, bevelSize: bev * 0.9, bevelThickness: bev, bevelSegments: 3, curveSegments: 4 });
    g.center();
    g.computeVertexNormals();
    return g;
  });
}

/** Star candy: a glowing golden puffy star with a sleepy smile (starts Yummy Fever). */
export function starCandy(o?: FoodOpts) {
  const m: M = o?.matte ? (c) => toon(c) : (c) => toon(c, { rough: 0.25, emissive: 0x3a2600 });
  const g = new THREE.Group();
  g.add(mk(starGeo(0.2, 0.1, 0.11), m(0xffd24a), [0, 0.23, 0]));
  g.add(mk(sphere(0.025, 6, 5), m(P.white), [-0.07, 0.3, 0.06], [0, 0, 0.5], [1.4, 0.8, 0.4]));
  face(g, m, 0.215, 0.058, 0.72);
  return g;
}

/**
 * Procedural tiny sheep kitchen helper ("don't eat me!"): the FALLBACK for the Higgsfield sheep (see sheepHelper).
 * userData.legs = the 4 leg meshes for walking, userData.body = wool + head group.
 */
export function tinySheep(o?: FoodOpts & { hat?: boolean }) {
  const m: M = o?.matte ? (c) => toon(c) : (c) => toon(c);
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.name = 'body';
  g.add(body);
  body.add(mk(sphere(0.14, 12, 9), m(P.white), [0, 0.2, 0], [0, 0, 0], [1, 0.9, 1.1]));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * PI * 2;
    body.add(mk(sphere(0.07, 8, 6), m(P.white), [Math.cos(a) * 0.11, 0.24 + Math.sin(i * 1.7) * 0.02, Math.sin(a) * 0.12]));
  }
  body.add(mk(sphere(0.07, 8, 6), m(P.white), [0, 0.33, -0.02]));
  const head = new THREE.Group();
  head.position.set(0, 0.25, 0.15);
  head.add(mk(sphere(0.085, 12, 9), m(P.skin), [0, 0, 0], [0, 0, 0], [1, 0.92, 0.9]));
  head.add(mk(sphere(0.05, 8, 6), m(P.white), [0, 0.07, -0.01]));
  for (const sx of [-1, 1]) head.add(mk(sphere(0.035, 6, 5), m(P.skin), [sx * 0.085, 0.02, -0.01], [0, 0, sx * -0.5], [1.5, 0.55, 0.8]));
  head.add(mk(sphere(0.013, 6, 4), m(P.ink), [-0.03, 0.01, 0.072]));
  head.add(mk(sphere(0.013, 6, 4), m(P.ink), [0.03, 0.01, 0.072]));
  head.add(mk(sphere(0.015, 6, 4), m(P.blush), [-0.052, -0.02, 0.06]));
  head.add(mk(sphere(0.015, 6, 4), m(P.blush), [0.052, -0.02, 0.06]));
  if (o?.hat !== false) {
    head.add(mk(cyl(0.05, 0.05, 0.04, 10), m(P.white), [0, 0.1, -0.01]));
    head.add(mk(sphere(0.06, 8, 6), m(P.white), [0, 0.15, -0.01], [0, 0, 0], [1, 0.7, 1]));
  }
  body.add(head);
  const legs: THREE.Mesh[] = [];
  for (const [x, z] of [[-0.06, 0.07], [0.06, 0.07], [-0.06, -0.07], [0.06, -0.07]] as const) {
    const l = mk(cyl(0.022, 0.018, 0.12, 6), m(P.skin), [x, 0.06, z]);
    legs.push(l);
    g.add(l);
  }
  g.userData.legs = legs;
  g.userData.body = body;
  return g;
}

// ------------------------------------------------------------------ registry
export const FOOD: FoodDef[] = [
  { id: 'dumpling', name: 'Smiley Dumpling', emoji: '🥟', yum: '(๑´ڡ`๑) ♡', build: dumpling, crumbs: [P.cream, 0xfff9ef, P.peach] },
  { id: 'noodles', name: 'Noodle Bowl', emoji: '🍜', yum: 'slurp~ ♡', build: noodleBowl, crumbs: [P.butter, P.peach, P.mintDeep, P.white] },
  { id: 'riceball', name: 'Rice Ball', emoji: '🍙', yum: '(〃´～`〃) nom', build: riceBall, crumbs: [P.white, P.white, 0x5a6b72] },
  { id: 'drumstick', name: 'Chicken Drumstick', emoji: '🍗', yum: '(*´ω`*) crunchy!', build: drumstick, crumbs: [0xf4b27a, 0xf8c690, P.butterDeep] },
  { id: 'cake', name: 'Strawberry Cake', emoji: '🍰', yum: '(っ˘ڡ˘ς) ♡', build: cake, crumbs: [P.butter, P.pinkSoft, P.strawberry, P.white] },
  { id: 'milk', name: 'Strawberry Milk', emoji: '🍓', yum: 'glug glug ♡', build: milkCarton, crumbs: [P.pink, P.white, P.pinkSoft] },
  { id: 'icecream', name: 'Ice Cream', emoji: '🍦', yum: 'brr~ sweet! ♡', build: iceCream, crumbs: [P.mint, P.pink, P.butterDeep] },
  { id: 'peach', name: 'Peach', emoji: '🍑', yum: '(´,,•ω•,,) ♡', build: peach, crumbs: [P.peachDeep, 0xffc8a8, P.pink] },
  { id: 'apple', name: 'Apple', emoji: '🍎', yum: 'crunch! ♡', build: apple, crumbs: [P.strawberry, P.cream, 0xfff3d6] },
  { id: 'lunchbox', name: 'Dosirak', emoji: '🍱', yum: '(๑>ڡ<๑) best!', build: lunchbox, crumbs: [P.white, P.butter, P.strawberry, P.mintDeep] },
  { id: 'dango', name: 'Hanami Dango', emoji: '🍡', yum: 'mochi mochi~ ♡', build: dango, crumbs: [P.pink, P.white, P.mintDeep] },
  { id: 'pudding', name: 'Custard Pudding', emoji: '🍮', yum: 'purun purun~ ♡', build: pudding, crumbs: [P.butter, 0xe8a462, P.white] },
  { id: 'donut', name: 'Sprinkle Donut', emoji: '🍩', yum: '(〃ω〃) sweet~', build: donut, crumbs: [0xf2c28a, P.pink, P.blue, P.butter] },
];

export const GOLDEN_CAKE: FoodDef = { id: 'golden', name: 'Golden Strawberry Cake', emoji: '✨🍰', yum: '✧٩(ˊωˋ*)و✧ SO GOOD!', build: goldenCake, crumbs: [0xffe28a, 0xffd24a, P.white] };
export const SHEEP_HELPER: FoodDef = { id: 'sheep', name: 'Tiny Sheep Helper', emoji: '🐑', yum: 'Baa?!', build: (o) => tinySheep(o) };
/** Eating-game specials: skip the pepper, the star candy starts Yummy Fever. */
export const SPICY_PEPPER: FoodDef = { id: 'pepper', name: 'Spicy Pepper', emoji: '🌶️', yum: '🥵 Spicy!!', build: spicyPepper, crumbs: [0xff5f73, 0xffa24d, P.butter] };
export const STAR_CANDY: FoodDef = { id: 'star', name: 'Star Candy', emoji: '⭐', yum: '✧*。 sparkly! ♡', build: starCandy, crumbs: [0xffd24a, P.butter, P.white] };

export const foodById = (id: string) => [...FOOD, GOLDEN_CAKE, SHEEP_HELPER, SPICY_PEPPER, STAR_CANDY].find((f) => f.id === id);

// ------------------------------------------------------------------ baking (1 draw call per food)

let glossyVC: THREE.MeshStandardMaterial | null = null;
/** Shared glossy vertex-colour material for baked food. */
export function glossyVertexMat() {
  if (!glossyVC) {
    glossyVC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0 });
    glossyVC.userData.shared = true;
  }
  return glossyVC;
}

/** Bake every mesh under `root` (in root space) into ONE glossy vertex-coloured mesh. */
export function bakeGroup(root: THREE.Object3D, glossyFinish = true): THREE.Mesh {
  const b = new StaticBatcher();
  b.shade = false;
  const inv = new THREE.Matrix4();
  root.updateMatrixWorld(true);
  inv.copy(root.matrixWorld).invert();
  const m = new THREE.Matrix4();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    m.multiplyMatrices(inv, mesh.matrixWorld);
    b.addGeometry(mesh.geometry, mat.color, m, mat.emissive);
  });
  const out = b.build('baked') ?? new THREE.Mesh();
  out.matrixAutoUpdate = true;
  if (glossyFinish) out.material = glossyVertexMat();
  return out;
}

const bakedCache = new Map<string, THREE.BufferGeometry>();
/** A single-mesh glossy copy of a food (geometry cached & shared across scenes). */
export function bakedFood(def: FoodDef): THREE.Mesh {
  let geo = bakedCache.get(def.id);
  if (!geo) {
    geo = bakeGroup(def.build()).geometry;
    geo.userData.shared = true;
    bakedCache.set(def.id, geo);
  }
  const mesh = new THREE.Mesh(geo, glossyVertexMat());
  mesh.castShadow = true;
  mesh.userData.food = def.id;
  return mesh;
}

let sheepBodyGeo: THREE.BufferGeometry | null = null;
/** Procedural tiny sheep with its wool/head baked into one mesh (legs stay separate so they can walk). Fallback. */
export function bakedSheep(): THREE.Group {
  const g = tinySheep();
  const body = g.userData.body as THREE.Group;
  if (!sheepBodyGeo) {
    sheepBodyGeo = bakeGroup(body, false).geometry;
    sheepBodyGeo.userData.shared = true;
  }
  body.clear();
  const m = new THREE.Mesh(sheepBodyGeo, vertexColorToon());
  m.castShadow = true;
  body.add(m);
  return g;
}

// ------------------------------------------------------------------ Higgsfield sheep (with procedural fallback)

/** Fit of a model sheep that stands in for tinySheep() at scale 1 (the procedural one is ≈ 0.42 tall incl. hat). */
export const SHEEP_FIT = { h: 0.42 };

/** Preloaded, normalised sheep models (base y = 0, centred, front +Z, SHEEP_FIT). */
const sheepTpl = new Map<CritterId, THREE.Group>();
const sheepLoads = new Map<CritterId, Promise<boolean>>();

/**
 * Load a sheep model once so sheepHelper() can build it synchronously. Resolves false (never rejects)
 * when the model fails to load: sheepHelper() then falls back to the procedural bakedSheep().
 */
export function preloadSheep(id: CritterId = 'sheep_lo'): Promise<boolean> {
  let p = sheepLoads.get(id);
  if (!p) {
    p = critter(id, SHEEP_FIT).then(
      (g) => (sheepTpl.set(id, g), true),
      (e) => {
        console.warn('sheep model failed, using the procedural sheep', id, e);
        sheepLoads.delete(id); // allow a retry later
        return false;
      },
    );
    sheepLoads.set(id, p);
  }
  return p;
}

/** True once preloadSheep(id) has succeeded (sheepHelper(id) returns the Higgsfield model). */
export const sheepModelReady = (id: CritterId = 'sheep_lo') => sheepTpl.has(id);

/**
 * A walking sheep helper, synchronously: a clone of the preloaded Higgsfield model, or the procedural
 * bakedSheep() when the model is not (yet) loaded. Same contract either way: base on y = 0, faces +Z,
 * ≈ 0.42 tall at scale 1, userData.body = the part to bob / squash, userData.legs = leg meshes
 * (empty for the model, which waddles instead: see sheepWalk), userData.model = true for the model.
 * Geometry & material of the model are shared (userData.shared): never dispose them.
 */
export function sheepHelper(id: CritterId = 'sheep_lo'): THREE.Group {
  const tpl = sheepTpl.get(id);
  if (!tpl) return bakedSheep();
  const g = new THREE.Group();
  const body = tpl.clone(true);
  body.name = 'body';
  g.add(body);
  g.userData.legs = [];
  g.userData.body = body;
  g.userData.model = true;
  return g;
}

/**
 * Walk cycle for a sheep from sheepHelper() / tinySheep() / bakedSheep(). `w` = walk phase (radians, one step per
 * half turn), `moving` = walking or standing, `t` = seconds (idle bounce). The procedural sheep swings its legs; the
 * rigid Higgsfield model waddles (side-to-side roll + a little yaw), hops each step and squashes & stretches.
 */
export function sheepWalk(g: THREE.Object3D, w: number, moving = true, t = 0) {
  const body = g.userData.body as THREE.Object3D | undefined;
  if (!body) return;
  const legs = (g.userData.legs as THREE.Mesh[] | undefined) ?? [];
  if (!g.userData.model) {
    legs.forEach((l, i) => (l.rotation.x = moving ? Math.sin(w + (i % 2 ? PI : 0) + (i > 1 ? PI : 0)) * 0.6 : 0));
    body.position.y = moving ? Math.abs(Math.sin(w)) * 0.03 : Math.max(0, Math.sin(t * 5)) * 0.015;
    return;
  }
  if (moving) {
    const s = Math.sin(w);
    const hop = Math.abs(s); // 0 = foot down, 1 = top of the hop
    body.position.y = hop * 0.035;
    body.rotation.z = s * 0.13; // lean onto the stepping side
    body.rotation.y = s * 0.08;
    const k = 2 * hop - 1; // -1 squash on landing … +1 stretch in the air
    body.scale.set(1 - k * 0.04, 1 + k * 0.06, 1 - k * 0.04);
  } else {
    // standing: a happy little bounce now and then
    const b = Math.max(0, Math.sin(t * 5));
    body.position.y = b * 0.015;
    body.rotation.set(0, 0, 0);
    body.scale.set(1 - b * 0.02, 1 + b * 0.04, 1 - b * 0.02);
  }
}
