// ✨ Fashion Challenge — themes Coco the stylist hands out, and how she judges a look.
// Pure data + scoring (no DOM / three.js) so it is easy to tweak and test.

import { getItem, getLook, Item, LOOKS, OutfitState, Theme } from '../../characters/outfits';
import { tr, trf } from '../../i18n/i18n';

/** Seconds on the clock for one round. */
export const CHAL_TIME = 45;
/** ♡ per star count (index = stars). */
export const STAR_HEARTS = [0, 3, 6, 10, 16, 25];
/** Extra ♡ for the first look of the day that scores 3★ or more. */
export const DAILY_BONUS = 15;
export const flagBest = (id: string) => 'dressChal_' + id;
export const FLAG_DAY = 'dressChalDay';

export interface Challenge {
  id: string;
  emoji: string;
  name: string;
  /** Coco's announcement (dialogue lines). */
  story: string[];
  /** Short hint shown in the timer card. */
  tip: string;
  /** How well each wardrobe theme fits (0…1). */
  themes: Partial<Record<Theme, number>>;
  /** Colours that feel right for the theme (shown as swatches too). */
  palette: number[];
  /** Pieces Coco adores for this theme. */
  love: string[];
  /** Pieces that make Coco raise an eyebrow, with her comment. */
  avoid: { ids: string[]; line: string }[];
  /** Comment for a spot-on theme match. */
  perfect: string;
}

const PAJAMAS = ['top_pajama', 'bot_pajama', 'shoe_slipper', 'look_cozy'];
const STAGEY = ['top_stage_star', 'top_stage_suit', 'bot_stage', 'shoe_boot', 'look_stage'];
const SWIM = ['top_tank', 'bot_beach', 'shoe_sandal', 'look_beach'];

