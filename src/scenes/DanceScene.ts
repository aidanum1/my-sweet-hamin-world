import * as THREE from 'three';
import { GameScene } from './GameScene';
import { P } from '../assets/palette';
import { mk, rbox, cyl, sphere, torus, cone } from '../assets/geo';
import { room, door, sign, poster, bag, bench, plant, sheepPlush, stickerPickup, sheepCushion, floorMark, bottle } from '../assets/props';
import { box as colBox, circle } from '../core/Collision';
import { canvasTex } from '../assets/textures';
import { todayKey } from '../utils/math';
import { RhythmGame } from '../minigames/Rhythm/RhythmGame';

const PI = Math.PI;
const FLOOR_Y = 0.1; // top of the room floor: Higgsfield props stand on it

/** Dance Practice Room: powder-blue hero colour, big (fake) mirror wall, speakers, Popo the chick. */
export default class DanceScene extends GameScene {
  readonly id = 'dance' as const;
  readonly title = 'Dance Practice Room';
  subtitle = 'Five, six, seven, eight! ♡';
  music = 'dance' as const;
  private woofers: THREE.Object3D[] = [];
  /** Higgsfield speaker stacks: the whole box bumps softly on the beat */
  private thumpers: THREE.Object3D[] = [];
  private freestyle = false;
  private noteT = 0;

  async build() {
    const W = 12, D = 9;
    const game = this.game;
    const loads: Promise<unknown>[] = [];
    this.skyArt('sky_day');
    this.light({ dir: [5, 10, 6], shadowRange: 8 });
    this.bounds = { minX: -W / 2 + 0.3, maxX: W / 2 - 0.3, minZ: -D / 2 + 0.7, maxZ: D / 2 + 0.2 };
    this.cam = { dist: 16, pitch: 0.62, lookY: 1.3, yawRange: 0.6, clamp: { minX: -1.5, maxX: 1.5, minZ: -1, maxZ: 1.2 } };
    const s = this.statics;
    s.add(room({ w: W, d: D, floor: P.wood, floor2: 0xf9e6c8, planks: true, wall: P.blueSoft, wall2: 0xe9f3ff, slab: P.blue, trim: P.white }));

    // ---------------- mirror wall (fake: painted gradient panels, no reflections) ----------------
    const MW = 8.6, MH = 2.35, MY = 1.55, BZ = -D / 2;
    s.add(mk(rbox(MW + 0.3, MH + 0.3, 0.14, 0.06, 1), P.white, [0, MY, BZ + 0.07]));
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(MW, MH), new THREE.MeshBasicMaterial({ map: mirrorTex() }));
    mirror.position.set(0, MY, BZ + 0.15);
    mirror.userData.noShadow = true;
    this.addDynamic(mirror);
    for (const x of [-MW / 6, MW / 6]) s.add(mk(rbox(0.07, MH, 0.05, 0.02, 1), P.white, [x, MY, BZ + 0.17]));
    // ballet barre
    s.add(mk(cyl(0.045, 0.045, MW - 0.4, 10), P.woodDeep, [0, 1.05, BZ + 0.42], [0, 0, PI / 2]));
    for (const x of [-3.6, 0, 3.6]) {
      s.add(mk(cyl(0.03, 0.03, 0.3, 6), P.metal, [x, 1.05, BZ + 0.28], [PI / 2, 0, 0]));
      s.add(mk(cyl(0.07, 0.07, 0.04, 10), P.metal, [x, 1.05, BZ + 0.16], [PI / 2, 0, 0]));
    }
    const title = sign('♡ Dance Practice ♡', 2.6, 0.5, { bg: '#FFFFFF', border: '#86B8F0' });
    title.position.set(0, 3.03, BZ + 0.05);
    this.scene.add(title);
    // tiny spotlight cans on the top trim + soft fake beams / floor pools (no realtime lights)
    this.beam(-2.6, 0x9fd0ff, new THREE.Vector3(-2.2, 0, -0.6));
    this.beam(2.6, 0xffb3c4, new THREE.Vector3(2.1, 0, -0.4));
    // bunting along the back-wall top
    for (let i = 0; i < 14; i++) {
      const x = -5.4 + i * 0.83;
      if (Math.abs(x) < 1.6) continue;
      const y = 3.2 - Math.sin(((i % 7) / 6) * PI) * 0.1;
      s.add(mk(cone(0.13, 0.26, 3), [P.pink, P.blue, P.butter, P.mint][i % 4], [x, y, BZ + 0.08], [PI, 0, 0], [1, 1, 0.35]));
    }

