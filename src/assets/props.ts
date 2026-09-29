// Shared, procedural prop library. Every room is built from these so the whole world
// shares one toy vocabulary (ART_BIBLE). Functions return Groups positioned at the origin
// (base on y=0, facing +Z) unless stated otherwise.
import * as THREE from 'three';
import { capsule, cone, cyl, grp, mk, plane, rbox, sphere, torus, V3 } from './geo';
import { toon, glossy, basic } from './materials';
import { P } from './palette';
import { canvasTex, signTexture, SignOpts, woodTex, tileTex, wallpaperTex, WallMotif, artTex } from './textures';
import { StaticBatcher } from '../core/StaticBatcher';

/** Collapse a group of toon meshes into ONE movable vertex-coloured mesh (1 draw call). */
export function merged(g: THREE.Object3D): THREE.Object3D {
  const b = new StaticBatcher();
  b.shade = false;
  const pos = g.position.clone(), rot = g.rotation.clone(), scl = g.scale.clone();
  g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.set(1, 1, 1);
  b.addObject(g);
  const m = b.build('merged');
  if (!m) return g;
  m.matrixAutoUpdate = true;
  m.position.copy(pos); m.rotation.copy(rot); m.scale.copy(scl);
  m.userData.dynamic = true;
  // keep any leftovers (textured bits)
  if (g.children.length) { const w = new THREE.Group(); w.add(m); w.add(g); w.position.copy(pos); w.rotation.copy(rot); w.scale.copy(scl); m.position.set(0,0,0); m.rotation.set(0,0,0); m.scale.set(1,1,1); w.userData.dynamic = true; return w; }
  return m;
}

const PI = Math.PI;

// ---------------------------------------------------------------- room shell
export interface RoomOpts {
  w: number; d: number; h?: number;
  floor: number; floor2?: number; // plank colours
  wall: number; wall2?: number; // wallpaper stripe colour
  trim?: number; slab?: number;
  planks?: boolean; tiles?: boolean;
  sideWalls?: boolean;
  motif?: WallMotif; // wallpaper pattern
}

function texturedPlane(w: number, h: number, map: THREE.Texture, rough = 0.78) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, roughness: rough, metalness: 0 }));
  m.receiveShadow = true;
  return m;
}

