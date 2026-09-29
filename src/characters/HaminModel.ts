import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { drawFace, Expression, FaceStyle } from './face';

/** Face decal drawn over the baked face for expressions (units: 256² canvas). */
// Coordinates are in "square space": x 0..256 across the box, y 0..256/aspect down it.
const MODEL_FACE: FaceStyle = {
  eyeColor: '#2E2230', eyeGap: 67, eyeY: 86, eyeW: 25, eyeH: 29, mouthY: 131,
  brows: false, browColor: '#2B2A33', blushColor: '#FF9FB2',
};
/** Where the face sits inside the head's bind-pose bounding box (fractions), tuned against ?ref=face */
export const FACE_FIT = { cx: 0.5, cy: 0.36, w: 0.62, h: 0.46, top: 0.72 };

/** Joint values produced by Hamin's procedural pose system (see Hamin.ts). */
export interface PoseLike {
  by: number; bx: number; bz: number;
  hx: number; hy: number; hz: number;
  tx: number; ty: number; tz: number;
  kx: number; ky: number; kz: number;
  alx: number; aly: number; alz: number;
  arx: number; ary: number; arz: number;
  llx: number; lrx: number; llz: number; lrz: number;
  elL: number; elR: number;
}

interface Driven {
  bone: THREE.Bone;
  bindLocal: THREE.Quaternion;
  W: THREE.Quaternion; // bind world rotation (character space)
  Winv: THREE.Quaternion;
}

export const MODEL_HEIGHT = 2.1;
const cache = new Map<string, Promise<THREE.Group>>();
let loader: GLTFLoader | null = null;

/** Load (once per file) a Higgsfield-generated, optimised chibi Hamin look (meshopt + webp). */
export function loadHaminGltf(file = 'models/hamin.glb'): Promise<THREE.Group> {
  let p = cache.get(file);
  if (!p) {
    if (!loader) {
      loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
    }
    p = loader.loadAsync(import.meta.env.BASE_URL + file).then((g) => g.scene);
    p.catch(() => cache.delete(file));
    cache.set(file, p);
  }
  return p;
}

/**
 * Wraps the skinned model and drives its humanoid bones from the procedural pose.
 * Deltas are expressed in character space and converted into each bone's local frame:
 * local = bindLocal · (W⁻¹ · Δ · W), which rotates the bone about a character-space axis
 * while children inherit parent motion (same semantics as the procedural rig).
 */
export class HaminModel {
  root = new THREE.Group(); // bounce/offset container
  mesh: THREE.SkinnedMesh;
  headMesh: THREE.SkinnedMesh;
  mode: 'full' | 'head' = 'full';
  neckY = 1; // bind-pose neck height (character space)
  private headOffset = 0;
  headBone: THREE.Bone;
  private b: Record<string, Driven> = {};
  private armRaise = { L: 0.7, R: 0.7 };
  private hinge: Record<string, THREE.Vector3> = {};
  private bindBend = 0.15;
  private tq = new THREE.Quaternion();
  private te = new THREE.Euler();
  private tz = new THREE.Quaternion();
  headScale = 1;
  headCenter = new THREE.Vector3(); // in head-bone space
  private faceCanvas = document.createElement('canvas');
  private faceTex: THREE.CanvasTexture;
  private faceU = {
    faceMap: { value: null as THREE.Texture | null },
    faceOn: { value: 0 },
    faceCenter: { value: new THREE.Vector3() },
    faceRight: { value: new THREE.Vector3() },
    faceUp: { value: new THREE.Vector3() },
    faceFwd: { value: new THREE.Vector3(0, 0, 1) },
    faceTop: { value: FACE_FIT.top },
  };
  private skinCss = '#FCE4D8';
  private faceAspect = 1.68;
  private shownExpr: Expression | 'baked' | null = null;

  constructor(src: THREE.Group) {
    const model = cloneSkinned(src);
    let mesh: THREE.SkinnedMesh | null = null;
    model.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh;
    });
    if (!mesh) throw new Error('hamin.glb has no skinned mesh');
    this.mesh = mesh;
    const m = mesh as THREE.SkinnedMesh;
    m.frustumCulled = false;
    m.castShadow = true;
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    m.material = mat;
    // The texture already carries soft baked light; keep a little of it as emission so it reads like a vinyl toy.
    mat.emissiveIntensity = 0.28;
    mat.roughness = 0.62;
    mat.metalness = 0;
    mat.side = THREE.FrontSide;
    this.faceCanvas.width = this.faceCanvas.height = 256;
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTex.colorSpace = THREE.SRGBColorSpace;
    this.faceU.faceMap.value = this.faceTex;
    mat.emissiveMap = null;
    mat.emissive = new THREE.Color(1, 1, 1);
    const U = this.faceU;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vBindPos;\nvarying vec3 vBindNrm;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBindPos = position;\nvBindNrm = normal;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vBindPos; varying vec3 vBindNrm;
