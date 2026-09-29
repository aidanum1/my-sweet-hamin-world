import * as THREE from 'three';
import { GameScene } from './GameScene';
import { P } from '../assets/palette';
import { mk, rbox, cyl, sphere, torus, capsule } from '../assets/geo';
import {
  room, door, sign, poster, micStand, stool, chair, plant, lamp, roundRug, sheepPlush, stickerPickup, sheepCushion, floorMark,
} from '../assets/props';
import { box as colBox, circle } from '../core/Collision';
import { wait } from '../utils/math';
import { RhythmGame } from '../minigames/Rhythm/RhythmGame';

const PI = Math.PI;
const FLOOR_Y = 0.1; // top of the room floor: Higgsfield props stand on it

/** Vocal Practice Room: lavender hero colour, foam walls, mic, recording desk, Lulu the cloud coach. */
export default class VocalScene extends GameScene {
  readonly id = 'vocal' as const;
  readonly title = 'Vocal Practice Room';
  subtitle = 'Soft voice, big heart ♡';
  music = 'vocal' as const;
  private onAir!: THREE.Mesh;
  private offAir!: THREE.Mesh;
  private meters: THREE.Object3D[] = [];
  private singing = false;

  async build() {
    const W = 12, D = 9;
    const game = this.game;
    const loads: Promise<unknown>[] = [];
    this.skyArt('sky_title');
    this.light({ dir: [-5, 10, 6], shadowRange: 8 });
    this.bounds = { minX: -W / 2 + 0.3, maxX: W / 2 - 0.3, minZ: -D / 2 + 0.6, maxZ: D / 2 + 0.2 };
    this.cam = { dist: 16, pitch: 0.62, lookY: 1.3, yawRange: 0.6, clamp: { minX: -1.5, maxX: 1.5, minZ: -1, maxZ: 1.2 } };
    const s = this.statics;
    s.add(room({ w: W, d: D, floor: P.wood, floor2: 0xf9e6c8, planks: true, wall: P.lavender, wall2: 0xf1e9ff, slab: P.lavenderDeep, trim: P.white }));
    const BZ = -D / 2;

    // ---------------- soundproof foam: panels of rounded pastel bumps ----------------
    const foamCols = [P.lavenderDeep, P.pink, P.blue];
    let k = 0;
    for (let cx = 0; cx < 4; cx++)
      for (let cy = 0; cy < 2; cy++) {
        const pnl = foamPanel(foamCols[k++ % 3]);
        pnl.position.set(-4.95 + cx * 1.12, 1.3 + cy * 1.1, BZ + 0.02);
        this.add(pnl);
      }
    for (let cx = 0; cx < 3; cx++) {
      const pnl = foamPanel(foamCols[(cx + 1) % 3]);
      pnl.position.set(2.45 + cx * 1.12, 2.55, BZ + 0.02);
      this.add(pnl);
    }
    for (let cz = 0; cz < 2; cz++) {
      const pnl = foamPanel(foamCols[(cz + 2) % 3]);
      pnl.position.set(-W / 2 + 0.02, 1.8, -2.4 + cz * 1.12);
      pnl.rotation.y = PI / 2;
      this.add(pnl);
    }

    // ---------------- ON AIR light (lit during practice) ----------------
    s.add(mk(rbox(1.5, 0.52, 0.14, 0.08, 1), P.white, [0.35, 2.95, BZ + 0.07]));
    this.offAir = sign('● ON AIR', 1.3, 0.38, { bg: '#F3EEFF', fg: '#C9BEDF', border: '#E9DDFF' });
    this.onAir = sign('● ON AIR', 1.3, 0.38, { bg: '#FF7A93', fg: '#FFFFFF', border: '#FFCCD5' });
    for (const m of [this.offAir, this.onAir]) {
      m.position.set(0.35, 2.95, BZ + 0.15);
      this.scene.add(m);
    }
    this.onAir.visible = false;
    // lyric poster next to the light
    const lyrics = poster(1.2, 1.5, (g, w, h) => drawLyricSheet(g, w, h, 'Cloud Song'), 256);
    lyrics.position.set(0.35, 1.55, BZ + 0.06);
    this.scene.add(lyrics);
    s.add(mk(rbox(1.34, 1.64, 0.05, 0.03, 1), P.purple, [0.35, 1.55, BZ + 0.01]));
    for (const x of [-0.12, 0.82]) s.add(mk(sphere(0.06, 8, 6), P.strawberry, [x, 2.3, BZ + 0.07]));

    // ---------------- singing spot: rug, mic stand, stool, lyric stand ----------------
    const rg = roundRug(1.5, P.lavender, P.white);
    rg.position.set(0, 0, 0.3);
    this.add(rg);
    const spot = floorMark(P.lavenderDeep, 0.7, '🎤');
    spot.position.set(0, 0.03, 0.1);
    this.addDynamic(spot);
    const mic = micStand(P.purple);
    mic.position.set(0.62, 0, 0.72);
    mic.rotation.y = PI + 0.75;
    this.add(mic);
    this.colliders.push(circle(0.62, 0.72, 0.28));
    // cable curl
    s.add(mk(torus(0.18, 0.025, 4, 16), P.ink, [0.8, 0.12, 0.95], [PI / 2, 0, 0]));
    const st = stool(P.pink);
    st.position.set(1.6, 0, -0.2);
    this.add(st, 0.36);
    this.lyricStand(-1.25, 0.45, 0.55);
    this.colliders.push(circle(-1.25, 0.45, 0.3));

    // ---------------- recording desk (right back) ----------------
    // Higgsfield studio desk (desk + mixer only) with the procedural monitors, wave screen, level meters and
    // headphones set on its top; the fully procedural desk is the fallback.
    const dx = 3.75, dz = BZ + 0.75;
    loads.push(this.prop('studio_desk', dx, BZ + 0.67, { w: 2.4 }, 0, 'box', FLOOR_Y).then((m) => {
      if (!m) {
        this.proceduralDesk(dx, dz);
        return;
      }
      const zc = BZ + 0.67;
      m.updateMatrixWorld(true);
      const rc = new THREE.Raycaster();
      const topAt = (x: number, z: number) => {
        rc.set(new THREE.Vector3(x, 4, z), new THREE.Vector3(0, -1, 0));
        return rc.intersectObject(m, true)[0]?.point.y ?? 1.0;
      };
      const top = topAt(dx - 0.7, zc); // bare wood left of the mixer
      this.deskGear(dx, top, zc, { spkX: 0.98, backZ: -0.44, monX: 0.1, meter: [-0.05, topAt(dx + 0.05, zc - 0.2) - top, -0.2], hp: [-0.7, 0.1] });
    }));
    const ch = chair(P.pink, P.metal);
    ch.position.set(dx - 0.5, 0, dz + 1.05);
    ch.rotation.y = PI;
    this.add(ch);
    this.colliders.push(circle(dx - 0.5, dz + 1.05, 0.3));
    const lp = lamp(P.purple);
    lp.position.set(W / 2 - 0.4, 0, -1.4);
    this.add(lp, 0.3);

    // ---------------- cosy corner: pink sofa with sheep cushions, plant, sheep poster ----------------
    const rg2 = roundRug(1.2, P.pink, P.white);
    rg2.position.set(-4.5, 0, 2.9);
    this.add(rg2);
    // Higgsfield cozy sofa against the left wall, angled toward the room; the old sheep floor cushions as fallback
    loads.push(this.prop('cozy_sofa', -5.2, 2.9, { w: 1.7 }, PI / 2 - 0.5, 'box', FLOOR_Y).then((m) => {
      if (m) return;
      for (const [x, z, sc] of [[-4.9, 3.1, 1], [-4.0, 3.5, 0.8]] as const) {
        const c = sheepCushion();
        c.position.set(x, 0.1, z);
        c.scale.setScalar(sc);
        c.rotation.y = 0.5;
        this.add(c, 0.45 * sc);
      }
    }));
    this.add(plant(P.lavenderDeep, P.mintDeep, 1.1).translateX(-5.4).translateZ(-3.85), 0.4);
    this.add(plant(P.pink, P.mintDeep, 0.9).translateX(5.4).translateZ(1.2), 0.35);
    const sp = poster(1.15, 0.9, (g, w, h) => {
      g.fillStyle = '#E9DDFF'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#FFFFFF'; g.fillRect(10, 10, w - 20, h - 20);
      drawSheep(g, w * 0.38, h * 0.5, 30);
      g.fillStyle = '#364049'; g.font = '800 24px Nunito, sans-serif'; g.textAlign = 'center';
      g.fillText('hum like a sheep~', w / 2, h - 26);
      g.fillStyle = '#A98BE8'; g.font = '900 30px Nunito, sans-serif';
      g.fillText('baa ♪', w * 0.78, 60);
    });
    sp.position.set(-W / 2 + 0.01, 1.9, 1.3);
    sp.rotation.y = PI / 2;
    this.scene.add(sp);
    // coat hook with a scarf
    s.add(mk(rbox(0.8, 0.1, 0.1, 0.04, 1), P.white, [-W / 2 + 0.06, 2.1, 3.0], [0, PI / 2, 0]));
    s.add(mk(capsule(0.08, 0.8, 3, 8), P.purple, [-W / 2 + 0.14, 1.65, 2.85], [0, 0, 0.05]));
    s.add(mk(capsule(0.08, 0.6, 3, 8), P.pink, [-W / 2 + 0.14, 1.75, 3.2], [0.08, 0, 0]));

    // ---------------- door ----------------
    const dr = door(P.lavenderDeep, 'Schoolyard ▸');
    dr.position.set(W / 2 + 0.05, 0, 3.1);
    dr.rotation.y = -PI / 2;
    this.add(dr);
    this.door('yard', 'vocal', new THREE.Vector3(W / 2 - 0.6, 0, 3.1), 'Back to the Schoolyard', 1.4);

    await Promise.all(loads);
    this.spawns = {
      default: { x: 4.4, z: 3.1, rot: -PI / 2 },
      map: { x: 4.4, z: 3.1, rot: -PI / 2 },
    };
    this.spawnNpcs();

    // ---------------- interactions ----------------
    this.interact({
      id: 'vocal-mic', pos: new THREE.Vector3(0.2, 0, 0.35), radius: 1.3, label: '🎤 Vocal practice', height: 2.1,
      onInteract: async () => {
        await new RhythmGame(game, 'vocal', {
          spot: { x: 0, z: 0.1, rot: 0.12 },
          onStart: () => this.setOnAir(true),
          onEnd: () => this.setOnAir(false),
        }).run();
      },
    });
    this.interact({
      id: 'vocal-headphones', pos: new THREE.Vector3(dx - 1.0, 0, dz + 0.6), radius: 1.3, label: '🎧 Listen', height: 1.6,
      onInteract: async () => {
        const p = game.player;
        await p.playAsync('interact');
        game.setFacing(0.35); // turn to the camera and enjoy the music
        game.audio.playMusic('vocal', true);
        p.play('sing', { loop: true });
        p.overrideExpression('sing');
        this.singing = true;
        game.ui.react(p.root.position.clone().setY(2.7), '♪ ～(˘▾˘～) ♪');
        for (let i = 0; i < 7; i++) {
          game.fx.floatUp(p.root.position.clone().setY(2.4 + Math.random() * 0.3).add(new THREE.Vector3((Math.random() - 0.5) * 0.9, 0, 0)), 'notes');
          await wait(480);
        }
        this.singing = false;
        p.overrideExpression(null);
        p.stop();
        p.play('happy');
        if (!game.save.flag('vocalListen', false)) {
          game.save.setFlag('vocalListen', true);
          game.addHearts(2, p.root.position);
        }
      },
    });

    // ---------------- collectibles ----------------
    const stk = stickerPickup('🎧');
    stk.position.set(-5.25, 1.0, 0.2);
    this.collectible('sticker', 'stk_vocal', stk, 'Headphones sticker', '🎧');
    const pl = sheepPlush(0.9);
    pl.position.set(dx + 1.0, 0.08, dz - 0.05);
    pl.rotation.y = -0.4;
    this.collectible('plush', 'plush_vocal', pl, 'a singing sheep plushie', '🐑');

    // ---------------- animation ----------------
    const ring = spot.children[0];
    this.onUpdate((_dt, t) => {
      const b = game.audio.ctx ? game.audio.beat() : t * 1.4;
      const f = ((b % 1) + 1) % 1;
      const pulse = Math.exp(-f * 5);
      ring.scale.setScalar(1 + pulse * 0.05);
      const live = this.onAir.visible || this.singing;
      this.meters.forEach((m, i) => {
        const v = live ? 0.35 + 0.65 * Math.abs(Math.sin(t * (5 + i * 1.7) + i)) * (0.5 + pulse * 0.5) : 0.25 + pulse * 0.25;
        m.scale.y = v;
      });
    });
  }

