// Procedural, batch-friendly models for the Dog Chase course.
// Everything is baked into single vertex-coloured geometries so each obstacle TYPE is one
// InstancedMesh (1 draw call) and each ground tile is one mesh.
// The sheep characters are Higgsfield models (loadSheepAssets); the procedural sheep stay as fallbacks.
import * as THREE from 'three';
import { StaticBatcher } from '../../core/StaticBatcher';
import { mk, rbox, sphere, cyl, cone, torus } from '../../assets/geo';
import { toon, vertexColorToon } from '../../assets/materials';
import { P } from '../../assets/palette';
import { heartShape, sign } from '../../assets/props';
import { critter, critterGeometry, loadGlb, normalise } from '../../assets/landmarks';
import { rng } from '../../utils/math';

const PI = Math.PI;

/** Cheap sharp box (for flat stripes / paving details only — big shapes stay rounded). */
const boxCache = new Map<string, THREE.BufferGeometry>();
function flat(w: number, h: number, d: number) {
  const k = `${w},${h},${d}`;
  let g = boxCache.get(k);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    g.userData.shared = true;
    boxCache.set(k, g);
  }
  return g;
}

/** Bake every toon mesh under `root` (root assumed at the origin) into one geometry. */
export function bakeGeo(root: THREE.Object3D, shade = true): THREE.BufferGeometry {
  const own: THREE.BufferGeometry[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.geometry.userData.shared) own.push(m.geometry);
  });
  const b = new StaticBatcher();
  b.shade = shade;
  b.addObject(root);
  const mesh = b.build('dc-bake');
  for (const g of own) g.dispose();
  if (!mesh) return new THREE.BufferGeometry();
  return mesh.geometry;
}

const G = (...c: THREE.Object3D[]) => {
  const g = new THREE.Group();
  for (const o of c) g.add(o);
  return g;
};

// ------------------------------------------------------------------ obstacles
// All built centred on x=0, z=0 with the base at y=0, "front" facing +Z (towards the runner/camera).

export function benchModel() {
  const g = new THREE.Group();
  const c = P.pink;
  g.add(mk(rbox(1.35, 0.12, 0.5, 0.05), c, [0, 0.46, 0]));
  g.add(mk(rbox(1.35, 0.4, 0.1, 0.05), c, [0, 0.78, -0.22]));
  g.add(mk(rbox(1.2, 0.06, 0.06, 0.02), P.white, [0, 0.9, -0.16]));
  for (const sx of [-1, 1]) g.add(mk(rbox(0.1, 0.46, 0.46, 0.04), P.metal, [sx * 0.52, 0.23, 0]));
  // a sheep plush someone forgot on the bench
  g.add(mk(sphere(0.13, 10, 8), P.white, [0.3, 0.64, 0.02]));
  g.add(mk(sphere(0.08, 8, 6), P.skin, [0.3, 0.66, 0.13]));
  return bakeGeo(g);
}

export function boxModel() {
  const g = new THREE.Group();
  const kraft = 0xf3d2a8;
  g.add(mk(rbox(0.82, 0.62, 0.72, 0.07), kraft, [0, 0.31, 0]));
  g.add(mk(flat(0.84, 0.03, 0.16), P.butter, [0, 0.62, 0]));
  g.add(mk(flat(0.16, 0.5, 0.02), P.butter, [0, 0.35, 0.37]));
  // flaps
  g.add(mk(rbox(0.8, 0.04, 0.3, 0.02), 0xeec596, [0, 0.66, 0.2], [-0.5, 0, 0]));
  g.add(mk(rbox(0.8, 0.04, 0.3, 0.02), 0xeec596, [0, 0.66, -0.2], [0.5, 0, 0]));
  // a heart sticker on the front
  const h = heartShape(P.strawberry, 0.2);
  h.position.set(-0.22, 0.34, 0.37);
  g.add(h);
  return bakeGeo(g);
}

export function bikeModel() {
  // lying across the lane (wheels in the XY plane) so it reads as a road block
  const g = new THREE.Group();
  const frame = P.blueDeep;
  for (const sx of [-1, 1]) {
    g.add(mk(torus(0.34, 0.06, 6, 18), P.ink, [sx * 0.52, 0.4, 0]));
    g.add(mk(torus(0.26, 0.025, 4, 14), P.white, [sx * 0.52, 0.4, 0.01]));
    g.add(mk(sphere(0.06, 8, 6), P.metal, [sx * 0.52, 0.4, 0]));
  }
  const bar = (x1: number, y1: number, x2: number, y2: number) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    g.add(mk(cyl(0.045, 0.045, len, 8), frame, [(x1 + x2) / 2, (y1 + y2) / 2, 0], [0, 0, Math.atan2(x1 - x2, y2 - y1)]));
  };
  bar(-0.52, 0.4, 0, 0.42);
  bar(0, 0.42, 0.42, 0.82);
  bar(-0.52, 0.4, -0.12, 0.82);
  bar(-0.12, 0.82, 0.42, 0.82);
  bar(0, 0.42, -0.14, 0.86);
  bar(0.52, 0.4, 0.42, 0.9);
  g.add(mk(rbox(0.3, 0.07, 0.16, 0.03), P.pinkDeep, [-0.16, 0.9, 0]));
  g.add(mk(cyl(0.03, 0.03, 0.46, 8), P.metal, [0.42, 0.94, 0], [PI / 2, 0, 0]));
  // basket with flowers
  g.add(mk(cyl(0.2, 0.16, 0.22, 12), P.wood, [0.62, 0.86, 0]));
  for (const [x, z, c] of [[0.56, 0.05, P.pink], [0.68, -0.05, P.butter], [0.62, 0.08, P.lavenderDeep]] as const)
    g.add(mk(sphere(0.08, 8, 6), c, [x, 1.0, z]));
  return bakeGeo(g);
}

export function potModel() {
  const g = new THREE.Group();
  g.add(mk(cyl(0.36, 0.28, 0.56, 14), P.peachDeep, [0, 0.28, 0]));
  g.add(mk(torus(0.35, 0.06, 6, 16), P.peachDeep, [0, 0.56, 0], [PI / 2, 0, 0]));
  g.add(mk(cyl(0.33, 0.33, 0.04, 14), 0xc9a27a, [0, 0.55, 0]));
  for (const [x, z, c] of [[0, 0, P.pinkDeep], [-0.16, 0.1, P.butter], [0.16, -0.06, P.lavenderDeep], [0.1, 0.16, P.pink]] as const) {
    g.add(mk(cyl(0.02, 0.02, 0.28, 5), P.mintDeep, [x, 0.7, z]));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2;
      g.add(mk(sphere(0.055, 6, 5), c, [x + Math.cos(a) * 0.06, 0.86, z + Math.sin(a) * 0.06]));
    }
    g.add(mk(sphere(0.04, 6, 5), P.butterDeep, [x, 0.87, z]));
  }
  for (const [x, z] of [[-0.2, -0.1], [0.22, 0.12], [0, -0.2]]) g.add(mk(sphere(0.1, 8, 6), P.mintDeep, [x, 0.64, z], [0, 0, 0], [1, 0.6, 1]));
  return bakeGeo(g);
}

