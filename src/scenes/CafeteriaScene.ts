import * as THREE from 'three';
import { GameScene } from './GameScene';
import { P } from '../assets/palette';
import { mk, rbox, cyl, sphere, torus, cone } from '../assets/geo';
import { room, door, windowFrame, plant, sign, poster, sheepPlush, stickerPickup, sheepCushion, floorMark } from '../assets/props';
import { toon } from '../assets/materials';
import { canvasTex, heartPath, roundRect } from '../assets/textures';
import { box as colBox, circle as colCircle, Collider } from '../core/Collision';
import {
  FOOD, bakeGroup, bakedFood, cake, drumstick, dumpling, iceCream, lunchbox, milkCarton, noodleBowl, peach, riceBall, apple, tinySheep,
  preloadSheep, sheepHelper, sheepWalk, SHEEP_FIT,
} from '../assets/food';
import { critter, critterGeometry } from '../assets/landmarks';
import { EatingGame } from '../minigames/EatingGame/EatingGame';

const PI = Math.PI;

// layout (room 12 × 9, back wall at z = −4.5)
const W = 12, D = 9;
const LINE_Z = -2.65; // counters + conveyor
const TOP = 0.84; // conveyor table top
const BELT_Y = 0.9;
const BELT_X0 = -0.9, BELT_X1 = 4.7;
const RING_X = 1.9;
const SEAT = { x: RING_X, z: -3.72, y: 0.32 };
const FLOOR_Y = 0.1; // top of the room floor: Higgsfield props stand on it

/** Sweet Reply High cafeteria: food counter, Chef Mongmong’s kitchen and the Lunch Parade conveyor. */
export default class CafeteriaScene extends GameScene {
  readonly id = 'cafeteria' as const;
  readonly title = 'Cafeteria';
  subtitle = 'Lunch time is the best time ♡';
  music = 'cafe' as const;
  private eat!: EatingGame;
  private beltTex!: THREE.Texture;
  private beltSpeed = 0.35;