  /** Fallback recording desk (procedural): desk with drawer + mixer, and the usual gear on top. */
  private proceduralDesk(dx: number, dz: number) {
    const desk = new THREE.Group();
    desk.add(mk(rbox(2.9, 0.1, 1.0, 0.04), P.white, [0, 0.86, 0]));
    for (const sx of [-1, 1]) desk.add(mk(rbox(0.12, 0.82, 0.9, 0.05, 1), P.lavenderDeep, [sx * 1.3, 0.41, 0]));
    desk.add(mk(rbox(0.8, 0.5, 0.85, 0.06, 1), P.lavender, [0.9, 0.55, 0]));
    desk.add(mk(sphere(0.04, 6, 4), P.pinkDeep, [0.9, 0.62, 0.44]));
    // mixer
    desk.add(mk(rbox(1.0, 0.1, 0.5, 0.04, 1), P.metal, [-0.2, 0.96, 0.12], [-0.12, 0, 0]));
    for (let i = 0; i < 6; i++) {
      desk.add(mk(cyl(0.035, 0.035, 0.05, 8), [P.pinkDeep, P.blueDeep, P.mintDeep][i % 3], [-0.6 + i * 0.16, 1.03, 0.02]));
      desk.add(mk(rbox(0.05, 0.03, 0.08, 0.01, 1), P.white, [-0.6 + i * 0.16, 1.01, 0.26 - (i % 3) * 0.04]));
    }
    desk.position.set(dx, 0, dz);
    this.add(desk);
    this.colliders.push(colBox(dx, dz, 2.9, 1.0));
    this.deskGear(dx, 0.91, dz, { spkX: 1.15, backZ: -0.2, monX: 0.35, meter: [-0.05, 0.07, -0.05], hp: [-1.0, 0.22] });
  }