export function puddleModel() {
  const g = new THREE.Group();
  g.add(mk(cyl(0.78, 0.78, 0.03, 22), 0xa9dcf6, [0, 0.025, 0], [0, 0, 0], [1, 1, 0.8]));
  g.add(mk(cyl(0.55, 0.55, 0.035, 18), 0xc9ecfb, [-0.12, 0.03, 0.05], [0, 0, 0], [1, 1, 0.7]));
  g.add(mk(torus(0.3, 0.02, 4, 16), P.white, [0.25, 0.05, -0.1], [PI / 2, 0, 0], [1, 0.8, 1]));
  // little rubber duck floating in it
  g.add(mk(sphere(0.12, 10, 8), P.butter, [0.3, 0.1, 0.12], [0, 0, 0], [1.2, 0.8, 1]));
  g.add(mk(sphere(0.08, 10, 8), P.butter, [0.4, 0.2, 0.14]));
  g.add(mk(cone(0.04, 0.06, 6), P.peachDeep, [0.48, 0.2, 0.14], [0, 0, -PI / 2]));
  g.add(mk(sphere(0.015, 5, 4), P.ink, [0.43, 0.23, 0.2]));
  return bakeGeo(g, false);
}

export function signModel() {
  // A-frame "sheep crossing" sandwich board (tall: dodge it)
  const g = new THREE.Group();
  for (const sz of [-1, 1]) {
    const board = new THREE.Group();
    board.position.set(0, 0, sz * 0.2);
    board.rotation.x = sz * 0.2;
    board.add(mk(rbox(1.0, 1.35, 0.08, 0.04), P.butter, [0, 0.68, 0]));
    board.add(mk(rbox(0.84, 1.15, 0.03, 0.03), P.white, [0, 0.72, sz * 0.045]));
    // painted sheep face
    board.add(mk(sphere(0.2, 10, 8), P.white, [0, 0.9, sz * 0.06], [0, 0, 0], [1.3, 1, 0.3]));
    board.add(mk(sphere(0.13, 10, 8), P.skin, [0, 0.84, sz * 0.09], [0, 0, 0], [1, 0.9, 0.3]));
    board.add(mk(sphere(0.025, 5, 4), P.ink, [-0.05, 0.86, sz * 0.13]));
    board.add(mk(sphere(0.025, 5, 4), P.ink, [0.05, 0.86, sz * 0.13]));
    board.add(mk(flat(0.66, 0.1, 0.03), P.strawberry, [0, 0.42, sz * 0.06]));
    board.add(mk(flat(0.5, 0.06, 0.03), P.pinkDeep, [0, 0.28, sz * 0.06]));
    g.add(board);
  }
  g.add(mk(rbox(1.04, 0.1, 0.16, 0.04), P.strawberryDeep, [0, 1.38, 0]));
  return bakeGeo(g);
}

export function bagModel() {
  const g = new THREE.Group();
  g.add(mk(rbox(0.66, 0.66, 0.4, 0.16), P.lavenderDeep, [0, 0.33, 0]));
  g.add(mk(rbox(0.5, 0.26, 0.1, 0.06), P.pink, [0, 0.24, 0.2]));
  g.add(mk(torus(0.17, 0.035, 6, 12, PI), P.pink, [0, 0.66, 0]));
  g.add(mk(sphere(0.05, 8, 6), P.butter, [0, 0.33, 0.26]));
  // keychain charm: tiny sheep
  g.add(mk(sphere(0.07, 8, 6), P.white, [0.24, 0.5, 0.22]));
  g.add(mk(sphere(0.045, 8, 6), P.skin, [0.24, 0.5, 0.29]));
  // lunch box next to it
  g.add(mk(rbox(0.3, 0.2, 0.26, 0.06), P.mint, [-0.34, 0.1, 0.12]));
  g.add(mk(flat(0.32, 0.03, 0.06), P.white, [-0.34, 0.18, 0.12]));
  return bakeGeo(g);
}

/**
 * Bunting banner arch over ONE lane (lane width 1.7). The cloth hangs down to ~1.1 m:
 * Hamin has to SLIDE under it. White "V" chevrons + pennants point down to telegraph it.
 */
export function bannerModel() {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    g.add(mk(cyl(0.055, 0.065, 2.36, 8), P.white, [sx * 0.8, 1.18, 0]));
    for (const y of [0.45, 0.95]) g.add(mk(torus(0.065, 0.024, 4, 10), P.pinkDeep, [sx * 0.8, y, 0], [PI / 2, 0, 0]));
    g.add(mk(sphere(0.12, 10, 8), P.butter, [sx * 0.8, 2.43, 0]));
    g.add(mk(rbox(0.3, 0.06, 0.3, 0.02), P.white, [sx * 0.8, 0.03, 0]));
  }
  g.add(mk(cyl(0.035, 0.035, 1.62, 8), P.white, [0, 2.24, 0], [0, 0, PI / 2]));
  // cloth + stripe + scalloped hem
  g.add(mk(rbox(1.52, 0.62, 0.06, 0.03), P.pinkSoft, [0, 1.78, 0]));
  g.add(mk(flat(1.52, 0.09, 0.07), P.strawberry, [0, 2.06, 0]));
  for (let i = 0; i < 6; i++) g.add(mk(sphere(0.13, 7, 4), P.pinkSoft, [-0.63 + i * 0.252, 1.48, 0], [0, 0, 0], [1, 0.7, 0.35]));
  // "go under" chevrons (white V shapes) + a heart
  for (const cx of [-0.46, 0.46]) {
    for (const [dx, y] of [[0, 1.86], [0, 1.68]] as const) {
      g.add(mk(flat(0.2, 0.06, 0.03), P.white, [cx - 0.065 + dx, y, 0.045], [0, 0, -0.75]));
      g.add(mk(flat(0.2, 0.06, 0.03), P.white, [cx + 0.065 + dx, y, 0.045], [0, 0, 0.75]));
    }
  }
  const h = heartShape(P.strawberry, 0.3);
  h.position.set(0, 1.78, 0.05);
  g.add(h);
  // pennant string just under the hem
  g.add(mk(cyl(0.012, 0.012, 1.58, 4), P.white, [0, 1.36, 0.02], [0, 0, PI / 2]));
  const pc = [P.butter, P.blue, P.pinkDeep, P.mint, P.lavenderDeep, P.butter, P.blue];
  for (let i = 0; i < 7; i++) g.add(mk(cone(0.085, 0.2, 3), pc[i], [-0.66 + i * 0.22, 1.25, 0.02], [PI, 0, 0]));
  return bakeGeo(g);
}

