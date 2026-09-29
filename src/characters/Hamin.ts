import * as THREE from 'three';
import { capsule, cyl, mk, rbox, sphere, torus, cone } from '../assets/geo';
import { toon, toonUnique, basic } from '../assets/materials';
import { blobShadowTex } from '../assets/textures';
import { P } from '../assets/palette';
import { StaticBatcher } from '../core/StaticBatcher';
import { Quality } from '../core/Engine';
import { HaminModel } from './HaminModel';
import { drawFace, Expression, HAMIN_FACE } from './face';
import { AccData, BottomData, DEFAULT_OUTFIT, getItem, OutfitState, ShoeData, TopData } from './outfits';
import { clamp, dampAngle, dampK } from '../utils/math';

export type AnimName =
  | 'idle' | 'idle2' | 'walk' | 'run' | 'sit' | 'wave' | 'happy' | 'shy' | 'surprised' | 'scared'
  | 'eat' | 'dance' | 'sing' | 'interact' | 'spin' | 'stumble' | 'chase' | 'victory' | 'tired'
  | 'pose' | 'jump' | 'heart' | 'sleep' | 'lookBack' | 'sitEat';

/** All joint values of the rig. Arm Z values are "outward" (mirrored per side). */
interface Pose {
  by: number; bx: number; bz: number; // bounce offsets
  hx: number; hy: number; hz: number; // hips (whole body lean)
  tx: number; ty: number; tz: number; // torso (upper body)
  kx: number; ky: number; kz: number; // head
  alx: number; aly: number; alz: number;
  arx: number; ary: number; arz: number;
  llx: number; lrx: number; llz: number; lrz: number;
  elL: number; elR: number; // elbow bends (generated model only)
  spin: number;
}
const ZERO: Pose = {
  by: 0, bx: 0, bz: 0, hx: 0, hy: 0, hz: 0, tx: 0, ty: 0, tz: 0, kx: 0, ky: 0, kz: 0,
  alx: 0, aly: 0, alz: 0.12, arx: 0, ary: 0, arz: 0.12, llx: 0, lrx: 0, llz: 0, lrz: 0, elL: 0.15, elR: 0.15, spin: 0,
};
const KEYS = Object.keys(ZERO) as (keyof Pose)[];

interface AnimDef {
  fn: (t: number, p: Pose, h: Hamin) => void;
  face?: Expression;
  dur?: number; // one-shot duration; undefined = loops
  k?: number; // blend stiffness
}

const S = Math.sin, C = Math.cos, PI = Math.PI;
const tri = (x: number) => 1 - Math.abs(((x % 2) + 2) % 2 - 1) * 2; // triangle wave -1..1

/** Bring the right hand (holding food) up to the mouth with a bent elbow. */
function eatArm(t: number, p: Pose) {
  const bite = S(clamp(t / 0.35, 0, 1) * PI * 0.5) * (t < 0.6 ? 1 : clamp((1 - t) / 0.4, 0, 1));
  p.arx = -1.05 * bite; p.arz = 0.3 * bite + 0.1; p.ary = -0.35 * bite; p.elR = 0.15 + 2.1 * bite;
  p.kx = -0.1 + S(t * 22) * 0.05 * (t > 0.3 ? 1 : 0); p.by += Math.abs(S(t * 10)) * 0.02; p.kz = S(t * 6) * 0.08;
}