  /**
   * Mini monitor speakers, the wave screen on its stand, live level meters (dynamic) and resting headphones,
   * laid out on a desk top whose centre is (x, y, z). Offsets are relative to that centre.
   */
  private deskGear(x: number, y: number, z: number, o: { spkX: number; backZ: number; monX: number; meter: [number, number, number]; hp: [number, number] }) {
    const g = new THREE.Group();
    for (const sx of [-o.spkX, o.spkX]) {
      g.add(mk(rbox(0.36, 0.5, 0.32, 0.07, 1), P.purple, [sx, 0.25, o.backZ]));
      g.add(mk(cyl(0.1, 0.1, 0.03, 14), P.white, [sx, 0.19, o.backZ + 0.17], [PI / 2, 0, 0]));
      g.add(mk(cyl(0.05, 0.05, 0.03, 10), P.white, [sx, 0.39, o.backZ + 0.17], [PI / 2, 0, 0]));
    }
    // monitor stand
    g.add(mk(rbox(0.1, 0.3, 0.1, 0.03, 1), P.metal, [o.monX, 0.15, o.backZ - 0.08]));
    g.add(mk(rbox(1.0, 0.64, 0.08, 0.05, 1), P.white, [o.monX, 0.59, o.backZ - 0.1]));
    g.position.set(x, y, z);
    this.add(g);
    const screen = poster(0.88, 0.52, (c, w, h) => drawWave(c, w, h), 256);
    screen.position.set(x + o.monX, y + 0.59, z + o.backZ - 0.05);
    this.scene.add(screen);
    // live level meters on the mixer (dynamic)
    for (let i = 0; i < 3; i++) {
      const m = mk(rbox(0.06, 0.3, 0.04, 0.02, 1), [P.mintDeep, P.butterDeep, P.pinkDeep][i], [0, 0.15, 0]);
      m.geometry = m.geometry.clone();
      m.geometry.translate(0, 0.15, 0);
      m.position.set(x + o.meter[0] + i * 0.1, y + o.meter[1], z + o.meter[2]);
      m.userData.dynamic = true;
      this.addDynamic(m);
      this.meters.push(m);
    }
    // headphones resting on the desk
    const hp = headphones();
    hp.position.set(x + o.hp[0], y + 0.02, z + o.hp[1]);
    hp.rotation.set(-PI / 2 + 0.25, 0, 0.3);
    this.add(hp);
  }