/** Toy hurdle with a striped bar — low, clearly "hop over me". */
export function hurdleModel() {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    g.add(mk(rbox(0.1, 0.62, 0.1, 0.03), P.white, [sx * 0.62, 0.31, 0]));
    g.add(mk(rbox(0.12, 0.05, 0.46, 0.02), P.white, [sx * 0.62, 0.025, 0]));
    g.add(mk(sphere(0.075, 8, 6), P.butterDeep, [sx * 0.62, 0.66, 0]));
  }
  g.add(mk(rbox(1.28, 0.15, 0.08, 0.03), P.white, [0, 0.5, 0]));
  for (let i = 0; i < 3; i++) g.add(mk(flat(0.21, 0.155, 0.09), P.strawberry, [-0.525 + i * 0.42, 0.5, 0]));
  g.add(mk(rbox(1.2, 0.05, 0.05, 0.02), P.butter, [0, 0.28, 0]));
  const h = heartShape(P.pinkDeep, 0.16);
  h.position.set(0, 0.5, 0.05);
  g.add(h);
  return bakeGeo(g);
}

/** Bakery cart with a big umbrella (tall: change lanes). */
export function cartModel() {
  const g = new THREE.Group();
  g.add(mk(rbox(1.25, 0.8, 0.7, 0.12), P.cream, [0, 0.72, 0]));
  g.add(mk(flat(1.27, 0.14, 0.72), P.pinkDeep, [0, 0.9, 0]));
  g.add(mk(rbox(1.36, 0.08, 0.8, 0.03), P.white, [0, 1.15, 0]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(mk(torus(0.17, 0.06, 6, 14), P.blueDeep, [sx * 0.42, 0.22, sz * 0.37]));
    g.add(mk(sphere(0.05, 6, 4), P.white, [sx * 0.42, 0.22, sz * 0.37]));
  }
  for (const [x, c] of [[-0.38, P.pink], [0, P.butter], [0.38, P.lavender]] as const) {
    g.add(mk(cyl(0.12, 0.09, 0.14, 10), P.peachDeep, [x, 1.26, 0.1]));
    g.add(mk(sphere(0.13, 10, 8), c, [x, 1.38, 0.1], [0, 0, 0], [1, 0.8, 1]));
    g.add(mk(sphere(0.04, 6, 4), P.strawberry, [x, 1.5, 0.1]));
  }
  g.add(mk(cyl(0.03, 0.03, 1.3, 6), P.white, [0.5, 1.8, -0.2]));
  g.add(mk(cone(0.95, 0.42, 10), P.pink, [0.5, 2.55, -0.2]));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * PI * 2;
    g.add(mk(sphere(0.13, 8, 6), i % 2 ? P.white : P.pinkDeep, [0.5 + Math.cos(a) * 0.9, 2.34, -0.2 + Math.sin(a) * 0.9], [0, 0, 0], [1, 0.6, 1]));
  }
  g.add(mk(sphere(0.1, 8, 6), P.strawberry, [0.5, 2.8, -0.2]));
  return bakeGeo(g);
}

/** Big fluffy sheep to ride on (faces +X), with a little pink saddle and a flower. */
export function rideSheepModel() {
  const s = sheepModel();
  s.add(mk(rbox(0.36, 0.07, 0.4, 0.03), P.pinkDeep, [-0.02, 0.86, 0]));
  s.add(mk(rbox(0.3, 0.05, 0.44, 0.02), P.white, [-0.02, 0.83, 0]));
  s.add(mk(sphere(0.06, 8, 6), P.butter, [0.36, 0.88, 0.08]));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2;
    s.add(mk(sphere(0.045, 6, 4), P.pinkDeep, [0.36 + Math.cos(a) * 0.06, 0.88, 0.08 + Math.sin(a) * 0.06]));
  }
  return bakeGeo(s);
}

/** Tiny sheep, facing +X (walking direction). */
export function sheepModel(hat = false) {
  const g = new THREE.Group();
  const w = P.white;
  g.add(mk(sphere(0.3, 12, 10), w, [0, 0.52, 0], [0, 0, 0], [1.2, 0.95, 1]));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * PI * 2;
    g.add(mk(sphere(0.14, 8, 6), w, [Math.cos(a) * 0.28, 0.58 + Math.sin(a * 3) * 0.05, Math.sin(a) * 0.22]));
  }
  g.add(mk(sphere(0.15, 8, 6), w, [-0.05, 0.8, 0]));
  // head
  g.add(mk(sphere(0.17, 12, 10), P.skin, [0.36, 0.62, 0], [0, 0, 0], [1, 0.95, 0.95]));
  g.add(mk(sphere(0.1, 8, 6), w, [0.33, 0.78, 0]));
  for (const sz of [-1, 1]) {
    g.add(mk(sphere(0.025, 6, 4), P.ink, [0.5, 0.66, sz * 0.07]));
    g.add(mk(sphere(0.03, 6, 4), P.blush, [0.49, 0.58, sz * 0.11]));
    g.add(mk(sphere(0.07, 8, 6), P.skin, [0.3, 0.7, sz * 0.17], [sz * 0.8, 0, 0], [0.5, 0.4, 1.3]));
  }
  for (const [x, z] of [[-0.15, -0.12], [-0.15, 0.12], [0.16, -0.12], [0.16, 0.12]]) g.add(mk(cyl(0.05, 0.045, 0.3, 6), P.ink, [x, 0.16, z]));
  g.add(mk(torus(0.1, 0.025, 6, 12), P.pinkDeep, [0.3, 0.5, 0], [0, PI / 2, 0]));
  if (hat) {
    g.add(mk(cyl(0.13, 0.13, 0.16, 12), P.white, [0.3, 0.92, 0]));
    g.add(mk(sphere(0.18, 10, 8), P.white, [0.3, 1.05, 0], [0, 0, 0], [1, 0.7, 1]));
  }
  return g;
}

// ------------------------------------------------------------------ Higgsfield sheep
// Static textured meshes (sam_3_3d, no rig): the scene animates them with transforms (hops, waddle, squash).

/** Length of an obstacle / grazing sheep (m): the procedural sheepModel() footprint (hit box ≈ 0.84 × 0.68). */
export const SHEEP_LEN = 1.0;
/** Length of the ride buddy (m, world size): its back carries the saddle at ≈1.4 m like the old 1.6× buddy. */
export const RIDE_LEN = 1.9;
/** Chef Mongmong's height on the bakery plaza (tall chef hat included). */
export const BAKER_H = 1.75;