const ANIMS: Record<AnimName, AnimDef> = {
  idle: {
    fn: (t, p) => {
      p.tx = S(t * 2) * 0.02; p.by = S(t * 2) * 0.008; p.kz = S(t * 0.9) * 0.04; p.ky = S(t * 0.5) * 0.08;
      p.alz = 0.14 + S(t * 2) * 0.03; p.arz = 0.14 + S(t * 2) * 0.03;
    },
  },
  idle2: {
    dur: 3.2,
    fn: (t, p) => {
      const a = clamp(t / 0.6, 0, 1) * clamp((3.2 - t) / 0.6, 0, 1);
      p.alz = 0.14 + a * 2.7; p.arz = 0.14 + a * 2.7; p.alx = -a * 0.2; p.arx = -a * 0.2;
      p.tx = -a * 0.12; p.kx = -a * 0.25; p.by = a * 0.03; p.ky = S(t * 2.2) * 0.35 * a;
    },
    face: 'smile',
  },
  walk: {
    fn: (t, p, h) => {
      const ph = h.stridePhase;
      p.llx = S(ph) * 0.62; p.lrx = -S(ph) * 0.62;
      p.alx = -S(ph) * 0.5; p.arx = S(ph) * 0.5; p.alz = 0.16; p.arz = 0.16;
      p.by = Math.abs(S(ph)) * 0.06; p.hy = S(ph) * 0.08; p.tx = 0.05; p.kz = S(ph) * 0.03;
    },
  },
  run: {
    fn: (t, p, h) => {
      const ph = h.stridePhase;
      p.llx = S(ph) * 0.95; p.lrx = -S(ph) * 0.95;
      p.alx = -S(ph) * 0.9 - 0.2; p.arx = S(ph) * 0.9 - 0.2; p.alz = 0.3; p.arz = 0.3;
      p.by = Math.abs(S(ph)) * 0.12; p.hy = S(ph) * 0.12; p.tx = 0.18; p.kx = -0.08;
    },
  },
  chase: {
    face: 'scared',
    fn: (t, p, h) => {
      const ph = h.stridePhase;
      p.llx = S(ph) * 1.0; p.lrx = -S(ph) * 1.0;
      p.alz = 2.3 + S(ph * 1.5) * 0.4; p.arz = 2.3 - S(ph * 1.5) * 0.4; p.alx = -0.3; p.arx = -0.3;
      p.by = Math.abs(S(ph)) * 0.14; p.tx = 0.2; p.kx = -0.12;
      p.ky = S(t * 1.3) > 0.7 ? 2.2 : 0; // glance back at the dog
    },
  },
  lookBack: {
    face: 'surprised', dur: 0.9,
    fn: (t, p) => { p.ky = 2.3 * clamp(t * 4, 0, 1); p.ty = 0.5; p.alz = 1; p.arz = 1; },
  },
  sit: {
    k: 10,
    fn: (t, p) => {
      p.by = -0.16; p.llx = -1.45; p.lrx = -1.45; p.alx = -0.55; p.arx = -0.55; p.alz = 0.1; p.arz = 0.1;
      p.tx = -0.05 + S(t * 1.6) * 0.02; p.kz = S(t * 0.8) * 0.06; p.ky = S(t * 0.4) * 0.12;
    },
  },
  sleep: {
    face: 'blink', k: 5,
    fn: (t, p) => {
      p.by = -0.16; p.llx = -1.45; p.lrx = -1.45; p.alx = -0.6; p.arx = -0.6; p.tx = 0.25; p.kx = 0.4 + S(t * 1.5) * 0.05; p.kz = 0.25;
    },
  },
  wave: {
    face: 'smile', dur: 1.6,
    fn: (t, p) => { p.arz = 2.5 + S(t * 13) * 0.35; p.arx = -0.3; p.elR = 0.5; p.kz = -0.12; p.ty = -0.15; p.by = Math.abs(S(t * 4)) * 0.02; },
  },
  happy: {
    face: 'happy', dur: 1.4,
    fn: (t, p) => {
      p.by = Math.abs(S(t * 9)) * 0.28; p.alz = 2.4; p.arz = 2.4; p.alx = -0.2; p.arx = -0.2;
      p.llx = -Math.abs(S(t * 9)) * 0.5; p.lrx = -Math.abs(S(t * 9)) * 0.5; p.kx = -0.15;
    },
  },
  heart: {
    face: 'love', dur: 1.8,
    fn: (t, p) => { p.alz = 2.3; p.arz = 2.3; p.alx = -0.6; p.arx = -0.6; p.aly = -0.9; p.ary = 0.9; p.kz = S(t * 3) * 0.15; p.by = Math.abs(S(t * 5)) * 0.05; },
  },
  shy: {
    face: 'shy', dur: 2.2,
    fn: (t, p) => {
      p.alx = 0.55; p.arx = 0.55; p.alz = -0.25; p.arz = -0.25; p.tz = S(t * 3) * 0.08; p.kz = 0.25; p.kx = 0.18; p.ky = -0.3;
      p.lrx = -0.4 * Math.max(0, S(t * 4)); p.hy = S(t * 3) * 0.1;
    },
  },
  surprised: {
    face: 'surprised', dur: 0.9,
    fn: (t, p) => {
      const j = t < 0.35 ? S((t / 0.35) * PI) : 0;
      p.by = j * 0.3; p.alz = 1.6; p.arz = 1.6; p.alx = -0.4; p.arx = -0.4; p.tx = -0.15; p.kx = -0.15;
      p.llx = -j * 0.4; p.lrx = j * 0.3;
    },
  },
  scared: {
    face: 'scared',
    fn: (t, p) => {
      p.alx = -0.8; p.arx = -0.8; p.alz = -0.15; p.arz = -0.15; p.elL = 1.7; p.elR = 1.7; p.tx = 0.1 + S(t * 40) * 0.015; p.tz = S(t * 37) * 0.025;
      p.kx = 0.1; p.by = -0.04; p.llx = 0.1; p.lrx = 0.1;
    },
  },
  eat: {
    face: 'eat', dur: 1.0,
    fn: (t, p) => eatArm(t, p),
  },
  sitEat: {
    face: 'eat', dur: 1.0, k: 16,
    fn: (t, p) => {
      p.by = -0.16; p.llx = -1.45; p.lrx = -1.45; p.alx = -0.55; p.alz = 0.1;
      eatArm(t, p);
    },
  },
  dance: {
    face: 'happy',
    fn: (t, p, h) => {
      const b = t * (h.danceBpm / 60); // beats
      const bar = Math.floor(b / 4) % 4;
      const f = b % 1;
      const hit = Math.pow(1 - f, 3);
      p.by = Math.abs(S(b * PI)) * 0.1;
      if (bar === 0) { // step touch + claps
        p.bx = S(b * PI * 0.5) * 0.18; p.hz = S(b * PI * 0.5) * 0.12; p.alz = 0.8 + hit * 0.6; p.arz = 0.8 + hit * 0.6; p.alx = -1.1; p.arx = -1.1;
        p.llx = S(b * PI) * 0.4; p.lrx = -S(b * PI) * 0.4;
      } else if (bar === 1) { // point up / point down
        const up = Math.floor(b) % 2 === 0;
        p.arz = up ? 2.8 : 0.5; p.alz = up ? 0.3 : 2.8; p.ty = up ? -0.3 : 0.3; p.kz = up ? -0.2 : 0.2; p.hz = up ? 0.1 : -0.1;
      } else if (bar === 2) { // body wave
        p.tx = S(b * PI) * 0.2; p.kx = -S(b * PI) * 0.2; p.alz = 1.4 + S(b * PI) * 0.4; p.arz = 1.4 - S(b * PI) * 0.4; p.by = S(b * PI) * 0.08;
      } else { // spin + heart
        const lb = b % 4;
        p.spin = lb < 2 ? (lb / 2) * PI * 2 : 0; p.alz = 2.3; p.arz = 2.3; p.alx = lb >= 2 ? -0.6 : -0.1; p.arx = lb >= 2 ? -0.6 : -0.1;
        p.aly = lb >= 2 ? -0.9 : 0; p.ary = lb >= 2 ? 0.9 : 0;
      }
    },
    k: 18,
  },
  sing: {
    face: 'sing',
    fn: (t, p) => {
      p.arx = -1.0; p.arz = 0.35; p.ary = -0.45; p.elR = 2.0; // hand to mouth (mic)
      p.alz = 0.5 + Math.max(0, S(t * 1.2)) * 1.4; p.alx = -0.5 * Math.max(0, S(t * 1.2));
      p.hz = S(t * 2) * 0.07; p.kz = S(t * 2) * 0.1; p.kx = -0.15; p.by = Math.abs(S(t * 4)) * 0.02;
    },
  },
  interact: {
    face: 'smile', dur: 0.7,
    fn: (t, p) => { const a = S(clamp(t / 0.7, 0, 1) * PI); p.alx = -1.3 * a; p.arx = -1.3 * a; p.tx = 0.2 * a; p.kx = 0.1 * a; },
  },
  spin: {
    face: 'happy', dur: 0.9, k: 30,
    fn: (t, p) => { p.spin = easeSpin(t / 0.9) * PI * 2; p.alz = 1.3; p.arz = 1.3; p.by = S((t / 0.9) * PI) * 0.15; },
  },
  pose: {
    face: 'wink', dur: 1.6,
    fn: (t, p) => { p.arz = 1.1; p.arx = -0.9; p.ary = 0.3; p.elR = 2.2; p.alz = 0.6; p.alx = 0.3; p.kz = -0.2; p.hz = 0.08; p.ty = -0.2; },
  },
  stumble: {
    face: 'surprised', dur: 0.75,
    fn: (t, p) => {
      const a = S(clamp(t / 0.75, 0, 1) * PI);
      p.hx = 0.5 * a; p.alx = -1.5 * a; p.arx = -1.5 * a; p.alz = 0.8; p.arz = 0.8; p.llx = -0.6 * a; p.lrx = 0.5 * a; p.by = -0.1 * a;
    },
  },
  victory: {
    face: 'happy', dur: 1.8,
    fn: (t, p) => {
      p.arz = 2.9; p.arx = -0.2 + S(t * 10) * 0.15; p.alz = 0.4; p.alx = -0.9; p.by = Math.abs(S(t * 6)) * 0.22; p.kx = -0.2;
      p.llx = -Math.abs(S(t * 6)) * 0.4;
    },
  },
  tired: {
    face: 'tired', k: 6,
    fn: (t, p) => { p.tx = 0.38; p.kx = 0.35; p.alz = 0.05; p.arz = 0.05; p.alx = 0.15; p.arx = 0.15; p.by = -0.05 + S(t * 1.5) * 0.015; },
  },
  jump: {
    fn: (t, p) => { p.alz = 1.9; p.arz = 1.9; p.llx = -0.6; p.lrx = 0.3; p.kx = -0.1; },
  },
};

let tearGeo: THREE.BufferGeometry | null = null;
/** Round-topped, pointy-tipped hair lock (height 1, tip at -0.5y). */
function teardrop() {
  if (tearGeo) return tearGeo;
  const pts: THREE.Vector2[] = [];
  const N = 9;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = 0.5 * Math.pow(t, 0.75) * Math.sqrt(Math.max(0, 1 - t)) * 1.55;
    pts.push(new THREE.Vector2(Math.max(0.0001, r), -0.5 + t));
  }
  tearGeo = new THREE.LatheGeometry(pts, 10);
  tearGeo.userData.shared = true;
  return tearGeo;
}

