import * as THREE from 'three';
import { GameScene } from './GameScene';
import { P } from '../assets/palette';
import { mk, rbox, cyl, sphere } from '../assets/geo';
import {
  room, door, windowFrame, schoolDesk, chair, shelf, locker, plant, rug, sign, poster, sheepPlush, stickerPickup,
  sheepCushion, bag, lamp, lightShaft, sunPatch,
} from '../assets/props';
import { box as colBox, circle } from '../core/Collision';
import { canvasTex } from '../assets/textures';
import { el } from '../ui/UI';

const DOODLES = [
  (g: CanvasRenderingContext2D) => { sheep(g, 170, 120, 40); g.fillText('Free day ♡', 256, 60); },
  (g: CanvasRenderingContext2D) => { g.fillText('Hamin ♡ was here', 256, 70); heart(g, 256, 150, 60); },
  (g: CanvasRenderingContext2D) => { g.fillText('♪ la la la ♪', 256, 70); sheep(g, 120, 140, 30); sheep(g, 390, 140, 30); },
  (g: CanvasRenderingContext2D) => { g.fillText('Be kind, be sweet', 256, 70); g.fillText('☀ ☁ ☁', 256, 160); },
];
function sheep(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.moveTo(x + Math.cos(a) * s + s * 0.5, y + Math.sin(a) * s * 0.7); g.arc(x + Math.cos(a) * s, y + Math.sin(a) * s * 0.7, s * 0.5, 0, Math.PI * 2); }
  g.stroke();
  g.beginPath(); g.arc(x + s * 1.3, y, s * 0.45, 0, Math.PI * 2); g.stroke();
}
function heart(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.beginPath();
  g.moveTo(x, y + s * 0.3);
  g.bezierCurveTo(x, y - s * 0.2, x - s, y - s * 0.2, x - s * 0.9, y + s * 0.3);
  g.bezierCurveTo(x - s * 0.8, y + s * 0.8, x, y + s, x, y + s * 1.2);
  g.bezierCurveTo(x, y + s, x + s * 0.8, y + s * 0.8, x + s * 0.9, y + s * 0.3);
  g.bezierCurveTo(x + s, y - s * 0.2, x, y - s * 0.2, x, y + s * 0.3);
  g.stroke();
}

/** Vertical slice: Sweet Reply High classroom 2-1. */
export default class ClassroomScene extends GameScene {
  readonly id = 'classroom' as const;
  readonly title = 'Classroom 2-1';
  subtitle = 'Sweet Reply High ♡';
  music = 'school' as const;
  private board!: THREE.Mesh;
  private boardTex!: THREE.CanvasTexture;
  private doodle = 0;

