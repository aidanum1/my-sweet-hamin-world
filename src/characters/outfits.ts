// Wardrobe catalogue. Items are data; Hamin.ts paints/builds them. Prices in ♡ Hamin Hearts.

export type Slot = 'top' | 'bottom' | 'shoes' | 'head' | 'face' | 'extra';
export type Theme = 'school' | 'dance' | 'vocal' | 'stage' | 'cozy' | 'casual' | 'beach' | 'pastel' | 'acc';

export interface TopData {
  base: string; sleeve: 'long' | 'short' | 'none'; sleeveColor?: string; inner?: string;
  design: 'vest' | 'blazer' | 'tee' | 'hoodie' | 'cardigan' | 'knit' | 'jacket' | 'tank' | 'pajama' | 'shirt';
  pattern?: 'stripes' | 'dots' | 'sheep' | 'stars' | 'hearts' | 'strawberry' | 'rib' | 'denim';
  patternColor?: string; emblem?: 'heart' | 'sheep' | 'star' | 'note' | 'number';
  emblemColor?: string; tie?: number; tieDots?: boolean; collar?: number; hood?: number; accent?: string;
}
export interface BottomData { base: string; style: 'pants' | 'shorts'; pattern?: 'stripes' | 'dots' | 'denim'; patternColor?: string; stripe?: string; belt?: number }
export interface ShoeData { base: string; sole: number; lace?: number; style: 'sneaker' | 'boot' | 'sandal' | 'slipper' | 'loafer' }
export interface AccData { kind: string; color: number; color2?: number }

export interface Item {
  id: string; name: string; slot: Slot; theme: Theme; price: number; emoji: string;
  top?: TopData; bottom?: BottomData; shoes?: ShoeData; acc?: AccData;
}

/** `look` = a full Higgsfield-generated 3D look ('' = Mix & Match: modular pieces under the generated head). */
export interface OutfitState { look: string; top: string; bottom: string; shoes: string; head: string; face: string; extra: string }

/** Canonical signature look (user reference photo): light denim set, white shirt, loose polka-dot tie, dark loafers. */
export const DEFAULT_OUTFIT: OutfitState = {
  look: 'denim', top: 'top_denim', bottom: 'bot_denim_jeans', shoes: 'shoe_loafer', head: '', face: '', extra: '',
};

