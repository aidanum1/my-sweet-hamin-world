# GAME DESIGN — My Sweet Hamin World

## Pitch
A tiny pastel dollhouse world dedicated to Hamin. Walk around a fictional school, chat with fluffy NPCs, play three
mini-games, earn ♡ Hamin Hearts, dress Hamin up, perform on stage, and take the metro to the seaside.

## Core loop
Explore → talk to NPCs (♡ +2 on first chat of the day, quests) → discover activities → play mini-games → earn Hearts →
unlock outfits and accessories in the Wardrobe → find stickers, shells and hidden sheep plushies → perform on stage →
ride the metro to the beach → repeat for better scores and a complete sticker book.

## Locations (scenes)
| Scene | Hub links | Activities |
|---|---|---|
| Schoolyard (hub) | Classroom, Dance, Vocal, Cafeteria, Stage, Metro | Bori the puppy triggers **Dog Chase**, a bicycle photo spot, sheep clouds |
| Sweet Reply Classroom | Schoolyard | Sit at desk, notebook doodle, window view, NPC classmates, wardrobe closet (**Dress Up**), sticker |
| Dance Practice Room | Schoolyard | **Dance Practice** rhythm challenge, helper NPC, music-note charm |
| Vocal Practice Room | Schoolyard | **Vocal Timing** challenge, sing at the mic, microphone charm |
| Cafeteria | Schoolyard | **Eating Game** at the counter, Chef Mongmong |
| Stage | Schoolyard | Performance show, unlock poses, photo moment, stage assistant |
| Metro Station | Schoolyard, Beach | Ticket machine → gate → board the train → **train ride** cutscene |
| Sweet Sea Beach | Metro | Shells (6), sit by the sea, café stall, photo spot, lighthouse, sunset toggle, hidden plush |
| Dressing Room | (from HUD / closet) | **Dress Up Hamin** |
| Dog Chase course | (from Schoolyard) | **Dog Chase** runner |

## Mandatory mini-games
1. **Dog Chase:** a three-lane auto-runner, about 60 s. Swipe or use the ◀ ▶ buttons to change lanes and swipe up or ⤒ to jump.
   Obstacles include benches, boxes, bikes, flowerpots, puddles (they slow you), signs, school bags and wandering sheep. Bori
   closes in whenever you trip. Reach the Sheep Bakery before Bori catches up. Reward = 10 + hearts collected + bonus.
2. **Dress Up Hamin:** a turntable wardrobe with categories (School, Dance, Vocal, Stage, Cozy, Casual, Beach, Pastel,
   Accessories). Tap to preview and drag to rotate. Locked items show a ♡ price and can be bought with Hearts.
   Tap ✓ to save: Hamin spins → poses → happy.
3. **Eating Game:** food slides along a pastel conveyor toward Hamin's plate. Tap when it's inside the ring
   (Perfect / Good / Miss). Combos raise the happiness meter and every bite fills the fullness meter. Don't eat the
   tiny sheep that wanders on! A golden strawberry cake gives a rare sparkle reaction. The round lasts 70 s.

## Micro activities
Dance timing, vocal timing, stage show, shells, stickers (one per scene), hidden sheep plushies, photo spots, metro ticket,
classroom doodle, window gazing, sitting spots.

## Economy (♡ Hamin Hearts)
- First chat with an NPC each day: +2. Finishing an NPC quest: +8 to +15.
- Sticker: +5. Shell: +2. Hidden plush: +10.
- Dog Chase: 10 to 40. Eating: score/150 (typically 15–35). Dance/Vocal: 5–20. Stage show: +8, once per day.
- Outfits cost 0–60 ♡ and accessories 10–40 ♡. There is no real money and no monetisation.

## NPC schema (`src/npcs/npcData.ts`)
`id, name, species, scene, position, facing, colors, dialogue[], repeatDialogue[], quest?, reward, idleAnim` plus
save-side `friendship[id] = { talks, questDone, lastTalkDay }`.

## Controls
Desktop: WASD/arrows to move, Shift to run, E/Space/Enter to interact, Q/E... (Q and R rotate the camera, C resets it), Esc for the menu.
Mobile: floating joystick on the left half, big ♡ action button on the right with a contextual label, a camera
reset button, and swipe on the right half to rotate the camera a little. Pushing the joystick far makes Hamin run.

## Save (localStorage `msh-world-save`)
Versioned (`saveVersion: 1`) with migration and sanitising. Stores hearts, owned items, outfit, visited scenes, mini-game
completion and highs, stickers, shells, plushies, charms, poses, photos (small JPEGs), NPC friendship, tutorial flag,
settings and the last scene. Settings has a **Reset Save** option.
