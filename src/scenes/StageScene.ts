import { tr, trf } from '../i18n/i18n';
import * as THREE from 'three';
import { critterGeometry } from '../assets/landmarks';
import { GameScene } from './GameScene';
import { P } from '../assets/palette';
import { mk, rbox, cyl, sphere, capsule, torus } from '../assets/geo';
import { room, door, sign, poster, speaker, sheepPlush, stickerPickup, floorMark } from '../assets/props';
import { toon, VINYL_ROUGHNESS } from '../assets/materials';
import { canvasTex } from '../assets/textures';
import { box as colBox, circle } from '../core/Collision';
import { POSES } from '../game/collectibles';
import { el } from '../ui/UI';
import { wait, damp, todayKey, dampK } from '../utils/math';

const V = THREE.Vector3;
const PI = Math.PI;

// ---- layout (room 14 × 10, stage along the back wall) ----
const W = 14, D = 10, H = 4.8;
const SH = 0.55; // stage height
const STAGE_X = 5.4; // stage spans |x| < STAGE_X, z < STAGE_FRONT
const STAGE_FRONT = -1.3;
const STEP_IN = 3.7; // steps on both front corners: |x| in [STEP_IN, STAGE_X]
const STEP_END = -0.1; // steps run from STAGE_FRONT down to STEP_END
const STAR = new V(0, SH, -2.7);

// ---- Higgsfield hq_stage set (measured in units of the model height, fit h = 1) ----
// deck top y .27; deck = rectangle |x| ≤ .65 for z ∈ [−.22, 0] + an elliptical apron (semi-axes .65 × .395) in front;
// curtains / backdrop / truss behind z −.22; two speakers on the deck at x ±.46, z .045; spotlight cans at
// x ±.22 / ±.38, y ≈ .83, z ≈ −.16. The model is sunk into the floor so its deck sits exactly at SH.
const HQ_H = 5.4;
const HQ_Z = -2.72; // model centre: back against the wall (z −5), apron tip at z ≈ −.59
const HQ_A = 0.65 * HQ_H; // deck half-width
const HQ_B = 0.395 * HQ_H; // apron depth (in front of HQ_Z)
const HQ_BACK = HQ_Z - 0.22 * HQ_H; // deck back edge (curtains / backdrop behind)
const HQ_SPK = { x: 0.46 * HQ_H, z: HQ_Z + 0.045 * HQ_H, r: 0.42 };
const HQ_LAMPS = [-0.38, -0.22, 0.22, 0.38].map((x) => new V(x * HQ_H, 0.83 * HQ_H, HQ_Z - 0.16 * HQ_H)); // y before sinking
const SIDE_Z0 = HQ_BACK + 0.02, SIDE_Z1 = HQ_Z + 0.07; // side stairs (both ends of the deck), 3 treads outward
const TREAD = 0.4;

const SHOW_COLS = [0xff9db3, 0xb2d9ff, 0xe6b2ff, 0xffe9a8, 0xbff0da, 0xffdcc8];
/** Deeper tints for the additive beams (pastels would just add up to white). */
const BEAM_COLS = [0xff5c8a, 0x5c9dff, 0xb070ff, 0xffb830, 0x40d6a0, 0xff8a5c];
const POSE_EMOJI: Record<string, string> = { wave: '👋', heart: '🫶', pose: '😉', victory: '✌️', shy: '☺️', happy: '🐰' };

/** Floor height under a point (stage platform + stair treads). hq = the Higgsfield stage layout. */
function heightAt(x: number, z: number, hq: boolean) {
  const ax = Math.abs(x);
  if (hq) {
    if (z <= HQ_Z) {
      if (ax <= HQ_A) return SH;
    } else {
      const u = x / HQ_A, v = (z - HQ_Z) / HQ_B;
      if (u * u + v * v <= 1) return SH;
    }
    // side stairs: top tread flush with the deck, stepping down outward
    if (ax > HQ_A && ax < HQ_A + TREAD * 3 && z >= SIDE_Z0 && z <= SIDE_Z1) return (SH * (3 - Math.floor((ax - HQ_A) / TREAD))) / 3;
    return 0;
  }
  if (ax <= STAGE_X && z <= STAGE_FRONT) return SH;
  if (ax >= STEP_IN - 0.05 && ax <= STAGE_X && z > STAGE_FRONT && z < STEP_END) {
    const t = (STEP_END - z) / (STEP_END - STAGE_FRONT);
    return (SH * (Math.min(2, Math.floor(t * 3)) + 1)) / 3;
  }
  return 0;
}

// ------------------------------------------------------------------ crowd
interface Fan { x: number; z: number; s: number; ph: number; rot: number; col: THREE.Color; stickCol: THREE.Color }
interface Part { mesh: THREE.InstancedMesh; locals: THREE.Matrix4[]; stick: boolean }

/** Audience of pastel sheep fans holding lightsticks: 7 InstancedMeshes, whatever the crowd size. */
class Crowd {
  group = new THREE.Group();
  parts: Part[] = [];
  glow!: THREE.InstancedMesh;
  hype = 0.3; // 0 = calm, 1 = concert!
  private hypeCur = 0.3;
  private m = new THREE.Matrix4();
  private m2 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private pv = new V();
  private sv = new V();
  private tmpC = new THREE.Color();
  syncColor: THREE.Color | null = null;

