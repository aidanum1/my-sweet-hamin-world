import * as THREE from 'three';
import { GameScene, SceneId } from './GameScene';
import { P } from '../assets/palette';
import { mk, rbox, cyl, sphere, cone, torus } from '../assets/geo';
import { door, sign, tree, bush, flower, fence, bench, lampPost, sheepCloud, sheepPlush, stickerPickup, plant, bunting, awning } from '../assets/props';
import { grassTex, pathTex } from '../assets/textures';
import { box as colBox, circle } from '../core/Collision';
import { Dog } from '../characters/Dog';
import { wait } from '../utils/math';

// Higgsfield school model placement (measured by raycasting the model at width 24): its doors sit 0.75 left of
// centre, so it is shifted right to put them at ±2.5 / ±7; door plane ≈ z −6.6, flower planters ≈ z −5.5.
const SCHOOL_W = 24;
const SCHOOL_X = 0.75;
const SCHOOL_Z = -10.8;
const SCHOOL_DOORS = [-7, -2.5, 2.5, 7];
const SCHOOL_PLATE_Y = 3.9;

/** Outdoor hub: school building with doors to every room, the stage hall, the metro, Bori the puppy. */
export default class SchoolyardScene extends GameScene {
  readonly id = 'yard' as const;
  readonly title = 'Schoolyard';
  subtitle = 'Sweet Reply High';
  music = 'yard' as const;
  private dog!: Dog;
  private clouds: THREE.Object3D[] = [];

