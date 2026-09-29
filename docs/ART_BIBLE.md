# ART BIBLE — "Tiny Pastel Hamin Dollhouse World"

The whole world is a set of **cut-away dollhouse rooms** sitting on soft pastel "floating" bases, rendered like
soft vinyl / clay toys. Nothing is realistic. Every object is built from rounded primitives, so the style cannot drift
between assets.

## Visual token system

All tokens live in code in `src/assets/palette.ts` and `src/ui/styles.css`.

| Token | Value | Notes |
|---|---|---|
| `SURFACE_ROUNDNESS` | bevel radius ≈ 12–25% of the smallest dimension | Every box goes through `rbox()`; there are no sharp cubes. |
| `PASTEL_SATURATION` | HSL saturation 45–100%, lightness 78–95% for large surfaces | Accents may drop to 62% lightness (strawberry, deep blue). |
| `OUTLINE_POLICY` | **No outlines.** Shape reads through soft vinyl shading plus soft shadows. | Saves draw calls and fill rate. |
| `ROUGHNESS_RANGE` | 0.62 matte vinyl (`VINYL_ROUGHNESS`); 0.28 for glossy candy/food; metalness always 0 | One cached standard material per colour, lit by a generated soft studio environment (RoomEnvironment → PMREM, no files). |
| `LIGHTING` | 1 hemisphere + 1 directional key with a small soft (PCF) shadow frustum that follows Hamin + a studio env map; Neutral tone mapping | Mobile: shadow maps off, soft blob decals instead. |
| `CHARACTER_EYE_STYLE` | big glossy dark-brown eyes with 2 white highlights; curved `^ ^` arcs for smiles | Baked into the Higgsfield texture; expressions are a projected canvas decal. |
| `CHARACTER_BODY_RATIO` | ≈ 2 heads tall, total 2.1 world units (big-head chibi) | Hamin (Higgsfield model), NPCs at 1.6–2.2 heads. |
| `WOOD_STYLE` | butter/cream `#F6DDB8` · `#EBC9A0` with rounded planks | Never dark brown. |
| `METAL_STYLE` | powder lavender-grey `#D9DDF0` with white highlights | No chrome. |
| `FOOD_STYLE` | chunky, glossy, oversized relative to the hand (1.5×) | Face stickers on some items (the dumpling smiles). |
| `FABRIC_STYLE` | flat pastel plus a tiny canvas pattern (stripes, dots, sheep) | 64–128 px textures. |
| `UI_RADIUS` | 22 px panels, 999 px pills, 16 px buttons | |
| `ICON_STYLE` | hand-drawn pastel SVG stickers (`src/ui/icons/`): 64×64, plum-ink #5B4A5E 3 px outline, round joins, flat palette fills, small white highlight, kawaii dot-eye faces. They replace every platform emoji | |
| `SKY` | vertical gradient `#B2D9FF → #FFE3EC` | Taken from the reference site. |

## Palette

Primary: baby pink `#FFCCD5`, powder blue `#B2D9FF`, cream `#FFF6E8`, white `#FFFFFF`, light lavender `#E9DDFF`.
Accents: butter `#FFE9A8`, mint `#BFF0DA`, strawberry `#FF7A93`, pale peach `#FFDCC8`, dreamy purple `#E6B2FF`.
Ink (text, eyes): `#364049`. Muted text: `#8A99A8`.

## Sheep motif (world mascot language)

- Sheep clouds drift over outdoor scenes. They are clusters of white spheres with tiny faces.
- Sheep NPCs, sheep cushions, a sheep bench, a sheep-shaped loading spinner and a sheep that hops across transitions.
- The wool look is always made of **clustered spheres**, never a texture.
- Hamin is never turned into a sheep. The sheep headband accessory is an optional cute item.

## Composition rules

- Rooms are about 12×10 units with only the back and side walls, so the camera looks in like a dollhouse.
- Floors sit on a rounded pastel slab that floats above a soft gradient sky.
- Each room has one "hero" colour (classroom = butter, dance = powder blue, vocal = lavender, cafeteria = strawberry/peach,
  stage = pink/purple, metro = mint, beach = sea blue + sand).
- Every room has at least one sheep, one sticker collectible and one hidden plush.

## Avoid

Dark UI, black backgrounds, realistic PBR, chrome/glass, glassmorphism, grit, neon cyberpunk, and hard-edged
corporate UI.

## UI language

Stationery/sticker book: cream paper panels, dotted "stitch" borders, ribbon headers, heart pills, bubbly speech
bubbles with a tail, and big thumb-sized candy buttons. Headings use Nunito with the blue→pink gradient fill.