  /** `sheep`: the Higgsfield sitting sheep (one geometry + textured material) or null for the procedural fans. */
  constructor(public fans: Fan[], sheep: { geometry: THREE.BufferGeometry; material: THREE.Material } | null = null) {
    const n = fans.length;
    const T = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) =>
      new THREE.Matrix4().compose(new V(x, y, z), new THREE.Quaternion(), new V(sx, sy, sz));
    const wool = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: VINYL_ROUGHNESS, metalness: 0 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, locals: THREE.Matrix4[], stick = false, colored = false) => {
      const mesh = new THREE.InstancedMesh(geo, mat, n * locals.length);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (colored) for (let i = 0; i < n; i++) for (let j = 0; j < locals.length; j++) mesh.setColorAt(i * locals.length + j, fans[i].col);
      this.group.add(mesh);
      this.parts.push({ mesh, locals, stick });
      return mesh;
    };
    if (sheep) {
      // Higgsfield sitting sheep (one instanced mesh), turned to face the stage (-Z); wool tinted lightly per fan
      sheep.geometry.rotateY(PI);
      const body = add(sheep.geometry, sheep.material, [T(0, 0, 0)]);
      for (let i = 0; i < n; i++) body.setColorAt(i, this.tmpC.copy(fans[i].col).lerp(new THREE.Color(0xffffff), 0.45));
    } else {
      // body + fluffy tuft (coloured wool), face, ears, eyes (facing the stage, i.e. -Z)
      add(new THREE.SphereGeometry(0.4, 10, 8), wool, [T(0, 0.42, 0, 1, 1.02, 0.95)], false, true);
      add(new THREE.SphereGeometry(0.2, 7, 5), wool, [T(0, 0.8, 0.04), T(-0.2, 0.7, 0.12, 0.8, 0.8, 0.8), T(0.2, 0.7, 0.12, 0.8, 0.8, 0.8)], false, true);
      add(new THREE.SphereGeometry(0.2, 8, 6), toon(P.skin), [T(0, 0.5, -0.32, 1, 0.9, 0.8)]);
      add(new THREE.SphereGeometry(0.1, 5, 3), toon(P.skin), [T(-0.27, 0.6, -0.22, 1.4, 0.5, 0.7), T(0.27, 0.6, -0.22, 1.4, 0.5, 0.7)]);
      add(new THREE.SphereGeometry(0.035, 4, 3), toon(P.ink), [T(-0.075, 0.53, -0.47), T(0.075, 0.53, -0.47)]);
    }
    // lightstick (handle + glowing top), pivoting at the paw
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 5), toon(P.white), [T(0, 0.21, 0)], true);
    this.glow = add(new THREE.SphereGeometry(0.1, 7, 5), glowMat, [T(0, 0.46, 0, 1, 1.25, 1)], true);
    for (let i = 0; i < n; i++) this.glow.setColorAt(i, fans[i].stickCol);
    // only the woolly body (+ tufts) cast real shadows (face, ears, eyes, lightsticks are hidden in them: ~5k tris saved)
    for (const p of this.parts.slice(sheep ? 1 : 2)) p.mesh.userData.noShadow = true;
    this.update(0, 0);
  }

  update(dt: number, beat: number) {
    this.hypeCur += (this.hype - this.hypeCur) * dampK(2, dt);
    const h = this.hypeCur;
    const { m, m2, q, e, pv, sv } = this;
    for (let i = 0; i < this.fans.length; i++) {
      const f = this.fans[i];
      const ph = beat * PI + f.ph * (1 - h * 0.8); // the crowd syncs up when hyped
      const hop = Math.abs(Math.sin(ph)) * (0.03 + h * 0.2);
      e.set(0, f.rot + Math.sin(ph * 0.5) * 0.08 * h, Math.sin(ph * 0.5) * 0.06);
      q.setFromEuler(e);
      m.compose(pv.set(f.x, hop, f.z), q, sv.setScalar(f.s));
      const sway = Math.sin(beat * PI * 0.5 + f.ph * (1 - h)) * (0.25 + h * 0.45);
      e.set(-0.35, 0, sway);
      q.setFromEuler(e);
      m2.compose(pv.set(0.3, 0.52 + h * 0.12, -0.12), q, sv.setScalar(1));
      m2.premultiply(m);
      for (const p of this.parts) {
        const base = p.stick ? m2 : m;
        for (let j = 0; j < p.locals.length; j++) p.mesh.setMatrixAt(i * p.locals.length + j, this.tmpM.multiplyMatrices(base, p.locals[j]));
      }
    }
    for (const p of this.parts) p.mesh.instanceMatrix.needsUpdate = true;
    // lightstick colours: own pastel when calm, one synced colour wave during the show
    if (this.syncColor || this.wasSynced) {
      for (let i = 0; i < this.fans.length; i++) {
        if (this.syncColor) this.tmpC.copy(this.syncColor).lerp(this.fans[i].stickCol, 0.15);
        else this.tmpC.copy(this.fans[i].stickCol);
        this.glow.setColorAt(i, this.tmpC);
      }
      if (this.glow.instanceColor) this.glow.instanceColor.needsUpdate = true;
      this.wasSynced = !!this.syncColor;
    }
  }
  private tmpM = new THREE.Matrix4();
  private wasSynced = false;
}

// ------------------------------------------------------------------ light beams
interface Beam { mesh: THREE.Mesh; pool: THREE.Mesh; from: THREE.Vector3; base: THREE.Vector3; target: THREE.Vector3; col: THREE.Color; idle: THREE.Color; mat: THREE.MeshBasicMaterial; poolMat: THREE.MeshBasicMaterial }

function beamTex() {
  return canvasTex(8, 64, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 64);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.45, '#5a5a5a');
    grd.addColorStop(1, '#141414');
    g.fillStyle = grd;
    g.fillRect(0, 0, 8, 64);
  });
}
function poolTex() {
  return canvasTex(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.55, '#8a8a8a');
    grd.addColorStop(1, '#000000');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  });
}

