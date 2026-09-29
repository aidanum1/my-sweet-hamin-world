// Tiny i18n layer for English / 中文 / 日本語 / 한국어.
// Source strings stay in English in the code. `tr()` looks them up in the language dictionary
// (exact match first, then {0}-style templates for strings with numbers or names). Beyond the explicit
// tr() calls in the UI, a DOM observer translates any text that appears under #app, and canvas
// fillText/strokeText are wrapped so 3D signs are translated too.

import { iconizeNode, drawIconText, measureIconText, mayHaveEmoji, splitIcons } from '../ui/icons';

export type Lang = 'en' | 'zh' | 'ja' | 'ko';
export const LANGS: { id: Lang; label: string; flag: string }[] = [
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'zh', label: '中文', flag: '🇨🇳' },
  { id: 'ja', label: '日本語', flag: '🇯🇵' },
  { id: 'ko', label: '한국어', flag: '🇰🇷' },
];

type Dict = Record<string, string>;
let lang: Lang = 'en';
let dict: Dict = {};
let patterns: { re: RegExp; out: string; order: number[] }[] = [];
const cache = new Map<string, string>();
const listeners = new Set<(l: Lang) => void>();

const extras = import.meta.glob('./extra/*.json');

const loaders: Record<Exclude<Lang, 'en'>, () => Promise<{ default: Dict }>> = {
  zh: () => import('./zh.json'),
  ja: () => import('./ja.json'),
  ko: () => import('./ko.json'),
};

export const getLang = () => lang;
export const onLangChange = (fn: (l: Lang) => void) => listeners.add(fn);

export function detectLang(): Lang {
  const n = (navigator.language || 'en').toLowerCase();
  if (n.startsWith('zh')) return 'zh';
  if (n.startsWith('ja')) return 'ja';
  if (n.startsWith('ko')) return 'ko';
  return 'en';
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function setLang(l: Lang) {
  if (l === 'en') {
    dict = {};
    patterns = [];
  } else {
    try {
      dict = { ...(await loaders[l]()).default };
    } catch {
      dict = {};
    }
    // feature-specific dictionaries: src/i18n/extra/<feature>.<lang>.json (merged on top)
    for (const [path, load] of Object.entries(extras)) {
      if (!path.endsWith(`.${l}.json`)) continue;
      try { Object.assign(dict, ((await load()) as { default: Dict }).default); } catch { /* ignore */ }
    }
    patterns = [];
    for (const [k, v] of Object.entries(dict)) {
      if (!/\{\d\}/.test(k)) continue;
      // placeholder numbers in order of appearance (keys may use {4}{5}… from split templates)
      const order = [...k.matchAll(/\{(\d)\}/g)].map((m) => +m[1]);
      const src = '^' + escapeRe(k).replace(/\\\{(\d)\\\}/g, '(.*?)') + '$';
      patterns.push({ re: new RegExp(src, 's'), out: v, order });
    }
    // longer templates first (more specific)
    patterns.sort((a, b) => b.re.source.length - a.re.source.length);
  }
  lang = l;
  cache.clear();
  document.documentElement.lang = l === 'zh' ? 'zh-Hans' : l;
  document.body.classList.remove('lang-en', 'lang-zh', 'lang-ja', 'lang-ko');
  document.body.classList.add('lang-' + l);
  for (const fn of listeners) fn(l);
}

/** Translate an English source string (whole string, trimmed whitespace preserved). */
export function tr(s: string): string {
  if (lang === 'en' || !s) return s;
  const hit = cache.get(s);
  if (hit !== undefined) return hit;
  const lead = s.match(/^\s*/)![0];
  const trail = s.match(/\s*$/)![0];
  const core = s.trim();
  let out: string | undefined = dict[core];
  if (out === undefined && core) {
    for (const p of patterns) {
      const m = core.match(p.re);
      if (m) {
        out = p.out.replace(/\{(\d)\}/g, (_, i) => tr(m[p.order.indexOf(+i) + 1] ?? ''));
        break;
      }
    }
  }
  const res = out === undefined ? s : lead + out + trail;
  if (cache.size > 4000) cache.clear();
  cache.set(s, res);
  return res;
}

/** Translate a template containing {0}… then fill in the values: trf('Best score: {0}', 120). */
export function trf(template: string, ...args: (string | number)[]) {
  return tr(template).replace(/\{(\d)\}/g, (_, i) => String(args[+i] ?? ''));
}

// ---------------------------------------------------------------- DOM + canvas hooks
const SKIP = new Set(['SCRIPT', 'STYLE', 'CANVAS', 'KBD']);
function translateNode(n: Node) {
  if (lang === 'en') return;
  if (n.nodeType === Node.TEXT_NODE) {
    const t = n.nodeValue;
    if (!t || !/[A-Za-z]/.test(t)) return;
    const p = (n as Text).parentElement;
    if (p && (SKIP.has(p.tagName) || p.closest('[data-no-tr]'))) return;
    const out = tr(t);
    if (out !== t) n.nodeValue = out;
    return;
  }
  if (n.nodeType === Node.ELEMENT_NODE) {
    const el = n as HTMLElement;
    if (SKIP.has(el.tagName) || el.hasAttribute('data-no-tr')) return;
    for (const a of ['aria-label', 'title', 'placeholder']) {
      const v = el.getAttribute(a);
      if (v) { const o = tr(v); if (o !== v) el.setAttribute(a, o); }
    }
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let t: Node | null;
    const list: Node[] = [];
    while ((t = w.nextNode())) list.push(t);
    for (const x of list) translateNode(x);
  }
}

let observer: MutationObserver | null = null;
/** Translate (when not English) and swap emoji for icon drawings in every DOM change under root. */
export function startDomTranslation(root: HTMLElement) {
  observer?.disconnect();
  const visit = (n: Node) => {
    translateNode(n);
    iconizeNode(n);
  };
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') visit(m.target);
      else m.addedNodes.forEach(visit);
    }
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  visit(root);
}

