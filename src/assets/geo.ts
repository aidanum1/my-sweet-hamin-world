import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toon } from './materials';

// Cached, shared primitive geometries. Callers must not mutate them (clone first).
const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = cache.get(key);
  if (!g) {
    g = make();
    g.userData.shared = true;
    cache.set(key, g);
  }
  return g;
}

const r2 = (n: number) => Math.round(n * 1000) / 1000;

/** Rounded box — SURFACE_ROUNDNESS token: radius defaults to 18% of smallest side. */
export function rbox(w: number, h: number, d: number, r?: number, seg?: number) {
  const rad = r ?? Math.min(w, h, d) * 0.18;
  // small parts get a single bevel segment (≈108 tris instead of 300) — invisible at game camera distance
  if (seg === undefined) seg = Math.max(w, h, d) < 0.7 || rad < 0.05 ? 1 : 2;
  return cached(`rb${r2(w)},${r2(h)},${r2(d)},${r2(rad)},${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, rad));
}
export function sphere(r: number, ws = r < 0.2 ? 10 : 14, hs = r < 0.2 ? 8 : 10) {
  return cached(`sp${r2(r)},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
}
export function capsule(r: number, len: number, cs = 4, rs = 10) {
  return cached(`ca${r2(r)},${r2(len)},${cs},${rs}`, () => new THREE.CapsuleGeometry(r, len, cs, rs));
}
export function cyl(rt: number, rb: number, h: number, seg = 16) {
  return cached(`cy${r2(rt)},${r2(rb)},${r2(h)},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
}
export function cone(r: number, h: number, seg = 12) {
  return cached(`co${r2(r)},${r2(h)},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
}
export function torus(r: number, tube: number, rs = 8, ts = 20, arc = Math.PI * 2) {
  return cached(`to${r2(r)},${r2(tube)},${rs},${ts},${r2(arc)}`, () => new THREE.TorusGeometry(r, tube, rs, ts, arc));
}
export function plane(w: number, h: number) {
  return cached(`pl${r2(w)},${r2(h)}`, () => new THREE.PlaneGeometry(w, h));
}
export function circle(r: number, seg = 24) {
  return cached(`ci${r2(r)},${seg}`, () => new THREE.CircleGeometry(r, seg));
}

export type V3 = [number, number, number];

/** Create a toon mesh from a geometry, positioned/rotated/scaled. */
export function mk(
  geo: THREE.BufferGeometry,
  color: number | THREE.Material,
  pos: V3 = [0, 0, 0],
  rot: V3 = [0, 0, 0],
  scl: V3 | number = 1,
) {
  const m = new THREE.Mesh(geo, typeof color === 'number' ? toon(color) : color);
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.set(rot[0], rot[1], rot[2]);
  if (typeof scl === 'number') m.scale.setScalar(scl);
  else m.scale.set(scl[0], scl[1], scl[2]);
  return m;
}

/** Group helper. */
export function grp(children: THREE.Object3D[] = [], pos: V3 = [0, 0, 0], rotY = 0) {
  const g = new THREE.Group();
  g.position.set(pos[0], pos[1], pos[2]);
  g.rotation.y = rotY;
  for (const c of children) g.add(c);
  return g;
}
