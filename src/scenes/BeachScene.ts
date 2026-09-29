import * as THREE from 'three';
import { artTex } from '../assets/textures';
import { GameScene } from './GameScene';
import { P } from '../assets/palette';
import { mk, rbox, cyl, sphere, cone, torus, capsule, circle as circleGeo } from '../assets/geo';
import { toon, glossy } from '../assets/materials';
import { sign, poster, sheepCloud, sheepPlush, shell, stool, tree, bush, flower, lampPost } from '../assets/props';
import { canvasTex, sparkleTex, roundRect } from '../assets/textures';
import { StaticBatcher } from '../core/StaticBatcher';
import { box as colBox, circle } from '../core/Collision';
import { rng, todayKey, wait, dampK } from '../utils/math';
import { landmark } from '../assets/landmarks';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const PI = Math.PI;
/** Low-poly rounded box for small props (keeps the scene inside its triangle budget). */
const boxCache = new Map<string, THREE.BufferGeometry>();
const rb = (w: number, h: number, d: number, r?: number, seg = 1) => {
  const rad = r ?? Math.min(w, h, d) * 0.18;
  if (rad >= 0.04 || seg > 1) return rbox(w, h, d, r, seg);
  // tiny bevels are invisible at this camera distance: a plain box is 12 triangles instead of 108
  const k = `${w},${h},${d}`;
  let g = boxCache.get(k);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); g.userData.shared = true; boxCache.set(k, g); }
  return g;
};
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- layout constants
/** Sand island (wet rim) centre + half extents — the sea shader draws foam around it. */
const ISLAND = { cx: 0, cz: 3, hx: 13.5, hz: 6.6 };
const PIER_X = 6;
const PIER_HALF = 1.1;
const PIER_Z0 = -2.6; // starts on the sand
const PIER_Z1 = -13.3; // meets the lighthouse platform
const PLAT = { cx: 6, cz: -15.55, h: 2.3 }; // square platform half-size
const LH = { x: 6, z: -16.2 };
/** Higgsfield hq_lighthouse: fitted height, and its lantern-room centre as a fraction of that height. */
const LH_H = 6.4;
const LH_LANTERN = 0.74;
/** Café stall centre (café-local z): Sunny stands just behind it at z −0.3. */
const STALL_Z = 0.5;
const BENCH = { x: -1.5, z: -2.3 };
const FRAME = { x: 2.1, z: -1.95 };
const SUN_SIGN = { x: -4.4, z: -1.9 };
const CASTLE = { x: -8.3, z: -0.9 };

// ---------------------------------------------------------------- day ↔ sunset palettes
interface Look {
  skyTop: THREE.Color; skyMid: THREE.Color; skyBot: THREE.Color;
  shallow: THREE.Color; deep: THREE.Color; horizon: THREE.Color; foam: THREE.Color; glint: THREE.Color;
  hemiSky: THREE.Color; hemiGround: THREE.Color; hemi: number;
  sunCol: THREE.Color; sun: number; env: number;
  disc: THREE.Color; discPos: THREE.Vector3; discScale: number;
}
const C = (s: string) => new THREE.Color(s);
const DAY: Look = {
  skyTop: C('#9fcdfb'), skyMid: C('#cfe6ff'), skyBot: C('#ffe6ee'),
  shallow: C('#b9f1ea'), deep: C('#86c8f2'), horizon: C('#cfe4ff'), foam: C('#ffffff'), glint: C('#ffffff'),
  hemiSky: C('#ffffff'), hemiGround: C('#f6dce8'), hemi: 1.15,
  sunCol: C('#fff2e6'), sun: 2.1, env: 0.55,
  disc: C('#fff7dc'), discPos: V(-9, 12, -40), discScale: 7,
};
const SUNSET: Look = {
  skyTop: C('#b7a6f2'), skyMid: C('#ffb6c9'), skyBot: C('#ffd3ad'),
  shallow: C('#ffd6d9'), deep: C('#c7a6ee'), horizon: C('#ffc2c4'), foam: C('#fff4ec'), glint: C('#ffe2a8'),
  hemiSky: C('#ffe0ea'), hemiGround: C('#d9c4f2'), hemi: 1.05,
  sunCol: C('#ffb592'), sun: 1.9, env: 0.45,
  disc: C('#ffb08c'), discPos: V(-5, 2.1, -40), discScale: 12,
};

// ---------------------------------------------------------------- sea shader
const SEA_VERT = /* glsl */ `
uniform float uTime;
uniform vec4 uIsland;
uniform vec2 uHalf;
varying vec3 vWorld;
varying vec3 vN;
varying float vH;
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float wave(vec2 p, float t) {
  return sin(p.x * 0.33 + t * 0.9) * 0.07
       + sin(p.y * 0.47 - t * 1.25 + p.x * 0.18) * 0.06
       + sin((p.x + p.y) * 0.95 + t * 1.8) * 0.022;
}
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float d = sdBox(wp.xz - uIsland.xy, uIsland.zw);
  float amp = 0.3 + 0.7 * smoothstep(0.0, 4.0, d);
  float e = 0.25;
  float h0 = wave(wp.xz, uTime) * amp;
  float hx = wave(wp.xz + vec2(e, 0.0), uTime) * amp;
  float hz = wave(wp.xz + vec2(0.0, e), uTime) * amp;
  vN = normalize(vec3(h0 - hx, e, h0 - hz));
  vH = h0;
  wp.y += h0;
  // rounded "diorama" rim: the outer ring of vertices tucks down like the edge of a jelly cake
  vec2 q = abs(position.xy) - (uHalf - 0.01);
  if (q.x > 0.0 || q.y > 0.0) { wp.y -= 1.1; vN = vec3(0.0, 0.2, 1.0); }
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const SEA_FRAG = /* glsl */ `
uniform float uTime;
uniform vec4 uIsland;
uniform vec3 uShallow, uDeep, uHorizon, uFoam, uGlint, uSunDir;
varying vec3 vWorld;
varying vec3 vN;
varying float vH;
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 p = vWorld.xz;
  float d = sdBox(p - uIsland.xy, uIsland.zw);
  // pier + lighthouse platform (for a thin foam ring)
  float dp = min(sdBox(p - vec2(${PIER_X.toFixed(1)}, ${((PIER_Z0 + PIER_Z1) / 2).toFixed(2)}), vec2(${(PIER_HALF + 0.05).toFixed(2)}, ${((PIER_Z0 - PIER_Z1) / 2).toFixed(2)})),
                 sdBox(p - vec2(${PLAT.cx.toFixed(1)}, ${PLAT.cz.toFixed(2)}), vec2(${(PLAT.h + 0.05).toFixed(2)})) - 0.1);
  vec3 col = mix(uShallow, uDeep, smoothstep(0.2, 7.5, d));
  // melt into the horizon colour far away
  col = mix(col, uHorizon, smoothstep(-7.0, -22.0, vWorld.z) * 0.85);
  vec3 n = normalize(vN);
  float l = dot(n, normalize(uSunDir));
  col *= 0.93 + 0.09 * smoothstep(0.35, 0.9, l);
  // toon crest bands
  col = mix(col, col + vec3(0.07), smoothstep(0.045, 0.06, vH));
  // glitter: sparse twinkling cells that follow the waves
  vec2 cell = floor(p * vec2(2.2, 3.4) + vec2(uTime * 0.12, 0.0));
  float hs = hash(cell);
  float tw = step(0.965, hs) * pow(max(0.0, sin(uTime * 2.6 + hs * 60.0)), 6.0);
  vec2 f = fract(p * vec2(2.2, 3.4) + vec2(uTime * 0.12, 0.0)) - 0.5;
  float star = max(0.0, 1.0 - (abs(f.x) * abs(f.y) * 90.0 + length(f) * 2.4));
  col += uGlint * tw * star * 1.4 * smoothstep(0.5, 3.0, d);
  // view-dependent sun glint
  vec3 vdir = normalize(cameraPosition - vWorld);
  vec3 r = reflect(-normalize(uSunDir), n);
  col += uGlint * step(0.985, max(dot(r, vdir), 0.0)) * 0.25;
  // shore foam: a breathing edge + a line that rolls in every few seconds
  float t = uTime;
  float edge = 0.22 + 0.14 * sin(t * 1.1 + p.x * 0.33 + p.y * 0.2);
  float foam = 1.0 - smoothstep(edge, edge + 0.08, d);
  float ph = fract(t * 0.2 + sin(p.x * 0.23 + p.y * 0.17) * 0.06);
  float lineD = mix(2.4, 0.35, ph);
  foam += (1.0 - smoothstep(0.0, 0.09, abs(d - lineD))) * smoothstep(0.0, 0.25, ph) * (1.0 - ph) * 0.95;
  // little foam dots between the lines
  vec2 fc = fract(p * 4.0) - 0.5;
  float dots = step(0.6, hash(floor(p * 4.0))) * (1.0 - smoothstep(0.1, 0.17, length(fc))) * (1.0 - smoothstep(0.0, 1.0, d - edge)) * 0.8;
  foam += dots;
  foam += (1.0 - smoothstep(0.02, 0.14 + 0.05 * sin(t * 1.6 + p.y), dp)) * 0.85;
  col = mix(col, uFoam, clamp(foam, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const SPARK_VERT = /* glsl */ `
attribute float aPhase;
uniform float uTime;
uniform float uScale;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float tw = pow(max(0.0, sin(uTime * (1.1 + aPhase) + aPhase * 6.2831)), 4.0);
  vA = tw;
  gl_PointSize = (0.06 + 0.32 * tw) * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const SPARK_FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform vec3 uColor;
varying float vA;
void main() {
  vec4 t = texture2D(uTex, gl_PointCoord);
  gl_FragColor = vec4(uColor * t.rgb, t.a * vA);
}`;

/**
 * Keep a (landmark) model out of the shadow pass: the Higgsfield props are 4–15k triangles each, so they don't cast
 * themselves — a few-hundred-triangle invisible stand-in (castProxy) casts their shadow instead.
 */
function noCast(o: THREE.Object3D) {
  o.traverse((c) => {
    (c as THREE.Mesh).castShadow = false;
    c.userData.noShadow = true;
  });
  return o;
}
/** Shadow stand-in parts (fresh geometries, local to the prop's base centre). */
const pCyl = (rt: number, rb: number, h: number, y: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, y, 0);
const pCone = (r: number, h: number, y: number, seg = 12) => new THREE.ConeGeometry(r, h, seg).translate(0, y, 0);
const pBox = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

/** Merge a little dynamic prop into ONE vertex-coloured mesh (one draw call) that can still move. */
function bake(g: THREE.Object3D): THREE.Object3D {
  g.updateMatrixWorld(true);
  g.traverse((o) => (o.userData.dynamic = false));
  const b = new StaticBatcher();
  b.shade = false;
  b.addObject(g);
  const m = b.build('baked');
  if (!m) return g;
  m.matrixAutoUpdate = true;
  const out = new THREE.Group();
  out.add(m);
  // leftovers (textured bits) stay attached
  for (const c of [...g.children]) out.add(c);
  return out;
}

// ---------------------------------------------------------------- props (local to this scene)
function stripeCone(r: number, h: number, n: number, c1: number, c2: number) {
  const g = new THREE.Group();
  const step = (PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const geo = new THREE.ConeGeometry(r, h, 3, 1, true, i * step, step);
    g.add(mk(geo, i % 2 ? c2 : c1));
  }
  return g;
}

function umbrella(c1: number, c2 = P.white, tilt = 0.12) {
  const g = new THREE.Group();
  const top = new THREE.Group();
  top.rotation.z = tilt;
  top.add(mk(cyl(0.05, 0.05, 2.5, 8), P.white, [0, 1.25, 0]));
  const can = stripeCone(1.55, 0.6, 10, c1, c2);
  can.position.y = 2.45;
  top.add(can);
  top.add(mk(torus(1.53, 0.05, 4, 20), c1, [0, 2.16, 0], [PI / 2, 0, 0]));
  top.add(mk(sphere(0.1, 8, 6), c1, [0, 2.8, 0]));
  g.add(top);
  g.add(mk(cyl(0.18, 0.24, 0.08, 12), P.sand, [0, 0.12, 0]));
  g.scale.setScalar(0.86);
  return g;
}

function deckChair(c: number) {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    g.add(mk(rb(0.07, 0.07, 1.25, 0.03), P.woodDeep, [sx * 0.33, 0.28, 0.1], [0.08, 0, 0]));
    g.add(mk(cyl(0.035, 0.035, 0.3, 6), P.woodDeep, [sx * 0.33, 0.14, 0.62]));
    g.add(mk(rb(0.07, 0.07, 0.95, 0.03), P.woodDeep, [sx * 0.33, 0.58, -0.4], [1.0, 0, 0]));
  }
  // fabric with a white stripe
  g.add(mk(rb(0.6, 0.05, 0.9, 0.02), c, [0, 0.33, 0.22], [0.08, 0, 0]));
  g.add(mk(rb(0.6, 0.05, 0.85, 0.02), c, [0, 0.62, -0.36], [1.0, 0, 0]));
  g.add(mk(rb(0.18, 0.055, 0.9, 0.02), P.white, [0, 0.335, 0.22], [0.08, 0, 0]));
  g.add(mk(rb(0.18, 0.055, 0.85, 0.02), P.white, [0, 0.625, -0.36], [1.0, 0, 0]));
  g.add(mk(sphere(0.16, 8, 6), P.white, [0, 0.86, -0.6], [0, 0, 0], [1.4, 0.7, 0.8])); // pillow
  return g;
}

function towel(c: number, w = 1.0, d = 1.8) {
  const g = new THREE.Group();
  g.add(mk(rb(w, 0.035, d, 0.015), c, [0, 0.11, 0]));
  for (const z of [-d * 0.3, 0, d * 0.3]) g.add(mk(rb(w + 0.005, 0.04, 0.12, 0.015), P.white, [0, 0.112, z]));
  return g;
}

function beachBall(r = 0.28) {
  const g = new THREE.Group();
  const cols = [P.strawberry, P.white, P.blue, P.white, P.butter, P.white];
  for (let i = 0; i < 6; i++) {
    g.add(mk(new THREE.SphereGeometry(r, 3, 10, (i * PI) / 3, PI / 3), cols[i], [0, r + 0.08, 0]));
  }
  g.add(mk(sphere(r * 0.22, 8, 6), P.white, [0, r * 2 + 0.07, 0]));
  return g;
}

function starfish(c = P.peachDeep) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2;
    g.add(mk(capsule(0.05, 0.16, 2, 6), c, [Math.cos(a) * 0.1, 0.12, Math.sin(a) * 0.1], [PI / 2, 0, -a + PI / 2]));
  }
  g.add(mk(sphere(0.08, 8, 6), c, [0, 0.12, 0], [0, 0, 0], [1, 0.5, 1]));
  return g;
}

