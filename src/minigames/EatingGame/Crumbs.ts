// Chunky 3D crumbs / steam puffs / fire-breath sparks for the Eating Game.
// One InstancedMesh (a single draw call) with a fixed pool; dead particles are scaled to zero.
import * as THREE from 'three';

export type CrumbKind = 'crumb' | 'steam' | 'fire' | 'spark';

interface Part {
  alive: boolean;
  kind: CrumbKind;
  p: THREE.Vector3;
  v: THREE.Vector3;
  life: number;
  max: number;
  size: number;
  spin: number;
  rot: number;
  floor: number;
  bounced: boolean;
}

export interface EmitOpts {
  /** initial speed (random direction, biased by `dir`) */
  speed?: number;
  /** extra velocity added to every particle */
  dir?: THREE.Vector3;
  /** random positional jitter radius */
  jitter?: number;
  size?: number;
  life?: number;
  /** y where crumbs land and bounce (defaults to the emitter floor) */
  floor?: number;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class Crumbs {
  readonly mesh: THREE.InstancedMesh;
  private parts: Part[] = [];
  private next = 0;
  private dirty = true;
  /** default landing height (the belt / counter top) */
  floor = 0;

  constructor(count = 140) {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0 });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.userData.noShadow = true;
    this.mesh.name = 'eat-crumbs';
    for (let i = 0; i < count; i++) {
      this.parts.push({ alive: false, kind: 'crumb', p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 1, size: 0.03, spin: 0, rot: 0, floor: 0, bounced: false });
      this.mesh.setMatrixAt(i, ZERO);
      this.mesh.setColorAt(i, tmpC.setHex(0xffffff));
    }
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  /** Spawn `n` particles of `kind` at `pos`, coloured from `colors`. */
  emit(pos: THREE.Vector3, colors: number[], n: number, kind: CrumbKind = 'crumb', o: EmitOpts = {}) {
    const speed = o.speed ?? (kind === 'crumb' ? 1.4 : kind === 'steam' ? 0.35 : kind === 'fire' ? 0.6 : 0.3);
    const jit = o.jitter ?? 0.05;
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.parts.length;
      const q = this.parts[i];
      q.alive = true;
      q.kind = kind;
      q.p.set(pos.x + (Math.random() - 0.5) * jit * 2, pos.y + (Math.random() - 0.5) * jit, pos.z + (Math.random() - 0.5) * jit * 2);
      // random direction, upward-biased for crumbs
      const a = Math.random() * Math.PI * 2;
      const up = kind === 'crumb' ? 0.6 + Math.random() * 0.9 : kind === 'steam' ? 0.9 + Math.random() * 0.4 : Math.random() * 0.4;
      q.v.set(Math.cos(a) * speed * (0.4 + Math.random() * 0.6), up * speed, Math.sin(a) * speed * (0.4 + Math.random() * 0.6));
      if (o.dir) q.v.add(o.dir);
      const base = o.size ?? (kind === 'crumb' ? 0.032 : kind === 'steam' ? 0.05 : kind === 'fire' ? 0.05 : 0.02);
      q.size = base * (0.65 + Math.random() * 0.7);
      q.max = q.life = (o.life ?? (kind === 'crumb' ? 1.0 : kind === 'steam' ? 1.1 : kind === 'fire' ? 0.5 : 0.7)) * (0.75 + Math.random() * 0.5);
      q.spin = (Math.random() - 0.5) * 14;
      q.rot = Math.random() * 6;
      q.floor = o.floor ?? this.floor;
      q.bounced = false;
      this.mesh.setColorAt(i, tmpC.setHex(colors[Math.floor(Math.random() * colors.length)] ?? 0xffffff));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.dirty = true;
    this.mesh.visible = true;
  }

  update(dt: number) {
    if (!this.dirty) {
      this.mesh.visible = false;
      return;
    }
    let any = false;
    for (let i = 0; i < this.parts.length; i++) {
      const q = this.parts[i];
      if (!q.alive) continue;
      q.life -= dt;
      if (q.life <= 0) {
        q.alive = false;
        this.mesh.setMatrixAt(i, ZERO);
        continue;
      }
      any = true;
      const k = q.life / q.max;
      let s = q.size;
      switch (q.kind) {
        case 'crumb':
          q.v.y -= 7.5 * dt;
          q.p.addScaledVector(q.v, dt);
          if (q.p.y < q.floor && q.v.y < 0) {
            q.p.y = q.floor;
            if (!q.bounced) {
              q.v.y *= -0.35;
              q.v.x *= 0.5;
              q.v.z *= 0.5;
              q.bounced = true;
            } else q.v.set(0, 0, 0);
          }
          s *= k < 0.3 ? k / 0.3 : 1;
          break;
        case 'steam':
          q.v.multiplyScalar(1 - 1.8 * dt);
          q.v.y += 0.6 * dt;
          q.p.addScaledVector(q.v, dt);
          s *= 0.6 + (1 - k) * 1.6;
          s *= k < 0.35 ? k / 0.35 : 1;
          break;
        case 'fire':
          q.v.multiplyScalar(1 - 2.2 * dt);
          q.v.y += 0.8 * dt;
          q.p.addScaledVector(q.v, dt);
          s *= 0.4 + k * 0.9;
          break;
        case 'spark':
          q.v.y += 0.9 * dt;
          q.p.addScaledVector(q.v, dt);
          s *= k;
          break;
      }
      q.rot += q.spin * dt;
      tmpE.set(q.rot, q.rot * 0.7, 0);
      tmpQ.setFromEuler(tmpE);
      tmpS.setScalar(Math.max(0.0001, s));
      tmpM.compose(q.p, tmpQ, tmpS);
      this.mesh.setMatrixAt(i, tmpM);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    // keep updating one extra frame after the last particle died so it is hidden
    this.dirty = any;
  }

  clear() {
    for (let i = 0; i < this.parts.length; i++) {
      this.parts[i].alive = false;
      this.mesh.setMatrixAt(i, ZERO);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = false;
    this.dirty = false;
  }
}
