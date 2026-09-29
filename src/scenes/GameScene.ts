import * as THREE from 'three';
import type { Game } from '../game/Game';
import { Collider, Bounds, boxOf, circle } from '../core/Collision';
import { CamConfig } from '../core/CameraRig';
import { StaticBatcher } from '../core/StaticBatcher';
import { addLights, Lights } from '../core/Engine';
import { Interactable } from '../interactions/Interactions';
import { Npc } from '../npcs/Npc';
import { NPCS } from '../npcs/npcData';
import type { TrackId } from '../audio/Audio';
import { skyTexture, artTex, sparkleTex } from '../assets/textures';
import { landmark, LandmarkId, FitOpts } from '../assets/landmarks';

export type SceneId =
  | 'title' | 'yard' | 'classroom' | 'dance' | 'vocal' | 'cafeteria' | 'stage' | 'metro' | 'train' | 'beach'
  | 'dressing' | 'dogchase';

export interface Spawn { x: number; z: number; rot: number }

/**
 * Base class for every location. Subclasses implement build() and add content with the helpers.
 * Static props go into `this.statics` (merged to one draw call by finalize()).
 */
export abstract class GameScene {
  abstract readonly id: SceneId;
  abstract readonly title: string;
  subtitle = '';
  music: TrackId = 'school';
  ambience: string | null = null;
  scene = new THREE.Scene();
  statics = new THREE.Group();
  colliders: Collider[] = [];
  bounds: Bounds = { minX: -5, maxX: 5, minZ: -4, maxZ: 4 };
  interactables: Interactable[] = [];
  npcs: Npc[] = [];
  spawns: Record<string, Spawn> = { default: { x: 0, z: 2, rot: Math.PI } };
  cam: Partial<CamConfig> = {};
  /** false for mini-game scenes that drive Hamin/camera themselves */
  explore = true;
  /** indoor sparkle dust added automatically in finalize() for explorable scenes */
  motes = true;
  showPlayer = true;
  lights!: Lights;
  private updaters: ((dt: number, t: number) => void)[] = [];
  protected time = 0;

  constructor(protected game: Game) {}

  abstract build(): void | Promise<void>;
  /** Called after the player has been placed. */
  onEnter(_spawn: string) {}
  onExit() {}
  update(_dt: number) {}

  // ---------------- helpers ----------------
  protected sky(top: string, bottom: string, mid?: string) {
    const t = skyTexture(top, bottom, mid);
    this.scene.background = t;
  }

  /** Painted Higgsfield sky as the background (+ matching soft fog colour for depth). */
  protected skyArt(name: 'sky_day' | 'sky_sunset' | 'sky_title', fog?: { color: number; near: number; far: number }) {
    this.scene.background = artTex(name);
    if (fog) this.scene.fog = new THREE.Fog(fog.color, fog.near, fog.far);
  }

  /** Floating ambience: 'motes' (indoor sparkle dust) or 'petals' (outdoor blossoms). One draw call. */
  protected ambientParticles(kind: 'motes' | 'petals', area: { x: number; z: number; y?: number } = { x: 12, z: 9 }, count = 60) {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const H = area.y ?? 4;
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * area.x;
      pos[i * 3 + 1] = Math.random() * H;
      pos[i * 3 + 2] = (Math.random() - 0.5) * area.z;
      seed[i] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      map: sparkleTex(), size: kind === 'petals' ? 0.22 : 0.12, transparent: true, depthWrite: false, opacity: 0.85,
      color: kind === 'petals' ? 0xffc4d6 : 0xfff6d8, blending: kind === 'petals' ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.userData.noShadow = true;
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.onUpdate((dt, t) => {
      const a = geo.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        const s = seed[i];
        if (kind === 'petals') {
          a[i * 3] += (Math.sin(t * 0.7 + s) * 0.25 + 0.35) * dt;
          a[i * 3 + 1] -= (0.35 + (s % 1) * 0.2) * dt;
          a[i * 3 + 2] += Math.cos(t * 0.5 + s) * 0.2 * dt;
          if (a[i * 3 + 1] < 0) { a[i * 3 + 1] = H; a[i * 3] = (Math.random() - 0.5) * area.x; }
          if (a[i * 3] > area.x / 2) a[i * 3] = -area.x / 2;
        } else {
          a[i * 3] += Math.sin(t * 0.3 + s) * 0.05 * dt;
          a[i * 3 + 1] += Math.sin(t * 0.5 + s * 2) * 0.06 * dt;
        }
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = kind === 'motes' ? 0.55 + Math.sin(t * 1.3) * 0.2 : 0.85;
    });
    return pts;
  }

  protected light(o: Parameters<typeof addLights>[1] = {}) {
    this.lights = addLights(this.scene, { renderer: this.game.engine.renderer, ...o });
  }

  /** Add static decoration (merged later). Optionally collide by its bounding box. */
  protected add(obj: THREE.Object3D, collide: false | 'box' | number = false, pad = 0) {
    this.statics.add(obj);
    if (collide === 'box') this.colliders.push(boxOf(obj, pad));
    else if (typeof collide === 'number') {
      const p = new THREE.Vector3();
      obj.getWorldPosition(p);
      this.colliders.push(circle(p.x, p.z, collide));
    }
    return obj;
  }