export const CHALLENGES: Challenge[] = [
  {
    id: 'beach', emoji: '🌊', name: 'Beach day with friends',
    story: [
      'The whole gang is heading to the seaside today! Sun, sand and strawberry ade~ 🍓',
      'Dress Hamin for a breezy beach day with friends!',
    ],
    tip: 'Sea colours, sandals & something for the sun!',
    themes: { beach: 1, casual: 0.5, pastel: 0.25 },
    palette: [0x9fd8f2, 0xbff0da, 0xffc9ae, 0xffe9a8, 0xffffff],
    love: ['acc_bucket', 'acc_heart_shades', 'acc_cap'],
    avoid: [
      { ids: ['shoe_boot'], line: 'Hmm, boots at the beach? 🥵' },
      { ids: PAJAMAS, line: 'Pajamas at the beach? Sleepy sea day! 😴' },
      { ids: ['top_vocal_knit', 'top_heart_knit', 'top_dance_hoodie', 'top_pastel_hoodie', 'top_cozy_sheep', 'top_school_blazer'], line: 'Isn’t that a bit warm for the sunshine? 🫠' },
    ],
    perfect: 'Perfect beach vibes! 🌊',
  },
  {
    id: 'movie', emoji: '🌙', name: 'Cozy movie night',
    story: [
      'Tonight is movie night! Popcorn, fluffy blankets and a sleepy sheep plushie~ 🍿',
      'Make Hamin the comfiest one on the sofa!',
    ],
    tip: 'Soft, sleepy and snuggly!',
    themes: { cozy: 1, pastel: 0.5, casual: 0.4, vocal: 0.3 },
    palette: [0xdcecff, 0xfff8f0, 0xe6d4ff, 0xffccd5, 0xffffff],
    love: ['acc_sheep_ears', 'acc_beanie', 'acc_glasses'],
    avoid: [
      { ids: STAGEY, line: 'So sparkly! Are we watching the movie or starring in it? 🌟' },
      { ids: ['acc_heart_shades'], line: 'Sunglasses indoors at night? So mysterious! 😹' },
      { ids: ['shoe_sandal', 'top_tank'], line: 'Brr! Isn’t that a bit chilly for a night in? 🥶' },
    ],
    perfect: 'The comfiest look ever! 🌙',
  },
  {
    id: 'stage', emoji: '🌟', name: 'Debut stage!',
    story: [
      'Big news: Hamin’s debut stage is tonight! Lights, fans and lots of sparkle~ ✨',
      'Give me a look that shines all the way to the back row!',
    ],
    tip: 'Sparkle, shine & star power!',
    themes: { stage: 1, dance: 0.5, pastel: 0.35, vocal: 0.3 },
    palette: [0xffffff, 0xffd36e, 0xff9db3, 0x9fc9f5, 0xe6b2ff],
    love: ['acc_mic', 'acc_headphones', 'acc_heart_shades', 'acc_crown'],
    avoid: [
      { ids: PAJAMAS, line: 'Pajamas on stage? The fans will giggle! 😴' },
      { ids: ['acc_backpack'], line: 'A backpack on stage? Is this a school trip? 🎒' },
      { ids: ['shoe_sandal', 'top_tank', 'bot_beach'], line: 'Beachwear under the spotlight? Bold! 🩴' },
    ],
    perfect: 'A true superstar look! 🌟',
  },
  {
    id: 'school', emoji: '🎒', name: 'First day of school',
    story: [
      'It’s the first day of the new term at Sweet Reply High! 🏫',
      'First impressions matter~ Neat, fresh and ready to learn!',
    ],
    tip: 'Neat uniform colours & school supplies!',
    themes: { school: 1, casual: 0.5, vocal: 0.3 },
    palette: [0xfff3dc, 0xbfddfb, 0xc9d3e8, 0xffffff, 0xff9db3],
    love: ['acc_backpack', 'acc_glasses', 'acc_ribbon'],
    avoid: [
      { ids: ['acc_heart_shades'], line: 'Sunglasses in class? The teacher is watching! 👀' },
      { ids: PAJAMAS, line: 'Did Hamin just roll out of bed? 😴' },
      { ids: SWIM, line: 'Swimwear at school? Wrong bag, Hamin! 🩳' },
    ],
    perfect: 'Top of the class! 🎒',
  },
  {
    id: 'picnic', emoji: '🌸', name: 'Picnic in pastel',
    story: [
      'The cherry blossoms are out, so we’re having a picnic in the park! 🧺',
      'Soft pastel colours only, please~ Like a strawberry milk dream!',
    ],
    tip: 'Pinks, lilacs & minty pastels!',
    themes: { pastel: 1, casual: 0.5, cozy: 0.3, beach: 0.3 },
    palette: [0xffccd5, 0xe6d4ff, 0xe9ddff, 0xbff0da, 0xffe9a8, 0xdcecff],
    love: ['acc_crown', 'acc_bucket', 'acc_crossbag', 'acc_ribbon'],
    avoid: [
      { ids: ['top_stage_suit', 'top_stage_star', 'shoe_boot'], line: 'So fancy for a picnic! Mind the strawberry jam! 🍓' },
      { ids: PAJAMAS, line: 'Napping on the picnic blanket already? 😴' },
    ],
    perfect: 'Pretty as a petal! 🌸',
  },
  {
    id: 'cafe', emoji: '☕', name: 'Café study session',
    story: [
      'Let’s study together at the cute café by the station! Iced latte and flashcards~ 📚',
      'Something smart, calm and cosy, please!',
    ],
    tip: 'Smart, calm & cosy — creams and soft blues!',
    themes: { vocal: 1, casual: 0.8, school: 0.6, cozy: 0.3 },
    palette: [0xfff1dc, 0xffe9a8, 0xb9b4cf, 0xa9cbea, 0xffffff],
    love: ['acc_glasses', 'acc_headphones', 'acc_crossbag', 'acc_beanie'],
    avoid: [
      { ids: STAGEY, line: 'A stage outfit for studying? Very dazzling! 🌟' },
      { ids: SWIM, line: 'Swimwear at the café? Brr, the air-con! 🥶' },
    ],
    perfect: 'Smart and cosy — perfect café style! ☕',
  },
  {
    id: 'dance', emoji: '💃', name: 'Dance practice day',
    story: [
      'Big practice today — new choreography! 🎶',
      'Hamin needs something comfy that can really move~',
    ],
    tip: 'Comfy, sporty & ready to move!',
    themes: { dance: 1, casual: 0.5, stage: 0.3 },
    palette: [0xffffff, 0xdccbfa, 0xa9b7d6, 0xb2d9ff, 0xffccd5],
    love: ['acc_cap', 'acc_headphones', 'acc_backpack'],
    avoid: [
      { ids: ['shoe_boot', 'shoe_loafer'], line: 'Can Hamin really dance in those shoes? 👞' },
      { ids: PAJAMAS, line: 'Slippers on the dance floor? Whoops! 🐑' },
    ],
    perfect: 'Ready to dance all day! 💃',
  },
];