/** Cut-away dollhouse room: floor on a floating cake slab + back and side walls. */
export function room(o: RoomOpts) {
  const g = new THREE.Group();
  const h = o.h ?? 3.4;
  const { w, d } = o;
  const trim = o.trim ?? P.white;
  // floating slab (the "cake" under the dollhouse)
  g.add(mk(rbox(w + 1.2, 0.9, d + 1.2, 0.4, 3), o.slab ?? P.pinkSoft, [0, -0.5, 0]));
  g.add(mk(rbox(w + 1.3, 0.16, d + 1.3, 0.08), P.white, [0, -0.02, 0]));
  // floor: one textured plane (wood planks / tiles / plain) over a thin base
  g.add(mk(rbox(w, 0.1, d, 0.04), o.floor, [0, 0.05, 0]));
  const fmap = o.tiles ? tileTex(o.floor, o.floor2 ?? o.floor, w / 2, d / 2) : woodTex(o.floor, o.floor2 ?? o.floor, w / 2.6, d / 2.6);
  if (!o.tiles && !o.planks) fmap.repeat.set(w / 3.2, d / 3.2);
  const floor = texturedPlane(w, d, fmap, 0.7);
  floor.rotation.x = -PI / 2;
  floor.position.y = 0.102;
  g.add(floor);
  // back wall + wallpaper
  const T = 0.3;
  g.add(mk(rbox(w + T * 2, h, T, 0.08), o.wall, [0, h / 2, -d / 2 - T / 2]));
  const paper = (ww: number) => wallpaperTex(o.wall, o.wall2 ?? shadeHex(o.wall, 0.94), o.motif ?? (o.wall2 !== undefined ? 'stripes' : 'dots'), ww / 2.2, h / 2.2);
  const back = texturedPlane(w, h - 0.02, paper(w), 0.85);
  back.position.set(0, h / 2, -d / 2 + 0.005);
  g.add(back);
  g.add(mk(rbox(w + T * 2 + 0.1, 0.2, T + 0.14, 0.06), trim, [0, h, -d / 2 - T / 2]));
  g.add(mk(rbox(w, 0.24, 0.06, 0.02), trim, [0, 0.2, -d / 2 + 0.03]));
  g.add(mk(rbox(w, 0.07, 0.05, 0.02), trim, [0, 1.15, -d / 2 + 0.03]));
  g.add(mk(rbox(w, 0.12, 0.08, 0.03), trim, [0, h - 0.12, -d / 2 + 0.04]));
  if (o.sideWalls !== false) {
    for (const sx of [-1, 1]) {
      g.add(mk(rbox(T, h, d, 0.08), o.wall, [sx * (w / 2 + T / 2), h / 2, 0]));
      const side = texturedPlane(d, h - 0.02, paper(d), 0.85);
      side.position.set(sx * (w / 2 - 0.005), h / 2, 0);
      side.rotation.y = -sx * PI / 2;
      g.add(side);
      g.add(mk(rbox(0.05, 0.07, d, 0.02), trim, [sx * (w / 2 - 0.03), 1.15, 0]));
      g.add(mk(rbox(0.08, 0.12, d, 0.03), trim, [sx * (w / 2 - 0.04), h - 0.12, 0]));
      g.add(mk(rbox(T + 0.14, 0.2, d + 0.1, 0.06), trim, [sx * (w / 2 + T / 2), h, 0]));
      g.add(mk(rbox(0.06, 0.24, d, 0.02), trim, [sx * (w / 2 - 0.03), 0.2, 0]));
      // rounded front post
      g.add(mk(cyl(0.22, 0.22, h + 0.2, 14), trim, [sx * (w / 2 + T / 2), (h + 0.2) / 2, d / 2]));
    }
  }
  return g;
}

/** Door set into a wall. `side`: 'back' faces +Z; 'left'/'right' rotate accordingly. Returns [group, frontPoint]. */
export function door(color = P.pinkDeep, label?: string, labelOpts: SignOpts = {}) {
  const g = new THREE.Group();
  g.add(mk(rbox(1.7, 2.6, 0.3, 0.1), P.white, [0, 1.3, 0]));
  g.add(mk(rbox(1.35, 2.35, 0.2, 0.12), color, [0, 1.2, 0.08]));
  g.add(mk(sphere(0.08, 10, 8), P.butterDeep, [0.45, 1.15, 0.22]));
  g.add(mk(torus(0.22, 0.05, 8, 18), P.white, [0, 1.75, 0.2]));
  const win = circleM(0.2, 0xdff1ff);
  win.position.set(0, 1.75, 0.19);
  g.add(win);
  if (label) {
    const s = sign(label, 1.5, 0.45, { ...labelOpts });
    s.position.set(0, 2.85, 0.2);
    g.add(s);
  }
  return g;
}
function shadeHex(c: number, k: number) {
  const r = Math.round(((c >> 16) & 255) * k), g = Math.round(((c >> 8) & 255) * k), b = Math.round((c & 255) * k);
  return (r << 16) | (g << 8) | b;
}

function circleM(r: number, c: number) {
  return new THREE.Mesh(new THREE.CircleGeometry(r, 20), toon(c, { emissive: 0x223344 }));
}