export interface RideSheep {
  /** faces +X (like rideSheepModel), world size: scale 1 */
  group: THREE.Group;
  /** where Hamin sits along the sheep (local +X = forward), m */
  seatX: number;
}

export interface SheepAssets {
  /** sheep_lo as ONE geometry facing +X (like sheepModel) + its shared textured material, for InstancedMeshes */
  lo: { geometry: THREE.BufferGeometry; material: THREE.Material } | null;
  /** the full-res sheep with a procedural saddle, for the ride buddy */
  ride: RideSheep | null;
  /** Chef Mongmong, the sheep baker (faces +Z, base on y=0) */
  baker: THREE.Group | null;
}

const failed = (what: string) => (e: unknown) => {
  console.warn('dogchase: model failed, procedural fallback', what, e);
  return null;
};

/** Load every Higgsfield sheep Dog Chase uses. Never rejects: a model that fails to load comes back null. */
export async function loadSheepAssets(): Promise<SheepAssets> {
  const [lo, ride, baker] = await Promise.all([
    critterGeometry('sheep_lo', { d: SHEEP_LEN })
      .then((r) => {
        r.geometry.rotateY(PI / 2); // front +Z → +X, the walking direction of the obstacle sheep
        return r;
      })
      .catch(failed('sheep_lo')),
    critter('sheep', { d: RIDE_LEN }).then(rideSheepFromModel).catch(failed('sheep')),
    loadGlb('models/npcs/mongmong.glb').then((src) => normalise(src, { h: BAKER_H })).catch(failed('mongmong')),
  ]);
  return { lo, ride, baker };
}

/** Highest vertex of `root` (in root space) within a small square around (x, z); `def` if there is none. */
function topAt(root: THREE.Object3D, x: number, z: number, r: number, def: number) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const v = new THREE.Vector3();
  let top = -Infinity;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(mat);
      if (Math.abs(v.x - x) < r && Math.abs(v.z - z) < r && v.y > top) top = v.y;
    }
  });
  return isFinite(top) ? top : def;
}

/** The ride buddy from the Higgsfield sheep (normalised, front +Z): turned to face +X, plus a pink saddle + flower. */
function rideSheepFromModel(model: THREE.Group): RideSheep {
  const g = new THREE.Group();
  model.rotation.y = PI / 2;
  g.add(model);
  // Hamin sits a little behind the middle of the back (the head rises in front of his knees)
  const seatX = -0.16;
  const seatY = topAt(g, seatX, 0, 0.14, RIDE_LEN * 0.7);
  const e = new THREE.Group();
  e.add(mk(sphere(0.5, 14, 8), P.white, [seatX, seatY - 0.07, 0], [0, 0, 0], [0.62, 0.2, 0.74]));
  e.add(mk(rbox(0.5, 0.11, 0.56, 0.05), P.pinkDeep, [seatX, seatY + 0.01, 0]));
  e.add(mk(rbox(0.06, 0.12, 0.5, 0.03), P.pinkSoft, [seatX - 0.24, seatY + 0.05, 0]));
  // flower tucked behind the ear
  const fx = RIDE_LEN * 0.2;
  const fz = 0.2;
  const fy = topAt(g, fx, fz, 0.08, seatY + 0.2) + 0.02;
  e.add(mk(sphere(0.06, 8, 6), P.butter, [fx, fy + 0.02, fz]));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2;
    e.add(mk(sphere(0.05, 6, 4), P.pinkDeep, [fx + Math.cos(a) * 0.07, fy, fz + Math.sin(a) * 0.07]));
  }
  const extras = new THREE.Mesh(bakeGeo(e), vertexColorToon());
  extras.castShadow = true;
  extras.userData.dynamic = true;
  g.add(extras);
  return { group: g, seatX };
}

/** A sheep grazing beside a meadow tile, in tile-local coordinates (drawn by an InstancedMesh, not baked). */
export interface Grazer { x: number; z: number; rot: number }

export function heartModel() {
  const h = heartShape(0, 0.52);
  h.material = toon(P.strawberry, { emissive: 0x552030 });
  return bakeGeo(G(h), false);
}

export function treatModel() {
  // bone-shaped cookie for Bori
  const g = new THREE.Group();
  g.add(mk(cyl(0.06, 0.06, 0.34, 10), P.wood, [0, 0, 0], [0, 0, PI / 2]));
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.add(mk(sphere(0.07, 8, 6), P.wood, [sx * 0.18, sy * 0.05, 0]));
  g.add(mk(sphere(0.035, 6, 4), P.pinkDeep, [0, 0.05, 0.04]));
  return bakeGeo(g, false);
}

// ------------------------------------------------------------------ scenery
export const TILE = 26;
export const ROAD_HALF = 3.05;

function lolliTree(s: number, c: number, c2: number) {
  const g = new THREE.Group();
  g.add(mk(cyl(0.14, 0.2, 1.4, 7), P.woodDeep, [0, 0.7, 0]));
  g.add(mk(sphere(0.85, 10, 8), c, [0, 1.95, 0]));
  g.add(mk(sphere(0.55, 9, 7), c2, [-0.5, 1.65, 0.25]));
  g.add(mk(sphere(0.5, 9, 7), c2, [0.5, 1.75, -0.1]));
  g.scale.setScalar(s);
  return g;
}

function puffBush(s: number, c: number) {
  const g = new THREE.Group();
  g.add(mk(sphere(0.42, 8, 6), c, [0, 0.28, 0]));
  g.add(mk(sphere(0.3, 7, 5), c, [-0.36, 0.2, 0.05]));
  g.add(mk(sphere(0.32, 7, 5), c, [0.36, 0.22, 0]));
  g.scale.setScalar(s);
  return g;
}

function flowerDot(c: number) {
  const g = new THREE.Group();
  g.add(mk(cyl(0.02, 0.02, 0.3, 4), P.mintDeep, [0, 0.15, 0]));
  g.add(mk(sphere(0.1, 7, 5), c, [0, 0.32, 0], [0, 0, 0], [1, 0.7, 1]));
  g.add(mk(sphere(0.045, 5, 4), P.butterDeep, [0, 0.37, 0]));
  return g;
}

function lamp() {
  const g = new THREE.Group();
  g.add(mk(cyl(0.07, 0.1, 2.5, 8), P.white, [0, 1.25, 0]));
  g.add(mk(sphere(0.26, 10, 8), toon(0xfff5d6, { emissive: 0x554422 }), [0, 2.7, 0]));
  g.add(mk(cone(0.3, 0.18, 10), P.pinkDeep, [0, 3.0, 0]));
  return g;
}