function sandcastle() {
  const g = new THREE.Group();
  const s1 = 0xf8dfb0, s2 = 0xf2d19a;
  g.add(mk(cyl(1.05, 1.15, 0.3, 20), s2, [0, 0.15, 0]));
  g.add(mk(cyl(0.55, 0.62, 0.75, 16), s1, [0, 0.62, 0]));
  g.add(mk(cyl(0.34, 0.4, 0.45, 14), s1, [0, 1.2, 0]));
  g.add(mk(cone(0.36, 0.35, 14), s2, [0, 1.6, 0]));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2 + PI / 4;
    const x = Math.cos(a) * 0.78, z = Math.sin(a) * 0.78;
    g.add(mk(cyl(0.2, 0.24, 0.62, 12), s1, [x, 0.6, z]));
    g.add(mk(cone(0.24, 0.3, 12), s2, [x, 1.06, z]));
  }
  // arch gate (front) and tiny windows
  g.add(mk(rb(0.26, 0.34, 0.1, 0.05), 0xe8c088, [0, 0.45, 0.6]));
  // flag
  g.add(mk(cyl(0.015, 0.015, 0.45, 5), P.white, [0, 1.95, 0]));
  g.add(mk(cone(0.12, 0.26, 3), P.strawberry, [0.12, 2.08, 0], [0, 0, -PI / 2], [1, 1, 0.35]));
  // shells pressed into the walls
  for (const [x, y, z, c] of [[0.3, 0.7, 0.5, P.pink], [-0.35, 0.8, 0.45, P.lavender], [0.1, 1.25, 0.33, P.peach]] as const)
    g.add(mk(sphere(0.06, 8, 6), c, [x, y, z], [0, 0, 0], [1, 1, 0.5]));
  // bucket + spade
  g.add(mk(cyl(0.2, 0.15, 0.3, 12), P.pinkDeep, [1.25, 0.25, 0.35]));
  g.add(mk(torus(0.18, 0.02, 5, 14, PI), P.white, [1.25, 0.4, 0.35]));
  g.add(mk(rb(0.12, 0.03, 0.3, 0.01), P.blue, [1.1, 0.12, 0.9], [0, 0.6, 0]));
  g.add(mk(cyl(0.02, 0.02, 0.4, 5), P.blue, [1.0, 0.14, 1.15], [PI / 2, 0, 0.6]));
  return g;
}

function lighthouse() {
  const g = new THREE.Group();
  const bands: [number, number, number, number][] = [
    [1.15, 0.98, 1.2, P.strawberry],
    [0.98, 0.86, 1.1, P.white],
    [0.86, 0.75, 1.1, P.strawberry],
    [0.75, 0.66, 1.0, P.white],
  ];
  let y = 0.15;
  for (const [rb, rt, h, c] of bands) {
    g.add(mk(cyl(rt, rb, h, 22), c, [0, y + h / 2, 0]));
    y += h;
  }
  // gallery
  g.add(mk(cyl(1.0, 0.9, 0.18, 22), P.white, [0, y + 0.09, 0]));
  g.add(mk(torus(0.98, 0.04, 5, 26), P.strawberry, [0, y + 0.5, 0], [PI / 2, 0, 0]));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * PI * 2;
    g.add(mk(cyl(0.025, 0.025, 0.36, 5), P.white, [Math.cos(a) * 0.97, y + 0.34, Math.sin(a) * 0.97]));
  }
  const lanternY = y + 0.62;
  g.add(mk(cyl(0.6, 0.6, 0.12, 20), P.strawberry, [0, lanternY + 0.5, 0]));
  g.add(mk(cone(0.66, 0.7, 20), P.strawberry, [0, lanternY + 0.9, 0]));
  g.add(mk(sphere(0.14, 8, 6), P.butter, [0, lanternY + 1.32, 0]));
  // door + windows facing +Z
  g.add(mk(rb(0.55, 0.85, 0.2, 0.1), P.pinkDeep, [0, 0.6, 1.08], [-0.1, 0, 0]));
  g.add(mk(torus(0.14, 0.035, 5, 14), P.white, [0, 2.05, 0.93], [-0.08, 0, 0]));
  g.add(mk(circleGeo(0.12, 14), toon(0xdff1ff, { emissive: 0x223344 }), [0, 2.05, 0.94], [-0.08, 0, 0]));
  g.add(mk(torus(0.12, 0.03, 5, 14), P.strawberry, [0, 3.2, 0.8], [-0.1, 0, 0]));
  g.add(mk(circleGeo(0.1, 14), toon(0xdff1ff, { emissive: 0x223344 }), [0, 3.2, 0.81], [-0.1, 0, 0]));
  return { g, lanternY };
}

