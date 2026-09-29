// Custom pastel icon drawings that replace every emoji in the game (the platform emoji fonts, e.g. Apple's, never show).
// Text keeps its emoji (so translations and code comparisons still work); they are swapped for SVG drawings when
// rendered: DOM text nodes via iconizeNode() (called by the i18n DOM observer), canvas text via drawIconText().
//
// STYLE GUIDE for the drawings (setA–setE): viewBox "0 0 64 64", artwork inside 4–60. Soft plum-ink outline
// #5B4A5E, stroke-width 3 (details 2–2.5), round joins and caps. Flat pastel fills from the game palette: pink #FFC4D6,
// strawberry #FF7A93, peach #FFD6B8, butter #FFE9A8, mint #BFF0DA, sky #B2D9FF, lavender #E6B2FF, cream #FFF6EC,
// white #FFFFFF, wood #E8C39E (deeper accents #FF9DB3 #8FC9F0 #9BD9BD #C9A4F0 #F5C26B). A small white highlight
// (opacity ≈.7) on round shapes. Faces: dot eyes #5B4A5E, pink blush #FF9DB3 at ≈.6 opacity, tiny smile.
// Chunky, rounded, cute, readable at 16–20px. No text, no filters, no external refs, ideally < 1.5 KB each.
import { SET_A } from './setA';
import { SET_B } from './setB';
import { SET_C } from './setC';
import { SET_D } from './setD';
import { SET_E } from './setE';

const ICONS: Record<string, string> = { ...SET_A, ...SET_B, ...SET_C, ...SET_D, ...SET_E };

const seg = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
/** Anything that could be drawn by an emoji font. */
const MAYBE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|️/u;
/** Emoji that platforms draw in colour even without FE0F (these must never reach the screen unmapped). */
const COLOUR = /\p{Emoji_Presentation}|️|‍|\p{Regional_Indicator}/u;

export const iconKey = (g: string) => g.replace(/[︎️]/g, '');
export const hasIcon = (g: string) => iconKey(g) in ICONS;
export const iconKeys = () => Object.keys(ICONS);
export const mayHaveEmoji = (s: string) => MAYBE.test(s);

function graphemes(s: string): string[] {
  if (seg) return [...seg.segment(s)].map((x) => x.segment);
  return Array.from(s);
}

export type Piece = string | { icon: string };
/** Split text into plain runs and icons. Unmapped colour emoji are dropped; text symbols (♡ ♪ ★ …) stay text. */
export function splitIcons(s: string): Piece[] {
  const out: Piece[] = [];
  let run = '';
  for (const g of graphemes(s)) {
    if (!MAYBE.test(g)) { run += g; continue; }
    const k = iconKey(g);
    if (k in ICONS) {
      if (run) { out.push(run); run = ''; }
      out.push({ icon: k });
    } else if (COLOUR.test(g)) {
      if (import.meta.env.DEV) console.warn('no icon for', g);
    } else run += g;
  }
  if (run) out.push(run);
  return out;
}

// ---------------------------------------------------------------- DOM
const cls = new Map<string, string>();
let sheet: CSSStyleSheet | null = null;
function iconClass(k: string) {
  let c = cls.get(k);
  if (!c) {
    c = 'ic-' + [...k].map((ch) => ch.codePointAt(0)!.toString(16)).join('-');
    cls.set(k, c);
    if (!sheet) {
      const st = document.createElement('style');
      st.id = 'icon-sheet';
      document.head.appendChild(st);
      sheet = st.sheet!;
    }
    sheet.insertRule(`.${c}{background-image:url("${iconUrl(k)}")}`, sheet.cssRules.length);
  }
  return c;
}

export function iconUrl(k: string) {
  return 'data:image/svg+xml,' + encodeURIComponent(ICONS[iconKey(k)] ?? '');
}

/** An inline icon element (keeps the emoji as invisible text so textContent / copy still read the same). */
export function iconEl(k: string) {
  const s = document.createElement('span');
  s.className = 'ic ' + iconClass(iconKey(k));
  s.setAttribute('role', 'img');
  s.setAttribute('aria-label', k);
  const t = document.createElement('span');
  t.className = 'ic-t';
  t.textContent = k;
  s.appendChild(t);
  return s;
}

