import { Emitter } from '../core/Events';
import { appRoot, toAppX, toAppY } from '../core/Viewport';

/** One finger / mouse / pen, normalised from Pointer Events or Touch Events (x, y in #app px). */
interface Ptr { id: number; type: string; x: number; y: number; button: number; shift: boolean; target: EventTarget | null }
const fromPointer = (e: PointerEvent): Ptr => ({
  id: e.pointerId, type: e.pointerType, x: toAppX(e.clientX), y: toAppY(e.clientY), button: e.button, shift: e.shiftKey, target: e.target,
});
/** Touch ids live in their own range so they can never collide with pointer ids. */
const fromTouch = (t: Touch, e: TouchEvent): Ptr => ({
  id: 100000 + t.identifier, type: 'touch', x: toAppX(t.clientX), y: toAppY(t.clientY), button: 0, shift: false, target: t.target ?? e.target,
});
/**
 * Fingers are read from Touch Events wherever they exist (every phone browser and in-app browser): some browsers
 * (notably iOS Safari) cancel a Pointer Events drag they think is a page scroll/zoom, and a few embedded browsers
 * lack Pointer Events. The mouse and pens still use Pointer Events.
 */
const TOUCH_EVENTS = typeof window !== 'undefined' && 'ontouchstart' in window;

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
 * Keyboard + floating virtual joystick + camera controls.
 * `move` is in screen space: x = right, y = up/forward. Magnitude 0..1.
 * Camera: drag (touch: right half) turns / tilts, two-finger pinch or the mouse wheel zooms, Q/R turn, +/- zoom.
 */
export class Input extends Emitter<InputEvents> {
  move = { x: 0, y: 0 };
  runHeld = false;
  camYaw = 0; // accumulated yaw delta (radians) — consumer resets
  camPitch = 0; // accumulated tilt delta (radians, + = look from higher) — consumer resets
  camZoom = 0; // accumulated zoom delta (+ = closer) — consumer resets
  enabled = true; // joystick & movement
  joystickEnabled = true;
  swipeCam = true;
  private keys = new Set<string>();
  // null = no finger. (Not -1: iOS WebKit hands out huge touch identifiers that can wrap negative, which made an
  // "id >= 0" check treat the joystick finger as absent — the knob showed but Hamin never walked.)
  private joy: { id: number | null; ox: number; oy: number; x: number; y: number } = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  private cam: { id: number | null; x: number; y: number } = { id: null, x: 0, y: 0 };
  /** live positions of pointers that started on the game surface (for pinch) */
  private pts = new Map<number, { x: number; y: number }>();
  private pinch: { a: number; b: number; d: number } | null = null;
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