function stationBuilding() {
  const g = new THREE.Group();
  g.add(mk(rb(4.6, 0.2, 3.4, 0.08), P.white, [0, 0.1, 0]));
  g.add(mk(rb(4.0, 2.7, 2.8, 0.3), P.mint, [0, 1.5, 0]));
  g.add(mk(rb(4.5, 0.35, 3.3, 0.14), P.mintDeep, [0, 2.95, 0]));
  g.add(mk(sphere(1.0, 14, 7), P.mintDeep, [0, 3.1, -0.2], [0, 0, 0], [1.3, 0.55, 1]));
  g.add(mk(sphere(0.16, 8, 6), P.butter, [0, 3.7, -0.2]));
  // arch doorway
  g.add(mk(rb(1.8, 2.2, 0.16, 0.08), P.white, [0, 1.25, 1.36]));
  g.add(mk(cyl(0.9, 0.9, 0.16, 20), P.white, [0, 2.3, 1.36], [PI / 2, 0, 0]));
  g.add(mk(rb(1.45, 1.95, 0.12, 0.08), 0x9fc6ee, [0, 1.2, 1.42]));
  g.add(mk(cyl(0.72, 0.72, 0.12, 20), 0x9fc6ee, [0, 2.2, 1.42], [PI / 2, 0, 0]));
  // steps going down inside
  for (let i = 0; i < 3; i++) g.add(mk(rb(1.3, 0.1, 0.2, 0.03), 0xc6dff7, [0, 0.35 + i * 0.28, 1.47 - i * 0.02]));
  // round windows
  for (const sx of [-1, 1]) {
    g.add(mk(torus(0.34, 0.07, 6, 20), P.white, [sx * 1.45, 1.75, 1.42]));
    g.add(mk(circleGeo(0.3, 20), toon(0xdff1ff, { emissive: 0x223344 }), [sx * 1.45, 1.75, 1.41]));
    // planters
    g.add(mk(rb(0.7, 0.4, 0.45, 0.1), P.pinkSoft, [sx * 1.4, 0.4, 1.7]));
    for (let i = 0; i < 3; i++) g.add(mk(sphere(0.1, 8, 6), [P.pink, P.butter, P.white][i], [sx * 1.4 - 0.22 + i * 0.22, 0.68, 1.72]));
  }
  // metro pole with a ring logo
  g.add(mk(cyl(0.06, 0.08, 2.6, 8), P.white, [2.55, 1.3, 1.9]));
  g.add(mk(torus(0.32, 0.07, 6, 20), P.mintDeep, [2.55, 2.85, 1.9]));
  g.add(mk(circleGeo(0.28, 20), toon(P.white), [2.55, 2.85, 1.91]));
  return g;
}

function cafeStall() {
  const g = new THREE.Group();
  g.add(mk(rb(4.4, 0.14, 3.3, 0.06), P.wood, [0, 0.07, -0.2]));
  // counter
  g.add(mk(rb(3.2, 0.75, 0.6, 0.1), P.cream, [0, 0.4, 0.3]));
  g.add(mk(rb(0.9, 0.3, 0.7, 0.08), P.woodDeep, [0, 0.15, -0.35])); // Sunny's step
  g.add(mk(rb(3.0, 0.5, 0.06, 0.03), P.pinkSoft, [0, 0.4, 0.62]));
  for (let i = 0; i < 5; i++) g.add(mk(heartShapeGeo(), P.pinkDeep, [-1.2 + i * 0.6, 0.4, 0.66], [0, 0, 0], 0.17));
  g.add(mk(rb(3.4, 0.1, 0.8, 0.04), P.wood, [0, 0.8, 0.3]));
  // back shelf with cups + fruit
  g.add(mk(rb(3.3, 1.5, 0.45, 0.08), P.white, [0, 0.75, -1.35]));
  for (let i = 0; i < 6; i++) g.add(mk(cyl(0.09, 0.08, 0.22, 10), [P.peach, P.pink, P.mint][i % 3], [-1.25 + i * 0.5, 1.62, -1.3]));
  for (let i = 0; i < 4; i++) g.add(mk(sphere(0.12, 8, 6), P.peachDeep, [-0.9 + i * 0.6, 1.08, -1.2]));
  // posts
  for (const [x, z] of [[-1.95, 0.9], [1.95, 0.9], [-1.95, -1.55], [1.95, -1.55]])
    g.add(mk(cyl(0.07, 0.07, 2.75, 8), P.white, [x, 1.38, z]));
  // striped awning + scalloped valance
  const n = 8;
  for (let i = 0; i < n; i++) {
    const x = -2.1 + (i + 0.5) * (4.2 / n);
    g.add(mk(rb(4.2 / n + 0.01, 0.08, 3.0, 0.03), i % 2 ? P.white : P.peachDeep, [x, 2.86, -0.3], [0.16, 0, 0]));
    g.add(mk(sphere(4.2 / n / 2, 10, 6, ), i % 2 ? P.white : P.peachDeep, [x, 2.6, 1.2], [0, 0, 0], [1, 0.7, 0.3]));
  }
  // counter goodies
  g.add(mk(cyl(0.2, 0.2, 0.45, 14), glossy(P.peach), [-1.1, 1.08, 0.25]));
  g.add(mk(cyl(0.21, 0.21, 0.06, 14), P.white, [-1.1, 1.33, 0.25]));
  g.add(mk(cyl(0.05, 0.05, 0.1, 8), P.pinkDeep, [-1.1, 0.92, 0.47], [PI / 2, 0, 0]));
  for (let i = 0; i < 3; i++) {
    g.add(mk(cyl(0.1, 0.08, 0.1, 10), P.butter, [0.5 + i * 0.32, 0.9, 0.35]));
    g.add(mk(sphere(0.1, 8, 6), [P.pink, P.lavender, P.mint][i], [0.5 + i * 0.32, 0.98, 0.35], [0, 0, 0], [1, 0.8, 1]));
  }
  return g;
}
let heartGeo: THREE.BufferGeometry | null = null;
/** Low-poly puffy heart (≈60 tris) — the shared props heart is ~640. */
function heartShapeGeo() {
  if (!heartGeo) {
    const sh = new THREE.Shape();
    sh.moveTo(0, -0.5);
    sh.bezierCurveTo(-0.1, -0.35, -0.55, -0.15, -0.5, 0.15);
    sh.bezierCurveTo(-0.45, 0.45, -0.1, 0.5, 0, 0.25);
    sh.bezierCurveTo(0.1, 0.5, 0.45, 0.45, 0.5, 0.15);
    sh.bezierCurveTo(0.55, -0.15, 0.1, -0.35, 0, -0.5);
    heartGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: false, curveSegments: 4 });
    heartGeo.center();
    heartGeo.userData.shared = true;
  }
  return heartGeo;
}

function boat() {
  const g = new THREE.Group();
  g.add(mk(rb(2.3, 0.55, 1.0, 0.25), P.pink, [0, 0.1, 0]));
  g.add(mk(rb(2.32, 0.1, 1.02, 0.04), P.white, [0, 0.22, 0]));
  g.add(mk(cone(0.5, 0.7, 10), P.pink, [1.3, 0.1, 0], [0, 0, -PI / 2], [1, 1, 1.0]));
  g.add(mk(rb(0.9, 0.55, 0.75, 0.12), P.white, [-0.3, 0.62, 0]));
  g.add(mk(rb(1.05, 0.1, 0.9, 0.05), P.blue, [-0.3, 0.93, 0]));
  g.add(mk(circleGeo(0.12, 12), toon(0xdff1ff, { emissive: 0x223344 }), [-0.3, 0.64, 0.38]));
  g.add(mk(cyl(0.025, 0.025, 0.8, 5), P.white, [-0.5, 1.35, 0]));
  g.add(mk(cone(0.14, 0.3, 3), P.butter, [-0.34, 1.6, 0], [0, 0, -PI / 2], [1, 1, 0.3]));
  g.add(mk(torus(0.14, 0.05, 6, 14), P.strawberry, [0.4, 0.3, 0.5]));
  return g;
}

function dolphin() {
  const g = new THREE.Group();
  const c = 0x9cc8f5;
  g.add(mk(capsule(0.26, 0.8, 4, 10), c, [0, 0, 0], [0, 0, PI / 2]));
  g.add(mk(sphere(0.2, 8, 6), P.white, [0.1, -0.1, 0], [0, 0, 0], [2.2, 0.6, 0.9]));
  g.add(mk(cyl(0.07, 0.12, 0.28, 8), c, [0.68, -0.04, 0], [0, 0, PI / 2]));
  g.add(mk(cone(0.16, 0.34, 6), c, [-0.05, 0.3, 0], [0, 0, 0.35], [1, 1, 0.35]));
  for (const s of [-1, 1]) {
    g.add(mk(sphere(0.14, 8, 6), c, [-0.68, 0, s * 0.14], [0, s * 0.6, 0], [0.5, 0.2, 1.3]));
    g.add(mk(sphere(0.035, 6, 4), P.ink, [0.42, 0.07, s * 0.2]));
    g.add(mk(sphere(0.04, 6, 4), P.blush, [0.44, -0.03, s * 0.21]));
  }
  return g;
}

function sheepFloat() {
  const g = new THREE.Group();
  g.add(mk(torus(0.5, 0.2, 8, 20), P.white, [0, 0.05, 0], [PI / 2, 0, 0]));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    g.add(mk(sphere(0.14, 8, 6), P.white, [Math.cos(a) * 0.5, 0.2, Math.sin(a) * 0.5]));
  }
  g.add(mk(sphere(0.24, 12, 10), P.skin, [0, 0.32, 0.55], [0, 0, 0], [1, 0.9, 0.85]));
  g.add(mk(sphere(0.03, 6, 4), P.ink, [-0.08, 0.36, 0.76]));
  g.add(mk(sphere(0.03, 6, 4), P.ink, [0.08, 0.36, 0.76]));
  for (const s of [-1, 1]) g.add(mk(sphere(0.09, 8, 6), P.skin, [s * 0.24, 0.42, 0.5], [0, 0, s * -0.6], [1.4, 0.5, 0.7]));
  return g;
}

function peachCup() {
  const g = new THREE.Group();
  g.add(mk(cyl(0.085, 0.065, 0.24, 12), glossy(P.peach), [0, 0.02, 0.06]));
  g.add(mk(cyl(0.09, 0.09, 0.03, 12), P.white, [0, 0.15, 0.06]));
  g.add(mk(cyl(0.012, 0.012, 0.2, 5), P.strawberry, [0.02, 0.24, 0.06], [0, 0, -0.2]));
  g.add(mk(sphere(0.045, 8, 6), P.peachDeep, [-0.04, 0.18, 0.06]));
  return g;
}