/** Replace emoji in a text node (or every text node under an element) with icon drawings. */
export function iconizeNode(n: Node) {
  if (n.nodeType === Node.TEXT_NODE) {
    const t = n.nodeValue;
    if (!t || !MAYBE.test(t)) return;
    const p = n.parentElement;
    if (!p || p.classList.contains('ic-t') || p.tagName === 'SCRIPT' || p.tagName === 'STYLE' || p.tagName === 'TEXTAREA') return;
    if (p.tagName === 'OPTION' || p.tagName === 'TITLE') {
      // can't hold elements: just drop the emoji
      const plain = splitIcons(t).filter((x): x is string => typeof x === 'string').join('');
      if (plain !== t) n.nodeValue = plain;
      return;
    }
    const parts = splitIcons(t);
    if (parts.length === 1 && typeof parts[0] === 'string') {
      if (parts[0] !== t) n.nodeValue = parts[0];
      return;
    }
    const f = document.createDocumentFragment();
    for (const x of parts) f.appendChild(typeof x === 'string' ? document.createTextNode(x) : iconEl(x.icon));
    p.replaceChild(f, n);
    return;
  }
  if (n.nodeType === Node.ELEMENT_NODE) {
    const el = n as HTMLElement;
    if (el.classList.contains('ic') || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
    for (const a of ['aria-label', 'title', 'placeholder']) {
      const v = el.getAttribute(a);
      if (v && MAYBE.test(v)) el.setAttribute(a, splitIcons(v).filter((x): x is string => typeof x === 'string').join('').trim());
    }
    if (!MAYBE.test(el.textContent ?? '')) return;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const list: Node[] = [];
    let t: Node | null;
    while ((t = w.nextNode())) list.push(t);
    for (const x of list) iconizeNode(x);
  }
}

// ---------------------------------------------------------------- canvas
const imgs = new Map<string, HTMLImageElement>();
/** Decode every icon once so canvas signs can draw them synchronously. Call before building scenes. */
export function preloadIconImages() {
  return Promise.all(Object.keys(ICONS).map((k) => {
    const im = new Image();
    im.src = iconUrl(k);
    imgs.set(k, im);
    return im.decode().catch(() => {});
  }));
}

function fontPx(ctx: CanvasRenderingContext2D) {
  const m = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
  return m ? parseFloat(m[1]) : 16;
}

type TextFn = (this: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number) => void;
type MeasureFn = (this: CanvasRenderingContext2D, text: string) => TextMetrics;

/** Width of text with icons (icons are 1.15em wide incl. a little gap). */
export function measureIconText(ctx: CanvasRenderingContext2D, parts: Piece[], measure: MeasureFn) {
  const em = fontPx(ctx);
  let w = 0;
  for (const p of parts) w += typeof p === 'string' ? measure.call(ctx, p).width : em * 1.15;
  return w;
}

/** fillText / strokeText replacement for text containing emoji: draws text runs + icon images. */
export function drawIconText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number | undefined, draw: TextFn, measure: MeasureFn, withIcons: boolean) {
  const parts = splitIcons(text);
  if (parts.length === 1 && typeof parts[0] === 'string') return maxWidth === undefined ? draw.call(ctx, parts[0], x, y) : draw.call(ctx, parts[0], x, y, maxWidth);
  const em = fontPx(ctx);
  const total = measureIconText(ctx, parts, measure);
  const k = maxWidth !== undefined && total > maxWidth ? maxWidth / total : 1;
  const align = ctx.textAlign;
  const rtl = ctx.direction === 'rtl';
  let x0 = x;
  if (align === 'center') x0 = x - (total * k) / 2;
  else if (align === 'right' || (align === 'end' && !rtl) || (align === 'start' && rtl)) x0 = x - total * k;
  const base = ctx.textBaseline;
  const size = em * 1.05;
  const top = base === 'middle' ? y - size / 2 : base === 'top' || base === 'hanging' ? y : base === 'bottom' || base === 'ideographic' ? y - size : y - size * 0.82;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.translate(x0, 0);
  ctx.scale(k, 1);
  let cx = 0;
  for (const p of parts) {
    if (typeof p === 'string') {
      draw.call(ctx, p, cx, y);
      cx += measure.call(ctx, p).width;
    } else {
      if (withIcons) {
        const im = imgs.get(p.icon);
        if (im && im.complete && im.naturalWidth) ctx.drawImage(im, cx + em * 0.05, top, size, size);
      }
      cx += em * 1.15;
    }
  }
  ctx.restore();
}
