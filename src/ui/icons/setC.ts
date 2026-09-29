// Hand-drawn pastel icon set C (see src/ui/icons/index.ts for the style guide). Keys: emoji without FE0F.
// Animals, plants, hands, people and hearts. Every value is a complete standalone SVG string (helpers only save typing).

/** Root <svg>: plum ink outline 3px, round joins/caps, no default fill. */
const S = (b: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#5B4A5E" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${b}</svg>`;
const N = ' stroke="none"';
/** Dot eye(s). */
const eye = (x: number, y: number, r = 2.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#5B4A5E"${N}/>`;
const eyes = (x1: number, y1: number, x2: number, y2: number, r = 2.6) => eye(x1, y1, r) + eye(x2, y2, r);
/** Pink blush pair. */
const blush = (x1: number, x2: number, y: number, rx = 3.6, ry = 2.2) =>
  `<g fill="#FF9DB3" opacity=".6"${N}><ellipse cx="${x1}" cy="${y}" rx="${rx}" ry="${ry}"/><ellipse cx="${x2}" cy="${y}" rx="${rx}" ry="${ry}"/></g>`;
/** White shine. */
const hl = (x: number, y: number, rx: number, ry: number, rot = -30) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="#fff" opacity=".7"${N}/>`;
/** Chunky outlined line: ink underlay + coloured core. */
const limb = (d: string, c: string, w = 8) => `<path d="${d}" stroke-width="${w}"/><path d="${d}" stroke="${c}" stroke-width="${w - 4.5}"/>`;

const HEART = 'M32 55C20 47 7 38 7 23C7 14 14 8 21 8C26 8 30 11 32 15C34 11 38 8 43 8C50 8 57 14 57 23C57 38 44 47 32 55Z';
/** Heart scaled by k around (cx,cy) of the 64-box heart (whose middle is 32,31). */
const heart = (fill: string, k = 1, cx = 32, cy = 31, extra = '') =>
  k === 1 && cx === 32 && cy === 31
    ? `<path d="${HEART}" fill="${fill}"${extra}/>`
    : `<path d="${HEART}" fill="${fill}" transform="matrix(${k} 0 0 ${k} ${+(cx - 32 * k).toFixed(2)} ${+(cy - 31 * k).toFixed(2)})" stroke-width="${+(3 / k).toFixed(2)}"${extra}/>`;

// ---------------------------------------------------------------- hands (peach mittens)
const P = '#FFD6B8';
/** Pointing-up fist: index finger flush with the left edge, curled fingers, thumb across the front. */
const POINT = `<g transform="translate(2 0)"><path d="M22 31V12a5 5 0 0 1 10 0V27C36 24.5 46 26 48 34V46C48 53 42 58 35 58H28C21 58 16 53 16 46V41C12 39 9 34 11 31C13 28 18 29 22 31Z" fill="${P}"/><path d="M32 27v5M33 38h10M33 45h10" stroke-width="2.5"/>${hl(25.5, 14, 1.4, 3, 0)}</g>`;
/** m: transform for the other directions (mirrors keep the finger on the outer edge). */
const point = (m = '') => S(m ? `<g transform="${m}">${POINT}</g>` : POINT);

// ---------------------------------------------------------------- sheep
const SHEEP =
  // legs
  `<g fill="${P}"><rect x="23" y="40" width="7" height="15" rx="3.5"/><rect x="32" y="40" width="7" height="15" rx="3.5"/><rect x="43" y="39" width="7" height="15" rx="3.5"/><rect x="51" y="37" width="7" height="15" rx="3.5"/></g>` +
  // wool body
  `<path d="M49 16A6.9 6.9 0 0 1 56.9 23.9A6.4 6.4 0 0 1 56.9 34.1A6.9 6.9 0 0 1 49 42A7.6 7.6 0 0 1 36.9 43.8A7.3 7.3 0 0 1 26.2 38.6A6.5 6.5 0 0 1 22 29A6.5 6.5 0 0 1 26.2 19.4A7.3 7.3 0 0 1 36.9 14.2A7.6 7.6 0 0 1 49 16Z" fill="#fff"/>` +
  // ears + face
  `<g fill="${P}"><ellipse cx="8.5" cy="30" rx="5.5" ry="3.2" transform="rotate(28 8.5 30)"/><ellipse cx="31.5" cy="29" rx="5.5" ry="3.2" transform="rotate(-28 31.5 29)"/><ellipse cx="20" cy="34.5" rx="12.5" ry="11.5"/></g>` +
  // wool tuft
  `<path d="M10.5 28.5A5.1 5.1 0 0 1 14 20.5A5 5 0 0 1 21.5 17.5A4.6 4.6 0 0 1 28.5 20A4.8 4.8 0 0 1 30 28" fill="#fff"/>` +
  eyes(15.5, 35.5, 24.5, 35.5, 2.5) + blush(12, 28, 40.5, 3, 2) + `<path d="M18.5 40q1.5 1.5 3 0" stroke-width="2"/>`;

export const SET_C: Record<string, string> = {
  '🐑': S(SHEEP),

  '🐬': S(
    `<g transform="matrix(.94 0 0 .94 -.5 2)" stroke-width="3.2"><path d="M50 36C54 30 58 26 62 25C60 30 59 34 58 37C60 40 62 44 62 48C58 46 54 43 50 38Z" fill="#8FC9F0"/>` +
      `<path d="M31 18C33 11 38 8 44 8C41 12 41 16 43 19Z" fill="#8FC9F0"/>` +
      `<path d="M7 36C7 33 10 31 14 30.5C16 21 27 15 39 17C49 19 55 27 55 36C49 43 36 47 24 44C19 43 15 41 12 39.5C9 39 7 38 7 36Z" fill="#B2D9FF"/>` +
      `<path d="M13 40C20 41 33 42 45 39C39 44 29 45 22 43.5C18 42.5 15 41.5 13 40Z" fill="#fff" opacity=".85"${N}/>` +
      `<path d="M27 41C25 47 29 52 35 52C33 48 34 45 37 42" fill="#8FC9F0"/>` +
      hl(33, 22, 5, 2.2, -12) + eye(21, 28.5) +
      `<ellipse cx="24" cy="34" rx="3" ry="2" fill="#FF9DB3" opacity=".6"${N}/><path d="M9 36.5q3 1.5 6 0" stroke-width="2"/></g>`,
  ),

  '🦴': S(
    `<g transform="rotate(-40 32 32)"><path d="M20.2 28H43.8A7.5 7.5 0 1 1 55.5 32A7.5 7.5 0 1 1 43.8 36H20.2A7.5 7.5 0 1 1 8.5 32A7.5 7.5 0 1 1 20.2 28Z" fill="#FFF6EC"/>` +
      `<path d="M22 31H40" stroke="#fff" stroke-width="2.5" opacity=".9"/>${hl(49, 22.5, 2.6, 1.6, 0)}</g>`,
  ),

  '🐶': S(
    `<ellipse cx="32" cy="35" rx="20" ry="17" fill="#FFF6EC"/>` +
      `<path d="M26 20A3.6 3.6 0 0 1 32 17.5A3.6 3.6 0 0 1 38 20" fill="#FFF6EC"/>` +
      `<g fill="#E8C39E"><path d="M18 20C10 18 5 26 6 35C7 43 13 45 16 39C18 34 20 27 18 20Z"/><path d="M46 20C54 18 59 26 58 35C57 43 51 45 48 39C46 34 44 27 46 20Z"/></g>` +
      `<ellipse cx="32" cy="42" rx="9" ry="6.5" fill="#fff"${N}/>` +
      eyes(24, 34, 40, 34, 2.8) + blush(20.5, 43.5, 40.5, 3, 2) +
      `<ellipse cx="32" cy="38.5" rx="3.6" ry="2.6" fill="#5B4A5E"${N}/><path d="M28 42.5q2 2.5 4 0q2 2.5 4 0" stroke-width="2.2"/>`,
  ),

  '🐱': S(
    `<path d="M12 31L13 12L25 20Q32 18 39 20L51 12L52 31C55 45 45 54 32 54C19 54 9 45 12 31Z" fill="#FFE9A8"/>` +
      `<g fill="#FF9DB3"${N}><path d="M16.5 17.5L17 25L22.5 21.5Z"/><path d="M47.5 17.5L47 25L41.5 21.5Z"/></g>` +
      `<path d="M32 22v5M27 23l1 4M37 23l-1 4" stroke="#F5C26B" stroke-width="2.5"/>` +
      eyes(24, 36, 40, 36, 2.8) + blush(19.5, 44.5, 42.5, 3, 2) +
      `<path d="M29.5 40h5l-2.5 2.6z" fill="#FF7A93" stroke-width="1.5"/><path d="M28 44q2 2 4 0q2 2 4 0M5 38l9 1.5M5 44.5l9-1M59 38l-9 1.5M59 44.5l-9-1" stroke-width="2"/>`,
  ),

  '🐚': S(
    `<path d="M54 10C52 20 48 26 45 32A18 18 0 1 1 34 21C42 18 50 14 54 10Z" fill="#FFC4D6"/>` +
      `<path d="M28 38a3 3 0 0 1 6 0a6 6 0 0 1-12 0a9 9 0 0 1 18 0a12 12 0 0 1-24 0M41 23q4 2 6 6M46 17q3 1.5 4 4.5" stroke-width="2.3"/>` +
      hl(18, 28, 3, 1.8, -45),
  ),

  '🐹': S(
    `<g fill="${P}"><circle cx="16" cy="20" r="7"/><circle cx="48" cy="20" r="7"/></g><g fill="#FF9DB3"${N}><circle cx="16" cy="20" r="3.4"/><circle cx="48" cy="20" r="3.4"/></g>` +
      `<ellipse cx="32" cy="37" rx="23" ry="18" fill="${P}"/>` +
      `<path d="M14 44C14 35 21 31 27 32.5C30 33.5 34 33.5 37 32.5C43 31 50 35 50 44C50 51 42 54 32 54C22 54 14 51 14 44Z" fill="#fff"${N}/>` +
      eyes(23, 36, 41, 36, 2.8) + blush(18.5, 45.5, 43) +
      `<ellipse cx="32" cy="40.5" rx="2.4" ry="1.7" fill="#FF7A93"${N}/><path d="M29 44q1.5 1.8 3 0q1.5 1.8 3 0" stroke-width="2"/>` + hl(24, 25, 4, 2, -20),
  ),

  '🐰': S(
    `<g fill="#fff"><ellipse cx="23" cy="19" rx="6.5" ry="14" transform="rotate(-12 23 19)"/><ellipse cx="41" cy="19" rx="6.5" ry="14" transform="rotate(12 41 19)"/></g>` +
      `<g fill="#FFC4D6"${N}><ellipse cx="23" cy="20" rx="3" ry="9" transform="rotate(-12 23 20)"/><ellipse cx="41" cy="20" rx="3" ry="9" transform="rotate(12 41 20)"/></g>` +
      `<ellipse cx="32" cy="42" rx="19" ry="15" fill="#fff"/>` +
      eyes(24.5, 41, 39.5, 41, 2.7) + blush(20.5, 43.5, 47) +
      `<ellipse cx="32" cy="45" rx="2.2" ry="1.6" fill="#FF7A93"${N}/><path d="M29 48.5q1.5 1.8 3 0q1.5 1.8 3 0" stroke-width="2"/>`,
  ),

  '🐤': S(
    `<path d="M28 50v5m-3 0h6M38 50v5m-3 0h6" stroke-width="2.5"/>` +
      `<path d="M31 16c-1-4 1-7 4-7M35 15.5c0-3 2-5 5-5" stroke-width="2.5"/>` +
      `<ellipse cx="33" cy="34" rx="20" ry="18.5" fill="#FFE9A8"/>` +
      `<path d="M16 29L7 33.5L16 38" fill="#F5C26B"/>` +
      `<path d="M31 36c2 8 12 11 18 4c-5 0-9-2-11-6" fill="#FFE9A8" stroke-width="2.5"/>` +
      eye(21.5, 29) +
      `<ellipse cx="24" cy="35.5" rx="3" ry="2" fill="#FF9DB3" opacity=".6"${N}/>` + hl(38, 22, 5, 2.5, -20),
  ),

  '🐥': S(
    `<g fill="#F5C26B"><ellipse cx="25" cy="54" rx="5" ry="3"/><ellipse cx="39" cy="54" rx="5" ry="3"/></g>` +
      `<g fill="#FFE9A8"><ellipse cx="13" cy="38" rx="7" ry="4.5" transform="rotate(-30 13 38)"/><ellipse cx="51" cy="38" rx="7" ry="4.5" transform="rotate(30 51 38)"/></g>` +
      `<path d="M30 17c-1-4 1-7 4-7M33.5 17c1-3 4-4 6-3" stroke-width="2.5"/>` +
      `<ellipse cx="32" cy="35" rx="19" ry="18" fill="#FFE9A8"/>` +
      eyes(25, 32, 39, 32, 2.7) + blush(20.5, 43.5, 38.5) +
      `<path d="M28 36h8l-4 5z" fill="#F5C26B" stroke-width="2.2"/>` + hl(24, 23, 4, 2, -25),
  ),

  '👩‍🍳': S(
    `<g fill="${P}"><ellipse cx="11" cy="42" rx="6.5" ry="3.6" transform="rotate(20 11 42)"/><ellipse cx="53" cy="42" rx="6.5" ry="3.6" transform="rotate(-20 53 42)"/></g>` +
      `<path d="M32 24A8.6 8.6 0 0 1 45.4 27.5A6.3 6.3 0 0 1 51 36A6.3 6.3 0 0 1 45.4 44.5A8.6 8.6 0 0 1 32 48A8.6 8.6 0 0 1 18.6 44.5A6.3 6.3 0 0 1 13 36A6.3 6.3 0 0 1 18.6 27.5A8.6 8.6 0 0 1 32 24Z" fill="#fff"/>` +
      `<ellipse cx="32" cy="42.5" rx="13.5" ry="11.5" fill="${P}"/>` +
      `<path d="M19 23A8.5 8.5 0 0 1 25 9A9 9 0 0 1 39 9A8.5 8.5 0 0 1 45 23Z" fill="#fff"/><rect x="19" y="20" width="26" height="9" rx="3" fill="#fff"/>` +
      `<path d="M27 14.5v4M37 14.5v4" stroke-width="2"/>` +
      eyes(26.5, 42, 37.5, 42, 2.5) + blush(22.5, 41.5, 47, 3, 2) + `<path d="M30.5 46.5q1.5 1.5 3 0" stroke-width="2"/>`,
  ),

  '🌸': S(
    `<g fill="#FFC4D6">${[0, 72, 144, 216, 288].map((a) => `<path d="M32 32C23 28 18 18 24 9L32 13L40 9C46 18 41 28 32 32Z"${a ? ` transform="rotate(${a} 32 32)"` : ''}/>`).join('')}</g>` +
      `<circle cx="32" cy="32" r="6" fill="#FFE9A8" stroke-width="2.5"/>` + hl(27, 17, 2.4, 4, -20),
  ),

  '🌷': S(
    limb('M32 38V58', '#9BD9BD', 7.5) +
      `<g fill="#9BD9BD"><path d="M31 57C22 55 16 47 15 37C23 40 29 47 31 57Z"/><path d="M33 57C40 54 45 48 47 41C40 43 35 48 33 57Z"/></g>` +
      `<path d="M18 14L25 21L32 11L39 21L46 14C49 30 43 40 32 40C21 40 15 30 18 14Z" fill="#FF9DB3"/>` +
      `<path d="M25 22C26 16 29 13 32 11C35 13 38 16 39 22C39 32 36 38 32 40C28 38 25 32 25 22Z" fill="#FFC4D6" stroke-width="2.5"/>` + hl(29, 22, 1.8, 4, 10),
  ),

  '🌳': S(
    `<path d="M26 58C29 52 29 46 28 36H36C35 46 35 52 38 58Z" fill="#E8C39E"/>` +
      `<path d="M32 11A8 8 0 0 1 44.9 14.5A6.7 6.7 0 0 1 51.7 23.4A6.2 6.2 0 0 1 49.3 33.5A7.4 7.4 0 0 1 38.8 40.1A8.2 8.2 0 0 1 25.2 40.1A7.4 7.4 0 0 1 14.7 33.5A6.2 6.2 0 0 1 12.3 23.4A6.7 6.7 0 0 1 19.1 14.5A8 8 0 0 1 32 11Z" fill="#9BD9BD"/>` +
      `<circle cx="38" cy="30" r="2.2" fill="#BFF0DA"${N}/><circle cx="26" cy="33" r="1.8" fill="#BFF0DA"${N}/>` + hl(22, 20, 5, 3, -30),
  ),

  '🌻': S(
    `<g fill="#FFE9A8">${Array.from({ length: 12 }, (_, i) => `<ellipse cx="32" cy="14" rx="5.5" ry="9"${i ? ` transform="rotate(${i * 30} 32 32)"` : ''}/>`).join('')}</g>` +
      `<circle cx="32" cy="32" r="12" fill="#E8C39E"/>` +
      `<g fill="#5B4A5E" opacity=".45"${N}><circle cx="28" cy="29" r="1.5"/><circle cx="35" cy="28" r="1.5"/><circle cx="32" cy="34" r="1.5"/><circle cx="27" cy="36" r="1.5"/><circle cx="37" cy="35" r="1.5"/></g>` +
      hl(27, 25, 3, 1.8, -30),
  ),

  '🌱': S(
    `<path d="M13 57C17 49 47 49 51 57Z" fill="#E8C39E"/>` +
      limb('M32 53C32 46 31 40 32 32', '#9BD9BD', 7.5) +
      `<g fill="#9BD9BD"><path d="M31 37C21 39 11 33 9 20C21 18 30 24 31 37Z"/><path d="M33 31C36 20 46 12 56 13C57 25 47 32 33 31Z"/></g>` +
      `<path d="M28 34C22 31 17 27 14 23M36 28C41 24 46 20 51 17" stroke="#BFF0DA" stroke-width="2.2"/>`,
  ),

  '🌅': S(
    `<rect x="6" y="8" width="52" height="48" rx="10" fill="#FFC4D6"${N}/><path d="M6 28H58V38H6Z" fill="#FFD6B8"${N}/>` +
      `<path d="M32 21v-4M40.5 23.3l2-3.5M46.7 29.5l3.5-2M23.5 23.3l-2-3.5M17.3 29.5l-3.5-2" stroke-width="2.5"/>` +
      `<path d="M19 38A13 13 0 0 1 45 38Z" fill="#FFE9A8"/>` +
      `<path d="M6 38H58V46A10 10 0 0 1 48 56H16A10 10 0 0 1 6 46Z" fill="#8FC9F0"/>` +
      `<path d="M23 43.5h18M27 49h10" stroke="#FFE9A8" stroke-width="2.5"/><path d="M10 45q3-2 6 0M48 51q3-2 6 0" stroke="#fff" stroke-width="2"/>` +
      `<rect x="6" y="8" width="52" height="48" rx="10"/>`,
  ),

  '👆': point(),
  '👇': point('matrix(1 0 0 -1 0 64)'),
  '👈': point('matrix(0 1 1 0 0 0)'),
  '👉': point('matrix(0 1 -1 0 64 0)'),

  '👋': S(
    `<path d="M50 10q5 4 6 12M47 4q4 1 6 4.5M13 12q-4 4-4 10" stroke="#FF9DB3" stroke-width="2.5"/>` +
      `<g transform="rotate(-12 32 40)"><path d="M25 57C21 53 19 48 17 45L9 35C7 32 8 28 11 27C14 26 16 28 18 31V20C18 11 24 7 32 7C40 7 46 11 46 20V42C46 51 42 55 40 57Z" fill="${P}"/>` +
      `<path d="M25.5 10v10M32 8.5v11M38.5 10v10" stroke-width="2.5"/>${hl(22, 24, 1.6, 3.5, 0)}</g>`,
  ),

  '🫶': S(
    `<path d="M32 47C22 40 16 33 18 26C20 20 28 19 32 25C36 19 44 20 46 26C48 33 42 40 32 47Z" fill="#FF7A93"/>` +
      `<path d="M30 20C25 12 13 14 11 24C9 34 18 43 29 50M13 38L6 52M34 20C39 12 51 14 53 24C55 34 46 43 35 50M51 38L58 52" stroke-width="12"/>` +
      `<path d="M30 20C25 12 13 14 11 24C9 34 18 43 29 50M13 38L6 52M34 20C39 12 51 14 53 24C55 34 46 43 35 50M51 38L58 52" stroke="${P}" stroke-width="6.5"/>` +
      hl(25, 30, 2.2, 3.5, 30),
  ),

  '✌': S(
    `<g fill="${P}"><path d="M21 38V15a5 5 0 0 1 10 0v23" transform="rotate(-10 26 38)"/><path d="M33 38V15a5 5 0 0 1 10 0v23" transform="rotate(10 38 38)"/></g>` +
      `<path d="M16 42C16 36 20 33 26 33H38C44 33 48 36 48 42V46C48 52 43 57 36 57H28C21 57 16 52 16 46Z" fill="${P}"/>` +
      `<path d="M17 43c6-2 13-1 18 3M39 40h6" stroke-width="2.5"/>`,
  ),

  '🏃': S(
    `<g transform="translate(0 1.5)"><path d="M4 24h8M7 32h7M4 40h7" stroke-width="2.5" opacity=".45"/>` +
      limb('M32 28L25 34L19 31', '#B2D9FF') + limb('M28 39L22 47L14 47', '#8FC9F0') +
      `<ellipse cx="12" cy="48" rx="4.5" ry="3" fill="#fff" stroke-width="2.5"/>` +
      limb('M35 26L29 39', '#B2D9FF', 13) +
      limb('M30 39L40 44L38 52', '#8FC9F0') + `<ellipse cx="40" cy="54" rx="4.5" ry="3" fill="#fff" stroke-width="2.5"/>` +
      limb('M35 28L43 33L47 27', '#B2D9FF') + `<circle cx="47.5" cy="25.5" r="3.2" fill="${P}" stroke-width="2.5"/><circle cx="18.5" cy="30" r="3.2" fill="${P}" stroke-width="2.5"/>` +
      `<circle cx="38" cy="14" r="9.5" fill="${P}"/>` +
      `<path d="M28.5 16C27 8 32 3.5 38.5 3.5C44 3.5 48.5 7 48 12.5C46.5 11 44.5 10.5 42.5 11.5C41 9.5 38 9.5 36.5 11.5C34.5 10.5 32 12 31 16.5Z" fill="#5B4A5E" stroke-width="2.5"/>` +
      eyes(40, 16.5, 45.5, 16.5, 1.8) + `<ellipse cx="40.5" cy="20.5" rx="2.4" ry="1.5" fill="#FF9DB3" opacity=".6"${N}/></g>`,
  ),

  '💃': S(
    `<path d="M9 14V5l6-2v8" stroke="#C9A4F0" stroke-width="2.5"/><ellipse cx="7.5" cy="14" rx="2.6" ry="2" fill="#C9A4F0"${N}/><ellipse cx="13.5" cy="12" rx="2.6" ry="2" fill="#C9A4F0"${N}/>` +
      limb('M33 48L34 57M28 47L19 54', P) + limb('M29 27L21 30L15 25M35 27L42 19L45 10', '#B2D9FF') +
      `<circle cx="45.5" cy="8.5" r="3.2" fill="${P}" stroke-width="2.5"/><circle cx="14" cy="24" r="3.2" fill="${P}" stroke-width="2.5"/>` +
      limb('M32 25L32 34', '#B2D9FF', 13) +
      `<path d="M26 33H38C43 39 49 43 53 46C46 50 38 50 31 49C25 50 18 49 12 47C18 43 23 39 26 33Z" fill="#FF9DB3"/>` +
      `<path d="M18 46q4-3 8 0M32 46q4-3 8 0" stroke="#FFC4D6" stroke-width="2.2"/>` +
      `<circle cx="31" cy="14" r="9.5" fill="${P}"/>` +
      `<path d="M21.5 16C20 8 25 3.5 31 3.5C37 3.5 41.5 8 40.5 16C39 13 37 11.5 35 12C33 10 30 10 28.5 12C26 11.5 23.5 13 21.5 16Z" fill="#5B4A5E" stroke-width="2.5"/>` +
      eyes(27.5, 16.5, 34.5, 16.5, 1.8) + blush(25, 37, 20, 2.3, 1.5) + `<path d="M29.5 20q1.5 1.3 3 0" stroke-width="1.8"/>`,
  ),

  '💙': S(heart('#8FC9F0') + hl(18, 20, 4, 2.4, -40)),
  '🤍': S(heart('#fff') + `<path d="M46 20C48 30 42 38 34 44" stroke="#E6B2FF" stroke-width="3" opacity=".45"/>` + hl(18, 20, 4, 2.4, -40)),
  '💗': S(heart('#FF9DB3') + heart('#FFC4D6', 0.64, 32, 32, N) + heart('#FF7A93', 0.32, 32, 33, N) + hl(18, 20, 4, 2.4, -40)),
  '💖': S(
    heart('#FF9DB3', 0.82, 30, 34) + hl(18.5, 24, 3.2, 2, -40) +
      `<g fill="#FFE9A8" stroke-width="2.3"><path d="M52 5Q52 12 59 12Q52 12 52 19Q52 12 45 12Q52 12 52 5Z"/><path d="M11 44Q11 49 16 49Q11 49 11 54Q11 49 6 49Q11 49 11 44Z"/></g><circle cx="52" cy="28" r="2" fill="#FFE9A8" stroke-width="2"/>`,
  ),
  '💕': S(heart('#FF9DB3', 0.72, 25, 36) + hl(15, 28, 3, 1.8, -40) + heart('#FFC4D6', 0.45, 46, 18) + hl(40.5, 13.5, 2, 1.3, -40)),
  '♥': S(`<path d="M32 57C26 48 7 39 7 23C7 14 14 8 21 8C26 8 30 11 32 15C34 11 38 8 43 8C50 8 57 14 57 23C57 39 38 48 32 57Z" fill="#FF7A93"/>` + hl(17.5, 20, 4, 2.4, -40)),
};
