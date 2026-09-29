import * as THREE from 'three';
import { clamp, damp, dampK } from '../utils/math';
import { segmentHit, type Collider } from './Collision';

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

/** Close-up framing (zoom = 1): a little in front of Hamin's face. */
const CLOSE = { dist: 2.6, pitch: 0.12, lookY: 1.45 };
/** Every scene can turn at least ±63° (126°); zoomed in past this, the camera orbits freely all the way round. */
const MIN_YAW_RANGE = 1.1;
const FREE_ORBIT_ZOOM = 0.45;
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/**
 * Miniature-diorama follow camera: elevated and gently angled by default; the player can turn it, tilt it and zoom
 * all the way in to a face close-up (zoom 0 = the scene's dollhouse view, 1 = close-up).
 */
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
  /** 0 = scene framing, 1 = face close-up (target), eased into zoomCur */
  zoom = 0;
  private zoomCur = 0;
  pitchOffset = 0;
  /** walkable area of the scene: a zoomed-in camera stays inside it (so it doesn't end up behind a wall) */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number } | null = null;
  /** scene colliders: a zoomed-in camera is pulled in front of anything between it and Hamin */
  colliders: readonly Collider[] = [];

  constructor(public cam: THREE.PerspectiveCamera) {}

  set(cfg: Partial<CamConfig>) {
    this.cfg = { ...DEFAULT_CAM, ...cfg };
  }

  reset() {
    this.yawOffset = 0;
    this.zoom = 0;
    this.pitchOffset = 0;
  }

  private get yawLimit() {
    return this.zoom > FREE_ORBIT_ZOOM ? Infinity : Math.max(this.cfg.yawRange, MIN_YAW_RANGE);
  }

  addYaw(d: number) {
    const r = this.yawLimit;
    this.yawOffset = clamp(this.yawOffset + d, -r, r);
  }

  addPitch(d: number) {
    this.pitchOffset = clamp(this.pitchOffset + d, -0.5, 0.55);
  }

  addZoom(d: number) {
    this.zoom = clamp(this.zoom + d, 0, 1);
    if (this.zoom <= FREE_ORBIT_ZOOM) this.addYaw(0); // back to the scene's turning range
  }

  /** Jump the zoom (camera button presets); `frontOf` = a facing angle to swing round to (Hamin's face). */
  setZoom(z: number, frontOf?: number) {
    this.zoom = clamp(z, 0, 1);
    if (frontOf !== undefined) {
      // nearest equivalent angle, so the camera takes the short way round
      let d = frontOf - this.cfg.yaw - this.yawOffset;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yawOffset += d;
    }
    if (this.zoom <= FREE_ORBIT_ZOOM) this.addYaw(0);
  }

  get yaw() {
    return this.cfg.yaw + this.yawCur;
  }

  /** Instantly place camera (after scene change). */
  snap(target: THREE.Vector3) {
    this.target.copy(target);
    this.focus.copy(this.clampT(target));
    this.yawCur = this.yawOffset;
    this.zoomCur = this.zoom;
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
    const z = this.zoomCur;
    // ease the zoom so the close half of the range gets most of the resolution
    const d = THREE.MathUtils.lerp(this.cfg.dist * boost, CLOSE.dist, 1 - (1 - z) * (1 - z));
    const yaw = this.cfg.yaw + this.yawCur;
    const p = clamp(THREE.MathUtils.lerp(this.cfg.pitch, CLOSE.pitch, z) + this.pitchOffset, 0.02, 1.3);
    const lookY = THREE.MathUtils.lerp(this.cfg.lookY, CLOSE.lookY, z);
    look.set(this.focus.x, this.focus.y + lookY, this.focus.z);
    pos.set(look.x + Math.sin(yaw) * Math.cos(p) * d, look.y + Math.sin(p) * d, look.z + Math.cos(yaw) * Math.cos(p) * d);
    // zoomed in: keep the camera inside the walkable area (+ a little), so walls don't block the close-up
    const b = this.bounds;
    const k = smooth(0.3, 0.75, z);
    if (b && k > 0) {
      const m = 0.6;
      pos.x = THREE.MathUtils.lerp(pos.x, clamp(pos.x, b.minX - m, b.maxX + m), k);
      pos.z = THREE.MathUtils.lerp(pos.z, clamp(pos.z, b.minZ - m, b.maxZ + m), k);
    }
    // zoomed in: don't end up inside the fountain / behind a bench — pull in front of the first obstacle
    const kc = smooth(0.2, 0.55, z);
    if (kc > 0 && this.colliders.length) {
      const t = segmentHit(look.x, look.z, pos.x, pos.z, this.colliders, 0.3);
      if (t < 1) {
        // come in front of it, but never closer than a head-and-shoulders shot; if that's not enough room,
        // rise and look over the obstacle instead
        const full = Math.hypot(pos.x - look.x, pos.z - look.z);
        const tt = Math.max(t, Math.min(1, 1.6 / Math.max(full, 1e-3)));
        const lift = Math.max(0, tt - t) * full * 0.35;
        pos.x = THREE.MathUtils.lerp(pos.x, look.x + (pos.x - look.x) * tt, kc);
        pos.z = THREE.MathUtils.lerp(pos.z, look.z + (pos.z - look.z) * tt, kc);
        pos.y = THREE.MathUtils.lerp(pos.y, look.y + (pos.y - look.y) * tt + lift, kc);
      }
    }
    pos.y = Math.max(pos.y, 0.35);
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
    this.zoomCur = damp(this.zoomCur, this.zoom, 5, dt);
    // the room framing clamp fades out as we zoom in, so a close-up stays centred on Hamin
    const t = this.clampT(this.target).lerp(this.target, smooth(0.15, 0.6, this.zoomCur));
    const k = dampK(this.cfg.follow + this.zoomCur * 4, dt);
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
