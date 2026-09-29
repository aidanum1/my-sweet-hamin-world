// 3D juice for the rhythm game, added to the room only while a session runs (disposed on cleanup):
//  • SheepCrowd  — little pom-pom sheep (Higgsfield sheep_lo) that pop in around Hamin during FEVER / the finale and hop on the beat
//  • MirrorFlash — a pastel sheen that sweeps across the Dance room's mirror wall on perfects (pulses in fever)
import * as THREE from 'three';
import { mk, sphere, cyl } from '../../assets/geo';
import { merged } from '../../assets/props';
import { canvasTex } from '../../assets/textures';
import { toon } from '../../assets/materials';
import { critterGeometry } from '../../assets/landmarks';
import { P } from '../../assets/palette';
import { clamp, damp, easeOutBack } from '../../utils/math';

const PI = Math.PI;

/** Procedural fallback body (~550 tris, ≈0.5 tall, front +Z): wool, face, ears, two stubby legs. */
function sheepBody() {
  const g = new THREE.Group();
  const W = 0xffffff;
  g.add(mk(sphere(0.2, 8, 6), W, [0, 0.3, 0], [0, 0, 0], [1, 0.9, 1]));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2 + 0.3;
    g.add(mk(sphere(0.1, 6, 4), W, [Math.cos(a) * 0.15, 0.37, Math.sin(a) * 0.13]));
  }
  g.add(mk(sphere(0.12, 8, 6), P.skin, [0, 0.35, 0.19], [0, 0, 0], [1, 0.92, 0.9]));
  for (const sx of [-1, 1]) {
    g.add(mk(sphere(0.018, 4, 3), P.ink, [sx * 0.045, 0.37, 0.295]));
    g.add(mk(sphere(0.024, 4, 3), P.blush, [sx * 0.075, 0.33, 0.285]));
    g.add(mk(sphere(0.05, 5, 3), P.skin, [sx * 0.13, 0.41, 0.15], [0, 0, sx * -0.6], [1.4, 0.5, 0.7]));
    g.add(mk(cyl(0.035, 0.035, 0.14, 5), P.skin, [sx * 0.08, 0.07, 0.03]));
  }
  const m = merged(g) as THREE.Mesh;
  return { geometry: m.geometry, material: m.material as THREE.Material };
}

/**
 * Where the cheering arm sits on a body: shoulder point, resting tilt (rad about Z, − = outward), arm length,
 * arm thickness and pom-pom size (× the base primitives).
 */
interface ArmRig { shoulder: THREE.Vector3; tilt: number; len: number; thick: number; pom: number }
const PROC_ARM: ArmRig = { shoulder: new THREE.Vector3(0.143, 0.365, 0.06), tilt: -0.5, len: 0.24, thick: 1, pom: 1 };
// sheep_lo at h 0.5: wool flank at x ≈ 0.17 around z 0, head (with ears) at z 0.05 … 0.25 up to y 0.5
const MODEL_ARM: ArmRig = { shoulder: new THREE.Vector3(0.15, 0.3, 0.03), tilt: -0.75, len: 0.25, thick: 1.6, pom: 1.15 };
/** Height of the Higgsfield crowd sheep (sheep_lo, ≈1.5k tris; 6 of them ≈ 9k) — the size of the procedural one. */
const MODEL_H = 0.5;
const POM_COLS = [P.pinkDeep, P.blueDeep, P.butterDeep];

interface CrowdSheep { o: THREE.Object3D; x: number; z: number; face: number; delay: number; ph: number; s: number }

/**
 * Cheering sheep around Hamin, each holding up a pom-pom in one of three colours that it waves on the beat.
 * Three instanced draw calls whatever the model: bodies (Higgsfield sheep_lo, procedural until/unless it loads),
 * arms and pom-poms (per-instance colour).
 */
export class SheepCrowd {
  readonly group = new THREE.Group();
  private list: CrowdSheep[] = [];
  private body: THREE.InstancedMesh;
  private arms: THREE.InstancedMesh;
  private poms: THREE.InstancedMesh;
  /** the body geometry we own (procedural, then the model's baked copy); the materials are shared */
  private bodyGeo: THREE.BufferGeometry;
  private rig = PROC_ARM;
  private k = 0;
  private want = false;
  private t = 0;
  private disposed = false;
  private m4 = new THREE.Matrix4();
  private l4 = new THREE.Matrix4();
  private r4 = new THREE.Matrix4();
  private v = new THREE.Vector3();