function easeSpin(x: number) { x = clamp(x, 0, 1); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

// ---------- canvas painters ----------
function paintTorso(g: CanvasRenderingContext2D, d: TopData) {
  const W = 256;
  g.fillStyle = d.base;
  g.fillRect(0, 0, W, W);
  pattern(g, d.pattern, d.patternColor ?? '#fff', W, W);
  const cx = 128;
  const inner = d.inner ?? '#FFFFFF';
  const shade = (c: string) => c; // flat colours; toon ramp does shading
  g.lineJoin = 'round';
  switch (d.design) {
    case 'vest':
      g.fillStyle = inner;
      g.beginPath(); g.moveTo(cx - 40, 0); g.lineTo(cx + 40, 0); g.lineTo(cx, 118); g.closePath(); g.fill();
      g.strokeStyle = d.patternColor ?? '#eee'; g.lineWidth = 8;
      g.beginPath(); g.moveTo(cx - 44, 0); g.lineTo(cx, 124); g.lineTo(cx + 44, 0); g.stroke();
      g.fillStyle = d.patternColor ?? '#eee';
      g.fillRect(0, 150, W, 14);
      break;
    case 'blazer':
    case 'jacket':
      g.fillStyle = inner;
      g.beginPath(); g.moveTo(cx - 52, 0); g.lineTo(cx + 52, 0); g.lineTo(cx + 12, 150); g.lineTo(cx - 12, 150); g.closePath(); g.fill();
      g.strokeStyle = d.accent ?? 'rgba(0,0,0,0.12)'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(cx - 40, 0); g.lineTo(cx - 10, 120); g.moveTo(cx + 40, 0); g.lineTo(cx + 10, 120); g.stroke();
      if (d.design === 'blazer') {
        g.fillStyle = d.accent ?? '#FFFFFF';
        for (const y of [132, 152]) { g.beginPath(); g.arc(cx - 16, y, 5, 0, PI * 2); g.fill(); }
      } else if (d.pattern === 'denim') {
        g.strokeStyle = d.accent ?? '#8FB5DC'; g.lineWidth = 3; g.setLineDash([5, 4]);
        for (const px of [cx - 70, cx + 34]) { rr(g, px, 70, 36, 30, 6); g.stroke(); }
        g.beginPath(); g.moveTo(0, 58); g.lineTo(W, 58); g.moveTo(0, 176); g.lineTo(W, 176); g.stroke();
        g.setLineDash([]);
        g.fillStyle = '#E8EEF6';
        for (const y of [100, 132, 164]) { g.beginPath(); g.arc(cx - 22, y, 4, 0, PI * 2); g.fill(); }
      } else {
        g.strokeStyle = d.accent ?? '#FFB3C1'; g.lineWidth = 10;
        g.beginPath(); g.moveTo(0, 168); g.lineTo(W, 168); g.stroke();
      }
      break;
    case 'cardigan':
      g.fillStyle = inner; g.fillRect(cx - 20, 0, 40, W);
      g.fillStyle = '#FFFFFF';
      for (let y = 40; y < 180; y += 30) { g.beginPath(); g.arc(cx - 26, y, 5, 0, PI * 2); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, 158, W, 12);
      break;
    case 'hoodie':
      g.fillStyle = 'rgba(255,255,255,0.35)';
      rr(g, cx - 46, 116, 92, 44, 18); g.fill();
      g.strokeStyle = '#FFFFFF'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx - 16, 10); g.lineTo(cx - 18, 70); g.moveTo(cx + 16, 10); g.lineTo(cx + 18, 70); g.stroke();
      break;
    case 'pajama':
    case 'shirt':
      g.fillStyle = inner;
      if (d.design === 'shirt') { g.beginPath(); g.moveTo(cx - 22, 0); g.lineTo(cx + 22, 0); g.lineTo(cx, 50); g.closePath(); g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,0.1)'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(cx, 40); g.lineTo(cx, 190); g.stroke();
      g.fillStyle = '#FFFFFF';
      for (let y = 60; y < 180; y += 32) { g.beginPath(); g.arc(cx + 8, y, 5, 0, PI * 2); g.fill(); }
      break;
    case 'knit':
    case 'tee':
    case 'tank':
      g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 8;
      g.beginPath(); g.ellipse(cx, 0, 38, 20, 0, 0, PI); g.stroke();
      break;
  }
  if (d.emblem) emblem(g, d.emblem, d.emblemColor ?? '#FF9DB3', d.design === 'tee' || d.design === 'hoodie' ? cx : cx + 36, d.design === 'tee' || d.design === 'hoodie' ? 72 : 60, d.design === 'tee' ? 34 : 22);
  void shade;
}

function pattern(g: CanvasRenderingContext2D, kind: TopData['pattern'] | undefined, col: string, W: number, H: number) {
  if (!kind) return;
  g.fillStyle = col;
  g.strokeStyle = col;
  switch (kind) {
    case 'stripes':
      for (let y = 6; y < H; y += 26) g.fillRect(0, y, W, 11);
      break;
    case 'rib':
      g.globalAlpha = 0.7;
      for (let x = 0; x < W; x += 10) g.fillRect(x, 0, 4, H);
      g.globalAlpha = 1;
      break;
    case 'dots':
      for (let y = 10; y < H; y += 26) for (let x = (y / 26) % 2 ? 13 : 0; x < W; x += 26) { g.beginPath(); g.arc(x, y, 4.5, 0, PI * 2); g.fill(); }
      break;
    case 'stars':
      for (let y = 18; y < H; y += 44) for (let x = (y / 44) % 2 ? 22 : 0; x < W; x += 44) star(g, x, y, 8);
      break;
    case 'hearts':
      for (let y = 16; y < H; y += 40) for (let x = (y / 40) % 2 ? 20 : 0; x < W; x += 40) heart(g, x, y, 13);
      break;
    case 'strawberry':
      for (let y = 16; y < H; y += 42) for (let x = (y / 42) % 2 ? 21 : 0; x < W; x += 42) {
        g.fillStyle = col; g.beginPath(); g.moveTo(x - 7, y - 3); g.quadraticCurveTo(x, y + 14, x + 7, y - 3); g.quadraticCurveTo(x, y - 8, x - 7, y - 3); g.fill();
        g.fillStyle = '#6CCB8C'; g.fillRect(x - 5, y - 8, 10, 3);
      }
      break;
    case 'denim':
      g.globalAlpha = 0.55;
      for (let i = 0; i < 260; i++) g.fillRect(Math.random() * W, Math.random() * H, 1.5, 5 + Math.random() * 6);
      g.globalAlpha = 1;
      break;
    case 'sheep':
      for (let y = 20; y < H; y += 48) for (let x = (y / 48) % 2 ? 24 : 0; x < W; x += 48) emblem(g, 'sheep', '#fff', x, y, 12);
      break;
  }
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -PI / 2 + (i * PI) / 5;
    const rr2 = i % 2 ? r * 0.45 : r;
    g.lineTo(x + C(a) * rr2, y + S(a) * rr2);
  }
  g.closePath();
  g.fill();
}
function heart(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.beginPath();
  g.moveTo(x, y + s * 0.3);
  g.bezierCurveTo(x, y - s * 0.1, x - s * 0.55, y - s * 0.1, x - s * 0.5, y + s * 0.25);
  g.bezierCurveTo(x - s * 0.45, y + s * 0.55, x, y + s * 0.7, x, y + s * 0.85);
  g.bezierCurveTo(x, y + s * 0.7, x + s * 0.45, y + s * 0.55, x + s * 0.5, y + s * 0.25);
  g.bezierCurveTo(x + s * 0.55, y - s * 0.1, x, y - s * 0.1, x, y + s * 0.3);
  g.fill();
}
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function emblem(g: CanvasRenderingContext2D, kind: string, col: string, x: number, y: number, s: number) {
  g.save();
  g.fillStyle = col;
  switch (kind) {
    case 'heart': heart(g, x, y - s * 0.4, s); break;
    case 'star': star(g, x, y, s * 0.6); break;
    case 'note':
      g.font = `900 ${s * 1.3}px Nunito, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♪', x, y); break;
    case 'sheep': {
      g.fillStyle = '#FFFFFF';
      for (let i = 0; i < 7; i++) { const a = (i / 7) * PI * 2; g.beginPath(); g.arc(x + C(a) * s * 0.45, y + S(a) * s * 0.38, s * 0.3, 0, PI * 2); g.fill(); }
      g.beginPath(); g.arc(x, y, s * 0.45, 0, PI * 2); g.fill();
      g.strokeStyle = 'rgba(54,64,73,0.25)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, s * 0.8, 0, PI * 2); g.stroke();
      g.fillStyle = '#FFE7DA'; g.beginPath(); g.ellipse(x, y + s * 0.1, s * 0.3, s * 0.26, 0, 0, PI * 2); g.fill();
      g.fillStyle = '#364049';
      g.beginPath(); g.arc(x - s * 0.12, y + s * 0.06, s * 0.05 + 0.8, 0, PI * 2); g.arc(x + s * 0.12, y + s * 0.06, s * 0.05 + 0.8, 0, PI * 2); g.fill();
      break;
    }
    case 'number':
      g.font = `900 ${s * 1.4}px Nunito, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('06', x, y); break;
  }
  g.restore();
}

