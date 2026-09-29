import * as THREE from 'three';
import { Engine } from '../core/Engine';
import { CameraRig } from '../core/CameraRig';
import { resolve } from '../core/Collision';
import { Input } from '../input/Input';
import { SaveSystem } from '../save/Save';
import { AudioSystem } from '../audio/Audio';
import { UI } from '../ui/UI';
import { Particles } from '../fx/Particles';
import { Hamin } from '../characters/Hamin';
import { GameScene, SceneId } from '../scenes/GameScene';
import { SCENES } from '../scenes/registry';
import { Interactable, pickInteractable } from '../interactions/Interactions';
import { Npc } from '../npcs/Npc';
import { NpcQuest, NPCS } from '../npcs/npcData';
import { preloadNpcModels, extraNpcIds } from '../npcs/npcModels';
import { preloadIconImages } from '../ui/icons';
import { dampAngle, dampK, isTouch, pick, todayKey, angleDiff, clamp } from '../utils/math';
import { getItem, getLook, OutfitState } from '../characters/outfits';
import { HaminModel, loadHaminGltf } from '../characters/HaminModel';
import { CHARMS, STICKERS } from './collectibles';
import { openMenu, openMap } from '../ui/Menus';
import { Tutorial } from '../ui/Tutorial';
import { detectLang, Lang, setLang, startDomTranslation, tr } from '../i18n/i18n';

export type Mode = 'boot' | 'title' | 'explore' | 'busy';

/** Central game context shared by every scene and mini-game. */
export class Game {
  save = new SaveSystem();
  audio = new AudioSystem();
  input: Input;
  ui: UI;
  fx = new Particles();
  cam: CameraRig;
  player = new Hamin();
  current: GameScene | null = null;
  currentId: SceneId | null = null;
  mode: Mode = 'boot';
  private locks = 0;
  private loading = false;
  private vel = new THREE.Vector3();
  private facing = Math.PI;
  private near: Interactable | null = null;
  private stepAcc = 0;
  tutorial: Tutorial;
  prevScene: { id: SceneId; spawn: string } | null = null;

