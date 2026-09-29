// DOM for the Dog Chase mini-game: start card, top HUD (score, hearts + combo, progress), power-up timers,
// announcement ribbon, floating score pops and touch pads.
// Styles are scoped with `dc-` and live inside the layer, so removing the layer cleans everything.
import { el } from '../../ui/UI';
import { tr, trf } from '../../i18n/i18n';
import type { PowerKind } from './course';
import { POWER_INFO } from './fx';

const CSS = `
.dc-start { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(94cqw, 540px); max-height: calc(100% - 20px);
  overflow: auto; padding: 14px 18px 16px; text-align: center; animation: popIn .4s var(--bounce); }
.dc-start h2 { margin: 0; font-size: 32px; line-height: 1.05; }
.dc-start .dc-emo { font-size: 36px; line-height: 1; letter-spacing: 4px; }
.dc-start .dc-emo span { display: inline-block; animation: hop .7s ease-in-out infinite; }
.dc-start .dc-emo span:nth-child(2) { animation-delay: .12s }
.dc-start .dc-emo span:nth-child(3) { animation-delay: .24s }
.dc-start p { margin: 6px 0 8px; font-size: 15px; line-height: 1.35; color: var(--ink); font-weight: 700; }
.dc-how { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 4px 0 8px; text-align: left; }
.dc-how > div { background: #fff; border-radius: 16px; padding: 7px 10px; box-shadow: 0 3px 0 var(--lavender); font-size: 13px; line-height: 1.55; }
.dc-how b { display: block; font-size: 14px; margin-bottom: 1px; color: var(--strawberry); }
.dc-how kbd { display: inline-block; min-width: 20px; padding: 0 5px; border-radius: 6px; background: var(--blue-soft); box-shadow: 0 2px 0 #86b8f0;
  font: 900 12px Nunito, sans-serif; text-align: center; margin-right: 2px; }
.dc-legend { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 8px; margin-bottom: 10px; text-align: left; }
.dc-legend span { background: var(--pink-soft); border-radius: 99px; padding: 3px 10px; font-size: 12px; line-height: 1.3; }
.dc-legend span.pw { background: var(--blue-soft); }
.dc-btns { display: flex; gap: 10px; justify-content: center; }
.dc-best { font-size: 12px; color: var(--ink-soft); margin-top: 8px; }
.dc-top { align-items: center; }
.dc-prog { flex: 1; max-width: 460px; background: #fff; border-radius: 18px; padding: 6px 12px 8px; box-shadow: 0 3px 0 var(--pink-deep); }
.dc-prog small { display: flex; justify-content: space-between; font-size: 11px; color: var(--ink-soft); }
.dc-track { position: relative; height: 14px; margin: 16px 14px 2px 6px; border-radius: 99px; background: var(--blue-soft); box-shadow: inset 0 2px 0 rgba(0,0,0,.05); }
.dc-track > i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; background: linear-gradient(90deg, var(--pink), var(--strawberry)); }
.dc-zmark { position: absolute; top: 3px; width: 3px; height: 8px; margin-left: -1px; border-radius: 2px; background: rgba(255,255,255,.9); }
.dc-mark { position: absolute; top: -18px; font-size: 22px; line-height: 1; transform: translateX(-50%); transition: filter .2s; }
.dc-mark.dog { z-index: 2; }
.dc-mark.run { z-index: 3; transform: translateX(-50%) scaleX(-1); }
.dc-mark.goal { left: 100%; font-size: 20px; }
.dc-prog.danger { box-shadow: 0 3px 0 var(--strawberry), 0 0 0 3px rgba(255,122,147,.35); animation: dcPulse .5s ease-in-out infinite alternate; }
@keyframes dcPulse { from { transform: scale(1) } to { transform: scale(1.03) } }
.dc-hearts { position: relative; }
.dc-x { position: absolute; right: -10px; top: -10px; background: linear-gradient(135deg, #ffb3c6, var(--strawberry)); color: #fff; font-style: normal;
  font-size: 14px; font-weight: 900; border-radius: 99px; padding: 1px 7px; box-shadow: 0 2px 0 var(--pink-deep); transform: scale(0); transition: transform .25s var(--bounce); }
.dc-x.on { transform: scale(1); }
.dc-x.bump { animation: dcBump .35s var(--bounce); }
@keyframes dcBump { 0% { transform: scale(1) } 45% { transform: scale(1.45) rotate(-8deg) } 100% { transform: scale(1) } }
.dc-warn { position: absolute; left: 50%; top: calc(86px + var(--sat)); transform: translateX(-50%); background: #fff; color: var(--strawberry); border-radius: 99px;
  padding: 5px 14px; font-size: 15px; box-shadow: 0 3px 0 var(--pink-deep); pointer-events: none; opacity: 0; transition: opacity .25s; white-space: nowrap; }
.dc-warn.on { opacity: 1; animation: hop .6s ease-in-out infinite; }
.dc-pause { width: 44px; height: 44px; border-radius: 50%; background: #fff; box-shadow: 0 3px 0 var(--pink-deep); font-size: 18px; flex: none; }
.dc-pws { position: absolute; left: calc(12px + var(--sal)); top: calc(74px + var(--sat)); display: flex; flex-direction: column; gap: 6px; pointer-events: none; }
.dc-pw { display: flex; align-items: center; gap: 6px; background: #fff; border-radius: 99px; padding: 3px 10px 3px 5px; box-shadow: 0 3px 0 var(--c, var(--pink-deep));
  animation: popIn .3s var(--bounce); }
.dc-pw > span { font-size: 20px; line-height: 1; }
.dc-pw > i { position: relative; width: 64px; height: 9px; border-radius: 99px; background: #eef1fa; overflow: hidden; }
.dc-pw > i > b { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; background: var(--c, var(--pink-deep)); }
.dc-pw.low { animation: dcBlink .3s steps(2) infinite; }
@keyframes dcBlink { 50% { opacity: .45 } }
.dc-ann { position: absolute; left: 50%; top: calc(21% + var(--sat)); transform: translateX(-50%); text-align: center; pointer-events: none; opacity: 0; white-space: nowrap; }
.dc-ann .t { display: inline-block; background: linear-gradient(#fff, #fff5f8); color: var(--strawberry); font-size: 26px; font-weight: 900; padding: 5px 22px 7px;
  border-radius: 99px; box-shadow: 0 4px 0 var(--pink-deep), 0 8px 20px rgba(255,122,147,.28); }
.dc-ann .s { font-size: 14px; font-weight: 800; color: var(--ink); margin-top: 6px; text-shadow: 0 2px 0 #fff, 0 0 8px #fff; }
.dc-ann.tip .t { color: #4f8fd8; font-size: 21px; box-shadow: 0 4px 0 #86b8f0, 0 8px 20px rgba(134,184,240,.3); }
.dc-ann.event .t { color: #3fa982; box-shadow: 0 4px 0 #8fdcbc, 0 8px 20px rgba(143,220,188,.3); }
.dc-ann.show { animation: dcAnn 2.5s var(--bounce) forwards; }
@keyframes dcAnn { 0% { opacity: 0; transform: translate(-50%, -14px) scale(.7) } 10% { opacity: 1; transform: translate(-50%, 0) scale(1.05) }
  16% { transform: translate(-50%, 0) scale(1) } 82% { opacity: 1 } 100% { opacity: 0; transform: translate(-50%, -8px) } }
.dc-pop { position: absolute; left: 72%; top: 44%; transform: translateX(-50%); pointer-events: none; opacity: 0; white-space: nowrap; font-size: 22px; font-weight: 900;
  color: var(--strawberry); text-shadow: 0 3px 0 #fff, 0 0 10px #fff, 0 0 3px #fff; }
.dc-pop.gold { color: #f0a92e; }
.dc-pop.blue { color: #4f8fd8; }
.dc-pop.mint { color: #3fa982; }
.dc-pop.show { animation: dcPop 1.15s ease-out forwards; }
@keyframes dcPop { 0% { opacity: 0; transform: translate(-50%, 12px) scale(.5) } 14% { opacity: 1; transform: translate(-50%, 0) scale(1.18) }
  24% { transform: translate(-50%, 0) scale(1) } 75% { opacity: 1 } 100% { opacity: 0; transform: translate(-50%, -46px) scale(.95) } }
.dc-pads { display: none; }
body.touch .dc-pads { display: flex; }
.dc-pads .grp { display: flex; gap: 12px; }
.dc-pads .pad-btn { opacity: .9; }
.dc-pads .pad-btn.slide { background: linear-gradient(#fff, var(--mint)); box-shadow: 0 5px 0 #8fdcbc; }
.dc-pads .pad-btn.slide:active, .dc-pads .pad-btn.slide.down { box-shadow: 0 1px 0 #8fdcbc; }
.dc-hidden { display: none !important; }
body.touch .dc-how { grid-template-columns: 1fr; }
body.touch .dc-how .kb { display: none; }
@container (max-height: 560px) {
  .dc-start { padding: 10px 14px 12px; }
  .dc-start h2 { font-size: 26px; }
  .dc-start .dc-emo { font-size: 26px; }
  .dc-start p { margin: 3px 0 6px; font-size: 13px; }
  .dc-how { margin: 3px 0 6px; }
  .dc-how > div { font-size: 12px; line-height: 1.45; padding: 5px 9px; }
  .dc-legend { margin-bottom: 8px; gap: 4px 6px; }
  .dc-legend span { font-size: 11px; padding: 2px 8px; }
  .dc-best { margin-top: 5px; }
  .dc-pads .pad-btn { width: 72px; height: 72px; }
  .dc-ann .t { font-size: 22px; }
  .dc-pws { top: calc(66px + var(--sat)); }
}
@container (max-height: 420px) {
  .dc-start { padding: 8px 12px 10px; max-height: calc(100% - 12px); }
  .dc-start .dc-emo { display: none; }
  .dc-start h2 { font-size: 22px; }
  .dc-start p { font-size: 12px; margin: 2px 0 5px; }
  .dc-how > div { font-size: 11.5px; line-height: 1.4; padding: 4px 8px; }
  .dc-how b { font-size: 12.5px; }
  .dc-legend { gap: 3px 6px; margin-bottom: 7px; }
  .dc-legend span { font-size: 10.5px; padding: 1px 7px; }
  .dc-btns .candy { min-height: 40px; padding: 6px 18px; font-size: 15px; }
  .dc-best { margin-top: 4px; font-size: 11px; }
  .dc-ann { top: calc(24% + var(--sat)); }
  .dc-ann .t { font-size: 18px; padding: 4px 16px 5px; }
  .dc-ann .s { font-size: 12px; margin-top: 4px; }
  .dc-pop { font-size: 18px; }
  .dc-pw > span { font-size: 16px; }
  .dc-pw > i { width: 48px; }
}
`;