function paintLimb(g: CanvasRenderingContext2D, color: string, skin: string, coverTop: number, pat?: { kind?: TopData['pattern']; col?: string }, stripe?: string) {
  // canvas top = limb top (v=1). coverTop = fraction of limb (from top) that is clothed.
  const W = 64, H = 128;
  g.fillStyle = skin;
  g.fillRect(0, 0, W, H);
  if (coverTop <= 0) return;
  g.save();
  g.beginPath();
  g.rect(0, 0, W, H * coverTop);
  g.clip();
  g.fillStyle = color;
  g.fillRect(0, 0, W, H);
  if (pat?.kind) pattern(g, pat.kind, pat.col ?? '#fff', W, H);
  if (stripe) { g.fillStyle = stripe; g.fillRect(W * 0.2, 0, 6, H); g.fillRect(W * 0.7, 0, 6, H); }
  g.fillStyle = 'rgba(0,0,0,0.07)';
  g.fillRect(0, H * coverTop - 7, W, 7);
  g.restore();
}

// ---------- the character ----------
export class Hamin {
  root = new THREE.Group();
  private visual = new THREE.Group(); // gets spin
  private bounce = new THREE.Group();
  private hips = new THREE.Group();
  private torso = new THREE.Group();
  head = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  handR = new THREE.Group();
  handL = new THREE.Group();
  private shoeL = new THREE.Group();
  private shoeR = new THREE.Group();
  private shadow: THREE.Mesh;

  private faceCanvas: HTMLCanvasElement;
  private faceTex: THREE.CanvasTexture;
  private torsoCanvas = document.createElement('canvas');
  private armCanvas = document.createElement('canvas');
  private legCanvas = document.createElement('canvas');
  private torsoMat: THREE.MeshStandardMaterial;
  private armMat: THREE.MeshStandardMaterial;
  private legMat: THREE.MeshStandardMaterial;
  private waistMat = toonUnique(0xc9d3e8);
  private detail = new THREE.Group(); // collar/tie/hood
  private accHead = new THREE.Group();
  private accFace = new THREE.Group();
  private accExtra = new THREE.Group();
  private disposables: THREE.Texture[] = [];

  outfit: OutfitState = { ...DEFAULT_OUTFIT };

  // animation state
  private cur: Pose = { ...ZERO };
  private tgt: Pose = { ...ZERO };
  private action: AnimName | null = null;
  private actionT = 0;
  private actionLoop = false;
  private onActionEnd: (() => void) | null = null;
  private locoT = 0;
  private idleTime = 0;
  stridePhase = 0;
  danceBpm = 112;
  moveSpeed = 0; // world units / s, set by controller
  running = false;
  airborne = 0; // jump height set by controller
  lean = 0; // turning lean
  private expr: Expression = 'neutral';
  private exprOverride: Expression | null = null;
  private blinkT = 2;
  private blinking = 0;
  private shownExpr: Expression | null = null;
  private time = 0;

  constructor() {
    this.faceCanvas = document.createElement('canvas');
    this.faceCanvas.width = this.faceCanvas.height = 256;
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTex.colorSpace = THREE.SRGBColorSpace;
    this.torsoCanvas.width = this.torsoCanvas.height = 256;
    this.armCanvas.width = this.legCanvas.width = 64;
    this.armCanvas.height = this.legCanvas.height = 128;
    const mkTex = (c: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      this.disposables.push(t);
      return t;
    };
    this.torsoMat = toonUnique(0xffffff);
    this.torsoMat.map = mkTex(this.torsoCanvas);
    this.armMat = toonUnique(0xffffff);
    this.armMat.map = mkTex(this.armCanvas);
    this.legMat = toonUnique(0xffffff);
    this.legMat.map = mkTex(this.legCanvas);
    this.disposables.push(this.faceTex);

    this.build();
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: blobShadowTex(), transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -PI / 2;
    this.shadow.scale.setScalar(1.25);
    this.shadow.position.y = 0.02;
    this.shadow.renderOrder = -1;
    this.root.add(this.shadow);
    this.shadow.visible = !Quality.shadows;
    this.setOutfit(this.outfit);
    this.drawExpr('neutral');
  }

  private chest = new THREE.Group();