/** Window with sky pane, frame and curtains. */
export function windowFrame(w = 2, h = 1.6, curtain = P.pink) {
  const g = new THREE.Group();
  g.add(mk(rbox(w + 0.3, h + 0.3, 0.2, 0.08), P.white, [0, 0, 0]));
  const pane = new THREE.Mesh(plane(w, h), skyPaneMat());
  pane.position.z = 0.11;
  g.add(pane);
  g.add(mk(rbox(0.08, h, 0.08, 0.03), P.white, [0, 0, 0.14]));
  g.add(mk(rbox(w, 0.08, 0.08, 0.03), P.white, [0, 0, 0.14]));
  for (const sx of [-1, 1]) {
    g.add(mk(rbox(0.45, h + 0.35, 0.1, 0.05), curtain, [sx * (w / 2 + 0.05), 0.02, 0.2]));
    g.add(mk(torus(0.1, 0.035, 6, 12), P.white, [sx * (w / 2 + 0.05), -0.2, 0.26]));
  }
  g.add(mk(rbox(w + 0.6, 0.12, 0.35, 0.05), P.white, [0, -h / 2 - 0.2, 0.15]));
  return g;
}

let skyPane: THREE.MeshBasicMaterial | null = null;
function skyPaneMat() {
  if (!skyPane) {
    skyPane = new THREE.MeshBasicMaterial({ map: artTex('window_view') });
    skyPane.userData.shared = true;
    return skyPane;
  }
  if (!skyPane) {
    const t = canvasTex(64, 64, (g) => {
      const grd = g.createLinearGradient(0, 0, 0, 64);
      grd.addColorStop(0, '#9fd0ff');
      grd.addColorStop(1, '#ffe3ec');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = 'rgba(255,255,255,.9)';
      for (const [x, y, r] of [[18, 22, 8], [26, 20, 10], [34, 23, 7], [44, 40, 6], [50, 38, 8]]) { g.beginPath(); g.arc(x, y, r, 0, PI * 2); g.fill(); }
    }, true);
    skyPane = new THREE.MeshBasicMaterial({ map: t });
    skyPane.userData.shared = true;
  }
  return skyPane;
}