export interface HudState {
  score: number;
  hearts: number;
  mult: number;
  prog: number;
  gapFrac: number;
  meters: number;
  total: number;
  danger: boolean;
}

export interface ChaseHud {
  layer: HTMLDivElement;
  start: HTMLDivElement;
  startBtn: HTMLButtonElement;
  backBtn: HTMLButtonElement;
  top: HTMLDivElement;
  pads: HTMLDivElement;
  pauseBtn: HTMLButtonElement;
  left: HTMLButtonElement;
  right: HTMLButtonElement;
  jump: HTMLButtonElement;
  slide: HTMLButtonElement;
  showStart(best: number): void;
  hideStart(): void;
  showPlay(v: boolean): void;
  set(o: HudState): void;
  /** power-up timer chip: frac ≤ 0 hides it */
  setPower(kind: PowerKind, frac: number): void;
  /** big ribbon in the upper middle (queued so they never overlap) */
  announce(text: string, sub?: string, style?: '' | 'tip' | 'event', now?: boolean): void;
  /** small floating score text */
  pop(text: string, style?: '' | 'gold' | 'blue' | 'mint'): void;
  comboBump(): void;
  /** per-frame (dt-based, pauses with the game) */
  tick(dt: number): void;
  clearFx(): void;
}

export function buildHud(layer: HTMLDivElement, zoneFracs: number[]): ChaseHud {
  const style = document.createElement('style');
  style.textContent = CSS;
  layer.appendChild(style);

  // ---- start card
  const start = el('div', 'dc-start paper');
  start.innerHTML = `
    <div class="dc-emo"><span>🏃</span><span>💨</span><span>🐶</span></div>
    <h2 class="grad-text">Dog Chase!</h2>
    <p>Bori the puppy wants to play! Run to the Sheep Bakery before Bori catches Hamin ♡</p>
    <div class="dc-how">
      <div><b>📱 Touch</b>👈 👉 swipe or ◀ ▶ : change lane<br>👆 swipe up or ⤒ : jump<br>👇 swipe down or ⤓ : slide</div>
      <div class="kb"><b>⌨️ Keyboard</b><kbd>A</kbd><kbd>D</kbd> or <kbd>←</kbd><kbd>→</kbd> : lane<br><kbd>Space</kbd><kbd>W</kbd><kbd>↑</kbd> : jump<br><kbd>S</kbd><kbd>↓</kbd> : slide</div>
    </div>
    <div class="dc-legend">
      <span>📦 Low stuff? Jump!</span><span class="pw">🦴 Bone: Bori stops to munch</span>
      <span>🎀 Banners? Slide under!</span><span class="pw">🧲 Magnet: pulls in hearts</span>
      <span>🚲 Big stuff? Change lanes!</span><span class="pw">🐑 Sheep buddy: zoom and bonk!</span>
      <span>✨ Last-second dodge = bonus</span><span class="pw">⭐ Star: blocks one bump</span>
    </div>`;
  const btns = el('div', 'dc-btns');
  const startBtn = el('button', 'candy primary', '▶ Start!') as HTMLButtonElement;
  const backBtn = el('button', 'candy', '← Back') as HTMLButtonElement;
  btns.append(startBtn, backBtn);
  const best = el('div', 'dc-best');
  start.append(btns, best);
  layer.appendChild(start);

  // ---- top HUD
  const top = el('div', 'mg-top dc-top dc-hidden');
  const score = el('div', 'mg-pill', '⭐ 0<small>score</small>');
  const prog = el('div', 'dc-prog');
  prog.innerHTML = `<small><span>🏃 Hamin</span><span class="dc-m" data-no-tr>0 m</span><span>Sheep Bakery 🧁</span></small>
    <div class="dc-track"><i></i>${zoneFracs.map((f) => `<span class="dc-zmark" style="left:${(8 + f * 92).toFixed(1)}%"></span>`).join('')}<span class="dc-mark dog">🐶</span><span class="dc-mark run">🏃</span><span class="dc-mark goal">🧁</span></div>`;
  const hearts = el('div', 'mg-pill dc-hearts');
  const heartsTxt = el('div', '', '♡ 0<small>hearts</small>');
  const combo = el('em', 'dc-x', '×1');
  combo.setAttribute('data-no-tr', '');
  hearts.append(heartsTxt, combo);
  const pauseBtn = el('button', 'dc-pause', '⏸') as HTMLButtonElement;
  pauseBtn.setAttribute('aria-label', 'Pause');
  const right = el('div');
  right.style.cssText = 'display:flex;gap:8px;align-items:flex-start';
  right.append(hearts, pauseBtn);
  top.append(score, prog, right);
  layer.appendChild(top);
  const warn = el('div', 'dc-warn dc-hidden', '🐶 Bori is right behind you!');
  layer.appendChild(warn);

  // ---- power-up chips
  const pws = el('div', 'dc-pws dc-hidden');
  const chips = {} as Record<PowerKind, { el: HTMLDivElement; bar: HTMLElement; frac: number }>;
  for (const k of ['sheep', 'bone', 'magnet', 'star'] as PowerKind[]) {
    const c = el('div', 'dc-pw dc-hidden', `<span>${POWER_INFO[k].emoji}</span><i><b></b></i>`) as HTMLDivElement;
    c.style.setProperty('--c', POWER_INFO[k].ring);
    pws.appendChild(c);
    chips[k] = { el: c, bar: c.querySelector('b') as HTMLElement, frac: -1 };
  }
  layer.appendChild(pws);

  // ---- announcement ribbon + score pops
  const ann = el('div', 'dc-ann', '<div class="t"></div><div class="s"></div>');
  const annT = ann.querySelector('.t') as HTMLElement;
  const annS = ann.querySelector('.s') as HTMLElement;
  layer.appendChild(ann);
  const queue: [string, string, string][] = [];
  let annLeft = 0;
  const showAnn = (t: string, s: string, st: string) => {
    annT.textContent = t;
    annS.textContent = s;
    annS.style.display = s ? '' : 'none';
    ann.className = 'dc-ann' + (st ? ' ' + st : '');
    void ann.offsetWidth; // restart the animation
    ann.classList.add('show');
    annLeft = 1.7; // next one may start before this one has fully faded
  };
  const pops: HTMLDivElement[] = [];
  for (let i = 0; i < 4; i++) {
    const p = el('div', 'dc-pop') as HTMLDivElement;
    layer.appendChild(p);
    pops.push(p);
  }
  let popIdx = 0;
  let popStack = 0;

  // ---- touch pads
  const pads = el('div', 'mg-controls dc-pads dc-hidden');
  const lg = el('div', 'grp');
  const leftB = el('button', 'pad-btn', '◀') as HTMLButtonElement;
  const rightB = el('button', 'pad-btn', '▶') as HTMLButtonElement;
  leftB.setAttribute('aria-label', 'Move left');
  rightB.setAttribute('aria-label', 'Move right');
  lg.append(leftB, rightB);
  const rg = el('div', 'grp');
  const slideB = el('button', 'pad-btn slide', '⤓') as HTMLButtonElement;
  slideB.setAttribute('aria-label', 'Slide');
  const jumpB = el('button', 'pad-btn jump', '⤒') as HTMLButtonElement;
  jumpB.setAttribute('aria-label', 'Jump');
  rg.append(slideB, jumpB);
  pads.append(lg, rg);
  layer.appendChild(pads);

  const fill = prog.querySelector('.dc-track > i') as HTMLElement;
  const runM = prog.querySelector('.dc-mark.run') as HTMLElement;
  const dogM = prog.querySelector('.dc-mark.dog') as HTMLElement;
  const meters = prog.querySelector('.dc-m') as HTMLElement;
  let last = { score: -1, hearts: -1, mult: 1, prog: -1, dog: -1, m: -1, danger: false };

  return {
    layer, start, startBtn, backBtn, top, pads, pauseBtn, left: leftB, right: rightB, jump: jumpB, slide: slideB,
    showStart(b: number) {
      best.textContent = b > 0 ? trf('Best score: {0}', b) : tr('Hamin: “W-wait, Bori!! (ㅇㅁㅇ)”');
      start.classList.remove('dc-hidden');
    },
    hideStart() { start.classList.add('dc-hidden'); },
    showPlay(v: boolean) {
      top.classList.toggle('dc-hidden', !v);
      pads.classList.toggle('dc-hidden', !v);
      warn.classList.toggle('dc-hidden', !v);
      pws.classList.toggle('dc-hidden', !v);
    },
    set(o) {
      if (o.score !== last.score) { score.innerHTML = `⭐ ${o.score}<small>score</small>`; last.score = o.score; }
      if (o.hearts !== last.hearts) { heartsTxt.innerHTML = `♡ ${o.hearts}<small>hearts</small>`; last.hearts = o.hearts; }
      if (o.mult !== last.mult) {
        combo.textContent = '×' + o.mult;
        combo.classList.toggle('on', o.mult > 1);
        last.mult = o.mult;
      }
      const p = Math.round(o.prog * 1000) / 10;
      if (p !== last.prog) { const l = 8 + p * 0.92 + '%'; fill.style.width = l; runM.style.left = l; last.prog = p; }
      // Bori sits behind the runner by an amount proportional to the gap (track starts at 8% so he fits)
      const d = Math.round(Math.max(0, 8 + p * 0.92 - o.gapFrac * 14) * 10) / 10;
      if (d !== last.dog) { dogM.style.left = d + '%'; last.dog = d; }
      const m = Math.floor(o.meters);
      if (m !== last.m) { meters.textContent = `${m} / ${o.total} m`; last.m = m; }
      if (o.danger !== last.danger) { prog.classList.toggle('danger', o.danger); warn.classList.toggle('on', o.danger); last.danger = o.danger; }
    },
    setPower(kind, frac) {
      const c = chips[kind];
      const f = Math.round(Math.max(0, frac) * 50) / 50;
      if (f === c.frac) return;
      if (f <= 0) c.el.classList.add('dc-hidden');
      else {
        if (c.frac <= 0) c.el.classList.remove('dc-hidden');
        c.bar.style.width = f * 100 + '%';
        c.el.classList.toggle('low', f < 0.22);
      }
      c.frac = f;
    },
    announce(text, sub = '', st = '', now = false) {
      if (annLeft > 0 && !now) {
        if (queue.length < 3) queue.push([text, sub, st]);
        return;
      }
      showAnn(text, sub, st);
    },
    pop(text, st = '') {
      const p = pops[popIdx];
      popIdx = (popIdx + 1) % pops.length;
      p.textContent = text;
      p.className = 'dc-pop' + (st ? ' ' + st : '');
      p.style.top = `calc(44% - ${popStack * 30}px)`;
      popStack = (popStack + 1) % 3;
      void p.offsetWidth;
      p.classList.add('show');
    },
    comboBump() {
      combo.classList.remove('bump');
      void combo.offsetWidth;
      combo.classList.add('bump');
    },
    tick(dt) {
      if (annLeft > 0) {
        annLeft -= dt;
        if (annLeft <= 0 && queue.length) {
          const [t, s, st] = queue.shift()!;
          showAnn(t, s, st);
        }
      }
    },
    clearFx() {
      queue.length = 0;
      annLeft = 0;
      ann.className = 'dc-ann';
      for (const p of pops) p.className = 'dc-pop';
      for (const k of Object.keys(chips) as PowerKind[]) this.setPower(k, 0);
      popStack = 0;
    },
  };
}
