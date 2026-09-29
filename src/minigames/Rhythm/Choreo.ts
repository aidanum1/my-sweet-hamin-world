// Hamin's rhythm-game body language. Every note the player hits becomes a move:
//   ← / → : side step with a pose (he slides, turns and leans that way)
//   ↑     : a big arms-up jump        ↓ : a squashy dip
//   ♡     : finger-heart with a hop   miss : a little stumble
// Vocal notes tilt / stretch him with the pitch (reach up for high notes, lean in for low ones).
// Only public Hamin/Game knobs are used (play, airborne, lean, root transform, setFacing); reset() restores them.
import type { Game } from '../../game/Game';
import type { AnimName } from '../../characters/Hamin';
import { clamp, damp } from '../../utils/math';
import type { Dir } from './charts';

export type Move = Dir | 'tap' | 'miss' | 'spin' | 'finale';

const PI = Math.PI;

export class Choreo {
  private off = 0; // side offset (m), + = screen right
  private offTo = 0;
  private yaw = 0;
  private yawTo = 0;
  private lean = 0;
  private leanTo = 0;
  private jumpT = -1;
  private jumpDur = 0.4;
  private jumpH = 0;
  private sqT = -1; // squash timer
  private sqAmt = 0;
  private sqHold = 0.12;
  private stretch = 0; // + = taller (high note), - = squatter
  private stretchTo = 0;
  private tilt = 0; // root pitch (neg = lean back)
  private tiltTo = 0;
  private backT = 0; // until the pose relaxes back to the base loop
  private pitchT = 0;
  private resume = true;
  private sustain = false;

  constructor(private g: Game, private spot: { x: number; z: number; rot: number }, public base: AnimName) {}

  /** Snap back to the spot with a neutral body (keeps the current animation). */
  reset() {
    this.off = this.offTo = this.yaw = this.yawTo = this.lean = this.leanTo = 0;
    this.stretch = this.stretchTo = this.tilt = this.tiltTo = 0;
    this.jumpT = this.sqT = -1;
    this.backT = this.pitchT = 0;
    this.sustain = false;
    this.apply(0);
  }

  /** Put the body back exactly as the explore controller expects it. */
  release() {
    const p = this.g.player;
    p.airborne = 0;
    p.lean = 0;
    p.root.scale.set(1, 1, 1);
    p.root.rotation.x = 0;
    p.root.rotation.z = 0;
    p.root.position.set(this.spot.x, 0, this.spot.z);
    this.g.setFacing(this.spot.rot);
  }

  move(m: Move) {
    switch (m) {
      case 'L':
      case 'R': {
        const s = m === 'L' ? -1 : 1;
        // step-touch: a second step the same way goes a little further, the other way crosses back
        this.offTo = clamp(this.offTo * 0.35 + s * 0.42, -0.55, 0.55);
        this.yawTo = s * 0.55;
        this.leanTo = -s * 0.13;
        this.hop(0.1, 0.26);
        this.anim(m === 'L' ? 'pose' : 'victory', 0.5);
        break;
      }
      case 'U':
        this.offTo *= 0.3;
        this.yawTo = 0;
        this.leanTo = 0;
        this.hop(0.5, 0.46);
        this.anim('happy', 0.55);
        break;
      case 'D':
        this.offTo *= 0.3;
        this.yawTo = 0;
        this.leanTo = 0;
        this.squash(1, 0.22);
        this.anim('interact', 0.5);
        break;
      case 'tap':
        this.yawTo *= 0.3;
        this.leanTo = 0;
        this.hop(0.14, 0.3);
        this.anim('heart', 0.55);
        break;
      case 'miss':
        this.leanTo = 0;
        this.anim('stumble', 0.75);
        break;
      case 'spin':
        this.yawTo = 0;
        this.hop(0.2, 0.5);
        this.anim('spin', 0.9);
        break;
      case 'finale':
        this.offTo = this.yawTo = this.leanTo = 0;
        this.hop(0.45, 0.48);
        this.anim('victory', 0, false);
        break;
    }
  }

