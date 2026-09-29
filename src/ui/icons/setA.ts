// Hand-drawn pastel icon set A (see src/ui/icons/index.ts for the style guide). Keys: emoji without FE0F.
// Food & sweets, drinks, stars & sparkles, weather. Built with tiny helpers; every value is a complete standalone SVG.
const INK = '#5B4A5E';
const svg = (b: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${b}</svg>`;
const n = (v: number) => +v.toFixed(1);
/** glossy white highlight */
const hl = (x: number, y: number, rx: number, ry: number, r = -30) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${r} ${x} ${y})" fill="#fff" opacity=".7" stroke="none"/>`;
/** tiny kawaii face: dot eyes, pink blush, little smile */
const face = (x: number, y: number, d = 6, e = 2.2) => {
  const b = (s: number) => `<ellipse cx="${n(x + s * (d + e * 1.5))}" cy="${n(y + e * 1.8)}" rx="${n(e * 1.3)}" ry="${n(e * 0.85)}"/>`;
  return `<g stroke="none"><circle cx="${x - d}" cy="${y}" r="${e}" fill="${INK}"/><circle cx="${x + d}" cy="${y}" r="${e}" fill="${INK}"/><g fill="#FF9DB3" opacity=".6">${b(-1)}${b(1)}</g></g>` +
    `<path d="M${n(x - e * 0.9)} ${n(y + e)}q${n(e * 0.9)} ${n(e * 0.9)} ${n(e * 1.8)} 0" stroke-width="${n(Math.max(1.6, e * 0.9))}"/>`;
};
/** a thick coloured line with an ink outline (sticks, handles, stems) */
const rod = (d: string, c: string, w = 3) => `<path d="${d}" stroke-width="${w + 5}"/><path d="${d}" stroke="${c}" stroke-width="${w}"/>`;
/** 5-point star path */
const star = (cx: number, cy: number, R: number, r: number, rot = 0) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = ((i * 36 - 90 + rot) * Math.PI) / 180, k = i % 2 ? r : R;
    d += (i ? 'L' : 'M') + n(cx + k * Math.cos(a)) + ' ' + n(cy + k * Math.sin(a));
  }
  return d + 'Z';
};
/** 4-point twinkle path */
const spark = (x: number, y: number, r: number) => {
  const k = n(r * 0.22);
  return `M${x} ${y - r}Q${x + k} ${y - k} ${x + r} ${y}Q${x + k} ${y + k} ${x} ${y + r}Q${x - k} ${y + k} ${x - r} ${y}Q${x - k} ${y - k} ${x} ${y - r}Z`;
};
/** water drop path around 0,0 (tip up), s = scale */
const drop = (s: number) => {
  const p = (v: number) => n(v * s);
  return `M0 ${p(-16)}C${p(4)} ${p(-9)} ${p(11)} ${p(-4)} ${p(11)} ${p(4)}C${p(11)} ${p(10)} ${p(6)} ${p(14)} 0 ${p(14)}C${p(-6)} ${p(14)} ${p(-11)} ${p(10)} ${p(-11)} ${p(4)}C${p(-11)} ${p(-4)} ${p(-4)} ${p(-9)} 0 ${p(-16)}Z`;
};

const PINK = '#FFC4D6', STRAW = '#FF7A93', PEACH = '#FFD6B8', BUTTER = '#FFE9A8', MINT = '#BFF0DA', SKY = '#B2D9FF',
  LAV = '#E6B2FF', CREAM = '#FFF6EC', WOOD = '#E8C39E', PINKD = '#FF9DB3', SKYD = '#8FC9F0', MINTD = '#9BD9BD', GOLD = '#F5C26B',
  YEL = '#FFDF80', CARAMEL = '#E8A86B', NORI = '#5E7266', COFFEE = '#C99A78', ORANGE = '#FFA27F';

