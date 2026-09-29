import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { isTouch } from '../utils/math';
import { Post } from './Post';

/** Global render quality; read by lights/characters when they are built. */
export const Quality = { shadows: true, shadowSize: 1024, post: true };

export type Tick = (dt: number, t: number) => void;

/** Renderer, main camera, frame loop, resize and adaptive resolution. */
export class Engine {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene | null = null;
  readonly mobile = isTouch() || Math.min(screen.width, screen.height) < 700;
  private ticks = new Set<Tick>();
  private last = performance.now();
  private time = 0;
  private maxDpr: number;
  private dpr: number;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private lowTime = 0;
  fps = 60;
  paused = false;
  debugEl: HTMLDivElement | null = null;
  width = 1;
  height = 1;

  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.mobile || window.devicePixelRatio < 2,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.94;
    Quality.shadows = !this.mobile || new URLSearchParams(location.search).get('q') === 'high';
    Quality.post = new URLSearchParams(location.search).get('q') !== 'low';
    Quality.shadowSize = this.mobile ? 512 : 1024;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0xdcecff);
    this.renderer.info.autoReset = false; // count all post passes in one frame
    this.maxDpr = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2);
    this.dpr = this.maxDpr;
    this.renderer.setPixelRatio(this.dpr);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
    (window as any).__renderer = this.renderer;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    document.addEventListener('visibilitychange', () => {
      this.last = performance.now();
    });
    if (new URLSearchParams(location.search).has('debug')) {
      this.debugEl = document.createElement('div');
      this.debugEl.className = 'debug-stats';
      document.body.appendChild(this.debugEl);
    }
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.post?.setSize(w, h, this.postDpr());
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  get portrait() {
    return this.height > this.width;
  }

  onTick(fn: Tick) {
    this.ticks.add(fn);
    return () => this.ticks.delete(fn);
  }

  start() {
    this.renderer.setAnimationLoop(() => this.frame());
  }

  post: Post | null = null;
  private postDpr() { return Math.min(this.dpr, this.mobile ? 1.25 : 2); }
  private present(dt: number) {
    if (!this.scene) return;
    if (Quality.post) {
      if (!this.post) {
        this.post = new Post(this.renderer, this.scene, this.camera);
        this.post.setSize(this.width, this.height, this.postDpr());
      }
      this.post.setScene(this.scene);
      this.post.draw(dt);
    } else this.renderer.render(this.scene, this.camera);
  }

  private frame() {
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1; // tab switches / hitches
    if (this.paused) dt = 0;
    this.time += dt;
    for (const t of this.ticks) t(dt, this.time);
    this.renderer.info.reset();
    this.present(dt);
    this.adapt(dt, now);
  }

  /** Step resolution down when the device struggles (PERFORMANCE_BUDGET). */
  private adapt(dt: number, now: number) {
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
      if (this.fps < 40 && !this.paused) this.lowTime += 0.5;
      else this.lowTime = Math.max(0, this.lowTime - 0.25);
      if (this.lowTime >= 2 && Quality.post) {
        // first step down: drop the post-processing
        Quality.post = false;
        this.lowTime = 0;
      } else if (this.lowTime >= 2 && this.dpr > 1) {
        this.dpr = Math.max(1, this.dpr - 0.25);
        this.renderer.setPixelRatio(this.dpr);
        this.resize();
        this.lowTime = 0;
      }
      if (this.debugEl) {
        const i = this.renderer.info;
        this.debugEl.textContent =
          `${this.fps.toFixed(0)} fps · dpr ${this.dpr.toFixed(2)} · calls ${i.render.calls} · tris ${(i.render.triangles / 1000).toFixed(1)}k · geo ${i.memory.geometries} · tex ${i.memory.textures}`;
      }
    }
    void now;
  }

  /** Render the current frame now and return a small JPEG (for photo mode). */
  snapshot(maxW = 320) {
    this.present(0);
    const src = this.renderer.domElement;
    const scale = Math.min(1, maxW / src.width);
    const c = document.createElement('canvas');
    c.width = Math.round(src.width * scale);
    c.height = Math.round(src.height * scale);
    c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.72);
  }
}

let envTex: THREE.Texture | null = null;
/** Soft studio reflections for the vinyl look (generated once, no files). */
export function studioEnv(renderer: THREE.WebGLRenderer) {
  if (!envTex) {
    const pm = new THREE.PMREMGenerator(renderer);
    envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    envTex.userData.shared = true;
    pm.dispose();
  }
  return envTex;
}

export interface Lights { hemi: THREE.HemisphereLight; sun: THREE.DirectionalLight; follow: (p: THREE.Vector3) => void }

/**
 * Hemisphere + one soft-shadow sun + studio environment.
 * `follow(p)` keeps the small shadow frustum centred on the player.
 */
export function addLights(
  scene: THREE.Scene,
  o: { sky?: number; ground?: number; hemi?: number; sun?: number; sunColor?: number; dir?: [number, number, number]; env?: number; shadowRange?: number; renderer?: THREE.WebGLRenderer } = {},
): Lights {
  const hemi = new THREE.HemisphereLight(o.sky ?? 0xfdfbff, o.ground ?? 0xe8c8dc, o.hemi ?? 0.85);
  const sun = new THREE.DirectionalLight(o.sunColor ?? 0xfff0e0, o.sun ?? 2.5);
  // cool pastel rim light from behind: separates characters from the background (no shadows)
  const rim = new THREE.DirectionalLight(0xc9dcff, 0.7);
  rim.position.set(-4, 6, -9);
  scene.add(rim);
  const d = new THREE.Vector3(...(o.dir ?? [4, 10, 6])).normalize().multiplyScalar(14);
  sun.position.copy(d);
  scene.add(hemi, sun, sun.target);
  if (Quality.shadows) {
    sun.castShadow = true;
    const r = o.shadowRange ?? 9;
    const c = sun.shadow.camera;
    c.left = -r; c.right = r; c.top = r; c.bottom = -r; c.near = 1; c.far = 40;
    sun.shadow.mapSize.set(Quality.shadowSize, Quality.shadowSize);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 4;
  }
  const r = o.renderer ?? (window as any).__renderer;
  if (r) {
    scene.environment = studioEnv(r);
    scene.environmentIntensity = o.env ?? 0.55;
  }
  const follow = (p: THREE.Vector3) => {
    sun.target.position.set(Math.round(p.x * 2) / 2, 0, Math.round(p.z * 2) / 2);
    sun.position.copy(sun.target.position).add(d);
  };
  return { hemi, sun, follow };
}
