import type { Game } from '../game/Game';
import { el } from './UI';
import { appRoot, toAppRect } from '../core/Viewport';

interface Step { icon: string; text: () => string; done: (t: Tutorial) => boolean; arrow?: 'hearts' | 'act' | 'wardrobe' }

/** Short, skippable, visual first-time tutorial (move → talk → hearts → doors). */
export class Tutorial {
  private step = -1;
  private box: HTMLDivElement | null = null;
  private arrow: HTMLDivElement | null = null;
  private moved = 0;
  private talked = false;
  private steps: Step[];
  private t = 0;

  constructor(private g: Game) {
    const touch = () => document.body.classList.contains('touch');
    this.steps = [
      { icon: '🕹️', text: () => (touch() ? 'Drag on the left side of the screen to walk around!' : 'Use WASD or the arrow keys to walk around!'), done: (t) => t.moved > 1.2 },
      { icon: '💬', text: () => (touch() ? 'Walk up to Momo the bunny and tap the big ♡ button to say hi!' : 'Walk up to Momo the bunny and press E to say hi!'), done: (t) => t.talked, arrow: 'act' },
      { icon: '♡', text: () => 'These are Hamin Hearts! Earn them from friends, stickers and mini-games…', done: (t) => t.t > 4.5, arrow: 'hearts' },
      { icon: '👗', text: () => '…and spend them on outfits in the Wardrobe!', done: (t) => t.t > 4, arrow: 'wardrobe' },
      { icon: '🚪', text: () => 'Walk to the door to explore the school. Have fun ♡', done: (t) => t.t > 5 },
    ];
  }

  get active() { return this.step >= 0; }

  reset() {
    this.close();
    this.step = -1;
  }

  onScene(id: string) {
    if (this.g.save.flag('tutorialDone', false)) return;
    if (id === 'classroom' && this.step < 0) this.go(0);
    else if (id !== 'classroom' && this.step >= 0) this.finish();
  }

  event(name: 'talked') {
    if (name === 'talked') this.talked = true;
  }

  private go(i: number) {
    this.close();
    this.step = i;
    this.t = 0;
    const s = this.steps[i];
    const b = el('div', 'tut paper');
    b.innerHTML = `<div class="ti">${s.icon}</div><div class="tt">${s.text()}</div>`;
    const skip = el('button', 'skip', 'skip ✕');
    skip.onclick = () => { this.g.audio.sfx('back'); this.finish(); };
    b.appendChild(skip);
    const dots = el('div', 'tsteps', this.steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join(''));
    b.appendChild(dots);
    appRoot().appendChild(b);
    this.box = b;
    if (s.arrow) {
      const a = el('div', 'tut-arrow', s.arrow === 'act' ? '👇' : '👆');
      const target = s.arrow === 'act' ? this.g.ui.hud.act : s.arrow === 'hearts' ? this.g.ui.hud.hearts : this.g.ui.hud.wardrobe;
      const r = toAppRect(target.getBoundingClientRect());
      a.style.left = r.left + r.width / 2 - 17 + 'px';
      a.style.top = (s.arrow === 'act' ? r.top - 58 : r.bottom + 4) + 'px';
      appRoot().appendChild(a);
      this.arrow = a;
    }
  }

  private close() {
    this.box?.remove();
    this.arrow?.remove();
    this.box = this.arrow = null;
  }

  private finish() {
    this.close();
    this.step = -1;
    this.g.save.setFlag('tutorialDone', true);
  }

  update(dt: number) {
    if (this.step < 0) return;
    this.t += dt;
    if (this.g.player.moveSpeed > 0.5) this.moved += dt;
    const s = this.steps[this.step];
    if (this.box) this.box.style.visibility = this.g.ui.dialogueOpen || this.g.ui.modalOpen ? 'hidden' : '';
    if (s.done(this)) {
      if (this.step === 1) this.g.addHearts(3);
      this.g.audio.sfx('chime');
      if (this.step + 1 < this.steps.length) this.go(this.step + 1);
      else this.finish();
    }
  }
}