export const ITEMS: Item[] = [
  // ---- Signature look ----
  { id: 'top_denim', name: 'Sweet Denim Jacket', slot: 'top', theme: 'casual', price: 0, emoji: '💙',
    top: { base: '#A9CBEA', sleeve: 'long', inner: '#FFFFFF', design: 'jacket', pattern: 'denim', patternColor: '#9BBFE2', accent: '#8FB5DC', collar: 0xffffff, tie: 0x3b4254, tieDots: true } },
  { id: 'bot_denim_jeans', name: 'Light Wash Jeans', slot: 'bottom', theme: 'casual', price: 0, emoji: '👖', bottom: { base: '#A9CBEA', style: 'pants', pattern: 'denim', patternColor: '#9BBFE2', belt: 0x3b4254 } },
  { id: 'shoe_loafer', name: 'Chunky Loafers', slot: 'shoes', theme: 'casual', price: 0, emoji: '👞', shoes: { base: '#3B4254', sole: 0x2f3442, style: 'loafer' } },

  // ---- School (Sweet Reply High, fictional) ----
  { id: 'top_school_vest', name: 'Sweet Reply Vest', slot: 'top', theme: 'school', price: 0, emoji: '🎒',
    top: { base: '#FFF3DC', sleeve: 'long', sleeveColor: '#FFFFFF', inner: '#FFFFFF', design: 'vest', pattern: 'rib', patternColor: '#F3E2C2', tie: 0x9ccbff, collar: 0xffffff, emblem: 'heart', emblemColor: '#FF9DB3' } },
  { id: 'top_school_blazer', name: 'Powder Blazer', slot: 'top', theme: 'school', price: 20, emoji: '🧥',
    top: { base: '#BFDDFB', sleeve: 'long', sleeveColor: '#BFDDFB', inner: '#FFFFFF', design: 'blazer', tie: 0xff9db3, collar: 0xffffff, emblem: 'sheep', emblemColor: '#FFFFFF' } },
  { id: 'bot_school', name: 'Uniform Trousers', slot: 'bottom', theme: 'school', price: 0, emoji: '👖', bottom: { base: '#C9D3E8', style: 'pants' } },
  { id: 'bot_school_check', name: 'Checked Trousers', slot: 'bottom', theme: 'school', price: 12, emoji: '👖', bottom: { base: '#D6CCF0', style: 'pants', pattern: 'stripes', patternColor: '#C3B6E8' } },
  { id: 'shoe_cream', name: 'Cream Sneakers', slot: 'shoes', theme: 'school', price: 0, emoji: '👟', shoes: { base: '#FFF8EE', sole: 0xffffff, lace: 0xff9db3, style: 'sneaker' } },

  // ---- Dance practice ----
  { id: 'top_dance_tee', name: 'Heart Practice Tee', slot: 'top', theme: 'dance', price: 15, emoji: '👕',
    top: { base: '#FFFFFF', sleeve: 'short', design: 'tee', emblem: 'heart', emblemColor: '#FF7A93' } },
  { id: 'top_dance_hoodie', name: 'Lavender Hoodie', slot: 'top', theme: 'dance', price: 25, emoji: '🧶',
    top: { base: '#DCCBFA', sleeve: 'long', design: 'hoodie', hood: 0xd2bff5, emblem: 'star', emblemColor: '#FFFFFF' } },
  { id: 'bot_joggers', name: 'Comfy Joggers', slot: 'bottom', theme: 'dance', price: 15, emoji: '🩳', bottom: { base: '#A9B7D6', style: 'pants', stripe: '#FFFFFF' } },
  { id: 'shoe_dance', name: 'Sky Dance Shoes', slot: 'shoes', theme: 'dance', price: 18, emoji: '👟', shoes: { base: '#B2D9FF', sole: 0xffffff, lace: 0xffffff, style: 'sneaker' } },

  // ---- Vocal practice ----
  { id: 'top_vocal_knit', name: 'Soft Rib Knit', slot: 'top', theme: 'vocal', price: 20, emoji: '🧣',
    top: { base: '#B9B4CF', sleeve: 'none', design: 'knit', pattern: 'rib', patternColor: '#A8A2C2', collar: 0xb9b4cf } },
  { id: 'top_vocal_cardigan', name: 'Butter Cardigan', slot: 'top', theme: 'vocal', price: 22, emoji: '🧥',
    top: { base: '#FFE9A8', sleeve: 'long', inner: '#FFFFFF', design: 'cardigan', emblem: 'note', emblemColor: '#9B8CF0' } },
  { id: 'bot_cream', name: 'Cream Slacks', slot: 'bottom', theme: 'vocal', price: 14, emoji: '👖', bottom: { base: '#FFF1DC', style: 'pants' } },

  // ---- Stage ----
  { id: 'top_stage_star', name: 'Starlight Jacket', slot: 'top', theme: 'stage', price: 40, emoji: '✨',
    top: { base: '#FFFFFF', sleeve: 'long', inner: '#FFCCD5', design: 'jacket', pattern: 'stars', patternColor: '#FFD36E', accent: '#FF9DB3' } },
  { id: 'top_stage_suit', name: 'Pearl Blue Suit', slot: 'top', theme: 'stage', price: 50, emoji: '🤍',
    top: { base: '#9FC9F5', sleeve: 'long', inner: '#FFFFFF', design: 'blazer', collar: 0xffffff, emblem: 'star', emblemColor: '#FFF3B0', accent: '#FFFFFF' } },
  { id: 'bot_stage', name: 'Stage White Pants', slot: 'bottom', theme: 'stage', price: 25, emoji: '👖', bottom: { base: '#FFFFFF', style: 'pants', stripe: '#FFB3C1' } },
  { id: 'shoe_boot', name: 'Pearl Boots', slot: 'shoes', theme: 'stage', price: 28, emoji: '👢', shoes: { base: '#FFFFFF', sole: 0xe9ddff, style: 'boot' } },

  // ---- Cozy ----
  { id: 'top_cozy_sheep', name: 'Fluffy Sheep Hoodie', slot: 'top', theme: 'cozy', price: 30, emoji: '🐑',
    top: { base: '#FFF8F0', sleeve: 'long', design: 'hoodie', hood: 0xfff8f0, emblem: 'sheep', emblemColor: '#FFFFFF', pattern: 'dots', patternColor: '#F4EADF' } },
  { id: 'top_pajama', name: 'Cloud Pajama', slot: 'top', theme: 'cozy', price: 24, emoji: '🌙',
    top: { base: '#DCECFF', sleeve: 'long', design: 'pajama', pattern: 'stripes', patternColor: '#FFFFFF', collar: 0xffffff } },
  { id: 'bot_pajama', name: 'Cloud Pajama Pants', slot: 'bottom', theme: 'cozy', price: 18, emoji: '🌙', bottom: { base: '#DCECFF', style: 'pants', pattern: 'stripes', patternColor: '#FFFFFF' } },
  { id: 'shoe_slipper', name: 'Sheep Slippers', slot: 'shoes', theme: 'cozy', price: 20, emoji: '🐑', shoes: { base: '#FFFFFF', sole: 0xffccd5, style: 'slipper' } },

  // ---- Casual ----
  { id: 'top_white_tee', name: 'Plain White Tee', slot: 'top', theme: 'casual', price: 8, emoji: '👕',
    top: { base: '#FFFFFF', sleeve: 'short', design: 'tee' } },
  { id: 'top_stripe', name: 'Pink Stripe Tee', slot: 'top', theme: 'casual', price: 15, emoji: '🍬',
    top: { base: '#FFFFFF', sleeve: 'long', design: 'tee', pattern: 'stripes', patternColor: '#FFCCD5' } },
  { id: 'bot_denim', name: 'Light Denim Shorts', slot: 'bottom', theme: 'casual', price: 12, emoji: '🩳', bottom: { base: '#AFCDEB', style: 'shorts' } },
  { id: 'shoe_pink', name: 'Strawberry Kicks', slot: 'shoes', theme: 'casual', price: 16, emoji: '👟', shoes: { base: '#FFCCD5', sole: 0xffffff, lace: 0xffffff, style: 'sneaker' } },

  // ---- Beach ----
  { id: 'top_beach_shirt', name: 'Strawberry Beach Shirt', slot: 'top', theme: 'beach', price: 25, emoji: '🍓',
    top: { base: '#C4F1DC', sleeve: 'short', inner: '#FFFFFF', design: 'shirt', pattern: 'strawberry', patternColor: '#FF7A93', collar: 0xc4f1dc } },
  { id: 'top_tank', name: 'Sea Tank', slot: 'top', theme: 'beach', price: 14, emoji: '🌊',
    top: { base: '#9FD8F2', sleeve: 'none', design: 'tank', pattern: 'stripes', patternColor: '#FFFFFF' } },
  { id: 'bot_beach', name: 'Peach Swim Shorts', slot: 'bottom', theme: 'beach', price: 14, emoji: '🩳', bottom: { base: '#FFC9AE', style: 'shorts', stripe: '#FFFFFF' } },
  { id: 'shoe_sandal', name: 'Mint Sandals', slot: 'shoes', theme: 'beach', price: 12, emoji: '🩴', shoes: { base: '#BFF0DA', sole: 0xffffff, style: 'sandal' } },

  // ---- Cute pastel ----
  { id: 'top_heart_knit', name: 'Heart Sweater', slot: 'top', theme: 'pastel', price: 35, emoji: '💗',
    top: { base: '#FFCCD5', sleeve: 'long', design: 'knit', pattern: 'hearts', patternColor: '#FFFFFF', collar: 0xffffff } },
  { id: 'top_pastel_hoodie', name: 'Cotton Candy Hoodie', slot: 'top', theme: 'pastel', price: 32, emoji: '🍭',
    top: { base: '#E6D4FF', sleeve: 'long', sleeveColor: '#CFE6FF', design: 'hoodie', hood: 0xffccd5, emblem: 'heart', emblemColor: '#FF9DB3' } },
  { id: 'bot_lilac', name: 'Lilac Pants', slot: 'bottom', theme: 'pastel', price: 16, emoji: '👖', bottom: { base: '#E1D2FF', style: 'pants' } },
  { id: 'shoe_lilac', name: 'Cloud Sneakers', slot: 'shoes', theme: 'pastel', price: 16, emoji: '☁️', shoes: { base: '#E9DDFF', sole: 0xffffff, lace: 0xb2d9ff, style: 'sneaker' } },

  // ---- Accessories ----
  { id: 'acc_sheep_ears', name: 'Sheep Ear Headband', slot: 'head', theme: 'acc', price: 25, emoji: '🐑', acc: { kind: 'sheepEars', color: 0xffffff, color2: 0xffccd5 } },
  { id: 'acc_beanie', name: 'Strawberry Beanie', slot: 'head', theme: 'acc', price: 18, emoji: '🧢', acc: { kind: 'beanie', color: 0xffb3c1, color2: 0xffffff } },
  { id: 'acc_bucket', name: 'Butter Bucket Hat', slot: 'head', theme: 'acc', price: 20, emoji: '👒', acc: { kind: 'bucket', color: 0xffe9a8, color2: 0xffffff } },
  { id: 'acc_cap', name: 'Sky Cap', slot: 'head', theme: 'acc', price: 15, emoji: '🧢', acc: { kind: 'cap', color: 0xb2d9ff, color2: 0xffffff } },
  { id: 'acc_crown', name: 'Flower Crown', slot: 'head', theme: 'acc', price: 30, emoji: '🌸', acc: { kind: 'flowerCrown', color: 0xffccd5, color2: 0xbff0da } },
  { id: 'acc_headphones', name: 'Cloud Headphones', slot: 'head', theme: 'acc', price: 28, emoji: '🎧', acc: { kind: 'headphones', color: 0xffffff, color2: 0xb2d9ff } },
  { id: 'acc_ribbon', name: 'Ribbon Clip', slot: 'head', theme: 'acc', price: 10, emoji: '🎀', acc: { kind: 'ribbon', color: 0xff9db3 } },
  { id: 'acc_glasses', name: 'Round Glasses', slot: 'face', theme: 'acc', price: 14, emoji: '👓', acc: { kind: 'glasses', color: 0xcdb8f5 } },
  { id: 'acc_heart_shades', name: 'Heart Shades', slot: 'face', theme: 'acc', price: 22, emoji: '😎', acc: { kind: 'heartShades', color: 0xff7a93, color2: 0xffccd5 } },
  { id: 'acc_crossbag', name: 'Sheep Crossbag', slot: 'extra', theme: 'acc', price: 24, emoji: '👜', acc: { kind: 'crossbag', color: 0xffffff, color2: 0xff9db3 } },
  { id: 'acc_backpack', name: 'Sky Backpack', slot: 'extra', theme: 'acc', price: 20, emoji: '🎒', acc: { kind: 'backpack', color: 0xb2d9ff, color2: 0xffe9a8 } },
  { id: 'acc_mic', name: 'Mic Charm', slot: 'extra', theme: 'acc', price: -1, emoji: '🎤', acc: { kind: 'micCharm', color: 0xe6b2ff, color2: 0xffffff } },
];

