# My Sweet Hamin World ♡

A tiny pastel 3D life-sim / digital dollhouse made as an **unofficial, fan-made** tribute. Walk around a fictional
school, chat with fluffy NPCs, play mini-games, earn ♡ Hamin Hearts, dress Hamin up, perform on stage and ride the
metro to the sea. It runs in any modern browser on desktop and phones. There is no account and no backend, and
progress saves on your device.

> Unofficial fan project. Not affiliated with or endorsed by Hamin, SMTR25, SM Entertainment, Mnet or any broadcaster.

## Play locally
```bash
npm install
npm run dev
```
Then open http://localhost:5173.

Handy URL flags:
- `?scene=beach`: jump straight to a scene. Scene ids: yard, classroom, dance, vocal, cafeteria, stage, metro, train, beach, dressing, dogchase.
- `?debug`: shows fps, draw calls and triangles, and exposes `window.game`.
- `?ref=turn|hero|face|faceclose|anims|looks|outfits`: live character reference sheets.
- `?q=high`: turns on soft shadows on mobile.

## Landscape & languages
- **Landscape only**, like a handheld life-sim. Phones held upright show a "turn your phone sideways" screen, and on
  Android pressing Play also tries fullscreen + landscape lock. Narrow desktop windows get a centred 16:9 stage.
- **Languages:** English, 中文 (Simplified), 日本語 and 한국어. Change it with the globe button labelled with the
  current language (top right of the title screen), the **Language** card at the top of the in-game Menu (☰), or
  Menu → Settings. The first launch follows the browser language. Translations live in `src/i18n/*.json`.
- **Icons:** the game never shows platform emoji. Every emoji in the text is swapped for a hand-drawn pastel SVG
  (`src/ui/icons/`, 168 drawings) in the DOM and on canvas signs; preview them with `?ref=icons` or
  `node scripts/icon-sheet.mjs`.
  After adding new text, run `node scripts/extract-strings.mjs` to refresh `src/i18n/strings.json`.

## Controls
| | Desktop | Mobile |
|---|---|---|
| Move | WASD / arrow keys (Shift = run) | Drag on the left half (floating joystick; drag far to run) |
| Interact | E / Space / Enter or click ♡ | Big ♡ button (shows a label like "Talk", "Sit", "Enter") |
| Camera | Q / R to turn, C to reset | Swipe on the right half, 🎥 to reset |
| Menu | Esc | ☰ |

## What's inside
- **Locations:** Schoolyard hub, Classroom 2-1, Dance Practice Room, Vocal Practice Room, Cafeteria, Stage Hall,
  Sweet Line metro station with a train ride, and Sweet Sea Beach.
- **Mandatory mini-games:** 🐶 Dog Chase (schoolyard, pet Bori), 👗 Dress Up Hamin (wardrobe button / classroom closet),
  and 🍱 Eating Game (cafeteria counter).
- **More:** dance and vocal rhythm practice, a stage show with photo poses, stickers, hidden sheep plushies, shells,
  charms, NPC requests, a photo album, a daily heart bonus and a sunset toggle at the beach.
- **Hamin:** 8 looks generated with Higgsfield (image → rigged, textured 3D), optimised to about 0.65 MB each and animated
  procedurally. See `docs/ASSET_MANIFEST.md`.

## Build
```bash
npm run build     # type-check + production build into dist/
npm run preview   # serve dist/ locally
```
The build uses a relative base path (`base: './'`), so it works from any GitHub Pages sub-path such as
`https://<user>.github.io/<repo>/` and needs no server routing.

## Deploy to GitHub Pages
1. Create a GitHub repository and push this project to the `main` branch.
2. In the repository, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Push to `main`. `.github/workflows/deploy.yml` builds the game and publishes `dist/`.
4. The game is live at `https://<user>.github.io/<repo>/`.

After this one-time setup, every `git push` to `main` redeploys automatically. No secrets or environment variables are needed.

## Project structure
```
src/
  core/        engine, camera rig, collisions, static batching, events
  game/        Game context (scenes, economy, NPC talk, photos), collectibles
  scenes/      one file per location + registry (lazy-loaded chunks)
  characters/  Hamin (pose system, outfits, Higgsfield model driver), Dog, face decals
  npcs/        NPC data + species kit
  minigames/   DogChase/, DressUp/, EatingGame/, Rhythm/
  ui/          HUD, dialogue, menus, tutorial, styles
  input/ audio/ save/ assets/ fx/ utils/
public/models/ optimised Higgsfield Hamin looks (.glb)
docs/          RESEARCH, ART_BIBLE, HAMIN_CHARACTER_BIBLE, GAME_DESIGN, ASSET_MANIFEST, PERFORMANCE_BUDGET, DEV_API
scripts/       optimize-model.sh (gltf-transform pipeline)
```

## Save data
The save lives in `localStorage` under `msh-world-save`. It is versioned (`saveVersion: 1`) and sanitised on load, so
old or corrupted saves fall back gracefully. You can reset it from **Menu → Settings → Reset Save**.

## Credits
Made by **mysweethamin** (X · RedNote · Weibo · YouTube).

All music and sound effects are original and synthesised live with WebAudio. World art is procedural. The Hamin models
were generated with Higgsfield from original prompts. The UI font is Nunito (SIL Open Font License). Made with ✨ and 💕.