/** Textured sign plane (not batched). */
export function sign(text: string, w = 1.6, h = 0.55, o: SignOpts & { sub?: string } = {}) {
  const px = 256;
  const tex = signTexture(text, px, Math.round((px * h) / w), o);
  const m = new THREE.Mesh(plane(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  m.userData.noShadow = true;
  return m;
}

/** Flat painted picture/poster (canvas draw callback). */
export function poster(w: number, h: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void, res = 256) {
  const tex = canvasTex(res, Math.round((res * h) / w), draw);
  const m = new THREE.Mesh(plane(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.userData.noShadow = true;
  return m;
}

// ---------------------------------------------------------------- furniture
export function schoolDesk(top = P.wood, leg = P.metal) {
  const g = new THREE.Group();
  g.add(mk(rbox(1.2, 0.1, 0.75, 0.04), top, [0, 0.82, 0]));
  g.add(mk(rbox(1.05, 0.26, 0.6, 0.05), P.cream, [0, 0.66, -0.02]));
  for (const [x, z] of [[-0.5, -0.28], [0.5, -0.28], [-0.5, 0.28], [0.5, 0.28]]) g.add(mk(cyl(0.035, 0.035, 0.8, 8), leg, [x, 0.4, z]));
  return g;
}

export function chair(seat = P.wood, leg = P.metal) {
  const g = new THREE.Group();
  g.add(mk(rbox(0.6, 0.08, 0.55, 0.04), seat, [0, 0.46, 0]));
  g.add(mk(rbox(0.6, 0.5, 0.08, 0.04), seat, [0, 0.78, -0.25]));
  for (const [x, z] of [[-0.24, -0.22], [0.24, -0.22], [-0.24, 0.22], [0.24, 0.22]]) g.add(mk(cyl(0.03, 0.03, 0.46, 8), leg, [x, 0.23, z]));
  return g;
}

export function stool(c = P.lavender) {
  const g = new THREE.Group();
  g.add(mk(cyl(0.34, 0.34, 0.14, 20), c, [0, 0.6, 0]));
  g.add(mk(cyl(0.05, 0.08, 0.55, 10), P.metal, [0, 0.3, 0]));
  g.add(mk(cyl(0.3, 0.32, 0.05, 20), P.metal, [0, 0.03, 0]));
  return g;
}

export function roundTable(r = 0.8, top = P.white, leg = P.metal) {
  const g = new THREE.Group();
  g.add(mk(cyl(r, r, 0.1, 28), top, [0, 0.78, 0]));
  g.add(mk(torus(r, 0.05, 6, 28), top, [0, 0.78, 0], [PI / 2, 0, 0]));
  g.add(mk(cyl(0.08, 0.1, 0.75, 10), leg, [0, 0.38, 0]));
  g.add(mk(cyl(0.4, 0.42, 0.05, 20), leg, [0, 0.03, 0]));
  return g;
}

export function longTable(w = 2.4, d = 1, top = P.white) {
  const g = new THREE.Group();
  g.add(mk(rbox(w, 0.12, d, 0.06), top, [0, 0.78, 0]));
  for (const sx of [-1, 1]) g.add(mk(rbox(0.12, 0.72, d * 0.7, 0.05), P.metal, [sx * (w / 2 - 0.25), 0.38, 0]));
  return g;
}

export function bench(w = 1.8, c = P.wood) {
  const g = new THREE.Group();
  g.add(mk(rbox(w, 0.1, 0.5, 0.04), c, [0, 0.45, 0]));
  g.add(mk(rbox(w, 0.35, 0.08, 0.04), c, [0, 0.75, -0.24]));
  for (const sx of [-1, 1]) g.add(mk(rbox(0.1, 0.45, 0.45, 0.04), P.metal, [sx * (w / 2 - 0.15), 0.22, 0]));
  return g;
}

export function shelf(w = 1.6, h = 1.8, c = P.white, bookCols: number[] = [P.pink, P.blue, P.butter, P.mint, P.lavender]) {
  const g = new THREE.Group();
  g.add(mk(rbox(w, h, 0.45, 0.06), c, [0, h / 2, 0]));
  const rows = Math.max(2, Math.floor(h / 0.55));
  for (let r = 0; r < rows; r++) {
    const y = 0.15 + r * ((h - 0.2) / rows);
    g.add(mk(rbox(w - 0.12, 0.05, 0.4, 0.02), P.cream, [0, y, 0.04]));
    let x = -w / 2 + 0.15;
    let i = r * 3;
    while (x < w / 2 - 0.2) {
      const bw = 0.1 + ((i * 37) % 5) * 0.02;
      const bh = 0.28 + ((i * 13) % 4) * 0.03;
      g.add(mk(rbox(bw, bh, 0.28, 0.02), bookCols[i % bookCols.length], [x + bw / 2, y + bh / 2 + 0.03, 0.06]));
      x += bw + 0.02;
      i++;
    }
  }
  return g;
}

export function locker(c = P.blue) {
  const g = new THREE.Group();
  g.add(mk(rbox(0.7, 2, 0.55, 0.06), c, [0, 1, 0]));
  for (const y of [0.55, 1.45]) {
    g.add(mk(rbox(0.5, 0.06, 0.02, 0.01), P.white, [0, y + 0.3, 0.28]));
    g.add(mk(rbox(0.5, 0.06, 0.02, 0.01), P.white, [0, y + 0.2, 0.28]));
  }
  g.add(mk(rbox(0.05, 0.25, 0.05, 0.02), P.white, [0.24, 1, 0.3]));
  return g;
}

export function rug(w: number, d: number, c = P.pink, c2 = P.white) {
  const g = new THREE.Group();
  g.add(mk(rbox(w, 0.04, d, 0.02), c2, [0, 0.12, 0]));
  g.add(mk(rbox(w - 0.2, 0.05, d - 0.2, 0.02), c, [0, 0.13, 0]));
  return g;
}

export function roundRug(r: number, c = P.pink, c2 = P.white) {
  const g = new THREE.Group();
  g.add(mk(cyl(r, r, 0.04, 32), c2, [0, 0.12, 0]));
  g.add(mk(cyl(r - 0.12, r - 0.12, 0.05, 32), c, [0, 0.13, 0]));
  return g;
}

export function plant(pot = P.pinkDeep, leaf = P.mintDeep, s = 1) {
  const g = new THREE.Group();
  g.add(mk(cyl(0.28, 0.22, 0.5, 14), pot, [0, 0.25, 0]));
  g.add(mk(torus(0.28, 0.05, 6, 16), pot, [0, 0.5, 0], [PI / 2, 0, 0]));
  for (const [x, y, z, r] of [[0, 0.85, 0, 0.3], [-0.2, 0.72, 0.05, 0.22], [0.2, 0.75, -0.05, 0.22], [0.05, 1.08, 0.05, 0.2]] as const)
    g.add(mk(sphere(r, 12, 10), leaf, [x, y, z]));
  g.scale.setScalar(s);
  return g;
}

export function lamp(c = P.butter) {
  const g = new THREE.Group();
  g.add(mk(cyl(0.25, 0.28, 0.06, 16), P.white, [0, 0.03, 0]));
  g.add(mk(cyl(0.03, 0.03, 1.5, 8), P.white, [0, 0.8, 0]));
  g.add(mk(cone(0.35, 0.4, 16), toon(c, { emissive: 0x332a10 }), [0, 1.65, 0]));
  return g;
}

export function speaker(c = P.lavender, s = 1) {
  const g = new THREE.Group();
  g.add(mk(rbox(0.7, 1.1, 0.6, 0.1), c, [0, 0.55, 0]));
  g.add(mk(cyl(0.22, 0.22, 0.05, 20), P.white, [0, 0.72, 0.3], [PI / 2, 0, 0]));
  g.add(mk(cyl(0.12, 0.12, 0.06, 16), P.ink, [0, 0.72, 0.31], [PI / 2, 0, 0]));
  g.add(mk(cyl(0.12, 0.12, 0.05, 16), P.white, [0, 0.32, 0.3], [PI / 2, 0, 0]));
  g.add(mk(cyl(0.06, 0.06, 0.06, 12), P.ink, [0, 0.32, 0.31], [PI / 2, 0, 0]));
  g.scale.setScalar(s);
  return g;
}

export function micStand(c = P.purple) {
  const g = new THREE.Group();
  g.add(mk(cyl(0.3, 0.32, 0.05, 18), P.metal, [0, 0.03, 0]));
  g.add(mk(cyl(0.03, 0.03, 1.4, 8), P.metal, [0, 0.72, 0]));
  g.add(mk(cyl(0.05, 0.035, 0.22, 10), P.ink, [0, 1.48, 0.06], [0.5, 0, 0]));
  g.add(mk(sphere(0.1, 14, 10), glossy(c), [0, 1.6, 0.12]));
  return g;
}

export function bag(c = P.blue, c2 = P.butter) {
  const g = new THREE.Group();
  g.add(mk(rbox(0.5, 0.55, 0.3, 0.12), c, [0, 0.28, 0]));
  g.add(mk(rbox(0.36, 0.2, 0.08, 0.05), c2, [0, 0.2, 0.16]));
  g.add(mk(torus(0.14, 0.03, 6, 12, PI), c2, [0, 0.55, 0]));
  return g;
}

export function box(c = P.peach, s = 0.6) {
  const g = new THREE.Group();
  g.add(mk(rbox(s, s * 0.8, s, 0.06), c, [0, s * 0.4, 0]));
  g.add(mk(rbox(s * 1.02, 0.03, 0.12, 0.01), P.butter, [0, s * 0.8, 0]));
  return g;
}

export function bottle(c = P.blue) {
  const g = new THREE.Group();
  g.add(mk(cyl(0.09, 0.09, 0.4, 12), toon(c, { opacity: 0.85 }), [0, 0.2, 0]));
  g.add(mk(cyl(0.06, 0.06, 0.08, 10), P.white, [0, 0.44, 0]));
  return g;
}

// ---------------------------------------------------------------- outdoors
export function tree(s = 1, leaf = P.mintDeep, trunk = P.woodDeep, blossom = false) {
  const g = new THREE.Group();
  g.add(mk(cyl(0.16, 0.22, 1.4, 10), trunk, [0, 0.7, 0]));
  const cols = blossom ? [P.pink, P.pinkSoft, P.pinkDeep] : [leaf, P.mint, leaf];
  for (const [x, y, z, r, c] of [[0, 1.9, 0, 0.8, 0], [-0.45, 1.6, 0.2, 0.55, 1], [0.5, 1.65, -0.1, 0.55, 2], [0.1, 2.4, 0.1, 0.5, 1]] as const)
    g.add(mk(sphere(r, 14, 10), cols[c], [x, y, z]));
  g.scale.setScalar(s);
  return g;
}

export function bush(s = 1, c = P.mintDeep) {
  const g = new THREE.Group();
  for (const [x, y, z, r] of [[0, 0.3, 0, 0.4], [-0.35, 0.25, 0.05, 0.3], [0.35, 0.25, 0, 0.32]] as const) g.add(mk(sphere(r, 12, 8), c, [x, y, z]));
  g.scale.setScalar(s);
  return g;
}

export function flower(c = P.pink, s = 1) {
  const g = new THREE.Group();
  g.add(mk(cyl(0.02, 0.02, 0.35, 5), P.mintDeep, [0, 0.17, 0]));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2;
    g.add(mk(sphere(0.07, 6, 4), c, [Math.cos(a) * 0.07, 0.38, Math.sin(a) * 0.07]));
  }
  g.add(mk(sphere(0.05, 6, 4), P.butterDeep, [0, 0.39, 0]));
  g.scale.setScalar(s);
  return g;
}

export function fence(len: number, c = P.white) {
  const g = new THREE.Group();
  const n = Math.max(2, Math.round(len / 0.5));
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + (i * len) / n;
    g.add(mk(rbox(0.12, 0.7, 0.08, 0.04), c, [x, 0.35, 0]));
    g.add(mk(cone(0.085, 0.12, 4), c, [x, 0.76, 0], [0, PI / 4, 0]));
  }
  g.add(mk(rbox(len, 0.08, 0.06, 0.03), c, [0, 0.5, 0]));
  g.add(mk(rbox(len, 0.08, 0.06, 0.03), c, [0, 0.22, 0]));
  return g;
}

export function lampPost(c = P.white) {
  const g = new THREE.Group();
  g.add(mk(cyl(0.08, 0.12, 2.6, 10), c, [0, 1.3, 0]));
  g.add(mk(sphere(0.3, 14, 10), toon(0xfff5d6, { emissive: 0x554422 }), [0, 2.8, 0]));
  g.add(mk(cone(0.34, 0.2, 14), c, [0, 3.12, 0]));
  return g;
}

/** Fluffy sheep-shaped cloud (world mascot language). Not batched: it drifts. */
export function sheepCloud(s = 1) {
  const g = new THREE.Group();
  const white = toon(0xffffff, { emissive: 0x2a2a30 });
  for (const [x, y, z, r] of [[0, 0, 0, 0.9], [-0.8, -0.1, 0.1, 0.65], [0.8, -0.05, 0, 0.7], [-0.3, 0.45, 0, 0.6], [0.4, 0.4, 0.1, 0.55], [0, -0.35, 0.2, 0.6]] as const)
    g.add(mk(sphere(r, 12, 10), white, [x, y, z]));
  const face = new THREE.Group();
  face.position.set(1.3, -0.05, 0.35);
  face.add(mk(sphere(0.38, 12, 10), toon(P.skin), [0, 0, 0], [0, 0, 0], [1, 0.9, 0.85]));
  face.add(mk(sphere(0.05, 8, 6), toon(P.ink), [0.05, 0.05, 0.3]));
  face.add(mk(sphere(0.05, 8, 6), toon(P.ink), [0.22, 0.05, 0.22]));
  face.add(mk(sphere(0.16, 8, 6), toon(P.skin), [-0.08, 0.25, -0.2], [0, 0, 0.6], [1.4, 0.5, 0.7]));
  g.add(face);
  const m = merged(g);
  m.scale.setScalar(s);
  return m;
}

// ---------------------------------------------------------------- collectibles
/** Small sheep plushie (hidden collectible). */
export function sheepPlush(s = 1) {
  const g = new THREE.Group();
  const w = toon(0xffffff);
  g.add(mk(sphere(0.22, 12, 10), w, [0, 0.22, 0]));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; g.add(mk(sphere(0.11, 8, 6), w, [Math.cos(a) * 0.17, 0.26, Math.sin(a) * 0.15])); }
  g.add(mk(sphere(0.14, 12, 10), toon(P.skin), [0, 0.28, 0.2], [0, 0, 0], [1, 0.9, 0.9]));
  g.add(mk(sphere(0.022, 6, 4), toon(P.ink), [-0.05, 0.3, 0.32]));
  g.add(mk(sphere(0.022, 6, 4), toon(P.ink), [0.05, 0.3, 0.32]));
  g.add(mk(sphere(0.03, 6, 4), toon(P.blush), [-0.08, 0.25, 0.3]));
  g.add(mk(sphere(0.03, 6, 4), toon(P.blush), [0.08, 0.25, 0.3]));
  for (const sx of [-1, 1]) g.add(mk(sphere(0.06, 8, 6), toon(P.skin), [sx * 0.15, 0.33, 0.14], [0, 0, sx * -0.6], [1.4, 0.5, 0.7]));
  g.add(mk(torus(0.08, 0.02, 6, 12), toon(P.pinkDeep), [0, 0.12, 0.18], [0.4, 0, 0]));
  const m = merged(g);
  m.scale.setScalar(s);
  return m;
}

/** Round glossy sticker with an emoji, sparkling. */
export function stickerPickup(emoji: string) {
  const tex = canvasTex(128, 128, (g) => {
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(64, 64, 62, 0, PI * 2); g.fill();
    g.fillStyle = '#FFE3EA';
    g.beginPath(); g.arc(64, 64, 52, 0, PI * 2); g.fill();
    g.font = '64px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(emoji, 64, 70);
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.34, 28), mat);
  m.userData.noShadow = true;
  const g = new THREE.Group();
  g.add(m);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 6, 28), toon(P.pinkDeep, { emissive: 0x442233 }));
  g.add(ring);
  g.position.y = 1;
  return g;
}

