# HAMIN CHARACTER BIBLE (canonical chibi)

There is **one** canonical Hamin, generated with **Higgsfield MCP** (master image → rigged, textured 3D model) and
animated by `src/characters/Hamin.ts` + `src/characters/HaminModel.ts`. All 8 wardrobe looks were generated *from the
master image as a reference*, so face, hair and proportions are identical. Front references for every look are in
`docs/reference/` (`hamin_front_*.png`, `hamin_looks_sheet.png`).

Live reference sheets render from the in-game model: `?ref=turn` (front/side/back/¾ + scale guide), `?ref=hero`,
`?ref=face` and `?ref=faceclose` (expressions), `?ref=anims` (animation set), `?ref=looks` (all 8 generated looks) and
`?ref=outfits` (Mix & Match bodies with the generated head).

## Proportions (world units, 1 unit ≈ 1 "toy decimetre")

| Part | Size |
|---|---|
| Total height | 2.10 (normalised at load) |
| Head | sphere Ø 0.92, centre at y = 1.86 |
| Heads tall | ≈ 2 (big-head chibi) |
| Torso | rounded capsule, 0.56 wide × 0.52 tall, centre y = 1.02 |
| Legs | capsule r 0.13, length 0.44, hips at y = 0.72 |
| Arms | capsule r 0.1, length 0.36, mitten hands (sphere r 0.12) |
| Shoes | rounded ovals 0.22 × 0.14 × 0.34 |

## Recognisable traits (stylised, not a likeness)

- **Hair:** soft black `#2B2A33` with a cool blue-grey sheen. A layered, shaggy cut with **volume at the crown**,
  a **long, full fringe** falling to the eyebrows and slightly parted off-centre, face-framing side locks over the ears,
  and a soft layered nape. It is built from around 20 overlapping ellipsoid "locks" merged into one mesh.
- **Eyes:** warm and gentle. Tall dark ovals with two highlights; the default look is a *soft eye-smile*.
- **Brows:** short soft strokes, which carry most of the expression.
- **Mouth:** small, with a gentle smile. It can open to a round "o" or a wide happy mouth.
- **Cheeks:** always a faint peach blush, stronger when shy.
- **Skin:** warm porcelain `#FFE7DA`, cheek blush `#FFB3C1`.
- **Signature look (default outfit, "Sweet Denim"), from the user-supplied reference photo:** an oversized light-wash
  denim jacket with stitched chest pockets over a white shirt, a loose dark-navy polka-dot tie, light-wash denim jeans
  with a dark belt, and chunky dark loafers with white socks. The hair is tousled black with a few locks flicking up.
  The "Sweet Reply Uniform" (cream knit vest + powder-blue tie) is the free School outfit.

## Face and expressions

The Higgsfield models always show their own baked face. Painting eyes and mouths over the textured face (a canvas
decal, and later an edit of the model's own face texture) looked like a mask and cut into the fringe, so it was
removed. Moods are carried by the animation set below (wave, happy hop, shy sway, surprised jump…) and by reaction
bubbles and particles (♡, ♪, sweat drops). The procedural expression names (`smile`, `happy`, `blink`, `shy`,
`surprised`, `scared`, `eat`, `sing`, `tired`, `wink`, `determined`, `love`) still drive the 2D portraits and the
?ref debug grid. True 3D expressions would need extra Higgsfield head variants (≈35 credits each, rigged).

## Animation set (procedural, blended)

`idle`, `idle2` (stretch / look around), `walk`, `run`, `turn` (lean in), `sit`, `wave`, `happy`, `shy`, `surprised`,
`scared`, `eat`, `dance`, `sing`, `interact`, `spin` (outfit celebration), `stumble`, `chase` (panicked dog-chase run),
`victory`, `tired` (defeat), `pose` (photo pose), `jump`.

Every animation is a pose function of time. Joint rotations are damped toward the target pose every frame, so any
animation blends smoothly into any other.

## Colour reference

| Part | Hex |
|---|---|
| Hair | `#2B2A33` (sheen `#4A4E63`) |
| Skin | `#FFE7DA` |
| Eyes | `#364049` |
| Blush | `#FFB3C1` |
| Denim (jacket + jeans) | `#A9CBEA` (grain `#9BBFE2`, stitching `#8FB5DC`) |
| Shirt | `#FFFFFF` |
| Polka-dot tie / belt | `#3B4254` with white dots |
| Loafers | `#3B4254`, sole `#2F3442` |

## Rules

Hamin is never photoreal, never sexualised and never humiliated. When he is caught by the dog, the dog just licks him and
wags its tail. He is always the kind, gentle, slightly clumsy hero of a sweet world.
