# ASSET MANIFEST

## Pipeline decision

**Hamin is built with Higgsfield MCP. The world is procedural.**

### Hamin (Higgsfield)
1. **Style exploration:** `gpt_image_2_5` generated 2 variants of a chibi vinyl-toy Hamin in the signature denim look
   (front A-pose, white background). Variant A became the master reference.
2. **Consistent wardrobe:** 7 more looks were generated *from the master image as a reference*, so face, hair,
   proportions and pose stay identical: school, dance, vocal, stage, cozy (sheep pajamas), beach, pastel.
   See `docs/reference/hamin_looks_sheet.png`.
3. **3D:** each image went through Higgsfield `image_to_3d` with texture + rigging (a Mixamo-style 24-bone humanoid).
4. **Optimisation:** `scripts/optimize-model.sh` (gltf-transform) applies meshopt compression, a 1024² WebP texture and
   light simplification with skinning preserved. Each file went from 8–9 MB to 0.6–0.77 MB (`public/models/hamin*.glb`).
5. **Runtime:** `characters/HaminModel.ts` normalises the scale and drives the bones from the procedural pose system,
   so all ~22 animations work on every look. The A-pose is removed automatically. A shader-projected face decal,
   auto-calibrated on the baked eyes, adds expressions (blink, happy, eat, surprised…). Looks are lazy-loaded
   and cached.
6. **Mix & Match:** modular outfit pieces (`characters/outfits.ts`) render on a procedural body *under the generated
   head* (a head-only skinned sub-mesh), so every combination still looks like the same Hamin.
7. Credits used: 8 images × 0.25 + 8 rigged 3D conversions × 35 = **282 credits**.

### Environment landmarks (Higgsfield, "option B")
All landmark props share one art-direction prompt suffix (`scripts/landmarks.json`), so every generation uses the same
pastel clay/vinyl miniature style. Each was converted to 3D and then optimised with `scripts/optimize-prop.sh`
(meshopt + WebP + simplification).
- **High quality** (`image_to_3d` textured, 30 cr): school building, stage set, sheep train, lighthouse.
- **Quick** (`sam_3_3d`, 1 cr): fountain, blossom tree, sheep bench, desk set, teacher desk, lockers, bookshelf,
  fridge (`kitchen`), cafeteria table, speaker stack, clothes rack, studio desk, cozy sofa, ticket machine, metro bench,
  café stall, beach umbrella, rowing boat, sandcastle, sheep bakery. The title-screen floating island was also
  generated this way. SAM keeps only the main object of each image, so the fridge, empty clothes rack, empty
  bookshelf and lone umbrella are dressed with small procedural extras (books, clothes, deck chairs) in-scene.
  The food counter never converted (3 failed attempts), so the cafeteria keeps its procedural counter.
- **Painted 2D art** (0.25 cr): day, sunset and twilight skies, and the classroom window view (`public/art/`).
- Placement: `GameScene.prop(id, x, z, fit, rotY, collide)` → `src/assets/landmarks.ts`. The walkable floors, walls,
  collisions and interactions stay procedural, so gameplay is unchanged, and every prop keeps its procedural
  version as a fallback if the model fails to load. Preview all props with `?ref=props` (`&list=a,b&cols=n`).
- Optimisation: quick props use `optimize-prop.sh in out 512 0.25 0.004` (≈3–6k tris each; the desk set, used six
  times, is ≈4.5k); signature pieces use `1024 0.5` (≈15–23k tris; their UV seams stop further simplification).
  All 24 prop files total ≈2.6 MB.
- Credits for this pass: ≈30 images × 0.25 + 4 × 30 + 20 × 1 ≈ **148 credits** (failed jobs are not charged).

### NPCs and sheep (Higgsfield, low budget)
Every NPC and the world's sheep are Higgsfield models made the cheap way: a `gpt_image_2_5` concept (0.25 cr) with
one shared chibi-villager style prompt (front view, clay/vinyl, pastel), then `sam_3_3d` (1 cr) → textured GLB,
optimised with `optimize-prop.sh … 512 0.25 0.004` (≈1.7–3.5k triangles, 25–50 KB each). Job IDs:
`art-src/critter_jobs.json`; concept sheet: `art-src/critters_sheet.jpg`.
- **NPCs** (`public/models/npcs/`): Ham-ssi, Dambi, Momo, Nabi, Popo, Lulu, Chef Mongmong, Yumi, Piyo, Coco (also the
  Dress Up judge), Choo, Sunny, Pado. `src/npcs/npcModels.ts` preloads a scene's NPC models before it is built and
  swaps each NPC's procedural body for the model (the rig, collider, talk label and camera logic stay). Static
  meshes can't blink or wave, so NPCs animate with bob / hop / squash-and-stretch / body wiggles instead
  (`src/npcs/Npc.ts`). If a model fails to load, that NPC stays procedural.
- **Sheep** (`public/models/critters/`): `sheep` (standing, ≈3.6k tris), `sheep_lo` (same, ≈1.5k tris, 256² texture,
  for instancing and crowds) and `sheep_sit` (sitting like a plush, ≈4k tris). Loaded with `critter()` /
  `critterGeometry()` from `src/assets/landmarks.ts`; every sheep keeps its procedural version as a fallback.
- The two cloud spirits failed the first time: the prompt "cloud" made SAM keep only the cloud body (no face or
  scarf). Retrying with the prompt "cute toy character" kept the whole character.
- Credits for this pass: 15 images × 0.25 + 17 × 1 (15 models + 2 cloud retries) ≈ **21 credits**.