function picketRun(len: number, c: number) {
  const g = new THREE.Group();
  const n = Math.round(len / 0.7);
  for (let i = 0; i <= n; i++) {
    const z = -len / 2 + (i * len) / n;
    g.add(mk(flat(0.08, 0.6, 0.12), c, [0, 0.3, z]));
    g.add(mk(cone(0.085, 0.12, 4), c, [0, 0.66, z], [0, PI / 4, 0]));
  }
  g.add(mk(flat(0.05, 0.07, len), c, [0, 0.45, 0]));
  g.add(mk(flat(0.05, 0.07, len), c, [0, 0.2, 0]));
  return g;
}

function house(w: number, wall: number, roof: number, r: () => number) {
  const g = new THREE.Group();
  const h = 2.3 + r() * 0.8;
  g.add(mk(rbox(w, h, 2.6, 0.2, 1), wall, [0, h / 2, 0]));
  const rf = new THREE.Group();
  rf.position.set(0, h + 0.62, 0);
  rf.scale.set(1, 1, 2.9 / w);
  rf.add(mk(cone(w * 0.8, 1.3, 4), roof, [0, 0, 0], [0, PI / 4, 0]));
  g.add(rf);
  g.add(mk(flat(0.7, 1.2, 0.1), P.white, [0, 0.6, 1.3]));
  g.add(mk(flat(0.54, 1.05, 0.1), roof, [0, 0.55, 1.33]));
  for (const sx of [-1, 1]) {
    g.add(mk(flat(0.62, 0.62, 0.08), P.white, [sx * w * 0.3, h * 0.62, 1.3]));
    g.add(mk(flat(0.46, 0.46, 0.08), 0xdff1ff, [sx * w * 0.3, h * 0.62, 1.33]));
  }
  g.add(mk(flat(0.3, 0.7, 0.3), P.white, [w * 0.25, h + 0.7, -0.4]));
  return g;
}

/** Pastel school building, front facing +Z, ~14 m wide. */
function school() {
  const g = new THREE.Group();
  g.add(mk(rbox(14, 3.4, 3.2, 0.2, 1), P.cream, [0, 1.7, 0]));
  g.add(mk(rbox(14.4, 0.32, 3.6, 0.12, 1), P.peachDeep, [0, 3.52, 0]));
  g.add(mk(flat(14.1, 0.16, 0.1), P.pinkDeep, [0, 0.9, 1.62]));
  for (const y of [1.45, 2.65]) {
    for (let x = -6; x <= 6.01; x += 1.5) {
      if (Math.abs(x) < 1.6) continue;
      g.add(mk(flat(0.92, 0.8, 0.1), P.white, [x, y, 1.6]));
      g.add(mk(flat(0.74, 0.62, 0.1), 0xdff1ff, [x, y, 1.63]));
    }
  }
  // clock tower + entrance
  g.add(mk(rbox(2.6, 5.3, 2.6, 0.18, 1), P.pinkSoft, [0, 2.65, 0.5]));
  const rf = mk(cone(2.0, 1.5, 4), P.strawberry, [0, 6.05, 0.5], [0, PI / 4, 0]);
  g.add(rf);
  g.add(mk(cyl(0.72, 0.72, 0.1, 20), P.white, [0, 4.25, 1.82], [PI / 2, 0, 0]));
  g.add(mk(torus(0.72, 0.07, 6, 20), P.blueDeep, [0, 4.25, 1.86]));
  g.add(mk(flat(0.07, 0.5, 0.04), P.ink, [0, 4.43, 1.9]));
  g.add(mk(flat(0.36, 0.07, 0.04), P.ink, [0.15, 4.25, 1.9]));
  g.add(mk(rbox(1.7, 2.1, 0.2, 0.08), P.white, [0, 1.05, 1.82]));
  g.add(mk(rbox(1.4, 1.9, 0.2, 0.08), P.blueDeep, [0, 0.95, 1.86]));
  g.add(mk(flat(2.8, 0.14, 0.9), P.white, [0, 0.07, 2.2]));
  // flag pole
  g.add(mk(cyl(0.05, 0.05, 4.2, 6), P.white, [4.2, 2.1, 2.6]));
  g.add(mk(flat(0.9, 0.55, 0.04), P.pink, [4.67, 3.8, 2.6]));
  const h = heartShape(P.strawberry, 0.3);
  h.position.set(4.67, 3.8, 2.63);
  g.add(h);
  return g;
}

/** Little shop: house + striped awning + planter. Front faces +Z. */
function shop(w: number, wall: number, roof: number, stripe: number, r: () => number) {
  const g = house(w, wall, roof, r);
  for (let i = 0; i < 5; i++) {
    const x = -w * 0.4 + (i * w * 0.8) / 4;
    g.add(mk(flat((w * 0.8) / 4 + 0.02, 0.08, 1.0), i % 2 ? P.white : stripe, [x, 2.05, 1.72], [0.4, 0, 0]));
    g.add(mk(sphere(0.2, 6, 4), i % 2 ? P.white : stripe, [x, 1.82, 2.2], [0, 0, 0], [1.6, 0.6, 0.6]));
  }
  g.add(mk(rbox(w * 0.7, 0.3, 0.35, 0.06), P.woodDeep, [0, 0.15, 1.6]));
  const fc = [P.pink, P.butter, P.lavenderDeep, P.white];
  for (let i = 0; i < 4; i++) g.add(mk(sphere(0.13, 6, 4), fc[i], [-w * 0.27 + i * w * 0.18, 0.36, 1.62]));
  return g;
}

/** Giant donut sign on a pole (bakery lane decor). */
function donutSign(c: number) {
  const g = new THREE.Group();
  g.add(mk(cyl(0.06, 0.06, 2.2, 6), P.white, [0, 1.1, 0]));
  g.add(mk(torus(0.42, 0.2, 8, 16), P.wood, [0, 2.6, 0]));
  g.add(mk(torus(0.42, 0.16, 6, 16), c, [0, 2.6, 0.08], [0, 0, 0], [1, 1, 0.9]));
  const sc = [P.white, P.butter, P.blue, P.mint];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2 + 0.3;
    g.add(mk(rbox(0.1, 0.03, 0.03, 0.01), sc[i % 4], [Math.cos(a) * 0.42, 2.6 + Math.sin(a) * 0.42, 0.25], [0, 0, a * 2]));
  }
  return g;
}