/** Stage Hall: pastel concert stage, sheep audience, mini show + photo moment. */
export default class StageScene extends GameScene {
  readonly id = 'stage' as const;
  readonly title = 'Stage Hall';
  subtitle = 'Lights, lightsticks, Hamin ♡';
  music = 'stage' as const;
  ambience = 'crowd';
  private crowd!: Crowd;
  private beams: Beam[] = [];
  private mark!: THREE.Group;
  private showing = false;
  private phase: 'none' | 'intro' | 'dance' | 'sing' | 'finale' | 'photo' = 'none';
  private showT = 0;
  private fxT = 0;
  private hemiCol = new THREE.Color();
  private hemiBase = new THREE.Color();
  private sunBase = 2.1;
  /** true once the Higgsfield stage set is in (else the procedural stage) */
  private hq = false;
  /** floor decals (star mark, light pools) sit this much higher on the sculpted deck */
  private deckLift = 0;
  private lampFrom: THREE.Vector3[] = [];
  private backstagePos = new V(-3.55, SH, -4.3);

  async build() {
    const loads: Promise<unknown>[] = [];
    this.skyArt('sky_title');
    this.light({ dir: [-4, 10, 7], shadowRange: 9, hemi: 1.05 });
    this.hemiBase.copy(this.lights.hemi.color);
    this.sunBase = this.lights.sun.intensity;
    this.bounds = { minX: -W / 2 + 0.2, maxX: W / 2 - 0.2, minZ: -D / 2 + 0.35, maxZ: D / 2 + 0.1 };
    this.cam = { dist: 16.5, pitch: 0.62, lookY: 1.3, yawRange: 0.6, clamp: { minX: -2, maxX: 2, minZ: -1.6, maxZ: 1.4 } };
    const s = this.statics;
    s.add(room({ w: W, d: D, h: H, floor: P.pinkSoft, wall: P.lavender, slab: P.lavenderDeep }));

    // ---------------- stage: Higgsfield hq_stage set (procedural stage as the fallback) ----------------
    loads.push(this.prop('hq_stage', 0, HQ_Z, { h: HQ_H }, 0, false).then((m) => {
      if (m) this.setupHqStage(m);
      else this.buildProceduralStage();
    }));
    const bulbCols = [P.butter, P.pink, P.blue, P.mint, P.purple];
    // fairy-light garland across the back wall
    for (let i = 0; i < 15; i++) {
      const x = -STAGE_X + 0.3 + i * ((STAGE_X * 2 - 0.6) / 14);
      const y = H - 0.9 - Math.sin((i / 14) * PI) * 0.45;
      s.add(mk(sphere(0.07, 5, 3), toon(bulbCols[i % 5], { emissive: 0x665566 }), [x, y, -D / 2 + 0.08]));
    }
    // speakers (floor wings)
    for (const sx of [-1, 1]) {
      const sp = speaker(P.lavender, 1.1);
      sp.position.set(sx * 6.25, 0, -3.3);
      sp.rotation.y = -sx * 0.25;
      this.add(sp, 0.55);
      s.add(mk(sphere(0.2, 8, 6), P.pink, [sx * 6.25, 1.42, -3.3]));
    }
    // hall decorations: welcome sign, fan zone sign, sheep cushion
    const hs = sign('🌟 Stage Hall · Sweet Reply High', 3.6, 0.6, { bg: '#FFFFFF', border: '#E6B2FF' });
    hs.position.set(-W / 2 + 0.02, 3.2, 1.6);
    hs.rotation.y = PI / 2;
    this.scene.add(hs);
    const fz = sign('♡ Fan Zone ♡ lightsticks up!', 2.6, 0.5, { bg: '#FFFFFF', border: '#FF9DB3' });
    fz.position.set(W / 2 - 0.02, 3.3, 1.2);
    fz.rotation.y = -PI / 2;
    this.scene.add(fz);
    // exit door
    const ex = door(P.pinkDeep, 'Schoolyard ▸');
    ex.position.set(W / 2 + 0.05, 0, 2.9);
    ex.rotation.y = -PI / 2;
    this.add(ex);
    this.door('yard', 'stage', new V(W / 2 - 0.6, 0, 2.9), 'Back to the Schoolyard', 1.4);

    await Promise.all(loads);

    // ---------------- light beams (fake, additive) ----------------
    const bt = beamTex();
    const pt = poolTex();
    const beamGeo = new THREE.CylinderGeometry(0.1, 0.62, 1, 16, 1, true);
    beamGeo.translate(0, -0.5, 0);
    const poolGeo = new THREE.CircleGeometry(0.85, 24);
    const idleCols = [0xff7aa2, 0xb98cff, 0x7ab0ff, 0xffc861];
    const idleTargets = [new V(-2.4, SH, -3.4), new V(-0.6, SH, -2.8), new V(0.6, SH, -2.8), new V(2.4, SH, -3.4)];
    this.lampFrom.forEach((from, i) => {
      const col = new THREE.Color(idleCols[i]);
      const mat = new THREE.MeshBasicMaterial({ map: bt, color: col, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(beamGeo, mat);
      mesh.position.copy(from);
      mesh.userData.noShadow = true;
      mesh.renderOrder = 3;
      this.addDynamic(mesh);
      const poolMat = new THREE.MeshBasicMaterial({ map: pt, color: col, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
      const pool = new THREE.Mesh(poolGeo, poolMat);
      pool.rotation.x = -PI / 2;
      pool.userData.noShadow = true;
      pool.renderOrder = 2;
      this.addDynamic(pool);
      const b: Beam = { mesh, pool, from, base: idleTargets[i], target: idleTargets[i].clone(), col, idle: col.clone(), mat, poolMat };
      this.beams.push(b);
      this.aimBeam(b);
    });

    // ---------------- audience ----------------
    const fans: Fan[] = [];
    const wools = [0xffffff, 0xffffff, 0xfff6fa, P.pink, P.blueSoft, P.lavender, P.butter, P.mint, P.peach];
    const sticks = [P.pinkDeep, P.blueDeep, P.purple, P.butterDeep, P.mintDeep, P.strawberry];
    let k = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r === 2 && c === 0) || (r === 1 && c === 7)) continue;
        const x = -5.05 + c * 1.02 + (r % 2) * 0.5 + (Math.sin(k * 12.9) * 0.12);
        const z = 1.75 + r * 0.95 + Math.cos(k * 7.1) * 0.1;
        fans.push({
          x, z, s: 0.95 + ((k * 37) % 7) * 0.035 - r * 0.02, ph: k * 1.37, rot: Math.atan2(x, z - STAR.z) * 0.6,
          col: new THREE.Color(wools[(k * 5) % wools.length]), stickCol: new THREE.Color(sticks[(k * 7) % sticks.length]),
        });
        k++;
      }
    }
    const sheep = await critterGeometry('sheep_sit_lo', { h: 1.0 }).catch((e) => { console.warn('crowd sheep model failed', e); return null; });
    this.crowd = new Crowd(fans, sheep);
    this.addDynamic(this.crowd.group);
    this.colliders.push(colBox(-1.3, 2.75, 8.9, 3.05));
    const rail = new THREE.Group();
    for (let x = -5.6; x <= 3.0; x += 0.86) rail.add(mk(cyl(0.04, 0.04, 0.6, 6), P.white, [x, 0.3, 1.2]));
    rail.add(mk(rbox(8.7, 0.08, 0.08, 0.03, 1), P.pinkDeep, [-1.3, 0.62, 1.2]));
    this.add(rail);

    // ---------------- star mark ----------------
    this.mark = floorMark(P.pinkDeep, 0.85, '🌟');
    this.mark.position.set(STAR.x, SH - 0.1 + this.deckLift, STAR.z);
    this.addDynamic(this.mark);

    // ---------------- spawns & NPCs ----------------
    this.spawns = {
      default: { x: W / 2 - 1.3, z: 2.9, rot: -PI / 2 },
      map: { x: W / 2 - 1.3, z: 2.9, rot: -PI / 2 },
    };
    this.spawnNpcs({ piyo: [-2.7, 0.35, 0.35], coco: [3.55, 1.45, 2.5] });

    // ---------------- interactions ----------------
    const game = this.game;
    this.interact({
      id: 'show', pos: STAR, radius: 1.2, label: '🌟 Perform a show', height: 2.6,
      enabled: () => !this.showing,
      onInteract: () => this.performShow(),
    });
    this.interact({
      id: 'backstage', pos: this.backstagePos, radius: 1.1, label: '🚪 Peek backstage', height: 2.9,
      onInteract: async () => {
        game.player.play('interact');
        await game.ui.dialogue('Hamin', [
          'A little sign says “Staff only ♡”…',
          'Through the gap: a mirror covered in sticky notes — “Fighting, Hamin!” “You’re doing great!” 🥹',
          'Hehe… later! The audience is waiting ✨',
        ], { portrait: '💙' });
        if (!game.save.flag('peekBackstage', false)) {
          game.save.setFlag('peekBackstage', true);
          game.addHearts(3, game.player.root.position);
        }
      },
    });
    // collectibles
    const st = stickerPickup('🌟');
    st.position.set(-6.25, 1.15, -1.9);
    this.collectible('sticker', 'stk_stage', st, 'Star sticker', '🌟');
    const pl = sheepPlush(1);
    // peeking out beside the right curtain (Higgsfield stage) / behind the procedural curtain
    if (this.hq) pl.position.set(HQ_A - 0.3, SH + 0.03, HQ_BACK + 0.25);
    else pl.position.set(4.95, SH + 0.02, -3.05);
    pl.rotation.y = -0.6;
    this.collectible('plush', 'plush_stage', pl, 'a sheep plushie hiding behind the curtain', '🐑');

    // ---------------- per-frame ----------------
    this.onUpdate((dt, t) => {
      // walk up and down the stage steps
      const r = game.player.root.position;
      const h = heightAt(r.x, r.z, this.hq);
      r.y = Math.abs(h - r.y) < 0.003 ? h : damp(r.y, h, 16, dt);
      const beat = game.audio.beat() || t * 1.9;
      this.crowd.update(dt, beat);
      this.mark.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
      this.mark.visible = !this.showing || this.phase === 'intro';
      this.updateLights(dt, t, beat);
      if (this.showing) this.updateShow(dt, beat);
    });
  }

