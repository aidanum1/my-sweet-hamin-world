// Landscape-first presentation (like Animal Crossing / Heartopia):
//  • phones held upright → a cute "turn your phone sideways" screen (game paused)
//  • tall/narrow desktop windows → the game is framed in a centred 16:9 stage
// Everything inside #app (canvas + UI) sees the stage size as window.innerWidth/innerHeight,
// and #app is the containing block for position:fixed UI, so the rest of the code needn't care.
import { isTouch } from '../utils/math';

const MIN_ASPECT = 1.3; // narrower than this on desktop → letterbox to 16:9
const STAGE_ASPECT = 16 / 9;

const origW = Object.getOwnPropertyDescriptor(window, 'innerWidth') ?? Object.getOwnPropertyDescriptor(Window.prototype, 'innerWidth');
const origH = Object.getOwnPropertyDescriptor(window, 'innerHeight') ?? Object.getOwnPropertyDescriptor(Window.prototype, 'innerHeight');
const realW = () => (origW?.get ? (origW.get.call(window) as number) : document.documentElement.clientWidth);
const realH = () => (origH?.get ? (origH.get.call(window) as number) : document.documentElement.clientHeight);

export const frame = { x: 0, y: 0, w: 1, h: 1, scale: 1, rotate: false, letterbox: false };
/** Small desktop stages are rendered at this logical height and scaled down, so the UI keeps its proportions. */
const MIN_LOGICAL_H = 560;
let app: HTMLElement;
let rotateEl: HTMLDivElement;
const listeners = new Set<(rotate: boolean) => void>();

export const appRoot = () => app;
/** Convert a viewport clientX/Y into #app-local coordinates. */
export const toAppX = (x: number) => (x - frame.x) / frame.scale;
export const toAppY = (y: number) => (y - frame.y) / frame.scale;
/** Convert a viewport DOMRect to #app-local coordinates. */
export const toAppRect = (r: DOMRect) => ({ left: toAppX(r.left), top: toAppY(r.top), right: toAppX(r.right), bottom: toAppY(r.bottom), width: r.width / frame.scale, height: r.height / frame.scale });
export const onRotateChange = (fn: (rotate: boolean) => void) => listeners.add(fn);

function update() {
  const W = realW(), H = realH();
  const touch = isTouch();
  const wasRotate = frame.rotate;
  frame.rotate = touch && H > W;
  let w = W, h = H;
  frame.letterbox = false;
  if (!frame.rotate && W / H < MIN_ASPECT) {
    frame.letterbox = true;
    w = W;
    h = Math.round(W / STAGE_ASPECT);
    if (h > H) { h = H; w = Math.round(H * STAGE_ASPECT); }
  }
  frame.x = Math.round((W - w) / 2);
  frame.y = Math.round((H - h) / 2);
  frame.scale = !touch && h < MIN_LOGICAL_H ? h / MIN_LOGICAL_H : 1;
  frame.w = Math.round(w / frame.scale);
  frame.h = Math.round(h / frame.scale);
  Object.assign(app.style, {
    left: frame.x + 'px', top: frame.y + 'px', width: frame.w + 'px', height: frame.h + 'px',
    transform: frame.scale === 1 ? 'translateZ(0)' : `translateZ(0) scale(${frame.scale})`, transformOrigin: '0 0',
  });
  document.body.classList.toggle('letterbox', frame.letterbox);
  rotateEl.classList.toggle('on', frame.rotate);
  if (wasRotate !== frame.rotate) for (const l of listeners) l(frame.rotate);
}

export function initViewport() {
  app = document.getElementById('app')!;
  rotateEl = document.createElement('div');
  rotateEl.className = 'rotate-screen';
  rotateEl.innerHTML = `<div class="rs-phone"><div class="rs-screen">🐑</div></div>
    <div class="rs-title">Turn your phone sideways ♡</div>
    <div class="rs-sub">My Sweet Hamin World is played in landscape, just like a little handheld game.</div>`;
  document.body.appendChild(rotateEl);
  // the stage must never scroll (focus/scrollIntoView could otherwise shift the whole UI)
  app.addEventListener('scroll', () => { app.scrollTop = 0; app.scrollLeft = 0; });
  window.addEventListener('scroll', () => window.scrollTo(0, 0));
  Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => frame.w });
  Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => frame.h });
  update();
  // registered before the engine's own resize listener, so it sees the new frame
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', () => setTimeout(() => { update(); window.dispatchEvent(new Event('resize')); }, 200));
  window.visualViewport?.addEventListener('resize', () => { update(); });
}

/** Best effort on Android/Chrome: go fullscreen and lock landscape (must run in a user gesture). */
export async function tryLandscapeLock() {
  if (!isTouch()) return;
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
    await (screen.orientation as any)?.lock?.('landscape');
  } catch {
    /* iOS Safari and desktop don't support this; the rotate screen covers it */
  }
}
