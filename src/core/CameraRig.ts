import * as THREE from 'three';
import { clamp, damp, dampK } from '../utils/math';

export interface CamConfig {
  dist: number; // distance from target
  pitch: number; // radians above horizon
  yaw: number; // base yaw (0 = camera on +Z looking toward -Z)
  yawRange: number; // allowed swipe rotation either side
  fov: number;
  lookY: number; // look-at height above target
  follow: number; // follow stiffness
  clamp?: { minX: number; maxX: number; minZ: number; maxZ: number }; // target clamp
}

export const DEFAULT_CAM: CamConfig = { dist: 12, pitch: 0.62, yaw: 0, yawRange: 0.7, fov: 35, lookY: 1.0, follow: 5 };

/** Miniature-diorama follow camera: elevated, gently angled, limited swipe rotation. */
export class CameraRig {
  cfg: CamConfig = { ...DEFAULT_CAM };
  target = new THREE.Vector3();
  private focus = new THREE.Vector3();
  yawOffset = 0;
  private yawCur = 0;
  /** Cutscene override: camera eases to this pose while set. */
  override: { pos: THREE.Vector3; look: THREE.Vector3; fov?: number; k?: number } | null = null;
  private lookCur = new THREE.Vector3();
  private posCur = new THREE.Vector3();
  portraitBoost = 1;

  constructor(public cam: THREE.PerspectiveCamera) {}

  set(cfg: Partial<CamConfig>) {
    this.cfg = { ...DEFAULT_CAM, ...cfg };
  }

  reset() {
    this.yawOffset = 0;
  }

  addYaw(d: number) {
    this.yawOffset = clamp(this.yawOffset + d, -this.cfg.yawRange, this.cfg.yawRange);
  }

  get yaw() {
    return this.cfg.yaw + this.yawCur;
  }

  /** Instantly place camera (after scene change). */
  snap(target: THREE.Vector3) {
    this.target.copy(target);
    this.focus.copy(this.clampT(target));
    this.yawCur = this.yawOffset;
    this.compute(this.posCur, this.lookCur);
    this.cam.position.copy(this.posCur);
    this.cam.lookAt(this.lookCur);
    this.cam.fov = this.cfg.fov;
    this.cam.updateProjectionMatrix();
  }

  private clampT(v: THREE.Vector3) {
    const c = this.cfg.clamp;
    if (!c) return v;
    // when zoomed in on wide screens, let the camera follow further toward the room edges
    const e = (1 - Math.min(1, this.portraitBoost)) * 10;
    return new THREE.Vector3(clamp(v.x, c.minX - e, c.maxX + e), v.y, clamp(v.z, c.minZ - e * 0.5, c.maxZ + e * 0.5));
  }

  private compute(pos: THREE.Vector3, look: THREE.Vector3) {
    const aspect = this.cam.aspect;
    // portrait backs off to fit the room; wide landscape (phones) moves in so Hamin stays big on screen
    const boost = aspect < 1 ? 1 + (1 - aspect) * 0.9 : Math.max(0.74, Math.min(1, 1.45 / aspect));
    this.portraitBoost = boost;
    const d = this.cfg.dist * boost;
    const yaw = this.cfg.yaw + this.yawCur;
    const p = this.cfg.pitch;
    look.set(this.focus.x, this.focus.y + this.cfg.lookY, this.focus.z);
    pos.set(look.x + Math.sin(yaw) * Math.cos(p) * d, look.y + Math.sin(p) * d, look.z + Math.cos(yaw) * Math.cos(p) * d);
  }

  update(dt: number) {
    const c = this.cam;
    if (this.override) {
      const k = dampK(this.override.k ?? 3, dt);
      this.posCur.lerp(this.override.pos, k);
      this.lookCur.lerp(this.override.look, k);
      c.position.copy(this.posCur);
      c.lookAt(this.lookCur);
      const f = this.override.fov ?? this.cfg.fov;
      if (Math.abs(c.fov - f) > 0.01) {
        c.fov = damp(c.fov, f, 3, dt);
        c.updateProjectionMatrix();
      }
      return;
    }
    this.yawCur = damp(this.yawCur, this.yawOffset, 6, dt);
    const t = this.clampT(this.target);
    const k = dampK(this.cfg.follow, dt);
    this.focus.lerp(t, k);
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    this.compute(pos, look);
    this.posCur.lerp(pos, dampK(10, dt));
    this.lookCur.lerp(look, dampK(10, dt));
    c.position.copy(this.posCur);
    c.lookAt(this.lookCur);
    if (Math.abs(c.fov - this.cfg.fov) > 0.01) {
      c.fov = damp(c.fov, this.cfg.fov, 4, dt);
      c.updateProjectionMatrix();
    }
  }
}