  async build() {
    const loads: Promise<unknown>[] = [];
    this.skyArt('sky_day');
    this.light({ dir: [-4, 10, 7], shadowRange: 8 });
    this.bounds = { minX: -W / 2, maxX: W / 2, minZ: -D / 2 + 0.3, maxZ: D / 2 + 0.2 };
    this.cam = { dist: 16, pitch: 0.62, lookY: 1.3, yawRange: 0.6, clamp: { minX: -1.5, maxX: 1.5, minZ: -1, maxZ: 1.2 } };
    const s = this.statics;
    // Higgsfield sheep: the counter helper (sheep_lo) and the Eating Game's belt helper (sheep), built sync later
    loads.push(preloadSheep('sheep_lo'), preloadSheep('sheep'));
    s.add(room({ w: W, d: D, floor: P.cream, wall: P.peach, slab: P.pinkSoft, trim: P.white }));
    this.decorSurfaces();

    // glossy decorative food is collected here and baked into ONE mesh at the end
    const deco = new THREE.Group();
    const place = (f: THREE.Group, x: number, y: number, z: number, ry = 0, sc = 1) => {
      f.position.set(x, y, z);
      f.rotation.y = ry;
      f.scale.setScalar(sc);
      deco.add(f);
      return f;
    };

    // ---------------- kitchen (back wall) ----------------
    const kz = -D / 2 + 0.45;
    // fridge (Higgsfield "kitchen" = mint fridge with sheep magnets; procedural fallback).
    // No own collider: the kitchen strip collider below covers it.
    loads.push(this.prop('kitchen', -5.35, -D / 2 + 0.63, { h: 1.85 }, 0, false, FLOOR_Y).then((m) => {
      if (m) return;
      const fr = new THREE.Group();
      fr.add(mk(rbox(1.0, 2.1, 0.7, 0.12, 1), P.mint, [0, 1.05, 0]));
      fr.add(mk(rbox(0.94, 0.03, 0.02, 0.01, 1), P.mintDeep, [0, 1.35, 0.36]));
      fr.add(mk(rbox(0.06, 0.4, 0.06, 0.03, 1), P.white, [0.36, 1.7, 0.38]));
      fr.add(mk(rbox(0.06, 0.5, 0.06, 0.03, 1), P.white, [0.36, 0.9, 0.38]));
      fr.add(mk(sphere(0.07, 8, 6), P.strawberry, [-0.2, 1.75, 0.37], [0, 0, 0], [1, 1, 0.5]));
      fr.add(mk(sphere(0.06, 8, 6), P.butter, [-0.05, 1.6, 0.37], [0, 0, 0], [1, 1, 0.5]));
      fr.position.set(-5.35, 0, kz);
      s.add(fr);
      const mag = tinySheep({ matte: true, hat: false });
      mag.position.set(-5.5, 1.0, kz + 0.33);
      mag.scale.setScalar(0.9);
      s.add(mag);
    }));
    // stove with bubbling pots
    const st = new THREE.Group();
    st.add(mk(rbox(1.6, 0.95, 0.75, 0.1, 1), P.white, [0, 0.475, 0]));
    st.add(mk(rbox(1.5, 0.05, 0.7, 0.02, 1), P.metal, [0, 0.97, 0]));
    for (const x of [-0.4, 0.4]) st.add(mk(torus(0.18, 0.03, 5, 16), P.lavenderDeep, [x, 1.0, 0], [PI / 2, 0, 0]));
    st.add(mk(rbox(1.2, 0.3, 0.04, 0.05, 1), P.pinkSoft, [0, 0.55, 0.37]));
    for (const x of [-0.45, -0.15, 0.15, 0.45]) st.add(mk(cyl(0.035, 0.035, 0.04, 8), P.pinkDeep, [x, 0.82, 0.38], [PI / 2, 0, 0]));
    // big pot + small pan
    st.add(mk(cyl(0.3, 0.26, 0.42, 16), P.lavender, [-0.4, 1.22, 0]));
    st.add(mk(torus(0.3, 0.03, 5, 16), P.white, [-0.4, 1.43, 0], [PI / 2, 0, 0]));
    st.add(mk(cyl(0.29, 0.29, 0.03, 16), P.butter, [-0.4, 1.41, 0]));
    for (const sx of [-1, 1]) st.add(mk(torus(0.06, 0.02, 4, 8, PI), P.white, [-0.4 + sx * 0.32, 1.35, 0], [0, PI / 2, 0]));
    st.add(mk(cyl(0.22, 0.2, 0.12, 14), P.pinkDeep, [0.4, 1.08, 0]));
    st.add(mk(cyl(0.025, 0.025, 0.4, 6), P.pinkDeep, [0.75, 1.1, 0.05], [0, 0, PI / 2 - 0.15]));
    st.position.set(-2.9, 0, kz);
    s.add(st);
    // sink counter
    const sk = new THREE.Group();
    sk.add(mk(rbox(1.3, 0.95, 0.75, 0.1, 1), P.blueSoft, [0, 0.475, 0]));
    sk.add(mk(rbox(1.3, 0.06, 0.75, 0.03, 1), P.white, [0, 0.97, 0]));
    sk.add(mk(cyl(0.03, 0.03, 0.35, 6), P.metal, [0.3, 1.15, -0.25]));
    sk.add(mk(cyl(0.025, 0.025, 0.25, 6), P.metal, [0.3, 1.32, -0.14], [PI / 2, 0, 0]));
    for (let i = 0; i < 4; i++) sk.add(mk(cyl(0.16, 0.11, 0.05, 14), [P.pink, P.blue, P.butter, P.mint][i], [-0.3, 1.03 + i * 0.05, 0.05]));
    sk.position.set(-1.35, 0, kz);
    s.add(sk);
    // wall shelf with bowls, cups & a sheep
    s.add(mk(rbox(3.4, 0.08, 0.36, 0.03, 1), P.white, [-3.3, 2.0, -D / 2 + 0.2]));
    for (let i = 0; i < 6; i++) {
      const x = -4.7 + i * 0.5;
      if (i % 2) s.add(mk(cyl(0.16, 0.1, 0.14, 12), [P.pink, P.blue, P.mint][i % 3], [x, 2.11, -D / 2 + 0.2]));
      else {
        s.add(mk(cyl(0.08, 0.07, 0.16, 10), [P.butter, P.lavender, P.peachDeep][i % 3], [x, 2.12, -D / 2 + 0.2]));
        s.add(mk(torus(0.045, 0.015, 4, 8), [P.butter, P.lavender, P.peachDeep][i % 3], [x + 0.09, 2.13, -D / 2 + 0.2]));
      }
    }
    // hanging ladle & spoon
    for (const [x, c] of [[-2.2, P.pinkDeep], [-2.0, P.blueDeep]] as const) {
      s.add(mk(cyl(0.015, 0.015, 0.45, 5), c, [x, 1.65, -D / 2 + 0.08]));
      s.add(mk(sphere(0.06, 8, 6), c, [x, 1.4, -D / 2 + 0.1], [0, 0, 0], [1, 0.6, 1]));
    }
    this.kitchenCol = colBox(0, -D / 2 + 0.75, W, 1.5);
    this.colliders.push(this.kitchenCol);

    // ---------------- food counter (left) ----------------
    const fcW = 5.1, fcX = -W / 2 + fcW / 2;
    const fc = new THREE.Group();
    fc.add(mk(rbox(fcW, 0.8, 0.7, 0.1, 1), P.pink, [0, 0.4, 0]));
    fc.add(mk(rbox(fcW + 0.1, 0.08, 0.8, 0.04, 1), P.cream, [0, 0.83, 0]));
    for (let i = 0; i < 6; i++) fc.add(mk(rbox(0.36, 0.72, 0.04, 0.06, 1), P.white, [-fcW / 2 + 0.5 + i * 0.84, 0.42, 0.36]));
    for (let i = 0; i < 6; i++) fc.add(mk(sphere(0.07, 8, 6), P.strawberry, [-fcW / 2 + 0.5 + i * 0.84, 0.42, 0.38], [0, 0, 0], [1, 1, 0.4]));
    // serving trays on the counter
    for (const [x, c] of [[-2.1, P.mint], [-1.2, P.blue], [-0.3, P.lavender], [0.6, P.butter], [1.5, P.pinkSoft]] as const)
      fc.add(mk(rbox(0.8, 0.05, 0.55, 0.02, 1), c, [x, 0.89, -0.08]));
    fc.position.set(fcX, 0, LINE_Z);
    this.add(fc, 'box');
    const counterFoods = [dumpling, riceBall, drumstick, noodleBowl, lunchbox];
    counterFoods.forEach((b, i) => place(b(), fcX - 2.1 + i * 0.9, 0.915, LINE_Z - 0.08, (i - 2) * 0.12, 1.15));
    place(dumpling(), fcX - 1.95, 0.915, LINE_Z + 0.04, 0.3, 0.85);
    place(riceBall(), fcX - 1.1, 0.915, LINE_Z + 0.04, -0.3, 0.8);
    // menu board
    const menu = poster(3.3, 1.5, drawMenu, 512);
    menu.position.set(fcX + 0.4, 2.85, -D / 2 + 0.06);
    this.scene.add(menu);
    s.add(mk(rbox(3.45, 1.65, 0.06, 0.05, 1), P.strawberry, [fcX + 0.4, 2.85, -D / 2 + 0.01]));

    // ---------------- Lunch Parade conveyor ----------------
    const cw = BELT_X1 - BELT_X0, cx = (BELT_X0 + BELT_X1) / 2;
    const cv = new THREE.Group();
    cv.add(mk(rbox(cw, TOP - 0.06, 0.72, 0.1, 1), P.peach, [0, (TOP - 0.06) / 2, 0]));
    cv.add(mk(rbox(cw + 0.08, 0.08, 0.8, 0.04, 1), P.white, [0, TOP - 0.02, 0]));
    for (let i = 0; i < 7; i++) cv.add(mk(sphere(0.09, 10, 8), [P.strawberry, P.butter, P.mintDeep, P.blueDeep][i % 4], [-cw / 2 + 0.45 + i * ((cw - 0.9) / 6), 0.45, 0.37], [0, 0, 0], [1, 1, 0.4]));
    // belt rails & rollers
    for (const sz of [-1, 1]) cv.add(mk(rbox(cw, 0.07, 0.07, 0.03, 1), P.strawberry, [0, BELT_Y + 0.025, sz * 0.33]));
    for (const sx of [-1, 1]) cv.add(mk(cyl(0.07, 0.07, 0.62, 12), P.metal, [sx * (cw / 2 - 0.02), BELT_Y - 0.03, 0], [PI / 2, 0, 0]));
    cv.position.set(cx, 0, LINE_Z);
    this.add(cv, 'box');
    // belt surface (scrolling texture)
    this.beltTex = canvasTex(128, 64, (g) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 128, 64);
      g.fillStyle = '#ffd6df';
      for (let i = 0; i < 2; i++) {
        g.beginPath();
        g.moveTo(i * 64, 0); g.lineTo(i * 64 + 22, 0); g.lineTo(i * 64 + 44, 32); g.lineTo(i * 64 + 22, 64); g.lineTo(i * 64, 64); g.lineTo(i * 64 + 22, 32);
        g.closePath(); g.fill();
      }
      g.fillStyle = '#ffb3c4';
      heartPath(g, 52, 22, 18);
      g.fill();
      heartPath(g, 116, 22, 18);
      g.fill();
    });
    this.beltTex.wrapS = THREE.RepeatWrapping;
    this.beltTex.repeat.set(cw / 0.6, 1);
    const belt = new THREE.Mesh(new THREE.PlaneGeometry(cw, 0.6), new THREE.MeshStandardMaterial({ map: this.beltTex, roughness: 0.55 }));
    belt.rotation.x = -PI / 2;
    belt.position.set(cx, BELT_Y, LINE_Z);
    belt.receiveShadow = true;
    this.scene.add(belt);
    // kitchen hatch: striped arch with a little noren curtain where the food comes out
    const hatch = new THREE.Group();
    hatch.add(mk(torus(0.5, 0.09, 8, 20, PI), P.strawberry, [0, 0, 0], [0, PI / 2, 0]));
    hatch.add(mk(torus(0.5, 0.095, 8, 20, PI / 3), P.white, [0, 0, 0], [0, PI / 2, PI / 3]));
    for (const sz of [-1, 1]) hatch.add(mk(cyl(0.09, 0.09, 0.1, 10), P.strawberry, [0, 0.0, sz * 0.5]));
    for (let i = 0; i < 3; i++) hatch.add(mk(rbox(0.03, 0.2, 0.28, 0.012, 1), i === 1 ? P.white : P.pinkDeep, [0, 0.36, -0.29 + i * 0.29]));
    hatch.add(mk(cyl(0.015, 0.015, 0.9, 5), P.woodDeep, [0, 0.47, 0], [PI / 2, 0, 0]));
    hatch.position.set(BELT_X0 + 0.05, BELT_Y, LINE_Z);
    s.add(hatch);
    // leftover basket at the end (a sheep waits for the leftovers)
    const bk = new THREE.Group();
    bk.add(mk(cyl(0.42, 0.32, 0.55, 16), P.butter, [0, 0.28, 0]));
    bk.add(mk(torus(0.42, 0.05, 6, 18), P.butterDeep, [0, 0.56, 0], [PI / 2, 0, 0]));
    for (let i = 0; i < 3; i++) bk.add(mk(torus(0.37 + i * 0.02, 0.018, 4, 18), P.woodDeep, [0, 0.14 + i * 0.14, 0], [PI / 2, 0, 0]));
    bk.position.set(BELT_X1 + 0.62, 0, LINE_Z);
    this.add(bk, 0.45);
    // Hamin’s tall stool behind the belt
    const stl = new THREE.Group();
    stl.add(mk(cyl(0.3, 0.3, 0.12, 18), P.strawberry, [0, 0.78, 0]));
    stl.add(mk(torus(0.29, 0.04, 5, 18), P.white, [0, 0.78, 0], [PI / 2, 0, 0]));
    stl.add(mk(cyl(0.05, 0.08, 0.72, 8), P.metal, [0, 0.36, 0]));
    stl.add(mk(torus(0.18, 0.025, 4, 14), P.metal, [0, 0.3, 0], [PI / 2, 0, 0]));
    stl.add(mk(cyl(0.25, 0.27, 0.04, 16), P.metal, [0, 0.02, 0]));
    stl.position.set(SEAT.x, 0, SEAT.z);
    s.add(stl);
    // parade sign above
    const ps = sign('🍱 Lunch Parade ♡', 2.6, 0.62, { bg: '#FFFFFF', border: '#FF9DB3' });
    ps.position.set(RING_X, 2.95, -D / 2 + 0.03);
    this.scene.add(ps);
    // bunting across the back wall
    s.add(mk(cyl(0.012, 0.012, W - 0.4, 4), P.white, [0, 3.2, -D / 2 + 0.06], [0, 0, PI / 2]));
    for (let i = 0; i < 19; i++) {
      const x = -W / 2 + 0.5 + i * ((W - 1) / 18);
      s.add(mk(cone(0.16, 0.3, 3), [P.pinkDeep, P.butter, P.mintDeep, P.blue, P.white][i % 5], [x, 3.03, -D / 2 + 0.07], [PI, PI / 6, 0], [1, 1, 0.25]));
    }
    // window on the back wall behind Hamin
    const bw = windowFrame(1.6, 1.3, P.strawberry);
    bw.position.set(4.5, 2.0, -D / 2 + 0.1);
    s.add(bw);

    // idle belt parade (a few foods riding round while nobody is eating)
    const parade: THREE.Mesh[] = [];
    ['cake', 'milk', 'dumpling', 'icecream'].forEach((id, i) => {
      const m = bakedFood(FOOD.find((f) => f.id === id)!);
      m.position.set(BELT_X0 + 0.4 + i * 1.4, BELT_Y, LINE_Z);
      this.scene.add(m);
      parade.push(m);
    });
    this.onUpdate((dt) => {
      this.beltTex.offset.x -= (this.beltSpeed * dt) / 0.6;
      if (this.eat.active) return;
      for (const m of parade) {
        m.position.x += this.beltSpeed * dt;
        if (m.position.x > BELT_X1 - 0.25) m.position.x = BELT_X0 + 0.1;
        const a = Math.min(1, (m.position.x - BELT_X0) * 3, (BELT_X1 - m.position.x) * 3);
        m.scale.setScalar(Math.max(0.01, a));
      }
    });

    // ---------------- dining area ----------------
    // long table with trays
    const lt = new THREE.Group();
    lt.add(mk(rbox(3.4, 0.12, 1.2, 0.06, 1), P.white, [0, 0.78, 0]));
    lt.add(mk(rbox(3.42, 0.02, 0.4, 0.01, 1), P.strawberry, [0, 0.85, 0]));
    for (const sx of [-1, 1]) lt.add(mk(rbox(0.14, 0.72, 0.8, 0.05, 1), P.metal, [sx * 1.4, 0.38, 0]));
    lt.position.set(-2.9, 0, 0.9);
    this.add(lt, 'box');
    for (const x of [-4.0, -2.9, -1.8]) for (const sz of [-1, 1]) {
      const sc = new THREE.Group();
      sc.add(mk(cyl(0.26, 0.26, 0.1, 16), sz > 0 ? P.blue : P.pink, [0, 0.5, 0]));
      sc.add(mk(cyl(0.05, 0.06, 0.46, 8), P.metal, [0, 0.23, 0]));
      sc.position.set(x, 0, 0.9 + sz * 0.95);
      this.add(sc, 0.3);
    }
    const tray = (x: number, z: number, c: number) => {
      const t = new THREE.Group();
      t.add(mk(rbox(0.78, 0.05, 0.52, 0.02, 1), c, [0, 0.885, 0]));
      t.add(mk(cyl(0.13, 0.13, 0.02, 14), P.white, [0.18, 0.92, 0.02]));
      t.add(mk(cyl(0.02, 0.02, 0.3, 5), P.metal, [-0.3, 0.925, 0.0], [PI / 2, 0, 0]));
      t.position.set(x, 0, z);
      s.add(t);
    };
    tray(-3.95, 0.62, P.mint);
    tray(-2.2, 1.2, P.lavender);
    tray(-2.9, 0.58, P.butter);
    place(riceBall(), -3.77, 0.93, 0.64, 0.3, 0.8);
    place(milkCarton(), -4.2, 0.91, 0.58, -0.2, 0.75);
    place(noodleBowl(), -2.0, 0.91, 1.22, PI, 0.85);
    place(apple(), -2.45, 0.91, 1.2, 0, 0.7);
    place(drumstick(), -2.72, 0.93, 0.6, 0.4, 0.8);
    place(peach(), -3.1, 0.91, 0.56, 0, 0.7);
    // round table with sheep cushions (Higgsfield cafe table; procedural table as fallback)
    const RT = { x: 2.4, z: 1.5 };
    loads.push(this.prop('cafe_table', RT.x, RT.z, { h: 0.85 }, 0, 0.62, FLOOR_Y).then((m) => {
      let top = 0.83, ring = 1.35;
      if (m) {
        top = new THREE.Box3().setFromObject(m).max.y;
        ring = 1.2; // the model table is a little smaller → pull the cushions in
      } else {
        const rt = new THREE.Group();
        rt.add(mk(cyl(0.85, 0.85, 0.1, 24), P.white, [0, 0.78, 0]));
        rt.add(mk(torus(0.85, 0.05, 5, 24), P.pinkDeep, [0, 0.78, 0], [PI / 2, 0, 0]));
        rt.add(mk(cyl(0.08, 0.1, 0.75, 10), P.metal, [0, 0.38, 0]));
        rt.add(mk(cyl(0.4, 0.42, 0.05, 16), P.metal, [0, 0.03, 0]));
        rt.add(mk(cyl(0.2, 0.2, 0.03, 16), P.pink, [0, 0.845, 0]));
        rt.position.set(RT.x, 0, RT.z);
        this.add(rt, 0.9);
      }
      for (const a of [0.5, 2.6, 4.4]) {
        const cu = sheepCushion();
        cu.position.set(RT.x + Math.sin(a) * ring, 0.05, RT.z + Math.cos(a) * ring);
        cu.rotation.y = a + PI;
        this.add(cu, 0.4);
      }
      if (m) {
        place(cake(), 2.35, top, 1.45, 0.3, 0.95);
        place(iceCream(), 2.75, top, 1.3, -0.3, 0.8);
        place(milkCarton(), 2.02, top, 1.38, 0.4, 0.7);
      } else {
        place(cake(), 2.35, 0.86, 1.45, 0.3, 1);
        place(iceCream(), 2.9, 0.83, 1.2, -0.3, 0.8);
        place(milkCarton(), 1.85, 0.83, 1.35, 0.4, 0.7);
      }
    }));

    // plants & windows
    this.add(plant(P.strawberry, P.mintDeep, 1.1).translateX(-5.35).translateZ(-1.55), 0.4);
    this.add(plant(P.blue, P.mintDeep).translateX(5.4).translateZ(3.9), 0.4);
    this.add(plant(P.butterDeep, P.mintDeep, 0.9).translateX(5.45).translateZ(-1.6), 0.4);
    for (const z of [0.2, 2.6]) {
      const wf = windowFrame(1.8, 1.5, P.strawberry);
      wf.position.set(W / 2 - 0.02, 2, z);
      wf.rotation.y = -PI / 2;
      this.add(wf);
    }
    // decor sheep: on the shelf, in the leftover basket and a big one by the window (Higgsfield models)
    loads.push(this.decorSheep());

    // door to schoolyard on the left wall
    const dr = door(P.strawberry, '◂ Schoolyard');
    dr.position.set(-W / 2 - 0.05, 0, 3.2);
    dr.rotation.y = PI / 2;
    this.add(dr);
    this.door('yard', 'cafeteria', new THREE.Vector3(-W / 2 + 0.6, 0, 3.2), 'Back to the Schoolyard', 1.4);

    // landmark props (the cafe-table food is placed once the table has loaded) must be in before baking
    await Promise.all(loads);

    // bake glossy decor food into one draw call
    const baked = bakeGroup(deco);
    baked.castShadow = true;
    baked.receiveShadow = true;
    this.scene.add(baked);

    this.spawns = {
      default: { x: -4.8, z: 3.2, rot: PI / 2 },
      map: { x: -4.8, z: 3.2, rot: PI / 2 },
    };
    this.spawnNpcs({ mongmong: [-2.15, -3.35, 0.15], yumi: [4.2, 2.3, -1.9] });

    // little kitchen helper sheep pottering along the food counter (Higgsfield sheep_lo, preloaded above;
    // procedural sheep if the model failed). The model has no legs → sheepWalk waddles & hops it instead.
    const helper = sheepHelper('sheep_lo');
    helper.scale.setScalar(1.3);
    helper.position.set(-3.2, 0.87, LINE_Z + 0.3);
    this.scene.add(helper);
    this.onUpdate((_dt, t) => {
      const cyc = t * 0.35;
      const x = -2.6 - (0.5 - 0.5 * Math.cos(cyc * PI * 2)) * 2.2;
      const moving = Math.abs(Math.sin(cyc * PI * 2)) > 0.08;
      helper.position.x = x;
      helper.rotation.y = Math.sin(cyc * PI * 2) > 0 ? -PI / 2 : PI / 2;
      sheepWalk(helper, t * 12, moving, t);
    });

    // steam puffs from the big pot
    const puffs: THREE.Mesh[] = [];
    const steamMat = toon(0xffffff, { emissive: 0x333333 });
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(sphere(0.12, 8, 6), steamMat);
      p.userData.noShadow = true;
      this.scene.add(p);
      puffs.push(p);
    }
    this.onUpdate((_dt, t) => {
      puffs.forEach((p, i) => {
        const k = (t * 0.45 + i / 3) % 1;
        p.position.set(-3.3 + Math.sin(k * 6 + i) * 0.08, 1.5 + k * 0.9, kz);
        p.scale.setScalar(Math.sin(k * PI) * (0.7 + k * 0.8));
      });
    });

    // ---------------- the Eating Game ----------------
    this.eat = new EatingGame(this.game, this.scene, {
      beltY: BELT_Y, beltZ: LINE_Z, x0: BELT_X0 + 0.05, x1: BELT_X1 - 0.1, ringX: RING_X,
      seat: SEAT,
      exit: { x: RING_X, z: -1.75, rot: PI },
      setBelt: (v) => (this.beltSpeed = v),
      onActive: (a) => {
        for (const m of parade) m.visible = !a;
        this.toggleKitchenCollider(a);
      },
    });
    this.onUpdate((dt) => this.eat.update(dt));
    const mark = floorMark(P.strawberry, 0.55, '🍱');
    mark.position.set(RING_X, 0, -1.5);
    this.scene.add(mark);
    this.onUpdate((_dt, t) => mark.scale.setScalar(1 + Math.sin(t * 3) * 0.05));
    this.interact({
      id: 'eating', pos: new THREE.Vector3(RING_X, 0, -1.8), radius: 1.5, label: '🍱 Lunch time! (Eating Game)', height: 2.0,
      onInteract: async () => {
        mark.visible = false;
        try {
          await this.eat.run();
        } finally {
          mark.visible = true;
        }
      },
    });

    // ---------------- collectibles ----------------
    const stk = stickerPickup('🍙');
    stk.position.set(-5.3, 1.0, -0.6);
    this.collectible('sticker', 'stk_cafe', stk, 'Rice Ball sticker', '🍙');
    const pl = sheepPlush(1);
    pl.position.set(5.5, 0.05, -2.3);
    pl.rotation.y = -0.9;
    this.collectible('plush', 'plush_cafe', pl, 'a snacking sheep plushie', '🐑');
  }

  /**
   * Decor sheep as Higgsfield models: all three share ONE InstancedMesh of sheep_lo (1.5k tris each, one draw call).
   * Procedural tinySheep (merged into the statics) if the model fails. Sizes follow the old procedural sheep
   * (≈ 0.42 tall × scale). The big window sheep is the sitting model (sheep_sit) when it loads.
   */
  private async decorSheep() {
    // x, y (surface), z, facing, scale (height = SHEEP_FIT.h × scale)
    const spots: [number, number, number, number, number][] = [
      [-1.88, 2.04, -D / 2 + 0.24, 0.45, 0.95], // wall shelf, turned toward the room (the shelf is only 0.36 deep)
      // peeking out of the leftover basket (beside it there is only a sliver of floor between basket & plant)
      [BELT_X1 + 0.62, 0.34, LINE_Z + 0.03, -0.35, 1.3],
      [5.2, FLOOR_Y, 1.2, -PI / 2 + 0.45, 2.1], // big sheep by the window waiting for lunch, facing the room
    ];
    this.colliders.push(colCircle(5.2, 1.2, 0.5));
    try {
      const { geometry, material } = await critterGeometry('sheep_lo', SHEEP_FIT);
      const im = new THREE.InstancedMesh(geometry, material, spots.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
      spots.forEach(([x, y, z, ry, sc], i) =>
        im.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, ry), new THREE.Vector3(sc, sc, sc))));
      // the big window sheep sits like a plush instead (sheep_sit reads much cuter at that size)
      const sit = await critter('sheep_sit', { h: 0.95 }).catch(() => null);
      if (sit) {
        const [x, y, z, ry] = spots[2];
        sit.position.set(x, y, z);
        sit.rotation.y = ry;
        this.scene.add(sit);
        im.count = 2;
      }
      im.computeBoundingSphere();
      im.castShadow = im.receiveShadow = true;
      this.scene.add(im);
    } catch (e) {
      console.warn('decor sheep model failed, using procedural sheep', e);
      for (const [x, y, z, ry, sc] of spots) {
        const t = tinySheep({ matte: true });
        t.position.set(x, y, z);
        t.rotation.y = ry;
        t.scale.setScalar(sc);
        this.statics.add(t);
      }
    }
  }

  private kitchenCol!: Collider;
  /** The kitchen strip collider would push Hamin off his stool while he eats. */
  private toggleKitchenCollider(off: boolean) {
    const i = this.colliders.indexOf(this.kitchenCol);
    if (off && i >= 0) this.colliders.splice(i, 1);
    else if (!off && i < 0) this.colliders.push(this.kitchenCol);
  }

  /** Tiled floor + strawberry wallpaper as a few textured planes (cheaper than hundreds of tiles). */
  private decorSurfaces() {
    const floorTex = canvasTex(512, 384, (g) => {
      const n = 12, m = 9, s = 512 / n;
      for (let x = 0; x < n; x++) for (let y = 0; y < m; y++) {
        g.fillStyle = (x + y) % 2 ? '#FFF6E8' : '#FFDDE4';
        g.fillRect(x * s, y * (384 / m), s, 384 / m);
      }
      g.fillStyle = 'rgba(255,255,255,.55)';
      for (let x = 0; x < n; x++) for (let y = 0; y < m; y++) if ((x + y) % 2 === 0) {
        g.beginPath();
        g.arc(x * s + s * 0.3, y * (384 / m) + 10, 4, 0, PI * 2);
        g.fill();
      }
    });
    floorTex.anisotropy = 4;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }));
    fl.rotation.x = -PI / 2;
    fl.position.y = 0.102;
    fl.receiveShadow = true;
    fl.userData.noShadow = true;
    this.scene.add(fl);
    const wallTex = canvasTex(256, 256, (g) => {
      g.fillStyle = '#FFE6D8';
      g.fillRect(0, 0, 256, 256);
      g.fillStyle = '#FFF3EA';
      for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 32, 256);
      for (const [x, y] of [[48, 40], [176, 104], [48, 168], [176, 232]] as const) {
        g.fillStyle = '#FF9DB3';
        g.beginPath();
        g.moveTo(x - 9, y - 4);
        g.quadraticCurveTo(x, y - 10, x + 9, y - 4);
        g.quadraticCurveTo(x + 8, y + 10, x, y + 14);
        g.quadraticCurveTo(x - 8, y + 10, x - 9, y - 4);
        g.fill();
        g.fillStyle = '#8FDCBC';
        g.beginPath();
        g.ellipse(x, y - 7, 7, 3, 0, 0, PI * 2);
        g.fill();
      }
    });
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    const wallH = 2.9;
    const mat = (w: number) => {
      const t = wallTex.clone();
      t.needsUpdate = true;
      t.repeat.set(w / 1.2, wallH / 1.2);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 });
    };
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, wallH), mat(W));
    back.position.set(0, 0.34 + wallH / 2, -D / 2 + 0.005);
    back.userData.noShadow = true;
    this.scene.add(back);
    const sideMat = mat(D);
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(D, wallH), sideMat);
      side.position.set(sx * (W / 2 - 0.005), 0.34 + wallH / 2, 0);
      side.rotation.y = -sx * PI / 2;
      side.userData.noShadow = true;
      this.scene.add(side);
    }
    // chair-rail trim over the wallpaper
    for (const sx of [-1, 1]) this.statics.add(mk(rbox(0.05, 0.08, D, 0.02, 1), P.white, [sx * (W / 2 - 0.03), 1.2, 0]));
    this.statics.add(mk(rbox(W, 0.08, 0.05, 0.02, 1), P.white, [0, 1.2, -D / 2 + 0.03]));
  }

  onExit() {
    this.eat?.abort();
  }
}

/** Pastel menu board. */
function drawMenu(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#FFF6E8';
  roundRect(g, 0, 0, w, h, 26);
  g.fill();
  g.strokeStyle = '#FFB3C1';
  g.lineWidth = 6;
  g.setLineDash([12, 9]);
  roundRect(g, 12, 12, w - 24, h - 24, 18);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = '#FF7A93';
  g.font = '900 34px Nunito, sans-serif';
  g.textAlign = 'center';
  g.fillText("♡ Today’s Menu ♡", w / 2, 52);
  const items = ['🥟 Smiley dumplings', '🍜 Noodle bowl', '🍙 Rice ball', '🍗 Crispy drumstick', '🍰 Strawberry cake', '🍓 Strawberry milk'];
  g.font = '700 22px Nunito, sans-serif';
  g.textAlign = 'left';
  g.fillStyle = '#364049';
  items.forEach((t, i) => g.fillText(t, 44 + (i % 2) * (w / 2 - 12), 96 + Math.floor(i / 2) * 38));
  g.fillStyle = '#8A99A8';
  g.font = '700 16px Nunito, sans-serif';
  g.textAlign = 'center';
  g.fillText('made with love by Chef Mongmong 🐑', w / 2, h - 22);
}
