import { Emitter } from '../core/Events';
import { appRoot, toAppX, toAppY } from '../core/Viewport';

const ax = (e: PointerEvent) => toAppX(e.clientX);
const ay = (e: PointerEvent) => toAppY(e.clientY);

type InputEvents = {
  action: [];
  menu: [];
  camReset: [];
  /** discrete swipe on the whole screen (minigames) */
  swipe: ['left' | 'right' | 'up' | 'down'];
  /** screen tap (x, y in px) — fired for taps not consumed by UI */
  tap: [number, number];
  key: [string];
};

/**
 * Keyboard + floating virtual joystick + camera swipe.
 * `move` is in screen space: x = right, y = up/forward. Magnitude 0..1.
 */
export class Input extends Emitter<InputEvents> {
  move = { x: 0, y: 0 };
  runHeld = false;
  camYaw = 0; // accumulated yaw delta (radians) — consumer resets
  enabled = true; // joystick & movement
  joystickEnabled = true;
  swipeCam = true;
  private keys = new Set<string>();
  private joy = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  private cam = { id: -1, x: 0 };
  private swipeStart = new Map<number, { x: number; y: number; t: number }>();
  private joyEl: HTMLDivElement;
  private knobEl: HTMLDivElement;

  constructor(private surface: HTMLElement) {
    super();
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.keys.clear());

    this.joyEl = document.createElement('div');
    this.joyEl.className = 'joy';
    this.knobEl = document.createElement('div');
    this.knobEl.className = 'joy-knob';
    this.joyEl.appendChild(this.knobEl);
    appRoot().appendChild(this.joyEl);

    surface.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.moveP(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    const k = e.code;
    if (down) {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (!this.keys.has(k)) {
        this.emit('key', k);
        if (k === 'KeyE' || k === 'Space' || k === 'Enter') this.emit('action');
        if (k === 'Escape') this.emit('menu');
        if (k === 'KeyC') this.emit('camReset');
        if (k === 'ArrowLeft' || k === 'KeyA') this.emit('swipe', 'left');
        if (k === 'ArrowRight' || k === 'KeyD') this.emit('swipe', 'right');
        if (k === 'ArrowUp' || k === 'KeyW' || k === 'Space') this.emit('swipe', 'up');
        if (k === 'ArrowDown' || k === 'KeyS') this.emit('swipe', 'down');
      }
      this.keys.add(k);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    } else this.keys.delete(k);
  }

  isDown(code: string) {
    return this.keys.has(code);
  }

  private down(e: PointerEvent) {
    const w = window.innerWidth;
    this.swipeStart.set(e.pointerId, { x: ax(e), y: ay(e), t: performance.now() });
    if (!this.enabled) return;
    if (this.joystickEnabled && ax(e) < w * 0.5 && this.joy.id < 0 && e.pointerType !== 'mouse') {
      this.joy = { id: e.pointerId, ox: ax(e), oy: ay(e), x: 0, y: 0 };
      this.joyEl.style.left = ax(e) + 'px';
      this.joyEl.style.top = ay(e) + 'px';
      this.joyEl.classList.add('on');
      this.knobEl.style.transform = 'translate(-50%,-50%)';
    } else if (this.joystickEnabled && e.pointerType === 'mouse' && e.button === 0 && ax(e) < w * 0.5 && this.joy.id < 0 && e.shiftKey) {
      // desktop mouse can also drive the joystick with shift-drag (debug/accessibility)
      this.joy = { id: e.pointerId, ox: ax(e), oy: ay(e), x: 0, y: 0 };
    } else if (this.swipeCam && this.cam.id < 0) {
      this.cam = { id: e.pointerId, x: ax(e) };
    }
  }

  private moveP(e: PointerEvent) {
    if (e.pointerId === this.joy.id) {
      const R = 56;
      let dx = ax(e) - this.joy.ox;
      let dy = ay(e) - this.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        // floating base follows the thumb when dragged far
        const k = (d - R) / d;
        this.joy.ox += dx * k;
        this.joy.oy += dy * k;
        dx = ax(e) - this.joy.ox;
        dy = ay(e) - this.joy.oy;
        this.joyEl.style.left = this.joy.ox + 'px';
        this.joyEl.style.top = this.joy.oy + 'px';
      }
      this.joy.x = dx / R;
      this.joy.y = -dy / R;
      this.knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    } else if (e.pointerId === this.cam.id) {
      const dx = ax(e) - this.cam.x;
      this.cam.x = ax(e);
      this.camYaw -= dx * 0.006;
    }
  }

  private up(e: PointerEvent) {
    const s = this.swipeStart.get(e.pointerId);
    this.swipeStart.delete(e.pointerId);
    if (s) {
      const dx = ax(e) - s.x;
      const dy = ay(e) - s.y;
      const dt = performance.now() - s.t;
      const d = Math.hypot(dx, dy);
      if (d > 36 && dt < 450) {
        if (Math.abs(dx) > Math.abs(dy)) this.emit('swipe', dx > 0 ? 'right' : 'left');
        else this.emit('swipe', dy > 0 ? 'down' : 'up');
      } else if (d < 12 && dt < 350 && e.target === this.surface) this.emit('tap', ax(e), ay(e));
    }
    if (e.pointerId === this.joy.id) {
      this.joy.id = -1;
      this.joy.x = this.joy.y = 0;
      this.joyEl.classList.remove('on');
    }
    if (e.pointerId === this.cam.id) this.cam.id = -1;
  }

  /** Release any held touches (called when UI opens). */
  releaseAll() {
    this.joy.id = -1;
    this.joy.x = this.joy.y = 0;
    this.cam.id = -1;
    this.joyEl.classList.remove('on');
  }

  update() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyQ')) this.camYaw += 0.03;
    if (k.has('KeyR')) this.camYaw -= 0.03;
    const kl = Math.hypot(x, y);
    if (kl > 0) { x /= kl; y /= kl; }
    let run = k.has('ShiftLeft') || k.has('ShiftRight');
    if (this.joy.id >= 0) {
      const jl = Math.hypot(this.joy.x, this.joy.y);
      if (jl > 0.12) {
        const m = Math.min(1, jl);
        x = (this.joy.x / jl) * m;
        y = (this.joy.y / jl) * m;
        if (jl > 0.92) run = true;
      }
    }
    if (!this.enabled) { x = 0; y = 0; run = false; }
    this.move.x = x;
    this.move.y = y;
    this.runHeld = run;
  }
}