  /** Vocal: body follows the pitch of the note just sung (0 high · 1 mid · 2 low). */
  pitch(row: number, holding: boolean) {
    this.tiltTo = row === 0 ? -0.08 : row === 2 ? 0.06 : -0.02;
    this.stretchTo = row === 0 ? 1 : row === 2 ? -0.7 : 0.35;
    this.sustain = holding;
    this.pitchT = holding ? 0 : 0.32;
    if (row === 0 && !holding) this.hop(0.08, 0.22);
  }
  endSustain() {
    this.sustain = false;
    this.pitchT = 0.15;
  }

  /** One-shot animation that relaxes back into the base loop after `hold` seconds. */
  anim(a: AnimName, hold: number, resume = true) {
    this.g.player.play(a, resume ? { onEnd: () => this.toBase() } : {});
    this.backT = hold;
    this.resume = resume;
  }

  toBase() {
    this.g.player.play(this.base, { loop: true });
  }

  hop(h: number, dur: number) {
    // never cut a bigger jump short with a smaller hop
    if (this.jumpT >= 0 && this.jumpT < this.jumpDur * 0.7 && this.jumpH > h) return;
    this.jumpT = 0;
    this.jumpH = h;
    this.jumpDur = dur;
  }

  squash(amt: number, hold = 0.12) {
    this.sqT = 0;
    this.sqAmt = amt;
    this.sqHold = hold;
  }

  update(dt: number) {
    if (this.backT > 0) {
      this.backT -= dt;
      if (this.backT <= 0) {
        this.offTo = 0;
        this.yawTo = 0;
        this.leanTo = 0;
        if (this.resume && this.g.player.currentAction !== this.base) this.toBase();
      }
    }
    if (!this.sustain && this.pitchT > 0) {
      this.pitchT -= dt;
      if (this.pitchT <= 0) this.tiltTo = this.stretchTo = 0;
    }
    this.apply(dt);
  }

  private apply(dt: number) {
    const g = this.g;
    const p = g.player;
    this.off = damp(this.off, this.offTo, 13, dt || 1);
    this.yaw = damp(this.yaw, this.yawTo, 10, dt || 1);
    this.lean = damp(this.lean, this.leanTo, 12, dt || 1);
    this.tilt = damp(this.tilt, this.tiltTo, 9, dt || 1);
    this.stretch = damp(this.stretch, this.stretchTo, 12, dt || 1);
    // jump arc
    let air = 0;
    if (this.jumpT >= 0) {
      this.jumpT += dt;
      const u = this.jumpT / this.jumpDur;
      if (u >= 1) {
        this.jumpT = -1;
        if (this.jumpH > 0.25) this.squash(0.45, 0.02); // landing squish
      } else air = Math.sin(u * PI) * this.jumpH;
    }
    // squash: quick down, short hold, springy recovery
    let sq = 0;
    if (this.sqT >= 0) {
      this.sqT += dt;
      const t = this.sqT;
      const down = 0.07;
      sq = t < down ? t / down : t < down + this.sqHold ? 1 : Math.max(0, 1 - (t - down - this.sqHold) / 0.28);
      if (sq <= 0 && t > down) this.sqT = -1;
      sq *= this.sqAmt;
    }
    const sy = 1 - 0.2 * sq + 0.045 * this.stretch;
    const sxz = 1 + 0.11 * sq - 0.02 * this.stretch;
    const { x, z, rot } = this.spot;
    p.root.position.set(x + Math.cos(rot) * this.off, 0, z - Math.sin(rot) * this.off);
    g.setFacing(rot + this.yaw);
    p.airborne = air;
    p.lean = this.lean;
    p.root.scale.set(sxz, sy, sxz);
    p.root.rotation.x = this.tilt;
  }
}
