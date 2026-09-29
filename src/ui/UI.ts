import * as THREE from 'three';
import { AudioSystem } from '../audio/Audio';
import { wait } from '../utils/math';
import { appRoot, toAppRect } from '../core/Viewport';
import { tr, trf } from '../i18n/i18n';

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

export interface DialogueOpts { portrait?: string; choices?: string[] }

/** DOM overlay: HUD, dialogue, toasts, banners, modals, transitions, world-anchored bubbles. */
export class UI {
  root = document.getElementById('ui')!;
  world = el('div', 'world-layer passthrough');
  private toasts = el('div', 'toasts passthrough');
  hud = {
    top: el('div', 'hud-top'),
    hearts: el('div', 'hearts'),
    heartsNum: el('span'),
    btns: el('div', 'hud-btns'),
    wardrobe: el('button', 'icon-btn', '👗'),
    map: el('button', 'icon-btn', '🗺️'),
    menu: el('button', 'icon-btn', '☰'),
    place: el('div', 'place-tag'),
    bottom: el('div', 'hud-bottom'),
    act: el('button', 'act-btn idle', '♡'),
    actLabel: el('div', 'act-label off'),
    cam: el('button', 'cam-btn', '🎥'),
    joyHint: el('div', 'joy-hint', 'drag here<br>to walk'),
    camHint: el('div', 'cam-hint', 'drag to look around · pinch to zoom'),
  };
  private trans = el('div', 'trans');
  private transText = el('div', 't-text');
  private prompts = new Map<string, HTMLDivElement>();
  modalOpen = 0;
  dialogueOpen = false;
  private hudVisible = false;

  constructor(private audio: AudioSystem, private camera: THREE.PerspectiveCamera) {
    const h = this.hud;
    h.hearts.innerHTML = '<div class="h-icon">♡</div>';
    h.hearts.appendChild(h.heartsNum);
    h.btns.append(h.wardrobe, h.map, h.menu);
    h.wardrobe.setAttribute('aria-label', 'Wardrobe');
    h.map.setAttribute('aria-label', 'Map');
    h.menu.setAttribute('aria-label', 'Menu');
    h.top.append(h.hearts, h.btns);
    h.bottom.append(h.cam, h.act, h.actLabel);
    h.bottom.style.position = 'fixed';
    h.cam.setAttribute('aria-label', 'Camera: closer / face close-up / back');
    h.act.setAttribute('aria-label', 'Interact');
    this.root.append(this.world, h.top, h.place, h.bottom, h.joyHint, h.camHint, this.toasts);
    this.setHud(false);

    // transition overlay
    const clouds: HTMLDivElement[] = [];
    for (let i = 0; i < 14; i++) {
      const c = el('div', 'cloud');
      const size = 30 + Math.random() * 30;
      c.style.width = c.style.height = size + 'cqmax';
      const ang = (i / 14) * Math.PI * 2;
      c.style.left = 50 + Math.cos(ang) * 38 - size / 2 + 'cqw';
      c.style.top = 50 + Math.sin(ang) * 40 - size / 2 + 'cqh';
      c.dataset.ox = String(Math.cos(ang) * 120);
      c.dataset.oy = String(Math.sin(ang) * 120);
      c.style.transform = `translate(${c.dataset.ox}cqw, ${c.dataset.oy}cqh) scale(.6)`;
      c.style.transitionDelay = (Math.random() * 0.15).toFixed(2) + 's';
      clouds.push(c);
      this.trans.appendChild(c);
    }
    const fill = el('div', 'fill');
    const center = el('div', 't-center');
    center.innerHTML = '<div class="t-sheep">🐑</div>';
    center.appendChild(this.transText);
    const hearts = el('div', 't-hearts', '<i>♡</i><i>♡</i><i>♡</i>');
    center.appendChild(hearts);
    this.trans.append(fill, center);
    this.trans.dataset.clouds = '1';
    (this.trans as any)._clouds = clouds;
    appRoot().appendChild(this.trans);
  }

