# Developer API (for building scenes & mini-games)

Stack: Vite + TypeScript + three.js. Everything visual is procedural (no model files) except Hamin, who is a
Higgsfield-generated rigged GLB driven by the procedural pose system. Run `npx tsc --noEmit` to typecheck.
Dev server: `npm run dev` → http://localhost:5173. Jump straight to a scene with `?scene=<id>&debug`
(`window.game` is exposed with `?debug`; the debug overlay shows fps / draw calls / triangles).

## Scene = `class X extends GameScene` (src/scenes/GameScene.ts), `export default`
```ts
readonly id = 'dance' as const; readonly title = 'Dance Practice Room'; subtitle = '…';
music: TrackId = 'dance';            // 'title'|'school'|'yard'|'dance'|'vocal'|'cafe'|'stage'|'metro'|'beach'|'chase'|'dress'|'eat'
ambience: string|null = null;        // 'waves' | 'crowd' | 'train'
explore = true;                      // false = mini-game scene: you drive Hamin + camera yourself
build() {                            // may be async
  this.sky('#top', '#bottom');       // gradient background
  this.light({ dir:[x,y,z], shadowRange: 8, hemi, sun, env });
  this.bounds = { minX, maxX, minZ, maxZ };           // walkable rectangle
  this.cam = { dist: 17, pitch: 0.78, yawRange: 0.6, fov: 35, lookY: 1, clamp: {minX,maxX,minZ,maxZ} };
  this.statics.add(room({...}));     // static props → merged into ONE draw call by finalize()
  this.add(obj, 'box' | radius | false);  // static + optional collider (box = AABB of obj, number = circle)
  this.addDynamic(obj);              // moving/textured things (not merged)
  this.colliders.push(box(cx,cz,w,d) | circle(x,z,r));   // from core/Collision
  this.interact({ id, pos: Vector3, radius, label: '🎤 Sing', height, onInteract: async () => {...} });
  this.door('yard', '<thisSceneId>', new Vector3(x,0,z), 'Back to the Schoolyard');  // exit → spawns at your door in the yard
  this.spawnNpcs({ npcId: [x, z, facing] });           // NPCs from src/npcs/npcData.ts whose scene === this.id
  this.collectible('sticker'|'plush'|'shell'|'charm', id, object3d, 'label', '🎤');  // ids in src/game/collectibles.ts
  this.onUpdate((dt, t) => {...});
  this.spawns = { default: {x,z,rot}, map: {x,z,rot} };  // 'default' = entering from the yard, 'map' = map fast-travel
}
onEnter(spawn) {}  onExit() {}  update(dt) {}
```
Scene coordinates: +Y up, the camera looks toward −Z from +Z (yaw 0). Rooms are ~12×9, centred on the origin, with
the back wall at −Z. `room({w,d,floor,wall,...})` from src/assets/props.ts builds a cut-away dollhouse room.

## Game context (`this.game`, src/game/Game.ts)
- `player: Hamin`. Use `play(anim, {loop?, onEnd?})` and `await playAsync(anim)`; `stop()`; `holdRight(obj|null)`;
  `overrideExpression(expr|null)`; `root` (Group: position/rotation.y). Anims: idle idle2 walk run sit wave happy shy
  surprised scared eat dance sing interact spin stumble chase victory tired pose jump heart sleep lookBack.
  `player.moveSpeed = n` drives walk/run cycles when you move him yourself; `player.airborne = h` for jumps.
- `faceTo(x,z)`, `setFacing(rad)`, `lock()` / `unlock()` (block movement input), `cam: CameraRig`
  (`cam.override = { pos, look, k?, fov? }` for cutscenes, null to release; `cam.target`, `cam.update(dt)`).
- `ui`: `dialogue(name, lines, {portrait, choices}) → Promise<choiceIndex>`, `toast(icon, text, isNew)`,
  `react(worldPos, '♡', ''|'big'|'plain')`, `banner(title, sub)`, `modal(title, el, {onClose})`,
  `result({emoji,title,stats,reward,buttons}) → Promise<btnIndex>`, `layer(cls) → HTMLDivElement` (mini-game HUD, remove it yourself),
  `countdown(layer)`, `judge(layer,'perfect'|'good'|'miss')`, `rotateHint()`, `confirm()`, `setHud(bool)`.
  CSS helpers in src/ui/styles.css: `.mg-top .mg-pill .meter(.blue/.mint) > i`, `.mg-controls .pad-btn`, `.candy(.primary/.blue/.mint/.small)`, `.paper`.
- `audio.sfx(id)`, `audio.playMusic(id)`, `audio.beat()` (beats since track start), `audio.bpm`.
- `fx.burst(pos, 'hearts'|'sparkles'|'notes'|'confetti', n)`, `fx.floatUp(pos, kind)`.
- `addHearts(n, fromPos?)`, `collect(kind, id, pos, label, emoji)`, `giveItem(itemId)`,
  `finishMinigame(id, score, cleared, hearts) → {newBest, best}` (ids: dogchase eating dance vocal),
  `photo(placeName)` (snap + polaroid + saves to album), `save.data` / `save.flag(k, def)` / `save.setFlag(k, v)` / `save.save()`,
  `goto(sceneId, spawn, {text, icon})`, `returnFromMinigame()`, `input` (`input.on('swipe'|'action'|'tap'|'key', fn)` → returns unsubscribe; `isDown(code)`).

## Look & feel rules (docs/ART_BIBLE.md)
Pastel, rounded, toy-like. Build props from `src/assets/props.ts` + `src/assets/geo.ts` (`mk(geometry, color, pos, rot, scale)`,
`rbox`, `sphere`, `cyl`, `cone`, `torus`, `capsule`) with colours from `src/assets/palette.ts` (`P.pink`, …). Materials come
from `toon(color)` (soft vinyl standard material, cached, batchable) and `glossy(color)` for candy/food glaze. Signs use
`sign(text,w,h,opts)` and posters use `poster(w,h,drawFn)`. No dark UI, no realism, lots of sheep. Keep mobile budgets:
≤ 12k triangles of props per room, prefer static merged props, and use very few transparent objects.
