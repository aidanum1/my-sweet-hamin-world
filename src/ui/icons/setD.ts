// Hand-drawn pastel icon set D (see src/ui/icons/index.ts for the style guide). Keys: emoji without FE0F.
// Tiny helpers keep the drawings consistent; every value is still a complete standalone SVG string.

/** Wrap artwork: plum outline, stroke 3, round joins/caps. */
const svg = (b: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g stroke="#5B4A5E" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${b}</g></svg>`;
/** Several filled shapes outlined as ONE sticker (outline pass under a fill pass, so overlaps show no inner lines). */
const one = (s: string) => `<g stroke-width="6">${s}</g><g stroke="none">${s}</g>`;
/** A thick coloured band with a plum outline along an open path. */
const band = (d: string, c: string, w = 5) =>
  `<path d="${d}" fill="none" stroke-width="${w + 6}"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
/** White gloss. */
const H = 'fill="#fff" opacity=".7" stroke="none"';
/** Soft rounded triangle (outline pass + fill pass with round joins). */
const tri = (d: string, c: string) => `<path d="${d}" fill="${c}" stroke-width="12"/><path d="${d}" fill="${c}" stroke="${c}" stroke-width="6"/>`;
const heart = (fill: string) =>
  `<path d="M32 43C20 35 22 25 28.5 26C30.5 26.3 31.6 27.8 32 29.5C32.4 27.8 33.5 26.3 35.5 26C42 25 44 35 32 43Z" fill="${fill}" stroke-width="2.5"/>`;
const sparkle = (x: number, y: number, r: number) => {
  const k = r * 0.18;
  return `<path d="M${x} ${y - r}Q${x + k} ${y - k} ${x + r} ${y}Q${x + k} ${y + k} ${x} ${y + r}Q${x - k} ${y + k} ${x - r} ${y}Q${x - k} ${y - k} ${x} ${y - r}Z" fill="#FFE9A8" stroke-width="2.5"/>`;
};
/** Pencil pointing +y, centred near the origin (place it with a transform). */
const pencil = (t: number, b: number) =>
  `<rect x="-7" y="${t}" width="14" height="10" rx="4" fill="#FF9DB3"/><rect x="-7" y="${t + 7}" width="14" height="5" fill="#E6B2FF" stroke-width="2.5"/>` +
  `<path d="M-7 ${t + 12}H7V${b - 15}L0 ${b}L-7 ${b - 15}Z" fill="#FFE9A8"/><path d="M-7 ${b - 15}L0 ${b}L7 ${b - 15}Z" fill="#FFD6B8"/>` +
  `<path d="M-3 ${b - 6.5}L0 ${b}L3 ${b - 6.5}Z" fill="#5B4A5E" stroke-width="2"/><path d="M0 ${t + 14}V${b - 17}" stroke="#F5C26B" stroke-width="2.5"/>`;
const question = (c: string) =>
  band('M21.5 21A10.5 10.5 0 1 1 37.3 30.1C34 32 32 34.5 32 38', c, 6) + `<circle cx="32" cy="53" r="4.3" fill="${c}"/>`;

export const SET_D: Record<string, string> = {
  // headphones
  '🎧': svg(
    band('M13 38v-6a19 19 0 0 1 38 0v6', '#E6B2FF') +
      '<rect x="17" y="36" width="8" height="17" rx="4" fill="#C9A4F0"/><rect x="39" y="36" width="8" height="17" rx="4" fill="#C9A4F0"/>' +
      '<rect x="6" y="31" width="14" height="26" rx="7" fill="#FFC4D6"/><rect x="44" y="31" width="14" height="26" rx="7" fill="#FFC4D6"/>' +
      `<ellipse cx="10.5" cy="38.5" rx="2" ry="3.5" ${H}/><ellipse cx="48.5" cy="38.5" rx="2" ry="3.5" ${H}/>`,
  ),
  // microphone (idol pink/lavender)
  '🎤': svg(
    '<g transform="rotate(28 32 34)">' +
      '<path d="M24 37L28 57Q32 60 36 57L40 37Z" fill="#E6B2FF"/><rect x="22.5" y="31" width="19" height="7" rx="3.5" fill="#C9A4F0"/>' +
      '<circle cx="32" cy="19" r="13" fill="#FFC4D6" stroke="none"/>' +
      '<path d="M25 9.5V29M32 7V31M39 9.5V29M20 15H44M20 23H44" stroke="#FF9DB3" stroke-width="2.5"/>' +
      `<circle cx="32" cy="19" r="13" fill="none"/><ellipse cx="26" cy="13.5" rx="2.6" ry="3.8" ${H}/></g>` +
      sparkle(12, 16, 7),
  ),
  // camera with flash
  '📸': svg(
    '<rect x="11" y="15" width="15" height="10" rx="3" fill="#FF9DB3"/>' +
      '<rect x="5" y="21" width="48" height="34" rx="9" fill="#FFC4D6"/>' +
      '<circle cx="28" cy="38" r="11.5" fill="#fff"/><circle cx="28" cy="38" r="6.5" fill="#8FC9F0" stroke-width="2.5"/>' +
      `<circle cx="25.6" cy="35.6" r="2" ${H}/><rect x="41" y="27" width="7" height="5" rx="2.5" fill="#FFE9A8" stroke-width="2.5"/>` +
      sparkle(51, 12.5, 8.5),
  ),
  // love letter
  '💌': svg(
    '<rect x="6" y="14" width="52" height="37" rx="5" fill="#FFF6EC"/>' +
      '<path d="M8 49L25 35M56 49L39 35" fill="none" stroke-width="2.5"/>' +
      '<path d="M8.5 15.5L32 34L55.5 15.5Z" fill="#FFC4D6"/>' +
      heart('#FF7A93') +
      `<ellipse cx="27.6" cy="29.8" rx="1.6" ry="1.2" ${H}/>`,
  ),
  // memo
  '📝': svg(
    '<rect x="8" y="7" width="36" height="50" rx="5" fill="#fff"/>' +
      '<path d="M8 17V12a5 5 0 0 1 5-5h26a5 5 0 0 1 5 5v5Z" fill="#B2D9FF"/>' +
      '<path d="M15 26H37M15 34H37M15 42H28" stroke="#8FC9F0" stroke-width="3"/>' +
      `<g transform="translate(44 36) rotate(40)">${pencil(-20, 16)}</g>`,
  ),
  // pencil
  '✏': svg(`<g transform="translate(31 33) rotate(45)">${pencil(-29, 27)}</g>`),
  // ticket
  '🎫': svg(
    '<g transform="rotate(-12 32 32)">' +
      '<path d="M8 18H56V27A5 5 0 0 0 56 37V46H8V37A5 5 0 0 0 8 27Z" fill="#FFE9A8"/>' +
      '<path d="M43 21.5V42.5" stroke-width="2.5" stroke-dasharray=".1 5"/>' +
      '<path d="M50 23.5V40.5" stroke="#F5C26B" stroke-width="2.5"/>' +
      '<path d="M25.5 40C17 34 18.5 26.5 23.2 27.2C24.7 27.4 25.2 28.5 25.5 29.8C25.8 28.5 26.4 27.4 27.8 27.2C32.5 26.5 34 34 25.5 40Z" fill="#FF7A93" stroke-width="2.5"/>' +
      '</g>',
  ),
  // music note
  '🎵': svg(
    one(
      '<ellipse cx="23.5" cy="47" rx="10" ry="8" transform="rotate(-20 23.5 47)" fill="#FF9DB3"/><rect x="28.5" y="9" width="6.5" height="38" rx="2" fill="#FF9DB3"/>' +
        '<path d="M32 9C37 16 50 16 48 32C45 25 40 23 32 23Z" fill="#FF9DB3"/>',
    ) + `<ellipse cx="20" cy="44" rx="3.2" ry="2.2" transform="rotate(-20 20 44)" ${H}/>`,
  ),
  // music notes
  '🎶': svg(
    one(
      '<ellipse cx="18.5" cy="47" rx="9" ry="7" transform="rotate(-20 18.5 47)" fill="#C9A4F0"/><ellipse cx="44.5" cy="41" rx="9" ry="7" transform="rotate(-20 44.5 41)" fill="#C9A4F0"/>' +
        '<path d="M22 46V17L54 9V40H48V18.5L28 23.5V46Z" fill="#C9A4F0"/>',
    ) +
      `<ellipse cx="15.5" cy="44.5" rx="3" ry="2" transform="rotate(-20 15.5 44.5)" ${H}/><ellipse cx="41.5" cy="38.5" rx="3" ry="2" transform="rotate(-20 41.5 38.5)" ${H}/>`,
  ),
  // magnet (heart magnet in the game: pink)
  '🧲': svg(
    '<path d="M10 9V33A22 22 0 0 0 54 33V9H41V33A9 9 0 0 1 23 33V9Z" fill="#FF7A93"/>' +
      '<rect x="10" y="9" width="13" height="10" fill="#fff"/><rect x="41" y="9" width="13" height="10" fill="#fff"/>' +
      '<path d="M15 36A17 17 0 0 0 21 47" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>',
  ),
  // package
  '📦': svg(
    '<path d="M7 21L37 29L57 19L27 11Z" fill="#FFD6B8"/>' +
      '<path d="M7 21L37 29V54L7 46Z" fill="#E8C39E"/>' +
      '<path d="M37 29L57 19V44L37 54Z" fill="#D9B08C"/>' +
      '<path d="M14 17.6L20 14.4L50 22.4V33L44 36V25.6Z" fill="#FFF6EC" stroke-width="2.5"/>' +
      '<path d="M44 25.6L50 22.4" stroke-width="2"/>',
  ),
  // label tag
  '🏷': svg(
    '<g transform="translate(30 30) rotate(45)">' +
      '<path d="M-25 0L-13 -13H20A4 4 0 0 1 24 -9V9A4 4 0 0 1 20 13H-13Z" fill="#FFE9A8"/>' +
      '<circle cx="-12" cy="0" r="3.8" fill="#fff" stroke-width="2.5"/>' +
      '<path d="M-12 0C-17 -6 -29 -7 -29 -1C-29 5 -18 5 -12 0" fill="none" stroke="#FF7A93" stroke-width="2.5"/>' +
      '<path d="M2 -5H16M2 3H12" stroke="#F5C26B" stroke-width="2.5"/></g>',
  ),
  // game die
  '🎲': svg(
    '<path d="M32 6L56 18L32 30L8 18Z" fill="#fff"/><path d="M8 18L32 30V58L8 46Z" fill="#FFC4D6"/><path d="M32 30L56 18V46L32 58Z" fill="#FF9DB3"/>' +
      '<ellipse cx="32" cy="18" rx="4.6" ry="2.7" fill="#FF7A93" stroke="none"/>' +
      '<g fill="#5B4A5E" stroke="none"><circle cx="14" cy="28.5" r="2.8"/><circle cx="26" cy="47.5" r="2.8"/>' +
      '<circle cx="38" cy="34" r="2.8"/><circle cx="44" cy="38" r="2.8"/><circle cx="50" cy="42" r="2.8"/></g>',
  ),
  // repeat
  '🔁': svg(
    '<path d="M12 39V30Q12 20 22 20H41M52 25V34Q52 44 42 44H23" fill="none" stroke-width="11"/>' +
      '<path d="M40 10L54 20L40 30ZM24 34L10 44L24 54Z" stroke-width="6"/>' +
      '<path d="M12 39V30Q12 20 22 20H41M52 25V34Q52 44 42 44H23" fill="none" stroke="#B2D9FF" stroke-width="5"/>' +
      '<path d="M40 10L54 20L40 30ZM24 34L10 44L24 54Z" fill="#B2D9FF" stroke="none"/>',
  ),
  // return / back
  '↩': svg(
    '<path d="M23 25H38A12 12 0 0 1 38 49H28" fill="none" stroke-width="11"/><path d="M26 13L11 25L26 37Z" stroke-width="6"/>' +
      '<path d="M23 25H38A12 12 0 0 1 38 49H28" fill="none" stroke="#B2D9FF" stroke-width="5"/><path d="M26 13L11 25L26 37Z" fill="#B2D9FF" stroke="none"/>',
  ),
  // gift (tiny face)
  '🎁': svg(
    '<rect x="10" y="29" width="44" height="27" rx="5" fill="#FFC4D6"/><rect x="7" y="21" width="50" height="11" rx="4" fill="#FF9DB3"/>' +
      '<rect x="28" y="21" width="8" height="35" fill="#FF7A93" stroke-width="2.5"/>' +
      '<path d="M32 21C24 8 12 12 18 20C21 23 27 22 32 21ZM32 21C40 8 52 12 46 20C43 23 37 22 32 21Z" fill="#FF7A93"/><circle cx="32" cy="20.5" r="4" fill="#FF7A93"/>' +
      '<g stroke="none"><circle cx="19.5" cy="41" r="2.3" fill="#5B4A5E"/><circle cx="44.5" cy="41" r="2.3" fill="#5B4A5E"/>' +
      '<ellipse cx="17" cy="46.5" rx="3" ry="2" fill="#FF7A93" opacity=".55"/><ellipse cx="47" cy="46.5" rx="3" ry="2" fill="#FF7A93" opacity=".55"/></g>' +
      `<ellipse cx="13" cy="26" rx="2.5" ry="1.4" ${H}/>`,
  ),
  // check mark button
  '✅': svg(
    '<rect x="6" y="6" width="52" height="52" rx="14" fill="#9BD9BD"/>' +
      '<path d="M12.5 25V20A7.5 7.5 0 0 1 20 12.5H24" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>' +
      band('M19 33L28 42L45 22', '#fff', 6),
  ),
  // basket
  '🧺': svg(
    band('M16 30C16 8 48 8 48 30', '#E8C39E', 4) +
      '<path d="M9 30H55L50.5 54Q50 57 46.5 57H17.5Q14 57 13.5 54Z" fill="#E8C39E"/>' +
      '<path d="M15 40.5H49M17 49H47" stroke-width="2.5" stroke-dasharray="4 4.5"/>' +
      '<rect x="6" y="25" width="52" height="9" rx="4.5" fill="#F5C26B"/>',
  ),
  // books
  '📚': svg(
    '<rect x="7" y="40" width="50" height="14" rx="3.5" fill="#B2D9FF"/><path d="M14 40V54M50 40V54" stroke-width="2.5"/>' +
      '<rect x="11" y="27" width="44" height="13" rx="3.5" fill="#FFC4D6"/><path d="M18 27V40M48 27V40" stroke-width="2.5"/>' +
      '<g transform="rotate(-7 30 20)"><rect x="9" y="14" width="42" height="13" rx="3.5" fill="#BFF0DA"/><path d="M16 14V27M44 14V27" stroke-width="2.5"/>' +
      `<rect x="24" y="18.5" width="12" height="4" rx="2" ${H}/></g>`,
  ),
  // alarm clock
  '⏰': svg(
    '<path d="M18 50L13 57M46 50L51 57" stroke-width="4"/>' +
      '<path d="M6.5 22.5A11 11 0 0 1 22.5 6.5ZM41.5 6.5A11 11 0 0 1 57.5 22.5Z" fill="#FFE9A8"/>' +
      '<path d="M32 15V10" stroke-width="3"/><circle cx="32" cy="8.5" r="3" fill="#FFE9A8" stroke-width="2.5"/>' +
      '<circle cx="32" cy="35" r="21" fill="#FF9DB3"/><circle cx="32" cy="35" r="15" fill="#fff" stroke-width="2.5"/>' +
      '<path d="M32 35V25M32 35L39.5 39" stroke-width="3"/><circle cx="32" cy="35" r="2.2" fill="#5B4A5E" stroke="none"/>' +
      '<path d="M15.5 30A17.5 17.5 0 0 1 22 20.5" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>',
  ),
  // sports medal
  '🏅': svg(
    '<path d="M51 5H39L26 31H38Z" fill="#B2D9FF"/><path d="M13 5H25L38 31H26Z" fill="#FF9DB3"/>' +
      '<circle cx="32" cy="42.5" r="15" fill="#FFE9A8"/><circle cx="32" cy="42.5" r="10" fill="none" stroke="#F5C26B" stroke-width="2.5"/>' +
      '<path d="M32 36L33.7 40.2L38.2 40.5L34.8 43.4L35.8 47.8L32 45.4L28.2 47.8L29.2 43.4L25.8 40.5L30.3 40.2Z" fill="#F5C26B" stroke="none"/>' +
      `<ellipse cx="24.5" cy="36" rx="2.2" ry="3.4" transform="rotate(35 24.5 36)" ${H}/>`,
  ),
  // thought bubble
  '💭': svg(
    one(
      '<g fill="#fff"><circle cx="22" cy="26" r="10"/><circle cx="33" cy="19" r="11"/><circle cx="44" cy="25" r="10"/><circle cx="42" cy="35" r="8.5"/><circle cx="26" cy="36" r="9"/><rect x="20" y="22" width="26" height="16"/></g>',
    ) +
      '<circle cx="14" cy="50" r="4" fill="#fff"/><circle cx="7.5" cy="56.5" r="2.3" fill="#fff" stroke-width="2.5"/>' +
      `<ellipse cx="27" cy="16.5" rx="3" ry="2" transform="rotate(-25 27 16.5)" fill="#E6B2FF" opacity=".5" stroke="none"/>`,
  ),
  // speech bubble
  '💬': svg(
    '<path d="M22 8H42A16 16 0 0 1 58 24V28A16 16 0 0 1 42 44H33L14 56L21 43.9A16 16 0 0 1 6 28V24A16 16 0 0 1 22 8Z" fill="#fff"/>',
  ),
  // play / right triangle
  '▶': svg(tri('M23 15L50 32L23 49Z', '#fff')),
  // left triangle
  '◀': svg(tri('M41 15L14 32L41 49Z', '#fff')),
  // keyboard
  '⌨': svg(
    '<rect x="4.5" y="16" width="55" height="33" rx="7" fill="#E6B2FF"/>' +
      '<g fill="#fff" stroke-width="2"><rect x="10.5" y="22" width="6.5" height="6" rx="1.8"/><rect x="19.8" y="22" width="6.5" height="6" rx="1.8"/><rect x="29" y="22" width="6.5" height="6" rx="1.8"/><rect x="38.3" y="22" width="6.5" height="6" rx="1.8"/><rect x="47.5" y="22" width="6.5" height="6" rx="1.8"/>' +
      '<rect x="15" y="31" width="6.5" height="6" rx="1.8"/><rect x="24.3" y="31" width="6.5" height="6" rx="1.8"/><rect x="33.5" y="31" width="6.5" height="6" rx="1.8"/><rect x="42.8" y="31" width="6.5" height="6" rx="1.8"/>' +
      '<rect x="19" y="40" width="26" height="4.5" rx="2"/></g>',
  ),
  // mobile phone
  '📱': svg(
    '<rect x="16" y="5" width="32" height="54" rx="8" fill="#FFC4D6"/>' +
      '<rect x="21" y="12" width="22" height="37" rx="3" fill="#B2D9FF" stroke-width="2.5"/>' +
      '<path d="M29 8.5H35" stroke-width="2"/><circle cx="32" cy="54" r="2.2" fill="#fff" stroke-width="2"/>' +
      `<path d="M24.5 30L33 15H37.5L27 33Z" ${H}/>`,
  ),
  // lock
  '🔒': svg(
    band('M21 31V22A11 11 0 0 1 43 22V31', '#B2D9FF') +
      '<rect x="11" y="28" width="42" height="29" rx="8" fill="#FFE9A8"/>' +
      '<path d="M32 35.5A4.2 4.2 0 0 0 29.7 43.2L29 49H35L34.3 43.2A4.2 4.2 0 0 0 32 35.5Z" fill="#5B4A5E" stroke-width="1.5"/>' +
      `<ellipse cx="17" cy="35" rx="2.2" ry="3.2" ${H}/>`,
  ),
  // puzzle piece
  '🧩': svg(
    '<path d="M8 16H22C17 5 41 5 36 16H48V28C59 23 59 47 48 42V56H36C41 45 17 45 22 56H8V42C19 47 19 23 8 28Z" fill="#BFF0DA"/>' +
      `<ellipse cx="14.5" cy="22" rx="2.2" ry="3.2" ${H}/><ellipse cx="29" cy="10.5" rx="2.5" ry="1.6" ${H}/>`,
  ),
  // megaphone
  '📣': svg(
    '<g transform="rotate(-15 32 32)">' +
      '<rect x="19" y="35" width="7.5" height="15" rx="3.5" fill="#C9A4F0"/>' +
      '<rect x="6" y="25" width="10" height="14" rx="3.5" fill="#E6B2FF"/>' +
      '<path d="M14 26L42 12V52L14 38Z" fill="#FF9DB3"/><ellipse cx="42" cy="32" rx="6" ry="20" fill="#FFC4D6"/>' +
      '<path d="M19 28.5L35 20.5" stroke="#fff" stroke-width="3" opacity=".7"/>' +
      '<path d="M54 18L58.5 13.5M55 32H60.5M54 46L58.5 50.5" stroke-width="3"/></g>',
  ),
  // bell (tiny face)
  '🔔': svg(
    '<circle cx="32" cy="53" r="5" fill="#F5C26B"/><circle cx="32" cy="10" r="4" fill="#F5C26B"/>' +
      '<path d="M32 12C21 12 16 20 16 30C16 38 14 42 11 46H53C50 42 48 38 48 30C48 20 43 12 32 12Z" fill="#FFE9A8"/>' +
      '<rect x="9" y="44" width="46" height="7" rx="3.5" fill="#F5C26B"/>' +
      '<g stroke="none"><circle cx="26" cy="31" r="2.3" fill="#5B4A5E"/><circle cx="38" cy="31" r="2.3" fill="#5B4A5E"/>' +
      '<ellipse cx="22" cy="36.5" rx="3" ry="2" fill="#FF9DB3" opacity=".7"/><ellipse cx="42" cy="36.5" rx="3" ry="2" fill="#FF9DB3" opacity=".7"/></g>' +
      '<path d="M29.5 35.5Q32 38.5 34.5 35.5" fill="none" stroke-width="2"/>' +
      `<ellipse cx="22.5" cy="21.5" rx="2.3" ry="4.2" transform="rotate(25 22.5 21.5)" ${H}/>`,
  ),
  // red question mark
  '❓': svg(question('#FF7A93')),
  // white question mark
  '❔': svg(question('#fff')),
  // gear
  '⚙': svg(
    '<path d="M27 13.2L27.6 6.9L36.4 6.9L37 13.2A19.5 19.5 0 0 1 41.8 15.1L46.6 11.1L52.9 17.4L48.9 22.3A19.5 19.5 0 0 1 50.8 27L57.1 27.6L57.1 36.4L50.8 37A19.5 19.5 0 0 1 48.9 41.8L52.9 46.6L46.6 52.9L41.8 48.9A19.5 19.5 0 0 1 37 50.8L36.4 57.1L27.6 57.1L27 50.8A19.5 19.5 0 0 1 22.3 48.9L17.4 52.9L11.1 46.6L15.1 41.8A19.5 19.5 0 0 1 13.2 37L6.9 36.4L6.9 27.6L13.2 27A19.5 19.5 0 0 1 15.1 22.3L11.1 17.4L17.4 11.1L22.2 15.1A19.5 19.5 0 0 1 27 13.2Z" fill="#E6B2FF"/>' +
      '<circle cx="32" cy="32" r="7.5" fill="#fff"/>' +
      '<path d="M17.5 30A14.5 14.5 0 0 1 24 20" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>',
  ),
};
