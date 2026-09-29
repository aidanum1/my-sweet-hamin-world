# PERFORMANCE BUDGET

## Targets
| Metric | Desktop | Mid-range mobile |
|---|---|---|
| FPS | 60 | ≥ 30 (sustained) |
| Draw calls / frame | ≤ 120 | ≤ 90 |
| Triangles / frame | ≤ 250k (shadows on) | ≤ 130k (was 90k before the Higgsfield landmark props) |
| Texture memory | ≤ 16 MB | ≤ 8 MB |
| Pixel ratio | min(dpr, 2) | min(dpr, 1.5), adaptive down to 1 |
| JS bundle (gzip) | ≤ 250 KB | same |
| Initial download | ≤ 300 KB | same |
| Scene download | ≤ 700 KB of landmark GLBs per scene (lazy, cached) | same |
| Scene build time | ≤ 150 ms | ≤ 400 ms |

## Techniques used
- **Static batching:** every static prop is baked into vertex-coloured geometry and merged into one mesh per scene
  (`core/StaticBatcher.ts`), usually 1–3 draw calls for a whole room.
- One shared `MeshToonMaterial` with a 3-step gradient for all merged geometry. Characters share cached materials per colour.
- `InstancedMesh` for audience, clouds, flowers and repeated props.
- Soft PCF shadow maps on desktop only (off on mobile, `?q=high` forces them). Blob decals under characters.
  The big landmark models skip casting shadows where the shadow pass would exceed budget (beach, metro, stage).
- 1 hemisphere light + 1 directional light. No point/spot lights (stage light "beams" are fake additive cones).
- Canvas textures ≤ 256² (faces, signs), 64² for patterns and sprites.
- Higgsfield landmark props (`public/models/props/*.glb`): one mesh + one 512² WebP each (1024² for the four
  signature pieces), meshopt-compressed, simplified to ≈1–6k triangles (signature pieces 15–23k), loaded once and
  shared between instances.
- Scenes are built lazily on enter and **fully disposed** on exit (geometry, materials, textures) except the shared cache.
- Adaptive resolution: if the average FPS is < 40 for 2 s, the pixel ratio steps down (1.5 → 1.25 → 1.0).
- A `?debug` URL flag shows live FPS, draw calls, triangles, geometries and textures.

## Measured results (landmark + NPC/sheep pass, 2026-09-29)
Measured in-engine with `renderer.info` at the **mobile profile**: touch device, DPR 1.5, shadow maps off,
740×360 landscape viewport, at each scene's spawn view. Numbers are for the full frame, including Hamin (about 26k
triangles for the skinned Higgsfield model).

| Scene | Draw calls | Triangles | Before landmarks | FPS* |
|---|---|---|---|---|
| Schoolyard | 60 | 118k | 75k | 60 |
| Classroom | 59 | 94k | 64k | 60 |
| Cafeteria | 47 | 97k | 88k | 60 |
| Dance room | 43 | 57k | 51k | 60 |
| Vocal room | 36 | 54k | 57k | 60 |
| Stage (22 Higgsfield sheep fans) | 41 | 93k | 56k | 60 |
| Metro | 46 | 61k | 40k | 60 |
| Train ride | 19 | 56k | — | 60 |
| Beach | 35 | 88k | 66k | 60 |
| Dress Up | 43 | 42k | 47k | 60 |
| Dog Chase (running) | 26–32 | 90–124k | 56k (intro view) | 60 |

\*The FPS was measured on a desktop GPU in mobile emulation. Real mid-range phones are protected by the adaptive
resolution step-down (1.5 → 1.25 → 1.0 when under 40 fps for 2 s).

All scenes are within the revised mobile budget (≤ 90 draw calls, ≤ 130k triangles). The schoolyard is the heaviest:
its high-quality school building is 23k triangles, and its UV seams stop it from simplifying further. To make room,
the blossom trees (2.7k each) and sheep benches (1.2k) were simplified harder, and the distant hills and trees hidden
behind the building are no longer built. Dog Chase's cost comes from its pooled street tiles (7–13k each, about 6 in
view), which existed before the landmarks.

The geometry and texture counts return to each scene's own baseline on every visit, which confirms scenes are fully
disposed between transitions. Landmark GLBs stay in the loader cache, so revisits don't re-download them.

On desktop with soft shadows on, draw calls roughly double (the shadow pass) and triangles reach 100–200k at 60 fps.

| Download | Size |
|---|---|
| JS (all chunks, gzip) | ≈ 250 KB (three.js core ≈ 156 KB) |
| CSS (gzip) | 6 KB |
| Initial Hamin model (`hamin.glb`, meshopt + WebP) | 651 KB |
| Each extra look (lazy, on first wear) | 0.6–0.77 MB |
| Scene data | 3–80 KB JS per scene + landmark GLBs (24 files, ≈2.5 MB total; 40–550 KB each) |

Optimisations applied along the way: static merging (StaticBatcher), NPC/Dog static-part merging (182 → 78 draw calls in
the yard on desktop), sheep clouds, plushies and shells merged into single meshes, fewer segments on small rounded
boxes and spheres, instanced audience and dog-chase obstacles, pooled particles, and lazy scene chunks.