/** Full looks shown per theme ("wear full look"). */
export const LOOKS: Record<Exclude<Theme, 'acc'>, { name: string; outfit: Partial<OutfitState> }> = {
  school: { name: 'Sweet Reply Uniform', outfit: { top: 'top_school_vest', bottom: 'bot_school', shoes: 'shoe_cream' } },
  dance: { name: 'Practice Day', outfit: { top: 'top_dance_tee', bottom: 'bot_joggers', shoes: 'shoe_dance' } },
  vocal: { name: 'Studio Session', outfit: { top: 'top_vocal_knit', bottom: 'bot_cream', shoes: 'shoe_cream', head: 'acc_headphones' } },
  stage: { name: 'Starlight Stage', outfit: { top: 'top_stage_star', bottom: 'bot_stage', shoes: 'shoe_boot' } },
  cozy: { name: 'Sleepy Sheep', outfit: { top: 'top_cozy_sheep', bottom: 'bot_pajama', shoes: 'shoe_slipper', head: 'acc_sheep_ears' } },
  casual: { name: 'Sweet Denim (signature)', outfit: { top: 'top_denim', bottom: 'bot_denim_jeans', shoes: 'shoe_loafer', head: '', face: '', extra: '' } },
  beach: { name: 'Sweet Sea Day', outfit: { top: 'top_beach_shirt', bottom: 'bot_beach', shoes: 'shoe_sandal', head: 'acc_bucket' } },
  pastel: { name: 'Cotton Candy', outfit: { top: 'top_heart_knit', bottom: 'bot_lilac', shoes: 'shoe_lilac', head: 'acc_ribbon' } },
};