  /** Chibi proportions: ~2 heads tall (head Ø ≈ 1.06, total ≈ 2.05). */
  private build() {
    const skin = toon(P.skin);
    this.root.add(this.visual);
    this.visual.add(this.bounce);
    this.bounce.add(this.hips);
    this.hips.position.y = 0.42;

    // short stubby legs + big comfy shoes
    for (const [leg, shoe, x] of [[this.legL, this.shoeL, -0.12], [this.legR, this.shoeR, 0.12]] as const) {
      leg.position.set(x, 0, 0);
      leg.add(mk(capsule(0.115, 0.1, 4, 10), this.legMat, [0, -0.15, 0]));
      shoe.position.set(0, -0.35, 0.03);
      shoe.scale.setScalar(0.95);
      leg.add(shoe);
      this.hips.add(leg);
    }
    const waist = mk(sphere(0.24, 18, 12), this.waistMat, [0, 0.03, 0], [0, 0, 0], [0.92, 0.45, 0.82]);
    this.hips.add(waist);

    // small round torso
    this.hips.add(this.torso);
    this.torso.add(this.chest);
    this.chest.scale.setScalar(0.85);
    const body = mk(capsule(0.27, 0.1, 6, 16), this.torsoMat, [0, 0.3, 0], [0, PI, 0], [1, 1, 0.84]);
    this.chest.add(body, this.detail, this.accExtra);
    // arms
    for (const [arm, hand, side] of [[this.armL, this.handL, -1], [this.armR, this.handR, 1]] as const) {
      arm.position.set(side * 0.25, 0.43, 0);
      arm.add(mk(capsule(0.085, 0.13, 4, 10), this.armMat, [0, -0.13, 0]));
      hand.position.set(0, -0.3, 0);
      hand.add(mk(sphere(0.1, 12, 10), skin));
      arm.add(hand);
      this.torso.add(arm);
    }
    // neck + big head
    this.torso.add(mk(cyl(0.08, 0.09, 0.1, 10), skin, [0, 0.55, 0]));
    this.head.position.set(0, 1.0, 0);
    this.head.scale.setScalar(1.15);
    this.torso.add(this.head);
    this.head.add(mk(sphere(0.46, 28, 20), skin, [0, 0, 0], [0, 0, 0], [1.04, 0.97, 1]));
    // ears
    this.head.add(mk(sphere(0.085, 10, 8), skin, [-0.47, -0.05, 0.02], [0, 0, 0], [0.6, 1, 0.8]));
    this.head.add(mk(sphere(0.085, 10, 8), skin, [0.47, -0.05, 0.02], [0, 0, 0], [0.6, 1, 0.8]));
    // face decal
    const faceGeo = new THREE.SphereGeometry(0.463, 24, 18, PI / 2 - 0.9, 1.8, PI / 2 - 0.8, 1.6);
    const face = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ map: this.faceTex, transparent: true, depthWrite: false }));
    face.scale.set(1.04, 0.97, 1);
    face.renderOrder = 1;
    this.head.add(face);
    this.head.add(this.buildHair());
    this.head.add(this.accHead, this.accFace);
  }

  /** Black, soft, layered shaggy cut with a long full fringe (see character bible). */
  private buildHair() {
    const b = new StaticBatcher();
    b.shade = false;
    const hair = new THREE.Color(P.hair);
    const sheen = new THREE.Color(P.hairSheen);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const add = (geo: THREE.BufferGeometry, col: THREE.Color, p: [number, number, number], r: [number, number, number], s: [number, number, number]) => {
      e.set(r[0], r[1], r[2]);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(...p), q, new THREE.Vector3(...s));
      b.addGeometry(geo, col, m);
    };
    const tear = teardrop();
    const up = new THREE.Vector3(0, 1, 0);
    /** A tapered lock whose round root sits at `a` and whose tip points to `tip`. */
    const lockAt = (a: [number, number, number], tip: [number, number, number], w: number, d = w * 0.7) => {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...tip);
      const dir = va.clone().sub(vb);
      const len = dir.length();
      q.setFromUnitVectors(up, dir.normalize());
      m.compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(w, len, d));
      b.addGeometry(tear, hair, m);
    };
    const lock = sphere(1, 14, 10);
    // cranium cap, tilted back so the hairline sits under the fringe
    add(new THREE.SphereGeometry(0.5, 28, 14, 0, PI * 2, 0, PI * 0.52), hair, [0, 0.05, -0.03], [-0.22, 0, 0], [0.99, 1.0, 1.03]);
    add(lock, hair, [0, -0.02, -0.1], [0, 0, 0], [0.47, 0.47, 0.43]);
    // crown layers (soft volume, tips flowing back)
    lockAt([0.0, 0.46, 0.12], [0.02, 0.4, -0.32], 0.2, 0.1);
    lockAt([-0.16, 0.42, 0.1], [-0.3, 0.3, -0.3], 0.17, 0.09);
    lockAt([0.18, 0.42, 0.08], [0.32, 0.28, -0.3], 0.17, 0.09);
    // long full fringe: a few chunky, rounded clumps, slightly parted off-centre
    const fringe: [number, number, number][] = [
      // rootX, tipX, tipY
      [-0.32, -0.41, 0.0], [-0.17, -0.23, 0.06], [-0.02, -0.06, 0.02], [0.14, 0.14, 0.07], [0.3, 0.37, 0.02],
    ];
    for (const [rx, tx, ty] of fringe) {
      const rz = Math.sqrt(Math.max(0.01, 0.46 * 0.46 - rx * rx)) * 0.62;
      const tz = Math.sqrt(Math.max(0.01, 0.5 * 0.5 - tx * tx * 0.9)) * 0.97;
      lockAt([rx * 0.85, 0.44, rz], [tx, ty, tz], 0.33, 0.13);
    }
    // back layer fills gaps between clumps
    for (let i = 0; i < 4; i++) {
      const x = -0.26 + i * 0.17;
      const tz = Math.sqrt(Math.max(0.01, 0.5 * 0.5 - x * x)) * 0.93;
      lockAt([x * 0.8, 0.46, 0.2], [x * 1.05, 0.14, tz], 0.34, 0.12);
    }
    // soft side clumps framing the cheeks
    for (const sx of [-1, 1]) {
      lockAt([sx * 0.37, 0.28, 0.2], [sx * 0.45, -0.14, 0.24], 0.24, 0.12);
      lockAt([sx * 0.42, 0.26, -0.04], [sx * 0.47, -0.18, 0.0], 0.28, 0.14);
    }
    // layered nape
    for (const x of [-0.24, 0, 0.24]) lockAt([x * 0.9, 0.12, -0.36], [x * 1.15, -0.32, -0.38], 0.32, 0.14);
    // tousled top (reference look): two soft flicks
    lockAt([-0.05, 0.4, 0.16], [-0.24, 0.56, 0.06], 0.2, 0.1);
    lockAt([0.12, 0.44, 0.0], [0.33, 0.54, -0.1], 0.19, 0.1);
    // cowlick
    add(torus(0.07, 0.022, 6, 12, PI * 1.2), hair, [0.02, 0.53, -0.08], [0, PI / 2, 0.4], [1, 1, 1]);
    // anime sheen band
    add(torus(0.47, 0.02, 4, 24, PI * 0.5), sheen, [0, 0.17, -0.03], [PI / 2 - 0.4, 0, PI * 0.25 + PI / 2], [1.04, 1.04, 1]);
    const mesh = b.build('hair')!;
    mesh.matrixAutoUpdate = true;
    return mesh;
  }

  // ---------- outfits ----------
  setOutfit(o: OutfitState) {
    this.outfit = { ...o };
    const top = getItem(o.top)?.top ?? getItem(DEFAULT_OUTFIT.top)!.top!;
    const bot = getItem(o.bottom)?.bottom ?? getItem(DEFAULT_OUTFIT.bottom)!.bottom!;
    const shoes = getItem(o.shoes)?.shoes ?? getItem(DEFAULT_OUTFIT.shoes)!.shoes!;
    this.applyTop(top);
    this.applyBottom(bot);
    this.applyShoes(shoes);
    this.applyAcc(this.accHead, o.head ? getItem(o.head)?.acc : undefined);
    this.applyAcc(this.accFace, o.face ? getItem(o.face)?.acc : undefined);
    this.applyAcc(this.accExtra, o.extra ? getItem(o.extra)?.acc : undefined);
    this.refreshModel();
  }

  // ---------- generated (Higgsfield) model ----------
  private model: HaminModel | null = null;
  private anchors: { head: THREE.Group; chest: THREE.Group; hand: THREE.Group } | null = null;
  private holdAnchor = new THREE.Group();

  private modelFull = true;
  /** true when a full Higgsfield look is shown (false = generated head on the modular body). */
  get usesModel() {
    return !!this.model && this.modelFull;
  }
  get currentModel() { return this.model; }

  /** Swap in a generated model. `full` = whole look; otherwise only its head is used on the modular body. */
  setModel(m: HaminModel, full = true) {
    if (this.model && this.model !== m) {
      // rescue attached groups before dropping the old model
      this.head.add(this.accHead, this.accFace);
      this.chest.add(this.accExtra);
      this.handR.add(this.holdAnchor);
      this.model.root.removeFromParent();
      this.model.dispose();
    }
    this.modelFull = full;
    if (this.model === m) { this.refreshModel(); return; }
    this.model = m;
    this.visual.add(m.root);
    const mkAnchor = (bone: THREE.Object3D, localPos: THREE.Vector3, worldScale: number) => {
      const a = new THREE.Group();
      bone.add(a);
      m.root.updateMatrixWorld(true);
      const bq = bone.getWorldQuaternion(new THREE.Quaternion());
      const rq = m.root.getWorldQuaternion(new THREE.Quaternion());
      a.quaternion.copy(bq.invert().multiply(rq));
      const bs = bone.getWorldScale(new THREE.Vector3()).x / m.root.getWorldScale(new THREE.Vector3()).x;
      a.scale.setScalar(worldScale / bs);
      a.position.copy(localPos);
      return a;
    };
    const find = (n: string) => m.root.getObjectByName(n) ?? m.headBone;
    this.anchors = {
      head: mkAnchor(m.headBone, m.headCenter, 1.15 * m.headScale),
      chest: mkAnchor(find('Spine02'), new THREE.Vector3(), 0.85),
      hand: mkAnchor(find('LeftHand'), new THREE.Vector3(), 1),
    };
    this.markShadows();
    this.refreshModel();
  }

  /** Neck height of the modular body (where the generated head sits for other outfits). */
  static BODY_NECK_Y = 0.95;

  private refreshModel() {
    if (!this.model || !this.anchors) return;
    const full = this.usesModel;
    this.model.root.visible = true;
    this.model.setMode(full ? 'full' : 'head', Hamin.BODY_NECK_Y);
    this.bounce.visible = !full;
    // the procedural head is replaced by the generated one in both modes
    for (const c of this.head.children) if (c !== this.accHead && c !== this.accFace) c.visible = false;
    const A = this.anchors;
    A.head.add(this.accHead, this.accFace);
    if (full) {
      A.chest.add(this.accExtra);
      this.accExtra.position.set(0, -0.3, 0);
      A.hand.add(this.holdAnchor);
    } else {
      this.chest.add(this.accExtra);
      this.accExtra.position.set(0, 0, 0);
      this.handR.add(this.holdAnchor);
    }
  }

  private applyTop(d: TopData) {
    paintTorso(this.torsoCanvas.getContext('2d')!, d);
    this.torsoMat.map!.needsUpdate = true;
    const skinCss = '#FFE7DA';
    const cover = d.sleeve === 'long' ? 0.93 : d.sleeve === 'short' ? 0.42 : 0.0;
    paintLimb(this.armCanvas.getContext('2d')!, d.sleeveColor ?? d.base, skinCss, cover, { kind: d.pattern === 'rib' ? undefined : d.pattern, col: d.patternColor });
    this.armMat.map!.needsUpdate = true;
    // sleeve cap for sleeveless tops so shoulders read as clothing edge
    this.detail.clear();
    if (d.collar !== undefined) {
      const c = toon(d.collar);
      this.detail.add(mk(torus(0.115, 0.03, 6, 16), c, [0, 0.61, 0.03], [PI / 2 - 0.3, 0, 0], [1, 1.1, 1]));
    }
    if (d.tie !== undefined && d.tieDots) {
      const t = this.dotTieMat(d.tie);
      this.detail.add(mk(sphere(0.05, 10, 8), t, [0.01, 0.54, 0.19], [0, 0, 0], [1.1, 0.9, 0.8]));
      this.detail.add(mk(rbox(0.12, 0.3, 0.025, 0.012), t, [0.04, 0.38, 0.228], [-0.2, 0, -0.14]));
    } else if (d.tie !== undefined) {
      const t = toon(d.tie);
      this.detail.add(mk(sphere(0.045, 8, 6), t, [0, 0.55, 0.2]));
      this.detail.add(mk(rbox(0.09, 0.2, 0.03, 0.012), t, [0, 0.43, 0.22], [-0.25, 0, 0]));
      this.detail.add(mk(sphere(0.03, 8, 6), toon(0xffffff), [0, 0.38, 0.245]));
    }
    if (d.hood !== undefined) {
      this.detail.add(mk(torus(0.17, 0.07, 8, 16), toon(d.hood), [0, 0.6, -0.08], [PI / 2 + 0.35, 0, 0], [1.1, 1, 1]));
    }
  }

  private tieMat: THREE.MeshStandardMaterial | null = null;
  private dotTieMat(color: number) {
    if (!this.tieMat) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      g.fillStyle = '#' + color.toString(16).padStart(6, '0');
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#FFFFFF';
      for (let r = 0; r < 7; r++) for (let q = 0; q < 3; q++) { g.beginPath(); g.ellipse(8 + q * 22 + (r % 2) * 11, 5 + r * 9, 3.2, 1.6, 0, 0, PI * 2); g.fill(); }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      this.disposables.push(t);
      this.tieMat = toonUnique(0xffffff);
      this.tieMat.map = t;
    }
    return this.tieMat;
  }

  private beltMesh: THREE.Mesh | null = null;
  private applyBottom(d: BottomData) {
    if (this.beltMesh) { this.beltMesh.removeFromParent(); this.beltMesh = null; }
    if (d.belt !== undefined) {
      this.beltMesh = mk(torus(0.235, 0.028, 6, 22), toon(d.belt), [0, 0.07, 0], [PI / 2, 0, 0], [1, 0.84, 1]);
      this.beltMesh.add(mk(rbox(0.07, 0.05, 0.03, 0.01), toon(0xe0e4ee), [0, 0.235, 0], [PI / 2, 0, 0]));
      this.hips.add(this.beltMesh);
    }
    const cover = d.style === 'pants' ? 0.84 : 0.42;
    paintLimb(this.legCanvas.getContext('2d')!, d.base, '#FFE7DA', cover, { kind: d.pattern, col: d.patternColor }, d.stripe);
    this.legMat.map!.needsUpdate = true;
    this.waistMat.color.set(d.base);
  }

  private applyShoes(d: ShoeData) {
    for (const [shoe, side] of [[this.shoeL, -1], [this.shoeR, 1]] as const) {
      shoe.clear();
      const base = toon(new THREE.Color(d.base).getHex());
      const sole = toon(d.sole);
      if (d.style === 'loafer') {
        shoe.add(mk(rbox(0.26, 0.09, 0.37, 0.035), sole, [0, -0.025, 0.03]));
        shoe.add(mk(sphere(0.135, 14, 10), base, [0, 0.04, 0.04], [0, 0, 0], [0.97, 0.7, 1.32]));
        shoe.add(mk(rbox(0.13, 0.025, 0.06, 0.01), toon(0x555d72), [0, 0.12, 0.1], [0.35, 0, 0]));
        shoe.add(mk(cyl(0.12, 0.12, 0.06, 12), toon(0xffffff), [0, 0.12, -0.02]));
      } else if (d.style === 'sneaker' || d.style === 'boot') {
        shoe.add(mk(rbox(0.25, 0.07, 0.36, 0.03), sole, [0, -0.03, 0.03]));
        shoe.add(mk(sphere(0.135, 14, 10), base, [0, 0.03, 0.04], [0, 0, 0], [0.95, 0.72, 1.3]));
        if (d.style === 'boot') shoe.add(mk(cyl(0.13, 0.135, 0.2, 14), base, [0, 0.12, -0.01]));
        if (d.lace !== undefined) {
          const l = toon(d.lace);
          shoe.add(mk(rbox(0.1, 0.02, 0.03, 0.008), l, [0, 0.12, 0.11], [0.4, 0, 0]));
          shoe.add(mk(rbox(0.1, 0.02, 0.03, 0.008), l, [0, 0.105, 0.16], [0.4, 0, 0]));
        }
      } else if (d.style === 'sandal') {
        shoe.add(mk(rbox(0.25, 0.06, 0.36, 0.025), sole, [0, -0.04, 0.04]));
        shoe.add(mk(torus(0.1, 0.028, 6, 14, PI), base, [0, 0.0, 0.1], [0, 0, 0], [1.1, 1, 1]));
        shoe.add(mk(torus(0.1, 0.028, 6, 14, PI), base, [0, 0.0, -0.02], [0, 0, 0], [1.1, 1, 1]));
        shoe.add(mk(sphere(0.1, 10, 8), toon(P.skin), [0, 0.0, 0.05], [0, 0, 0], [1, 0.6, 1.5]));
      } else {
        shoe.add(mk(rbox(0.27, 0.07, 0.38, 0.03), sole, [0, -0.03, 0.03]));
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * PI * 2;
          shoe.add(mk(sphere(0.07, 8, 6), base, [C(a) * 0.08, 0.05 + S(a) * 0.02, 0.05 + S(a) * 0.1]));
        }
        shoe.add(mk(sphere(0.12, 12, 8), base, [0, 0.05, 0.05], [0, 0, 0], [1, 0.7, 1.3]));
        shoe.add(mk(sphere(0.02, 6, 4), toon(P.ink), [-0.035, 0.1, 0.17]));
        shoe.add(mk(sphere(0.02, 6, 4), toon(P.ink), [0.035, 0.1, 0.17]));
        shoe.add(mk(sphere(0.04, 8, 6), toon(P.pink), [side * 0.1, 0.1, 0.08], [0, 0, 0], [0.6, 0.4, 1]));
      }
    }
  }

  private applyAcc(slot: THREE.Group, a: AccData | undefined) {
    slot.clear();
    if (a) slot.add(buildAccessory(a));
    this.markShadows();
  }

  /** All solid parts cast soft shadows (face decal / blob excluded). */
  private markShadows() {
    this.visual.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !(m.material as THREE.Material).transparent) m.castShadow = true;
    });
  }

  // ---------- expressions ----------
  setExpression(e: Expression) { this.expr = e; }
  overrideExpression(e: Expression | null) { this.exprOverride = e; }

  private drawExpr(e: Expression) {
    if (this.model && this.model.root.visible) this.model.setFace(e);
    if (this.shownExpr === e) return;
    this.shownExpr = e;
    drawFace(this.faceCanvas.getContext('2d')!, e, HAMIN_FACE, 256);
    this.faceTex.needsUpdate = true;
  }

  /** Draw an expression to an arbitrary 2D canvas (used by reference sheet / UI). */
  static drawFaceTo(g: CanvasRenderingContext2D, e: Expression, size = 256) {
    drawFace(g, e, HAMIN_FACE, size);
  }

  // ---------- animation API ----------
  play(name: AnimName, opts: { loop?: boolean; onEnd?: () => void } = {}) {
    this.action = name;
    this.actionT = 0;
    const def = ANIMS[name];
    this.actionLoop = opts.loop ?? def.dur === undefined;
    this.onActionEnd = opts.onEnd ?? null;
  }
  /** Promise version of play for one-shots. */
  playAsync(name: AnimName) {
    return new Promise<void>((res) => this.play(name, { loop: false, onEnd: res }));
  }
  stop() {
    this.action = null;
    this.onActionEnd = null;
  }
  get currentAction() { return this.action; }

  holdRight(obj: THREE.Object3D | null) {
    this.holdAnchor.clear();
    if (obj) this.holdAnchor.add(obj);
    if (!this.holdAnchor.parent) this.handR.add(this.holdAnchor);
  }

  setShadowVisible(v: boolean) { this.shadow.visible = v && !Quality.shadows; }

  update(dt: number): void {
    this.time += dt;
    const p = this.tgt;
    for (const k of KEYS) p[k] = ZERO[k];
    let def: AnimDef;
    let t: number;
    if (this.action) {
      this.actionT += dt;
      def = ANIMS[this.action];
      t = this.actionT;
      if (!this.actionLoop && def.dur !== undefined && this.actionT >= def.dur) {
        const cb = this.onActionEnd;
        this.action = null;
        this.onActionEnd = null;
        cb?.();
        return this.update(0);
      }
      this.idleTime = 0;
    } else {
      // locomotion
      const sp = this.moveSpeed;
      if (this.airborne > 0.01) {
        def = ANIMS.jump;
      } else if (sp > 0.2) {
        this.stridePhase += dt * (4 + sp * 1.6);
        def = sp > 4.6 || this.running ? ANIMS.run : ANIMS.walk;
        this.idleTime = 0;
      } else {
        this.idleTime += dt;
        def = ANIMS.idle;
        if (this.idleTime > 9) {
          this.idleTime = 0;
          this.play('idle2');
          return this.update(0);
        }
      }
      this.locoT += dt;
      t = this.locoT;
    }
    def.fn(t, p, this);
    p.hz += this.lean;
    // blend
    const f = dampK(def.k ?? 14, dt);
    const c = this.cur;
    for (const k of KEYS) {
      if (k === 'spin') continue;
      c[k] += (p[k] - c[k]) * f;
    }
    c.spin = p.spin === 0 ? dampAngle(c.spin, 0, 12, dt) : p.spin;
    this.applyPose(c);

    // face
    let e = this.exprOverride ?? def.face ?? this.expr;
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blinking = 0.12;
      this.blinkT = 2 + Math.random() * 3;
    }
    if (this.blinking > 0) {
      this.blinking -= dt;
      if (e === 'neutral' || e === 'shy' || e === 'determined') e = 'blink';
    }
    this.drawExpr(e);
  }

  private applyPose(c: Pose) {
    this.visual.rotation.y = c.spin;
    this.bounce.position.set(c.bx, c.by + this.airborne, c.bz);
    this.hips.rotation.set(c.hx, c.hy, c.hz);
    this.torso.rotation.set(c.tx, c.ty, c.tz);
    this.head.rotation.set(c.kx, c.ky, c.kz);
    this.armL.rotation.set(c.alx, c.aly, -c.alz);
    this.armR.rotation.set(c.arx, c.ary, c.arz);
    this.legL.rotation.set(c.llx, 0, -c.llz);
    this.legR.rotation.set(c.lrx, 0, c.lrz);
    const h = Math.max(0, c.by + this.airborne);
    this.shadow.scale.setScalar(1.25 * (1 - Math.min(0.5, h * 0.6)));
    if (this.model && this.model.root.visible) this.model.apply(c, this.airborne);
  }

  dispose() {
    for (const t of this.disposables) t.dispose();
    this.torsoMat.dispose();
    this.armMat.dispose();
    this.legMat.dispose();
    this.waistMat.dispose();
  }
}

