import * as THREE from 'three';

export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, sharedTex = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  if (sharedTex) t.userData.shared = true;
  return t;
}

const sharedTex = new Map<string, THREE.Texture>();
function once(key: string, make: () => THREE.Texture) {
  let t = sharedTex.get(key);
  if (!t) {
    t = make();
    t.userData.shared = true;
    sharedTex.set(key, t);
  }
  return t;
}

export function blobShadowTex() {
  return once('blob', () =>
    canvasTex(64, 64, (g) => {
      const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
      grd.addColorStop(0, 'rgba(120,110,160,0.45)');
      grd.addColorStop(0.6, 'rgba(120,110,160,0.22)');
      grd.addColorStop(1, 'rgba(120,110,160,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
    }),
  );
}

export function heartPath(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.beginPath();
  g.moveTo(x, y + s * 0.35);
  g.bezierCurveTo(x, y, x - s * 0.5, y - s * 0.05, x - s * 0.5, y + s * 0.3);
  g.bezierCurveTo(x - s * 0.5, y + s * 0.6, x - s * 0.1, y + s * 0.75, x, y + s * 0.95);
  g.bezierCurveTo(x + s * 0.1, y + s * 0.75, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  g.bezierCurveTo(x + s * 0.5, y - s * 0.05, x, y, x, y + s * 0.35);
  g.closePath();
}

export function heartTex() {
  return once('heart', () =>
    canvasTex(64, 64, (g) => {
      heartPath(g, 32, 6, 54);
      g.fillStyle = '#FF7A93';
      g.fill();
      g.lineWidth = 5;
      g.strokeStyle = '#fff';
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.beginPath();
      g.ellipse(21, 22, 5, 7, -0.5, 0, Math.PI * 2);
      g.fill();
    }),
  );
}

export function sparkleTex() {
  return once('sparkle', () =>
    canvasTex(64, 64, (g) => {
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 30);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.25, 'rgba(255,240,250,0.8)');
      grd.addColorStop(1, 'rgba(255,220,240,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#fff';
      g.beginPath();
      g.moveTo(32, 2);
      g.quadraticCurveTo(35, 29, 62, 32);
      g.quadraticCurveTo(35, 35, 32, 62);
      g.quadraticCurveTo(29, 35, 2, 32);
      g.quadraticCurveTo(29, 29, 32, 2);
      g.fill();
    }),
  );
}

export function noteTex() {
  return once('note', () =>
    canvasTex(64, 64, (g) => {
      g.font = 'bold 50px Nunito, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 6;
      g.strokeStyle = '#fff';
      g.strokeText('♪', 32, 34);
      g.fillStyle = '#9b8cf0';
      g.fillText('♪', 32, 34);
    }),
  );
}

export interface SignOpts {
  bg?: string;
  fg?: string;
  font?: string;
  border?: string;
  radius?: number;
  sub?: string;
  subColor?: string;
}

/** Rounded sign with text; returns a textured plane mesh (not batchable). */
export function signTexture(text: string, w = 256, h = 96, o: SignOpts = {}) {
  return canvasTex(w, h, (g) => {
    const r = o.radius ?? 26;
    g.fillStyle = o.bg ?? '#FFF6E8';
    roundRect(g, 4, 4, w - 8, h - 8, r);
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = o.border ?? '#FFB3C1';
    g.setLineDash([10, 8]);
    roundRect(g, 12, 12, w - 24, h - 24, r * 0.7);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = o.fg ?? '#364049';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = Math.floor(h * 0.36);
    g.font = o.font ?? `900 ${size}px Nunito, sans-serif`;
    // shrink to fit (translated text can be wider)
    while (!o.font && size > 10 && g.measureText(text).width > w - 40) { size -= 2; g.font = `900 ${size}px Nunito, sans-serif`; }
    g.fillText(text, w / 2, o.sub ? h * 0.42 : h / 2 + 2);
    if (o.sub) {
      g.fillStyle = o.subColor ?? '#FF7A93';
      g.font = `800 ${Math.floor(h * 0.2)}px Nunito, sans-serif`;
      g.fillText(o.sub, w / 2, h * 0.73);
    }
  });
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function skyTexture(top: string, bottom: string, mid?: string) {
  return canvasTex(8, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, top);
    if (mid) grd.addColorStop(0.55, mid);
    grd.addColorStop(1, bottom);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
}

// ---------------------------------------------------------------- painted art (Higgsfield) + surfaces
const artCache = new Map<string, THREE.Texture>();
/** Painted backdrops / window views generated with Higgsfield (public/art/*.webp). */
export function artTex(name: 'sky_day' | 'sky_sunset' | 'sky_title' | 'window_view') {
  let t = artCache.get(name);
  if (!t) {
    t = new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'art/' + name + '.webp');
    t.colorSpace = THREE.SRGBColorSpace;
    t.userData.shared = true;
    artCache.set(name, t);
  }
  return t;
}

const hexCss = (c: number) => '#' + c.toString(16).padStart(6, '0');
function shade(c: number, k: number) {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k)), g = Math.min(255, Math.round(((c >> 8) & 255) * k)), b = Math.min(255, Math.round((c & 255) * k));
  return `rgb(${r},${g},${b})`;
}
function rnd(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function repeatTex(t: THREE.CanvasTexture, rx: number, ry: number) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
  return t;
}