  async build() {
    const loads: Promise<unknown>[] = [];
    this.skyArt('sky_day', { color: 0xf3e6f4, near: 28, far: 70 });
    this.light({ dir: [7, 8, 5], shadowRange: 12, hemi: 0.8, sun: 2.4 });
    this.motes = false;
    this.bounds = { minX: -12.5, maxX: 12.5, minZ: -7.2, maxZ: 8.5 };
    this.cam = { dist: 17, pitch: 0.46, yawRange: 0.7, lookY: 2.0, clamp: { minX: -7, maxX: 7, minZ: -2.5, maxZ: 4 } };
    const s = this.statics;
    // ground cake
    s.add(mk(rbox(28, 1, 20, 0.5, 3), P.pinkSoft, [0, -0.55, 0.5]));
    s.add(mk(rbox(27, 0.2, 19, 0.1), P.grassDeep, [0, 0, 0.5]));
    // textured lawn + stone paths (separate draw calls, but they carry the whole look)
    const tplane = (w: number, d: number, map: THREE.Texture, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map, roughness: 0.9 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, z);
      m.receiveShadow = true;
      this.scene.add(m);
    };
    tplane(26.6, 18.6, grassTex(0xbfe8a8, 7, 5), 0, 0.105, 0.5);
    tplane(22, 2.4, pathTex(0xf7e2c4, 9, 1), 0, 0.12, -4.9);
    tplane(2.6, 12, pathTex(0xf7e2c4, 1, 5), 0, 0.121, 1.5);
    tplane(24, 2.2, pathTex(0xf7e2c4, 10, 1), 0, 0.122, 2.2);
    // distant scenery: rolling pastel hills and trees around the floating island (built once we know
    // whether the tall Higgsfield school stands in front of the back ones)
    let schoolModel = false;
    for (let x = -10; x <= 10; x += 2) s.add(mk(cyl(0.35, 0.35, 0.07, 14), P.cream, [x, 0.14, 2.2]));
    // ---- school building: Higgsfield image_to_3d model (procedural fallback) ----
    const doorDefs: [SceneId, number, string][] = [
      ['classroom', P.pinkDeep, 'Classroom'],
      ['dance', P.blueDeep, 'Dance Room'],
      ['vocal', P.lavenderDeep, 'Vocal Room'],
      ['cafeteria', P.peachDeep, 'Cafeteria'],
    ];
    let doorXs = [-8, -3.5, 3.5, 8];
    let doorZ = -5.6;
    loads.push(this.prop('hq_school', SCHOOL_X, SCHOOL_Z, { w: SCHOOL_W }, 0, false).then((m) => {
      if (m) {
        schoolModel = true;
        doorXs = SCHOOL_DOORS;
        doorZ = -5;
        this.colliders.push(colBox(0, -7.5, 26, 3.8));
        // little name plates above each door
        doorDefs.forEach(([, c, label], i) => {
          const pl = sign(label, 1.7, 0.42, { bg: '#FFFFFF', border: '#' + new THREE.Color(c).getHexString() });
          pl.position.set(doorXs[i], SCHOOL_PLATE_Y, -6.35);
          this.scene.add(pl);
        });
        return;
      }
      this.proceduralSchool(doorDefs, doorXs);
      this.colliders.push(colBox(0, -7.6, 24, 2.4));
      this.add(plant(P.butter, P.mintDeep).translateX(-1.9).translateZ(-5.8), 0.35);
      this.add(plant(P.butter, P.mintDeep).translateX(1.9).translateZ(-5.8), 0.35);
    }));
    // ---- stage hall (left) ----
    const hall = new THREE.Group();
    hall.add(mk(rbox(4.5, 4.4, 6, 0.3), P.lavender, [-14.2, 2.2, 1.5]));
    hall.add(mk(cyl(3.1, 3.1, 4.6, 24, ), P.purple, [-14.2, 4.4, 1.5], [Math.PI / 2, 0, 0], [1, 1, 1]));
    hall.add(mk(rbox(0.3, 3, 2.4, 0.12), P.white, [-11.95, 1.5, 1.5]));
    hall.add(mk(rbox(0.2, 2.6, 2, 0.14), P.pinkDeep, [-11.85, 1.3, 1.5]));
    for (const z of [-0.2, 3.2]) hall.add(mk(cyl(0.18, 0.18, 3.6, 12), P.white, [-11.9, 1.8, z]));
    this.add(hall);
    this.colliders.push(colBox(-14.2, 1.5, 4.8, 6.2));
    const hallSign = sign('🌟 Stage Hall', 2.4, 0.6, { bg: '#FFFFFF', border: '#E6B2FF' });
    hallSign.position.set(-11.75, 3.4, 1.5);
    hallSign.rotation.y = Math.PI / 2;
    this.scene.add(hallSign);
    this.door('stage', 'default', new THREE.Vector3(-11.3, 0, 1.5), 'Enter the Stage Hall', 1.5);
    this.spawns.stage = { x: -10.4, z: 1.5, rot: Math.PI / 2 };
    // ---- metro entrance (right) ----
    const mt = new THREE.Group();
    mt.add(mk(rbox(3.6, 0.3, 4.4, 0.12), P.mint, [11.6, 0.15, 2]));
    mt.add(mk(rbox(2.6, 0.2, 3.2, 0.1), 0x9fd9c0, [11.8, 0.32, 2]));
    for (const z of [0.1, 3.9]) {
      mt.add(mk(cyl(0.12, 0.12, 3, 10), P.white, [10.2, 1.5, z]));
      mt.add(mk(cyl(0.12, 0.12, 3, 10), P.white, [13, 1.5, z]));
    }
    mt.add(mk(rbox(3.4, 0.25, 4.3, 0.1), P.mintDeep, [11.6, 3.1, 2]));
    mt.add(mk(torus(0.5, 0.1, 8, 20), P.mintDeep, [10.1, 3.7, 2], [0, Math.PI / 2, 0]));
    this.add(mt);
    const mtSign = sign('🚇 Sweet Line', 2.4, 0.6, { bg: '#FFFFFF', border: '#8FDCBC' });
    mtSign.position.set(10.05, 3.7, 2);
    mtSign.rotation.y = -Math.PI / 2;
    this.scene.add(mtSign);
    this.door('metro', 'default', new THREE.Vector3(10.6, 0, 2), 'Go down to the metro', 1.6);
    this.spawns.metro = { x: 9.4, z: 2, rot: -Math.PI / 2 };
    // ---- garden ----
    const trees: [number, number, number, boolean][] = [[-10.5, 6.5, 1.2, true], [-6.5, 7.2, 1, false], [6.5, 7.4, 1.1, true], [10.5, 6.3, 1, false], [-11, -3.2, 0.9, false], [11.2, -3.4, 0.9, true]];
    for (const [x, z, sc, bl] of trees) {
      if (bl) {
        // Higgsfield cherry blossom tree (sam_3_3d)
        loads.push(this.prop('blossom_tree', x, z, { h: 3.6 * sc }, Math.random() * 6, 0.5).then((m) => {
          if (!m) this.scene.add(tree(sc, P.mintDeep, P.woodDeep, true).translateX(x).translateZ(z));
        }));
      } else this.add(tree(sc, P.mintDeep, P.woodDeep, false).translateX(x).translateZ(z), 0.5);
    }
    for (const [x, z] of [[-4.5, 7.6], [4.5, 7.6], [-8.5, 4.4], [8.5, 4.6]]) this.add(bush(1.1).translateX(x).translateZ(z), 0.7);
    const fcols = [P.pink, P.butter, P.blue, P.purple, P.white, P.strawberry];
    for (const bx of [-5.5, 5.5]) {
      this.add(mk(rbox(3.4, 0.35, 1.8, 0.15), P.woodDeep, [bx, 0.17, 5.4]));
      this.colliders.push(colBox(bx, 5.4, 3.4, 1.8));
      for (let i = 0; i < 10; i++) this.add(flower(fcols[i % 6], 1.3).translateX(bx - 1.3 + (i % 5) * 0.65).translateZ(5.0 + Math.floor(i / 5) * 0.7).translateY(0.3));
    }
    for (const [x, z] of [[-3.2, 4.2], [3.2, 4.2], [-7.6, -2.9], [7.6, -2.9]] as const) {
      // Higgsfield sheep bench (sam_3_3d); procedural bench as a fallback
      loads.push(this.prop('sheep_bench', x, z, { w: 2 }, 0, false).then((m) => {
        if (m) return;
        const b = bench(1.8, P.pinkSoft);
        b.position.set(x, 0, z);
        this.add(b);
      }));
      this.colliders.push(colBox(x, z, 1.9, 0.7));
    }
    for (const x of [-10.5, -5.8, 5.8, 10.5]) this.add(lampPost().translateX(x).translateZ(-3.8), 0.2);
    // bunting between the lamp posts
    this.add(bunting([-10.5, 2.75, -3.8], [-5.8, 2.75, -3.8], 10));
    this.add(bunting([5.8, 2.75, -3.8], [10.5, 2.75, -3.8], 10));
    this.add(bunting([-5.8, 2.75, -3.8], [5.8, 2.75, -3.8], 18, undefined, 0.8));
    this.buildPlayground();
    this.butterflies();
    const fl = fence(8);
    fl.position.set(-8, 0, 9);
    this.add(fl);
    const fr = fence(8);
    fr.position.set(8, 0, 9);
    this.add(fr);
    // sheep fountain (Higgsfield sam_3_3d model)
    loads.push(this.prop('fountain', 0, 2.2, { w: 3.1 }, 0, false).then((m) => {
      if (m) return;
      const fo = new THREE.Group();
      fo.add(mk(cyl(1.4, 1.5, 0.5, 28), P.white, [0, 0.25, 0]));
      fo.add(mk(cyl(1.2, 1.2, 0.06, 28), P.sea, [0, 0.46, 0]));
      fo.add(mk(sphere(0.35, 14, 10), P.white, [0, 1.5, 0]));
      fo.position.set(0, 0, 2.2);
      this.scene.add(fo);
    }));
    this.colliders.push(circle(0, 2.2, 1.5));
    // bicycle photo spot (nod to the public "bicycle boy" nickname)
    const bike = new THREE.Group();
    for (const x of [-0.7, 0.7]) {
      bike.add(mk(torus(0.42, 0.06, 8, 24), P.ink, [x, 0.48, 0]));
      bike.add(mk(cyl(0.05, 0.05, 0.1, 8), P.white, [x, 0.48, 0], [Math.PI / 2, 0, 0]));
    }
    bike.add(mk(cyl(0.05, 0.05, 1.5, 8), P.blue, [0, 0.75, 0], [0, 0, Math.PI / 2 - 0.2]));
    bike.add(mk(cyl(0.05, 0.05, 0.7, 8), P.blue, [0.55, 0.85, 0], [0, 0, 0.5]));
    bike.add(mk(cyl(0.05, 0.05, 0.7, 8), P.blue, [-0.25, 0.8, 0], [0, 0, -0.3]));
    bike.add(mk(rbox(0.35, 0.08, 0.18, 0.03), P.pink, [-0.35, 1.15, 0]));
    bike.add(mk(rbox(0.08, 0.08, 0.6, 0.03), P.white, [0.72, 1.2, 0]));
    bike.add(mk(rbox(0.4, 0.3, 0.3, 0.05), P.butter, [0.95, 1.05, 0]));
    bike.add(mk(sphere(0.12, 8, 6), P.strawberry, [0.95, 1.25, 0]));
    bike.position.set(-7.6, 0, 6.8);
    bike.rotation.y = 0.35;
    this.add(bike, 'box');
    const photo = sign('📸 Photo spot', 1.6, 0.45, { bg: '#FFFFFF', border: '#FFB3C1' });
    photo.position.set(-7.6, 2, 7.4);
    this.scene.add(photo);