// ---------- accessories ----------
export function buildAccessory(a: AccData): THREE.Object3D {
  const g = new THREE.Group();
  const c1 = toon(a.color);
  const c2 = toon(a.color2 ?? 0xffffff);
  switch (a.kind) {
    case 'sheepEars': {
      g.add(mk(torus(0.5, 0.028, 6, 24, PI), c2, [0, 0.03, 0.02], [0, 0, 0], [1.02, 1.05, 1]));
      for (const sx of [-1, 1]) {
        const ear = new THREE.Group();
        ear.position.set(sx * 0.46, 0.3, 0.02);
        ear.rotation.z = sx * -0.9;
        ear.add(mk(sphere(0.13, 12, 8), c1, [0, 0, 0], [0, 0, 0], [1.4, 0.55, 0.8]));
        ear.add(mk(sphere(0.09, 10, 8), toon(P.pink), [0, 0, 0.05], [0, 0, 0], [1.3, 0.45, 0.4]));
        g.add(ear);
      }
      for (const x of [-0.14, 0, 0.14]) g.add(mk(sphere(0.09, 10, 8), c1, [x, 0.52 - Math.abs(x) * 0.3, 0.02]));
      break;
    }
    case 'beanie': {
      g.add(mk(new THREE.SphereGeometry(0.54, 24, 12, 0, PI * 2, 0, PI * 0.46), c1, [0, 0.06, -0.02], [-0.12, 0, 0], [1, 1.02, 1.02]));
      g.add(mk(torus(0.5, 0.07, 8, 24), c1, [0, 0.12, 0.02], [PI / 2 - 0.12, 0, 0]));
      g.add(mk(sphere(0.12, 10, 8), c2, [0, 0.64, -0.08]));
      break;
    }
    case 'bucket': {
      g.add(mk(new THREE.SphereGeometry(0.5, 24, 10, 0, PI * 2, 0, PI * 0.42), c1, [0, 0.14, -0.02], [-0.1, 0, 0], [1.04, 1, 1.04]));
      g.add(mk(cyl(0.76, 0.8, 0.04, 28), c1, [0, 0.2, 0.0], [-0.1, 0, 0]));
      g.add(mk(torus(0.49, 0.035, 6, 24), c2, [0, 0.25, 0], [PI / 2 - 0.1, 0, 0]));
      break;
    }
    case 'cap': {
      g.add(mk(new THREE.SphereGeometry(0.52, 24, 10, 0, PI * 2, 0, PI * 0.45), c1, [0, 0.12, -0.02], [-0.12, 0, 0]));
      g.add(mk(rbox(0.52, 0.035, 0.34, 0.015), c1, [0, 0.2, 0.52], [0.2, 0, 0]));
      g.add(mk(sphere(0.05, 8, 6), c2, [0, 0.64, -0.08]));
      g.add(mk(sphere(0.1, 10, 8), c2, [0, 0.38, 0.4], [0, 0, 0], [1, 1, 0.3]));
      break;
    }
    case 'flowerCrown': {
      g.add(mk(torus(0.47, 0.025, 6, 28), toon(P.mintDeep), [0, 0.3, -0.03], [PI / 2 - 0.2, 0, 0]));
      const cols = [P.pink, P.butter, P.blue, P.purple, P.pinkDeep, P.white, P.butter];
      for (let i = 0; i < 7; i++) {
        const ang = -PI / 2 + ((i - 3) / 3) * 1.3 + PI / 2;
        const x = S(ang - PI / 2 + PI / 2) * 0; void x;
        const a2 = (i / 7) * PI * 2;
        const f = new THREE.Group();
        f.position.set(S(a2) * 0.47, 0.3 + C(a2) * 0.08 + 0.02, C(a2) * 0.46 - 0.03);
        for (let k = 0; k < 5; k++) {
          const pa = (k / 5) * PI * 2;
          f.add(mk(sphere(0.045, 8, 6), toon(cols[i]), [C(pa) * 0.05, S(pa) * 0.05, 0.0]));
        }
        f.add(mk(sphere(0.035, 8, 6), toon(P.butterDeep)));
        f.lookAt(f.position.x * 3, f.position.y + 0.3, f.position.z * 3);
        g.add(f);
      }
      break;
    }
    case 'headphones': {
      g.add(mk(torus(0.53, 0.045, 8, 24, PI), c1, [0, 0.02, -0.02]));
      for (const sx of [-1, 1]) {
        g.add(mk(cyl(0.17, 0.17, 0.12, 18), c1, [sx * 0.5, 0.0, -0.02], [0, 0, PI / 2]));
        g.add(mk(cyl(0.12, 0.12, 0.13, 16), c2, [sx * 0.52, 0.0, -0.02], [0, 0, PI / 2]));
        for (const [dy, dz] of [[0.07, 0.05], [0.07, -0.08], [-0.05, 0]]) g.add(mk(sphere(0.07, 8, 6), toon(P.white), [sx * 0.58, dy, dz - 0.02]));
      }
      break;
    }
    case 'ribbon': {
      const r = new THREE.Group();
      r.position.set(0.33, 0.32, 0.25);
      r.rotation.set(0, 0.5, -0.4);
      r.add(mk(cone(0.09, 0.16, 10), c1, [-0.08, 0, 0], [0, 0, PI / 2]));
      r.add(mk(cone(0.09, 0.16, 10), c1, [0.08, 0, 0], [0, 0, -PI / 2]));
      r.add(mk(sphere(0.045, 8, 6), toon(P.strawberry)));
      g.add(r);
      break;
    }
    case 'glasses': {
      for (const sx of [-1, 1]) g.add(mk(torus(0.1, 0.014, 6, 20), c1, [sx * 0.145, -0.07, 0.47]));
      g.add(mk(cyl(0.012, 0.012, 0.09, 6), c1, [0, -0.05, 0.49], [0, 0, PI / 2]));
      for (const sx of [-1, 1]) g.add(mk(cyl(0.012, 0.012, 0.36, 6), c1, [sx * 0.26, -0.06, 0.28], [PI / 2, 0, 0], [1, 1, 1]));
      break;
    }
    case 'heartShades': {
      for (const sx of [-1, 1]) {
        const h = new THREE.Group();
        h.position.set(sx * 0.15, -0.07, 0.48);
        h.add(mk(sphere(0.07, 10, 8), c1, [-0.045, 0.02, 0], [0, 0, 0], [1, 1, 0.3]));
        h.add(mk(sphere(0.07, 10, 8), c1, [0.045, 0.02, 0], [0, 0, 0], [1, 1, 0.3]));
        h.add(mk(cone(0.095, 0.11, 12), c1, [0, -0.06, 0], [PI, 0, 0], [1, 1, 0.3]));
        g.add(h);
      }
      g.add(mk(cyl(0.012, 0.012, 0.1, 6), c2, [0, -0.04, 0.49], [0, 0, PI / 2]));
      for (const sx of [-1, 1]) g.add(mk(cyl(0.012, 0.012, 0.36, 6), c1, [sx * 0.27, -0.05, 0.28], [PI / 2, 0, 0]));
      break;
    }
    case 'crossbag': {
      g.add(mk(torus(0.36, 0.022, 6, 24), c2, [0, 0.32, 0], [0, PI / 2, 0.75], [1, 1.25, 1]));
      const bag = new THREE.Group();
      bag.position.set(0.27, 0.08, 0.14);
      bag.add(mk(sphere(0.14, 12, 10), c1, [0, 0, 0], [0, 0, 0], [1, 0.9, 0.55]));
      for (let i = 0; i < 6; i++) { const a2 = (i / 6) * PI * 2; bag.add(mk(sphere(0.06, 8, 6), c1, [C(a2) * 0.12, S(a2) * 0.1, 0.02])); }
      bag.add(mk(sphere(0.06, 10, 8), toon(P.skin), [0, -0.01, 0.07], [0, 0, 0], [1, 0.9, 0.5]));
      bag.add(mk(sphere(0.012, 6, 4), toon(P.ink), [-0.022, 0.0, 0.1]));
      bag.add(mk(sphere(0.012, 6, 4), toon(P.ink), [0.022, 0.0, 0.1]));
      g.add(bag);
      break;
    }
    case 'backpack': {
      g.add(mk(rbox(0.44, 0.44, 0.2, 0.08), c1, [0, 0.3, -0.3]));
      g.add(mk(rbox(0.3, 0.16, 0.08, 0.04), c2, [0, 0.2, -0.42]));
      for (const sx of [-1, 1]) g.add(mk(torus(0.2, 0.025, 6, 14, PI), c2, [sx * 0.16, 0.36, -0.05], [0, PI / 2, PI / 2]));
      break;
    }
    case 'micCharm': {
      const m = new THREE.Group();
      m.position.set(-0.2, 0.34, 0.24);
      m.rotation.z = 0.3;
      m.add(mk(sphere(0.055, 10, 8), c1, [0, 0.05, 0]));
      m.add(mk(cyl(0.02, 0.025, 0.1, 8), c2, [0, -0.02, 0]));
      g.add(m);
      break;
    }
  }
  return g;
}