/** Warm wooden planks with soft grain. One tile = 4 planks. */
export function woodTex(c1: number, c2: number, rx = 1, ry = 1) {
  return repeatTex(canvasTex(256, 256, (g) => {
    const r = rnd(7);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = hexCss(i % 2 ? c1 : c2);
      g.fillRect(i * 64, 0, 64, 256);
      g.strokeStyle = shade(i % 2 ? c1 : c2, 0.93);
      g.lineWidth = 1.2;
      for (let k = 0; k < 7; k++) { const x = i * 64 + 6 + r() * 52; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 4, 80, x - 4, 170, x + 2, 256); g.stroke(); }
      g.fillStyle = shade(i % 2 ? c1 : c2, 0.8);
      g.fillRect(i * 64, 0, 2, 256);
      const cut = 40 + r() * 170;
      g.fillRect(i * 64, cut, 64, 2);
      g.fillStyle = shade(c1, 0.85);
      g.beginPath(); g.arc(i * 64 + 32, cut + 8 + r() * 30, 2.5, 0, Math.PI * 2); g.fill();
    }
  }), rx, ry);
}

/** Soft checker / tiles with rounded grout. */
export function tileTex(c1: number, c2: number, rx = 1, ry = 1) {
  return repeatTex(canvasTex(256, 256, (g) => {
    g.fillStyle = shade(c1, 0.9);
    g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      g.fillStyle = hexCss((x + y) % 2 ? c1 : c2);
      roundRect(g, x * 128 + 4, y * 128 + 4, 120, 120, 16);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      roundRect(g, x * 128 + 14, y * 128 + 12, 50, 10, 5);
      g.fill();
    }
  }), rx, ry);
}

/** Grass with blades, mown stripes and tiny flowers. */
export function grassTex(c: number, rx = 1, ry = 1) {
  return repeatTex(canvasTex(256, 256, (g) => {
    const r = rnd(11);
    g.fillStyle = hexCss(c);
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 900; i++) {
      const x = r() * 256, y = r() * 256;
      g.strokeStyle = r() < 0.5 ? shade(c, 0.88) : shade(c, 1.07);
      g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 4 - r() * 4); g.stroke();
    }
    const fl = ['#ffffff', '#ffd6e1', '#fff3b0', '#e6d4ff'];
    for (let i = 0; i < 26; i++) {
      const x = r() * 256, y = r() * 256;
      g.fillStyle = fl[i % fl.length];
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#ffd36e';
      g.beginPath(); g.arc(x, y, 1.4, 0, Math.PI * 2); g.fill();
    }
  }), rx, ry);
}

/** Sandy path with round stepping stones. */
export function pathTex(c: number, rx = 1, ry = 1) {
  return repeatTex(canvasTex(256, 256, (g) => {
    const r = rnd(5);
    g.fillStyle = hexCss(c);
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? shade(c, 0.92) : shade(c, 1.05); g.fillRect(r() * 256, r() * 256, 2, 2); }
    for (let i = 0; i < 9; i++) {
      const x = (i % 3) * 85 + 20 + r() * 40, y = Math.floor(i / 3) * 85 + 20 + r() * 40, rr = 14 + r() * 10;
      g.fillStyle = shade(c, 1.08);
      g.beginPath(); g.ellipse(x, y, rr, rr * 0.8, r(), 0, Math.PI * 2); g.fill();
      g.strokeStyle = shade(c, 0.88); g.lineWidth = 2; g.stroke();
    }
  }), rx, ry);
}

/** Warm sand with speckles and tiny shells. */
export function sandTex(c: number, rx = 1, ry = 1) {
  return repeatTex(canvasTex(256, 256, (g) => {
    const r = rnd(3);
    g.fillStyle = hexCss(c);
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) { g.fillStyle = r() < 0.5 ? shade(c, 0.93) : shade(c, 1.04); g.fillRect(r() * 256, r() * 256, 1.6, 1.6); }
    for (let i = 0; i < 6; i++) { g.fillStyle = ['#ffd6e1', '#ffffff', '#ffe9c7'][i % 3]; g.beginPath(); g.arc(r() * 256, r() * 256, 2.2, 0, Math.PI); g.fill(); }
  }), rx, ry);
}

export type WallMotif = 'stripes' | 'hearts' | 'dots' | 'sheep' | 'stars' | 'notes' | 'plain';
/** Pastel wallpaper with a wainscot band and a tiny motif. */
export function wallpaperTex(base: number, accent: number, motif: WallMotif, rx = 1, ry = 1) {
  return repeatTex(canvasTex(256, 256, (g) => {
    g.fillStyle = hexCss(base);
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = hexCss(accent);
    g.strokeStyle = hexCss(accent);
    if (motif === 'stripes') for (let x = 0; x < 256; x += 64) { g.globalAlpha = 0.55; g.fillRect(x + 20, 0, 24, 256); g.globalAlpha = 1; }
    const grid = (fn: (x: number, y: number) => void) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) fn(x * 64 + (y % 2 ? 32 : 0) + 16, y * 64 + 24); };
    if (motif === 'dots') grid((x, y) => { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); });
    if (motif === 'hearts') grid((x, y) => { heartPath(g, x, y - 8, 14); g.fill(); });
    if (motif === 'stars') grid((x, y) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 3 : 7; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); });
    if (motif === 'notes') grid((x, y) => { g.font = '900 20px Nunito, sans-serif'; g.fillText('♪', x - 6, y + 7); });
    if (motif === 'sheep') grid((x, y) => {
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 6, y + Math.sin(a) * 4.5, 5, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = hexCss(accent); g.beginPath(); g.arc(x + 9, y, 3.5, 0, Math.PI * 2); g.fill();
    });
    // soft top/bottom shading keeps the wall from looking flat
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(120,90,140,0.06)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
  }), rx, ry);
}
