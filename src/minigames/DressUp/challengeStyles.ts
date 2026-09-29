// Styles for the ✨ Fashion Challenge (kept next to the mini-game; injected once on first use).
const CSS = `
.dc-chal-btn { min-height: 44px; padding: 6px 14px; font-size: 15px; white-space: nowrap; animation: dcWiggle 3s ease-in-out infinite; }
@keyframes dcWiggle { 0%, 84%, 100% { transform: none } 88% { transform: rotate(-5deg) scale(1.06) } 92% { transform: rotate(5deg) scale(1.06) } 96% { transform: rotate(-2deg) } }

.dc-portrait { width: 40px; height: 40px; flex: none; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, var(--pink-soft)); display: grid; place-items: center;
  font-size: 24px; box-shadow: 0 0 0 3px #fff, 0 3px 0 3px var(--pink); }
.dc-portrait.big { width: 54px; height: 54px; font-size: 32px; }

/* timer card */
.dc-hud { position: absolute; top: calc(10px + var(--sat)); left: calc(72px + var(--sal)); width: min(360px, calc(100cqw - 200px)); padding: 8px 12px 10px;
  display: flex; flex-direction: column; gap: 6px; animation: dcDrop .5s var(--bounce); }
@keyframes dcDrop { from { transform: translateY(-30px) scale(.9); opacity: 0 } }
.dc-hud-top { display: flex; align-items: center; gap: 10px; }
.dc-hud-t { flex: 1; min-width: 0; line-height: 1.2; }
.dc-hud-t small { display: block; font-size: 11px; color: var(--ink-soft); }
.dc-hud-t b { display: block; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dc-timer { flex: none; min-width: 66px; text-align: center; font-size: 22px; font-weight: 900; background: #fff; border-radius: 14px; padding: 2px 8px;
  box-shadow: 0 3px 0 var(--blue); font-variant-numeric: tabular-nums; }
.dc-timer.hurry { color: var(--strawberry); box-shadow: 0 3px 0 var(--pink-deep); animation: pulse .5s ease-in-out infinite; }
.dc-hud-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-soft); line-height: 1.2; }
.dc-swatches { display: flex; gap: 3px; flex: none; }
.dc-swatches i { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 1px 2px rgba(120, 100, 160, .25); }
.dc-hud .meter { width: 100%; height: 10px; }
.dc-hud .meter i { transition: width .25s linear; }
.dc-hud.hurry .meter i { background: linear-gradient(90deg, var(--pink-deep), var(--strawberry)); }

/* wardrobe tweaks during a round */
.wd-card .price.dc-rent { background: var(--mint); color: var(--ink); }
.dc-rack { grid-column: 1 / -1; font-size: 11px; line-height: 1.3; color: var(--ink); background: var(--mint); border-radius: 99px; padding: 2px 10px; text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dc-submit { animation: pulse 1.4s ease-in-out infinite; }

/* camera flash */
.dc-flash { position: absolute; inset: 0; background: #fff; pointer-events: none !important; animation: dcFlash .5s ease-out forwards; }
@keyframes dcFlash { 0% { opacity: .9 } 100% { opacity: 0 } }

/* verdict card */
.dc-verdict { position: absolute; left: 50%; bottom: calc(10px + var(--sab)); transform: translateX(-50%); width: min(96cqw, 520px); max-height: 62cqh;
  display: flex; flex-direction: column; gap: 8px; padding: 12px 14px 14px; overflow-y: auto; animation: dcPop .45s var(--bounce); }
@container (orientation: landscape) {
  /* the wardrobe panel fills the right side: keep Coco's theme card in the free space on the left */
  .dc-hud { width: min(360px, calc(100cqw - min(52cqw, 470px) - 100px)); }
  .dc-verdict { left: auto; transform: none; right: calc(14px + var(--sar)); top: calc(14px + var(--sat)); bottom: calc(14px + var(--sab)); width: min(50cqw, 430px); max-height: none; }
}
@keyframes dcPop { from { opacity: 0; scale: .85 } }
.dc-v-head { display: flex; align-items: center; gap: 12px; }
.dc-v-head small { display: block; font-size: 12px; color: var(--ink-soft); }
.dc-v-head h2 { margin: 0; font-size: 22px; line-height: 1.15; }
.dc-stars { display: flex; justify-content: center; gap: 6px; padding: 2px 0; }
.dc-stars i { font-style: normal; font-size: 40px; line-height: 1; color: #ece6f5; text-shadow: 0 3px 0 #fff; }
.dc-stars i.on { color: #ffd36e; text-shadow: 0 3px 0 #f2b640, 0 0 14px rgba(255, 211, 110, .85); animation: dcStar .55s var(--bounce); }
@keyframes dcStar { 0% { transform: scale(0) rotate(-50deg) } 65% { transform: scale(1.35) rotate(10deg) } 100% { transform: none } }
.dc-reasons { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.dc-reasons li { display: flex; gap: 8px; align-items: center; background: #fff; border-radius: 14px; padding: 5px 10px; font-size: 14px; line-height: 1.25;
  box-shadow: 0 2px 0 var(--lavender); animation: dcIn .4s var(--bounce) both; }
.dc-reasons li.good { box-shadow: 0 2px 0 var(--mint); }
.dc-reasons li.bad { box-shadow: 0 2px 0 var(--pink); }
.dc-reasons li > span:first-child { font-size: 18px; flex: none; }
@keyframes dcIn { from { opacity: 0; transform: translateX(16px) } }
.dc-reward { text-align: center; font-size: 20px; color: var(--strawberry); animation: dcIn .4s var(--bounce) both; }
.dc-extras { display: flex; flex-wrap: wrap; gap: 4px 6px; justify-content: center; }
.dc-extras span { background: var(--butter); border-radius: 99px; padding: 3px 10px; font-size: 13px; box-shadow: 0 2px 0 #f5d67e; animation: dcIn .4s var(--bounce) both; }
.dc-btns { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: auto; padding: 6px 0 2px; animation: dcIn .4s var(--bounce) both;
  position: sticky; bottom: -14px; background: var(--paper); z-index: 1; }
.dc-btns .candy { flex: 1 1 auto; }
.dc-btns .candy.primary { flex-basis: 100%; }

/* challenge picker */
.dc-pick { display: flex; flex-direction: column; gap: 10px; padding: 0 16px 16px; }
.dc-intro { display: flex; align-items: center; gap: 12px; font-size: 14px; line-height: 1.35; }
.dc-daily { align-self: center; background: var(--butter); border-radius: 99px; padding: 4px 14px; font-size: 13px; box-shadow: 0 2px 0 #f5d67e; }
.dc-daily.done { background: #fff; box-shadow: 0 2px 0 var(--lavender); color: var(--ink-soft); }
.dc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.dc-theme { position: relative; background: #fff; border-radius: 18px; padding: 10px 8px 8px; display: flex; flex-direction: column; align-items: center; gap: 2px;
  box-shadow: 0 3px 0 var(--lavender); transition: transform .15s var(--bounce); }
.dc-theme:hover { transform: translateY(-2px); }
.dc-theme:active { transform: scale(.95); }
.dc-theme .e { font-size: 30px; line-height: 1.15; }
.dc-theme b { font-size: 13px; text-align: center; line-height: 1.2; }
.dc-theme .st { font-size: 15px; letter-spacing: 1px; color: #ece6f5; }
.dc-theme .st em { font-style: normal; color: #ffd36e; text-shadow: 0 1px 0 #f2b640; }
.dc-theme .new { position: absolute; top: -6px; right: -4px; background: var(--strawberry); color: #fff; border-radius: 99px; padding: 1px 7px; font-size: 10px; border: 2px solid #fff; }
.dc-theme.best { box-shadow: 0 0 0 3px #ffd36e, 0 3px 0 #f2b640; }
.dc-surprise { align-self: center; }

/* short landscape screens (phones): tighter verdict card — keep last so it wins */
@container (max-height: 460px) {
  .dc-verdict { gap: 5px; padding: 8px 10px 10px; }
  .dc-v-head h2 { font-size: 18px; }
  .dc-stars i { font-size: 30px; }
  .dc-reasons li { font-size: 12px; padding: 3px 8px; }
  .dc-reward { font-size: 17px; }
  .dc-btns { gap: 6px; }
  .dc-btns .candy { min-height: 34px; padding: 4px 10px; font-size: 13px; }
  .dc-btns .candy.small { flex: 1 1 0; min-width: 0; padding: 4px 6px; font-size: 12px; line-height: 1.15; }
}
`;

/** Adds (or refreshes, for hot reload) the challenge stylesheet. */
export function injectChallengeStyles() {
  let s = document.getElementById('dc-styles') as HTMLStyleElement | null;
  if (!s) {
    s = document.createElement('style');
    s.id = 'dc-styles';
    document.head.appendChild(s);
  }
  if (s.textContent !== CSS) s.textContent = CSS;
}