    this.ambientParticles('petals', { x: 30, z: 22, y: 7 }, 70);
    // clouds
    for (let i = 0; i < 5; i++) {
      const c = sheepCloud(1 + Math.random() * 0.5);
      c.position.set(-16 + i * 8, 8 + Math.random() * 3, -12 - Math.random() * 4);
      this.scene.add(c);
      this.clouds.push(c);
    }
    // Bori the puppy
    this.dog = new Dog(1);
    this.dog.root.position.set(4.8, 0, 5.2);
    this.dog.root.rotation.y = -0.6;
    this.dog.mode = 'sit';
    this.scene.add(this.dog.root);
    this.colliders.push(circle(4.8, 5.2, 0.5));

    await Promise.all(loads);
    this.farScenery(schoolModel);
    doorDefs.forEach(([id, , label], i) => {
      this.door(id, 'default', new THREE.Vector3(doorXs[i], 0, doorZ), `Enter the ${label}`, 1.5);
      this.spawns[id] = { x: doorXs[i], z: doorZ + 0.7, rot: 0 };
    });
    this.spawns.default = { x: 0, z: 4.6, rot: Math.PI };
    this.spawns.map = { x: 0, z: 5, rot: Math.PI };
    this.spawns.dogchase = { x: 3.6, z: 4.4, rot: Math.PI };
    this.spawnNpcs({ hamssi: [2.6, -3.4, 0.3], dambi: [-5.6, 3.9, 0.6] });