export const THEMES: { id: Theme; label: string; emoji: string }[] = [
  { id: 'school', label: 'School', emoji: '🏫' },
  { id: 'dance', label: 'Dance', emoji: '💃' },
  { id: 'vocal', label: 'Vocal', emoji: '🎤' },
  { id: 'stage', label: 'Stage', emoji: '🌟' },
  { id: 'cozy', label: 'Cozy', emoji: '🌙' },
  { id: 'casual', label: 'Casual', emoji: '🚲' },
  { id: 'beach', label: 'Beach', emoji: '🌊' },
  { id: 'pastel', label: 'Pastel', emoji: '🍭' },
  { id: 'acc', label: 'Accessories', emoji: '🎀' },
];

/**
 * Full 3D looks generated with Higgsfield (image → rigged, textured GLB → gltf-transform optimise).
 * Each is its own lazily-loaded model in public/models/.
 */
export interface LookModel { id: string; name: string; theme: Theme; price: number; emoji: string; file: string }
export const LOOK_MODELS: LookModel[] = [
  { id: 'denim', name: 'Sweet Denim', theme: 'casual', price: 0, emoji: '💙', file: 'models/hamin.glb' },
  { id: 'school', name: 'Sweet Reply Uniform', theme: 'school', price: 0, emoji: '🎒', file: 'models/hamin_school.glb' },
  { id: 'dance', name: 'Practice Day', theme: 'dance', price: 25, emoji: '💃', file: 'models/hamin_dance.glb' },
  { id: 'vocal', name: 'Studio Session', theme: 'vocal', price: 30, emoji: '🎧', file: 'models/hamin_vocal.glb' },
  { id: 'stage', name: 'Starlight Stage', theme: 'stage', price: 60, emoji: '🌟', file: 'models/hamin_stage.glb' },
  { id: 'cozy', name: 'Sleepy Sheep', theme: 'cozy', price: 40, emoji: '🐑', file: 'models/hamin_cozy.glb' },
  { id: 'beach', name: 'Sweet Sea Day', theme: 'beach', price: 35, emoji: '🍓', file: 'models/hamin_beach.glb' },
  { id: 'pastel', name: 'Cotton Candy Knit', theme: 'pastel', price: 45, emoji: '💗', file: 'models/hamin_pastel.glb' },
];
export const getLook = (id: string) => LOOK_MODELS.find((l) => l.id === id);
export const lookItemId = (id: string) => 'look_' + id;

const byId = new Map(ITEMS.map((i) => [i.id, i]));
export const getItem = (id: string) => byId.get(id);
export const FREE_ITEMS = [...ITEMS.filter((i) => i.price === 0).map((i) => i.id), ...LOOK_MODELS.filter((l) => l.price === 0).map((l) => lookItemId(l.id))];
