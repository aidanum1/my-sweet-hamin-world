import * as THREE from 'three';
import { GameScene } from './GameScene';
import { P } from '../assets/palette';
import { mk, rbox, sphere, cyl, cone } from '../assets/geo';
import { tree, flower, sheepCloud, fence, bush, sheepPlush } from '../assets/props';
import { el } from '../ui/UI';
import { openCredits, openSettings, openLanguage } from '../ui/Menus';
import { getLang, LANGS } from '../i18n/i18n';
import { tryLandscapeLock } from '../core/Viewport';
import { critter } from '../assets/landmarks';

/** Title: a floating pastel island diorama with Hamin, sheep and drifting sheep clouds. */
export default class TitleScene extends GameScene {
  readonly id = 'title' as const;
  readonly title = 'My Sweet Hamin World';
  music = 'title' as const;
  explore = false;
  private overlay: HTMLDivElement | null = null;
  private clouds: THREE.Object3D[] = [];
  /** hopping sheep: base height + base scale (the fallback plush is scaled ×3) + phase */
  private sheep: { o: THREE.Object3D; y: number; s: number; ph: number }[] = [];
  private angle = 0;

  private islandLoaded = false;

  async build() {
    this.skyArt('sky_title');
    this.light({ dir: [5, 9, 7], shadowRange: 7 });
    // Higgsfield-generated floating island (sam_3_3d, 1 credit); procedural island as a fallback
    let ground = (_x: number, _z: number) => 0.12; // grass height (procedural island: its grass disc)
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
      const ld = new GLTFLoader();
      ld.setMeshoptDecoder(MeshoptDecoder);
      const isl = (await ld.loadAsync(import.meta.env.BASE_URL + 'models/title_island.glb')).scene;
      const box = new THREE.Box3().setFromObject(isl);
      const size = box.getSize(new THREE.Vector3());
      const k = 8 / Math.max(size.x, size.z);
      isl.scale.setScalar(k);
      isl.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(isl);
      isl.position.set(-(b2.min.x + b2.max.x) / 2, 0, -(b2.min.z + b2.max.z) / 2);
      isl.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = m.receiveShadow = true;
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.roughness = 0.75;
        mat.metalness = 0;
        if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();
      });
      isl.userData.dynamic = true;
      this.scene.add(isl);
      // find the grass height where Hamin stands
      isl.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(new THREE.Vector3(0.3, 50, 1.6), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObject(isl, true)[0];
      const top = hit ? hit.point.y : b2.max.y * 0.45;
      isl.position.y -= top; // grass top at y = 0
      isl.updateMatrixWorld(true);
      ground = (x, z) => {
        ray.set(new THREE.Vector3(x, 50, z), new THREE.Vector3(0, -1, 0));
        return ray.intersectObject(isl, true)[0]?.point.y ?? 0;
      };
      this.islandLoaded = true;
    } catch (e) {
      console.warn('title island model failed, using procedural island', e);
      this.proceduralIsland();
    }
    await this.addSheep(ground);
    // sheep clouds
    for (let i = 0; i < 6; i++) {
      const c = sheepCloud(0.8 + Math.random() * 0.6);
      const a = (i / 6) * Math.PI * 2;
      c.position.set(Math.cos(a) * 11, 3 + Math.random() * 4, Math.sin(a) * 11 - 3);
      c.userData.a = a;
      c.userData.r = 10 + Math.random() * 3;
      this.scene.add(c);
      this.clouds.push(c);
    }
    // sparkly "stars" in the sky
    const starGeo = new THREE.BufferGeometry();
    const pts: number[] = [];
    for (let i = 0; i < 70; i++) pts.push((Math.random() - 0.5) * 40, 4 + Math.random() * 14, -12 - Math.random() * 10);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0.9 })));
    this.spawns.default = { x: 0.3, z: 1.6, rot: 0.25 };
    void sphere;
  }

  private proceduralIsland() {
    const s = this.statics;
    s.add(mk(cyl(5.2, 4.2, 1.2, 40), P.pinkSoft, [0, -0.6, 0]));
    s.add(mk(cyl(4.3, 2.6, 1.4, 36), P.pink, [0, -1.8, 0]));
    s.add(mk(cyl(2.4, 0.4, 1.6, 30), P.pinkDeep, [0, -3.2, 0]));
    s.add(mk(cyl(5.3, 5.3, 0.25, 40), P.grass, [0, 0, 0]));
    s.add(tree(1.1, P.mintDeep, P.woodDeep, true).translateX(2.6).translateZ(-2));
    s.add(bush(1).translateX(3.4).translateZ(1.2));
    const cols = [P.pink, P.butter, P.blue, P.purple, P.white];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r = 3.6 + Math.sin(i * 7) * 0.9;
      s.add(flower(cols[i % 5], 1.2).translateX(Math.cos(a) * r).translateZ(Math.sin(a) * r).translateY(0.1));
    }
    void fence; void rbox; void cone; void sphere;
  }

  /** Two sheep hopping on the grass: Higgsfield `sheep` (≈3.6k tris each), the procedural plush as a fallback. */
  private async addSheep(ground: (x: number, z: number) => number) {
    let proto: THREE.Object3D | null = null;
    try {
      proto = await critter('sheep', { h: 1.0 });
    } catch (e) {
      console.warn('sheep model failed, using procedural sheep', e);
    }
    // x, z, facing: open grass in front, clear of the island model's fence, stumps and bushes (measured by raycast)
    const spots = this.islandLoaded
      ? [[1.4, 2.2, -0.3], [-1.8, 1.9, 0.35]] as const
      : [[2.2, 0.8, 0], [-2.4, 1.4, 0]] as const;
    spots.forEach(([x, z, rot], i) => {
      const o = proto ? (i ? proto.clone() : proto) : sheepPlush(3);
      o.position.set(x, ground(x, z), z);
      o.rotation.y = rot;
      this.scene.add(o);
      this.sheep.push({ o, y: o.position.y, s: o.scale.x, ph: i * 2 });
    });
  }

  onEnter() {
    const g = this.game;
    g.player.play('wave', { loop: false });
    g.cam.override = { pos: new THREE.Vector3(0, 3.2, 10.5), look: new THREE.Vector3(0, 1.1, 0), k: 50 };
    this.overlay = el('div', 'title');
    const isNew = g.save.isNew;
    this.overlay.innerHTML = `<div class="logo"><div class="l1">✦ welcome to ✦</div><div class="l2" data-no-tr>My Sweet<br><span>Hamin</span> World</div><div class="l3">♡ a tiny pastel dollhouse world ♡</div></div>`;
    const btns = el('div', 'title-btns');
    const play = el('button', 'candy primary', isNew ? '♡ Play' : '♡ Continue');
    const row = el('div', 'row');
    const settings = el('button', 'candy blue small', '⚙️ Settings');
    const credits = el('button', 'candy mint small', '💌 Credits');
    row.append(settings, credits);
    const fine = el('div', 'fine', 'Unofficial fan-made game by mysweethamin ♡ · no account needed · progress saves on this device');
    btns.append(play, row, fine);
    // labelled language chip (globe + current language's own name) so it's easy to spot in any language
    const cur = LANGS.find((l) => l.id === getLang()) ?? LANGS[0];
    const langBtn = el('button', 'title-lang', `🌐 <span data-no-tr>${cur.label}</span> <span class="caret">▾</span>`);
    langBtn.setAttribute('aria-label', 'Language');
    langBtn.onclick = () => { g.audio.unlock(); g.audio.sfx('select'); openLanguage(g); };
    this.overlay.appendChild(langBtn);
    this.overlay.appendChild(btns);
    document.getElementById('ui')!.appendChild(this.overlay);
    play.onclick = () => {
      tryLandscapeLock();
      g.audio.unlock();
      g.audio.sfx('chime');
      const target = isNew ? 'classroom' : (g.save.data.lastScene as any) || 'classroom';
      g.goto(target === 'train' || target === 'dressing' || target === 'dogchase' ? 'yard' : target, 'default', { text: 'opening the dollhouse…' });
    };
    settings.onclick = () => { g.audio.unlock(); g.audio.sfx('select'); openSettings(g); };
    credits.onclick = () => { g.audio.unlock(); g.audio.sfx('select'); openCredits(g); };
    const q = new URLSearchParams(location.search).get('scene');
    if (q) setTimeout(() => g.goto(q as any, 'default', { instant: false }), 50);
  }

  update(dt: number) {
    this.angle += dt * 0.12;
    const g = this.game;
    const landscape = innerWidth > innerHeight * 1.15;
    const r = landscape ? 14.5 : 18;
    if (g.cam.override) {
      const a = this.angle;
      g.cam.override.pos.set(Math.sin(a) * r, 4.2 + Math.sin(a * 0.7) * 0.5, Math.cos(a) * r);
      // in landscape the island sits on the right, leaving room for the logo on the left
      const side = landscape ? 3.6 : 0;
      g.cam.override.look.set(-Math.cos(a) * side, landscape ? 0.2 : 0.8, Math.sin(a) * side);
      g.cam.override.k = 4;
    }
    if (!g.player.currentAction && Math.random() < dt * 0.25) g.player.play(Math.random() < 0.5 ? 'wave' : 'happy');
    // hop, stretch in the air, squash (with a little jiggle) on landing and crouch before the next hop
    for (const sh of this.sheep) {
      const p = (this.time * 4 + sh.ph) % (Math.PI * 2);
      let y = 0, sy: number;
      if (p < Math.PI) {
        y = Math.sin(p) * 0.3;
        sy = 1 + Math.abs(Math.cos(p)) * 0.09;
      } else {
        const u = p - Math.PI;
        sy = 1 - 0.2 * Math.exp(-u * 2.5) * Math.cos(u * 3.5) - 0.1 * Math.exp(-(Math.PI - u) * 3);
      }
      const sxz = 1 / Math.sqrt(sy); // keep the volume
      sh.o.position.y = sh.y + y;
      sh.o.scale.set(sh.s * sxz, sh.s * sy, sh.s * sxz);
    }
    for (const c of this.clouds) {
      c.userData.a += dt * 0.03;
      c.position.x = Math.cos(c.userData.a) * c.userData.r;
      c.position.z = Math.sin(c.userData.a) * c.userData.r - 3;
      c.rotation.y = -c.userData.a;
    }
  }

  onExit() {
    this.overlay?.remove();
    this.game.cam.override = null;
  }
}
