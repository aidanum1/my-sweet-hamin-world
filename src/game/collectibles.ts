// Canonical ids for everything collectible (the sticker book shows empty slots for missing ones).

export const STICKERS: { id: string; scene: string; emoji: string; name: string }[] = [
  { id: 'stk_yard', scene: 'yard', emoji: '🌷', name: 'Tulip' },
  { id: 'stk_class', scene: 'classroom', emoji: '✏️', name: 'Pencil' },
  { id: 'stk_dance', scene: 'dance', emoji: '👟', name: 'Sneaker' },
  { id: 'stk_vocal', scene: 'vocal', emoji: '🎧', name: 'Headphones' },
  { id: 'stk_cafe', scene: 'cafeteria', emoji: '🍙', name: 'Rice Ball' },
  { id: 'stk_stage', scene: 'stage', emoji: '🌟', name: 'Star' },
  { id: 'stk_metro', scene: 'metro', emoji: '🎫', name: 'Ticket' },
  { id: 'stk_beach', scene: 'beach', emoji: '🐬', name: 'Dolphin' },
];

export const PLUSHIES: { id: string; scene: string }[] = [
  { id: 'plush_yard', scene: 'yard' },
  { id: 'plush_class', scene: 'classroom' },
  { id: 'plush_dance', scene: 'dance' },
  { id: 'plush_vocal', scene: 'vocal' },
  { id: 'plush_cafe', scene: 'cafeteria' },
  { id: 'plush_stage', scene: 'stage' },
  { id: 'plush_metro', scene: 'metro' },
  { id: 'plush_beach', scene: 'beach' },
];

export const SHELLS = ['shell_1', 'shell_2', 'shell_3', 'shell_4', 'shell_5', 'shell_6'];

export const CHARMS: { id: string; emoji: string; name: string; how: string }[] = [
  { id: 'charm_chase', emoji: '🦴', name: 'Bori’s Bone', how: 'Clear Dog Chase' },
  { id: 'charm_eat', emoji: '🍓', name: 'Strawberry', how: 'Clear the Eating Game' },
  { id: 'charm_dance', emoji: '🎵', name: 'Music Note', how: 'Clear Dance Practice' },
  { id: 'charm_vocal', emoji: '🎤', name: 'Microphone', how: 'Clear Vocal Practice' },
  { id: 'charm_stage', emoji: '⭐', name: 'Stage Star', how: 'Perform on stage' },
  { id: 'charm_dress', emoji: '🎀', name: 'Ribbon', how: 'Save a new outfit' },
];

export const POSES: { id: string; name: string; anim: 'wave' | 'heart' | 'pose' | 'victory' | 'shy' | 'happy' }[] = [
  { id: 'wave', name: 'Hi-hi Wave', anim: 'wave' },
  { id: 'heart', name: 'Big Heart', anim: 'heart' },
  { id: 'pose', name: 'Wink V', anim: 'pose' },
  { id: 'victory', name: 'Victory!', anim: 'victory' },
  { id: 'shy', name: 'Shy Smile', anim: 'shy' },
  { id: 'happy', name: 'Happy Hop', anim: 'happy' },
];

export const MINIGAMES: Record<string, { name: string; emoji: string }> = {
  dogchase: { name: 'Dog Chase', emoji: '🐶' },
  eating: { name: 'Eating Game', emoji: '🍱' },
  dance: { name: 'Dance Practice', emoji: '💃' },
  vocal: { name: 'Vocal Practice', emoji: '🎤' },
};