  async build() {
    const W = 12, D = 9;
    const loads: Promise<unknown>[] = [];
    this.skyArt('sky_day');
    this.light({ dir: [-5, 10, 6], shadowRange: 8 });
    this.bounds = { minX: -W / 2, maxX: W / 2, minZ: -D / 2 + 0.3, maxZ: D / 2 + 0.2 };
    this.cam = { dist: 16, pitch: 0.62, lookY: 1.3, yawRange: 0.6, clamp: { minX: -1.5, maxX: 1.5, minZ: -1, maxZ: 1.2 } };
    const s = this.statics;
    s.add(room({ w: W, d: D, floor: P.wood, floor2: P.woodDeep, planks: true, wall: P.butter, wall2: 0xfff1c4, slab: P.pinkSoft }));
    // chalkboard (textured, dynamic)
    s.add(mk(rbox(5.4, 2.1, 0.16, 0.08), P.woodDeep, [0, 2.05, -D / 2 + 0.08]));
    this.boardTex = canvasTex(512, 200, () => {});
    this.board = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.8), new THREE.MeshBasicMaterial({ map: this.boardTex }));
    this.board.position.set(0, 2.05, -D / 2 + 0.17);
    this.scene.add(this.board);
    this.drawBoard();
    s.add(mk(rbox(5, 0.08, 0.25, 0.03), P.white, [0, 1.02, -D / 2 + 0.25]));
    for (const [x, c] of [[-1.5, P.white], [-1.2, P.pink], [1.4, P.blue]] as const) s.add(mk(cyl(0.03, 0.03, 0.22, 6), c, [x, 1.1, -D / 2 + 0.25], [0, 0, Math.PI / 2]));
    const clock = poster(0.7, 0.7, (g, w) => {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 4, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#FF9DB3'; g.lineWidth = 10; g.stroke();
      g.strokeStyle = '#364049'; g.lineWidth = 8; g.lineCap = 'round';
      g.beginPath(); g.moveTo(w / 2, w / 2); g.lineTo(w / 2, w * 0.22); g.moveTo(w / 2, w / 2); g.lineTo(w * 0.7, w / 2); g.stroke();
    }, 128);
    clock.position.set(3.6, 2.9, -D / 2 + 0.02);
    this.scene.add(clock);
    const flag = sign('♡ Class 2-1 ♡', 1.8, 0.5, { bg: '#FFFFFF', border: '#B2D9FF' });
    flag.position.set(-3.7, 2.9, -D / 2 + 0.02);
    this.scene.add(flag);
    // teacher desk (Higgsfield sam_3_3d; procedural fallback)
    loads.push(this.prop('teacher_desk', 0, -2.6, { w: 2.4, h: 1.25 }, 0, false).then((m) => {
      if (m) return;
      const td = new THREE.Group();
      td.add(mk(rbox(2.2, 0.95, 0.9, 0.08), P.woodDeep, [0, 0.47, 0]));
      td.add(mk(rbox(2.3, 0.08, 1, 0.04), P.wood, [0, 0.98, 0]));
      td.add(mk(cyl(0.12, 0.1, 0.25, 12), P.pinkDeep, [0.7, 1.13, 0]));
      for (const c of [P.butter, P.blue, P.pink]) td.add(mk(cyl(0.02, 0.02, 0.3, 6), c, [0.7 + (Math.random() - 0.5) * 0.1, 1.3, 0]));
      td.add(mk(rbox(0.5, 0.12, 0.35, 0.03), P.blue, [-0.5, 1.08, 0]));
      td.position.set(0, 0, -2.6);
      this.scene.add(td);
    }));
    this.colliders.push(colBox(0, -2.6, 2.3, 1));
    // student desks
    const desks: [number, number][] = [];
    for (const x of [-3.4, 0, 3.4]) for (const z of [-0.6, 1.9]) desks.push([x, z]);
    for (const [x, z] of desks) {
      // Higgsfield desk + chair set (sam_3_3d); procedural desk as a fallback
      loads.push(this.prop('desk_set', x, z + 0.32, { d: 1.55 }, Math.PI, false).then((m) => {
        if (m) return;
        const d = schoolDesk(P.wood, P.metal);
        d.position.set(x, 0, z);
        this.scene.add(d);
        const c = chair(P.pinkSoft, P.metal);
        c.position.set(x, 0, z + 0.75);
        c.rotation.y = Math.PI;
        this.scene.add(c);
      }));
      this.colliders.push(colBox(x, z, 1.2, 0.75));
      this.colliders.push(circle(x, z + 0.8, 0.28));
    }
    // desk decorations
    const nb = new THREE.Group();
    nb.add(mk(rbox(0.5, 0.05, 0.36, 0.02), P.pink, [0, 0.88, 0]));
    nb.add(mk(rbox(0.46, 0.02, 0.32, 0.01), P.white, [0, 0.91, 0]));
    nb.position.set(-3.4, 0, -0.6);
    void nb;
    const b1 = bag(P.blue, P.butter);
    b1.position.set(-2.7, 0, -0.1);
    b1.rotation.y = 0.4;
    this.add(b1);
    const b2 = bag(P.pink, P.white);
    b2.position.set(2.7, 0, 2.4);
    this.add(b2);
    // windows on left wall
    for (const z of [-2, 1.4]) {
      const wf = windowFrame(2, 1.6, P.pink);
      wf.position.set(-W / 2 + 0.02, 2, z);
      wf.rotation.y = Math.PI / 2;
      this.add(wf);
    }
    // sunbeams through the windows + warm patches on the floor
    for (const z of [-2, 1.4]) {
      const sh = lightShaft(1.8, 3.4);
      sh.position.set(-W / 2 + 1.3, 1.6, z + 0.2);
      sh.rotation.set(0, Math.PI / 2, -0.55);
      this.addDynamic(sh);
      const pa = sunPatch(2.2, 1.6);
      pa.position.set(-W / 2 + 2.6, 0.115, z + 0.3);
      this.addDynamic(pa);
    }
    // lockers + bookshelf on right / back (Higgsfield; procedural fallback)
    loads.push(this.prop('lockers', W / 2 - 0.4, -2.85, { w: 2.3, h: 1.9 }, -Math.PI / 2, false).then((m) => {
      if (m) return;
      for (let i = 0; i < 3; i++) {
        const l = locker([P.blue, P.pink, P.mint][i]);
        l.position.set(W / 2 - 0.35, 0, -3.6 + i * 0.75);
        l.rotation.y = -Math.PI / 2;
        this.scene.add(l);
      }
    }));
    this.colliders.push(colBox(W / 2 - 0.35, -2.85, 0.7, 2.4));
    loads.push(this.prop('bookshelf', -4.2, -D / 2 + 0.4, { w: 1.7, h: 2.1 }, 0, false).then((m) => {
      if (m) {
        // the generated shelf is empty: line its boards (y .22 / .75 / 1.2) with pastel books
        const books = new THREE.Group();
        const cols = [P.pink, P.blue, P.butter, P.mint, P.lavender, P.pinkDeep, P.white];
        [[0.22, 13], [0.75, 9], [1.2, 11]].forEach(([y, n], row) => {
          let x = -0.56;
          for (let i = 0; i < n && x < 0.5; i++) {
            if ((i + row) % 5 === 3) { x += 0.12; continue; } // little gaps
            const w = 0.07 + ((i * 7 + row) % 3) * 0.015, h = 0.26 + ((i * 5 + row * 3) % 4) * 0.03;
            books.add(mk(rbox(w, h, 0.26, 0.012), cols[(i * 3 + row) % cols.length], [x + w / 2, y + h / 2, 0.02]));
            x += w + 0.012;
          }
        });
        books.position.set(-4.2, 0, -D / 2 + 0.4);
        this.add(books);
        return;
      }
      const sh = shelf(1.8, 1.6);
      sh.position.set(-4.4, 0, -D / 2 + 0.35);
      this.scene.add(sh);
    }));
    this.colliders.push(colBox(-4.2, -D / 2 + 0.4, 1.6, 0.6));
    // wardrobe closet (dress up)
    const closet = new THREE.Group();
    closet.add(mk(rbox(1.4, 2.4, 0.7, 0.1), P.lavender, [0, 1.2, 0]));
    closet.add(mk(rbox(0.62, 2.1, 0.06, 0.05), 0xf2eaff, [-0.33, 1.2, 0.36]));
    closet.add(mk(rbox(0.62, 2.1, 0.06, 0.05), 0xf2eaff, [0.33, 1.2, 0.36]));
    closet.add(mk(sphere(0.06, 8, 6), P.butterDeep, [-0.08, 1.2, 0.42]));
    closet.add(mk(sphere(0.06, 8, 6), P.butterDeep, [0.08, 1.2, 0.42]));
    closet.position.set(W / 2 - 0.45, 0, 1.4);
    closet.rotation.y = -Math.PI / 2;
    this.add(closet, 'box');
    const closetSign = sign('👗 Wardrobe', 1.3, 0.4, { bg: '#FFFFFF', border: '#E6B2FF' });
    closetSign.position.set(W / 2 - 0.02, 2.65, 1.4);
    closetSign.rotation.y = -Math.PI / 2;
    this.scene.add(closetSign);
    // reading corner
    const r = rug(3, 2.2, P.pink, P.white);
    r.position.set(-4.4, 0, 3.1);
    this.add(r);
    const cush = sheepCushion();
    cush.position.set(-4.9, 0.1, 3.3);
    this.add(cush, 0.5);
    this.add(plant(P.pinkDeep, P.mintDeep, 1.1).translateX(-5.4).translateZ(-3.8), 0.4);
    this.add(plant(P.blue, P.mintDeep).translateX(5.4).translateZ(3.9), 0.4);
    this.add(lamp().translateX(-5.4).translateZ(2.2), 0.3);
    // door to schoolyard on right wall
    const dr = door(P.pinkDeep, 'Schoolyard ▸');
    dr.position.set(W / 2 + 0.05, 0, 3.4);
    dr.rotation.y = -Math.PI / 2;
    this.add(dr);
    this.door('yard', 'classroom', new THREE.Vector3(W / 2 - 0.6, 0, 3.4), 'Go to the Schoolyard', 1.4);

    await Promise.all(loads);
    this.spawns = {
      default: { x: -1.5, z: 3.3, rot: Math.PI * 0.9 },
      map: { x: 4.5, z: 3.4, rot: -Math.PI / 2 },
    };
    this.spawnNpcs();

    // -------- interactions --------
    const game = this.game;
    this.interact({
      id: 'sit', pos: new THREE.Vector3(-3.4, 0, 0.3), radius: 1.1, label: '🪑 Sit at your desk', height: 1.4,
      onInteract: async () => {
        game.player.root.position.set(-3.4, 0, 0.15);
        game.setFacing(Math.PI);
        game.player.play('sit', { loop: true });
        game.ui.react(game.player.root.position.clone().setY(2.6), '(´｡• ᵕ •｡`) ♡');
        if (!game.save.flag('satDesk', false)) {
          game.save.setFlag('satDesk', true);
          game.addHearts(3, game.player.root.position);
        }
      },
    });
    this.interact({
      id: 'notebook', pos: new THREE.Vector3(-3.4, 0, -0.6), radius: 1.3, label: '📓 Peek at the notebook', height: 1.4,
      onInteract: async () => {
        game.player.play('interact');
        await this.showNotebook();
      },
    });
    this.interact({
      id: 'window', pos: new THREE.Vector3(-5.4, 0, -0.3), radius: 1.3, label: '☁️ Look outside', height: 2.2,
      onInteract: async () => {
        const p = game.player.root.position;
        game.setFacing(-Math.PI / 2);
        game.cam.override = { pos: new THREE.Vector3(p.x + 3, 2.6, p.z + 1.2), look: new THREE.Vector3(-6.2, 2.1, -0.3), k: 3 };
        game.player.play('shy');
        await game.ui.dialogue('Hamin', ['The clouds look like fluffy sheep today… ☁️🐑', 'One of them is doing a little hop!'], { portrait: '💙' });
        game.cam.override = null;
        if (!game.save.flag('lookedWindow', false)) {
          game.save.setFlag('lookedWindow', true);
          game.addHearts(3, p);
        }
      },
    });
    this.interact({
      id: 'board', pos: new THREE.Vector3(0, 0, -3.4), radius: 1.4, label: '✏️ Doodle on the board', height: 3.2,
      onInteract: async () => {
        game.setFacing(Math.PI);
        await game.player.playAsync('interact');
        this.doodle = (this.doodle + 1) % DOODLES.length;
        this.drawBoard();
        game.audio.sfx('sparkle');
        game.fx.burst(new THREE.Vector3(0, 2.2, -4.2), 'sparkles', 8);
        game.ui.react(game.player.root.position.clone().setY(2.6), 'ヽ(・∀・)ﾉ');
      },
    });
    this.interact({
      id: 'closet', pos: new THREE.Vector3(W / 2 - 1.2, 0, 1.4), radius: 1.3, label: '👗 Open the wardrobe', height: 2.8,
      onInteract: () => { game.unlock(); game.openWardrobe(); game.lock(); },
    });
    // collectibles
    const st = stickerPickup('✏️');
    st.position.set(-5.2, 1, 2.6);
    this.collectible('sticker', 'stk_class', st, 'Pencil sticker', '✏️');
    const pl = sheepPlush(1);
    pl.position.set(0.9, 0.05, -2.2);
    pl.rotation.y = 0.5;
    this.collectible('plush', 'plush_class', pl, 'a sleepy sheep plushie', '🐑');
  }

  private drawBoard() {
    const c = this.boardTex.image as HTMLCanvasElement;
    const g = c.getContext('2d')!;
    g.fillStyle = '#8FC9B0';
    g.fillRect(0, 0, 512, 200);
    g.fillStyle = 'rgba(255,255,255,.08)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 512, Math.random() * 200, 30, 2);
    g.strokeStyle = g.fillStyle = 'rgba(255,255,255,.92)';
    g.lineWidth = 4;
    g.font = '800 40px Nunito, sans-serif';
    g.textAlign = 'center';
    DOODLES[this.doodle](g);
    this.boardTex.needsUpdate = true;
  }

  private showNotebook() {
    return new Promise<void>((res) => {
      const b = el('div');
      const cv = document.createElement('canvas');
      cv.width = 480;
      cv.height = 300;
      cv.style.cssText = 'width:100%;border-radius:14px;background:#fff';
      const g = cv.getContext('2d')!;
      g.fillStyle = '#fffdf6';
      g.fillRect(0, 0, 480, 300);
      g.strokeStyle = '#cfe3ff';
      for (let y = 40; y < 300; y += 28) { g.beginPath(); g.moveTo(0, y); g.lineTo(480, y); g.stroke(); }
      g.strokeStyle = '#ffb3c1';
      g.beginPath(); g.moveTo(52, 0); g.lineTo(52, 300); g.stroke();
      g.fillStyle = '#364049';
      g.font = '800 22px Nunito, sans-serif';
      g.fillText('To-do today ♡', 70, 32);
      g.font = '700 18px Nunito, sans-serif';
      const d = this.game.save.data;
      const items: [string, boolean][] = [
        ['say hi to Momo & Nabi', !!d.npc.momo?.talks],
        ['taste-test lunch (cafeteria)', !!d.minigames.eating?.plays],
        ['play with Bori (schoolyard)', !!d.minigames.dogchase?.plays],
        ['practise a dance ♪', !!d.minigames.dance?.plays],
        ['ride the metro to the sea 🌊', d.visited.includes('beach')],
        ['try on something cute 👗', !!d.flags.dressed],
      ];
      items.forEach(([t, done], i) => {
        const y = 68 + i * 28;
        g.fillStyle = done ? '#FF7A93' : '#b8c2cc';
        g.fillText(done ? '♥' : '♡', 70, y);
        g.fillStyle = '#364049';
        g.fillText(t, 96, y);
        if (done) { g.strokeStyle = '#FF9DB3'; g.lineWidth = 2; g.beginPath(); g.moveTo(96, y - 6); g.lineTo(96 + g.measureText(t).width, y - 6); g.stroke(); }
      });
      g.strokeStyle = '#8A99A8';
      g.lineWidth = 2;
      sheep(g, 400, 250, 18);
      b.appendChild(cv);
      this.game.ui.modal('📓 Hamin’s notebook', b, { onClose: res });
    });
  }
}