export const SET_A: Record<string, string> = {
  // dumpling (gyoza) with pleats
  '🥟': svg(`<path d="M4 44C4 36 8 31 12 29Q14 23 20 24Q24 18 29 20Q32 15 36 20Q41 18 44 24Q50 23 52 29C56 31 60 36 60 44C60 51 49 54 32 54S4 51 4 44Z" fill="${CREAM}"/><path d="M20 24q1 5 4 8M29 20q0 6 1 10M36 20q-1 6-1 10M44 24q-1 5-4 8" stroke-width="2.5"/>${hl(12, 42, 2.5, 4.5, 20)}${face(32, 42)}`),
  // ramen bowl with chopsticks
  '🍜': svg(`<path d="M14 20q-3-3 0-6t0-6M22 20q-3-3 0-6t0-6" stroke-width="2.5"/><rect x="23" y="50" width="18" height="8" rx="2" fill="${PINKD}"/><path d="M6 30C6 46 18 55 32 55S58 46 58 30Z" fill="${PINK}"/><path d="M10 40q22 9 44 0" stroke="${STRAW}" stroke-width="3"/><ellipse cx="32" cy="30" rx="26" ry="7" fill="${GOLD}"/><path d="M13 30q3-3 6 0t6 0t6 0" stroke="${CREAM}" stroke-width="2.5"/><ellipse cx="42" cy="29.5" rx="6" ry="3.5" fill="#fff" stroke-width="2"/><circle cx="42" cy="29.5" r="1.8" fill="${GOLD}" stroke="none"/>${rod('M33 29L52 6', WOOD, 2.5)}${rod('M38 31L58 11', WOOD, 2.5)}`),
  // rice ball with nori
  '🍙': svg(`<path d="M32 7C39 7 58 40 58 48C58 56 50 57 32 57S6 56 6 48C6 40 25 7 32 7Z" fill="#fff"/><path d="M22 40H42V57H22Z" fill="${NORI}" stroke-width="2.5"/>${hl(24, 21, 2.5, 5, 30)}${face(32, 31)}`),
  // drumstick
  '🍗': svg(`<path d="M37 37L48 48" stroke-width="11"/><circle cx="45" cy="53" r="5.5" fill="#fff"/><circle cx="53" cy="45" r="5.5" fill="#fff"/><path d="M37 37L49 49" stroke="#fff" stroke-width="5"/><path d="M42 36C46 24 40 8 26 7C12 6 5 18 8 28C11 40 26 46 36 42C39 41 41 39 42 36Z" fill="${CARAMEL}"/>${hl(17, 17, 3, 6, 40)}`),
  // strawberry shortcake slice
  '🍰': svg(`<path d="M6 34L58 24V48L6 54Z" fill="${BUTTER}"/><path d="M6 42L58 33V38L6 47Z" fill="#fff" stroke-width="2"/><g fill="${STRAW}" stroke="none"><circle cx="18" cy="42.4" r="2"/><circle cx="32" cy="40" r="2"/><circle cx="46" cy="37.6" r="2"/></g><path d="M6 34L44 16L58 24Z" fill="#fff"/><path d="M42 15C42 10 54 10 54 15C54 20 50 24 48 24S42 20 42 15Z" fill="${STRAW}"/><path d="M43 12Q48 7 53 12Q48 14 43 12Z" fill="${MINTD}" stroke-width="2"/>`),
  // strawberry
  '🍓': svg(`<path d="M32 58C18 54 7 40 7 28C7 18 17 14 32 16C47 14 57 18 57 28C57 40 46 54 32 58Z" fill="${STRAW}"/><g fill="${BUTTER}" stroke="none">${[[20, 30], [32, 28], [44, 30], [26, 40], [38, 40], [32, 50], [16, 40], [48, 40]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.6" ry="2.3"/>`).join('')}</g>${hl(15, 27, 2.5, 5, 30)}<path d="M32 21Q23 24 15 18Q22 13 26 14Q24 7 29 5Q32 9 32 12Q32 9 35 5Q40 7 38 14Q42 13 49 18Q41 24 32 21Z" fill="${MINTD}"/>`),
  // soft-serve
  '🍦': svg(`<path d="M16 38L32 60L48 38Z" fill="${WOOD}"/><path d="M26 38L37 53M38 38L27 53M36 38l6 8M28 38l-6 8" stroke-width="2"/><path d="M34 4C30 8 24 10 24 16C18 17 16 22 18 26C12 28 12 36 16 39H48C52 36 52 28 46 26C48 22 46 17 40 16C42 12 38 8 34 4Z" fill="${CREAM}"/><path d="M19 27Q32 31 45 27M25 17Q32 20 39 17" stroke-width="2.5"/>`),
  // peach
  '🍑': svg(`<path d="M32 18C24 11 8 14 8 34C8 48 20 58 32 58S56 48 56 34C56 14 40 11 32 18Z" fill="${PEACH}"/><ellipse cx="42" cy="38" rx="11" ry="14" fill="${PINKD}" opacity=".55" stroke="none"/><path d="M32 18C27 28 27 42 31 52" stroke-width="2.5"/>${hl(18, 32, 3.5, 6, 20)}<path d="M31 17C28 11 21 9 15 11C19 17 25 19 31 17Z" fill="${MINT}"/><path d="M32 17C34 9 44 5 52 8C48 16 40 18 32 17Z" fill="${MINTD}"/>`),
  // red apple
  '🍎': svg(`<path d="M32 19Q31 11 36 5" stroke-width="3.5"/><path d="M32 18C26 12 8 12 8 32C8 48 20 58 28 58C30 58 31 57 32 57S34 58 36 58C44 58 56 48 56 32C56 12 38 12 32 18Z" fill="${STRAW}"/>${hl(18, 30, 3.5, 7, 20)}<path d="M35 12C38 5 47 3 52 6C48 13 41 15 35 12Z" fill="${MINTD}"/>`),
  // bento box
  '🍱': svg(`<rect x="5" y="11" width="54" height="42" rx="7" fill="${PINKD}"/><rect x="10" y="16" width="25" height="32" rx="3" fill="#fff" stroke-width="2.5"/><circle cx="22.5" cy="32" r="4.5" fill="${STRAW}" stroke-width="2"/><rect x="38" y="16" width="16" height="14" rx="3" fill="${BUTTER}" stroke-width="2.5"/><path d="M46 16v14" stroke-width="2"/><rect x="38" y="33" width="16" height="15" rx="3" fill="${MINT}" stroke-width="2.5"/><circle cx="44" cy="40" r="3" fill="${MINTD}" stroke-width="2"/><circle cx="49" cy="42" r="3" fill="${MINTD}" stroke-width="2"/>`),
  // hanami dango
  '🍡': svg(`${rod('M7 57L55 9', WOOD, 2.5)}<circle cx="20" cy="44" r="11" fill="${MINT}"/><circle cx="32" cy="32" r="11" fill="${CREAM}"/><circle cx="44" cy="20" r="11" fill="${PINK}"/>${hl(15, 40, 2, 3.5)}${hl(27, 28, 2, 3.5)}${hl(39, 16, 2, 3.5)}${face(32, 33, 4, 1.6)}`),
  // custard pudding with caramel
  '🍮': svg(`<ellipse cx="32" cy="50" rx="27" ry="7" fill="${SKY}"/><path d="M20 14H44Q48 14 48.5 18L52 46Q52 49 49 49H15Q12 49 12 46L15.5 18Q16 14 20 14Z" fill="${BUTTER}"/><path d="M15.6 18Q16 14 20 14H44Q48 14 48.4 18L49 24Q47 29 43 25Q40 31 36 25Q33 28 30 25Q26 31 22 25Q19 28 15 24Z" fill="${CARAMEL}"/>${face(32, 37)}${hl(18, 34, 2, 5, 10)}`),
  // pink frosted donut
  '🍩': svg(`<path d="M6 32a26 26 0 1 0 52 0a26 26 0 1 0-52 0ZM25 32a7 7 0 1 0 14 0a7 7 0 1 0-14 0Z" fill="${WOOD}" fill-rule="evenodd"/><path d="M32 11C40 10 46 14 49 19C53 22 54 29 52 34C54 40 50 46 45 48C41 53 34 53 30 52C24 54 18 50 16 46C11 42 10 36 12 31C10 24 14 17 20 15C24 11 28 11 32 11ZM22 32a10 10 0 1 0 20 0a10 10 0 1 0-20 0Z" fill="${PINK}" fill-rule="evenodd"/><g stroke-width="2.5"><path d="M24 18l4-1.5" stroke="${SKYD}"/><path d="M40 16l3 3" stroke="${GOLD}"/><path d="M46 31l1 4" stroke="${MINTD}"/><path d="M37 46l4-2" stroke="${SKYD}"/><path d="M20 40l2 3" stroke="${GOLD}"/><path d="M26 47l3 1" stroke="${MINTD}"/></g>${hl(18, 25, 2, 4.5, 40)}`),
  // chili pepper
  '🌶': svg(`${rod('M45 17C45 11 49 7 54 7', MINTD, 2.5)}<path d="M44 17C52 19 55 29 49 39C43 49 29 57 13 57C9 57 8 54 11 52C24 48 32 40 36 28C38 21 40 17 44 17Z" fill="${STRAW}"/><path d="M45 25C44 35 36 44 24 50" stroke="#fff" stroke-width="3" opacity=".7"/><path d="M36 21C38 14 49 13 53 19C51 23 42 25 36 21Z" fill="${MINTD}"/>`),
  // wrapped candy
  '🍬': svg(`<g transform="rotate(-25 32 32)"><path d="M21 29L8 20Q4 32 8 44L21 35ZM43 29L56 20Q60 32 56 44L43 35Z" fill="${PINK}"/><path d="M12 27l6 3M12 37l6-3M52 27l-6 3M52 37l-6-3" stroke-width="2"/><circle cx="32" cy="32" r="13" fill="${STRAW}"/><path d="M26 22Q31 32 26 42M35 20Q40 32 35 44" stroke="#fff" stroke-width="3" opacity=".75"/><circle cx="32" cy="32" r="13"/></g>`),
  // swirl lollipop
  '🍭': svg(`${rod('M32 42V58', '#fff', 3)}<circle cx="32" cy="24" r="19" fill="${PINK}"/><path d="M32 24a3 3 0 0 1 6 0a6 6 0 0 1-12 0a9 9 0 0 1 18 0a12 12 0 0 1-24 0a15 15 0 0 1 30 0" stroke="${STRAW}" stroke-width="4"/><circle cx="32" cy="24" r="19"/>${hl(21, 15, 2.5, 5, 40)}`),
  // cupcake with cherry
  '🧁': svg(`<path d="M13 36H51L46 58H18Z" fill="${SKY}"/><path d="M23 39l2 16M32 39v16M41 39l-2 16" stroke-width="2.5"/><path d="M12 38C7 35 9 27 16 27C16 19 24 15 32 17C40 15 48 19 48 27C55 27 57 35 52 38C48 41 16 41 12 38Z" fill="${PINK}"/><path d="M16 29Q32 34 48 29" stroke-width="2.5"/><g stroke-width="2.5"><path d="M22 23l3-1" stroke="${SKYD}"/><path d="M40 22l2 2" stroke="${GOLD}"/><path d="M28 34l3 1" stroke="${MINTD}"/><path d="M44 33l-2 2" stroke="${SKYD}"/></g><path d="M34 8q1-3 5-4" stroke-width="2.5"/><circle cx="33" cy="12" r="5" fill="${STRAW}"/>${hl(31, 10.5, 1.3, 2, 30)}`),
  // popcorn box
  '🍿': svg(`${[[17, 27, 7, CREAM], [27, 21, 8, BUTTER], [40, 20, 8, CREAM], [48, 28, 6, BUTTER], [22, 13, 6, CREAM], [34, 10, 7, CREAM], [45, 11, 5, BUTTER]].map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('')}<path d="M13 28H51L45 58H19Z" fill="#fff" stroke="none"/><path d="M20.6 28H28.2L29.4 58H24.2ZM35.8 28H43.4L39.8 58H34.6Z" fill="${STRAW}" stroke="none"/><path d="M13 28H51L45 58H19Z"/>`),
  // hot drink on a saucer
  '☕': svg(`<path d="M25 17q-3-3 0-6t0-6M35 17q-3-3 0-6t0-6" stroke-width="2.5"/><ellipse cx="31" cy="54" rx="24" ry="5" fill="${SKY}"/>${rod('M45 31C53 30 56 34 55 39C54 44 49 46 44 45', PINK, 3.5)}<path d="M14 24H48V38C48 48 42 54 31 54S14 48 14 38Z" fill="${PINK}"/><ellipse cx="31" cy="24" rx="17" ry="4.5" fill="${COFFEE}"/><path d="M31 46L26.5 41.5A2.8 2.8 0 0 1 31 37.8A2.8 2.8 0 0 1 35.5 41.5Z" fill="#fff" stroke="none"/>${hl(20, 36, 2, 5, 0)}`),
  // glass of milk
  '🥛': svg(`<path d="M15 7H49L45.5 56Q45 59 42 59H22Q19 59 18.5 56Z" fill="${SKY}" fill-opacity=".55"/><path d="M15.9 19H48.1L45.5 56Q45 59 42 59H22Q19 59 18.5 56Z" fill="#fff" stroke="none"/><path d="M40 25l-1.5 28" stroke="#E6F2FF" stroke-width="4"/><ellipse cx="32" cy="19" rx="16" ry="3.2" fill="#fff" stroke-width="2.5"/><path d="M20.5 10.5l.3 3" stroke="#fff" stroke-width="3"/><path d="M15 7H49L45.5 56Q45 59 42 59H22Q19 59 18.5 56Z"/>`),
  // birthday cake with candles
  '🎂': svg(`<path d="M8 32V49C8 54 20 57 32 57S56 54 56 49V32Z" fill="${BUTTER}"/><g fill="${STRAW}" stroke-width="2"><circle cx="17" cy="48" r="3"/><circle cx="32" cy="50" r="3"/><circle cx="47" cy="48" r="3"/></g><path d="M8 32C8 26 56 26 56 32V36Q52 42 48 37Q44 43 38 38Q32 44 26 38Q20 43 16 37Q12 42 8 36Z" fill="${PINK}"/><g stroke-width="2.5"><rect x="18.5" y="17" width="5" height="13" rx="1.5" fill="${SKY}"/><rect x="29.5" y="15" width="5" height="14" rx="1.5" fill="#fff"/><rect x="40.5" y="17" width="5" height="13" rx="1.5" fill="${LAV}"/></g><g fill="${GOLD}" stroke-width="2"><path d="M21 7C24 10 24 13 21 14S18 10 21 7Z"/><path d="M32 5C35 8 35 11 32 12S29 8 32 5Z"/><path d="M43 7C46 10 46 13 43 14S40 10 43 7Z"/></g>`),
  // bowl of rice
  '🍚': svg(`<rect x="22" y="50" width="20" height="8" rx="2" fill="${SKYD}"/><path d="M9 32C10 20 20 13 32 13S54 20 55 32Z" fill="#fff"/><path d="M22 21l3 1M36 18l3-1M28 26l3 1M43 25l2 2M16 28l2-2" stroke-width="2.5"/><path d="M6 31C6 46 18 55 32 55S58 46 58 31Z" fill="${SKY}"/><g fill="#fff" stroke="none"><circle cx="19" cy="41" r="2.5"/><circle cx="32" cy="44" r="2.5"/><circle cx="45" cy="41" r="2.5"/></g>${hl(13, 37, 2, 4, 50)}`),
  // star
  '⭐': svg(`<path d="${star(32, 34, 27, 13.5)}" fill="${YEL}"/>${hl(24, 26, 2.5, 5, 35)}`),
  // sparkles
  '✨': svg(`<path d="${spark(24, 38, 20)}" fill="${YEL}"/><path d="${spark(47, 15, 11)}" fill="${YEL}"/><path d="${spark(50, 45, 8)}" fill="${YEL}"/>`),
  // glowing star
  '🌟': svg(`<circle cx="32" cy="32" r="28" fill="#FFF4C8" stroke="none"/><g stroke="${GOLD}" stroke-width="3">${[18, 90, 162, 234, 306].map((a) => { const c = Math.cos((a * Math.PI) / 180), s = Math.sin((a * Math.PI) / 180); return `<path d="M${n(32 + 22 * c)} ${n(33 + 22 * s)}L${n(32 + 27 * c)} ${n(33 + 27 * s)}"/>`; }).join('')}</g><path d="${star(32, 33, 21, 10.5)}" fill="${YEL}"/>${hl(26, 27, 2, 4, 35)}`),
  // dizzy: star with swooshing trails
  '💫': svg(`<path d="M40 25C37 44 22 55 4 48C20 48 28 40 30 26Z" fill="${BUTTER}"/><path d="M47 32C46 46 36 54 24 57C32 50 37 43 39 33Z" fill="${BUTTER}"/><path d="${star(44, 20, 14, 7, 12)}" fill="${YEL}"/>${hl(40, 16, 1.6, 3.2, 35)}`),
  // fire
  '🔥': svg(`<path d="M34 4C38 14 44 18 46 24C47 21 48 19 48 16C54 24 54 32 52 40C50 52 42 58 32 58C20 58 12 50 12 40C12 32 15 26 18 16C20 22 23 25 26 26C26 18 29 10 34 4Z" fill="${ORANGE}"/><path d="M32 28C36 34 42 38 42 46C42 52 38 56 32 56S22 52 22 46C22 40 27 35 32 28Z" fill="${YEL}" stroke-width="2.5"/>`),
  // sweat droplets
  '💦': svg(`${[[22, 38, 1.05], [45, 19, 0.72], [48, 46, 0.55]].map(([x, y, s]) => `<g transform="translate(${x} ${y}) rotate(-30)"><path d="${drop(s)}" fill="${SKY}"/>${hl(n(-4.5 * s), n(4 * s), n(2.2 * s), n(4 * s), 20)}</g>`).join('')}`),
  // droplet
  '💧': svg(`<path transform="translate(32 33)" d="${drop(1.75)}" fill="${SKY}"/>${hl(22, 40, 3, 7, 20)}`),
  // dash / puff of air
  '💨': svg(`<path d="M40 25H57M42 37H59M34 48H48" stroke-width="3"/><path d="M12 44C5 43 4 34 10 31C8 23 16 18 22 22C26 15 38 16 39 25C45 26 46 35 41 38C43 45 35 50 29 46C25 51 16 50 12 44Z" fill="#fff"/><path d="M19 36a5 5 0 1 1 8 3" stroke="${SKYD}" stroke-width="2.5"/>`),
  // crescent moon
  '🌙': svg(`<path d="M27.5 8.4A25 25 0 1 0 55.4 41.8A22 22 0 0 1 27.5 8.4Z" fill="${YEL}"/>${hl(14, 30, 2.5, 6, 15)}`),
  // sun
  '☀': svg(`${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path transform="rotate(${a} 32 32)" d="M27.5 14L32 5L36.5 14Z" fill="${GOLD}" stroke-width="2.5"/>`).join('')}<circle cx="32" cy="32" r="15" fill="${YEL}"/>${hl(26, 26, 2.5, 4.5, 40)}`),
  // cloud
  '☁': svg(`<path d="M17 49C9 49 5 43 7 37C9 31 15 29 19 31C20 21 30 16 38 20C45 15 55 20 54 29C60 31 61 40 57 45C55 48 52 49 49 49Z" fill="#fff"/><path d="M14 43Q30 46 52 43" stroke="${SKY}" stroke-width="3"/>`),
  // water wave
  '🌊': svg(`<path d="M6 58V40C6 22 20 10 36 10C50 10 58 20 56 30C54 38 44 40 40 34C37 29 41 23 47 25C44 20 36 20 31 26C26 33 28 46 38 52C44 56 52 57 58 58Z" fill="${SKYD}"/><path d="M12 40C13 26 24 15 37 15C46 15 52 20 52 26" stroke="#fff" stroke-width="3" opacity=".8"/><path d="M34 58C38 51 46 48 53 50C56 51 58 54 58 58Z" fill="${SKY}"/>`),
};