    // ---------------- speakers (woofers pulse to the beat) ----------------
    loads.push(this.speaker(-5.05, -3.6, 0.35));
    loads.push(this.speaker(4.55, -3.65, -0.35)); // nudged in so the corner plushie stays visible

    // ---------------- floor: formation tape marks + light pools ----------------
    const tape = new THREE.BoxGeometry(0.46, 0.012, 0.08);
    for (const [x, z, c] of [[-2.2, -2, P.pinkDeep], [2.2, -2, P.blueDeep], [-3.4, 1.6, P.blueDeep], [3.4, 1.6, P.pinkDeep], [0, -2.6, P.butterDeep]] as const) {
      s.add(mk(tape, c, [x, 0.105, z], [0, PI / 4, 0]));
      s.add(mk(tape, c, [x, 0.105, z], [0, -PI / 4, 0]));
    }
    const mark = floorMark(P.pinkDeep, 0.85, '💃');
    mark.position.set(0, 0, 0.6);
    this.addDynamic(mark);

    // ---------------- left wall: clothes rack, bench with water, bags ----------------
    // Higgsfield rack is just the (empty) frame → hang the procedural clothes on it; full procedural rack as fallback
    loads.push(this.prop('clothes_rack', -5.34, -1.1, { h: 1.9 }, PI / 2, false, FLOOR_Y).then((m) => this.clothesRack(-5.35, -1.1, !m)));
    this.colliders.push(colBox(-5.35, -1.1, 0.7, 2.0));
    const bn = bench(1.7, P.blue);
    bn.position.set(-5.4, 0, 2.3);
    bn.rotation.y = PI / 2;
    this.add(bn);
    this.colliders.push(colBox(-5.4, 2.3, 0.6, 1.7));
    // folded towels on the bench
    s.add(mk(rbox(0.42, 0.1, 0.32, 0.04, 1), P.pink, [-5.4, 0.56, 2.85]));
    s.add(mk(rbox(0.38, 0.09, 0.3, 0.04, 1), P.white, [-5.4, 0.65, 2.85]));
    const bottles = new THREE.Group();
    for (const [z, c] of [[1.75, P.blue], [2.0, P.mint], [2.22, P.pink]] as const) {
      const b = bottle(c);
      b.position.set(-5.35, 0.5, z);
      bottles.add(b);
    }
    this.addDynamic(bottles);
    for (const [x, z, r, c, c2] of [[-5.2, 0.55, 0.3, P.pink, P.white], [-5.3, 3.55, 1.2, P.mint, P.pink]] as const) {
      const b = bag(c, c2);
      b.position.set(x, 0.1, z);
      b.rotation.y = r;
      this.add(b, 0.3);
    }
    // (between the speaker stack and the rack — the corner is the speaker's now)
    this.add(plant(P.blue, P.mintDeep, 1.05).translateX(-5.45).translateZ(-2.5), 0.4);

    // ---------------- right wall: door, posters, sheep cushion ----------------
    const dr = door(P.blueDeep, 'Schoolyard ▸');
    dr.position.set(W / 2 + 0.05, 0, 3.1);
    dr.rotation.y = -PI / 2;
    this.add(dr);
    this.door('yard', 'dance', new THREE.Vector3(W / 2 - 0.6, 0, 3.1), 'Back to the Schoolyard', 1.4);
    const counts = poster(1.1, 1.3, (g, w, h) => {
      g.fillStyle = '#FFF6E8'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#FFCCD5'; g.fillRect(8, 8, w - 16, h - 16);
      g.fillStyle = '#FFF'; g.fillRect(16, 16, w - 32, h - 32);
      g.textAlign = 'center';
      g.fillStyle = '#FF7A93'; g.font = '900 44px Nunito, sans-serif';
      g.fillText('5·6·7·8!', w / 2, 70);
      g.font = '96px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
      g.fillText('👟', w / 2, 180);
      g.fillStyle = '#86B8F0'; g.font = '800 24px Nunito, sans-serif';
      g.fillText('stretch first ♡', w / 2, 262);
    });
    counts.position.set(W / 2 - 0.01, 1.9, -0.4);
    counts.rotation.y = -PI / 2;
    this.scene.add(counts);
    const sheepPoster = poster(1.2, 0.9, (g, w, h) => {
      g.fillStyle = '#DCECFF'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#FFF'; g.fillRect(10, 10, w - 20, h - 20);
      drawSheep(g, w * 0.42, h * 0.52, 34);
      g.fillStyle = '#364049'; g.font = '800 26px Nunito, sans-serif'; g.textAlign = 'center';
      g.fillText('baa-lance! ♪', w / 2, h - 28);
    });
    sheepPoster.position.set(W / 2 - 0.01, 2.1, -2.6);
    sheepPoster.rotation.y = -PI / 2;
    this.scene.add(sheepPoster);
    const cush = sheepCushion();
    cush.position.set(4.9, 0.1, 1.2);
    cush.rotation.y = -PI / 2;
    this.add(cush, 0.5);
    // a small cubby shelf of shoes by the door
    const cub = new THREE.Group();
    cub.add(mk(rbox(0.5, 0.9, 1.4, 0.06, 1), P.white, [0, 0.45, 0]));
    for (const [y, z, c] of [[0.25, -0.35, P.pink], [0.25, 0.3, P.blue], [0.66, -0.3, P.mint], [0.66, 0.32, P.lavender]] as const) {
      cub.add(mk(rbox(0.28, 0.14, 0.34, 0.06, 1), c, [0.05, y, z]));
    }
    cub.position.set(W / 2 - 0.3, 0, 1.2 - 1.5);
    this.add(cub, 'box');