  setHud(v: boolean) {
    this.hudVisible = v;
    for (const e of [this.hud.top, this.hud.bottom, this.hud.place, this.hud.joyHint, this.hud.camHint]) e.classList.toggle('hidden', !v);
  }
  get hudShown() { return this.hudVisible; }

  setHearts(n: number, delta = 0) {
    this.hud.heartsNum.textContent = String(n);
    if (delta) {
      this.hud.hearts.classList.remove('bump');
      void this.hud.hearts.offsetWidth;
      this.hud.hearts.classList.add('bump');
      const r = toAppRect(this.hud.hearts.getBoundingClientRect());
      const p = el('div', 'float-plus', (delta > 0 ? '+' : '') + delta + ' ♡');
      p.style.left = r.right - 30 + 'px';
      p.style.top = r.bottom + 4 + 'px';
      if (!this.hudVisible) {
        p.style.left = '50%';
        p.style.top = '20%';
      }
      appRoot().appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }
  }

  setPlace(name: string) {
    this.hud.place.textContent = name;
  }

  /** Contextual action button label (null = nothing in reach). */
  setAction(label: string | null) {
    const h = this.hud;
    h.act.classList.toggle('idle', !label);
    h.act.classList.toggle('ready', !!label);
    h.actLabel.classList.toggle('off', !label);
    if (label) h.actLabel.textContent = label;
  }

