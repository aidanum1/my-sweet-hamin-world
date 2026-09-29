import './ui/styles.css';
import { Engine } from './core/Engine';
import { initViewport, onRotateChange, frame } from './core/Viewport';
import { hookCanvasText } from './i18n/i18n';

initViewport();
hookCanvasText();

const canvas = document.getElementById('game') as HTMLCanvasElement;
const engine = new Engine(canvas);
engine.paused = frame.rotate;
onRotateChange((r) => (engine.paused = r));
const params = new URLSearchParams(location.search);

if (params.has('ref')) {
  document.getElementById('boot')?.remove();
  import('./ref').then((m) => m.startRef(engine));
} else {
  import('./game/Game').then((m) => new m.Game(engine).boot());
}