  /** Higgsfield stage set: deck at SH, colliders + side stairs matching its outline, lights from its truss cans. */
  private setupHqStage(m: THREE.Group) {
    this.hq = true;
    this.deckLift = 0.03; // the sculpted deck is not perfectly flat: lift the floor decals a hair
    // triangle budget (~120k incl. Hamin + shadow pass): the 15k-tri set keeps receiving shadows (Hamin on the deck)
    // but skips the shadow pass; its generated texture already carries soft baked shading
    m.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      o.castShadow = false;
      o.userData.noShadow = true;
    });
    // sink the model so its deck top (raycast down at a few open spots) sits exactly where Hamin stands
    m.updateMatrixWorld(true);
    const rc = new THREE.Raycaster();
    const ys: number[] = [];
    for (const [x, z] of [[0, HQ_Z - 0.5], [-1.2, HQ_Z - 0.3], [1.2, HQ_Z - 0.3], [0, HQ_Z + 1], [-1.4, HQ_Z + 0.8], [1.4, HQ_Z + 0.8]]) {
      rc.set(new V(x, 20, z), new V(0, -1, 0));
      const hit = rc.intersectObject(m, true)[0];
      if (hit) ys.push(hit.point.y);
    }
    ys.sort((a, b) => a - b);
    const deckY = ys.length ? ys[ys.length >> 1] : 0.27 * HQ_H;
    m.position.y = SH - deckY;
    this.lampFrom = HQ_LAMPS.map((l) => l.clone().setY(l.y + m.position.y));
    const s = this.statics;

    // colliders: backdrop/curtains, the two deck speakers, the apron edge (chain of small circles) and stair rails
    this.colliders.push(colBox(0, (HQ_BACK - D / 2) / 2 - 0.03, HQ_A * 2 + 0.5, HQ_BACK + D / 2 - 0.06));
    for (const sx of [-1, 1]) this.colliders.push(circle(sx * HQ_SPK.x, HQ_SPK.z, HQ_SPK.r));
    const t0 = Math.asin(Math.min(1, (SIDE_Z1 - HQ_Z) / HQ_B));
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const t = t0 + ((PI - 2 * t0) * i) / n;
      this.colliders.push(circle(Math.cos(t) * HQ_A, HQ_Z + Math.sin(t) * HQ_B, 0.12));
    }

    // side stairs (3 treads stepping down outward) + little rails, at both ends of the deck
    const sw = SIDE_Z1 - SIDE_Z0, sz = (SIDE_Z0 + SIDE_Z1) / 2;
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const h = (SH * (3 - i)) / 3;
        s.add(mk(rbox(TREAD, h, sw, 0.05, 1), i % 2 ? P.pinkSoft : P.white, [sx * (HQ_A + TREAD / 2 + i * TREAD), h / 2, sz]));
      }
      const x0 = sx * (HQ_A + 0.06), x1 = sx * (HQ_A + TREAD * 3 - 0.06);
      const len = Math.hypot(x1 - x0, SH);
      for (const rz of [SIDE_Z0 - 0.05, SIDE_Z1 + 0.05]) {
        s.add(mk(cyl(0.05, 0.05, 1.0, 8), P.white, [x1, 0.5, rz]));
        s.add(mk(cyl(0.05, 0.05, 1.0, 8), P.white, [x0, SH + 0.5, rz]));
        s.add(mk(sphere(0.09, 6, 4), P.pinkDeep, [x1, 1.02, rz]));
        s.add(mk(sphere(0.09, 6, 4), P.pinkDeep, [x0, SH + 1.02, rz]));
        s.add(mk(cyl(0.045, 0.045, len, 6), P.pinkDeep, [(x0 + x1) / 2, 1.0 + SH / 2, rz], [0, 0, Math.atan2(x1 - x0, SH)]));
        this.colliders.push(colBox((x0 + x1) / 2, rz, TREAD * 3, 0.12));
      }
    }

    // backstage door on the back wall beside the set; the show poster moves to the other side
    const bd = door(P.purple, 'Backstage ♡', { border: '#E6B2FF' });
    bd.position.set(-5.05, 0, -D / 2 + 0.06);
    this.add(bd);
    this.backstagePos.set(-5.05, 0, -4.3);
    const backdrop = poster(2.6, 1.16, drawBackdrop, 512);
    backdrop.position.set(5.3, 2.75, -D / 2 + 0.07);
    this.scene.add(backdrop);
    s.add(mk(rbox(2.8, 1.36, 0.08, 0.06, 1), P.white, [5.3, 2.75, -D / 2 + 0.0]));
  }

  /** Fallback when the model can't load: the original procedural cake stage. */
  private buildProceduralStage() {
    const s = this.statics;
    const depth = STAGE_FRONT + D / 2;
    s.add(mk(rbox(STAGE_X * 2, SH, depth, 0.1), P.purple, [0, SH / 2, -D / 2 + depth / 2]));
    s.add(mk(rbox(STAGE_X * 2 - 0.1, 0.06, depth - 0.08, 0.03, 1), P.cream, [0, SH - 0.02, -D / 2 + depth / 2]));
    s.add(mk(rbox(STAGE_X * 2 - 0.3, 0.02, 0.1, 0.01, 1), P.pinkDeep, [0, SH + 0.01, STAGE_FRONT - 0.18]));
    // frosting trim along the stage lip (cake stage!)
    for (let x = -STEP_IN + 0.2; x <= STEP_IN - 0.2 + 1e-6; x += 0.46) s.add(mk(sphere(0.13, 6, 4), P.white, [x, SH - 0.02, STAGE_FRONT + 0.02]));
    for (let x = -STEP_IN + 0.43; x < STEP_IN - 0.2; x += 0.92) s.add(mk(sphere(0.07, 6, 4), toon(P.strawberry, { emissive: 0x551122 }), [x, SH * 0.45, STAGE_FRONT + 0.02]));
    // steps + rails on both front corners
    for (const sx of [-1, 1]) {
      const cx = (sx * (STEP_IN + STAGE_X)) / 2;
      for (let i = 0; i < 3; i++) {
        const h = (SH * (i + 1)) / 3;
        s.add(mk(rbox(STAGE_X - STEP_IN, h, 0.4, 0.05, 1), i % 2 ? P.pinkSoft : P.white, [cx, h / 2, STEP_END - 0.2 - i * 0.4]));
      }
      for (const rx of [sx * (STEP_IN - 0.08), sx * (STAGE_X + 0.08)]) {
        s.add(mk(cyl(0.05, 0.05, 1.0, 8), P.white, [rx, 0.5, STEP_END]));
        s.add(mk(cyl(0.05, 0.05, 1.0, 8), P.white, [rx, SH + 0.5, STAGE_FRONT]));
        s.add(mk(sphere(0.09, 6, 4), P.pinkDeep, [rx, 1.02, STEP_END]));
        s.add(mk(sphere(0.09, 6, 4), P.pinkDeep, [rx, SH + 1.02, STAGE_FRONT]));
        const len = Math.hypot(STEP_END - STAGE_FRONT, SH);
        s.add(mk(cyl(0.045, 0.045, len, 6), P.pinkDeep, [rx, 1.0 + SH / 2, (STEP_END + STAGE_FRONT) / 2], [PI / 2 - Math.atan2(SH, STEP_END - STAGE_FRONT), 0, 0]));
      }
      this.colliders.push(colBox(sx * (STEP_IN - 0.08), (STEP_END + STAGE_FRONT) / 2, 0.16, STEP_END - STAGE_FRONT + 0.1));
      this.colliders.push(colBox(sx * (STAGE_X + 0.1), (-D / 2 + STEP_END) / 2, 0.24, STEP_END + D / 2 + 0.1));
    }
    this.colliders.push(colBox(0, STAGE_FRONT, STEP_IN * 2 - 0.1, 0.3));

    // ---------------- curtains, valance, truss ----------------
    const curtainZ = -2.05;
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const x = sx * (STAGE_X - 0.15 - i * 0.2);
        s.add(mk(capsule(0.17, H - SH - 0.7, 2, 8), i % 2 ? P.pink : P.pinkDeep, [x, SH + (H - SH) / 2 - 0.05, curtainZ + (i % 2) * 0.08], [0, 0, sx * i * 0.025]));
      }
      s.add(mk(torus(0.42, 0.07, 6, 14), P.butterDeep, [sx * (STAGE_X - 0.45), SH + 1.35, curtainZ], [PI / 2, 0, 0], [1, 1, 0.6]));
      s.add(mk(sphere(0.12, 8, 6), P.butter, [sx * (STAGE_X - 0.95), SH + 1.3, curtainZ + 0.18]));
      s.add(mk(cyl(0.02, 0.06, 0.3, 6), P.butter, [sx * (STAGE_X - 0.95), SH + 1.1, curtainZ + 0.18]));
      this.colliders.push(colBox(sx * (STAGE_X - 0.4), curtainZ, 0.9, 0.5));
    }
    // valance with scallops + fairy lights
    s.add(mk(rbox(STAGE_X * 2 + 0.6, 0.6, 0.35, 0.12), P.strawberry, [0, H - 0.25, -1.75]));
    for (let x = -STAGE_X; x <= STAGE_X + 1e-6; x += 0.675) s.add(mk(cyl(0.34, 0.34, 0.12, 10), P.pink, [x, H - 0.55, -1.6], [PI / 2, 0, 0]));
    const bulbCols = [P.butter, P.pink, P.blue, P.mint, P.purple];
    for (let i = 0, x = -STAGE_X + 0.3; x < STAGE_X; x += 0.7, i++) s.add(mk(sphere(0.07, 5, 3), toon(bulbCols[i % 5], { emissive: 0x554455 }), [x, H - 0.2, -1.55]));
    // light truss with lamp cans
    s.add(mk(cyl(0.07, 0.07, STAGE_X * 2, 8), P.white, [0, H - 0.75, -1.35], [0, 0, PI / 2]));
    const lampXs = [-3.7, -1.25, 1.25, 3.7];
    this.lampFrom = [];
    for (const x of lampXs) {
      s.add(mk(cyl(0.16, 0.2, 0.36, 10), P.lavenderDeep, [x, H - 1.02, -1.45], [-0.5, 0, 0]));
      s.add(mk(cyl(0.15, 0.15, 0.03, 10), toon(0xffffff, { emissive: 0xaaa088 }), [x, H - 1.18, -1.54], [-0.5, 0, 0]));
      this.lampFrom.push(new V(x, H - 1.2, -1.56));
    }
    // backdrop
    const backdrop = poster(5.6, 2.5, drawBackdrop, 512);
    backdrop.position.set(0.7, SH + 1.9, -D / 2 + 0.07);
    this.scene.add(backdrop);
    s.add(mk(rbox(5.85, 2.75, 0.08, 0.06, 1), P.white, [0.7, SH + 1.9, -D / 2 + 0.0]));
    // backstage door
    const bd = door(P.purple, 'Backstage ♡', { border: '#E6B2FF' });
    bd.position.set(-3.55, SH, -D / 2 + 0.06);
    this.add(bd);
    for (const sx of [-1, 1]) s.add(mk(rbox(0.8, 0.3, 0.5, 0.08, 1), P.lavenderDeep, [sx * 2.2, SH + 0.15, -1.85], [-0.4, 0, 0]));
    this.colliders.push(colBox(-2.2, -1.85, 0.9, 0.5), colBox(2.2, -1.85, 0.9, 0.5));
    this.backstagePos.set(-3.55, SH, -4.3);
  }

  onExit() {
    this.game.cam.override = null;
  }

  // ------------------------------------------------------------------ lights
  private aimBeam(b: Beam) {
    const dir = b.target.clone().sub(b.from);
    const len = dir.length();
    b.mesh.quaternion.setFromUnitVectors(new V(0, -1, 0), dir.normalize());
    b.mesh.scale.set(1 + len * 0.08, len, 1 + len * 0.08);
    b.pool.position.set(b.target.x, SH + 0.02 + this.deckLift, b.target.z);
  }

  private updateLights(dt: number, t: number, beat: number) {
    const show = this.showing && this.phase !== 'photo';
    const k = dampK(show ? 6 : 2, dt);
    this.beams.forEach((b, i) => {
      if (show) {
        const sw = this.phase === 'sing' ? 0.4 : 1;
        b.target.set(b.base.x * 0.6 + Math.sin(t * 1.3 + i * 1.7) * 1.8 * sw, SH, -3 + Math.cos(t * 0.9 + i) * 0.9 * sw);
        const c = BEAM_COLS[(Math.floor(beat / 2) + i * 2) % BEAM_COLS.length];
        this.hemiCol.setHex(c);
        b.col.lerp(this.hemiCol, k);
        b.mat.opacity = 0.2 + Math.pow(1 - (beat % 1), 3) * 0.14;
      } else {
        b.target.lerp(new V(b.base.x + Math.sin(t * 0.4 + i) * 0.35, SH, b.base.z + Math.cos(t * 0.3 + i) * 0.25), k);
        b.col.lerp(b.idle, k);
        b.mat.opacity += (0.16 - b.mat.opacity) * k;
      }
      b.mat.color.copy(b.col);
      b.poolMat.color.copy(b.col);
      this.aimBeam(b);
    });
    // soft concert mood: tint the (existing) hemisphere light and dim the sun a bit during the show
    const hemi = this.lights.hemi;
    if (show) {
      this.hemiCol.setHex(SHOW_COLS[Math.floor(beat / 4) % SHOW_COLS.length]).lerp(this.hemiBase, 0.55);
      hemi.color.lerp(this.hemiCol, dampK(3, dt));
      this.lights.sun.intensity = damp(this.lights.sun.intensity, this.sunBase * 0.62, 3, dt);
      this.crowd.syncColor = this.syncCol.setHex(SHOW_COLS[Math.floor(beat) % SHOW_COLS.length]);
    } else {
      hemi.color.lerp(this.hemiBase, dampK(2, dt));
      this.lights.sun.intensity = damp(this.lights.sun.intensity, this.sunBase, 2, dt);
      this.crowd.syncColor = null;
    }
  }
  private syncCol = new THREE.Color();

  // ------------------------------------------------------------------ the show
  private updateShow(dt: number, beat: number) {
    this.showT += dt;
    this.fxT -= dt;
    const g = this.game;
    const hp = g.player.root.position;
    if (this.phase === 'dance') {
      // slow sweeping camera arc over the crowd
      const a = -0.85 + Math.min(1, this.showT / 4.8) * 1.7;
      const ov = g.cam.override;
      if (ov) {
        ov.pos.set(Math.sin(a) * 9.6, 2.7 + Math.sin(this.showT * 1.3) * 0.35, STAR.z + Math.cos(a) * 9.6);
        ov.look.set(0, SH + 1.25, STAR.z);
      }
    }
    if (this.fxT <= 0 && this.phase !== 'photo') {
      this.fxT = 0.35;
      const f = this.crowd.fans[Math.floor(Math.random() * this.crowd.fans.length)];
      g.fx.floatUp(new V(f.x, 1.5, f.z), 'hearts');
      if (this.phase === 'sing') g.fx.burst(hp.clone().setY(hp.y + 2.2), 'notes', 2, 0.6);
      else if (this.phase === 'dance' && Math.random() < 0.5) g.fx.burst(hp.clone().setY(hp.y + 1.6), 'hearts', 2, 0.8);
    }
    void beat;
  }

  private async performShow() {
    const g = this.game;
    const p = g.player;
    const ui = g.ui;
    const coco = this.npcs.find((n) => n.def.id === 'coco');
    this.showing = true;
    this.showT = 0;
    this.phase = 'intro';
    ui.setHud(false);
    try {
      p.root.position.set(STAR.x, SH, STAR.z);
      g.setFacing(0);
      p.danceBpm = g.audio.bpm || 112;
      g.cam.override = { pos: new V(0, 2.5, 6.4), look: new V(0, SH + 1.3, STAR.z), k: 2.2, fov: 36 };
      ui.banner('✨ Hamin Mini Show ✨', 'Lightsticks up, everyone! ♡');
      g.audio.sfx('cheer');
      this.crowd.hype = 1;
      coco?.react('hop');
      p.play('wave');
      await wait(1600);

      this.phase = 'dance';
      this.showT = 0;
      p.play('dance', { loop: true });
      g.cam.override = { pos: new V(-7, 2.7, 3.8), look: new V(0, SH + 1.25, STAR.z), k: 1.8, fov: 38 };
      g.audio.sfx('cheer', 0.6);
      await wait(2400);
      coco?.react('hop');
      g.fx.burst(p.root.position.clone().setY(SH + 1.8), 'sparkles', 10, 1.5);
      await wait(2400);

      this.phase = 'sing';
      p.play('sing', { loop: true });
      g.cam.override = { pos: new V(1.9, SH + 2.0, 1.9), look: new V(0, SH + 1.45, STAR.z), k: 1.6, fov: 36 };
      ui.react(p.root.position.clone().setY(SH + 2.8), '♪ la la la~ ♪');
      await wait(3600);

      this.phase = 'finale';
      p.play('victory');
      g.audio.sfx('cheer');
      g.audio.sfx('success');
      g.fx.burst(p.root.position.clone().setY(SH + 2.2), 'confetti', 26, 2.2);
      g.fx.burst(p.root.position.clone().setY(SH + 1.5), 'hearts', 10, 1.5);
      coco?.react('hop');
      this.npcs.find((n) => n.def.id === 'piyo')?.react('hop');
      // reverse shot from behind Hamin: the lightstick ocean (tucked under the Higgsfield set's lighting truss)
      const rev = this.hq ? new V(-1.8, SH + 2.45, STAR.z - 1.2) : new V(-2.6, SH + 3.0, STAR.z - 1.7);
      g.cam.override = { pos: rev, look: new V(0.6, 0.8, 2.6), k: 2.4, fov: 42 };
      await wait(2200);

      // ---- photo moment ----
      this.phase = 'photo';
      this.crowd.hype = 0.5;
      p.stop();
      g.cam.override = { pos: new V(0.35, SH + 1.9, 2.9), look: new V(0, SH + 1.2, STAR.z), k: 3, fov: 38 };
      const pose = await this.choosePose();
      p.play(pose.anim, { loop: true });
      await wait(1000);
      await g.photo('Stage');
      p.stop();

      // ---- rewards ----
      const d = g.save.data;
      const firstShow = !g.save.flag('stageShow', false);
      g.save.setFlag('stageShow', true);
      const today = todayKey();
      if (g.save.flag('stageShowDay', '') !== today) {
        g.save.setFlag('stageShowDay', today);
        g.addHearts(8, p.root.position);
        ui.toast('🌟', 'What a show! +8 ♡');
      } else ui.toast('🌟', 'Encore! (Show hearts are once a day ♡)');
      const next = POSES.find((ps) => !d.poses.includes(ps.id));
      if (next) {
        d.poses.push(next.id);
        g.save.save();
        await wait(700);
        g.audio.sfx('unlock');
        ui.toast(POSE_EMOJI[next.id] ?? '📸', `✨ NEW pose! “${next.name}” for your photos`);
      }
      if (firstShow || !d.charms.includes('charm_stage')) {
        await wait(700);
        g.collect('charm', 'charm_stage', p.root.position.clone().setY(SH + 1.4), 'Stage Star charm', '⭐');
      }
      await wait(400);
    } finally {
      this.phase = 'none';
      this.crowd.hype = 0.3;
      this.showing = false;
      g.cam.override = null;
      if (g.currentId === 'stage') ui.setHud(true);
    }
  }

  /** Candy-button pose picker (unlocked poses only). */
  private choosePose(): Promise<(typeof POSES)[number]> {
    const g = this.game;
    return new Promise((res) => {
      const L = g.ui.layer('stage-pose');
      const card = el('div', 'paper');
      card.style.cssText = 'position:absolute;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%);padding:12px 14px 14px;border-radius:22px;text-align:center;width:max-content;max-width:calc(100cqw - 24px)';
      card.innerHTML = '<div style="font-weight:900;font-size:17px;margin-bottom:10px">📸 Photo time! Pick a pose ♡</div>';
      const row = el('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center';
      const owned = POSES.filter((ps) => g.save.data.poses.includes(ps.id));
      const list = owned.length ? owned : [POSES[0]];
      let done = false;
      const choose = (ps: (typeof POSES)[number]) => {
        if (done) return;
        done = true;
        g.audio.sfx('select');
        window.removeEventListener('keydown', key, true);
        L.remove();
        res(ps);
      };
      const key = (e: KeyboardEvent) => {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= list.length) { e.preventDefault(); choose(list[n - 1]); }
        else if (['Enter', 'Space', 'KeyE'].includes(e.code)) { e.preventDefault(); choose(list[0]); }
      };
      list.forEach((ps, i) => {
        const b = el('button', i === 0 ? 'candy primary small' : 'candy small', `${POSE_EMOJI[ps.id] ?? '✨'} ${ps.name}`);
        b.onclick = (e) => { e.stopPropagation(); choose(ps); };
        row.appendChild(b);
      });
      const locked = POSES.length - owned.length;
      if (locked > 0) {
        const hint = el('div', '', locked > 1 ? trf('🔒 {0} more poses to unlock with shows', locked) : tr('🔒 1 more pose to unlock with shows'));
        hint.style.cssText = 'font-size:12px;opacity:.65;margin-top:8px';
        card.append(row, hint);
      } else card.append(row);
      L.appendChild(card);
      window.addEventListener('keydown', key, true);
    });
  }
}