export function shell(c = P.peach) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = -0.8 + i * 0.4;
    g.add(mk(sphere(0.1, 8, 6), toon(c), [Math.sin(a) * 0.1, 0.06, Math.cos(a) * 0.06], [0, a, 0], [0.5, 0.4, 1.4]));
  }
  g.add(mk(sphere(0.05, 8, 6), toon(P.pink), [0, 0.04, -0.06]));
  const m = merged(g);
  m.position.y = 0.3;
  return m;
}

/** Glowing floor marker (circle) that indicates an activity spot. Animated → dynamic. */
export function floorMark(color = P.pinkDeep, r = 0.8, icon?: string) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.78, r, 36), basic(color, 0.85));
  ring.rotation.x = -PI / 2;
  ring.position.y = 0.14;
  g.add(ring);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(r * 0.72, 36), basic(color, 0.35));
  inner.rotation.x = -PI / 2;
  inner.position.y = 0.135;
  g.add(inner);
  if (icon) {
    const t = canvasTex(128, 128, (c) => { c.font = '90px "Apple Color Emoji","Segoe UI Emoji",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(icon, 64, 70); });
    const ic = new THREE.Mesh(new THREE.PlaneGeometry(r, r), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    ic.rotation.x = -PI / 2;
    ic.position.y = 0.145;
    g.add(ic);
  }
  g.traverse((o) => { (o as THREE.Mesh).userData.dynamic = true; (o as THREE.Mesh).userData.noShadow = true; });
  return g;
}

/** Big sheep cushion (seat). */
export function sheepCushion(c = 0xffffff) {
  const g = new THREE.Group();
  g.add(mk(sphere(0.45, 14, 10), c, [0, 0.3, 0], [0, 0, 0], [1, 0.6, 1]));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; g.add(mk(sphere(0.18, 8, 6), c, [Math.cos(a) * 0.4, 0.32, Math.sin(a) * 0.4])); }
  g.add(mk(sphere(0.16, 10, 8), P.skin, [0, 0.4, 0.45], [0, 0, 0], [1, 0.9, 0.8]));
  g.add(mk(sphere(0.025, 6, 4), P.ink, [-0.05, 0.42, 0.58]));
  g.add(mk(sphere(0.025, 6, 4), P.ink, [0.05, 0.42, 0.58]));
  return g;
}

export function heartShape(c = P.strawberry, s = 1) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.5);
  shape.bezierCurveTo(-0.1, -0.35, -0.55, -0.15, -0.5, 0.15);
  shape.bezierCurveTo(-0.45, 0.45, -0.1, 0.5, 0, 0.25);
  shape.bezierCurveTo(0.1, 0.5, 0.45, 0.45, 0.5, 0.15);
  shape.bezierCurveTo(0.55, -0.15, 0.1, -0.35, 0, -0.5);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3, curveSegments: 10 });
  geo.center();
  const m = new THREE.Mesh(geo, toon(c));
  m.scale.setScalar(s);
  return m;
}