  constructor(private scene: THREE.Scene, spot: { x: number; z: number; rot: number }, cam: THREE.Vector3) {
    const fwd = new THREE.Vector3(Math.sin(spot.rot), 0, Math.cos(spot.rot));
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    // [side, forward, scale] — a loose half ring around Hamin, never between him and the camera
    const layout: [number, number, number][] = [
      [-2.0, 0.55, 1.15], [2.05, 0.6, 1.15], [-2.75, -0.55, 1.05], [2.8, -0.5, 1.05], [-1.45, -1.35, 1.0], [1.5, -1.3, 1.0],
    ];
    const n = layout.length;
    const fb = sheepBody();
    this.bodyGeo = fb.geometry;
    this.body = new THREE.InstancedMesh(fb.geometry, fb.material, n);
    this.arms = new THREE.InstancedMesh(cyl(0.022, 0.022, 1, 4), toon(P.skin), n);
    this.poms = new THREE.InstancedMesh(sphere(0.085, 7, 5), toon(0xffffff), n);
    for (const im of [this.body, this.arms, this.poms]) {
      im.frustumCulled = false; // instances move every frame
      im.userData.noShadow = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(im);
    }
    const col = new THREE.Color();
    layout.forEach(([sx, fz, s], i) => {
      const x = spot.x + side.x * sx + fwd.x * fz;
      const z = spot.z + side.z * sx + fwd.z * fz;
      const face = Math.atan2(cam.x - x, cam.z - z) * 0.7 + Math.atan2(spot.x - x, spot.z - z) * 0.3;
      const o = new THREE.Object3D(); // transform holder (the instances draw it)
      o.position.set(x, 0, z);
      o.scale.setScalar(0.001);
      o.updateMatrix();
      for (const im of [this.body, this.arms, this.poms]) im.setMatrixAt(i, o.matrix); // hidden until the first update
      this.poms.setColorAt(i, col.setHex(POM_COLS[i % 3]));
      this.list.push({ o, x, z, face, delay: (i % 3) * 0.18 + (i > 3 ? 0.1 : 0), ph: i % 2 ? 0.5 : 0, s });
    });
    this.group.visible = false;
    scene.add(this.group);
    // Higgsfield sheep bodies (cached after the first load); keep the procedural ones if it fails
    critterGeometry('sheep_lo', { h: MODEL_H })
      .then(({ geometry, material }) => {
        if (this.disposed) { geometry.dispose(); return; }
        this.body.geometry = geometry;
        this.body.material = material;
        this.bodyGeo.dispose();
        this.bodyGeo = geometry;
        this.rig = MODEL_ARM;
      })
      .catch((e) => console.warn('crowd sheep model failed, keeping the procedural sheep', e));
  }

  get shown() { return this.want; }

  show(v: boolean) {
    this.want = v;
    if (v) this.group.visible = true;
  }

  /** Positions for little heart/note particles above the crowd. */
  heads() {
    return this.list.map((c) => new THREE.Vector3(c.x, 0.95 * c.s, c.z));
  }