    const usePointer = (e: PointerEvent) => !(TOUCH_EVENTS && e.pointerType === 'touch');
    surface.addEventListener('pointerdown', (e) => usePointer(e) && this.down(fromPointer(e)));
    window.addEventListener('pointermove', (e) => usePointer(e) && this.moveP(fromPointer(e)));
    window.addEventListener('pointerup', (e) => usePointer(e) && this.up(fromPointer(e)));
    window.addEventListener('pointercancel', (e) => usePointer(e) && this.up(fromPointer(e)));
    surface.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.swipeCam) this.camZoom -= Math.sign(e.deltaY) * Math.min(0.12, Math.abs(e.deltaY) * 0.0016);
    }, { passive: false });
    if (TOUCH_EVENTS) {
      // only fingers that started on the game are ours; their moves must not scroll / zoom the page
      const ours = new Set<number>();
      surface.addEventListener('touchstart', (e) => {
        for (const t of Array.from(e.changedTouches)) {
          ours.add(t.identifier);
          this.down(fromTouch(t, e));
        }
      }, { passive: true });
      window.addEventListener('touchmove', (e) => {
        let mine = false;
        for (const t of Array.from(e.changedTouches)) {
          if (!ours.has(t.identifier)) continue;
          mine = true;
          this.moveP(fromTouch(t, e));
        }
        if (mine && e.cancelable) e.preventDefault();
      }, { passive: false });
      const end = (e: TouchEvent) => {
        for (const t of Array.from(e.changedTouches)) {
          if (!ours.delete(t.identifier)) continue;
          this.up(fromTouch(t, e));
        }
      };
      window.addEventListener('touchend', end);
      window.addEventListener('touchcancel', end);
      // Safari's own page pinch-zoom would fight the camera pinch
      document.addEventListener('gesturestart', (e) => e.preventDefault());
    }
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

  private down(e: Ptr) {
    const w = window.innerWidth;
    const now = performance.now();
    this.swipeStart.set(e.id, { x: e.x, y: e.y, t: now });
    if (!this.enabled) return;
    // a second finger landing right after the first (before it has moved much) = pinch, wherever it started
    if (e.type !== 'mouse' && this.swipeCam && !this.pinch && this.pts.size === 1) {
      const [[id0, p0]] = [...this.pts];
      const s0 = this.swipeStart.get(id0);
      const moved = s0 ? Math.hypot(p0.x - s0.x, p0.y - s0.y) : 99;
      if ((s0 && now - s0.t < 300 && moved < 14) || id0 === this.cam.id) {
        if (id0 === this.joy.id) this.releaseJoy();
        this.cam = { id: null, x: 0, y: 0 };
        this.pts.set(e.id, { x: e.x, y: e.y });
        this.pinch = { a: id0, b: e.id, d: Math.hypot(e.x - p0.x, e.y - p0.y) };
        return;
      }
    }
    if (e.type !== 'mouse') this.pts.set(e.id, { x: e.x, y: e.y });
    if (this.joystickEnabled && e.x < w * 0.5 && this.joy.id === null && e.type !== 'mouse') {
      this.joy = { id: e.id, ox: e.x, oy: e.y, x: 0, y: 0 };
      this.joyEl.style.left = e.x + 'px';
      this.joyEl.style.top = e.y + 'px';
      this.joyEl.classList.add('on');
      this.knobEl.style.transform = 'translate(-50%,-50%)';
    } else if (this.joystickEnabled && e.type === 'mouse' && e.button === 0 && e.x < w * 0.5 && this.joy.id === null && e.shift) {
      // desktop mouse can also drive the joystick with shift-drag (debug/accessibility)
      this.joy = { id: e.id, ox: e.x, oy: e.y, x: 0, y: 0 };
    } else if (this.swipeCam && this.cam.id === null) {
      this.cam = { id: e.id, x: e.x, y: e.y };
    }
  }

  private releaseJoy() {
    this.joy.id = null;
    this.joy.x = this.joy.y = 0;
    this.joyEl.classList.remove('on');
  }

  private moveP(e: Ptr) {
    if (this.pts.has(e.id)) this.pts.set(e.id, { x: e.x, y: e.y });
    if (e.id === this.joy.id) {
      const R = 56;
      let dx = e.x - this.joy.ox;
      let dy = e.y - this.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        // floating base follows the thumb when dragged far
        const k = (d - R) / d;
        this.joy.ox += dx * k;
        this.joy.oy += dy * k;
        dx = e.x - this.joy.ox;
        dy = e.y - this.joy.oy;
        this.joyEl.style.left = this.joy.ox + 'px';
        this.joyEl.style.top = this.joy.oy + 'px';
      }
      this.joy.x = dx / R;
      this.joy.y = -dy / R;
      this.knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      return;
    }
    if (this.pinch && (e.id === this.pinch.a || e.id === this.pinch.b)) {
      const a = this.pts.get(this.pinch.a), b = this.pts.get(this.pinch.b);
      if (a && b) {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.camZoom += (d - this.pinch.d) * 0.0045;
        this.pinch.d = d;
      }
      return;
    }
    if (e.id === this.cam.id) {
      const dx = e.x - this.cam.x, dy = e.y - this.cam.y;
      this.cam.x = e.x;
      this.cam.y = e.y;
      this.camYaw -= dx * 0.007;
      this.camPitch += dy * 0.004;
    }
  }

  private up(e: Ptr) {
    const s = this.swipeStart.get(e.id);
    this.swipeStart.delete(e.id);
    if (s) {
      const dx = e.x - s.x;
      const dy = e.y - s.y;
      const dt = performance.now() - s.t;
      const d = Math.hypot(dx, dy);
      if (d > 36 && dt < 450) {
        if (Math.abs(dx) > Math.abs(dy)) this.emit('swipe', dx > 0 ? 'right' : 'left');
        else this.emit('swipe', dy > 0 ? 'down' : 'up');
      } else if (d < 12 && dt < 350 && e.target === this.surface) this.emit('tap', e.x, e.y);
    }
    if (e.id === this.joy.id) this.releaseJoy();
    this.pts.delete(e.id);
    if (this.pinch && (e.id === this.pinch.a || e.id === this.pinch.b)) {
      // the finger that stays down keeps turning the camera
      const other = e.id === this.pinch.a ? this.pinch.b : this.pinch.a;
      this.pinch = null;
      const o = this.pts.get(other);
      this.cam = o ? { id: other, x: o.x, y: o.y } : { id: null, x: 0, y: 0 };
      return;
    }
    if (e.id === this.cam.id) this.cam.id = null;
  }

  /** Release any held touches (called when UI opens). */
  releaseAll() {
    this.joy.id = null;
    this.joy.x = this.joy.y = 0;
    this.cam.id = null;
    this.pinch = null;
    this.pts.clear();
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
    if (k.has('Equal') || k.has('NumpadAdd')) this.camZoom += 0.025;
    if (k.has('Minus') || k.has('NumpadSubtract')) this.camZoom -= 0.025;
    const kl = Math.hypot(x, y);
    if (kl > 0) { x /= kl; y /= kl; }
    let run = k.has('ShiftLeft') || k.has('ShiftRight');
    if (this.joy.id !== null) {
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