/** Wrap canvas text drawing so every sign / board / menu texture is translated and draws icons, not emoji. */
export function hookCanvasText() {
  const P = CanvasRenderingContext2D.prototype;
  const fill = P.fillText, stroke = P.strokeText, measure = P.measureText;
  P.fillText = function (text: string, x: number, y: number, maxWidth?: number) {
    const t = tr(String(text));
    if (mayHaveEmoji(t)) return drawIconText(this, t, x, y, maxWidth, fill, measure, true);
    return maxWidth === undefined ? fill.call(this, t, x, y) : fill.call(this, t, x, y, maxWidth);
  };
  P.strokeText = function (text: string, x: number, y: number, maxWidth?: number) {
    const t = tr(String(text));
    if (mayHaveEmoji(t)) return drawIconText(this, t, x, y, maxWidth, stroke, measure, false);
    return maxWidth === undefined ? stroke.call(this, t, x, y) : stroke.call(this, t, x, y, maxWidth);
  };
  P.measureText = function (text: string) {
    const t = tr(String(text));
    if (!mayHaveEmoji(t)) return measure.call(this, t);
    const m = measure.call(this, t.replace(/\p{Extended_Pictographic}|\p{Regional_Indicator}|\uFE0F|\u200D/gu, ''));
    const width = measureIconText(this, splitIcons(t), measure);
    return {
      width,
      actualBoundingBoxLeft: m.actualBoundingBoxLeft,
      actualBoundingBoxRight: width - m.actualBoundingBoxLeft,
      actualBoundingBoxAscent: m.actualBoundingBoxAscent,
      actualBoundingBoxDescent: m.actualBoundingBoxDescent,
      fontBoundingBoxAscent: m.fontBoundingBoxAscent,
      fontBoundingBoxDescent: m.fontBoundingBoxDescent,
      alphabeticBaseline: m.alphabeticBaseline,
      hangingBaseline: m.hangingBaseline,
      ideographicBaseline: m.ideographicBaseline,
      emHeightAscent: m.emHeightAscent,
      emHeightDescent: m.emHeightDescent,
    } as TextMetrics;
  };
}
