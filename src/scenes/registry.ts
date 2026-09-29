import type { Game } from '../game/Game';
import type { GameScene, SceneId } from './GameScene';

type Ctor = new (g: Game) => GameScene;

export interface SceneInfo {
  title: string;
  emoji: string;
  blurb: string;
  onMap: boolean;
  load: () => Promise<Ctor>;
}

/** Lazy scene modules: each location is a separate chunk loaded on demand. */
export const SCENES: Record<SceneId, SceneInfo> = {
  title: { title: 'Title', emoji: '🐑', blurb: '', onMap: false, load: () => import('./TitleScene').then((m) => m.default) },
  yard: { title: 'Schoolyard', emoji: '🌳', blurb: 'Sweet Reply High · Bori the puppy lives here', onMap: true, load: () => import('./SchoolyardScene').then((m) => m.default) },
  classroom: { title: 'Classroom 2-1', emoji: '🏫', blurb: 'Desks, doodles and classmates', onMap: true, load: () => import('./ClassroomScene').then((m) => m.default) },
  dance: { title: 'Dance Practice Room', emoji: '💃', blurb: 'Mirrors, beats and rhythm practice', onMap: true, load: () => import('./DanceScene').then((m) => m.default) },
  vocal: { title: 'Vocal Practice Room', emoji: '🎤', blurb: 'Microphones and soft singing', onMap: true, load: () => import('./VocalScene').then((m) => m.default) },
  cafeteria: { title: 'Cafeteria', emoji: '🍱', blurb: 'Lunch time! The Eating Game', onMap: true, load: () => import('./CafeteriaScene').then((m) => m.default) },
  stage: { title: 'Stage Hall', emoji: '🌟', blurb: 'Perform a mini show', onMap: true, load: () => import('./StageScene').then((m) => m.default) },
  metro: { title: 'Sweet Line Station', emoji: '🚇', blurb: 'Take the metro to the sea', onMap: true, load: () => import('./MetroScene').then((m) => m.default) },
  train: { title: 'Sweet Line Train', emoji: '🚃', blurb: '', onMap: false, load: () => import('./TrainScene').then((m) => m.default) },
  beach: { title: 'Sweet Sea Beach', emoji: '🌊', blurb: 'Shells, waves and sunsets', onMap: true, load: () => import('./BeachScene').then((m) => m.default) },
  dressing: { title: 'Wardrobe', emoji: '👗', blurb: 'Dress Up Hamin', onMap: false, load: () => import('../minigames/DressUp/DressUpScene').then((m) => m.default) },
  dogchase: { title: 'Dog Chase!', emoji: '🐶', blurb: '', onMap: false, load: () => import('../minigames/DogChase/DogChaseScene').then((m) => m.default) },
};