/** Row of string-light bulbs sagging between two points along Z (bakery lane). */
function stringLights(x: number, z0: number, z1: number, g: THREE.Group) {
  const n = 9;
  const cols = [P.butter, P.pink, P.blue, P.mint];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const z = z0 + (z1 - z0) * u;
    const y = 2.75 - Math.sin(u * PI) * 0.45;
    g.add(mk(sphere(0.08, 5, 4), cols[i % 4], [x, y, z]));
  }
}

/** Bakery-lane shop slots: centre distance into the tile (m) of shop `slot`, and its lateral offset. */
export const SHOP_Z0 = 3.4;
export const SHOP_DZ = 6.6;
export const SHOP_X = ROAD_HALF + 4.7;

/** An empty shop slot in a bakery-lane tile (filled by a Higgsfield bakery landmark instead). */
export interface ShopGap { side: -1 | 1; slot: number }

/**
 * One ground tile of the course (length TILE along -Z, local z from 0 to -TILE).
 * variant 0 = park, 1 = street, 2 = flower meadow, 3 = school street, 4 = bakery lane.
 * `gap` (bakery lane only) leaves one shop slot empty for a landmark bakery.
 * `grazers` given → the meadow's grazing sheep are listed there (tile-local) instead of baked into the tile.
 */
export function tileGeo(variant: number, gap?: ShopGap, grazers?: Grazer[]): THREE.BufferGeometry {
  const g = new THREE.Group();
  const r = rng(1234 + variant * 77);
  const L = TILE;
  const zc = -L / 2;
  const streety = variant === 1 || variant === 3 || variant === 4;
  // road: soft cream paving + white curbs + pink lane dashes
  g.add(mk(flat(ROAD_HALF * 2, 0.3, L), streety ? 0xfff0e2 : P.cream, [0, -0.15, zc]));
  for (let z = 1; z < L; z += 2) g.add(mk(flat(ROAD_HALF * 2 - 0.1, 0.02, 0.06), 0xf6e2d2, [0, 0.005, -z]));
  for (const sx of [-1, 1]) {
    g.add(mk(flat(0.34, 0.24, L), P.white, [sx * (ROAD_HALF + 0.17), 0.02, zc]));
    for (let z = 0.8; z < L; z += 2.6) g.add(mk(flat(0.12, 0.02, 1.3), P.pinkDeep, [sx * 0.85, 0.012, -z]));
  }
  // side ground (wide so the horizon is filled)
  const side = variant === 1 ? 0xffe3ea : variant === 3 ? 0xe6f2ff : variant === 4 ? 0xfff0e6 : P.grass;
  for (const sx of [-1, 1]) g.add(mk(flat(30, 0.4, L), side, [sx * (ROAD_HALF + 0.34 + 15), -0.22, zc]));
  if (variant === 3) {
    // school street: crosswalk, school building on the left, houses on the right
    for (let x = -2.55; x <= 2.56; x += 0.85) g.add(mk(flat(0.42, 0.02, 2.2), P.white, [x, 0.014, -5]));
    for (const sx of [-1, 1]) {
      g.add(mk(flat(2.4, 0.06, L), 0xfff6ec, [sx * (ROAD_HALF + 1.55), 0.01, zc]));
      for (let z = 2.5; z < L; z += 8.6) g.add(G(lamp()).translateX(sx * (ROAD_HALF + 0.9)).translateZ(-z));
      for (let z = 4; z < L; z += 7) g.add(lolliTree(0.85 + r() * 0.2, P.pink, P.pinkSoft).translateX(sx * (ROAD_HALF + 2.4)).translateZ(-z));
    }
    const sc = school();
    sc.position.set(-(ROAD_HALF + 6.6), 0, -14);
    sc.rotation.y = PI / 2;
    g.add(sc);
    g.add(G(picketRun(9, P.white)).translateX(-(ROAD_HALF + 3.4)).translateZ(-5));
    g.add(G(picketRun(9, P.white)).translateX(-(ROAD_HALF + 3.4)).translateZ(-21.5));
    const walls = [P.blueSoft, P.butter, P.mint, P.lavender];
    const roofs = [P.blueDeep, P.peachDeep, P.mintDeep, P.lavenderDeep];
    for (let z = 3.3, i = 0; z < L - 2; z += 6.5, i++) {
      const hs = house(3.4 + r() * 0.6, walls[i % 4], roofs[(i + 1) % 4], r);
      hs.position.set(ROAD_HALF + 4.6, 0, -z);
      hs.rotation.y = -PI / 2;
      g.add(hs);
    }
  } else if (variant === 4) {
    // bakery lane: shops with striped awnings, donut signs, string lights
    const walls = [P.pinkSoft, P.butter, P.cream, P.lavender, P.peach];
    const roofs = [P.strawberry, P.peachDeep, P.pinkDeep, P.lavenderDeep, P.strawberry];
    const stripes = [P.pinkDeep, P.blueDeep, P.mintDeep, P.strawberry, P.lavenderDeep];
    for (const sx of [-1, 1]) {
      g.add(mk(flat(2.6, 0.06, L), P.white, [sx * (ROAD_HALF + 1.65), 0.01, zc]));
      for (let z = 0.65; z < L; z += 1.3) g.add(mk(flat(0.6, 0.02, 0.6), P.pinkSoft, [sx * (ROAD_HALF + 1.65 + (((z / 1.3) | 0) % 2 ? 0.65 : -0.65)), 0.045, -z]));
      for (let z = 2.5; z < L; z += 8.6) {
        g.add(G(lamp()).translateX(sx * (ROAD_HALF + 0.9)).translateZ(-z));
        if (z + 8.6 < L) stringLights(sx * (ROAD_HALF + 0.9), -z, -(z + 8.6), g);
      }
      for (let z = SHOP_Z0, i = 0; z < L - 2; z += SHOP_DZ, i++) {
        const k = (i + (sx > 0 ? 2 : 0)) % walls.length;
        const s = shop(3.6 + r() * 0.4, walls[k], roofs[k], stripes[k], r);
        if (gap && gap.side === sx && gap.slot === i) continue; // r() still advanced → other shops unchanged
        s.position.set(sx * SHOP_X, 0, -z);
        s.rotation.y = -sx * PI / 2;
        g.add(s);
      }
      g.add(donutSign(sx > 0 ? P.pink : P.lavender).translateX(sx * (ROAD_HALF + 2.4)).translateZ(-L / 2 + sx * 4));
    }
  } else if (variant === 1) {
    // pastel street: sidewalk, houses, lamp posts
    for (const sx of [-1, 1]) {
      g.add(mk(flat(2.4, 0.06, L), 0xfff6ec, [sx * (ROAD_HALF + 1.55), 0.01, zc]));
      for (let z = 2.5; z < L; z += 8.6) g.add(G(lamp()).translateX(sx * (ROAD_HALF + 0.9)).translateZ(-z));
      const walls = [P.pinkSoft, P.blueSoft, P.butter, P.lavender, P.mint];
      const roofs = [P.strawberry, P.blueDeep, P.peachDeep, P.lavenderDeep, P.mintDeep];
      for (let z = 3.3, i = 0; z < L - 2; z += 6.5, i++) {
        const k = Math.floor(r() * walls.length);
        const hs = house(3.4 + r() * 0.6, walls[k], roofs[(k + i) % roofs.length], r);
        hs.position.set(sx * (ROAD_HALF + 4.6), 0, -z);
        hs.rotation.y = -sx * PI / 2;
        g.add(hs);
        g.add(puffBush(0.7, P.mintDeep).translateX(sx * (ROAD_HALF + 2.6)).translateZ(-z - 2.6));
      }
      for (let z = 6; z < L; z += 9) g.add(lolliTree(0.9, P.pink, P.pinkSoft).translateX(sx * (ROAD_HALF + 8.5)).translateZ(-z));
    }
  } else {
    for (const sx of [-1, 1]) {
      g.add(picketRun(L, P.white).translateX(sx * (ROAD_HALF + 0.75)).translateZ(zc));
      const blossom = variant === 2;
      for (let z = 2 + r() * 2; z < L; z += 5 + r() * 3) {
        const c = blossom ? (r() < 0.5 ? P.pink : P.pinkSoft) : r() < 0.5 ? P.mintDeep : P.grassDeep;
        const c2 = blossom ? P.pinkDeep : P.mint;
        g.add(lolliTree(0.9 + r() * 0.35, c, c2).translateX(sx * (ROAD_HALF + 2.8 + r() * 4)).translateZ(-z));
      }
      for (let z = 1 + r() * 2; z < L; z += 3 + r() * 3) g.add(puffBush(0.7 + r() * 0.4, r() < 0.5 ? P.mintDeep : P.grassDeep).translateX(sx * (ROAD_HALF + 1.5 + r() * 1.2)).translateZ(-z));
      const fc = [P.pink, P.butter, P.lavenderDeep, P.white, P.pinkDeep];
      const nf = variant === 2 ? 8 : 5;
      for (let i = 0; i < nf; i++) g.add(flowerDot(fc[Math.floor(r() * fc.length)]).translateX(sx * (ROAD_HALF + 1.1 + r() * 7)).translateZ(-r() * L));
      if (variant === 0) g.add(lamp().translateX(sx * (ROAD_HALF + 1.2)).translateZ(-L / 2 - sx * 6));
      else if (sx > 0) {
        // sheep grazing in the meadow
        const x = sx * (ROAD_HALF + 5 + r() * 3);
        const z = -4 - r() * (L - 8);
        const rot = r() * PI * 2;
        if (grazers) grazers.push({ x, z, rot });
        else {
          const sh = sheepModel();
          sh.position.set(x, 0, z);
          sh.rotation.y = rot;
          g.add(sh);
        }
      }
    }
  }
  return bakeGeo(g);
}