function glowTex() {
  return canvasTex(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.32, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.42, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  });
}

// ================================================================= scene
export default class BeachScene extends GameScene {
  readonly id = 'beach' as const;
  readonly title = 'Sweet Sea Beach';
  subtitle = 'a little harbour by the pastel sea';
  music = 'beach' as const;
  ambience = 'waves';

  private skyCanvas!: HTMLCanvasElement;
  private skyTex!: THREE.CanvasTexture;
  private seaMat!: THREE.ShaderMaterial;
  private sparkMat!: THREE.ShaderMaterial;
  private sunDisc!: THREE.Sprite;
  private beamPivot!: THREE.Group;
  private beamMat!: THREE.MeshBasicMaterial;
  private lanternMat!: THREE.MeshStandardMaterial;
  /** warm halo in front of the landmark lighthouse's lantern (fades in at sunset) */
  private lanternGlow!: THREE.SpriteMaterial;
  /** draws nothing, only casts shadows (see castProxy) */
  private proxyMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  /**
   * Flat ground / far-away statics (sand slabs, sea cake, pebbles, pier deck, distant hill): merged like the statics
   * but kept out of the shadow pass — their shadows land on nothing visible. Frees shadow triangles for the landmarks.
   */
  private ground = new THREE.Group();
  /** true when the Higgsfield café stall loaded (its counter is deeper than the old one) */
  private stallModel = false;
  private clouds: THREE.Object3D[] = [];
  private mix = 0; // 0 = day, 1 = sunset
  private mixTarget = 0;
  private lastDrawn = -1;
  private look = cloneLook(DAY);
  private tmpV = new THREE.Vector2();

  async build() {
    // Higgsfield landmark props load in parallel; each keeps its procedural version as a fallback
    const loads: Promise<unknown>[] = [];
    this.mix = this.mixTarget = this.game.save.flag('beachSunset', false) ? 1 : 0;
    this.buildSky();
    this.light({ dir: [-5, 9, -6], shadowRange: 12, hemi: DAY.hemi, env: DAY.env });
    this.bounds = { minX: -12.5, maxX: 12.5, minZ: PLAT.cz - PLAT.h + 0.1, maxZ: 8.7 };
    this.cam = { dist: 18, pitch: 0.56, yawRange: 0.6, fov: 36, lookY: 1, clamp: { minX: -6.5, maxX: 6.5, minZ: -12, maxZ: 4.5 } };

    this.buildSea();
    this.buildIsland();
    this.buildPier(loads);
    this.buildStation();
    this.buildCafe(loads);
    this.buildBeachLife(loads);
    this.buildDistance();
    this.buildInteractions();
    this.buildCollectibles();
    await Promise.all(loads);
    this.bakeGround();

    this.spawnNpcs({ sunny: this.cafeLocal(0, -0.3, true), pado: [-4.9, 1.4, 2.6] });
    const sunny = this.npcs.find((n) => n.def.id === 'sunny');
    if (sunny) sunny.root.position.y = 0.3; // stands on a little step behind the counter
    if (this.stallModel) {
      // the model stall's counter is ~1.4 deep: let Hamin still chat with Sunny from the customer side
      const it = this.interactables.find((i) => i.id === 'npc:sunny');
      if (it) it.radius = 2.3;
    }
    this.applyLook(true);
  }

  private bakeGround() {
    const b = new StaticBatcher();
    b.addObject(this.ground);
    const m = b.build(this.id + '-ground');
    if (m) {
      m.castShadow = false;
      m.userData.noShadow = true; // finalize(): don't turn casting back on
      this.scene.add(m);
    }
    if (this.ground.children.length) this.scene.add(this.ground);
  }

  /** An invisible low-poly shape that only casts the shadow of the landmark model placed at x/z (rotated rotY). */
  private castProxy(x: number, z: number, rotY: number, parts: THREE.BufferGeometry[]) {
    const geo = mergeGeometries(parts);
    for (const p of parts) p.dispose();
    const m = new THREE.Mesh(geo, this.proxyMat);
    m.position.set(x, 0, z);
    m.rotation.y = rotY;
    m.castShadow = true;
    m.userData.noShadow = true; // finalize(): leave the flags alone (it never receives)
    this.addDynamic(m);
    return m;
  }

  // ------------------------------------------------------------ sky
  private buildSky() {
    this.skyCanvas = document.createElement('canvas');
    this.skyCanvas.width = 640;
    this.skyCanvas.height = 360;
    this.skyTex = new THREE.CanvasTexture(this.skyCanvas);
    this.skyTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.skyTex;
  }

  private skyK = 0;
  private drawSky(l: Look) {
    const g = this.skyCanvas.getContext('2d')!;
    const w = this.skyCanvas.width, h = this.skyCanvas.height;
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#' + l.skyTop.getHexString());
    grd.addColorStop(0.5, '#' + l.skyMid.getHexString());
    grd.addColorStop(1, '#' + l.skyBot.getHexString());
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    // painted Higgsfield skies (day ↔ sunset) cross-fade over the gradient once loaded
    const day = artTex('sky_day').image as HTMLImageElement | undefined;
    const dusk = artTex('sky_sunset').image as HTMLImageElement | undefined;
    const ready = (im?: HTMLImageElement) => !!im && (im as any).width > 0 && (im.complete ?? true);
    if (ready(day) && ready(dusk)) {
      g.globalAlpha = 1;
      g.drawImage(day!, 0, 0, w, h);
      g.globalAlpha = this.skyK;
      g.drawImage(dusk!, 0, 0, w, h);
      g.globalAlpha = 1;
    } else setTimeout(() => this.applyLook(true), 400);
    this.skyTex.needsUpdate = true;
  }

  // ------------------------------------------------------------ sea
  private buildSea() {
    const W = 64, D = 46;
    const geo = new THREE.PlaneGeometry(W, D, 64, 36);
    this.seaMat = new THREE.ShaderMaterial({
      vertexShader: SEA_VERT,
      fragmentShader: SEA_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uIsland: { value: new THREE.Vector4(ISLAND.cx, ISLAND.cz, ISLAND.hx - 0.25, ISLAND.hz - 0.25) },
        uHalf: { value: new THREE.Vector2(W / 2, D / 2) },
        uShallow: { value: DAY.shallow.clone() },
        uDeep: { value: DAY.deep.clone() },
        uHorizon: { value: DAY.horizon.clone() },
        uFoam: { value: DAY.foam.clone() },
        uGlint: { value: DAY.glint.clone() },
        uSunDir: { value: V(-5, 9, -6).normalize() },
      },
    });
    const sea = new THREE.Mesh(geo, this.seaMat);
    sea.rotation.x = -PI / 2;
    sea.position.set(0, -0.02, -1);
    sea.userData.noShadow = true;
    sea.frustumCulled = false;
    this.addDynamic(sea);
    // soft blue "cake" under the jelly sea rim
    this.ground.add(mk(rb(W - 0.6, 1.6, D - 0.6, 0.6, 1), P.seaDeep, [0, -1.95, -1]));

    // twinkling sparkles floating on the water (one draw call)
    const N = 46;
    const r = rng(7);
    const pos = new Float32Array(N * 3);
    const ph = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let x = 0, z = 0;
      do { x = -26 + r() * 52; z = -21 + r() * 30; } while (Math.abs(x) < ISLAND.hx + 0.6 && z > ISLAND.cz - ISLAND.hz - 0.6);
      pos[i * 3] = x; pos[i * 3 + 1] = 0.22 + r() * 0.15; pos[i * 3 + 2] = z;
      ph[i] = r();
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pg.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    this.sparkMat = new THREE.ShaderMaterial({
      vertexShader: SPARK_VERT,
      fragmentShader: SPARK_FRAG,
      uniforms: { uTime: { value: 0 }, uScale: { value: 900 }, uTex: { value: sparkleTex() }, uColor: { value: C('#ffffff') } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(pg, this.sparkMat);
    pts.frustumCulled = false;
    pts.renderOrder = 3;
    this.addDynamic(pts);

    // sun / sunset glow disc (sets behind the jelly sea rim)
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: DAY.disc.clone(), transparent: true, depthWrite: false, fog: false }));
    this.sunDisc.renderOrder = -1;
    this.addDynamic(this.sunDisc);