  update(dt: number, beat: number) {
    if (!this.group.visible) return;
    this.t += dt;
    this.k = this.want ? Math.min(1.6, this.k + dt * 2.2) : Math.max(0, this.k - dt * 2.8);
    const { shoulder, tilt, len, thick, pom } = this.rig;
    this.list.forEach((c, i) => {
      const a = clamp((this.k - c.delay) / 0.9, 0, 1);
      const sc = (this.want ? easeOutBack(a) : a) * c.s;
      const f = (((beat + c.ph) % 1) + 1) % 1;
      const hop = Math.sin(f * PI) * 0.26 * a;
      const land = Math.exp(-f * 10) * a; // squish right on the beat
      const o = c.o;
      o.position.set(c.x, hop, c.z);
      o.scale.set(sc * (1 + land * 0.12), Math.max(0.001, sc * (1 - land * 0.16)), sc * (1 + land * 0.12));
      o.rotation.set(0, c.face + Math.sin((beat + c.ph) * PI) * 0.25, Math.sin((beat + c.ph) * PI * 0.5) * 0.12);
      o.updateMatrix();
      this.body.setMatrixAt(i, o.matrix);
      // arm pivots at the shoulder and waves the pom-pom on the beat; held on the side away from Hamin
      const sgn = i % 2 ? 1 : -1;
      const wave = tilt + Math.sin((beat + c.ph) * PI * 2) * 0.35;
      this.r4.makeRotationZ(sgn * wave).setPosition(this.v.copy(shoulder).setX(shoulder.x * sgn));
      this.l4.makeTranslation(0, len / 2, 0).premultiply(this.r4);
      this.l4.multiply(this.m4.makeScale(thick, len, thick));
      this.arms.setMatrixAt(i, this.m4.multiplyMatrices(o.matrix, this.l4));
      this.l4.makeTranslation(0, len + 0.03 * pom, 0).premultiply(this.r4).multiply(this.m4.makeScale(pom, pom, pom));
      this.poms.setMatrixAt(i, this.m4.multiplyMatrices(o.matrix, this.l4));
    });
    this.body.instanceMatrix.needsUpdate = true;
    this.arms.instanceMatrix.needsUpdate = true;
    this.poms.instanceMatrix.needsUpdate = true;
    if (!this.want && this.k <= 0) this.group.visible = false;
  }

  dispose() {
    this.disposed = true;
    this.scene.remove(this.group);
    this.bodyGeo.dispose(); // arms/poms use cached primitives; all materials are shared
    for (const im of [this.body, this.arms, this.poms]) im.dispose();
  }
}

/** Pastel sheen over the Dance room's painted mirror wall (see DanceScene: 8.6 × 2.35 at y 1.55 on the back wall). */
export class MirrorFlash {
  private mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private tex: THREE.Texture;
  private u = 1;
  private peak = 0;
  private ci = 0;
  private glow = 0;
  private static COLORS = [0xff9db3, 0x86b8f0, 0xf8d57e, 0x8fdcbc, 0xc3a8f2];

  constructor(private scene: THREE.Scene, pos = new THREE.Vector3(0, 1.55, -4.5 + 0.17), w = 8.6, h = 2.35) {
    this.tex = canvasTex(256, 64, (g, cw, ch) => {
      g.clearRect(0, 0, cw, ch);
      g.fillStyle = 'rgba(255,255,255,.22)';
      g.fillRect(2, 0, cw - 4, ch);
      // bright diagonal band in the middle
      const grd = g.createLinearGradient(cw * 0.36, 0, cw * 0.64, 0);
      grd.addColorStop(0, 'rgba(255,255,255,0)');
      grd.addColorStop(0.5, 'rgba(255,255,255,.95)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(cw * 0.42, 0); g.lineTo(cw * 0.64, 0); g.lineTo(cw * 0.58, ch); g.lineTo(cw * 0.36, ch);
      g.fill();
    });
    this.tex.wrapS = THREE.ClampToEdgeWrapping;
    // normal blending: the painted mirror is almost white, so a tinted sheen reads better than an additive one
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, opacity: 0, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat);
    this.mesh.position.copy(pos);
    this.mesh.userData.noShadow = true;
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  flash(strength = 1) {
    this.peak = this.u < 0.3 ? Math.max(this.peak, strength) : strength;
    this.u = 0;
    this.mat.color.setHex(MirrorFlash.COLORS[this.ci++ % MirrorFlash.COLORS.length]);
  }

  update(dt: number, beat: number, fever: boolean) {
    this.glow = damp(this.glow, fever ? 1 : 0, 4, dt);
    let op = 0;
    if (this.u < 1) {
      this.u = Math.min(1, this.u + dt / 0.42);
      this.tex.offset.x = 0.75 - this.u * 1.5;
      op = this.peak * Math.pow(1 - this.u, 0.6);
    }
    const f = ((beat % 1) + 1) % 1;
    op = Math.max(op, this.glow * (0.18 + 0.4 * Math.exp(-f * 5)));
    if (this.glow > 0.01 && this.u >= 1) this.tex.offset.x = 0.75 - f * 1.5;
    this.mat.opacity = op;
    this.mesh.visible = op > 0.005;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.tex.dispose();
  }
}
