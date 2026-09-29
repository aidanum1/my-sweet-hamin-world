// Hand-drawn pastel icon set B (see src/ui/icons/index.ts for the style guide). Keys: emoji without FE0F.
// Wardrobe / dress-up clothes and reaction faces.
const W = (b: string) =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke="#5B4A5E" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">' +
  b +
  '</g></svg>';
/** white highlight */
const HL = (x: number, y: number, rx = 5, ry = 3, a = -35) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${a} ${x} ${y})" fill="#fff" stroke="none" opacity=".7"/>`;
const DOT = (x: number, y: number, r = 3.4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#5B4A5E" stroke="none"/>`;
const FACE = (f = '#FFE9A8') => `<circle cx="32" cy="32" r="26" fill="${f}"/>` + HL(20, 18);
const BLUSH = (o = '.6', y = 39) =>
  `<g fill="#FF9DB3" stroke="none" opacity="${o}"><ellipse cx="15" cy="${y}" rx="5.5" ry="3.2"/><ellipse cx="49" cy="${y}" rx="5.5" ry="3.2"/></g>`;
const EYES = DOT(23, 30) + DOT(41, 30);
/** cat head: ears + round head */
const CAT =
  '<path d="M9 28L11 6L28 14Z" fill="#FFE9A8"/><path d="M55 28L53 6L36 14Z" fill="#FFE9A8"/>' +
  '<path d="M14 18L15 12L21 15ZM50 18L49 12L43 15Z" fill="#FFC4D6" stroke="none"/>' +
  '<ellipse cx="32" cy="36" rx="26" ry="23" fill="#FFE9A8"/>' +
  HL(19, 23);

export const SET_B: Record<string, string> = {
  // jeans (light denim like Hamin's)
  '👖': W(
    '<path d="M16 14L13 57H29.5L32 28L34.5 57H51L48 14Z" fill="#B2D9FF"/>' +
      '<rect x="15" y="7" width="34" height="8" rx="2.5" fill="#8FC9F0"/>' +
      '<path d="M13.6 50H30M34 50H50.4" stroke-width="2.5"/>' +
      '<path d="M20 15Q21 22 27 22M44 15Q43 22 37 22M32 15V26" stroke-width="2"/>' +
      '<circle cx="32" cy="11" r="2" fill="#F5C26B" stroke="none"/>' +
      '<path d="M19 21L17.5 40" stroke="#fff" opacity=".7"/>',
  ),
  // black loafer, softened
  '👞': W(
    '<rect x="6" y="41" width="54" height="8" rx="4" fill="#E8C39E"/>' +
      '<path d="M8 42V29Q8 24 12 24.5L24 26.5Q28 31 35 30.5L45 31Q58 33 58 42Z" fill="#7A6A80"/>' +
      '<path d="M10.5 27Q17 30 24 27.5" stroke-width="2"/>' +
      '<path d="M26 30Q33 38 43 32" stroke-width="7"/>' +
      '<path d="M26 30Q33 38 43 32" stroke="#B3A2B8" stroke-width="3"/>' +
      '<path d="M33 34H36.5" stroke-width="2"/>' +
      HL(50, 35, 4, 2, 15),
  ),
  // backpack
  '🎒': W(
    '<path d="M25 13Q25 5 32 5Q39 5 39 13" stroke-width="3.5"/>' +
      '<rect x="12" y="11" width="40" height="48" rx="13" fill="#FF9DB3"/>' +
      '<path d="M12.5 26Q13 12 25 11H39Q51 12 51.5 26V28Q32 36 12.5 28Z" fill="#FF7A93"/>' +
      '<rect x="19" y="38" width="26" height="16" rx="6" fill="#FFC4D6"/>' +
      '<path d="M19 44H45" stroke-width="2"/>' +
      '<rect x="28.5" y="28" width="7" height="7" rx="2" fill="#F5C26B" stroke-width="2"/>' +
      HL(20, 18, 4, 2.5),
  ),
  // coat: light denim jacket over white shirt + navy tie (Hamin's outfit)
  '🧥': W(
    '<path d="M18 10Q9 12 8 22L6 50Q6 53 9 53H13Q15 53 15 50L17 26M46 10Q55 12 56 22L58 50Q58 53 55 53H51Q49 53 49 50L47 26" fill="#B2D9FF"/>' +
      '<path d="M18 10L25 7H39L46 10V56Q46 58 44 58H20Q18 58 18 56Z" fill="#B2D9FF"/>' +
      '<path d="M25 7L32 30L39 7Z" fill="#fff"/>' +
      '<path d="M30.4 9.5H33.6L34.5 20L32 24L29.5 20Z" fill="#5E6FA8" stroke="none"/>' +
      '<path d="M25 7L19 13L32 30ZM39 7L45 13L32 30Z" fill="#8FC9F0"/>' +
      '<path d="M32 30V58M6.5 45.5H15.5M48.5 45.5H57.5" stroke-width="2"/>' +
      '<g fill="#F5C26B" stroke-width="1.5"><circle cx="32" cy="38" r="2"/><circle cx="32" cy="48" r="2"/></g>' +
      HL(12, 26, 3.5, 2, -75),
  ),
  // sneaker
  '👟': W(
    '<path d="M9 44L10 24Q10 19 15 20L24 22Q27 30 36 31L46 33Q57 35 58 44Z" fill="#B2D9FF"/>' +
      '<path d="M46 33Q57 35 58 44H45Q42 37 46 33Z" fill="#fff" stroke-width="2.5"/>' +
      '<path d="M15 38Q27 40 38 33" stroke="#FF7A93" stroke-width="4"/>' +
      '<path d="M25 27L29 22.6M29.6 30L33 25.6M34.2 32L37 28" stroke-width="2"/>' +
      '<rect x="6" y="43" width="54" height="9" rx="4.5" fill="#fff"/>' +
      '<path d="M10 47.5H56" stroke="#FF9DB3" stroke-width="2"/>' +
      HL(16, 27, 3.5, 2, -70),
  ),
  // t-shirt
  '👕': W(
    '<path d="M22 8Q32 15 42 8L56 16Q58 17 57 19L51 29Q50 31 48 30L46 29V55Q46 58 43 58H21Q18 58 18 55V29L16 30Q14 31 13 29L7 19Q6 17 8 16Z" fill="#BFF0DA"/>' +
      '<path d="M24 9.5Q32 18 40 9.5M18 29V20M46 29V20" stroke-width="2"/>' +
      '<path d="M32 44C25 39.5 26 32 32 35C38 32 39 39.5 32 44Z" fill="#FF9DB3" stroke-width="2"/>' +
      HL(24, 25, 3.5, 2, -60),
  ),
  // yarn ball
  '🧶': W(
    '<path d="M46.6 46.6Q52 57 60 51"/>' +
      '<circle cx="31" cy="31" r="22" fill="#FF9DB3"/>' +
      '<path d="M10.3 23.5Q30 26 34.8 52.7M16.9 14.1Q38 18 51.7 38.5M29.1 9.1Q44 12 52.3 25.3M9.3 34.8Q20 38 23.5 51.7" stroke-width="2.2"/>' +
      HL(19, 17, 4, 2.5),
  ),
  // shorts
  '🩳': W(
    '<path d="M13 19L8 47Q8 50 11 50.5L28 52Q30 52 30.5 50L32 34L33.5 50Q34 52 36 52L53 50.5Q56 50 56 47L51 19Z" fill="#E6B2FF"/>' +
      '<rect x="12" y="12" width="40" height="8" rx="3" fill="#C9A4F0"/>' +
      '<path d="M32 20V33M9 43L29.5 45M34.5 45L55 43M29 20Q28 26 25 28M35 20Q36 26 39 28" stroke-width="2"/>' +
      '<path d="M15.5 25L13.5 38" stroke="#fff" opacity=".7"/>',
  ),
  // scarf
  '🧣': W(
    '<path d="M8 15Q32 -1 56 15Q32 7 8 15Z" fill="#FF9DB3"/>' +
      '<path d="M29 30L21 52L31 55L37 32ZM36 32L41 55L51 51L43 30Z" fill="#FF7A93"/>' +
      '<path d="M25 42.5L33.5 44.5M39 44L47.5 41" stroke="#FFC4D6" stroke-width="4" stroke-linecap="butt"/>' +
      '<path d="M23 53V57.5M26 54V58.5M29 55V59.5M43 55V59.5M46 54V58.5M49 52.5V57" stroke-width="2.5"/>' +
      '<path d="M8 15Q32 31 56 15Q59 22 55 27Q32 42 9 27Q5 22 8 15Z" fill="#FF7A93"/>' +
      '<path d="M20 22V31.5M44 22V31.5" stroke="#FFC4D6" stroke-width="4" stroke-linecap="butt"/>' +
      HL(13, 21, 3, 1.8, 40),
  ),
  // boot
  '👢': W(
    '<path d="M16 12H36V36Q36 40 41 41L51 43Q58 45 58 50V52H16Z" fill="#E8C39E"/>' +
      '<path d="M14 51H59Q59 56 55 56H26V58Q26 60 24 60H16Q14 60 14 58Z" fill="#C99B72"/>' +
      '<rect x="13" y="6" width="26" height="9" rx="4.5" fill="#FFF6EC"/>' +
      '<path d="M21 19V36" stroke="#fff" opacity=".7"/>' +
      HL(51, 46, 3, 1.8, 20),
  ),
  // flip-flop
  '🩴': W(
    '<g transform="rotate(20 32 32)">' +
      '<path d="M34 10C44 10 46 19 45 28C44 34 46 40 46 48C46 56 40 59 34 59C28 59 22 56 22 48C22 40 24 34 23 28C22 19 24 10 34 10Z" fill="#9BD9BD" stroke="none"/>' +
      '<path d="M32 8C42 8 44 17 43 26C42 32 44 38 44 46C44 54 38 57 32 57C26 57 20 54 20 46C20 38 22 32 21 26C20 17 22 8 32 8Z" fill="#BFF0DA"/>' +
      '<path d="M32 17L22 34M32 17L42 34" stroke-width="7.5"/>' +
      '<path d="M32 17L22 34M32 17L42 34" stroke="#FF7A93" stroke-width="3.5"/>' +
      '<circle cx="32" cy="17" r="3.6" fill="#FF7A93" stroke-width="2.5"/>' +
      HL(27, 47, 3, 2, -80) +
      '</g>',
  ),
  // billed cap
  '🧢': W(
    '<path d="M38 41H53Q60 41 60 46Q60 50 55 50H38Z" fill="#8FC9F0"/>' +
      '<path d="M6 45Q6 17 28 17Q50 17 50 45Q28 40 6 45Z" fill="#B2D9FF"/>' +
      '<path d="M28 19Q20 28 19 43M28 19Q36 28 38 42" stroke-width="2"/>' +
      '<circle cx="28" cy="16" r="3.2" fill="#8FC9F0" stroke-width="2.5"/>' +
      HL(13, 30, 3.5, 2, -65),
  ),
  // straw sun hat with pink ribbon
  '👒': W(
    '<ellipse cx="32" cy="41" rx="28" ry="11" fill="#FFE9A8"/>' +
      '<path d="M16 41Q15 15 32 15Q49 15 48 41Q32 47 16 41Z" fill="#FFE9A8"/>' +
      '<path d="M15.8 32Q32 38 48.2 32L48 40Q32 46 16 40Z" fill="#FF9DB3"/>' +
      '<circle cx="42" cy="36.5" r="5" fill="#fff" stroke-width="2.5"/>' +
      '<circle cx="42" cy="36.5" r="1.8" fill="#F5C26B" stroke="none"/>' +
      '<path d="M10 44Q32 54 54 44" stroke="#F5C26B" stroke-width="2"/>' +
      HL(24, 22, 4, 2.2, -50),
  ),
  // ribbon bow
  '🎀': W(
    '<path d="M29 31L20 51L26 49L29 54L33 33ZM35 31L44 51L38 49L35 54L31 33Z" fill="#FF9DB3"/>' +
      '<path d="M30 27C22 15 8 13 7 23C6 31 10 39 30 31ZM34 27C42 15 56 13 57 23C58 31 54 39 34 31Z" fill="#FFC4D6"/>' +
      '<path d="M13 24Q19 26 25 28.5M51 24Q45 26 39 28.5" stroke="#FF9DB3" stroke-width="2.5"/>' +
      '<rect x="27" y="22" width="10" height="13" rx="4" fill="#FF9DB3"/>' +
      HL(14, 19, 3, 1.8, -20),
  ),
  // glasses
  '👓': W(
    '<path d="M6 31L9 20M58 31L55 20" stroke-width="3"/>' +
      '<g fill="#B2D9FF" stroke-width="3.5"><circle cx="18" cy="35" r="12"/><circle cx="46" cy="35" r="12"/></g>' +
      '<path d="M30 33Q32 29 34 33" stroke-width="3.5"/>' +
      '<path d="M12 36L19 29M40 36L47 29" stroke="#fff" stroke-width="3" opacity=".8"/>',
  ),
  // handbag
  '👜': W(
    '<path d="M20 27V21Q20 9 32 9Q44 9 44 21V27" stroke-width="7.5"/>' +
      '<path d="M20 27V21Q20 9 32 9Q44 9 44 21V27" stroke="#C9A4F0" stroke-width="3.5"/>' +
      '<path d="M12 26H52L57 52Q58 58 52 58H12Q6 58 7 52Z" fill="#E6B2FF"/>' +
      '<path d="M12 26H52L50.5 37Q32 44 13.5 37Z" fill="#C9A4F0"/>' +
      '<circle cx="32" cy="40" r="3.5" fill="#F5C26B" stroke-width="2.5"/>' +
      HL(15, 48, 3.5, 2, -70),
  ),
  // dress
  '👗': W(
    '<path d="M24 16L25 6M40 16L39 6"/>' +
      '<path d="M22 14Q26 18 32 18Q38 18 42 14Q45 22 41 30L53 53Q55 58 49 58H15Q9 58 11 53L23 30Q19 22 22 14Z" fill="#FFC4D6"/>' +
      '<path d="M23 29Q32 33 41 29L42.5 33Q32 38 21.5 33Z" fill="#FF7A93" stroke-width="2.5"/>' +
      '<g fill="#fff" stroke="none"><circle cx="24" cy="46" r="2.2"/><circle cx="33" cy="51" r="2.2"/><circle cx="41" cy="44" r="2.2"/><circle cx="31" cy="41" r="2"/><circle cx="45" cy="52" r="2"/><circle cx="18" cy="53" r="2"/></g>' +
      HL(27, 23, 2.5, 1.6, -70),
  ),
  // shopping bags
  '🛍': W(
    '<path d="M37 18V14Q37 8 43 8Q49 8 49 14V18"/>' +
      '<rect x="30" y="18" width="26" height="32" rx="3" fill="#B2D9FF"/>' +
      '<path d="M16 26V20Q16 13 24 13Q32 13 32 20V26"/>' +
      '<path d="M8 26H40L42 58H6Z" fill="#FFC4D6"/>' +
      '<path d="M24 50C17 45 18 38 24 41C30 38 31 45 24 50Z" fill="#FF7A93" stroke-width="2"/>' +
      HL(12, 34, 3, 1.8, -80),
  ),

  // ---- faces
  // hot / overheated
  '🥵': W(
    FACE('#FFC4D6') +
      '<g fill="#FF7A93" stroke="none" opacity=".5"><ellipse cx="15" cy="37" rx="7" ry="4.5"/><ellipse cx="49" cy="37" rx="7" ry="4.5"/></g>' +
      '<path d="M16 21L25 18.5M48 21L39 18.5" stroke-width="2.5"/>' +
      '<path d="M16 30L27 27.5M48 30L37 27.5" stroke-width="2.5"/>' +
      '<path d="M18 29.5Q22 35 26.5 28ZM46 29.5Q42 35 37.5 28Z" fill="#5B4A5E" stroke-width="1.5"/>' +
      '<path d="M23 39Q32 36 41 39Q40 47 32 47Q24 47 23 39Z" fill="#5B4A5E" stroke-width="2.5"/>' +
      '<path d="M27.5 43.5Q27.5 54 32 54Q36.5 54 36.5 43.5Z" fill="#FF7A93" stroke-width="2.5"/>' +
      '<path d="M52 5Q58 13 56 16Q53 19 49.5 16Q47.5 13 52 5ZM9 18Q13 23 12 25Q10 27.5 7.5 25.5Q6 23 9 18Z" fill="#B2D9FF" stroke-width="2.5"/>',
  ),
  // cool with sunglasses
  '😎': W(
    FACE() +
      BLUSH('.5', 42) +
      '<path d="M8 26H56" />' +
      '<path d="M12 25H29V28Q29 37 20.5 37Q12 37 12 28ZM35 25H52V28Q52 37 43.5 37Q35 37 35 28Z" fill="#5B4A5E" stroke-width="2.5"/>' +
      '<path d="M16 28.5L19.5 26.5M39 28.5L42.5 26.5" stroke="#B2D9FF" stroke-width="2.2"/>' +
      '<path d="M24 45Q33 50 41 43" stroke-width="2.5"/>',
  ),
  // crying cat
  '😿': W(
    CAT +
      '<path d="M17 28L25 25M47 28L39 25" stroke-width="2.5"/>' +
      DOT(22, 33) +
      DOT(42, 33) +
      '<path d="M30 40H34L32 42.5Z" fill="#FF9DB3" stroke-width="1.5"/>' +
      '<path d="M26 50Q32 45 38 50" stroke-width="2.5"/>' +
      '<path d="M8 42L15 43M9 48L15 46M56 42L49 43M55 48L49 46" stroke-width="2"/>' +
      '<path d="M22 37.5C18.5 43 18.5 48 22 48C25.5 48 25.5 43 22 37.5Z" fill="#B2D9FF" stroke-width="2.2"/>',
  ),
  // sleepy with Zzz
  '😴': W(
    '<circle cx="29" cy="36" r="23" fill="#FFE9A8"/>' +
      HL(18, 23, 4.5, 2.8) +
      '<g fill="#FF9DB3" stroke="none" opacity=".6"><ellipse cx="14" cy="43" rx="5" ry="3"/><ellipse cx="44" cy="43" rx="5" ry="3"/></g>' +
      '<path d="M16 36Q20.5 40 25 36M33 36Q37.5 40 42 36" stroke-width="2.5"/>' +
      '<ellipse cx="29" cy="47.5" rx="3" ry="3.6" fill="#5B4A5E" stroke="none"/>' +
      '<path d="M40 12H46L40 18H46M48 3H57L48 12H57" stroke-width="6"/>' +
      '<path d="M40 12H46L40 18H46M48 3H57L48 12H57" stroke="#C9A4F0" stroke-width="2.5"/>',
  ),
  // melting face
  '🫠': W(
    '<ellipse cx="33" cy="56" rx="23" ry="4" fill="#FFE9A8"/>' +
      '<path d="M8 29A24 24 0 0 1 56 29V38Q56 43 51 43Q49 43 49 47V50Q49 54 45.5 54Q42 54 42 50V46Q42 43 38 43H31Q27 43 27 47V48Q27 51 24 51Q21 51 21 48V45Q21 42 15 42Q8 42 8 35Z" fill="#FFE9A8"/>' +
      HL(20, 15) +
      '<g transform="rotate(-12 32 29)">' +
      DOT(24, 25) +
      DOT(40, 25) +
      '<path d="M24 33Q32 40 40 33" stroke-width="2.5"/>' +
      BLUSH('.6', 32) +
      '</g>',
  ),
  // cat laughing with tears of joy
  '😹': W(
    CAT +
      '<path d="M16 34Q21 28 26 34M38 34Q43 28 48 34" stroke-width="2.8"/>' +
      '<path d="M30 38.5H34L32 40.5Z" fill="#FF9DB3" stroke-width="1.5"/>' +
      '<path d="M22 43H42Q42 55 32 55Q22 55 22 43Z" fill="#5B4A5E" stroke-width="2.5"/>' +
      '<path d="M26 51Q32 47 38 51Q36 54 32 54Q28 54 26 51Z" fill="#FF9DB3" stroke="none"/>' +
      '<path d="M14 33C8 32 4 36 5 40C6 44 12 42 14 36.5ZM50 33C56 32 60 36 59 40C58 44 52 42 50 36.5Z" fill="#B2D9FF" stroke-width="2.2"/>',
  ),
  // freezing
  '🥶': W(
    '<circle cx="32" cy="31" r="25" fill="#B2D9FF"/>' +
      '<path d="M10 20Q20 5 32 6Q44 5 54 20Q50 22 47 19Q44 23 40 18Q36 22 32 17Q28 22 24 18Q20 23 17 19Q14 22 10 20Z" fill="#fff" stroke-width="2.5"/>' +
      '<path d="M23 54L26 61L29 55.5M35 55.5L38 60.5L41 54" fill="#fff" stroke-width="2.2"/>' +
      '<path d="M16 26L24 24M48 26L40 24" stroke-width="2.5"/>' +
      DOT(22, 31, 3.2) +
      DOT(42, 31, 3.2) +
      '<rect x="21" y="39" width="22" height="9" rx="3" fill="#fff" stroke-width="2.5"/>' +
      '<path d="M28.3 39V48M35.7 39V48M21 43.5H43" stroke-width="2"/>' +
      '<g fill="#FF9DB3" stroke="none" opacity=".55"><ellipse cx="14" cy="38" rx="4.5" ry="2.8"/><ellipse cx="50" cy="38" rx="4.5" ry="2.8"/></g>',
  ),
  // pleading eyes
  '🥺': W(
    FACE() +
      BLUSH('.6', 41) +
      '<path d="M14 24Q19 23 25 18.5M50 24Q45 23 39 18.5" stroke-width="2.5"/>' +
      DOT(22, 32, 7) +
      DOT(42, 32, 7) +
      '<g fill="#fff" stroke="none"><circle cx="24.5" cy="29.5" r="2.8"/><circle cx="44.5" cy="29.5" r="2.8"/><circle cx="19.5" cy="35" r="1.3"/><circle cx="39.5" cy="35" r="1.3"/></g>' +
      '<path d="M27 48Q32 44 37 48" stroke-width="2.5"/>',
  ),
  // smiling with blush
  '😊': W(
    FACE() +
      BLUSH('.8', 40) +
      '<path d="M17 32Q22 25.5 27 32M37 32Q42 25.5 47 32" stroke-width="3"/>' +
      '<path d="M23 42Q32 51 41 42" stroke-width="3"/>',
  ),
  // holding back tears
  '🥹': W(
    FACE() +
      BLUSH('.6', 42) +
      '<path d="M14 23Q19 22 25 18M50 23Q45 22 39 18" stroke-width="2.5"/>' +
      DOT(22, 31, 6.5) +
      DOT(42, 31, 6.5) +
      '<path d="M16 33Q22 40 28 33Q22 36.5 16 33ZM36 33Q42 40 48 33Q42 36.5 36 33Z" fill="#B2D9FF" stroke="none"/>' +
      '<path d="M14.5 36.5Q12 41 14.5 42Q17 41 14.5 36.5ZM49.5 36.5Q47 41 49.5 42Q52 41 49.5 36.5Z" fill="#B2D9FF" stroke-width="1.8"/>' +
      '<g fill="#fff" stroke="none"><circle cx="24.5" cy="28.5" r="2.6"/><circle cx="44.5" cy="28.5" r="2.6"/><circle cx="19.5" cy="31" r="1.1"/><circle cx="39.5" cy="31" r="1.1"/></g>' +
      '<path d="M25 46Q32 51 39 46" stroke-width="2.5"/>',
  ),
  // thinking
  '🤔': W(
    '<circle cx="32" cy="30" r="26" fill="#FFE9A8"/>' +
      HL(20, 16) +
      '<path d="M16 21Q21 16 27 19M38 23L46 22.5" stroke-width="2.5"/>' +
      DOT(22, 28) +
      DOT(42, 29) +
      '<path d="M28 41Q33 38.5 39 40" stroke-width="2.5"/>' +
      '<g fill="#FF9DB3" stroke="none" opacity=".6"><ellipse cx="49" cy="37" rx="5" ry="3"/></g>' +
      '<path d="M22 49L30 42" stroke-width="9.5"/>' +
      '<path d="M22 49L30 42" stroke="#FFD6B8" stroke-width="4"/>' +
      '<path d="M10 51Q10 45 16 45H23Q28 45 28 50V54Q28 59 22 59H16Q10 59 10 54Z" fill="#FFD6B8"/>' +
      '<path d="M15 49V54.5M20 49V54.5" stroke-width="2"/>',
  ),
  // winking
  '😉': W(
    FACE() +
      BLUSH() +
      DOT(23, 30) +
      '<path d="M36 31Q41 25 46 31" stroke-width="3"/>' +
      '<path d="M23 41Q32 50 41 41" stroke-width="3"/>' +
      '<path d="M56 6Q57 10 60 11Q57 12 56 16Q55 12 52 11Q55 10 56 6Z" fill="#F5C26B" stroke-width="1.8"/>',
  ),
  // relaxed smile (closed serene eyes)
  '☺': W(
    FACE('#FFD6B8') +
      BLUSH('.75', 40) +
      '<path d="M16 30Q21.5 36 27 30M37 30Q42.5 36 48 30" stroke-width="3"/>' +
      '<path d="M27 43Q32 47.5 37 43" stroke-width="3"/>',
  ),
  // eyes (looking to the side)
  '👀': W(
    '<g fill="#fff"><ellipse cx="20" cy="32" rx="11.5" ry="16"/><ellipse cx="44" cy="32" rx="11.5" ry="16"/></g>' +
      DOT(15, 35, 6.5) +
      DOT(39, 35, 6.5) +
      '<g fill="#fff" stroke="none"><circle cx="17" cy="32" r="2.2"/><circle cx="41" cy="32" r="2.2"/></g>',
  ),
};
