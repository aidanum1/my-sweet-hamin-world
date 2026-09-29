import * as THREE from 'three';
import { heartPath } from '../assets/textures';

export type BurstKind = 'hearts' | 'sparkles' | 'notes' | 'confetti';

const CONFETTI = [0xffccd5, 0xb2d9ff, 0xffe9a8, 0xbff0da, 0xe6b2ff];
const MAX = 160;

/** Atlas: 0 = heart, 1 = sparkle, 2 = note. */
function atlas() {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 64;
  const g = c.getContext('2d')!;
  // heart
  heartPath(g, 32, 6, 54);
  g.fillStyle = '#FF7A93';
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = '#fff';
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.beginPath(); g.ellipse(21, 22, 5, 7, -0.5, 0, Math.PI * 2); g.fill();
  // sparkle
  const grd = g.createRadialGradient(96, 32, 0, 96, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(64, 0, 64, 64);
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(96, 2); g.quadraticCurveTo(99, 29, 126, 32); g.quadraticCurveTo(99, 35, 96, 62); g.quadraticCurveTo(93, 35, 66, 32); g.quadraticCurveTo(93, 29, 96, 2);
  g.fill();
  // note
  g.font = 'bold 50px Nunito, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = '#fff';
  g.strokeText('♪', 160, 34);
  g.fillStyle = '#9b8cf0';
  g.fillText('♪', 160, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.shared = true;
  return t;
}

/**
 * Pooled particles (hearts, sparkles, notes, confetti) rendered as ONE THREE.Points
 * with an atlas texture — a single draw call no matter how many are alive.
 */
export class Particles {
  group = new THREE.Group();
  private pos = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);
  private size = new Float32Array(MAX);
  private cell = new Float32Array(MAX);
  private alpha = new Float32Array(MAX);
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private max = new Float32Array(MAX);
  private base = new Float32Array(MAX);
  private next = 0;
  private geo = new THREE.BufferGeometry();
  private pts: THREE.Points;

  constructor() {
    const g = this.geo;
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aCell', new THREE.BufferAttribute(this.cell, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: atlas() }, uScale: { value: 600 } },
      vertexShader: /* glsl */ `
        attribute float aSize; attribute float aCell; attribute float aAlpha;
        varying vec3 vCol; varying float vCell; varying float vA;
        uniform float uScale;
        void main() {
          vCol = color; vCell = aCell; vA = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aAlpha > 0.0 ? aSize * uScale / -mv.z : 0.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        varying vec3 vCol; varying float vCell; varying float vA;
        void main() {
          vec2 uv = vec2((gl_PointCoord.x + vCell) / 3.0, 1.0 - gl_PointCoord.y);
          vec4 t = texture2D(uTex, uv);
          if (t.a < 0.02) discard;
          gl_FragColor = vec4(t.rgb * vCol, t.a * vA);
        }`,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    });
    mat.userData.shared = true;
    this.pts = new THREE.Points(g, mat);
    this.pts.frustumCulled = false;
    this.pts.renderOrder = 5;
    this.pts.userData.noShadow = true;
    this.group.add(this.pts);
  }

  attach(scene: THREE.Scene) {
    scene.add(this.group);
  }

  private spawn(p: THREE.Vector3, kind: BurstKind, vx: number, vy: number, vz: number, life: number, size: number, i2: number) {
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.life[i] = this.max[i] = life;
    this.base[i] = size;
    this.cell[i] = kind === 'hearts' ? 0 : kind === 'notes' ? 2 : 1;
    const c = new THREE.Color(kind === 'confetti' ? CONFETTI[i2 % CONFETTI.length] : kind === 'sparkles' ? [0xffffff, 0xfff3b0, 0xffd6e5][i2 % 3] : 0xffffff);
    this.col.set([c.r, c.g, c.b], i * 3);
    this.alpha[i] = 1;
  }

  burst(pos: THREE.Vector3, kind: BurstKind = 'hearts', count = 8, spread = 1) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.6 + Math.random() * 1.2) * spread;
      const p = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4 * spread, Math.random() * 0.3, (Math.random() - 0.5) * 0.4 * spread));
      const size = kind === 'sparkles' || kind === 'confetti' ? 0.3 + Math.random() * 0.25 : 0.36 + Math.random() * 0.18;
      this.spawn(p, kind, Math.cos(a) * sp, 1.6 + Math.random() * 1.8, Math.sin(a) * sp, 0.9 + Math.random() * 0.6, size, k);
    }
  }

  /** Gentle continuous float (ambient hearts above something). */
  floatUp(pos: THREE.Vector3, kind: BurstKind = 'hearts') {
    this.spawn(pos.clone(), kind, (Math.random() - 0.5) * 0.3, 0.9, (Math.random() - 0.5) * 0.3, 1.6, 0.25, 0);
  }

  update(dt: number) {
    const s = this.pts.material as THREE.ShaderMaterial;
    // gl_PointSize is in device pixels: world size → pixels at depth 1 (projection scale × DPR)
    const r = (window as any).__renderer as THREE.WebGLRenderer | undefined;
    const dpr = r ? r.getPixelRatio() : 1;
    s.uniforms.uScale.value = ((innerHeight || 600) * dpr) / (2 * Math.tan((35 * Math.PI) / 360)) * 1.35;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) {
        if (this.alpha[i] !== 0) this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const v = i * 3;
      this.vel[v + 1] -= 2.2 * dt;
      const damp = 1 - 1.5 * dt;
      this.vel[v] *= damp; this.vel[v + 1] *= damp; this.vel[v + 2] *= damp;
      this.pos[v] += this.vel[v] * dt;
      this.pos[v + 1] += this.vel[v + 1] * dt;
      this.pos[v + 2] += this.vel[v + 2] * dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      this.size[i] = this.base[i] * (k > 0.8 ? (1 - k) * 5 : 1) * (0.6 + 0.4 * k);
      this.alpha[i] = k <= 0 ? 0 : Math.min(1, k * 2.5);
    }
    const a = this.geo.attributes;
    a.position.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = a.color.needsUpdate = a.aCell.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    this.alpha.fill(0);
  }
}