function drawBackdrop(g: CanvasRenderingContext2D, w: number, h: number) {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#c7b4ff');
  grd.addColorStop(0.6, '#f3c3ec');
  grd.addColorStop(1, '#ffd9e6');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  // twinkles
  g.fillStyle = 'rgba(255,255,255,.9)';
  for (let i = 0; i < 40; i++) {
    const x = (i * 97) % w, y = (i * 53) % (h * 0.8);
    const r = 1.5 + (i % 3);
    g.beginPath(); g.arc(x, y, r, 0, PI * 2); g.fill();
  }
  // big crescent moon with a sleepy sheep
  g.fillStyle = '#fff6d6';
  g.beginPath(); g.arc(w * 0.83, h * 0.36, 58, 0, PI * 2); g.fill();
  g.fillStyle = '#e9c9f3';
  g.beginPath(); g.arc(w * 0.83 + 26, h * 0.36 - 16, 50, 0, PI * 2); g.fill();
  const sx = w * 0.14, sy = h * 0.62;
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; g.beginPath(); g.arc(sx + Math.cos(a) * 26, sy + Math.sin(a) * 16, 17, 0, PI * 2); g.fill(); }
  g.beginPath(); g.arc(sx, sy, 26, 0, PI * 2); g.fill();
  g.fillStyle = '#ffe7da';
  g.beginPath(); g.ellipse(sx + 34, sy - 4, 16, 14, 0, 0, PI * 2); g.fill();
  g.fillStyle = '#364049';
  g.beginPath(); g.arc(sx + 30, sy - 6, 2.4, 0, PI * 2); g.arc(sx + 40, sy - 6, 2.4, 0, PI * 2); g.fill();
  // stars
  const star = (x: number, y: number, r: number, c: string) => {
    g.fillStyle = c;
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -PI / 2 + (i * PI) / 5; const rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  };
  star(w * 0.3, h * 0.2, 16, '#fff3b0'); star(w * 0.68, h * 0.14, 12, '#ffffff'); star(w * 0.55, h * 0.82, 10, '#fff3b0'); star(w * 0.93, h * 0.8, 14, '#ffffff');
  // title
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 56px Nunito, sans-serif';
  g.lineWidth = 12;
  g.strokeStyle = '#ff9db3';
  g.lineJoin = 'round';
  g.strokeText('Hamin ♡ Mini Show', w / 2, h * 0.42);
  g.fillStyle = '#ffffff';
  g.fillText('Hamin ♡ Mini Show', w / 2, h * 0.42);
  g.font = '800 24px Nunito, sans-serif';
  g.fillStyle = '#8a6fd1';
  g.fillText('✨ tonight only · lightsticks up! ✨', w / 2, h * 0.64);
}