  private setOnAir(on: boolean) {
    this.onAir.visible = on;
    this.offAir.visible = !on;
  }

  private lyricStand(x: number, z: number, rot: number) {
    const g = new THREE.Group();
    g.add(mk(cyl(0.02, 0.02, 1.15, 6), P.metal, [0, 0.62, 0]));
    for (let i = 0; i < 3; i++) {
      // tripod legs splaying out from the foot of the pole
      const leg = new THREE.Group();
      leg.rotation.y = (i / 3) * PI * 2 + PI / 3;
      leg.add(mk(cyl(0.018, 0.018, 0.42, 6), P.metal, [0, 0.16, 0.15], [-0.8, 0, 0]));
      leg.add(mk(sphere(0.03, 6, 4), P.pinkDeep, [0, 0.02, 0.29]));
      g.add(leg);
    }
    g.add(mk(rbox(0.72, 0.5, 0.04, 0.02, 1), P.metal, [0, 1.3, 0.02], [-0.45, 0, 0]));
    g.add(mk(rbox(0.72, 0.05, 0.08, 0.02, 1), P.metal, [0, 1.07, 0.14], [-0.45, 0, 0]));
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    this.add(g);
    const sheet = poster(0.6, 0.44, (c, w, h) => drawLyricSheet(c, w, h, 'la la ♡'), 256);
    sheet.position.set(0, 1.31, 0.05);
    sheet.rotation.x = -0.45;
    const holder = new THREE.Group();
    holder.position.set(x, 0, z);
    holder.rotation.y = rot;
    holder.add(sheet);
    this.addDynamic(holder);
  }
}