export { grp, mk, rbox, sphere, cyl, cone, torus, capsule, plane };
export type { V3 };

/** Soft additive sunbeam (fake god ray) — a tapered gradient quad. Not batched, no shadows. */
export function lightShaft(w = 1.6, h = 3.2, color = 0xfff2d6, opacity = 0.32) {
  const tex = canvasTex(64, 128, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(14, 0); g.lineTo(50, 0); g.lineTo(64, 128); g.lineTo(0, 128); g.closePath(); g.fill();
  }, true);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  m.userData.noShadow = true;
  m.userData.dynamic = true;
  return m;
}

/** Warm sunlight patch on the floor. */
export function sunPatch(w = 1.8, d = 1.4, opacity = 0.22) {
  const tex = canvasTex(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,245,215,1)');
    grd.addColorStop(1, 'rgba(255,245,215,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  }, true);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2;
  m.userData.noShadow = true;
  m.userData.dynamic = true;
  return m;
}

/** Sagging string of pastel triangle flags between two points (static). */
export function bunting(a: V3, b: V3, n = 12, colors: number[] = [P.pink, P.blue, P.butter, P.mint, P.lavender], sag = 0.5) {
  const g = new THREE.Group();
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const pt = (t: number) => A.clone().lerp(B, t).add(new THREE.Vector3(0, -Math.sin(t * PI) * sag, 0));
  const segs = 10;
  for (let i = 0; i < segs; i++) {
    const p0 = pt(i / segs), p1 = pt((i + 1) / segs);
    const mid = p0.clone().add(p1).multiplyScalar(0.5);
    const len = p0.distanceTo(p1);
    const m = mk(cyl(0.015, 0.015, len, 5), P.white);
    m.position.copy(mid);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
    g.add(m);
  }
  const dir = B.clone().sub(A).setY(0).normalize();
  const yaw = Math.atan2(dir.x, dir.z) + PI / 2;
  for (let i = 0; i < n; i++) {
    const p = pt((i + 0.5) / n);
    const f = mk(cone(0.16, 0.34, 3), colors[i % colors.length], [p.x, p.y - 0.17, p.z], [PI, yaw, 0], [1, 1, 0.25]);
    g.add(f);
  }
  return g;
}

/** Striped half-round shop awning (static). */
export function awning(w = 1.8, c = P.pink, c2 = P.white) {
  const g = new THREE.Group();
  const n = 8;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n);
    g.add(mk(rbox(w / n, 0.06, 0.8, 0.02), i % 2 ? c : c2, [x, 0, 0.35], [0.45, 0, 0]));
    g.add(mk(sphere(w / n / 2, 10, 6), i % 2 ? c : c2, [x, -0.18, 0.72], [0, 0, 0], [1, 0.6, 0.6]));
  }
  return g;
}
