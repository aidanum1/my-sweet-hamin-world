import { DEFAULT_OUTFIT, FREE_ITEMS, getItem, getLook, lookItemId, OutfitState } from '../characters/outfits';
import { Emitter } from '../core/Events';

export const SAVE_KEY = 'msh-world-save';
export const SAVE_VERSION = 1;

export interface MinigameRecord { plays: number; best: number; cleared: boolean }
export interface NpcRecord { talks: number; lastDay: string; questStarted: boolean; questDone: boolean }
export interface Photo { img: string; place: string; t: number }

export interface Settings {
  master: number; music: number; sfx: number; muted: boolean;
  quality: 'auto' | 'low' | 'high';
  camSwipe: boolean;
  lang: '' | 'en' | 'zh' | 'ja' | 'ko'; // '' = auto-detect
}

export interface SaveData {
  saveVersion: number;
  hearts: number;
  totalHearts: number;
  owned: string[];
  outfit: OutfitState;
  visited: string[];
  lastScene: string;
  minigames: Record<string, MinigameRecord>;
  stickers: string[];
  shells: string[];
  plushies: string[];
  charms: string[];
  poses: string[];
  photos: Photo[];
  flags: Record<string, boolean | number | string>;
  npc: Record<string, NpcRecord>;
  settings: Settings;
  created: number;
}

export function defaultSave(): SaveData {
  return {
    saveVersion: SAVE_VERSION,
    hearts: 0,
    totalHearts: 0,
    owned: [...FREE_ITEMS],
    outfit: { ...DEFAULT_OUTFIT },
    visited: [],
    lastScene: 'classroom',
    minigames: {},
    stickers: [],
    shells: [],
    plushies: [],
    charms: [],
    poses: ['wave'],
    photos: [],
    flags: {},
    npc: {},
    settings: { master: 0.8, music: 0.6, sfx: 0.8, muted: false, quality: 'auto', camSwipe: true, lang: '' },
    created: Date.now(),
  };
}

const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
const num = (v: unknown, d: number, min = -Infinity, max = Infinity) =>
  typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : d;

/** Sanitise any parsed object into a valid SaveData (handles old/corrupted saves). */
export function sanitize(raw: any): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  // --- migrations go here (raw.saveVersion < SAVE_VERSION) ---
  d.hearts = Math.floor(num(raw.hearts, 0, 0, 999999));
  d.totalHearts = Math.floor(num(raw.totalHearts, d.hearts, 0, 9999999));
  const validId = (id: string) => !!getItem(id) || (id.startsWith('look_') && !!getLook(id.slice(5)));
  d.owned = Array.from(new Set([...FREE_ITEMS, ...strArr(raw.owned).filter(validId)]));
  if (raw.outfit && typeof raw.outfit === 'object') {
    const lk = raw.outfit.look;
    if (typeof lk === 'string' && (lk === '' || (getLook(lk) && d.owned.includes(lookItemId(lk))))) d.outfit.look = lk;
    for (const k of Object.keys(d.outfit) as (keyof OutfitState)[]) {
      if (k === 'look') continue;
      const v = raw.outfit[k];
      if (typeof v === 'string' && (v === '' || (getItem(v) && d.owned.includes(v)))) d.outfit[k] = v;
    }
  }
  d.visited = strArr(raw.visited);
  d.lastScene = typeof raw.lastScene === 'string' ? raw.lastScene : d.lastScene;
  if (raw.minigames && typeof raw.minigames === 'object') {
    for (const [k, v] of Object.entries<any>(raw.minigames)) {
      if (v && typeof v === 'object') d.minigames[k] = { plays: num(v.plays, 0, 0), best: num(v.best, 0, 0), cleared: !!v.cleared };
    }
  }
  d.stickers = strArr(raw.stickers);
  d.shells = strArr(raw.shells);
  d.plushies = strArr(raw.plushies);
  d.charms = strArr(raw.charms);
  d.poses = Array.from(new Set(['wave', ...strArr(raw.poses)]));
  if (Array.isArray(raw.photos)) {
    d.photos = raw.photos
      .filter((p: any) => p && typeof p.img === 'string' && p.img.startsWith('data:image/'))
      .slice(-8)
      .map((p: any) => ({ img: p.img, place: String(p.place ?? ''), t: num(p.t, Date.now()) }));
  }
  if (raw.flags && typeof raw.flags === 'object') {
    for (const [k, v] of Object.entries(raw.flags)) if (['boolean', 'number', 'string'].includes(typeof v)) d.flags[k] = v as any;
  }
  if (raw.npc && typeof raw.npc === 'object') {
    for (const [k, v] of Object.entries<any>(raw.npc)) {
      if (v && typeof v === 'object')
        d.npc[k] = { talks: num(v.talks, 0, 0), lastDay: String(v.lastDay ?? ''), questStarted: !!v.questStarted, questDone: !!v.questDone };
    }
  }
  if (raw.settings && typeof raw.settings === 'object') {
    const s = raw.settings;
    d.settings.master = num(s.master, d.settings.master, 0, 1);
    d.settings.music = num(s.music, d.settings.music, 0, 1);
    d.settings.sfx = num(s.sfx, d.settings.sfx, 0, 1);
    d.settings.muted = !!s.muted;
    d.settings.quality = ['auto', 'low', 'high'].includes(s.quality) ? s.quality : 'auto';
    d.settings.camSwipe = s.camSwipe !== false;
    d.settings.lang = ['en', 'zh', 'ja', 'ko'].includes(s.lang) ? s.lang : '';
  }
  d.created = num(raw.created, Date.now());
  return d;
}