  // ---------- world-anchored elements ----------
  private project(p: THREE.Vector3) {
    const v = p.clone().project(this.camera);
    return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight, vis: v.z < 1 && v.z > -1 };
  }

  /** Show/move a floating prompt above a world point. Pass null to hide. */
  prompt(id: string, pos: THREE.Vector3 | null, html = '') {
    let e = this.prompts.get(id);
    if (!pos) {
      if (e) {
        e.remove();
        this.prompts.delete(id);
      }
      return;
    }
    if (!e) {
      e = el('div', 'prompt');
      this.world.appendChild(e);
      this.prompts.set(id, e);
    }
    if (e.dataset.html !== html) {
      e.innerHTML = html;
      e.dataset.html = html;
    }
    const s = this.project(pos);
    e.style.display = s.vis ? '' : 'none';
    e.style.left = s.x + 'px';
    e.style.top = s.y + 'px';
  }
  clearPrompts() {
    for (const e of this.prompts.values()) e.remove();
    this.prompts.clear();
  }

  /** Reaction bubble above a world point (kaomoji, !, ♡ …). */
  react(pos: THREE.Vector3, text: string, style: '' | 'big' | 'plain' = '') {
    const s = this.project(pos);
    if (!s.vis) return;
    const e = el('div', 'react ' + style, text);
    e.style.left = s.x + 'px';
    e.style.top = s.y + 'px';
    this.world.appendChild(e);
    setTimeout(() => e.remove(), 1600);
  }

  // ---------- banners & toasts ----------
  banner(title: string, sub = '') {
    const b = el('div', 'banner');
    b.innerHTML = `<div class="ribbon">${title}</div>${sub ? `<br><div class="sub">${sub}</div>` : ''}`;
    appRoot().appendChild(b);
    requestAnimationFrame(() => b.classList.add('show'));
    setTimeout(() => b.remove(), 2700);
  }

  toast(icon: string, text: string, isNew = false) {
    const t = el('div', 'toast');
    t.innerHTML = `<div class="t-icon">${icon}</div><div>${isNew ? '<span class="t-new">✨ NEW! ✨</span>' : ''}${text}</div>`;
    this.toasts.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // ---------- dialogue ----------
  async dialogue(name: string, lines: string[], o: DialogueOpts = {}): Promise<number> {
    this.dialogueOpen = true;
    name = tr(name);
    lines = lines.map((l) => tr(l));
    if (o.choices) o = { ...o, choices: o.choices.map((c) => tr(c)) };
    const box = el('div', 'dialogue paper');
    const tag = el('div', 'name', `<span class="portrait">${o.portrait ?? '💬'}</span>${name}`);
    const text = el('div', 'text');
    const next = el('div', 'next', '▼');
    box.append(tag, text, next);
    this.root.appendChild(box);
    let choice = -1;
    for (let i = 0; i < lines.length; i++) {
      const last = i === lines.length - 1;
      await this.typeLine(text, next, box, lines[i], last && !!o.choices);
      if (last && o.choices) {
        next.classList.add('hidden');
        const wrap = el('div', 'choices');
        choice = await new Promise<number>((res) => {
          o.choices!.forEach((c, k) => {
            const b = el('button', k === 0 ? 'candy primary small' : 'candy small', c);
            b.onclick = (e) => {
              e.stopPropagation();
              this.audio.sfx('select');
              res(k);
            };
            wrap.appendChild(b);
          });
          box.appendChild(wrap);
        });
      }
    }
    box.remove();
    this.dialogueOpen = false;
    return choice;
  }

  private typeLine(text: HTMLElement, next: HTMLElement, box: HTMLElement, line: string, noWait: boolean) {
    return new Promise<void>((res) => {
      text.textContent = '';
      next.classList.add('hidden');
      // whole graphemes, so multi-codepoint emoji (☁️, 👩‍🍳) appear in one step and become one icon
      const chars = 'Segmenter' in Intl ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(line)].map((x) => x.segment) : Array.from(line);
      let i = 0;
      let done = false;
      const finish = () => {
        done = true;
        text.textContent = line;
        next.classList.remove('hidden');
      };
      const iv = setInterval(() => {
        if (done) return clearInterval(iv);
        text.textContent += chars[i];
        if (i % 3 === 0 && chars[i] !== ' ') this.audio.sfx('blip', 0.6);
        i++;
        if (i >= chars.length) {
          clearInterval(iv);
          finish();
          if (noWait) cleanup(), res();
        }
      }, 24);
      const advance = (e?: Event) => {
        e?.stopPropagation();
        if (!done) {
          clearInterval(iv);
          finish();
          if (noWait) { cleanup(); res(); }
          return;
        }
        if (noWait) return;
        cleanup();
        this.audio.sfx('tap');
        res();
      };
      const key = (e: KeyboardEvent) => {
        if (['Space', 'Enter', 'KeyE'].includes(e.code)) {
          e.preventDefault();
          advance();
        }
      };
      const cleanup = () => {
        box.removeEventListener('pointerup', advance);
        window.removeEventListener('keydown', key, true);
      };
      box.addEventListener('pointerup', advance);
      window.addEventListener('keydown', key, true);
    });
  }

  // ---------- modals ----------
  modal(title: string, body: HTMLElement, o: { onClose?: () => void; closable?: boolean; tabs?: HTMLElement; wide?: boolean } = {}) {
    this.modalOpen++;
    const wrap = el('div', 'modal-wrap');
    const m = el('div', 'modal paper');
    if (o.wide) m.style.width = 'min(96cqw, 760px)';
    const head = el('div', 'modal-head', `<h2 class="grad-text">${title}</h2>`);
    const bodyWrap = el('div', 'modal-body');
    bodyWrap.appendChild(body);
    m.append(head);
    if (o.tabs) m.append(o.tabs);
    m.append(bodyWrap);
    wrap.appendChild(m);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      this.modalOpen--;
      wrap.remove();
      window.removeEventListener('keydown', esc, true);
      o.onClose?.();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && o.closable !== false) {
        e.stopPropagation();
        this.audio.sfx('back');
        close();
      }
    };
    if (o.closable !== false) {
      const x = el('button', 'modal-close', '✕');
      x.setAttribute('aria-label', 'Close');
      x.onclick = () => {
        this.audio.sfx('back');
        close();
      };
      head.appendChild(x);
      wrap.addEventListener('pointerdown', (e) => {
        if (e.target === wrap) {
          this.audio.sfx('back');
          close();
        }
      });
    }
    window.addEventListener('keydown', esc, true);
    appRoot().appendChild(wrap);
    return { close, body: bodyWrap, modal: m };
  }

  /** Result card for mini-games. Resolves with the pressed button index. */
  result(o: { emoji: string; title: string; stats: [string, string | number][]; reward: number; buttons: string[]; note?: string }) {
    return new Promise<number>((res) => {
      const b = el('div', 'result');
      b.innerHTML = `<div class="big-emoji">${o.emoji}</div><h2 class="grad-text">${o.title}</h2>
        <div class="stats">${o.stats.map(([k, v]) => `<div class="stat"><b>${v}</b><small>${k}</small></div>`).join('')}</div>
        <div class="reward">${o.reward > 0 ? trf('+{0} ♡ Hamin Hearts', o.reward) : ''}</div>${o.note ? `<p class="note">${o.note}</p>` : ''}`;
      const btns = el('div', 'btns');
      const m = this.modal('', b, { closable: false });
      m.modal.querySelector('.modal-head')?.remove();
      o.buttons.forEach((t, i) => {
        const bt = el('button', i === 0 ? 'candy primary' : 'candy', t);
        bt.onclick = () => {
          this.audio.sfx('select');
          m.close();
          res(i);
        };
        btns.appendChild(bt);
      });
      b.appendChild(btns);
    });
  }

  confirm(title: string, text: string, yes = 'Yes', no = 'Cancel') {
    return new Promise<boolean>((res) => {
      const b = el('div', '', `<p style="text-align:center;font-size:16px;margin:4px 0 16px">${text}</p>`);
      const row = el('div', 'btns');
      row.style.cssText = 'display:flex;gap:10px;justify-content:center';
      let answered = false;
      const m = this.modal(title, b, { onClose: () => !answered && res(false) });
      const y = el('button', 'candy primary', yes);
      const n = el('button', 'candy', no);
      y.onclick = () => { answered = true; m.close(); res(true); };
      n.onclick = () => { answered = true; m.close(); res(false); };
      row.append(y, n);
      b.appendChild(row);
    });
  }

  // ---------- transitions ----------
  async cover(text = 'loading sweetness…', icon = '🐑') {
    this.transText.textContent = text;
    (this.trans.querySelector('.t-sheep') as HTMLElement).textContent = icon;
    const clouds: HTMLDivElement[] = (this.trans as any)._clouds;
    for (const c of clouds) c.style.transform = 'translate(0,0) scale(1)';
    this.trans.classList.add('cover');
    this.audio.sfx('whoosh');
    await wait(620);
  }

  async reveal() {
    const clouds: HTMLDivElement[] = (this.trans as any)._clouds;
    this.trans.classList.remove('cover');
    await wait(80);
    for (const c of clouds) c.style.transform = `translate(${c.dataset.ox}cqw, ${c.dataset.oy}cqh) scale(.6)`;
    await wait(500);
  }

  // ---------- minigame helpers ----------
  layer(cls = '') {
    const l = el('div', 'mg ' + cls);
    this.root.appendChild(l);
    return l;
  }

  async countdown(layer: HTMLElement) {
    for (const t of ['3', '2', '1', 'GO! ♡']) {
      const c = el('div', 'big-center pop', t);
      if (t.length > 2) c.style.fontSize = '64px';
      layer.appendChild(c);
      this.audio.sfx(t.length > 2 ? 'go' : 'count');
      await wait(t.length > 2 ? 600 : 700);
      c.remove();
    }
  }

  judge(layer: HTMLElement, kind: 'perfect' | 'good' | 'miss', text?: string) {
    const j = el('div', 'judge ' + kind, text ?? (kind === 'perfect' ? 'Perfect ♡' : kind === 'good' ? 'Good!' : 'Miss…'));
    layer.appendChild(j);
    setTimeout(() => j.remove(), 650);
  }

  rotateHint() {
    if (innerHeight <= innerWidth) return;
    const r = el('div', 'rotate-hint', '📱↻ Rotate your device for the best experience ♡');
    appRoot().appendChild(r);
    setTimeout(() => r.remove(), 4000);
  }
}