uniform sampler2D faceMap; uniform float faceOn; uniform float faceTop;
uniform vec3 faceCenter; uniform vec3 faceRight; uniform vec3 faceUp; uniform vec3 faceFwd;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
if (faceOn > 0.5) {
  vec3 fd = vBindPos - faceCenter;
  vec2 fuv = vec2(dot(fd, faceRight), dot(fd, faceUp)) + 0.5;
  float fr = dot(normalize(vBindNrm), faceFwd);
  if (fuv.x > 0.0 && fuv.x < 1.0 && fuv.y > 0.0 && fuv.y < 1.0 && fr > 0.25) {
    vec4 fc = texture2D(faceMap, fuv);
    float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    float guard = fuv.y > faceTop ? smoothstep(0.2, 0.45, lum) : 1.0;
    diffuseColor.rgb = mix(diffuseColor.rgb, fc.rgb, fc.a * guard * smoothstep(0.25, 0.45, fr));
  }
}`)
        .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= diffuseColor.rgb;');
    };
    mat.customProgramCacheKey = () => 'hamin-face';

    // normalise size: feet on the ground, ~2.1 units tall
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m, true);
    const h = box.max.y - box.min.y;
    const s = MODEL_HEIGHT / h;
    model.scale.multiplyScalar(s);
    model.position.y -= box.min.y * s;
    model.position.x -= ((box.min.x + box.max.x) / 2) * s;
    model.position.z -= ((box.min.z + box.max.z) / 2) * s;
    this.root.add(model);
    this.root.updateMatrixWorld(true);

    const find = (n: string) => {
      let r: THREE.Bone | null = null;
      model.traverse((o) => {
        if ((o as THREE.Bone).isBone && o.name === n) r = o as THREE.Bone;
      });
      return r as THREE.Bone | null;
    };
    const rootInv = new THREE.Quaternion();
    this.root.getWorldQuaternion(rootInv).invert();
    const reg = (key: string, name: string) => {
      const bone = find(name);
      if (!bone) return;
      const W = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(rootInv);
      this.b[key] = { bone, bindLocal: bone.quaternion.clone(), W, Winv: W.clone().invert() };
    };
    // The procedural rig's "L" limbs sit on the -X side, which is the model's anatomical Right.
    reg('hips', 'Hips');
    reg('torso', 'Spine02');
    reg('head', 'Head');
    reg('armL', 'RightArm');
    reg('armR', 'LeftArm');
    reg('legL', 'RightUpLeg');
    reg('legR', 'LeftUpLeg');
    reg('elL', 'RightForeArm');
    reg('elR', 'LeftForeArm');
    // elbow hinge axes: perpendicular to the bind forearm direction and "forward" (+Z)
    for (const [key, hand] of [['elL', 'RightHand'], ['elR', 'LeftHand']] as const) {
      const d = this.b[key];
      const h = find(hand);
      if (!d || !h) continue;
      const a = d.bone.getWorldPosition(new THREE.Vector3());
      const e = h.getWorldPosition(new THREE.Vector3());
      const dir = e.sub(a).normalize();
      this.hinge[key] = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, 1)).normalize();
    }
    this.headBone = this.b.head?.bone ?? find('Head')!;
    const neck = find('neck');
    if (neck) this.neckY = neck.getWorldPosition(new THREE.Vector3()).y - this.root.position.y;

    // head-only skinned mesh (face + hair) used on top of the modular outfit body
    {
      const geo = m.geometry;
      const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
      const hi = m.skeleton.bones.indexOf(this.headBone);
      const ni = neck ? m.skeleton.bones.indexOf(neck) : -1;
      const isHead = new Uint8Array(geo.attributes.position.count);
      for (let i = 0; i < isHead.length; i++) {
        let w = 0;
        for (let k = 0; k < 4; k++) { const j = si.getComponent(i, k); if (j === hi || j === ni) w += sw.getComponent(i, k); }
        isHead[i] = w > 0.5 ? 1 : 0;
      }
      const idx = geo.index!;
      const out: number[] = [];
      for (let t = 0; t < idx.count; t += 3) {
        const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
        if (isHead[a] && isHead[b] && isHead[c]) out.push(a, b, c);
      }
      const hg = new THREE.BufferGeometry();
      for (const [k, v] of Object.entries(geo.attributes)) hg.setAttribute(k, v);
      hg.setIndex(out);
      this.headMesh = new THREE.SkinnedMesh(hg, m.material);
      this.headMesh.bind(m.skeleton, m.bindMatrix);
      this.headMesh.frustumCulled = false;
      this.headMesh.castShadow = true;
      this.headMesh.visible = false;
      m.parent!.add(this.headMesh);
    }

    // measure the A-pose arm raise (angle between the arm and straight down)
    const measure = (key: 'armL' | 'armR', child: string) => {
      const d = this.b[key];
      const c = find(child);
      if (!d || !c) return 0.7;
      const a = d.bone.getWorldPosition(new THREE.Vector3());
      const e = c.getWorldPosition(new THREE.Vector3());
      const dir = e.sub(a).normalize();
      return Math.acos(Math.max(-1, Math.min(1, -dir.y)));
    };
    this.armRaise.L = measure('armL', 'RightForeArm');
    this.armRaise.R = measure('armR', 'LeftForeArm');

    // head size/centre for accessory + face anchoring
    const hb = this.headBone;
    const headBox = new THREE.Box3();
    const pos = m.geometry.attributes.position;
    const skinIdx = m.geometry.attributes.skinIndex;
    const skinW = m.geometry.attributes.skinWeight;
    const headIdx = m.skeleton.bones.indexOf(hb);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (skinIdx.getComponent(i, k) === headIdx) w += skinW.getComponent(i, k);
      if (w > 0.6) {
        m.getVertexPosition(i, v);
        m.localToWorld(v);
        headBox.expandByPoint(v);
      }
    }
    // bind-pose (geometry space) head box → face projection frame
    const gBox = new THREE.Box3();
    const gv = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (skinIdx.getComponent(i, k) === headIdx) w += skinW.getComponent(i, k);
      if (w > 0.6) gBox.expandByPoint(gv.fromBufferAttribute(pos, i));
    }
    if (!gBox.isEmpty()) this.calibrateFace(m, gBox, headIdx);
    if (!headBox.isEmpty()) {
      const c = headBox.getCenter(new THREE.Vector3());
      this.headScale = (headBox.max.x - headBox.min.x) / 1.1;
      this.headCenter.copy(hb.worldToLocal(c.clone()));
    }
  }

  /**
   * Auto-fit the expression decal to the baked face: sample the model texture per vertex,
   * find front-facing skin, then the two dark eye blobs inside it. The decal is centred
   * between the eyes and scaled to their spacing, so expressions line up on any generated model.
   */
  private calibrateFace(m: THREE.SkinnedMesh, gBox: THREE.Box3, headIdx: number) {
    const F = FACE_FIT;
    const sz = gBox.getSize(new THREE.Vector3());
    // fallback frame from the head box
    let W = sz.x * F.w, H = sz.y * F.h;
    let cx = gBox.min.x + sz.x * F.cx, cy = gBox.min.y + sz.y * F.cy;
    const geo = m.geometry;
    const pos = geo.attributes.position, nrm = geo.attributes.normal, uv = geo.attributes.uv;
    const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    const img = (m.material as THREE.MeshStandardMaterial).map?.image as CanvasImageSource | undefined;
    try {
      if (!uv || !img || !nrm) throw 0;
      const R = 512;
      const c = document.createElement('canvas');
      c.width = c.height = R;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(img, 0, 0, R, R);
      const data = g.getImageData(0, 0, R, R).data;
      const px = (i: number) => {
        const x = Math.min(R - 1, Math.max(0, Math.floor(uv.getX(i) * R)));
        const y = Math.min(R - 1, Math.max(0, Math.floor(uv.getY(i) * R)));
        const o = (y * R + x) * 4;
        return [data[o], data[o + 1], data[o + 2]];
      };
      const skin: number[] = [];
      const v = new THREE.Vector3(), n = new THREE.Vector3();
      let sr = 0, sg = 0, sb = 0, sx = 0, sminY = Infinity, smaxY = -Infinity, sminX = Infinity, smaxX = -Infinity;
      const front: number[] = [];
      for (let i = 0; i < pos.count; i++) {
        let w = 0;
        for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === headIdx) w += sw.getComponent(i, k);
        if (w < 0.6) continue;
        n.fromBufferAttribute(nrm, i).normalize();
        if (n.z < 0.55) continue;
        front.push(i);
        const [r, gg, b] = px(i);
        if (r > 175 && gg > 135 && r > b + 8 && r - gg < 70) {
          skin.push(i);
          v.fromBufferAttribute(pos, i);
          sr += r; sg += gg; sb += b; sx += v.x;
          sminY = Math.min(sminY, v.y); smaxY = Math.max(smaxY, v.y);
          sminX = Math.min(sminX, v.x); smaxX = Math.max(smaxX, v.x);
        }
      }
      if (skin.length < 30) throw 0;
      this.skinCss = `rgb(${Math.round(sr / skin.length)},${Math.round(sg / skin.length)},${Math.round(sb / skin.length)})`;
      const faceMidX = sx / skin.length;
      // dark vertices inside the skin region = eyes (+ a few fringe tips at the top)
      const midY = sminY + (smaxY - sminY) * 0.62;
      const L: THREE.Vector3[] = [], Rr: THREE.Vector3[] = [];
      for (const i of front) {
        v.fromBufferAttribute(pos, i);
        if (v.y < sminY || v.y > midY || v.x < sminX || v.x > smaxX) continue;
        const [r, gg, b] = px(i);
        if (0.299 * r + 0.587 * gg + 0.114 * b > 95) continue;
        (v.x < faceMidX ? L : Rr).push(v.clone());
      }
      if (L.length < 4 || Rr.length < 4) throw 0;
      const med = (a: number[]) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
      const lx = med(L.map((p) => p.x)), rx = med(Rr.map((p) => p.x));
      const ey = med([...L, ...Rr].map((p) => p.y));
      const half = (rx - lx) / 2;
      W = (half * 256) / MODEL_FACE.eyeGap;
      H = W / 1.68;
      const A = W / H;
      cx = (lx + rx) / 2;
      // canvas y (px, top=0) of the eye line = eyeY (square space) * A
      const fuvY = 1 - (MODEL_FACE.eyeY * A) / 256;
      cy = ey - (fuvY - 0.5) * H;
    } catch {
      /* fall back to head-box fit */
    }
    this.faceU.faceCenter.value.set(cx, cy, gBox.max.z);
    this.faceU.faceRight.value.set(1 / W, 0, 0);
    this.faceU.faceUp.value.set(0, 1 / H, 0);
    this.faceAspect = W / H;
  }

  /** Read the baked skin colour near the cheeks so the expression decal blends in. */
  private sampleSkin(m: THREE.SkinnedMesh, points: THREE.Vector3[]) {
    try {
      const pos = m.geometry.attributes.position;
      const uv = m.geometry.attributes.uv;
      const img = (m.material as THREE.MeshStandardMaterial).map?.image as CanvasImageSource & { width: number; height: number };
      if (!uv || !img) return;
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(img, 0, 0, 256, 256);
      const v = new THREE.Vector3();
      let r = 0, gg = 0, b = 0, n = 0;
      for (const p of points) {
        let best = -1, bd = Infinity;
        for (let i = 0; i < pos.count; i++) {
          const d = v.fromBufferAttribute(pos, i).distanceToSquared(p);
          if (d < bd) { bd = d; best = i; }
        }
        const px = g.getImageData(Math.floor(uv.getX(best) * 255), Math.floor(uv.getY(best) * 255), 1, 1).data;
        if (px[0] > 170 && px[1] > 130 && px[0] >= px[2]) { r += px[0]; gg += px[1]; b += px[2]; n++; }
      }
      if (n) this.skinCss = `rgb(${Math.round(r / n)},${Math.round(gg / n)},${Math.round(b / n)})`;
    } catch { /* keep default */ }
  }

  /**
   * Hamin always shows the baked Higgsfield face: painted-over eyes / mouths looked like a mask on the
   * textured model, so moods are carried by poses and reaction bubbles. Only the ?ref debug grid paints here.
   */
  setFace(e: Expression, debug = GRID) {
    const key = debug ? e : 'baked';
    if (key === this.shownExpr) return;
    this.shownExpr = key;
    if (key === 'baked') { this.faceU.faceOn.value = 0; return; }
    this.faceU.faceMap.value = this.faceTex;
    const g = this.faceCanvas.getContext('2d')!;
    g.clearRect(0, 0, 256, 256);
    const A = this.faceAspect;
    g.save();
    g.scale(1, A); // draw in square space (y: 0..256/A)
    if (!(debug && e === 'neutral')) {
      // soft skin patch hiding the baked eyes and mouth
      const cy = 98;
      g.save();
      g.translate(128, cy);
      g.scale(1, 0.56);
      const grd = g.createRadialGradient(0, 0, 70, 0, 0, 126);
      grd.addColorStop(0, this.skinCss);
      grd.addColorStop(0.86, this.skinCss);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(0, 0, 124, 0, Math.PI * 2);
      g.fill();
      g.restore();
      const tmp = document.createElement('canvas');
      tmp.width = tmp.height = 256;
      drawFace(tmp.getContext('2d')!, e, MODEL_FACE, 256);
      g.drawImage(tmp, 0, 0);
    }
    g.restore();
    if (debug) {
      g.strokeStyle = 'rgba(255,0,120,.9)';
      g.lineWidth = 2;
      for (let i = 0; i <= 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
    }
    this.faceTex.needsUpdate = true;
    this.faceU.faceOn.value = 1;
  }

  private drive(key: string, delta: THREE.Quaternion) {
    const d = this.b[key];
    if (!d) return;
    // W⁻¹ Δ W
    this.tq.copy(d.Winv).multiply(delta).multiply(d.W);
    d.bone.quaternion.copy(d.bindLocal).multiply(this.tq);
  }

  dispose() {
    this.faceTex.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.headMesh.geometry.dispose();
  }

  /** 'full' = whole generated figure; 'head' = only face+hair, lifted onto the modular body's neck. */
  setMode(mode: 'full' | 'head', bodyNeckY = this.neckY) {
    this.mode = mode;
    this.mesh.visible = mode === 'full';
    this.headMesh.visible = mode === 'head';
    this.headOffset = mode === 'head' ? bodyNeckY - this.neckY : 0;
  }

  apply(p: PoseLike, airborne: number) {
    this.root.position.set(p.bx, p.by + airborne + this.headOffset, p.bz);
    const q = this.tq.clone();
    const e = this.te;
    const qq = (x: number, y: number, z: number) => q.setFromEuler(e.set(x, y, z, 'XYZ'));
    this.drive('hips', qq(p.hx, p.hy, p.hz).clone());
    this.drive('torso', qq(p.tx, p.ty, p.tz).clone());
    this.drive('head', qq(p.kx, p.ky, p.kz).clone());
    // arms: first undo the bind A-pose raise, then apply the procedural rotation
    const armL = qq(p.alx, p.aly, -p.alz).clone().multiply(this.tz.setFromAxisAngle(Z, this.armRaise.L));
    this.drive('armL', armL);
    const armR = qq(p.arx, p.ary, p.arz).clone().multiply(this.tz.setFromAxisAngle(Z, -this.armRaise.R));
    this.drive('armR', armR);
    this.drive('legL', qq(p.llx, 0, -p.llz).clone());
    this.drive('legR', qq(p.lrx, 0, p.lrz).clone());
    if (this.hinge.elL) this.drive('elL', new THREE.Quaternion().setFromAxisAngle(this.hinge.elL, (p.elL ?? this.bindBend) - this.bindBend));
    if (this.hinge.elR) this.drive('elR', new THREE.Quaternion().setFromAxisAngle(this.hinge.elR, (p.elR ?? this.bindBend) - this.bindBend));
  }
}

const Z = new THREE.Vector3(0, 0, 1);
const GRID = typeof location !== 'undefined' && location.search.includes('grid');

/** SkeletonUtils-style clone so several Hamins can exist (reference sheet). */
function cloneSkinned(src: THREE.Object3D): THREE.Group {
  const map = new Map<THREE.Object3D, THREE.Object3D>();
  const clone = src.clone(true) as THREE.Group;
  const walk = (a: THREE.Object3D, b: THREE.Object3D) => {
    map.set(a, b);
    for (let i = 0; i < a.children.length; i++) walk(a.children[i], b.children[i]);
  };
  walk(src, clone);
  src.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh) return;
    const c = map.get(sm) as THREE.SkinnedMesh;
    const bones = sm.skeleton.bones.map((b) => map.get(b) as THREE.Bone);
    c.bind(new THREE.Skeleton(bones, sm.skeleton.boneInverses), sm.bindMatrix);
  });
  return clone;
}