export class SaveSystem extends Emitter<{ hearts: [number, number]; change: [] }> {
  data: SaveData;
  private timer = 0;
  storageOk = true;

  constructor() {
    super();
    this.data = this.load();
  }

  load(): SaveData {
    try {
      const txt = localStorage.getItem(SAVE_KEY);
      if (!txt) return defaultSave();
      return sanitize(JSON.parse(txt));
    } catch {
      // corrupted JSON or storage blocked
      try {
        const bad = localStorage.getItem(SAVE_KEY);
        if (bad) localStorage.setItem(SAVE_KEY + '-corrupt-backup', bad);
      } catch { /* ignore */ }
      return defaultSave();
    }
  }

  get isNew() {
    return this.data.visited.length === 0;
  }

  /** Debounced write. */
  save() {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.flush(), 300);
    this.emit('change');
  }

  flush() {
    clearTimeout(this.timer);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
      this.storageOk = true;
    } catch {
      // quota: drop photos first, then retry
      if (this.data.photos.length) {
        this.data.photos.splice(0, Math.ceil(this.data.photos.length / 2));
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch { this.storageOk = false; }
      } else this.storageOk = false;
    }
  }

  reset() {
    const settings = this.data.settings;
    this.data = defaultSave();
    this.data.settings = settings;
    this.flush();
    this.emit('hearts', this.data.hearts, 0);
    this.emit('change');
  }

  addHearts(n: number) {
    if (!n) return;
    this.data.hearts = Math.max(0, this.data.hearts + n);
    if (n > 0) this.data.totalHearts += n;
    this.save();
    this.emit('hearts', this.data.hearts, n);
  }

  spend(n: number) {
    if (this.data.hearts < n) return false;
    this.addHearts(-n);
    return true;
  }

  mg(id: string): MinigameRecord {
    return (this.data.minigames[id] ??= { plays: 0, best: 0, cleared: false });
  }

  npc(id: string): NpcRecord {
    return (this.data.npc[id] ??= { talks: 0, lastDay: '', questStarted: false, questDone: false });
  }

  flag<T extends boolean | number | string>(k: string, def: T): T {
    const v = this.data.flags[k];
    return (v === undefined ? def : v) as T;
  }
  setFlag(k: string, v: boolean | number | string) {
    this.data.flags[k] = v;
    this.save();
  }
}