    await Promise.all(loads);
    this.spawns = {
      default: { x: 4.4, z: 3.1, rot: -PI / 2 },
      map: { x: 4.4, z: 3.1, rot: -PI / 2 },
    };
    this.spawnNpcs();

    // ---------------- interactions ----------------
    this.interact({
      id: 'dance-mark', pos: new THREE.Vector3(0, 0, 0.6), radius: 1.2, label: '💃 Dance practice', height: 1.2,
      onInteract: async () => {
        this.stopFreestyle();
        await new RhythmGame(game, 'dance', { spot: { x: 0, z: 0.6, rot: 0 } }).run();
      },
    });
    this.interact({
      id: 'dance-speaker', pos: new THREE.Vector3(-5.05, 0, -3.6), radius: 1.5, label: '🎵 Play a song', height: 1.9,
      onInteract: async () => {
        game.audio.playMusic('dance', true);
        game.audio.sfx('chime');
        game.fx.burst(new THREE.Vector3(-5.05, 1.6, -3.3), 'notes', 8);
        await game.player.playAsync('interact');
        game.player.play('dance', { loop: true });
        game.ui.react(game.player.root.position.clone().setY(2.7), '♪ ヽ(>∀<☆)ノ ♪');
        this.freestyle = true;
        this.noteT = 0;
        if (!game.save.flag('danceFreestyle', false)) {
          game.save.setFlag('danceFreestyle', true);
          game.addHearts(2, game.player.root.position);
        }
      },
    });
    this.interact({
      id: 'dance-water', pos: new THREE.Vector3(-5.2, 0, 2.0), radius: 1.3, label: '💧 Take a sip', height: 1.2,
      onInteract: async () => {
        const p = game.player;
        const b = bottle(P.blue);
        b.scale.setScalar(0.7);
        p.holdRight(b);
        await p.playAsync('eat');
        p.holdRight(null);
        game.audio.sfx('pop');
        game.ui.react(p.root.position.clone().setY(2.7), '(っ˘ω˘ς) refreshing~');
        const k = 'danceSip';
        if (game.save.flag(k, '') !== todayKey()) {
          game.save.setFlag(k, todayKey());
          game.addHearts(1, p.root.position);
        }
      },
    });

    // ---------------- collectibles ----------------
    const st = stickerPickup('👟');
    st.position.set(-4.75, 1.9, -2.55);
    this.collectible('sticker', 'stk_dance', st, 'Sneaker sticker', '👟');
    const pl = sheepPlush(0.95);
    pl.position.set(5.45, 0.08, -4.0);
    pl.rotation.y = -0.6;
    this.collectible('plush', 'plush_dance', pl, 'a dancing sheep plushie', '🐑');