export const getChallenge = (id: string) => CHALLENGES.find((c) => c.id === id);

export interface Reason { icon: string; text: string; tone: 'good' | 'meh' | 'bad' }
export interface Verdict { stars: number; points: number; reasons: Reason[]; title: string }

const SHEEP = new Set(['acc_sheep_ears', 'acc_crossbag', 'shoe_slipper', 'top_cozy_sheep', 'look_cozy']);
const SHEEP_ACC = new Set(['acc_sheep_ears', 'acc_crossbag']);

const toRgb = (c: number | string): [number, number, number] => {
  const n = typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : c;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
/** 0…1: how close a colour is to the nearest palette colour. */
function closeness(c: number | string, palette: number[]) {
  const [r, g, b] = toRgb(c);
  let best = Infinity;
  for (const p of palette) {
    const [pr, pg, pb] = toRgb(p);
    best = Math.min(best, Math.hypot(r - pr, g - pg, b - pb));
  }
  return Math.max(0, Math.min(1, 1 - (best - 0.08) / 0.42));
}

function mainColor(it: Item): number | string | undefined {
  return it.top?.base ?? it.bottom?.base ?? it.shoes?.base ?? it.acc?.color;
}

/** Everything Hamin is wearing: clothing pieces (+ the theme they count as) and accessories. */
export function wornPieces(o: OutfitState) {
  const clothes: { item: Item; theme: Theme }[] = [];
  const ids = new Set<string>();
  if (o.look) {
    const lm = getLook(o.look);
    if (lm) {
      ids.add('look_' + lm.id);
      const set = LOOKS[lm.theme as Exclude<Theme, 'acc'>]?.outfit ?? {};
      for (const id of [set.top, set.bottom, set.shoes]) {
        const it = id ? getItem(id) : undefined;
        if (it) { clothes.push({ item: it, theme: lm.theme }); ids.add(it.id); }
      }
    }
  } else {
    for (const id of [o.top, o.bottom, o.shoes]) {
      const it = id ? getItem(id) : undefined;
      if (it) { clothes.push({ item: it, theme: it.theme }); ids.add(it.id); }
    }
  }
  const accs: Item[] = [];
  for (const id of [o.head, o.face, o.extra]) {
    const it = id ? getItem(id) : undefined;
    if (it) { accs.push(it); ids.add(it.id); }
  }
  return { clothes, accs, ids };
}

const same = (a: OutfitState, b: OutfitState) =>
  (Object.keys(a) as (keyof OutfitState)[]).every((k) => (a[k] || '') === (b[k] || ''));

/** Coco's judging: theme match, loved accessories, sheep bonus, colour harmony and variety. */
export function judge(ch: Challenge, o: OutfitState, start: OutfitState): Verdict {
  const { clothes, accs, ids } = wornPieces(o);
  const reasons: Reason[] = [];
  let pts = 0;

  // 1) theme match (0…1) — the biggest part of the score
  const tm = clothes.length ? clothes.reduce((a, c) => a + (ch.themes[c.theme] ?? 0), 0) / 3 : 0;
  pts += tm * 2.6;
  if (tm >= 0.95) reasons.push({ icon: '💯', text: tr(ch.perfect), tone: 'good' });
  else if (tm >= 0.6) reasons.push({ icon: '✨', text: tr('Great match for the theme!'), tone: 'good' });
  else if (tm >= 0.3) reasons.push({ icon: '🤔', text: tr('Some pieces fit the theme… some don’t.'), tone: 'meh' });
  else reasons.push({ icon: '🤔', text: tr('Hmm… this doesn’t feel like the theme yet.'), tone: 'bad' });

  // 2) Coco's favourite pieces for this theme
  const loved = ch.love.filter((id) => ids.has(id));
  if (loved.length) {
    pts += Math.min(1.2, loved.length * 0.6);
    const names = loved.slice(0, 2).map((id) => tr(getItem(id)?.name ?? id)).join(' + ');
    reasons.push({ icon: getItem(loved[0])?.emoji ?? '🎀', text: trf('Bonus: {0}! Just what I pictured!', names), tone: 'good' });
  }

  // 3) sheep bonus (Coco can’t resist)
  if ([...ids].some((id) => SHEEP.has(id))) {
    pts += 0.4;
    const acc = [...ids].some((id) => SHEEP_ACC.has(id));
    reasons.push({ icon: '🐑', text: tr(acc ? 'Bonus: sheep accessory 🐑' : 'Bonus: a little sheep touch! 🐑'), tone: 'good' });
  }

  // 4) colour harmony with the theme palette
  let wSum = 0, cSum = 0;
  clothes.forEach((c, i) => {
    const col = mainColor(c.item);
    if (col === undefined) return;
    const w = [1, 0.8, 0.5][i] ?? 0.5;
    wSum += w;
    cSum += w * closeness(col, ch.palette);
  });
  for (const a of accs) {
    const col = mainColor(a);
    if (col === undefined) continue;
    wSum += 0.35;
    cSum += 0.35 * closeness(col, ch.palette);
  }
  const harmony = wSum ? cSum / wSum : 0;
  pts += harmony;
  if (harmony >= 0.75) reasons.push({ icon: '🎨', text: tr('Lovely colour harmony!'), tone: 'good' });
  else if (harmony < 0.45) reasons.push({ icon: '🎨', text: tr('The colours feel a little off-theme.'), tone: 'meh' });

  // 5) variety: accessorising and creative mix & match
  if (accs.length >= 2) { pts += 0.5; reasons.push({ icon: '🎀', text: tr('Nicely accessorised!'), tone: 'good' }); }
  else if (accs.length === 1) pts += 0.3;
  if (!o.look && tm >= 0.5 && new Set(clothes.map((c) => c.item.theme)).size >= 2) {
    pts += 0.3;
    reasons.push({ icon: '🧩', text: tr('Creative mix & match!'), tone: 'good' });
  }

  // 6) eyebrow-raisers
  for (const a of ch.avoid) {
    if (a.ids.some((id) => ids.has(id))) {
      pts -= 1;
      reasons.push({ icon: '😿', text: tr(a.line), tone: 'bad' });
    }
  }
  if (same(o, start)) {
    pts -= 0.6;
    reasons.push({ icon: '😹', text: tr('Did Hamin… change at all?'), tone: 'bad' });
  }

  const stars = pts >= 4.3 ? 5 : pts >= 3.4 ? 4 : pts >= 2.5 ? 3 : pts >= 1.5 ? 2 : 1;
  // a friendly nudge for next time
  if (!loved.length && stars < 5) {
    const tip = getItem(ch.love[Math.floor(Math.random() * ch.love.length)]);
    if (tip) reasons.push({ icon: '💡', text: trf('Coco’s tip: try the {0}!', tr(tip.name)), tone: 'meh' });
  }
  const title = tr(['', 'Hmm… a bold choice! 😹', 'Cute try! Keep styling ♡', 'Nice look! ♡', 'So stylish! ✨', 'Runway superstar! 🌟'][stars]);
  // good news first, then gentle notes
  const order = { good: 0, meh: 1, bad: 2 };
  reasons.sort((a, b) => order[a.tone] - order[b.tone]);
  return { stars, points: pts, reasons, title };
}