  constructor(public engine: Engine) {
    if (isTouch()) document.body.classList.add('touch');
    this.input = new Input(engine.canvas);
    this.ui = new UI(this.audio, engine.camera);
    this.cam = new CameraRig(engine.camera);
    this.tutorial = new Tutorial(this);
    this.applySettings();
    this.ui.setHearts(this.save.data.hearts);
    this.save.on('hearts', (n, d) => this.ui.setHearts(n, d));

    // HUD wiring
    const h = this.ui.hud;
    h.act.onclick = () => this.onAction();
    h.cam.onclick = () => { this.cam.reset(); this.audio.sfx('tap'); };
    h.menu.onclick = () => this.openMenu();
    h.map.onclick = () => this.canOpenUI() && (this.audio.sfx('select'), openMap(this));
    h.wardrobe.onclick = () => this.openWardrobe();
    this.input.on('action', () => {
      if (this.ui.dialogueOpen || this.ui.modalOpen) return;
      this.onAction();
    });
    this.input.on('menu', () => {
      if (this.ui.modalOpen || this.ui.dialogueOpen) return;
      this.openMenu();
    });
    this.input.on('camReset', () => this.cam.reset());
    // first user gesture unlocks audio
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: false, passive: true });
    window.addEventListener('keydown', unlock, { once: false });
    window.addEventListener('beforeunload', () => this.save.flush());
    document.addEventListener('visibilitychange', () => document.hidden && this.save.flush());

    engine.onTick((dt) => this.tick(dt));
  }

  applySettings() {
    const s = this.save.data.settings;
    this.audio.setVolumes(s);
    this.input.swipeCam = s.camSwipe;
  }

  private modelKey = '';
  /** Apply an outfit: loads the Higgsfield look model (cached) or the modular body with the generated head. */
  async dressHamin(o: OutfitState): Promise<void> {
    const look = o.look ? getLook(o.look) : undefined;
    const file = look?.file ?? 'models/hamin.glb';
    const key = file + '|' + (look ? 'full' : 'head');
    try {
      if (key !== this.modelKey) {
        const src = await loadHaminGltf(file);
        this.player.setModel(new HaminModel(src), !!look);
        this.modelKey = key;
      }
    } catch (e) {
      console.warn('look model failed to load, using modular body', e);
      if (look) return this.dressHamin({ ...o, look: '' });
    }
    this.player.setOutfit(o);
  }

  /** Switch language, persist it, and rebuild the current scene so 3D signs re-render. */
  async changeLang(l: Lang) {
    this.save.data.settings.lang = l;
    this.save.save();
    await setLang(l);
    loadLangFont(l);
    if (!this.currentId) return;
    const id = this.currentId;
    const pos = this.player.root.position.clone();
    const rot = this.facing;
    await this.goto(id, 'default', { text: '♡' });
    if (this.current?.explore) {
      this.player.root.position.copy(pos);
      this.setFacing(rot);
      this.cam.snap(pos);
    }
  }

  async boot() {
    const l = (this.save.data.settings.lang || detectLang()) as Lang;
    await setLang(l);
    loadLangFont(l);
    startDomTranslation(document.body);
    this.engine.start();
    await this.dressHamin(this.save.data.outfit);
    await preloadIconImages(); // canvas signs draw icon images synchronously
    await this.goto('title', 'default', { instant: true });
    const boot = document.getElementById('boot');
    if (boot) {
      boot.style.opacity = '0';
      setTimeout(() => boot.remove(), 500);
    }
    if (new URLSearchParams(location.search).has('debug')) (window as any).game = this;
  }

  // ---------------- scenes ----------------
  async goto(id: SceneId, spawn = 'default', o: { instant?: boolean; text?: string; icon?: string } = {}): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.lock();
    this.input.releaseAll();
    this.ui.setAction(null);
    this.ui.clearPrompts();
    if (!o.instant) await this.ui.cover(o.text ?? pick(['loading sweetness…', 'fluffing the clouds…', 'counting sheep…', 'tidying the dollhouse…']), o.icon);
    const prev = this.current;
    if (prev) {
      prev.onExit();
      if (this.currentId && SCENES[this.currentId].onMap) this.prevScene = { id: this.currentId, spawn: 'default' };
      this.player.root.removeFromParent();
      this.fx.clear();
      this.fx.group.removeFromParent();
      prev.dispose();
      this.current = null;
    }
    try {
      const Ctor = await SCENES[id].load();
      const sc = new Ctor(this);
      // Higgsfield NPC models must be loaded before build() creates the NPCs
      await preloadNpcModels([...NPCS.filter((n) => n.scene === id).map((n) => n.id), ...extraNpcIds(id)]);
      await sc.build();
      sc.finalize();
      this.current = sc;
      this.currentId = id;
      this.fx.attach(sc.scene);
      this.engine.scene = sc.scene;
      this.cam.set(sc.cam);
      this.cam.override = null;
      this.cam.reset();
      const sp = sc.spawns[spawn] ?? sc.spawns.default;
      this.player.stop();
      this.player.moveSpeed = 0;
      this.player.airborne = 0;
      this.player.lean = 0;
      this.player.overrideExpression(null);
      this.player.holdRight(null);
      this.player.root.visible = true;
      this.player.root.position.set(sp.x, 0, sp.z);
      this.player.root.rotation.y = sp.rot;
      this.facing = sp.rot;
      this.vel.set(0, 0, 0);
      if (sc.showPlayer) sc.scene.add(this.player.root);
      this.cam.snap(this.player.root.position);
      this.audio.playMusic(sc.music);
      this.audio.ambience(sc.ambience);
      this.mode = id === 'title' ? 'title' : sc.explore ? 'explore' : 'busy';
      this.ui.setHud(sc.explore);
      this.ui.setPlace(`${SCENES[id].emoji} ${tr(sc.title)}`);
      const d = this.save.data;
      const firstVisit = SCENES[id].onMap && !d.visited.includes(id);
      if (SCENES[id].onMap) {
        if (firstVisit) d.visited.push(id);
        d.lastScene = id;
        this.save.save();
      }
      sc.onEnter(spawn);
      // prime a frame so the reveal shows the new scene
      this.engine.renderer.compile(sc.scene, this.engine.camera);
    } catch (err) {
      console.error('Scene load failed', err);
      this.ui.toast('😿', 'Oops, that place could not load. Back to the schoolyard!');
      this.loading = false;
      this.locks = 0;
      if (id !== 'yard') return this.goto('yard');
    }
    if (!o.instant) await this.ui.reveal();
    this.loading = false;
    this.unlock();
    const sc = this.current;
    if (sc && sc.explore && id !== 'title') {
      this.ui.banner(sc.title, sc.subtitle);
      this.tutorial.onScene(id);
    }
  }

  /** Return to the last explorable place (used by mini-games). */
  back() {
    const p = this.prevScene;
    return this.goto(p?.id ?? 'yard', p?.spawn ?? 'default');
  }

  // ---------------- control locks ----------------
  lock() { this.locks++; this.input.enabled = false; }
  unlock() { this.locks = Math.max(0, this.locks - 1); if (!this.locks) this.input.enabled = true; }
  get locked() { return this.locks > 0; }
  private canOpenUI() { return this.mode === 'explore' && !this.locked && !this.ui.modalOpen && !this.ui.dialogueOpen; }

  openMenu() {
    if (this.mode === 'title') return;
    if (!this.ui.modalOpen && !this.ui.dialogueOpen && !this.loading) {
      this.audio.sfx('select');
      openMenu(this);
    }
  }

  openWardrobe() {
    if (!this.canOpenUI()) return;
    this.audio.sfx('select');
    if (this.currentId) this.prevScene = { id: this.currentId, spawn: '__here' };
    this.returnPos = { x: this.player.root.position.x, z: this.player.root.position.z, rot: this.facing };
    this.goto('dressing', 'default', { text: 'opening the wardrobe…', icon: '👗' });
  }
  returnPos: { x: number; z: number; rot: number } | null = null;

  /** Leave a mini-game scene back to where the player was. */
  async returnFromMinigame() {
    const p = this.prevScene ?? { id: 'yard' as SceneId, spawn: 'default' };
    const pos = p.spawn === '__here' ? this.returnPos : null;
    await this.goto(p.id, pos ? 'default' : p.spawn);
    if (pos && this.current) {
      this.player.root.position.set(pos.x, 0, pos.z);
      this.player.root.rotation.y = this.facing = pos.rot;
      this.cam.snap(this.player.root.position);
    }
  }

  // ---------------- main loop ----------------
  private tick(dt: number) {
    this.input.update();
    const sc = this.current;
    if (!sc) return;
    if (this.mode === 'explore' && sc.explore) this.movePlayer(dt, sc);
    if (sc.showPlayer) this.player.update(dt);
    sc.tick(dt);
    this.fx.update(dt);
    if (sc.explore || this.mode === 'title') {
      if (this.input.camYaw) {
        this.cam.addYaw(this.input.camYaw);
        this.input.camYaw = 0;
      }
      if (sc.explore) this.cam.target.copy(this.player.root.position);
      this.cam.update(dt);
    }
    this.tutorial.update(dt);
  }

  private movePlayer(dt: number, sc: GameScene) {
    const p = this.player;
    const inp = this.input;
    const yaw = this.cam.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const mx = rx * inp.move.x + fx * inp.move.y;
    const mz = rz * inp.move.x + fz * inp.move.y;
    const mag = Math.min(1, Math.hypot(inp.move.x, inp.move.y));
    const busy = !!p.currentAction && p.currentAction !== 'idle2';
    const speed = busy ? 0 : (inp.runHeld ? 5.2 : 3.1) * mag;
    const tx = mag > 0.01 ? (mx / (Math.hypot(mx, mz) || 1)) * speed : 0;
    const tz = mag > 0.01 ? (mz / (Math.hypot(mx, mz) || 1)) * speed : 0;
    const k = dampK(mag > 0.01 ? 10 : 14, dt);
    this.vel.x += (tx - this.vel.x) * k;
    this.vel.z += (tz - this.vel.z) * k;
    const pos = p.root.position;
    pos.x += this.vel.x * dt;
    pos.z += this.vel.z * dt;
    resolve(pos, 0.38, sc.colliders, sc.bounds);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (mag > 0.05 && !busy) {
      if (p.currentAction === 'idle2' || p.currentAction === 'sit' || p.currentAction === 'sleep') p.stop();
      const target = Math.atan2(mx, mz);
      const before = this.facing;
      this.facing = dampAngle(this.facing, target, 12, dt);
      p.lean = clamp(angleDiff(before, this.facing) / Math.max(dt, 0.001) * -0.03, -0.18, 0.18);
    } else p.lean *= 0.9;
    p.root.rotation.y = this.facing;
    p.moveSpeed = sp;
    p.running = inp.runHeld && sp > 3.5;
    // footsteps
    if (sp > 0.5) {
      this.stepAcc += dt * sp;
      if (this.stepAcc > 1.1) { this.stepAcc = 0; this.audio.sfx('step', 0.7); }
    }
    // interactions
    const near = this.locked || this.ui.dialogueOpen || this.ui.modalOpen ? null : pickInteractable(sc.interactables, pos, this.facing);
    if (near !== this.near) {
      this.near = near;
      this.ui.setAction(near ? near.label : null);
    }
    for (const it of sc.interactables) {
      if (it === near) {
        const pp = it.pos.clone();
        pp.y += it.height ?? 1.6;
        this.ui.prompt('near', pp, `<kbd>E</kbd>${it.label}`);
      }
    }
    if (!near) this.ui.prompt('near', null);
  }

  private async onAction() {
    if (this.mode !== 'explore' || this.locked || this.loading) return;
    const it = this.near;
    if (!it) {
      // little idle flourish so the button never feels dead
      if (!this.player.currentAction) this.player.play('wave');
      return;
    }
    this.audio.sfx('pop');
    this.ui.setAction(null);
    this.ui.prompt('near', null);
    this.near = null;
    // face the target
    const d = new THREE.Vector3().subVectors(it.pos, this.player.root.position);
    if (d.lengthSq() > 0.01) this.facing = Math.atan2(d.x, d.z);
    this.player.root.rotation.y = this.facing;
    this.lock();
    try {
      await it.onInteract();
    } finally {
      this.unlock();
    }
  }

  /** Face the player towards a point (used by scenes). */
  faceTo(x: number, z: number) {
    const p = this.player.root.position;
    this.facing = Math.atan2(x - p.x, z - p.z);
    this.player.root.rotation.y = this.facing;
  }
  setFacing(r: number) { this.facing = r; this.player.root.rotation.y = r; }

  // ---------------- economy & collection ----------------
  addHearts(n: number, from?: THREE.Vector3) {
    if (n <= 0) return;
    this.save.addHearts(n);
    this.audio.sfx('heart');
    if (from && this.current) this.fx.burst(from.clone().setY(from.y + 1), 'hearts', Math.min(12, 4 + n));
  }

  collect(kind: 'sticker' | 'plush' | 'shell' | 'charm', id: string, pos: THREE.Vector3 | null, label: string, emoji: string) {
    const d = this.save.data;
    const list = kind === 'sticker' ? d.stickers : kind === 'plush' ? d.plushies : kind === 'shell' ? d.shells : d.charms;
    if (list.includes(id)) return false;
    list.push(id);
    const reward = kind === 'sticker' ? 5 : kind === 'plush' ? 10 : kind === 'shell' ? 2 : 5;
    this.save.save();
    this.audio.sfx('unlock');
    this.ui.toast(emoji, `${label} added to your Sticker Book`, true);
    if (pos) {
      this.fx.burst(pos, 'sparkles', 12);
      this.ui.react(pos.clone().setY(pos.y + 0.8), '✨ NEW! ✨', 'big');
    }
    this.player.play('happy');
    this.addHearts(reward, this.player.root.position);
    if (kind === 'charm' && id === 'charm_vocal' && !d.owned.includes('acc_mic')) {
      d.owned.push('acc_mic');
      setTimeout(() => this.ui.toast('🎤', 'Mic Charm unlocked in your Wardrobe!', true), 900);
    }
    return true;
  }

  giveItem(id: string) {
    const d = this.save.data;
    if (d.owned.includes(id)) return;
    d.owned.push(id);
    this.save.save();
    const it = getItem(id);
    if (it) this.ui.toast(it.emoji, `${it.name} unlocked in your Wardrobe!`, true);
  }

  /** Record a mini-game result, reward hearts, return whether it's a new best. */
  finishMinigame(id: string, score: number, cleared: boolean, hearts: number) {
    const r = this.save.mg(id);
    r.plays++;
    const newBest = score > r.best;
    if (newBest) r.best = score;
    if (cleared) r.cleared = true;
    this.save.save();
    if (hearts > 0) this.save.addHearts(hearts);
    const charm = CHARMS.find((c) => c.id === 'charm_' + (id === 'dogchase' ? 'chase' : id === 'eating' ? 'eat' : id));
    if (cleared && charm && !this.save.data.charms.includes(charm.id)) setTimeout(() => this.collect('charm', charm.id, null, charm.name + ' charm', charm.emoji), 600);
    return { newBest, best: r.best };
  }

  // ---------------- NPCs & quests ----------------
  questMet(q: NpcQuest) {
    const d = this.save.data;
    const c = q.cond;
    switch (c.kind) {
      case 'minigame': {
        const r = d.minigames[c.id];
        return !!r && (c.best ? r.best >= c.best : r.cleared);
      }
      case 'visit': return d.visited.includes(c.scene);
      case 'count': return d[c.what].length >= c.n;
      case 'flag': return !!d.flags[c.flag];
    }
  }

  async talkTo(npc: Npc) {
    const def = npc.def;
    const rec = this.save.npc(def.id);
    const p = this.player;
    npc.talking = true;
    npc.react('talk');
    npc.rig.setFace('happy');
    this.ui.react(npc.position.clone().setY(npc.rig.height + 0.3), '♡', 'plain');
    {
      // side-on two-shot so both faces are visible
      const mid = npc.position.clone().lerp(p.root.position, 0.5);
      const dir = npc.position.clone().sub(p.root.position).setY(0).normalize();
      const perp = new THREE.Vector3(dir.z, 0, -dir.x);
      const toCam = new THREE.Vector3(Math.sin(this.cam.yaw), 0, Math.cos(this.cam.yaw));
      if (perp.dot(toCam) < 0) perp.negate();
      perp.lerp(toCam, 0.6).normalize();
      this.facing = Math.atan2(dir.x, dir.z);
      p.root.rotation.y = this.facing;
      this.cam.override = { pos: mid.clone().addScaledVector(perp, 5.2).setY(2.9), look: mid.clone().setY(1.15), k: 4 };
    }
    p.play('wave');
    const say = (lines: string[], choices?: string[]) => this.ui.dialogue(def.name, lines, { portrait: def.emoji, choices });
    const first = rec.talks === 0;
    const today = todayKey();
    const newDay = rec.lastDay !== today;
    if (first) await say(def.dialogue);
    else if (def.quest && rec.questStarted && !rec.questDone) {
      if (this.questMet(def.quest)) {
        await say(def.quest.done);
        rec.questDone = true;
        npc.react('hop');
        this.fx.burst(npc.position.clone().setY(1.2), 'hearts', 10);
        p.play('happy');
        this.addHearts(def.quest.reward, npc.position);
        this.ui.toast('💌', `Quest complete! +${def.quest.reward} ♡`, true);
        if (def.quest.rewardItem) this.giveItem(def.quest.rewardItem);
      } else await say(def.quest.remind);
    } else await say(pick(def.repeat));
    // offer quest
    if (def.quest && !rec.questStarted) {
      const c = await say(def.quest.ask, ['Okay! ♡', 'Maybe later']);
      if (c === 0) {
        rec.questStarted = true;
        this.ui.toast('📝', `New request: ${def.quest.hint}`, true);
        if (this.questMet(def.quest)) {
          await say(def.quest.done);
          rec.questDone = true;
          this.addHearts(def.quest.reward, npc.position);
          if (def.quest.rewardItem) this.giveItem(def.quest.rewardItem);
        }
      }
    }
    rec.talks++;
    if (newDay) {
      rec.lastDay = today;
      this.addHearts(2, npc.position);
    }
    this.save.save();
    npc.talking = false;
    this.cam.override = null;
    this.tutorial.event('talked');
  }

  // ---------------- photos ----------------
  async photo(place: string) {
    this.audio.sfx('camera');
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:95;transition:opacity .5s;pointer-events:none';
    (document.getElementById('app') ?? document.body).appendChild(flash);
    const img = this.engine.snapshot(360);
    requestAnimationFrame(() => (flash.style.opacity = '0'));
    setTimeout(() => flash.remove(), 600);
    const d = this.save.data;
    d.photos.push({ img, place, t: Date.now() });
    if (d.photos.length > 8) d.photos.shift();
    this.save.save();
    const b = document.createElement('div');
    b.style.textAlign = 'center';
    b.innerHTML = `<div class="polaroid" style="--r:-2deg;max-width:300px;margin:6px auto 14px"><img src="${img}" alt="photo"><span>${place} ♡</span></div><p class="note">Saved to your Sticker Book → Photos</p>`;
    await new Promise<void>((res) => this.ui.modal('📸 Snap!', b, { onClose: res }));
  }

  stickerForScene(scene: string) { return STICKERS.find((s) => s.scene === scene); }
}

const FONTS: Partial<Record<Lang, string>> = {
  ko: 'https://fonts.googleapis.com/css2?family=Jua&display=swap',
  ja: 'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@700;800&display=swap',
};
/** Load a cute rounded web font for the chosen language (Google Fonts, unicode-range subsets). */
function loadLangFont(l: Lang) {
  const href = FONTS[l];
  if (!href || document.querySelector(`link[data-lang-font="${l}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.langFont = l;
  document.head.appendChild(link);
}