    // ---------------- animation ----------------
    const ring = mark.children[0];
    this.onUpdate((dt, t) => {
      const b = game.audio.ctx ? game.audio.beat() : t * 1.87;
      const k = Math.exp(-(((b % 1) + 1) % 1) * 6);
      for (const w of this.woofers) w.scale.set(1 + k * 0.12, 1 + k * 0.12, 1);
      for (const s of this.thumpers) s.scale.set(1 + k * 0.025, 1 + k * 0.045, 1 + k * 0.025);
      ring.scale.setScalar(1 + k * 0.06);
      if (this.freestyle) this.updateFreestyle(dt);
    });
  }

  onExit() {
    this.freestyle = false;
  }

  // ------------------------------------------------------------ helpers
  private stopFreestyle() {
    if (!this.freestyle) return;
    this.freestyle = false;
    if (this.game.player.currentAction === 'dance') this.game.player.stop();
  }

  private updateFreestyle(dt: number) {
    const g = this.game;
    const m = g.input.move;
    if (Math.hypot(m.x, m.y) > 0.1 || g.player.currentAction !== 'dance') {
      this.stopFreestyle();
      return;
    }
    this.noteT -= dt;
    if (this.noteT <= 0) {
      this.noteT = 0.55;
      g.fx.floatUp(g.player.root.position.clone().setY(2.5 + Math.random() * 0.3).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, 0)), 'notes');
    }
  }

  /** Speaker stack: Higgsfield model (pulses on the beat), procedural speaker with pulsing woofers as fallback. */
  private async speaker(x: number, z: number, rot: number) {
    const m = await this.prop('speaker_stack', x, z, { w: 1.05, h: 1.1 }, rot, 0.55, FLOOR_Y);
    if (m) {
      this.thumpers.push(m);
      return;
    }
    const g = new THREE.Group();
    g.add(mk(rbox(0.8, 1.35, 0.66, 0.12, 1), P.blueDeep, [0, 0.68, 0]));
    g.add(mk(rbox(0.7, 0.12, 0.56, 0.05, 1), P.white, [0, 1.4, 0]));
    g.add(mk(cyl(0.3, 0.3, 0.04, 20), P.white, [0, 0.82, 0.33], [PI / 2, 0, 0]));
    g.add(mk(cyl(0.16, 0.16, 0.04, 16), P.white, [0, 0.36, 0.33], [PI / 2, 0, 0]));
    // little sheep ears on top — speaker mascot
    for (const sx of [-1, 1]) g.add(mk(sphere(0.1, 8, 6), P.white, [sx * 0.24, 1.5, 0.05]));
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    this.add(g);
    this.colliders.push(circle(x, z, 0.5));
    // pulsing cones (dynamic)
    for (const [y, r] of [[0.82, 0.24], [0.36, 0.12]] as const) {
      const w = new THREE.Group();
      w.add(mk(cyl(r, r * 0.8, 0.06, 18), P.ink, [0, 0, 0], [PI / 2, 0, 0]));
      w.add(mk(sphere(r * 0.35, 10, 8), P.pinkDeep, [0, 0, 0.03]));
      w.position.set(0, y, 0.36);
      const holder = new THREE.Group();
      holder.position.set(x, 0, z);
      holder.rotation.y = rot;
      holder.add(w);
      w.traverse((o) => (o.userData.dynamic = true));
      this.addDynamic(holder);
      this.woofers.push(w);
    }
  }

  /** Spotlight can on the back wall + translucent beam + soft light pool on the floor. */
  private beam(x: number, color: number, floor: THREE.Vector3) {
    const top = new THREE.Vector3(x, 3.25, -4.1);
    this.add(mk(cyl(0.16, 0.2, 0.3, 12), P.white, [x, 3.3, -4.3], [0.6, 0, 0]));
    this.add(mk(cyl(0.14, 0.14, 0.02, 12), toonGlow(color), [x, 3.2, -4.18], [0.6, 0, 0]));
    const dir = floor.clone().sub(top);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(0.12, 1.05, len, 20, 1, true);
    geo.translate(0, -len / 2, 0);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const cone = new THREE.Mesh(geo, mat);
    cone.position.copy(top);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
    cone.userData.noShadow = true;
    this.addDynamic(cone);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.4, 28), new THREE.MeshBasicMaterial({ map: poolTex(color), transparent: true, depthWrite: false }));
    pool.rotation.x = -PI / 2;
    pool.position.set(floor.x, 0.115, floor.z);
    pool.userData.noShadow = true;
    this.addDynamic(pool);
    this.onUpdate((_dt, t) => {
      mat.opacity = 0.06 + Math.sin(t * 1.3 + x) * 0.02;
    });
  }

  /** Hanging hoodies & tees; `frame` also builds the procedural rack (fallback when the Higgsfield rack is missing). */
  private clothesRack(x: number, z: number, frame = true) {
    const g = new THREE.Group();
    if (frame) {
      for (const dz of [-0.95, 0.95]) {
        g.add(mk(cyl(0.035, 0.035, 1.9, 8), P.metal, [0, 0.95, dz]));
        g.add(mk(rbox(0.5, 0.06, 0.12, 0.03, 1), P.metal, [0, 0.03, dz]));
        for (const dx of [-0.2, 0.2]) g.add(mk(sphere(0.05, 8, 6), P.pinkDeep, [dx, 0.05, dz]));
      }
      g.add(mk(cyl(0.035, 0.035, 1.95, 8), P.metal, [0, 1.88, 0], [PI / 2, 0, 0]));
    }
    const cols = [P.pink, P.blue, P.mint, P.lavender, P.butter];
    cols.forEach((c, i) => {
      const dz = -0.72 + i * 0.36;
      const hoodie = i === 1 || i === 3;
      g.add(mk(torus(0.1, 0.012, 4, 10, PI), P.metal, [0, 1.83, dz], [0, PI / 2, 0]));
      g.add(mk(rbox(0.12, 0.62, 0.42, 0.05, 1), c, [0, 1.42, dz], [0.04, 0, (i % 2 ? 1 : -1) * 0.03]));
      g.add(mk(rbox(0.1, 0.34, 0.12, 0.04, 1), c, [0, 1.56, dz - 0.25], [0.5, 0, 0]));
      g.add(mk(rbox(0.1, 0.34, 0.12, 0.04, 1), c, [0, 1.56, dz + 0.25], [-0.5, 0, 0]));
      if (hoodie) g.add(mk(sphere(0.12, 8, 6), c, [0.04, 1.72, dz], [0, 0, 0], [0.6, 0.7, 1]));
      else g.add(mk(cyl(0.05, 0.05, 0.13, 8), P.white, [0.065, 1.5, dz], [0, 0, PI / 2]));
    });
    g.position.set(x, 0, z);
    this.add(g);
  }
}

