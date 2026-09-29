import type { NpcLook } from './NpcFactory';

/** Quest condition kinds checked by Game.questMet(). */
export type QuestCond =
  | { kind: 'minigame'; id: string; best?: number } // cleared (or best score ≥ best)
  | { kind: 'visit'; scene: string }
  | { kind: 'count'; what: 'stickers' | 'shells' | 'plushies' | 'charms'; n: number }
  | { kind: 'flag'; flag: string };

export interface NpcQuest {
  ask: string[]; // offered after first chat
  remind: string[];
  done: string[];
  cond: QuestCond;
  reward: number; // hearts
  rewardItem?: string; // wardrobe item id
  hint: string; // shown in the sticker book quest list
}

export interface NpcDef {
  id: string;
  name: string;
  scene: string;
  pos: [number, number]; // x, z (scenes may override with placeNpc)
  facing: number; // radians
  look: NpcLook;
  role: string;
  emoji: string;
  dialogue: string[]; // first meeting
  repeat: string[][]; // random later chats
  quest?: NpcQuest;
  idle?: 'bob' | 'hop' | 'sway' | 'float' | 'cook' | 'dance' | 'cheer' | 'sleep';
}

export const NPCS: NpcDef[] = [
  // ---------------- Schoolyard ----------------
  {
    id: 'hamssi', name: 'Ham-ssi', scene: 'yard', pos: [2.5, 3], facing: 0, role: 'School guide', emoji: '🐹',
    look: { species: 'hamster', acc: 'cap', accColor: 0xb2d9ff },
    idle: 'hop',
    dialogue: ['Welcome to Sweet Reply High, Hamin! ♡', 'Every door here leads somewhere sweet — dance room, vocal room, the cafeteria, the stage…', 'And the metro can take you all the way to the sea! 🌊'],
    repeat: [['Did you know? Bori the puppy LOVES to play chase. Be careful! 🐶'], ['Hearts ♡ can buy new outfits in your wardrobe!'], ['I stuffed my cheeks with sunflower seeds… don’t tell anyone. 🌻']],
    quest: {
      hint: 'Visit every room at school',
      ask: ['Hey Hamin, want a tiny mission?', 'Peek into the Stage hall. The lights there are sooo pretty ✨'],
      remind: ['The stage is through the big pink doors! ✨'],
      done: ['You found the stage! You’re a real explorer now. Here, take these ♡'],
      cond: { kind: 'visit', scene: 'stage' },
      reward: 10,
    },
  },
  {
    id: 'dambi', name: 'Dambi', scene: 'yard', pos: [-6, -2], facing: 0.8, role: 'Flower-loving sheep', emoji: '🐑',
    look: { species: 'sheep', acc: 'sunhat', accColor: 0xffe9a8 },
    idle: 'sway',
    dialogue: ['Baa~ Hello, Hamin! I water the flowers every morning.', 'The clouds above look like my cousins. Can you see them? ☁️'],
    repeat: [['Baa~ ♡'], ['Every classroom hides a sleepy sheep plushie. Can you find them all? 🐑'], ['Sunny days make the wool extra fluffy.']],
    quest: {
      hint: 'Find 3 hidden sheep plushies',
      ask: ['My little plushie friends wandered off into the rooms…', 'Could you find three of them for me? They like cozy corners.'],
      remind: ['Look in cozy corners — under desks, behind speakers, near plants… 🐑'],
      done: ['You found them! They look so happy. Baa~ Thank you, Hamin!'],
      cond: { kind: 'count', what: 'plushies', n: 3 },
      reward: 15,
      rewardItem: 'acc_sheep_ears',
    },
  },
  // ---------------- Classroom ----------------
  {
    id: 'momo', name: 'Momo', scene: 'classroom', pos: [-2.2, -0.6], facing: 0.4, role: 'Bunny classmate', emoji: '🐰',
    look: { species: 'bunny', acc: 'bow', accColor: 0xff9db3 },
    idle: 'bob',
    dialogue: ['Good morning, Hamin! ♡ Did you sleep well?', 'Today is a free day! We can explore the whole school.', 'Here — a welcome gift! Hearts ♡ are our school’s sweet money.'],
    repeat: [['I drew you in my notebook… as a cloud. Is that okay? ☁️'], ['The cafeteria has strawberry cake today! 🍰'], ['Let’s do our best today, Hamin! ♡']],
    quest: {
      hint: 'Play the Eating Game in the cafeteria',
      ask: ['Chef Mongmong made a TON of food for lunch.', 'Could you help taste-test it? Just follow the smell to the cafeteria! 🍱'],
      remind: ['The cafeteria is across the schoolyard — go taste-test! 🍱'],
      done: ['You ate everything?! Chef Mongmong must be so proud. ♡'],
      cond: { kind: 'minigame', id: 'eating' },
      reward: 12,
    },
  },
  {
    id: 'nabi', name: 'Nabi', scene: 'classroom', pos: [2.8, -2.4], facing: -0.4, role: 'Class president cat', emoji: '🐱',
    look: { species: 'cat', acc: 'glasses', accColor: 0xcdb8f5 },
    idle: 'sway',
    dialogue: ['Ah, Hamin. As class president, I must inform you…', '…that there is a sticker hidden in every room of this school. Collect them for the class album!'],
    repeat: [['Stickers go in your Sticker Book. Tap the book in the menu ☰.'], ['Our class motto: "Be kind, be sweet, be on time." Mostly on time.'], ['Hmm, the chalkboard doodle… was that you? 👀']],
    quest: {
      hint: 'Collect 4 stickers',
      ask: ['Official request: please collect four room stickers for the class album.'],
      remind: ['Four stickers, please. They sparkle, so they’re easy to spot ✨'],
      done: ['Excellent work. The album is looking lovely. You have my presidential approval ♡'],
      cond: { kind: 'count', what: 'stickers', n: 4 },
      reward: 15,
      rewardItem: 'acc_glasses',
    },
  },
  // ---------------- Dance ----------------
  {
    id: 'popo', name: 'Popo', scene: 'dance', pos: [3, -1.5], facing: -0.6, role: 'Dance room helper', emoji: '🐤',
    look: { species: 'chick', acc: 'headset', accColor: 0xff9db3 },
    idle: 'dance',
    dialogue: ['Pi-pi! Welcome to the dance room!', 'Step on the pink mat to start a practice session. Tap on the beat! 💃'],
    repeat: [['Five, six, seven, eight! 💃'], ['Remember to drink water between practices! 💧'], ['Your footwork is so light~ like a cloud!']],
    quest: {
      hint: 'Clear Dance Practice',
      ask: ['Can you clear one full practice for me? I want to learn your moves!'],
      remind: ['Step on the pink mat and follow the beat~ 🎵'],
      done: ['Wow wow wow! Pi-pi! That was amazing ✨'],
      cond: { kind: 'minigame', id: 'dance' },
      reward: 10,
    },
  },
  // ---------------- Vocal ----------------
  {
    id: 'lulu', name: 'Lulu', scene: 'vocal', pos: [-2.8, -1.2], facing: 0.6, role: 'Cloud vocal coach', emoji: '☁️',
    look: { species: 'cloud', acc: 'scarf', accColor: 0xe6b2ff },
    idle: 'float',
    dialogue: ['La-la-la~ Hello, Hamin. I’m Lulu, your vocal coach.', 'Breathe in like a fluffy cloud… and sing it out softly.', 'Stand at the microphone when you’re ready to practise. 🎤'],
    repeat: [['Warm up your voice with a little hum~ 🎵'], ['Soft voice, big heart ♡'], ['Clouds hum too. You just have to listen closely.']],
    quest: {
      hint: 'Clear Vocal Practice',
      ask: ['Would you sing one full practice song for me? I’ll give you something special.'],
      remind: ['The microphone is waiting for you~ 🎤'],
      done: ['Beautiful… my fluff is trembling. ☁️ ♡'],
      cond: { kind: 'minigame', id: 'vocal' },
      reward: 10,
    },
  },
  // ---------------- Cafeteria ----------------
  {
    id: 'mongmong', name: 'Chef Mongmong', scene: 'cafeteria', pos: [0, -3.3], facing: 0, role: 'Cafeteria cook', emoji: '👩‍🍳',
    look: { species: 'sheep', acc: 'chefHat' },
    idle: 'cook',
    dialogue: ['Baa-velous! A hungry student! 🍱', 'Come to the counter and I’ll send out a lunch parade — tap each dish when it reaches your plate!', 'But careful… my little sheep helper sometimes wanders onto the tray. Don’t eat him! 🐑'],
    repeat: [['Today’s special: strawberry cake! 🍰'], ['A happy tummy makes a happy heart ♡'], ['Baa~ Everything is made with love!']],
    quest: {
      hint: 'Score 2000+ in the Eating Game',
      ask: ['I’m testing a new menu. Can you score 2000 points in one lunch?'],
      remind: ['2000 points! Keep your combo going~ 🍙'],
      done: ['Wonderful appetite! Here, a little tip from the kitchen ♡'],
      cond: { kind: 'minigame', id: 'eating', best: 2000 },
      reward: 15,
    },
  },
  {
    id: 'yumi', name: 'Yumi', scene: 'cafeteria', pos: [3.4, 1.2], facing: -1.6, role: 'Hungry bunny', emoji: '🐰',
    look: { species: 'bunny', color: 0xffe3ea, color2: 0xffffff, acc: 'none' },
    idle: 'bob',
    dialogue: ['Mmm~ the dumplings here are the best!', 'Oh, hi Hamin! Want to sit with me? ♡'],
    repeat: [['I saved you a strawberry milk! 🍓'], ['Crunch crunch… carrot sticks!'], ['Lunch is the best class of the day~']],
  },
  // ---------------- Stage ----------------
  {
    id: 'piyo', name: 'Piyo', scene: 'stage', pos: [-3.8, 2.4], facing: 0.8, role: 'Stage assistant', emoji: '🐥',
    look: { species: 'chick', color: 0xfff3b0, acc: 'headset', accColor: 0xb2d9ff },
    idle: 'bob',
    dialogue: ['Stage check! One, two~ Welcome, Hamin!', 'Step onto the star mark on the stage to start a mini show. The audience is already here! ✨', 'After the show, strike a pose for the photo ♡'],
    repeat: [['Lights… ready! Audience… ready! Hamin… ready? ✨'], ['Every show unlocks a new pose for photos 📸'], ['The lightsticks are all pastel today~']],
    quest: {
      hint: 'Perform a stage show',
      ask: ['The audience is waiting! Can you do one little show?'],
      remind: ['The star mark is center stage ✨'],
      done: ['Encore, encore! That was lovely. ♡'],
      cond: { kind: 'flag', flag: 'stageShow' },
      reward: 12,
    },
  },
  {
    id: 'coco', name: 'Coco', scene: 'stage', pos: [3.6, 3.2], facing: -0.5, role: 'Front-row fan cat', emoji: '🐱',
    look: { species: 'cat', color: 0xffe3ea, color2: 0xffffff, acc: 'bow', accColor: 0xb2d9ff },
    idle: 'cheer',
    dialogue: ['Kyaa~ it’s Hamin! ♡', 'I made a lightstick shaped like a little sheep. Isn’t it cute?'],
    repeat: [['Fighting~! ♡'], ['I’ll cheer the loudest! 📣'], ['Can I get a wave? Just one? ♡']],
  },
  // ---------------- Metro ----------------
  {
    id: 'choo', name: 'Choo', scene: 'metro', pos: [-3.2, 1.5], facing: 0.9, role: 'Station attendant', emoji: '🐑',
    look: { species: 'sheep', acc: 'cap', accColor: 0x8fdcbc },
    idle: 'sway',
    dialogue: ['Welcome to Sweet Line station! 🚇', 'Get a ticket from the machine, tap it at the gate, then hop on the train.', 'Next stop: Sweet Sea Beach ♡'],
    repeat: [['Please stand behind the fluffy line~'], ['The train is powered by giggles. Probably.'], ['The sea breeze is lovely today! 🌊']],
  },
  // ---------------- Beach ----------------
  {
    id: 'sunny', name: 'Sunny', scene: 'beach', pos: [5, -3], facing: -0.8, role: 'Beach café owner', emoji: '🐹',
    look: { species: 'hamster', color: 0xffd6a8, acc: 'apron', accColor: 0xbff0da },
    idle: 'cook',
    dialogue: ['Welcome to Sunny’s Seaside Café! ☀️', 'Try my peach ade — made with sunshine and a little sea breeze.', 'Oh! If you find pretty shells on the sand, I’d love to see them. 🐚'],
    repeat: [['One peach ade coming right up! 🍑'], ['The sunset here is the prettiest pink~'], ['Listen… the waves say shhh~ 🌊']],
    quest: {
      hint: 'Collect 6 shells at the beach',
      ask: ['Could you collect six shells? I want to decorate my café!'],
      remind: ['Shells sparkle on the sand — six please! 🐚'],
      done: ['They’re perfect! My café looks like a little dream now. Thank you! ♡'],
      cond: { kind: 'count', what: 'shells', n: 6 },
      reward: 20,
      rewardItem: 'acc_bucket',
    },
  },
  {
    id: 'pado', name: 'Pado', scene: 'beach', pos: [-4, 3], facing: 2.4, role: 'Sea-breeze cloud', emoji: '☁️',
    look: { species: 'cloud', color: 0xeef7ff, acc: 'none' },
    idle: 'float',
    dialogue: ['Fwoosh~ I’m Pado. I float over the sea all day.', 'Sit on the bench by the water sometime. The waves are very good listeners.'],
    repeat: [['The sea is extra sparkly today ✨'], ['Fwoosh~'], ['Clouds and waves are best friends 🌊']],
  },
];

export const npcById = (id: string) => NPCS.find((n) => n.id === id);