/** Far hills & cloud-sheep ring (follows the runner; drawn without fog). */
export function backdropGeo() {
  const g = new THREE.Group();
  const r = rng(99);
  const cols = [P.mint, P.grass, P.mintDeep, 0xd9f5c9, P.pinkSoft];
  for (let i = 0; i < 14; i++) {
    const x = -70 + i * 11 + r() * 6;
    const s = 10 + r() * 12;
    g.add(mk(sphere(1, 14, 8), cols[i % cols.length], [x, -s * 0.35, -r() * 14], [0, 0, 0], [s * 1.3, s * 0.75, s * 0.6]));
  }
  const w = toon(0xffffff, { emissive: 0x2a2a30 });
  for (let i = 0; i < 6; i++) {
    const x = -55 + i * 22 + r() * 8;
    const y = 16 + r() * 10;
    const s = 3 + r() * 2;
    for (const [dx, dy, rr] of [[0, 0, 1], [-1, -0.2, 0.75], [1, -0.1, 0.8], [-0.3, 0.55, 0.7], [0.45, 0.5, 0.62]] as const)
      g.add(mk(sphere(rr, 10, 8), w, [x + dx * s, y + dy * s, -10], [0, 0, 0], s));
    g.add(mk(sphere(0.45, 8, 6), P.skin, [x + 1.55 * s, y - 0.05 * s, -10 + 0.4 * s], [0, 0, 0], s));
  }
  return bakeGeo(g, false);
}

/**
 * Two white posts to hang a text sign of width `w` (centre at height `y`) on — used for the "Sheep Bakery"
 * sign when the landmark bakery's sheep-face roof takes the spot the sign used to have. Front faces +Z.
 */
export function signStand(w: number, y: number) {
  const g = new THREE.Group();
  const top = y + 0.5;
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.2);
    g.add(mk(cyl(0.07, 0.09, top, 8), P.white, [x, top / 2, -0.07]));
    g.add(mk(sphere(0.13, 8, 6), P.pinkDeep, [x, top + 0.06, -0.07]));
  }
  g.add(mk(rbox(0.7, 0.24, 0.7, 0.08), P.white, [0, 0.12, -0.07], [0, 0, 0], [w / 0.7 * 0.85, 1, 0.5]));
  return new THREE.Mesh(bakeGeo(g), vertexColorToon());
}

/** Local z of the Sheep Bakery building (its centre) inside bakeryGroup(). */
export const BAKERY_Z = -17;
/**
 * Where the sheep baker stands inside bakeryGroup(): on the plaza in front of the bakery, off to the right so the
 * finish camera sees him beside Hamin (he tosses Bori his treat).
 */
export const BAKER_POS = new THREE.Vector3(2.9, 0, BAKERY_Z + 5.6);

/** Procedural baker sheep with a chef hat (fallback for Chef Mongmong): faces +Z, base on y=0. */
export function bakerSheepModel() {
  const s = sheepModel(true);
  s.scale.setScalar(1.25);
  s.rotation.y = -PI / 2;
  const m = new THREE.Mesh(bakeGeo(G(s)), vertexColorToon());
  m.castShadow = true;
  return m;
}

/**
 * Finish arch + plaza + Sheep Bakery. Local z=0 is the finish line, bakery toward -Z.
 * The procedural bakery building is its own mesh (`building`) so a Higgsfield landmark can replace it.
 */