/** Soundproof foam panel: rounded base with a 3×3 grid of soft bumps (≈ 430 tris). */
function foamPanel(c: number) {
  const g = new THREE.Group();
  g.add(mk(rbox(1.04, 1.02, 0.08, 0.04, 1), c, [0, 0, 0.04]));
  const bump = sphere(0.15, 6, 4);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) g.add(mk(bump, (i + j) % 2 ? P.white : c, [-0.32 + i * 0.32, -0.32 + j * 0.32, 0.09], [PI / 2, 0, 0], [1, 0.45, 1]));
  return g;
}

function headphones() {
  const g = new THREE.Group();
  g.add(mk(torus(0.2, 0.035, 6, 16, PI), P.purple, [0, 0.02, 0]));
  for (const sx of [-1, 1]) {
    g.add(mk(cyl(0.1, 0.1, 0.08, 14), P.pink, [sx * 0.21, -0.04, 0], [0, 0, PI / 2]));
    g.add(mk(cyl(0.075, 0.075, 0.03, 12), P.white, [sx * 0.16, -0.04, 0], [0, 0, PI / 2]));
  }
  return g;
}

function drawLyricSheet(g: CanvasRenderingContext2D, w: number, h: number, title: string) {
  g.fillStyle = '#FFFDF6';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#E6B2FF';
  g.lineWidth = 8;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.textAlign = 'center';
  g.fillStyle = '#A98BE8';
  const big = h > w;
  g.font = `900 ${big ? 30 : 26}px Nunito, sans-serif`;
  g.fillText('♪ ' + title + ' ♪', w / 2, big ? 48 : 40);
  // staff lines with little notes
  const rows = big ? 4 : 2;
  const top = big ? 78 : 62;
  const gap = big ? 58 : 50;
  for (let r = 0; r < rows; r++) {
    const y0 = top + r * gap;
    g.strokeStyle = '#CFE3FF';
    g.lineWidth = 2;
    for (let l = 0; l < 4; l++) { g.beginPath(); g.moveTo(22, y0 + l * 7); g.lineTo(w - 22, y0 + l * 7); g.stroke(); }
    for (let n = 0; n < 5; n++) {
      const x = 40 + n * ((w - 80) / 4);
      const y = y0 + 4 + ((n * 7 + r * 3) % 4) * 5;
      g.fillStyle = n % 2 ? '#FF9DB3' : '#86B8F0';
      g.beginPath(); g.ellipse(x, y, 6, 5, -0.4, 0, Math.PI * 2); g.fill();
      g.fillRect(x + 4, y - 22, 2.5, 22);
    }
    g.fillStyle = '#364049';
    g.font = `700 ${big ? 17 : 15}px Nunito, sans-serif`;
    const words = ['la la lu~ fluffy sky', 'hum hum, soft heart ♡', 'baa baa, sing with me', 'one more time~ ♪'];
    g.fillText(words[r % 4], w / 2, y0 + (big ? 44 : 40));
  }
  if (big) {
    g.fillStyle = '#FFCCD5';
    g.beginPath(); g.arc(w - 36, h - 34, 16, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#FF7A93'; g.font = '900 20px Nunito, sans-serif';
    g.fillText('♡', w - 36, h - 27);
  }
}

function drawWave(g: CanvasRenderingContext2D, w: number, h: number) {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#F3EEFF');
  grd.addColorStop(1, '#DCECFF');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#A98BE8';
  g.lineWidth = 4;
  g.beginPath();
  for (let x = 0; x <= w; x += 3) {
    const env = Math.sin((x / w) * Math.PI);
    const y = h / 2 + Math.sin(x * 0.18) * Math.sin(x * 0.037) * 40 * env;
    x ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
  g.fillStyle = '#FF7A93';
  g.beginPath(); g.arc(22, 22, 8, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#364049'; g.font = '800 16px Nunito, sans-serif';
  g.fillText('REC 00:12', 36, 28);
  g.fillStyle = '#FF9DB3'; g.font = '900 22px Nunito, sans-serif';
  g.fillText('♡', w - 34, h - 16);
}

function drawSheep(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.fillStyle = '#FFFFFF';
  g.strokeStyle = '#CDB8F5';
  g.lineWidth = 4;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    g.beginPath();
    g.arc(x + Math.cos(a) * s, y + Math.sin(a) * s * 0.7, s * 0.55, 0, PI * 2);
    g.fill();
    g.stroke();
  }
  g.beginPath(); g.arc(x, y, s, 0, PI * 2); g.fill();
  g.fillStyle = '#FFE7DA';
  g.beginPath(); g.ellipse(x + s * 1.35, y + 2, s * 0.5, s * 0.45, 0, 0, PI * 2); g.fill();
  g.fillStyle = '#364049';
  g.beginPath(); g.arc(x + s * 1.2, y - 2, 3.5, 0, PI * 2); g.arc(x + s * 1.55, y - 2, 3.5, 0, PI * 2); g.fill();
  g.beginPath(); g.ellipse(x + s * 1.38, y + 12, 4, 5, 0, 0, PI * 2); g.fill();
  g.fillStyle = '#FFB3C1';
  g.beginPath(); g.arc(x + s * 1.05, y + 8, 4, 0, PI * 2); g.arc(x + s * 1.7, y + 8, 4, 0, PI * 2); g.fill();
}