function toonGlow(c: number) {
  // pale emissive disc so the lamp lens reads as "on"
  return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.62 });
}

function mirrorTex() {
  return canvasTex(512, 140, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#f4f9ff');
    grd.addColorStop(0.55, '#d6eaff');
    grd.addColorStop(0.74, '#e7e4fb');
    grd.addColorStop(0.75, '#f6e6d2'); // reflected floor
    grd.addColorStop(1, '#eed7ba');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    // reflected light pools
    for (const [x, c] of [[0.32, 'rgba(159,208,255,.45)'], [0.68, 'rgba(255,179,196,.45)']] as const) {
      const r = g.createRadialGradient(x * w, h * 0.86, 2, x * w, h * 0.86, 60);
      r.addColorStop(0, c);
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.fillRect(0, h * 0.75, w, h * 0.25);
    }
    // diagonal sheen streaks
    g.fillStyle = 'rgba(255,255,255,.55)';
    for (const [x, sw] of [[40, 26], [80, 10], [214, 34], [262, 12], [396, 22], [430, 8]] as const) {
      g.beginPath();
      g.moveTo(x, 0); g.lineTo(x + sw, 0); g.lineTo(x + sw - 60, h * 0.74); g.lineTo(x - 60, h * 0.74);
      g.fill();
    }
    // sparkles
    g.fillStyle = '#fff';
    for (const [x, y, s] of [[120, 22, 6], [300, 40, 5], [470, 18, 7], [60, 70, 4]] as const) {
      g.beginPath();
      g.moveTo(x, y - s); g.quadraticCurveTo(x, y, x + s, y); g.quadraticCurveTo(x, y, x, y + s); g.quadraticCurveTo(x, y, x - s, y); g.quadraticCurveTo(x, y, x, y - s);
      g.fill();
    }
  });
}

function poolTex(color: number) {
  const c = new THREE.Color(color);
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  return canvasTex(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 4, w / 2, w / 2, w / 2);
    r.addColorStop(0, `rgba(255,255,255,.45)`);
    r.addColorStop(0.35, `rgba(${rgb},.32)`);
    r.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  });
}

function drawSheep(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.fillStyle = '#FFFFFF';
  g.strokeStyle = '#B2D9FF';
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
  g.fillStyle = '#FFB3C1';
  g.beginPath(); g.arc(x + s * 1.1, y + 10, 4, 0, PI * 2); g.arc(x + s * 1.65, y + 10, 4, 0, PI * 2); g.fill();
  // legs + a tiny dance pose music note
  g.strokeStyle = '#364049'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x - s * 0.4, y + s * 0.8); g.lineTo(x - s * 0.6, y + s * 1.25); g.moveTo(x + s * 0.4, y + s * 0.8); g.lineTo(x + s * 0.55, y + s * 1.25); g.stroke();
  g.fillStyle = '#FF7A93'; g.font = '900 34px Nunito, sans-serif';
  g.fillText('♪', x + s * 2.3, y - s * 0.6);
}