export function bakeryGroup() {
  const g = new THREE.Group();
  const b = new THREE.Group();
  const bb = new THREE.Group(); // building only
  // plaza
  b.add(mk(flat(16, 0.3, 26), 0xfff0e6, [0, -0.15, -13]));
  for (let x = -7; x <= 7; x += 2) for (let z = 1; z < 26; z += 2) if (((x + z) & 3) === 0) b.add(mk(flat(1.9, 0.02, 1.9), P.pinkSoft, [x, 0.005, -z]));
  for (const sx of [-1, 1]) b.add(mk(flat(30, 0.4, 30), P.grass, [sx * 23, -0.22, -14]));
  // finish arch
  for (const sx of [-1, 1]) {
    b.add(mk(cyl(0.2, 0.22, 3.6, 12), P.white, [sx * 3.4, 1.8, 0]));
    b.add(mk(torus(0.22, 0.06, 6, 14), P.pinkDeep, [sx * 3.4, 1.2, 0], [PI / 2, 0, 0]));
    b.add(mk(torus(0.22, 0.06, 6, 14), P.blueDeep, [sx * 3.4, 2.3, 0], [PI / 2, 0, 0]));
    for (const [dx, dy, c] of [[0, 0, P.pink], [0.3, -0.25, P.blue], [-0.3, -0.2, P.butter]] as const) {
      b.add(mk(sphere(0.3, 10, 8), c, [sx * 3.4 + dx, 4.0 + dy, 0.1], [0, 0, 0], [1, 1.15, 1]));
    }
  }
  b.add(mk(rbox(7.4, 0.8, 0.26, 0.12), P.strawberry, [0, 3.55, 0]));
  // checkered finish line
  for (let i = 0; i < 12; i++) b.add(mk(flat(0.5, 0.02, 0.25), i % 2 ? P.white : P.pinkDeep, [-2.75 + i * 0.5, 0.012, 0]));
  for (let i = 0; i < 12; i++) b.add(mk(flat(0.5, 0.02, 0.25), i % 2 ? P.pinkDeep : P.white, [-2.75 + i * 0.5, 0.012, -0.25]));
  // bakery building
  const bz = BAKERY_Z;
  bb.add(mk(rbox(9.5, 4.4, 5, 0.3), P.cream, [0, 2.2, bz]));
  bb.add(mk(rbox(10, 0.5, 5.5, 0.22), P.strawberry, [0, 0.25, bz]));
  // frosting roof with drips + cherry
  bb.add(mk(rbox(10.2, 0.9, 5.8, 0.4), P.white, [0, 4.75, bz]));
  for (let x = -4.6; x <= 4.6; x += 0.7) bb.add(mk(sphere(0.2, 8, 6), P.white, [x, 4.3 - (Math.abs(Math.sin(x * 3)) * 0.2), bz + 2.75], [0, 0, 0], [1, 1.6, 1]));
  bb.add(mk(rbox(9.6, 0.5, 5.2, 0.22), P.pinkSoft, [0, 5.35, bz]));
  // big sheep sitting on the roof
  const s = sheepModel();
  s.scale.setScalar(2.2);
  s.rotation.y = -PI / 2;
  s.position.set(-2.2, 5.5, bz);
  bb.add(s);
  bb.add(mk(sphere(0.35, 12, 10), P.strawberry, [2.6, 5.95, bz]));
  bb.add(mk(cyl(0.03, 0.03, 0.5, 5), P.mintDeep, [2.7, 6.35, bz], [0, 0, -0.4]));
  // striped awning
  for (let i = 0; i < 9; i++) {
    const x = -4.2 + i * 1.05;
    bb.add(mk(rbox(1.05, 0.12, 1.5, 0.05), i % 2 ? P.white : P.pinkDeep, [x, 3.25, bz + 3.1], [0.35, 0, 0]));
    bb.add(mk(sphere(0.3, 8, 6), i % 2 ? P.white : P.pinkDeep, [x, 2.95, bz + 3.8], [0, 0, 0], [1.5, 0.6, 0.6]));
  }
  // door
  bb.add(mk(rbox(1.7, 2.6, 0.2, 0.12), P.white, [0, 1.3, bz + 2.5]));
  bb.add(mk(rbox(1.4, 2.35, 0.2, 0.14), P.woodDeep, [0, 1.2, bz + 2.56]));
  bb.add(mk(torus(0.24, 0.05, 6, 16), P.white, [0, 1.75, bz + 2.68]));
  bb.add(mk(sphere(0.22, 10, 8), 0xdff1ff, [0, 1.75, bz + 2.62], [0, 0, 0], [1, 1, 0.3]));
  bb.add(mk(sphere(0.08, 8, 6), P.butterDeep, [0.45, 1.15, bz + 2.7]));
  // display windows with cakes
  for (const sx of [-1, 1]) {
    const wx = sx * 2.9;
    bb.add(mk(rbox(2.5, 1.9, 0.18, 0.1), P.white, [wx, 1.7, bz + 2.5]));
    bb.add(mk(rbox(2.2, 1.6, 0.1, 0.08), 0xe3f3ff, [wx, 1.72, bz + 2.56]));
    bb.add(mk(rbox(2.6, 0.14, 0.5, 0.06), P.white, [wx, 0.72, bz + 2.7]));
    for (const [dx, c] of [[-0.6, P.pink], [0, P.butter], [0.6, P.lavender]] as const) {
      bb.add(mk(cyl(0.26, 0.26, 0.28, 14), c, [wx + dx, 1.0, bz + 2.7]));
      bb.add(mk(cyl(0.2, 0.2, 0.2, 14), P.white, [wx + dx, 1.24, bz + 2.7]));
      bb.add(mk(sphere(0.07, 8, 6), P.strawberry, [wx + dx, 1.4, bz + 2.7]));
    }
  }
  // plants (the baker sheep is its own object: see BAKER_POS)
  for (const sx of [-1, 1]) {
    b.add(puffBush(0.9, P.mintDeep).translateX(sx * 5.5).translateZ(bz + 3));
    b.add(lolliTree(1.1, P.pink, P.pinkSoft).translateX(sx * 7.2).translateZ(bz + 1));
    b.add(lolliTree(1.0, P.mintDeep, P.mint).translateX(sx * 8.2).translateZ(-4));
  }
  const baked = new THREE.Mesh(bakeGeo(b), vertexColorToon());
  g.add(baked);
  const building = new THREE.Mesh(bakeGeo(bb), vertexColorToon());
  g.add(building);
  // text signs (textured, not batchable)
  const goal = sign('GOAL ♡', 3.4, 0.62, { bg: '#FFFFFF', fg: '#FF7A93', border: '#FFCCD5' });
  goal.position.set(0, 3.55, 0.15);
  g.add(goal);
  const shop = sign('Sheep Bakery', 4.6, 1.1, { sub: '♡ fresh treats for good pups ♡', bg: '#FFF6E8', border: '#FF9DB3' });
  shop.position.set(0, 4.75, bz + 3.05);
  g.add(shop);
  return { group: g, baked, building, sign: shop };
}