### UI icons (hand-drawn SVG, no platform emoji)
The text keeps its emoji (so translations, templates and code comparisons don't change), but they never reach the
screen: `src/ui/icons/index.ts` swaps each one for a drawing when it is rendered. The i18n DOM observer calls
`iconizeNode()` after translating, and the canvas `fillText` hook calls `drawIconText()` for 3D signs and textures.
There are 168 drawings in `setA–setE.ts` (food and weather, clothes and faces, animals/hands/hearts, UI objects,
places/misc and flags), all in one sticker style (see the style guide in `index.ts`), about 120 KB of SVG in the main
bundle (≈22 KB gzip). An emoji without a drawing is dropped, with a warning in dev, so no Apple or Android emoji can
appear. Contact sheet: `node scripts/icon-sheet.mjs art-src/icons_sheet.png`.

### World, NPCs, props (procedural)
All environment assets are built in TypeScript from rounded primitives (`src/assets/`). This keeps one consistent toy
vocabulary, rooms merge into 1–3 draw calls, and there is no binary download per scene.

## Generation order followed
1. Style exploration → palette and toon ramp tokens (ART_BIBLE)
2. Master Hamin → `characters/Hamin.ts` + `?ref` sheet
3. Master environment reference → `assets/props.ts` room shell, slab, window, door
4. Sample scene → Classroom (vertical slice)
5. Consistency check → screenshots in `docs/reference/`
6. Remaining environments → the other scenes
7. NPCs → `npcs/NpcFactory.ts` (species kit)
8. Props → `assets/props.ts`, `assets/food.ts`
9. Wardrobe → `characters/outfits.ts`
10. Mini-game assets → Dog, obstacles, conveyor, rhythm UI

## Asset table

| Asset | Scene | Purpose | Art direction | Scale | Poly target | Material | Mobile budget | Ref | Gen | Opt |
|---|---|---|---|---|---|---|---|---|---|---|
| Hamin (rig + hair + face decal) | all | player | vinyl chibi, black shaggy fringe | 2.4 u | ≤ 6k tris | toon ×6 + face canvas 256² | ≤ 30 draws | Character Bible | ✅ | ✅ |
| Outfit parts (vest, tie, hoodie, jacket, skirt-free trousers, shorts, shoes) | all | dress up | flat pastel + tiny pattern | fits rig | ≤ 1.5k | toon, 64–128px canvas | toggled | Bible | ✅ | ✅ |
| Accessories ×12 (sheep ears, beanie, bucket hat, cap, glasses, headphones, star pin, ribbon, crossbag, backpack, flower crown, visor) | all | dress up | chunky toy | head-relative | ≤ 800 each | toon | lazy built | Bible | ✅ | ✅ |
| NPCs ×13 (Higgsfield sam_3_3d; procedural species kit as fallback) | all | NPCs | chibi villagers, 2 heads tall | 1.3–1.9 u | ≤ 3.5k | 1 textured material, 512² WebP | 1 draw | critters_sheet | ✅ | ✅ |
| Sheep ×3 variants (Higgsfield sam_3_3d) | yard, cafeteria, metro, train, stage, chase, title | ambience / mini-games | fluffy clay sheep | 0.4–1 u | 1.5–4k | 1 textured material | instanced where many | critters_sheet | ✅ | ✅ |
| Bori (puppy) | yard, chase | dog | cream fluffy puppy, floppy ears | 1.0 u | ≤ 2k | toon | 8 draws | — | ✅ | ✅ |
| Room shell (floor, walls, slab, baseboards) | rooms | env | dollhouse cut-away | 12×10 | ≤ 1k | vertex colour, merged | 1 draw | — | ✅ | ✅ |
| Desks/chairs, lockers, chalkboard, windows | classroom | env | butter wood | — | ≤ 8k total | merged | 2 draws | — | ✅ | ✅ |
| Mirrors, speakers, rack, bottles | dance | env | powder blue | — | ≤ 6k | merged | 2 draws | — | ✅ | ✅ |
| Mic stand, stool, lyric stand, foam panels | vocal | env | lavender | — | ≤ 6k | merged | 2 draws | — | ✅ | ✅ |
| Counter, tables, trays, menu board, food ×10 | cafeteria | env/minigame | glossy chunky food | — | ≤ 10k | merged + canvas | 4 draws | — | ✅ | ✅ |
| Stage, curtains, light cones, audience (instanced) | stage | env | pink/purple | — | ≤ 12k | merged + instanced | 6 draws | — | ✅ | ✅ |
| Station, gate, ticket machine, train | metro | env | mint | — | ≤ 10k | merged | 4 draws | — | ✅ | ✅ |
| Sea (vertex-waved), sand, pier, café stall, umbrellas, lighthouse, shells | beach | env | pastel sea | 30×30 | ≤ 14k | merged + wave shader | 6 draws | — | ✅ | ✅ |
| Obstacles ×8, path tiles, bakery | dog chase | minigame | chunky | lane 1.6 u | ≤ 1k each | toon, pooled | ≤ 40 draws | — | ✅ | ✅ |
| Sheep clouds | outdoor | ambience | sphere clusters | 2–4 u | 400 | toon | instanced | — | ✅ | ✅ |
| Blob shadow, heart/sparkle sprites | all | FX | soft radial | — | 2 | canvas 64² | pooled | — | ✅ | ✅ |
| Audio (music ×8, SFX ×20) | all | audio | toy piano, bells, soft pad | — | — | WebAudio synth | 0 KB | — | ✅ | ✅ |