  /**
   * Place a Higgsfield landmark prop (base on the floor, centred at x/z, rotated rotY).
   * collide: 'box' = AABB of the placed model (shrunk a little), number = circle radius. Returns null if it fails to load.
   */
  protected async prop(id: LandmarkId, x: number, z: number, fit: FitOpts, rotY = 0, collide: false | 'box' | number = 'box', y = 0) {
    try {
      const m = await landmark(id, fit);
      m.position.set(x, y, z);
      m.rotation.y = rotY;
      this.scene.add(m);
      if (collide === 'box') this.colliders.push(boxOf(m, -0.12));
      else if (typeof collide === 'number') this.colliders.push(circle(x, z, collide));
      return m;
    } catch (e) {
      console.warn('landmark failed', id, e);
      return null;
    }
  }

  /** Add something that moves / is textured (not batched). */
  protected addDynamic(obj: THREE.Object3D) {
    this.scene.add(obj);
    return obj;
  }

  protected interact(i: Interactable) {
    this.interactables.push(i);
    return i;
  }

  protected onUpdate(fn: (dt: number, t: number) => void) {
    this.updaters.push(fn);
  }

  /** Spawn the NPCs registered for this scene. */
  protected spawnNpcs(overrides: Record<string, [number, number, number?]> = {}) {
    for (const def of NPCS.filter((n) => n.scene === this.id)) {
      const npc = new Npc(def);
      const o = overrides[def.id];
      if (o) npc.place(o[0], o[1], o[2]);
      this.scene.add(npc.root);
      this.npcs.push(npc);
      this.colliders.push(circle(npc.position.x, npc.position.z, 0.45));
      this.interact({
        id: 'npc:' + def.id,
        pos: npc.position,
        radius: 1.6,
        label: `💬 Talk to ${def.name}`,
        height: npc.rig.height + 0.35,
        onInteract: () => this.game.talkTo(npc),
      });
    }
  }

  /** A door / exit that moves to another scene. */
  protected door(to: SceneId, spawn: string, pos: THREE.Vector3, label: string, radius = 1.3) {
    this.interact({ id: 'door:' + to + ':' + spawn, pos, radius, label: `🚪 ${label}`, height: 2.4, onInteract: () => this.game.goto(to, spawn) });
  }

  /** A collectible sticker / plush / shell sitting in the world. */
  protected collectible(kind: 'sticker' | 'plush' | 'shell' | 'charm', id: string, obj: THREE.Object3D, label: string, emoji: string) {
    const list = this.game.save.data[kind === 'sticker' ? 'stickers' : kind === 'plush' ? 'plushies' : kind === 'shell' ? 'shells' : 'charms'];
    if (list.includes(id)) return;
    this.scene.add(obj);
    const base = obj.position.y;
    const t0 = Math.random() * 6;
    this.onUpdate((dt, t) => {
      if (!obj.parent) return;
      obj.rotation.y += dt * 1.2;
      obj.position.y = base + Math.sin(t * 2 + t0) * 0.06;
    });
    const it = this.interact({
      id: kind + ':' + id,
      pos: obj.position,
      radius: 1.2,
      label: `✨ Pick up ${label}`,
      height: 0.9,
      onInteract: () => {
        obj.removeFromParent();
        this.interactables.splice(this.interactables.indexOf(it), 1);
        this.game.collect(kind, id, obj.getWorldPosition(new THREE.Vector3()), label, emoji);
      },
    });
  }

  /** Merge statics & put everything in the scene. Called by SceneManager after build(). */
  finalize() {
    if (this.explore && this.motes) {
      const bb = this.bounds;
      const p = this.ambientParticles('motes', { x: bb.maxX - bb.minX, z: bb.maxZ - bb.minZ, y: 3.2 }, 45);
      p.position.set((bb.maxX + bb.minX) / 2, 0.3, (bb.maxZ + bb.minZ) / 2);
    }
    const b = new StaticBatcher();
    b.addObject(this.statics);
    const merged = b.build(this.id + '-static');
    if (merged) this.scene.add(merged);
    // leftovers (textured / transparent) stay as individual meshes
    if (this.statics.children.length) this.scene.add(this.statics);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m !== merged && !(m.material as THREE.Material).transparent && !m.userData.noShadow) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }

  tick(dt: number) {
    this.time += dt;
    const p = this.game.player.root.position;
    for (const n of this.npcs) n.update(dt, this.showPlayer ? p : null);
    for (const u of this.updaters) u(dt, this.time);
    if (this.lights && this.showPlayer) this.lights.follow(p);
    this.update(dt);
  }

  dispose() {
    for (const n of this.npcs) n.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose();
      const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
      for (const mat of mats) {
        if (mat.userData?.shared) continue;
        for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture && !(v as THREE.Texture).userData.shared) (v as THREE.Texture).dispose();
        mat.dispose();
      }
    });
    const bg = this.scene.background as THREE.Texture | null;
    if (bg && (bg as any).isTexture && !bg.userData.shared) bg.dispose();
    this.scene.clear();
  }
}
