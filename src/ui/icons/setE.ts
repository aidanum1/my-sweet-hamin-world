// Hand-drawn pastel icon set E (see src/ui/icons/index.ts for the style guide). Keys: emoji without FE0F.
// Places & transport, stationery, UI controls, symbols and the language-picker flags.

/** Wrap drawing markup in the shared root: 64×64 box, plum ink outline (stroke 3, round), no default fill. */
const S = (b: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#5B4A5E" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${b}</svg>`;
/** White glossy highlight. */
const HL = 'fill="#fff" stroke="none" opacity=".7"';
/** Plum dot (eyes, hubs). */
const INK = 'fill="#5B4A5E" stroke="none"';
/** Soft pink blush. */
const BLUSH = 'fill="#FF9DB3" stroke="none" opacity=".6"';
/** Chunky "tube" stroke: a wide plum under-stroke with a coloured stroke on top (outlined line). */
const tube = (d: string, c: string, w = 5) => `<path d="${d}" stroke-width="${w + 5}"/><path d="${d}" stroke="${c}" stroke-width="${w}"/>`;

export const SET_E: Record<string, string> = {
  // school: cream building, strawberry roof with a clock
  '🏫': S(
    `<path d="M11 30h42v26H11z" fill="#FFF6EC"/><path d="M5 33 32 11l27 22z" fill="#FF7A93"/>` +
      `<circle cx="32" cy="25" r="6.5" fill="#fff" stroke-width="2.5"/><path d="M32 21.5V25l2.5 1.5" stroke-width="2"/>` +
      `<rect x="15" y="38" width="8" height="8" rx="2" fill="#B2D9FF" stroke-width="2.5"/><rect x="41" y="38" width="8" height="8" rx="2" fill="#B2D9FF" stroke-width="2.5"/>` +
      `<path d="M27 56v-8a5 5 0 0 1 10 0v8" fill="#E8C39E" stroke-width="2.5"/><path d="M5 56h54"/>`,
  ),
  // bicycle: pink frame, white wheels
  '🚲': S(
    `<circle cx="15" cy="42" r="10.5" fill="#fff"/><circle cx="49" cy="42" r="10.5" fill="#fff"/>` +
      `<circle cx="15" cy="42" r="2.5" ${INK}/><circle cx="49" cy="42" r="2.5" ${INK}/>` +
      tube('M15 42 25 25h19M15 42h16L25 25M31 42l13-17 5 17', '#FF7A93', 3.5) +
      `<path d="M25 25l-1-5M44 25l-2-8h5" stroke-width="3.5"/><path d="M19 19.5h9" stroke-width="5.5"/><circle cx="31" cy="42" r="3" fill="#FFE9A8" stroke-width="2.5"/>`,
  ),
  // metro: mint train front with a fluffy sheep face
  '🚇': S(
    `<path d="M7 57h50" /><circle cx="22" cy="53" r="3.5" ${INK}/><circle cx="42" cy="53" r="3.5" ${INK}/>` +
      `<ellipse cx="11" cy="22" rx="5" ry="3.5" fill="#FFC4D6" transform="rotate(-25 11 22)" stroke-width="2.5"/><ellipse cx="53" cy="22" rx="5" ry="3.5" fill="#FFC4D6" transform="rotate(25 53 22)" stroke-width="2.5"/>` +
      `<rect x="13" y="12" width="38" height="40" rx="11" fill="#BFF0DA"/>` +
      `<path d="M13 19a6 6 0 0 1 7-9 7 7 0 0 1 12-4 7 7 0 0 1 12 3 6 6 0 0 1 7 8c-5 3-11 1-13 0-3 2-9 2-12 0-3 2-10 3-13 2z" fill="#fff"/>` +
      `<rect x="19" y="21" width="26" height="11" rx="4.5" fill="#B2D9FF" stroke-width="2.5"/><path d="M23 29l5-5" stroke="#fff" stroke-width="2.5" opacity=".8"/>` +
      `<circle cx="25" cy="39" r="2.2" ${INK}/><circle cx="39" cy="39" r="2.2" ${INK}/><path d="M29.5 42q2.5 2.5 5 0" stroke-width="2"/>` +
      `<ellipse cx="21" cy="43.5" rx="3" ry="2" ${BLUSH}/><ellipse cx="43" cy="43.5" rx="3" ry="2" ${BLUSH}/>`,
  ),
  // railway car: mint carriage with pink stripe and pantograph
  '🚃': S(
    `<path d="M24 12l7-7 7 7" stroke-width="2.5"/><rect x="11" y="10" width="42" height="7" rx="3" fill="#9BD9BD" stroke-width="2.5"/>` +
      `<rect x="5" y="15" width="54" height="33" rx="8" fill="#BFF0DA"/>` +
      `<rect x="10" y="21" width="11" height="11" rx="3" fill="#B2D9FF" stroke-width="2.5"/><rect x="26.5" y="21" width="11" height="11" rx="3" fill="#B2D9FF" stroke-width="2.5"/><rect x="43" y="21" width="11" height="11" rx="3" fill="#B2D9FF" stroke-width="2.5"/>` +
      `<path d="M8 39h48" stroke="#FF9DB3" stroke-width="4"/>` +
      `<path d="M4 58h56"/><circle cx="17" cy="51" r="4.5" fill="#fff"/><circle cx="47" cy="51" r="4.5" fill="#fff"/>`,
  ),
  // anchor
  '⚓': S(
    tube('M32 18v36M21 26h22M12 37c1 11 9 17 20 17s19-6 20-17M7 42l5-6 6 4M57 42l-5-6-6 4', '#8FC9F0') +
      `<circle cx="32" cy="12" r="5.5" stroke-width="10"/><circle cx="32" cy="12" r="5.5" stroke="#8FC9F0" stroke-width="5"/>`,
  ),
  // notebook: lavender composition book with label
  '📓': S(
    `<rect x="14" y="6" width="38" height="52" rx="5" fill="#E6B2FF"/><path d="M14 11a5 5 0 0 1 5-5h4v52h-4a5 5 0 0 1-5-5z" fill="#C9A4F0"/>` +
      `<rect x="28" y="16" width="18" height="11" rx="3" fill="#fff" stroke-width="2.5"/><path d="M32 21.5h10" stroke-width="2"/>` +
      `<circle cx="31" cy="38" r="2" ${HL}/><circle cx="41" cy="44" r="2.5" ${HL}/><circle cx="33" cy="50" r="1.6" ${HL}/><circle cx="45" cy="34" r="1.6" ${HL}/>`,
  ),
  // chair: wooden chair with pink cushions
  '🪑': S(
    `<rect x="22" y="40" width="5" height="13" rx="2" fill="#F5C26B" stroke-width="2.5"/><rect x="37" y="40" width="5" height="13" rx="2" fill="#F5C26B" stroke-width="2.5"/>` +
      `<path d="M17 36V11a5 5 0 0 1 5-5h20a5 5 0 0 1 5 5v25" fill="#E8C39E"/><rect x="22" y="11" width="20" height="15" rx="4" fill="#FFC4D6" stroke-width="2.5"/>` +
      `<rect x="14" y="43" width="6" height="15" rx="2.5" fill="#E8C39E"/><rect x="44" y="43" width="6" height="15" rx="2.5" fill="#E8C39E"/>` +
      `<rect x="10" y="34" width="44" height="10" rx="4" fill="#FFC4D6"/><path d="M16 38h10" stroke="#fff" stroke-width="2.5" opacity=".8"/>`,
  ),
  // door: wooden door with panels and golden knob
  '🚪': S(
    `<path d="M9 59h46"/><rect x="15" y="5" width="34" height="54" rx="5" fill="#E8C39E"/>` +
      `<rect x="21" y="11" width="22" height="17" rx="3" fill="#F5C26B" stroke-width="2.5"/><rect x="21" y="38" width="22" height="15" rx="3" fill="#F5C26B" stroke-width="2.5"/>` +
      `<circle cx="41" cy="33" r="3" fill="#FFE9A8" stroke-width="2.5"/>`,
  ),
  // movie camera: lavender body, pink film reels, sky lens
  '🎥': S(
    `<circle cx="17" cy="19" r="8.5" fill="#FFC4D6"/><circle cx="35" cy="19" r="8.5" fill="#FFC4D6"/><circle cx="17" cy="19" r="2.5" ${INK}/><circle cx="35" cy="19" r="2.5" ${INK}/>` +
      `<path d="M44 35l14-7v24l-14-7z" fill="#B2D9FF"/><rect x="7" y="28" width="38" height="25" rx="6" fill="#E6B2FF"/>` +
      `<path d="M13 34h8" stroke="#fff" stroke-width="3" opacity=".8"/><circle cx="37" cy="45" r="3" fill="#FF7A93" stroke-width="2.5"/>`,
  ),
  // trophy: golden cup
  '🏆': S(
    tube('M21 16h-6a8 8 0 0 0 8 11M43 16h6a8 8 0 0 1-8 11', '#FFE9A8', 3) +
      `<rect x="17" y="51" width="30" height="7" rx="3" fill="#E8C39E"/><path d="M29 36h6l2 10H27z" fill="#F5C26B"/><rect x="21" y="44" width="22" height="7" rx="3" fill="#F5C26B"/>` +
      `<path d="M19 9h26v14a13 13 0 0 1-26 0z" fill="#FFE9A8"/><path d="M25 14v8a7 7 0 0 0 4 6" stroke="#fff" stroke-width="3" opacity=".9"/>`,
  ),
  // house: peach walls, pink roof, chimney, window and door
  '🏠': S(
    `<path d="M41 20v-9h7v15" fill="#E8C39E"/><path d="M14 30h36v26H14z" fill="#FFD6B8"/><path d="M7 33 32 11l25 22z" fill="#FF9DB3"/>` +
      `<path d="M36 56V45a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v11" fill="#E8C39E" stroke-width="2.5"/>` +
      `<rect x="19" y="38" width="11" height="10" rx="2" fill="#B2D9FF" stroke-width="2.5"/><path d="M24.5 38v10M19 43h11" stroke-width="2"/><path d="M7 56h50"/>`,
  ),
  // ledger: butter spiral notebook with a heart sticker
  '📒': S(
    `<rect x="15" y="6" width="38" height="52" rx="5" fill="#FFE9A8"/><path d="M15 11a5 5 0 0 1 5-5h3v52h-3a5 5 0 0 1-5-5z" fill="#F5C26B"/>` +
      `<path d="M11 14h8M11 25h8M11 36h8M11 47h8" stroke-width="3.5"/>` +
      `<path d="M38 36c-5-3-8-6-8-9a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 3-3 6-8 9z" fill="#FF9DB3" stroke-width="2.5"/><path d="M30 46h16" stroke-width="2.5"/><path d="M28 12h19" stroke="#fff" stroke-width="3" opacity=".8"/>`,
  ),
  // muted speaker
  '🔇': S(
    `<path d="M6 24h11l14-12v40L17 40H6z" fill="#FFC4D6"/><path d="M17 24v16" stroke-width="2.5"/><path d="M22 23l5-4" stroke="#fff" stroke-width="3" opacity=".8"/>` +
      tube('M40 25l14 14m0-14L40 39', '#FF7A93', 4),
  ),
  // speaker on: sound waves
  '🔊': S(
    `<path d="M5 24h11l14-12v40L16 40H5z" fill="#FFC4D6"/><path d="M16 24v16" stroke-width="2.5"/><path d="M21 23l5-4" stroke="#fff" stroke-width="3" opacity=".8"/>` +
      `<path d="M38 26a8 8 0 0 1 0 12M44 20a16 16 0 0 1 0 24M50 14a24 24 0 0 1 0 36" stroke-width="3.5"/>`,
  ),
  // wastebasket
  '🗑': S(
    `<path d="M15 20h34l-3 34a5 5 0 0 1-5 4H23a5 5 0 0 1-5-4z" fill="#B2D9FF"/><path d="M25.5 27l1 23M32 27v23M38.5 27l-1 23" stroke-width="2.5"/>` +
      `<path d="M26 13v-3a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3" stroke-width="3"/><rect x="10" y="13" width="44" height="8" rx="4" fill="#8FC9F0"/><path d="M20 26l1 10" stroke="#fff" stroke-width="3" opacity=".8"/>`,
  ),
  // world map: folded map with mint land and a strawberry heart
  '🗺': S(
    `<path d="M6 14l16-6 20 6 16-6v42l-16 6-20-6-16 6z" fill="#B2D9FF"/><path d="M22 8l20 6v42l-20-6z" fill="#8FC9F0"/>` +
      `<path d="M10 22c4-4 12-3 15 1s-1 8-5 9-4 6-8 5-3-5-4-8 0-5 2-7zM33 36c3-3 9-2 11 1s6 1 8 4-2 7-6 7-6-2-9-3-7-6-4-9zM37 19c2-2 6-2 7 1s-2 5-5 4-4-3-2-5z" fill="#BFF0DA" stroke-width="2.5"/>` +
      `<path d="M22 8v42M42 14v42" stroke-width="2.5"/>`,
  ),
  // globe with meridians (language button)
  '🌐': S(
    `<circle cx="32" cy="32" r="25" fill="#B2D9FF"/><ellipse cx="32" cy="32" rx="11" ry="25" stroke-width="2.5"/>` +
      `<path d="M32 7v50M7 32h50M11 19.5h42M11 44.5h42" stroke-width="2.5"/><path d="M15 21a20 20 0 0 1 9-9" stroke="#fff" stroke-width="3.5" opacity=".8"/>`,
  ),
  // warning triangle
  '⚠': S(
    `<path d="M28 9.5a4.6 4.6 0 0 1 8 0l21.5 38a4.6 4.6 0 0 1-4 7h-43a4.6 4.6 0 0 1-4-7z" fill="#FFE9A8"/>` +
      `<path d="M32 23v14" stroke-width="5.5"/><circle cx="32" cy="46" r="3.3" ${INK}/>`,
  ),
  // closed red book
  '📕': S(
    `<path d="M20 11h26a5 5 0 0 1 5 5v37a5 5 0 0 1-5 5H20z" fill="#FFF6EC"/><path d="M44 14v40M22 55h20" stroke-width="2"/>` +
      `<rect x="11" y="6" width="34" height="47" rx="5" fill="#FF7A93"/><path d="M18 6v47" stroke-width="2.5"/>` +
      `<rect x="24" y="15" width="15" height="9" rx="2.5" fill="#FFC4D6" stroke-width="2.5"/><path d="M22 32v15" stroke="#fff" stroke-width="3" opacity=".7"/>`,
  ),
  // pause: two rounded bars
  '⏸': S(
    `<rect x="14" y="10" width="13" height="44" rx="5.5" fill="#B2D9FF"/><rect x="37" y="10" width="13" height="44" rx="5.5" fill="#B2D9FF"/>` +
      `<path d="M19 17v10M42 17v10" stroke="#fff" stroke-width="3" opacity=".8"/>`,
  ),
  // prohibited
  '🚫': S(
    `<circle cx="32" cy="32" r="20" fill="#fff" stroke="none"/><g stroke-width="12"><circle cx="32" cy="32" r="20"/><path d="M18 18l28 28" stroke-linecap="butt"/></g>` +
      `<g stroke="#FF7A93" stroke-width="7"><circle cx="32" cy="32" r="20"/><path d="M18 18l28 28" stroke-linecap="butt"/></g><path d="M20 27a13 13 0 0 1 5-7" stroke="#fff" stroke-width="2.5" opacity=".7"/>`,
  ),
  // 100 points
  '💯': S(
    `<g transform="translate(7 0) skewX(-12)">` +
      tube('M10 21l6-4v25M28 17c-5 0-7 6-7 12.5S23 42 28 42s7-6 7-12.5S33 17 28 17zM46 17c-5 0-7 6-7 12.5S41 42 46 42s7-6 7-12.5S51 17 46 17zM9 50c15-2 30-3 45-2M13 57c12-1.5 24-2 36-1.5', '#FF7A93', 4.5) +
      `</g>`,
  ),
  // artist palette
  '🎨': S(
    `<path d="M33 7C17 7 6 18 6 32c0 14 11 25 24 25 5 0 6-3 5-6s0-7 5-7h8c8 0 12-5 12-12C60 18 48 7 33 7z" fill="#E8C39E"/>` +
      `<circle cx="20" cy="22" r="4.5" fill="#FF7A93" stroke-width="2.5"/><circle cx="33" cy="16" r="4.5" fill="#FFE9A8" stroke-width="2.5"/><circle cx="46" cy="22" r="4.5" fill="#BFF0DA" stroke-width="2.5"/>` +
      `<circle cx="16" cy="36" r="4.5" fill="#B2D9FF" stroke-width="2.5"/><circle cx="23" cy="47" r="4.5" fill="#E6B2FF" stroke-width="2.5"/><circle cx="44" cy="35" r="4" fill="#FFF6EC" stroke-width="2.5"/>`,
  ),
  // light bulb
  '💡': S(
    `<path d="M9 13l3 3M55 13l-3 3M5 28h4M59 28h-4" stroke="#F5C26B" stroke-width="3.5"/>` +
      `<path d="M32 7a17 17 0 0 0-10 30.8c2 1.6 3 3.6 3 6.2v1h14v-1c0-2.6 1-4.6 3-6.2A17 17 0 0 0 32 7z" fill="#FFE9A8"/>` +
      `<path d="M27 33l2.5-5 2.5 4 2.5-4 2.5 5v12" stroke="#F5C26B" stroke-width="2.5"/><path d="M27 45V33" stroke="#F5C26B" stroke-width="2.5"/>` +
      `<rect x="24" y="45" width="16" height="9" rx="3" fill="#C9A4F0"/><path d="M25 49.5h14" stroke-width="2.5"/><path d="M28 54q4 5 8 0" fill="#C9A4F0" stroke-width="2.5"/>` +
      `<path d="M21 23a11 11 0 0 1 6-8" stroke="#fff" stroke-width="3.5" opacity=".8"/>`,
  ),
  // cross mark
  '❌': S(tube('M17 17l30 30M47 17 17 47', '#FF7A93', 8) + `<path d="M19 19l5 5" stroke="#fff" stroke-width="2.5" opacity=".7"/>`),
  // carousel horse on a golden pole
  '🎠': S(
    tube('M39 5v54', '#F5C26B', 3.5) +
      tube('M25 40l-6 6 4 5M31 42v11M46 42v11M51 40l4 12', '#fff', 3.5) +
      tube('M53 32c6 0 7 6 5 11', '#FF9DB3', 3.5) + tube('M23 10c3 5 6 11 10 16', '#FF9DB3', 4) +
      `<path d="M8 23c0-3 2-6 5-9l5-5 2 4 2-1c3 4 5 10 8 14h16c5 0 8 4 7 9s-4 7-7 7H28c-4 0-6-3-7-7l-2-6h-7c-3 0-4-3-4-6z" fill="#fff"/>` +
      `<path d="M34 27h10v6a5 5 0 0 1-10 0z" fill="#FF7A93" stroke-width="2.5"/>` +
      `<circle cx="15" cy="18" r="1.8" ${INK}/><ellipse cx="13" cy="24" rx="2.5" ry="1.6" ${BLUSH}/>`,
  ),
  // playground slide
  '🛝': S(
    `<path d="M4 58h56"/>` +
      tube('M44 16v40M55 16v40', '#8FC9F0', 3) +
      `<path d="M44 27h11M44 37h11M44 47h11" stroke-width="3"/>` +
      `<path d="M44 13c-11 0-14 11-18 21S15 50 7 50v7c11 0 18-7 23-18s6-17 14-17z" fill="#FF9DB3"/>` +
      `<rect x="38" y="11" width="21" height="7" rx="3" fill="#FFE9A8"/><path d="M34 22c-2 5-3 10-6 15" stroke="#fff" stroke-width="2.5" opacity=".8"/>`,
  ),
  // round pushpin
  '📍': S(
    `<path d="M32 36v22" stroke-width="4"/><circle cx="32" cy="21" r="15" fill="#FF7A93"/><ellipse cx="26" cy="15" rx="4.5" ry="3" ${HL} transform="rotate(-35 26 15)"/>`,
  ),
  // hourglass with flowing sand
  '⏳': S(
    `<path d="M15 12v40M49 12v40" stroke-width="3.5"/>` +
      `<path d="M19 12h26c0 11-9 14-11 20 2 6 11 9 11 20H19c0-11 9-14 11-20-2-6-11-9-11-20z" fill="#fff"/>` +
      `<path d="M24 21h16c-2 4-6 6-8 9-2-3-6-5-8-9z" fill="#F5C26B" stroke="none"/><path d="M32 32v13" stroke="#F5C26B" stroke-width="2.5"/>` +
      `<path d="M21 50c1-5 6-7 11-7s10 2 11 7z" fill="#F5C26B" stroke="none"/>` +
      `<path d="M19 12h26c0 11-9 14-11 20 2 6 11 9 11 20H19c0-11 9-14 11-20-2-6-11-9-11-20z"/>` +
      `<rect x="11" y="6" width="42" height="7" rx="3.5" fill="#E8C39E"/><rect x="11" y="51" width="42" height="7" rx="3.5" fill="#E8C39E"/>`,
  ),
  // sponge with bubbles
  '🧽': S(
    `<rect x="7" y="22" width="50" height="32" rx="9" fill="#FFE9A8"/>` +
      `<g fill="#F5C26B" stroke="none"><ellipse cx="18" cy="32" rx="3.5" ry="3"/><ellipse cx="30" cy="42" rx="2.5" ry="2.2"/><ellipse cx="44" cy="30" rx="3" ry="2.6"/><ellipse cx="17" cy="45" rx="2" ry="1.8"/><ellipse cx="47" cy="45" rx="3.5" ry="2.8"/><ellipse cx="32" cy="29" rx="1.8" ry="1.6"/></g>` +
      `<circle cx="47" cy="11" r="6" fill="#fff" stroke="#8FC9F0" stroke-width="2.5"/><circle cx="37" cy="12" r="3" fill="#fff" stroke="#8FC9F0" stroke-width="2.5"/><circle cx="56" cy="17" r="2.5" fill="#fff" stroke="#8FC9F0" stroke-width="2"/>`,
  ),
  // joystick
  '🕹': S(
    `<path d="M7 45c0-5 4-8 9-8h32c5 0 9 3 9 8v4c0 5-4 8-9 8H16c-5 0-9-3-9-8z" fill="#E6B2FF"/>` +
      `<circle cx="47" cy="45" r="4" fill="#B2D9FF" stroke-width="2.5"/><ellipse cx="29" cy="43" rx="8" ry="3.5" fill="#C9A4F0" stroke-width="2.5"/>` +
      tube('M29 42V22', '#fff', 3) +
      `<circle cx="29" cy="17" r="10" fill="#FF7A93"/><ellipse cx="25" cy="13" rx="3.5" ry="2.3" ${HL} transform="rotate(-35 25 13)"/>`,
  ),
  // left-right arrow
  '↔': S(
    `<path d="M5 32l13-13v8h28v-8l13 13-13 13v-8H18v8z" fill="#B2D9FF"/><path d="M22 30.5h18" stroke="#fff" stroke-width="2.5" opacity=".8"/>`,
  ),
  // flag: United Kingdom (simplified union jack)
  '🇬🇧': S(
    `<clipPath id="e-gb-c"><rect x="4" y="14" width="56" height="36" rx="6"/></clipPath>` +
      `<g clip-path="url(#e-gb-c)" stroke-linecap="butt"><rect x="4" y="14" width="56" height="36" fill="#6F8FD8" stroke="none"/>` +
      `<path d="M4 14l56 36M60 14 4 50" stroke="#fff" stroke-width="9"/><path d="M4 14l56 36M60 14 4 50" stroke="#F4607A" stroke-width="3.5"/>` +
      `<path d="M32 14v36M4 32h56" stroke="#fff" stroke-width="13"/><path d="M32 14v36M4 32h56" stroke="#F4607A" stroke-width="7.5"/></g>` +
      `<rect x="4" y="14" width="56" height="36" rx="6"/>`,
  ),
  // flag: China
  '🇨🇳': S(
    `<rect x="4" y="14" width="56" height="36" rx="6" fill="#F4606A"/><g fill="#FFD95A" stroke="none">` +
      `<path d="M14 17.5l1.5 4.4 4.7.1-3.7 2.8 1.3 4.5-3.8-2.7-3.8 2.7 1.3-4.5-3.7-2.8 4.7-.1z"/>` +
      `<path d="M21.4 18.5l1.1-1.5-1.1-1.5 1.8.5 1.1-1.5v1.9l1.8.6-1.8.6v1.9l-1.1-1.5z"/><path d="M24.9 22l1.7-.9-.3-1.9 1.3 1.3 1.7-.9-.8 1.7 1.3 1.3-1.8-.2-.8 1.7-.4-1.8z"/>` +
      `<path d="M25 26.8l1.8-.1.5-1.8.8 1.7 1.8-.1-1.4 1.3.7 1.7-1.6-1-1.5 1.2.4-1.8z"/><path d="M21.5 29.9l1.7.6 1.2-1.4v1.8l1.7.7-1.8.5-.1 1.9-1.1-1.5-1.8.4 1.2-1.4z"/></g>` +
      `<rect x="4" y="14" width="56" height="36" rx="6"/>`,
  ),
  // flag: Japan
  '🇯🇵': S(`<rect x="4" y="14" width="56" height="36" rx="6" fill="#fff"/><circle cx="32" cy="32" r="10.5" fill="#F4506E" stroke="none"/>`),
  // flag: South Korea (taegeuk + four simplified trigrams)
  '🇰🇷': S(
    `<rect x="4" y="14" width="56" height="36" rx="6" fill="#fff"/>` +
      `<g transform="translate(32 32) rotate(33.7)" stroke="none"><circle r="9" fill="#5A7FD6"/><path d="M-9 0A9 9 0 0 1 9 0A4.5 4.5 0 0 0 0 0A4.5 4.5 0 0 1-9 0z" fill="#F4506E"/></g>` +
      `<g stroke-width="2.3" stroke-linecap="butt">` +
      `<path d="M-4.5-3.3h9M-4.5 0h9M-4.5 3.3h9" transform="translate(17.5 22.3) rotate(-57.3)"/>` +
      `<path d="M-4.5-3.3h3.6m1.8 0h3.6M-4.5 0h3.6m1.8 0h3.6M-4.5 3.3h3.6m1.8 0h3.6" transform="translate(46.5 41.7) rotate(-57.3)"/>` +
      `<path d="M-4.5-3.3h3.6m1.8 0h3.6M-4.5 0h9M-4.5 3.3h3.6m1.8 0h3.6" transform="translate(46.5 22.3) rotate(57.3)"/>` +
      `<path d="M-4.5-3.3h9M-4.5 0h3.6m1.8 0h3.6M-4.5 3.3h9" transform="translate(17.5 41.7) rotate(57.3)"/></g>` +
      `<rect x="4" y="14" width="56" height="36" rx="6"/>`,
  ),
};