    const game = this.game;
    this.interact({
      id: 'bori', pos: new THREE.Vector3(4.8, 0, 5.2), radius: 1.6, label: '🐶 Pet Bori', height: 1.6,
      onInteract: () => this.boriIntro(),
    });
    this.interact({
      id: 'bike', pos: new THREE.Vector3(-7.6, 0, 6.8), radius: 1.8, label: '📸 Take a photo with the bicycle', height: 2.2,
      onInteract: async () => {
        const p = game.player.root.position;
        game.setFacing(0.2);
        game.player.play('pose', { loop: true });
        game.cam.override = { pos: new THREE.Vector3(p.x + 0.5, 1.9, p.z + 4.2), look: new THREE.Vector3(p.x - 0.2, 1.1, p.z), k: 4, fov: 38 };
        await wait(1100);
        await game.photo('Schoolyard bicycle');
        game.player.stop();
        game.cam.override = null;
        if (!game.save.flag('photoBike', false)) { game.save.setFlag('photoBike', true); game.addHearts(5, p); }
      },
    });
    const st = stickerPickup('🌷');
    st.position.set(5.5, 1.2, 5.6);
    this.collectible('sticker', 'stk_yard', st, 'Tulip sticker', '🌷');
    const pl = sheepPlush(1);
    pl.position.set(10.9, 0.1, 5.4);
    this.collectible('plush', 'plush_yard', pl, 'a sheep plushie behind the tree', '🐑');
  }

  /** Hills + trees ringing the island; the ones hidden behind the tall school model are skipped. */
  private farScenery(schoolModel: boolean) {
    const far = new THREE.Group();
    const hillCols = [0xb9e6b0, 0xa6dca8, 0xc8efb8, 0xd7f0c0];
    const hidden = (x: number, z: number) => schoolModel && z < -20 && Math.abs(x) < 17;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = 34 + (i % 3) * 5;
      const hx = Math.cos(a) * r, hz = Math.sin(a) * r - 6;
      if (!hidden(hx, hz)) far.add(mk(sphere(9 + (i % 4) * 2, 14, 9), hillCols[i % 4], [hx, -5 - (i % 2) * 2, hz], [0, 0, 0], [1.4, 0.55, 1]));
      const tx = Math.cos(a + 0.2) * (r - 6), tz = Math.sin(a + 0.2) * (r - 6) - 6;
      if (!hidden(tx, tz)) far.add(tree(1.6 + (i % 3) * 0.3, P.mintDeep, P.woodDeep, i % 2 === 0).translateX(tx).translateY(-0.5).translateZ(tz));
    }
    this.statics.add(far);
  }

  /** The original procedural building (used if the Higgsfield model fails to load). */
  private proceduralSchool(doorDefs: [SceneId, number, string][], doorXs: number[]) {
    const bld = new THREE.Group();
    bld.add(mk(rbox(24, 5.2, 2.4, 0.3), P.cream, [0, 2.6, -7.6]));
    bld.add(mk(rbox(24.6, 0.4, 2.8, 0.15), P.strawberry, [0, 5.3, -7.6]));
    bld.add(mk(rbox(24, 0.3, 2.5, 0.1), P.white, [0, 0.15, -7.6]));
    for (let x = -10; x <= 10; x += 2.5) {
      if (Math.abs(x) < 1) continue;
      bld.add(mk(rbox(1.5, 0.28, 0.35, 0.08), P.woodDeep, [x, 3.2, -6.2]));
      for (let k = 0; k < 5; k++) bld.add(mk(sphere(0.11, 8, 6), [P.pink, P.butter, P.white, P.purple, P.strawberry][(k + Math.round(x)) % 5], [x - 0.56 + k * 0.28, 3.4, -6.1]));
      bld.add(mk(rbox(1.4, 1.1, 0.2, 0.12), P.white, [x, 3.9, -6.35]));
      bld.add(mk(rbox(1.15, 0.85, 0.1, 0.08), toonSky(), [x, 3.9, -6.25]));
    }
    bld.add(mk(rbox(3.4, 2.4, 2.4, 0.3), P.cream, [0, 6.6, -7.8]));
    bld.add(mk(cone(2.6, 1.8, 4), P.strawberry, [0, 8.7, -7.8], [0, Math.PI / 4, 0], [1, 1, 0.75]));
    bld.add(mk(cyl(0.9, 0.9, 0.15, 28), P.white, [0, 6.6, -6.55], [Math.PI / 2, 0, 0]));
    bld.add(mk(rbox(0.08, 0.6, 0.05, 0.02), P.ink, [0, 6.8, -6.45]));
    bld.add(mk(rbox(0.45, 0.08, 0.05, 0.02), P.ink, [0.2, 6.6, -6.45]));
    for (const [i, [, c, label]] of doorDefs.entries()) {
      const d = door(c, label);
      d.position.set(doorXs[i], 0, -6.3);
      bld.add(d);
      const aw = awning(2.2, c, P.white);
      aw.position.set(doorXs[i], 3.25, -6.4);
      bld.add(aw);
    }
    this.add(bld);
    const banner = sign('♡ Sweet Reply High ♡', 5, 0.9, { bg: '#FFFFFF', border: '#FF9DB3' });
    banner.position.set(0, 4.95, -6.35);
    this.scene.add(banner);
  }

  // ---------------- playground: swing + slide ----------------
  private swingPivot = new THREE.Group();
  private swingT = -1;
  private buildPlayground() {
    const g = this.game;
    // swing set (right)
    const sx = 7.6, sz = -0.6;
    const frame = new THREE.Group();
    for (const dx of [-1.1, 1.1]) {
      frame.add(mk(cyl(0.07, 0.07, 2.9, 8), P.blueDeep, [dx - 0.35, 1.35, 0], [0, 0, -0.25]));
      frame.add(mk(cyl(0.07, 0.07, 2.9, 8), P.blueDeep, [dx + 0.35, 1.35, 0], [0, 0, 0.25]));
    }
    frame.add(mk(cyl(0.08, 0.08, 2.6, 10), P.pinkDeep, [0, 2.72, 0], [0, 0, Math.PI / 2]));
    frame.position.set(sx, 0, sz);
    this.add(frame);
    this.colliders.push(colBox(sx, sz, 2.8, 0.5));
    this.swingPivot.position.set(sx, 2.7, sz);
    for (const dx of [-0.32, 0.32]) this.swingPivot.add(mk(cyl(0.015, 0.015, 2.1, 5), P.white, [dx, -1.05, 0]));
    this.swingPivot.add(mk(rbox(0.8, 0.08, 0.36, 0.04), P.pink, [0, -2.1, 0]));
    this.swingPivot.traverse((o) => (o.userData.dynamic = true));
    this.scene.add(this.swingPivot);
    this.interact({
      id: 'swing', pos: new THREE.Vector3(sx, 0, sz + 1.1), radius: 1.5, label: '🎠 Ride the swing', height: 2.6,
      onInteract: async () => {
        this.swingT = 0;
        g.player.play('sit', { loop: true });
        g.audio.sfx('whoosh');
        await wait(5200);
        this.swingT = -1;
        this.swingPivot.rotation.x = 0;
        g.player.stop();
        g.player.root.position.set(sx, 0, sz + 1.2);
        g.player.play('happy');
        g.fx.burst(g.player.root.position.clone().setY(1.5), 'hearts', 6);
        if (!g.save.flag('rodeSwing', false)) { g.save.setFlag('rodeSwing', true); g.addHearts(3, g.player.root.position); }
      },
    });
    // slide (left)
    const lx = -7.6, lz = -0.6;
    const sl = new THREE.Group();
    sl.add(mk(rbox(0.9, 0.1, 0.9, 0.04), P.butter, [0, 1.6, 0]));
    for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) sl.add(mk(cyl(0.05, 0.05, 1.6, 8), P.blueDeep, [x, 0.8, z]));
    for (let k = 0; k < 5; k++) sl.add(mk(rbox(0.7, 0.05, 0.16, 0.02), P.white, [0, 0.25 + k * 0.3, -0.62 - k * 0.02]));
    sl.add(mk(rbox(0.05, 1.8, 0.05, 0.02), P.blueDeep, [-0.36, 0.9, -0.66]));
    sl.add(mk(rbox(0.05, 1.8, 0.05, 0.02), P.blueDeep, [0.36, 0.9, -0.66]));
    sl.add(mk(rbox(0.8, 0.08, 2.3, 0.04), P.pink, [0, 0.85, 1.4], [-0.62, 0, 0]));
    sl.add(mk(rbox(0.06, 0.2, 2.3, 0.03), P.pinkDeep, [-0.4, 0.95, 1.4], [-0.62, 0, 0]));
    sl.add(mk(rbox(0.06, 0.2, 2.3, 0.03), P.pinkDeep, [0.4, 0.95, 1.4], [-0.62, 0, 0]));
    sl.position.set(lx, 0, lz);
    this.add(sl);
    this.colliders.push(colBox(lx, lz + 0.6, 1.1, 2.6));
    this.interact({
      id: 'slide', pos: new THREE.Vector3(lx, 0, lz - 1.3), radius: 1.4, label: '🛝 Go down the slide', height: 2.6,
      onInteract: async () => {
        const p = g.player;
        p.root.position.set(lx, 1.65, lz);
        g.setFacing(0);
        p.play('sit', { loop: true });
        await wait(350);
        g.audio.sfx('whoosh');
        const t0 = performance.now();
        await new Promise<void>((res) => {
          const step = () => {
            const k = Math.min(1, (performance.now() - t0) / 900);
            p.root.position.set(lx, 1.65 * (1 - k) + 0.0 * k, lz + 0.3 + 2.4 * k);
            if (k < 1) requestAnimationFrame(step); else res();
          };
          step();
        });
        p.root.position.y = 0;
        p.play('happy');
        g.ui.react(p.root.position.clone().setY(2.6), 'Wheee~! ♡');
        g.fx.burst(p.root.position.clone().setY(0.6), 'sparkles', 10);
        if (!g.save.flag('rodeSlide', false)) { g.save.setFlag('rodeSlide', true); g.addHearts(3, p.root.position); }
      },
    });
  }

  // ---------------- butterflies ----------------
  private butterflies() {
    const wingGeo = new THREE.PlaneGeometry(0.22, 0.18);
    const cols = [0xffb3c8, 0xb2d9ff, 0xfff1a8, 0xd9c2ff, 0xffffff];
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide });
      const l = new THREE.Mesh(wingGeo, mat); l.position.x = -0.1;
      const r = new THREE.Mesh(wingGeo, mat); r.position.x = 0.1;
      const lw = new THREE.Group(); lw.add(l);
      const rw = new THREE.Group(); rw.add(r);
      b.add(lw, rw);
      b.traverse((o) => { o.userData.dynamic = true; o.userData.noShadow = true; });
      this.scene.add(b);
      const cx = (Math.random() - 0.5) * 20, cz = Math.random() * 8 - 1, rad = 1 + Math.random() * 1.5, sp = 0.4 + Math.random() * 0.4, ph = Math.random() * 6;
      this.onUpdate((_dt, t) => {
        const a = t * sp + ph;
        b.position.set(cx + Math.cos(a) * rad, 1 + Math.sin(a * 2.3) * 0.35 + 0.3, cz + Math.sin(a) * rad);
        b.rotation.y = -a;
        const f = Math.sin(t * 18 + ph) * 1.1;
        lw.rotation.y = f; rw.rotation.y = -f;
      });
    }
  }

  private async boriIntro() {
    const g = this.game;
    const p = g.player;
    this.dog.mode = 'happy';
    g.audio.sfx('woof');
    g.ui.react(this.dog.root.position.clone().setY(1.6), 'Woof! ♡', 'big');
    await wait(500);
    const first = !g.save.data.minigames.dogchase?.plays;
    const c = await g.ui.dialogue('Bori', first
      ? ['Woof woof! (Bori is wagging so fast!)', 'Bori wants to play chase… with Hamin! 🐶💨']
      : ['Woof! (Bori looks ready for another round!)'], { portrait: '🐶', choices: ['Play Dog Chase!', 'Just pet Bori'] });
    if (c === 0) {
      p.play('surprised');
      g.ui.react(p.root.position.clone().setY(2.6), '!', 'plain');
      g.audio.sfx('woof');
      await wait(700);
      p.play('scared', { loop: true });
      await wait(500);
      g.goto('dogchase', 'default', { text: 'Bori is coming!!', icon: '🐶' });
    } else {
      p.play('heart');
      g.fx.burst(this.dog.root.position.clone().setY(1), 'hearts', 8);
      g.audio.sfx('squeak');
      await wait(1200);
      this.dog.mode = 'sit';
      if (!g.save.flag('petBori', false)) { g.save.setFlag('petBori', true); g.addHearts(3, this.dog.root.position); }
    }
  }

  update(dt: number) {
    this.dog.update(dt);
    if (this.swingT >= 0) {
      this.swingT += dt;
      const a = Math.sin(this.swingT * 2.6) * 0.55 * Math.min(1, this.swingT);
      this.swingPivot.rotation.x = a;
      const p = this.game.player.root;
      p.position.set(this.swingPivot.position.x, 2.7 - Math.cos(a) * 2.1 - 0.55 + 0.16, this.swingPivot.position.z + Math.sin(a) * 2.1);
      p.rotation.y = 0;
    }
    const pp = this.game.player.root.position;
    const dp = this.dog.root.position;
    const want = Math.atan2(pp.x - dp.x, pp.z - dp.z);
    if (pp.distanceTo(dp) < 4) this.dog.root.rotation.y += (want - this.dog.root.rotation.y) * Math.min(1, dt * 3);
    for (const c of this.clouds) {
      c.position.x += dt * 0.35;
      if (c.position.x > 22) c.position.x = -22;
    }
  }
}

let skyMat: THREE.MeshStandardMaterial | null = null;
function toonSky() {
  if (!skyMat) {
    skyMat = new THREE.MeshStandardMaterial({ color: 0xcfe7ff, emissive: 0x6688aa, emissiveIntensity: 0.25, roughness: 0.2 });
    skyMat.userData.shared = true;
  }
  return skyMat;
}