    this.onUpdate((_dt, t) => {
      this.seaMat.uniforms.uTime.value = t;
      this.sparkMat.uniforms.uTime.value = t;
      const r2 = this.game.engine.renderer;
      r2.getDrawingBufferSize(this.tmpV);
      this.sparkMat.uniforms.uScale.value = this.tmpV.y * 1.4;
    });
  }

  // ------------------------------------------------------------ sand island
  private buildIsland() {
    const s = this.ground;
    const { cx, cz, hx, hz } = ISLAND;
    s.add(mk(rb(hx * 2, 0.9, hz * 2, 0.42, 2), 0xf7dcb4, [cx, -0.41, cz])); // wet sand rim (top 0.04)
    s.add(mk(rb(hx * 2 - 1.2, 0.3, hz * 2 - 1.2, 0.14, 2), P.sand, [cx, -0.05, cz])); // dry sand (top 0.1)
    // soft dunes near the front + little pebbles
    for (const [x, z, sx, sz] of [[-11.2, 8.4, 2.2, 1.2], [11.5, 8.2, 2.4, 1.1], [-2.5, 8.8, 3, 0.8], [7, 8.9, 2.6, 0.7]] as const)
      s.add(mk(sphere(1, 12, 6), 0xfff1d8, [x, -0.15, z], [0, 0, 0], [sx, 0.45, sz]));
    const r = rng(21);
    const peb = [P.peach, P.pinkSoft, P.lavender, 0xf3dcbc, P.blueSoft];
    for (let i = 0; i < 30; i++) {
      const x = -12 + r() * 24, z = -2.7 + r() * 11.2;
      s.add(mk(sphere(0.07 + r() * 0.05, 5, 3), peb[i % peb.length], [x, 0.1, z], [0, r() * 3, 0], [1.3, 0.45, 1]));
    }
    for (const [x, z, c] of [[-6.2, 7.6, P.peachDeep], [3.3, 6.8, P.pinkDeep], [9.2, -1.8, P.strawberry]] as const) {
      const st = starfish(c);
      st.position.set(x, 0, z);
      st.rotation.y = x;
      s.add(st);
    }
    // decorative non-collectible shells (flat, pressed into the sand)
    for (const [x, z, c] of [[-3.8, -2.4, P.pink], [4.1, 3.2, P.lavender], [-10.5, 7.9, P.butter], [0.8, 8.1, P.mint]] as const) {
      const d = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const a = -0.8 + i * 0.4;
        d.add(mk(sphere(0.1, 7, 5), c, [Math.sin(a) * 0.1, 0.1, Math.cos(a) * 0.06], [0, a, 0], [0.5, 0.35, 1.4]));
      }
      d.position.set(x, 0, z);
      d.rotation.y = x * 1.7;
      s.add(d);
    }
  }

  // ------------------------------------------------------------ pier + lighthouse
  private buildPier(loads: Promise<unknown>[]) {
    const s = this.statics;
    const len = PIER_Z0 - PIER_Z1;
    const midZ = (PIER_Z0 + PIER_Z1) / 2;
    // beams + planks
    const deck = this.ground; // beams, planks and platform slabs only shade the sea
    for (const sx of [-1, 1]) deck.add(mk(rb(0.2, 0.2, len, 0.06), P.woodDeep, [PIER_X + sx * 0.8, -0.04, midZ]));
    const plank = new THREE.BoxGeometry(PIER_HALF * 2, 0.08, 0.42);
    plank.userData.shared = true;
    let i = 0;
    for (let z = PIER_Z0 - 0.25; z > PIER_Z1 + 0.1; z -= 0.49, i++) deck.add(mk(plank, i % 2 ? P.wood : 0xf2d4a8, [PIER_X, 0.1, z]));
    // posts + rope rail
    for (const sx of [-1, 1]) {
      const x = PIER_X + sx * (PIER_HALF - 0.02);
      for (let z = PIER_Z0 - 1.2; z >= PIER_Z1 - 0.1; z -= 1.8) {
        s.add(mk(cyl(0.09, 0.1, 1.5, 8), P.white, [x, 0.1, z]));
        s.add(mk(sphere(0.12, 6, 4), P.strawberry, [x, 0.9, z]));
      }
      s.add(mk(cyl(0.035, 0.035, len - 1.4, 6), P.pinkDeep, [x, 0.7, midZ - 0.4], [PI / 2, 0, 0]));
    }
    // platform
    deck.add(mk(rb(PLAT.h * 2, 0.26, PLAT.h * 2, 0.12), P.wood, [PLAT.cx, -0.03, PLAT.cz]));
    deck.add(mk(rb(PLAT.h * 2 - 0.5, 0.05, PLAT.h * 2 - 0.5, 0.04), 0xf2d4a8, [PLAT.cx, 0.1, PLAT.cz]));
    for (let k = 0; k < 14; k++) {
      const t = k / 14;
      // perimeter posts (skip the entry gap facing the pier)
      const per = t * 4;
      const side = Math.floor(per), f = per - side;
      const h = PLAT.h - 0.12;
      let x = 0, z = 0;
      if (side === 0) { x = -h + f * 2 * h; z = -h; }
      else if (side === 1) { x = h; z = -h + f * 2 * h; }
      else if (side === 2) { x = h - f * 2 * h; z = h; }
      else { x = -h; z = h - f * 2 * h; }
      if (side === 2 && Math.abs(x) < PIER_HALF + 0.2) continue;
      s.add(mk(cyl(0.08, 0.09, 1.0, 8), P.white, [PLAT.cx + x, 0.45, PLAT.cz + z]));
      s.add(mk(sphere(0.11, 6, 4), P.strawberry, [PLAT.cx + x, 0.98, PLAT.cz + z]));
    }
    // glowing lantern room (brightens at sunset)
    this.lanternMat = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffe29a, emissiveIntensity: 0.35, roughness: 0.4 });
    this.lanternGlow = new THREE.SpriteMaterial({ map: glowTex(), color: 0xffe7ae, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    // lighthouse: Higgsfield hq model on the platform (procedural one as fallback); beam + glow follow its lantern
    loads.push(this.prop('hq_lighthouse', LH.x, LH.z, { h: LH_H }, 0, false, 0.1).then((m) => {
      let lanternY: number;
      if (m) {
        noCast(m);
        this.castProxy(LH.x, LH.z, 0, [pCyl(1.6, 1.85, 0.95, 0.57), pCyl(0.8, 1.25, 2.6, 2.35), pCyl(1.1, 1.1, 1.25, 4.27), pCone(0.85, 1.2, 5.5)]);
        lanternY = 0.1 + LH_H * LH_LANTERN;
        this.colliders.push(circle(LH.x, LH.z, 1.5)); // rocky base
        const glow = new THREE.Sprite(this.lanternGlow);
        glow.position.set(LH.x, lanternY, LH.z + 1.1); // just in front of the lantern glass
        glow.scale.setScalar(2.6);
        glow.renderOrder = 2;
        glow.userData.noShadow = true;
        this.addDynamic(glow);
      } else {
        const lh = lighthouse();
        lh.g.position.set(LH.x, 0, LH.z);
        this.add(lh.g);
        this.colliders.push(circle(LH.x, LH.z, 1.3));
        lanternY = lh.lanternY + 0.1;
        const lantern = new THREE.Mesh(cyl(0.5, 0.5, 0.75, 16), this.lanternMat);
        lantern.position.set(LH.x, lanternY, LH.z);
        this.addDynamic(lantern);
      }
      this.beamPivot.position.y = lanternY;
    }));
    // soft rotating light beam (visible at sunset)
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0xfff0c8, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const beamGeo = new THREE.ConeGeometry(1.3, 9, 16, 4, true);
    beamGeo.translate(0, -4.5, 0);
    { // additive fade toward the wide end
      const bp = beamGeo.attributes.position;
      const cols = new Float32Array(bp.count * 3);
      for (let k = 0; k < bp.count; k++) { const f = Math.pow(1 + bp.getY(k) / 9, 1.6); cols[k * 3] = cols[k * 3 + 1] = cols[k * 3 + 2] = f; }
      beamGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    }
    const beam = new THREE.Mesh(beamGeo, this.beamMat);
    beam.rotation.z = PI / 2;
    beam.userData.noShadow = true;
    this.beamPivot = new THREE.Group();
    this.beamPivot.position.set(LH.x, 5.27, LH.z); // y = lantern height, set once the lighthouse is placed
    this.beamPivot.add(beam);
    this.addDynamic(this.beamPivot);
    this.onUpdate((dt) => {
      this.beamPivot.rotation.y += dt * 0.7;
      this.beamPivot.visible = this.beamMat.opacity > 0.01;
    });
    // lamps at the pier mouth
    for (const sx of [-1, 1]) this.add(lampPost().translateX(PIER_X + sx * 1.45).translateZ(PIER_Z0 + 0.6), 0.2);
    const ps = sign('⚓ Sweet Sea Pier', 2.0, 0.5, { bg: '#FFFFFF', border: '#FF9DB3' });
    ps.position.set(PIER_X, 2.5, PIER_Z0 + 0.62);
    this.addDynamic(ps);
    this.add(mk(rb(3.3, 0.14, 0.14, 0.05), P.white, [PIER_X, 2.18, PIER_Z0 + 0.6]));
    // sea colliders: everything but the pier + platform
    const zTop = -3.0;
    const px0 = PIER_X - PIER_HALF, px1 = PIER_X + PIER_HALF;
    const lx0 = PLAT.cx - PLAT.h, lx1 = PLAT.cx + PLAT.h, lz0 = PLAT.cz - PLAT.h, lz1 = PLAT.cz + PLAT.h;
    const rect = (x0: number, x1: number, z0: number, z1: number) => colBox((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0);
    this.colliders.push(
      rect(-20, px0, lz1, zTop),
      rect(px1, 20, lz1, zTop),
      rect(-20, lx0, lz0 - 3, lz1),
      rect(lx1, 20, lz0 - 3, lz1),
    );
  }

  // ------------------------------------------------------------ metro station
  private stationPos = V(-10.1, 0, 4.9);
  private stationRot = 0.62;
  private stationLocal(x: number, z: number) {
    return V(x, 0, z).applyAxisAngle(UP, this.stationRot).add(this.stationPos);
  }

  private buildStation() {
    const st = stationBuilding();
    st.position.copy(this.stationPos);
    st.rotation.y = this.stationRot;
    this.add(st);
    for (const lx of [-1, 1]) {
      const c = this.stationLocal(lx, -0.1);
      this.colliders.push(circle(c.x, c.z, 1.55));
    }
    const sg = sign('🚇 Sweet Line', 2.6, 0.62, { bg: '#FFFFFF', border: '#8FDCBC', sub: 'Sweet Sea Station' });
    const sp = this.stationLocal(0, 1.72);
    sg.position.set(sp.x, 3.35, sp.z);
    sg.rotation.y = this.stationRot;
    this.addDynamic(sg);
    const logo = poster(0.5, 0.5, (g, w, h) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
      g.font = `${Math.floor(h * 0.62)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('🚃', w / 2, h / 2 + 6);
    }, 128);
    logo.geometry = circleGeo(0.27, 20);
    const lp = this.stationLocal(2.55, 1.93);
    logo.position.set(lp.x, 2.85, lp.z);
    logo.rotation.y = this.stationRot;
    this.addDynamic(logo);
    const pole = this.stationLocal(2.55, 1.9);
    this.colliders.push(circle(pole.x, pole.z, 0.2));
    // tiled path from the station to the beach
    for (let k = 0; k < 5; k++) {
      const p = this.stationLocal(0, 2.3 + k * 0.85);
      this.add(mk(cyl(0.38, 0.38, 0.06, 14), k % 2 ? P.white : P.mint, [p.x, 0.1, p.z]));
    }
    const sp2 = this.stationLocal(0, 2.9);
    const spawn = { x: sp2.x, z: sp2.z, rot: this.stationRot };
    this.spawns = { default: { ...spawn }, map: { ...spawn }, fromTrain: { ...spawn }, train: { ...spawn }, metro: { ...spawn } };
    const door = this.stationLocal(0, 2.05);
    this.interact({
      id: 'metro-home', pos: door, radius: 1.5, label: '🚃 Take the metro home', height: 2.6,
      onInteract: async () => {
        this.game.player.play('wave');
        await wait(500);
        this.game.goto('train', 'toSchool', { text: 'Next stop: Sweet Reply High ♡', icon: '🚃' });
      },
    });
    // greenery
    for (const [lx, lz, sc] of [[-2.9, 0.8, 1.0]] as const) {
      const p = this.stationLocal(lx, lz);
      this.add(tree(sc, P.mintDeep, P.woodDeep, lx < 0).translateX(p.x).translateZ(p.z), 0.45);
    }
    for (const [x, z] of [[-12, 8.2], [-7.4, 8.4]]) this.add(bush(0.8, P.mintDeep).translateX(x).translateZ(z));
    const fcols = [P.pink, P.butter, P.white, P.purple];
    for (let k = 0; k < 4; k++) this.add(flower(fcols[k], 1.1).translateX(-12.3 + (k % 2) * 0.5 + (k > 1 ? 4.6 : 0)).translateZ(7.5 + (k % 2) * 0.35).translateY(0.08));
  }

  // ------------------------------------------------------------ café
  private cafePos = V(9.7, 0, 1.9);
  private cafeRot = -0.6;
  private cafeLocal(x: number, z: number): THREE.Vector3;
  private cafeLocal(x: number, z: number, npc: true): [number, number, number];
  private cafeLocal(x: number, z: number, npc?: boolean): THREE.Vector3 | [number, number, number] {
    const v = V(x, 0, z).applyAxisAngle(UP, this.cafeRot).add(this.cafePos);
    return npc ? [v.x, v.z, this.cafeRot] : v;
  }

  private buildCafe(loads: Promise<unknown>[]) {
    const stools: THREE.Object3D[] = [];
    // Higgsfield café stall (sam_3_3d); Sunny stands behind its counter. Procedural stall as fallback.
    const sc = this.cafeLocal(0, STALL_Z);
    loads.push(this.prop('cafe_stall', sc.x, sc.z, { h: 2.7 }, this.cafeRot, false).then((m) => {
      if (m) {
        this.stallModel = true;
        noCast(m);
        const posts = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => pBox(0.12, 1.2, 0.12, sx * 0.95, 1.5, sz * 0.45)));
        this.castProxy(sc.x, sc.z, this.cafeRot, [pBox(2.35, 1.2, 1.15, 0, 0.6, 0.05), pBox(2.1, 0.8, 1.2, 0, 2.3, 0), ...posts]);
        for (const lx of [-0.62, 0.62]) { const p = this.cafeLocal(lx, STALL_Z); this.colliders.push(circle(p.x, p.z, 0.72)); }
        // stools pulled up to the (smaller) stall's counter, name sign just above its awning
        for (const s of stools) s.position.copy(this.cafeLocal(s.userData.lx, 1.75));
        sg.position.y = 3.05;
        return;
      }
      const c = cafeStall();
      c.position.copy(this.cafePos);
      c.rotation.y = this.cafeRot;
      this.add(c);
      for (const lx of [-1.2, -0.4, 0.4, 1.2]) { const p = this.cafeLocal(lx, 0.3); this.colliders.push(circle(p.x, p.z, 0.45)); }
      for (const [lx, lz, r] of [[-1.95, -0.3, 0.5], [1.95, -0.3, 0.5], [-1.95, -1.5, 0.5], [1.95, -1.5, 0.5], [-1, -1.35, 0.6], [0, -1.35, 0.6], [1, -1.35, 0.6]] as const) {
        const p = this.cafeLocal(lx, lz);
        this.colliders.push(circle(p.x, p.z, r));
      }
    }));
    const sg = sign('Sunny’s Seaside Café', 3.3, 0.72, { bg: '#FFFFFF', border: '#FFBE9C', sub: '☀️ peach ade · sea cupcakes' });
    const sp = this.cafeLocal(0, 1.32);
    sg.position.set(sp.x, 3.28, sp.z);
    sg.rotation.y = this.cafeRot;
    this.addDynamic(sg);
    // menu board (A-frame)
    const mb = this.cafeLocal(2.75, 1.25);
    const easel = new THREE.Group();
    easel.add(mk(rb(0.9, 1.25, 0.08, 0.04), P.woodDeep, [0, 0.8, 0], [-0.12, 0, 0]));
    easel.add(mk(rb(0.08, 1.3, 0.08, 0.03), P.woodDeep, [0, 0.62, -0.3], [0.3, 0, 0]));
    easel.position.copy(mb);
    easel.rotation.y = this.cafeRot;
    this.add(easel);
    this.colliders.push(circle(mb.x, mb.z, 0.45));
    const menu = poster(0.78, 1.1, (g, w, h) => {
      g.fillStyle = '#FFF6E8';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#FFBE9C';
      g.lineWidth = 8;
      g.setLineDash([12, 8]);
      roundRect(g, 10, 10, w - 20, h - 20, 18);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#FF7A93';
      g.textAlign = 'center';
      g.font = `900 ${Math.floor(w * 0.15)}px Nunito, sans-serif`;
      g.fillText('MENU', w / 2, h * 0.16);
      g.fillStyle = '#364049';
      g.font = `800 ${Math.floor(w * 0.095)}px Nunito, sans-serif`;
      const items = ['🍑 Peach ade', '🍓 Berry milk', '🧁 Sea cupcake', '🍦 Cloud cone'];
      items.forEach((t, k) => g.fillText(t, w / 2, h * (0.33 + k * 0.15)));
      g.fillStyle = '#8A99A8';
      g.font = `700 ${Math.floor(w * 0.07)}px Nunito, sans-serif`;
      g.fillText('made with sunshine ♡', w / 2, h * 0.93);
    });
    const mp = this.cafeLocal(2.75, 1.3);
    menu.position.set(mp.x, 0.84, mp.z);
    menu.rotation.set(-0.12, this.cafeRot, 0, 'YXZ');
    this.addDynamic(menu);
    for (const lx of [-0.9, 0.5]) {
      const p = this.cafeLocal(lx, 1.45);
      const s = stool(lx < 0 ? P.mint : P.pink);
      s.scale.setScalar(0.85);
      s.position.copy(p);
      s.userData.lx = lx;
      stools.push(s);
      this.add(s);
    }
    // little round table with parasol nearby
    const tp = this.cafeLocal(-3.1, 1.3);
    const tbl = new THREE.Group();
    tbl.add(mk(cyl(0.55, 0.55, 0.08, 20), P.white, [0, 0.72, 0]));
    tbl.add(mk(cyl(0.06, 0.08, 0.7, 8), P.white, [0, 0.36, 0]));
    tbl.add(mk(cyl(0.3, 0.32, 0.05, 16), P.white, [0, 0.03, 0]));
    tbl.add(mk(cyl(0.08, 0.07, 0.2, 10), glossy(P.peach), [0.15, 0.86, 0.05]));
    tbl.add(mk(cyl(0.08, 0.07, 0.2, 10), glossy(P.pink), [-0.15, 0.86, -0.08]));
    tbl.position.copy(tp);
    this.add(tbl, 0.6);
    const u = umbrella(P.peachDeep, P.white, 0);
    u.position.copy(tp);
    this.add(u);
  }

  // ------------------------------------------------------------ umbrellas, towels, castle, bench, frame
  private buildBeachLife(loads: Promise<unknown>[]) {
    // umbrella set A: Higgsfield umbrella_set (the pink parasol; the deck chairs stay procedural). Only one copy —
    // a second 6k-triangle parasol would push the beach past its ~150k budget — so set B keeps its blue parasol.
    loads.push(this.prop('umbrella_set', -6.4, 3.4, { h: 2.4 }, 0.5, 0.2, 0.03).then((m) => {
      if (m) {
        noCast(m);
        this.castProxy(-6.4, 3.4, 0, [pCyl(0.05, 0.05, 1.6, 0.83, 6), pCone(1.22, 0.85, 1.96, 14)]);
        return;
      }
      const ua = umbrella(P.strawberry, P.white, 0.14);
      ua.position.set(-6.4, 0, 3.4);
      this.add(ua, 0.2);
    }));
    for (const [x, c, ry] of [[-7.2, P.pink, 0.2], [-5.6, P.blue, -0.15]] as const) {
      const ch = deckChair(c);
      ch.position.set(x, 0, 3.9);
      ch.rotation.y = PI + ry;
      this.add(ch, 0.45);
    }
    const tA = towel(P.lavender);
    tA.position.set(-4.3, 0, 4.4);
    tA.rotation.y = 0.25;
    this.add(tA);
    // umbrella set B
    const ub = umbrella(P.blueDeep, P.white, -0.12);
    ub.position.set(1.4, 0, 3.1);
    this.add(ub, 0.2);
    const tB = towel(P.mintDeep, 1.1, 1.9);
    tB.position.set(0.6, 0, 3.6);
    tB.rotation.y = -0.3;
    this.add(tB);
    const tC = towel(P.pinkDeep, 1.0, 1.8);
    tC.position.set(2.3, 0, 3.4);
    tC.rotation.y = 0.2;
    this.add(tC);
    const ball = beachBall();
    ball.position.set(-1.2, 0, 5.8);
    this.add(ball, 0.35);
    const ball2 = beachBall(0.2);
    ball2.position.set(3.4, 0, -0.4);
    this.add(ball2, 0.25);
    // sheep cushion + sheep float (world mascot)
    const sc = new THREE.Group();
    sc.add(mk(sphere(0.45, 10, 7), P.white, [0, 0.3, 0], [0, 0, 0], [1, 0.6, 1]));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; sc.add(mk(sphere(0.18, 6, 4), P.white, [Math.cos(a) * 0.4, 0.32, Math.sin(a) * 0.4])); }
    sc.add(mk(sphere(0.16, 8, 6), P.skin, [0, 0.4, 0.45], [0, 0, 0], [1, 0.9, 0.8]));
    sc.add(mk(sphere(0.025, 6, 4), P.ink, [-0.05, 0.42, 0.58]));
    sc.add(mk(sphere(0.025, 6, 4), P.ink, [0.05, 0.42, 0.58]));
    sc.position.set(0.3, 0.05, 4.9);
    this.add(sc, 0.5);

    // sandcastle (a sheep plush hides behind it): Higgsfield model, procedural castle as fallback
    loads.push(this.prop('sandcastle', CASTLE.x, CASTLE.z, { w: 2.3, h: 2.0 }, 0.25, false, 0.05).then((m) => {
      if (m) {
        noCast(m);
        this.castProxy(CASTLE.x, CASTLE.z, 0.25, [pBox(1.65, 0.85, 0.85, 0, 0.65, 0), pBox(1.4, 0.3, 0.45, 0, 1.21, 0), pCone(0.3, 0.5, 1.6, 8)]);
        return;
      }
      const castle = sandcastle();
      castle.position.set(CASTLE.x, 0.05, CASTLE.z);
      this.add(castle);
    }));
    this.colliders.push(circle(CASTLE.x, CASTLE.z, 1.1));

    // bench by the water (faces the sea)
    const b = new THREE.Group();
    b.add(mk(rb(2.0, 0.12, 0.55, 0.05), P.wood, [0, 0.45, 0]));
    b.add(mk(rb(2.0, 0.4, 0.1, 0.05), P.wood, [0, 0.8, -0.26], [-0.12, 0, 0]));
    b.add(mk(rb(2.0, 0.08, 0.12, 0.04), P.pinkDeep, [0, 1.03, -0.29]));
    for (const sx of [-1, 1]) {
      b.add(mk(rb(0.12, 0.45, 0.5, 0.05), P.white, [sx * 0.85, 0.22, 0]));
      b.add(mk(rb(0.1, 0.1, 0.5, 0.04), P.white, [sx * 0.95, 0.62, 0]));
    }
    b.add(mk(heartShapeGeo(), P.strawberry, [0, 0.82, -0.33], [PI, 0, PI], 0.2));
    b.position.set(BENCH.x, 0, BENCH.z);
    b.rotation.y = PI;
    this.add(b);
    this.colliders.push(circle(BENCH.x - 0.95, BENCH.z, 0.2), circle(BENCH.x + 0.95, BENCH.z, 0.2));

    // photo frame "Sweet Sea ♡"
    const f = new THREE.Group();
    for (const sx of [-1, 1]) {
      f.add(mk(cyl(0.1, 0.12, 2.5, 10), P.pink, [sx * 1.15, 1.25, 0]));
      f.add(mk(sphere(0.16, 8, 6), P.white, [sx * 1.15, 2.55, 0]));
      for (let k = 0; k < 5; k++) f.add(mk(sphere(0.09, 6, 4), [P.butter, P.white, P.purple][k % 3], [sx * 1.15 + sx * 0.08, 0.5 + k * 0.42, 0.06]));
    }
    f.add(mk(rb(2.6, 0.14, 0.14, 0.06), P.pink, [0, 2.4, 0]));
    f.add(mk(heartShapeGeo(), P.strawberry, [0, 3.35, 0], [0, 0, 0], 0.55));
    f.position.set(FRAME.x, 0, FRAME.z);
    this.add(f);
    this.colliders.push(circle(FRAME.x - 1.15, FRAME.z, 0.2), circle(FRAME.x + 1.15, FRAME.z, 0.2));
    const fs = sign('Sweet Sea ♡', 2.3, 0.6, { bg: '#FFFFFF', border: '#FF9DB3', fg: '#FF7A93' });
    fs.position.set(FRAME.x, 2.82, FRAME.z + 0.02);
    this.addDynamic(fs);
    const fm = sign('📸 Photo spot', 1.3, 0.36, { bg: '#FFF6E8', border: '#FFB3C1' });
    fm.position.set(FRAME.x + 1.9, 0.9, FRAME.z + 0.3);
    fm.rotation.y = -0.3;
    this.addDynamic(fm);
    this.add(mk(cyl(0.04, 0.04, 0.8, 6), P.white, [FRAME.x + 1.9, 0.4, FRAME.z + 0.25]));

    // sunset signpost
    const sp = new THREE.Group();
    sp.add(mk(cyl(0.06, 0.08, 1.8, 8), P.white, [0, 0.9, 0]));
    sp.add(mk(sphere(0.12, 8, 6), P.butter, [0, 1.85, 0]));
    sp.position.set(SUN_SIGN.x, 0, SUN_SIGN.z);
    this.add(sp);
    this.colliders.push(circle(SUN_SIGN.x, SUN_SIGN.z, 0.2));
    const ss = sign('🌅 Sunset ⇄ ☀️ Day', 1.8, 0.5, { bg: '#FFFFFF', border: '#FFBE9C' });
    ss.position.set(SUN_SIGN.x, 1.45, SUN_SIGN.z + 0.1);
    this.addDynamic(ss);

    // pastel boat bobbing by the pier
    const bt = bake(boat());
    bt.position.set(10.6, -0.12, -7.6);
    bt.rotation.y = -0.5;
    this.addDynamic(bt);
    // Higgsfield rowing boat rides in the same bobbing group; the procedural boat stays hidden as fallback
    loads.push(landmark('boat', { d: 2.4 }).then((m) => {
      for (const c of bt.children) c.visible = false;
      noCast(m); // the sea shader doesn't receive shadows
      m.rotation.y = PI / 2; // long axis along the old boat's (local x)
      m.position.y = -0.2; // hull sits in the water
      bt.add(m);
    }).catch((e) => console.warn('landmark failed', 'boat', e)));
    // sheep swim ring
    const sf = bake(sheepFloat());
    sf.position.set(-3.6, -0.05, -5.4);
    sf.rotation.y = 0.4;
    this.addDynamic(noCast(sf)); // on the water: the sea shader doesn't show shadows
    this.onUpdate((_dt, t) => {
      bt.position.y = -0.12 + Math.sin(t * 1.3) * 0.06;
      bt.rotation.z = Math.sin(t * 1.05) * 0.05;
      bt.rotation.x = Math.sin(t * 0.8 + 1) * 0.03;
      sf.position.y = -0.06 + Math.sin(t * 1.5 + 2) * 0.05;
      sf.position.x = -3.6 + Math.sin(t * 0.25) * 0.8;
      sf.rotation.y = 0.4 + Math.sin(t * 0.4) * 0.3;
    });

    // dolphin hops far out at sea
    const dol = noCast(bake(dolphin()));
    dol.visible = false;
    dol.scale.setScalar(1.2);
    this.addDynamic(dol);
    const game = this.game;
    let next = 3, jt = -1, x0 = 0, z0 = 0, dir = 1;
    this.onUpdate((dt) => {
      if (jt < 0) {
        next -= dt;
        if (next <= 0) {
          jt = 0;
          dir = Math.random() < 0.5 ? 1 : -1;
          x0 = -12 + Math.random() * 18;
          z0 = -10 - Math.random() * 8;
          dol.visible = true;
          dol.rotation.y = dir > 0 ? 0 : PI;
          game.fx.burst(V(x0, 0.2, z0), 'sparkles', 5, 0.6);
        }
        return;
      }
      jt += dt / 1.5;
      const u = Math.min(1, jt);
      const y = -0.5 + Math.sin(u * PI) * 2.0;
      dol.position.set(x0 + dir * u * 4.2, y, z0);
      dol.rotation.z = Math.cos(u * PI) * 0.9 * 1;
      if (jt >= 1) {
        jt = -1;
        next = 7 + Math.random() * 6;
        dol.visible = false;
        game.fx.burst(V(x0 + dir * 4.2, 0.2, z0), 'sparkles', 5, 0.6);
      }
    });
  }

  // ------------------------------------------------------------ far harbour hill + clouds
  private buildDistance() {
    const hill = new THREE.Group();
    hill.add(mk(sphere(4, 16, 8), P.mint, [0, -1.2, 0], [0, 0, 0], [1.5, 0.75, 0.9]));
    hill.add(mk(sphere(2.6, 12, 6), P.mintDeep, [-2.2, -0.6, 0.6], [0, 0, 0], [1.2, 0.8, 0.9]));
    const cols = [P.pink, P.butter, P.blue, P.lavender, P.peach, P.white, P.mint];
    const roofs = [P.strawberry, P.blueDeep, P.pinkDeep, P.lavenderDeep];
    const r = rng(5);
    for (let i = 0; i < 12; i++) {
      const a = -1.35 + (i / 11) * 2.7;
      const rr = 3.6 + r() * 1.4;
      const x = Math.sin(a) * rr * 1.25;
      const y = Math.cos(a) * 1.9 - 0.6 + r() * 0.3;
      const z = 1.2 + r() * 1.6;
      const w = 0.55 + r() * 0.3;
      hill.add(mk(rb(w, 0.6, 0.5, 0.03), cols[i % cols.length], [x, y + 0.3, z]));
      hill.add(mk(cone(w * 0.72, 0.4, 4), roofs[i % roofs.length], [x, y + 0.8, z], [0, PI / 4, 0], [1, 1, 0.7]));
    }
    hill.add(mk(cyl(0.12, 0.16, 1.8, 8), P.white, [0.3, 2.4, 0.5]));
    hill.add(mk(sphere(0.35, 8, 6), P.pink, [0.3, 3.4, 0.5]));
    hill.position.set(18, 0, -19);
    this.ground.add(hill);
    const isl = new THREE.Group();
    isl.add(mk(sphere(2.2, 16, 8), P.mint, [0, -0.6, 0], [0, 0, 0], [1.6, 0.6, 1]));
    isl.add(tree(1.2, P.mintDeep, P.woodDeep, true).translateY(0.4));
    isl.position.set(-19, 0, -18);
    this.ground.add(isl);

    for (let i = 0; i < 4; i++) {
      const c = bake(sheepCloud(1.1 + (i % 2) * 0.4));
      c.position.set(-22 + i * 12, 7.5 + (i % 3) * 1.5, -14 - (i % 2) * 5);
      c.userData.speed = 0.25 + (i % 3) * 0.08;
      c.traverse((o) => (o.userData.noShadow = true));
      this.addDynamic(c);
      this.clouds.push(c);
    }
    this.onUpdate((dt, t) => {
      for (const c of this.clouds) {
        c.position.x += dt * c.userData.speed;
        c.position.y += Math.sin(t * 0.6 + c.position.z) * dt * 0.08;
        if (c.position.x > 26) c.position.x = -26;
      }
    });
  }

  // ------------------------------------------------------------ interactions
  private buildInteractions() {
    const game = this.game;
    // sit by the sea
    this.interact({
      id: 'sea-bench', pos: V(BENCH.x, 0, BENCH.z + 0.2), radius: 1.35, label: '🌊 Sit by the sea', height: 1.6,
      onInteract: async () => {
        const p = game.player;
        p.root.position.set(BENCH.x, 0, BENCH.z - 0.05);
        game.setFacing(PI);
        p.play('sit', { loop: true });
        game.ui.setHud(false);
        const wasDay = this.mixTarget < 0.5;
        if (wasDay) this.mixTarget = 0.65;
        const bx = BENCH.x, bz = BENCH.z;
        game.cam.override = { pos: V(bx + 2.4, 2.2, bz + 4.4), look: V(bx - 1.5, 1.6, bz - 16), k: 0.8, fov: 40 };
        game.audio.sfx('chime', 0.6);
        for (let i = 0; i < 12; i++) {
          await wait(650);
          if (i === 5) game.cam.override = { pos: V(bx - 0.2, 1.45, bz + 2.5), look: V(bx - 3.2, 1.9, bz - 18), k: 0.55, fov: 42 };
          if (i % 2 === 0) game.fx.floatUp(V(bx + (Math.random() - 0.5) * 0.6, 2.3, bz + (Math.random() - 0.5) * 0.3), 'hearts');
          if (i === 8) game.ui.react(V(bx, 2.7, bz), '♡', 'plain');
        }
        game.cam.override = null;
        game.ui.setHud(true);
        if (wasDay) this.mixTarget = 0;
        if (!game.save.flag('beachSat', false)) {
          game.save.setFlag('beachSat', true);
          game.addHearts(3, p.root.position);
          await wait(500);
          game.collect('sticker', 'stk_beach', V(bx, 1.6, bz), 'Dolphin sticker', '🐬');
        }
      },
    });
    // photo spot
    this.interact({
      id: 'photo', pos: V(FRAME.x, 0, FRAME.z + 0.6), radius: 1.5, label: '📸 Take a photo', height: 2.4,
      onInteract: async () => {
        const p = game.player;
        p.root.position.set(FRAME.x, 0, FRAME.z + 0.05);
        game.setFacing(0);
        p.play('pose', { loop: true });
        game.cam.override = { pos: V(FRAME.x + 0.7, 1.9, FRAME.z + 5.2), look: V(FRAME.x + 0.2, 1.55, FRAME.z), k: 4, fov: 40 };
        await wait(1200);
        await game.photo('Sweet Sea Beach');
        p.stop();
        game.cam.override = null;
        if (!game.save.flag('photoBeach', false)) { game.save.setFlag('photoBeach', true); game.addHearts(5, p.root.position); }
      },
    });
    // sunset toggle
    const sunIt = this.interact({
      id: 'sunset', pos: V(SUN_SIGN.x, 0, SUN_SIGN.z + 0.3), radius: 1.3, label: this.mixTarget > 0.5 ? '☀️ Back to daytime' : '🌅 Watch the sunset', height: 2.1,
      onInteract: async () => {
        const toSunset = this.mixTarget < 0.5;
        this.mixTarget = toSunset ? 1 : 0;
        game.save.setFlag('beachSunset', toSunset);
        game.save.save();
        sunIt.label = toSunset ? '☀️ Back to daytime' : '🌅 Watch the sunset';
        game.audio.sfx(toSunset ? 'chime' : 'sparkle');
        game.player.play(toSunset ? 'shy' : 'happy');
        game.ui.react(V(SUN_SIGN.x, 2.2, SUN_SIGN.z), toSunset ? '🌅' : '☀️', 'big');
        if (toSunset && !game.save.flag('beachSunsetSeen', false)) {
          game.save.setFlag('beachSunsetSeen', true);
          game.addHearts(2, game.player.root.position);
        }
        await wait(900);
      },
    });
    // café
    this.interact({
      id: 'peach-ade', pos: this.cafeLocal(1.4, 1.25), radius: 1.35, label: '🍑 Order peach ade', height: 1.9,
      onInteract: async () => {
        const p = game.player;
        const sunny = this.npcs.find((n) => n.def.id === 'sunny');
        if (sunny) {
          game.faceTo(sunny.position.x, sunny.position.z);
          game.ui.react(sunny.position.clone().setY(2.1), 'One peach ade! 🍑', 'big');
        }
        game.audio.sfx('pop');
        await wait(700);
        const cup = peachCup();
        p.holdRight(cup);
        game.audio.sfx('sparkle');
        await wait(300);
        for (let i = 0; i < 2; i++) {
          game.audio.sfx('eat');
          await p.playAsync('eat');
        }
        game.ui.react(p.root.position.clone().setY(2.6), '✧ so sweet~ ✧');
        game.fx.burst(p.root.position.clone().setY(1.8), 'sparkles', 6);
        await wait(700);
        p.holdRight(null);
        const today = todayKey();
        if (game.save.flag('beachAdeDay', '') !== today) {
          game.save.setFlag('beachAdeDay', today);
          game.addHearts(2, p.root.position);
        }
      },
    });
  }

  // ------------------------------------------------------------ collectibles
  private buildCollectibles() {
    const spots: [string, number, number, number][] = [
      ['shell_1', -3.2, 7.7, P.peach],
      ['shell_2', 11.7, 7.3, P.pink],
      ['shell_3', -11.6, -2.1, P.lavender],
      ['shell_4', 7.9, -16.8, P.butter],
      ['shell_5', 4.4, 0.9, P.mint],
      ['shell_6', 6.0, -9.4, P.blue],
    ];
    for (const [id, x, z, c] of spots) {
      const s = shell(c);
      s.position.set(0, 0, 0);
      s.scale.setScalar(1.5);
      const baked = bake(s);
      baked.position.set(x, 0.3, z);
      this.collectible('shell', id, baked, 'a pretty shell', '🐚');
    }
    const pl = bake(sheepPlush(1));
    pl.position.set(CASTLE.x + 0.1, 0.05, CASTLE.z - 1.25);
    pl.rotation.y = PI;
    this.collectible('plush', 'plush_beach', pl, 'a sheep plushie behind the sandcastle', '🐑');
  }

  // ------------------------------------------------------------ day ↔ sunset
  private applyLook(force = false) {
    if (!force && Math.abs(this.mix - this.lastDrawn) < 0.002) return;
    this.lastDrawn = this.mix;
    const k = this.mix * this.mix * (3 - 2 * this.mix);
    const L = this.look;
    for (const key of ['skyTop', 'skyMid', 'skyBot', 'shallow', 'deep', 'horizon', 'foam', 'glint', 'hemiSky', 'hemiGround', 'sunCol', 'disc'] as const)
      L[key].lerpColors(DAY[key], SUNSET[key], k);
    L.discPos.lerpVectors(DAY.discPos, SUNSET.discPos, k);
    const lerp = (a: number, b: number) => a + (b - a) * k;
    this.skyK = k;
    this.drawSky(L);
    const u = this.seaMat.uniforms;
    u.uShallow.value.copy(L.shallow);
    u.uDeep.value.copy(L.deep);
    u.uHorizon.value.copy(L.horizon);
    u.uFoam.value.copy(L.foam);
    u.uGlint.value.copy(L.glint);
    this.sparkMat.uniforms.uColor.value.copy(L.glint);
    if (this.lights) {
      this.lights.hemi.color.copy(L.hemiSky);
      this.lights.hemi.groundColor.copy(L.hemiGround);
      this.lights.hemi.intensity = lerp(DAY.hemi, SUNSET.hemi);
      this.lights.sun.color.copy(L.sunCol);
      this.lights.sun.intensity = lerp(DAY.sun, SUNSET.sun);
    }
    this.scene.environmentIntensity = lerp(DAY.env, SUNSET.env);
    (this.sunDisc.material as THREE.SpriteMaterial).color.copy(L.disc);
    this.sunDisc.position.copy(L.discPos);
    this.sunDisc.scale.setScalar(lerp(DAY.discScale, SUNSET.discScale));
    this.beamMat.opacity = k * 0.3;
    this.lanternMat.emissiveIntensity = 0.35 + k * 0.9;
    this.lanternGlow.opacity = k * 0.8;
  }

  update(dt: number) {
    if (Math.abs(this.mix - this.mixTarget) > 0.0005) {
      this.mix += (this.mixTarget - this.mix) * dampK(0.9, dt);
      if (Math.abs(this.mix - this.mixTarget) < 0.002) this.mix = this.mixTarget;
      this.applyLook();
    }
  }

  onExit() {
    this.game.ui.setHud(true);
  }
}

function cloneLook(l: Look): Look {
  return {
    ...l,
    skyTop: l.skyTop.clone(), skyMid: l.skyMid.clone(), skyBot: l.skyBot.clone(),
    shallow: l.shallow.clone(), deep: l.deep.clone(), horizon: l.horizon.clone(), foam: l.foam.clone(), glint: l.glint.clone(),
    hemiSky: l.hemiSky.clone(), hemiGround: l.hemiGround.clone(), sunCol: l.sunCol.clone(), disc: l.disc.clone(), discPos: l.discPos.clone(),
  };
}
