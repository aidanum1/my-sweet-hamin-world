// Scoped styles for the rhythm mini-game (.rh …). Injected once; keeps src/ui/styles.css untouched.
// Lane geometry constants must match TX_* in RhythmGame.ts (dance target at 58px, vocal at 50px).

/** Chunky rounded arrow (points up; rotated per direction with CSS). */
export const ARROW_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6 20.4 12.4H15.4V20.4H8.6V12.4H3.6Z" fill="currentColor" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round"/></svg>';

let styled = false;
export function injectStyle() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.id = 'rhythm-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}

const CSS = `
.rh { --acc: var(--pink-deep); --acc2: var(--blue); --accDeep: #ff7a93;
  --cL: #ff8fab; --fL: #ffe3ea; --gL: #ff6f91; --cR: #7fb7f5; --fR: #e3f0ff; --gR: #4f95e6;
  --cU: #f5c451; --fU: #fff4cc; --gU: #e3a21f; --cD: #5fcf9f; --fD: #dcf7ea; --gD: #34b67e;
  --r0: #ff8fab; --r0f: #ffe3ea; --r1: #a98be8; --r1f: #efe6ff; --r2: #7fb7f5; --r2f: #e3f0ff; }
.rh-vocal { --acc: #cdb8f5; --acc2: var(--pink); --accDeep: #a98be8; }
.rh-tapzone { position: absolute; inset: 0; touch-action: none; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
.rh-top { z-index: 2; align-items: center !important; }
.rh-pills { display: flex; gap: 8px; align-items: center; }
.rh-pills .mg-pill { min-width: 64px; text-align: center; box-shadow: 0 3px 0 var(--acc); }
.rh-pills .mg-pill b { font-size: 20px; }
.rh-dpill { font-size: 13px !important; padding: 7px 10px !important; min-width: 0 !important; }
.rh-quit { min-height: 36px; width: 40px; padding: 0; }

/* fever gauge */
.rh-fever { display: flex; align-items: center; gap: 6px; background: #fff; border-radius: 16px; padding: 6px 10px; box-shadow: 0 3px 0 #f5c451; position: relative; }
.rh-flabel { font-size: 12px; font-weight: 900; color: #e3a21f; letter-spacing: .3px; white-space: nowrap; }
.rh-fg { width: min(24cqw, 170px); height: 14px; border-radius: 99px; background: #fff4cc; overflow: hidden; position: relative; box-shadow: inset 0 2px 0 rgba(0,0,0,.05); }
.rh-fg i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; border-radius: 99px; background: linear-gradient(90deg, #ffe28a, #ffb3c4, #c9b3ff); transition: width .15s; }
.rh-fever.hot .rh-fg i { animation: rhGlint .6s ease-in-out infinite alternate; }
.rh-x2 { display: none; font-size: 15px; color: #fff; background: linear-gradient(135deg, #ff9db3, #c9b3ff); border-radius: 10px; padding: 1px 7px; }
.rh-fever.on { background: linear-gradient(90deg, #ffe3ea, #fff4cc, #dcf7ea, #e3f0ff, #efe6ff, #ffe3ea); background-size: 300% 100%; animation: rhRainbow 2s linear infinite; box-shadow: 0 3px 0 #ff9db3, 0 0 18px rgba(255,190,215,.9); }
.rh-fever.on .rh-x2 { display: inline-block; animation: rhBump .45s var(--bounce) infinite alternate; }
.rh-fever.on .rh-fg { background: rgba(255,255,255,.7); }
.rh-fever.on .rh-fg i { transition: none; background: linear-gradient(90deg, #ff9db3, #ffd66b, #7fdcb3, #7fb7f5, #c9b3ff); }
@keyframes rhGlint { from { filter: brightness(1) } to { filter: brightness(1.25) saturate(1.3) } }
@keyframes rhRainbow { from { background-position: 0% 0 } to { background-position: 300% 0 } }

/* lane */
.rh-wrap { position: absolute; left: calc(14px + var(--sal)); right: calc(14px + var(--sar)); bottom: calc(16px + var(--sab)); height: 92px; pointer-events: none !important; z-index: 1; }
.rh-vocal .rh-wrap { height: 150px; }
.rh-lane { position: absolute; inset: 0; border-radius: 999px; background: linear-gradient(180deg, rgba(255,255,255,.95), rgba(255,246,232,.92));
  border: 4px solid #fff; box-shadow: 0 5px 0 var(--acc), 0 12px 26px rgba(160,150,210,.3); overflow: hidden; transition: box-shadow .3s; }
.rh-vocal .rh-lane { border-radius: 30px; }
.rh-dance .rh-lane::before { content: ''; position: absolute; left: 58px; right: 26px; top: 50%; border-top: 4px dotted var(--acc2); transform: translateY(-2px); opacity: .9; }
.rh-lane::after { content: ''; position: absolute; inset: 0; opacity: 0; pointer-events: none; transition: opacity .4s;
  background-image: radial-gradient(circle, #fff 0 2px, transparent 3px), radial-gradient(circle, #fff 0 1.5px, transparent 2.5px);
  background-size: 46px 30px, 70px 44px; background-position: 0 6px, 20px 22px; animation: rhDrift 1.6s linear infinite; }
.rh.fever .rh-lane { background: linear-gradient(90deg, #ffe3ea, #fff4cc, #dcf7ea, #e3f0ff, #efe6ff, #ffe3ea); background-size: 300% 100%; animation: rhRainbow 3s linear infinite;
  box-shadow: 0 5px 0 #ff9db3, 0 0 0 4px rgba(255,255,255,.6), 0 0 28px rgba(255,170,205,.85); }
.rh.fever .rh-lane::after { opacity: .9; }
@keyframes rhDrift { from { background-position: 0 6px, 20px 22px } to { background-position: -46px 6px, -50px 22px } }
.rh-prog { position: absolute; left: 0; right: 0; top: 0; height: 4px; background: rgba(0,0,0,.03); z-index: 2; }
.rh-prog i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: linear-gradient(90deg, var(--acc2), var(--accDeep)); border-radius: 0 4px 4px 0; }
.rh-tick { position: absolute; top: 16%; bottom: 16%; left: 0; width: 3px; margin-left: -1.5px; border-radius: 3px; background: var(--acc2); opacity: .5; }
.rh-tick.bar { width: 5px; margin-left: -2.5px; opacity: .8; }
.rh-vocal .rh-tick { top: 6px; bottom: 6px; opacity: .35; }
.rh-row { position: absolute; left: 0; right: 0; height: 33.34%; }
.rh-row::before { content: ''; position: absolute; left: 50px; right: 20px; top: 50%; border-top: 3px dotted var(--rc); opacity: .75; transform: translateY(-1.5px); }
.rh-row.r0 { top: 0; --rc: var(--r0); background: linear-gradient(90deg, rgba(255,227,234,.7), rgba(255,227,234,0) 70%); }
.rh-row.r1 { top: 33.33%; --rc: var(--r1); }
.rh-row.r2 { top: 66.66%; --rc: var(--r2); background: linear-gradient(90deg, rgba(227,240,255,.8), rgba(227,240,255,0) 70%); }
.rh-row kbd { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font: 800 11px Nunito, sans-serif; color: var(--ink-soft); background: #fff; border-radius: 6px; padding: 0 6px; box-shadow: 0 2px 0 var(--rc); opacity: .85; }
.rh-row.press { background: linear-gradient(90deg, rgba(255,255,255,.95), rgba(255,255,255,0) 60%); }
.rh-flash { position: absolute; left: 58px; top: 50%; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%; opacity: 0; pointer-events: none;
  background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,204,213,.8) 40%, rgba(255,204,213,0) 70%); }
.rh-flash.good { background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(178,217,255,.8) 40%, rgba(178,217,255,0) 70%); }
.rh-flash.go { animation: rhFlash .35s ease-out; }
.rh-vocal .rh-flash { left: 50px; width: 90px; height: 90px; margin: -45px 0 0 -45px; }
@keyframes rhFlash { 0% { opacity: 1; transform: scale(.5) } 100% { opacity: 0; transform: scale(1.3) } }
.rh-target { position: absolute; left: 58px; top: 50%; width: 70px; height: 70px; margin: -35px 0 0 -35px; border-radius: 50%;
  background: #fff; border: 4px dashed var(--acc); display: grid; place-items: center; transform: scale(var(--s, 1)); box-shadow: 0 0 0 6px rgba(255,255,255,.7); box-sizing: border-box; }
.rh-target span { font-size: 38px; line-height: 1; color: var(--accDeep); margin-top: 2px; }
.rh-vocal .rh-target { left: 50px; width: 40px; height: 40px; margin: -20px 0 0 -20px; border-width: 3px; box-shadow: 0 0 0 4px rgba(255,255,255,.7); }
.rh-vocal .rh-target span { font-size: 22px; }
.rh-target.r0 { border-color: var(--r0); } .rh-target.r0 span { color: var(--r0); }
.rh-target.r1 { border-color: var(--r1); } .rh-target.r1 span { color: var(--r1); }
.rh-target.r2 { border-color: var(--r2); } .rh-target.r2 span { color: var(--r2); }
.rh-target.wiggle span { animation: rhWig .25s; }
.rh-target.lit { background: #fff4f7; box-shadow: 0 0 0 6px rgba(255,255,255,.9), 0 0 16px 4px rgba(255,190,215,.8); }
@keyframes rhWig { 0%,100% { transform: rotate(0) } 30% { transform: rotate(-14deg) } 70% { transform: rotate(10deg) } }

/* notes */
.rh-note { position: absolute; left: 0; top: 50%; width: 58px; height: 58px; margin: -29px 0 0 -29px; will-change: transform; pointer-events: none; }
.rh-hd { position: absolute; inset: 0; border-radius: 50%; background: #fff; border: 4px solid var(--pink-deep); box-shadow: 0 4px 0 rgba(255,157,179,.45);
  display: grid; place-items: center; box-sizing: border-box; font-weight: 900; }
.rh-hd span { font-size: 30px; line-height: 1; color: var(--strawberry); margin-top: 2px; }
.rh-hd svg { width: 34px; height: 34px; }
.rh-note.k-L .rh-hd { border-color: var(--cL); background: var(--fL); color: var(--gL); box-shadow: 0 4px 0 rgba(255,143,171,.45); }
.rh-note.k-R .rh-hd { border-color: var(--cR); background: var(--fR); color: var(--gR); box-shadow: 0 4px 0 rgba(127,183,245,.45); }
.rh-note.k-U .rh-hd { border-color: var(--cU); background: var(--fU); color: var(--gU); box-shadow: 0 4px 0 rgba(245,196,81,.5); }
.rh-note.k-D .rh-hd { border-color: var(--cD); background: var(--fD); color: var(--gD); box-shadow: 0 4px 0 rgba(95,207,159,.45); }
.k-L svg { rotate: -90deg; } .k-R svg { rotate: 90deg; } .k-D svg { rotate: 180deg; }
.rh-note.off .rh-hd { transform: scale(.84); }
.rh-note.finale { width: 76px; height: 76px; margin: -38px 0 0 -38px; }
.rh-note.finale .rh-hd { border: 5px solid #fff; background: linear-gradient(135deg, #ffccd5, #fff4cc, #dcf7ea, #e3f0ff, #efe6ff); box-shadow: 0 0 0 4px #ff9db3, 0 6px 14px rgba(255,122,147,.45);
  animation: rhFin .5s ease-in-out infinite alternate; }
.rh-note.finale .rh-hd span { font-size: 40px; }
@keyframes rhFin { from { filter: brightness(1) } to { filter: brightness(1.12) } }
.rh-vocal .rh-note { top: 0; width: 40px; height: 40px; margin: -20px 0 0 -20px; }
.rh-vocal .rh-hd { border-width: 3px; }
.rh-vocal .rh-hd span { font-size: 22px; margin-top: 0; }
.rh-note.r0 .rh-hd { border-color: var(--r0); background: var(--r0f); box-shadow: 0 3px 0 rgba(255,143,171,.45); } .rh-note.r0 .rh-hd span { color: #ff6f91; }
.rh-note.r1 .rh-hd { border-color: var(--r1); background: var(--r1f); box-shadow: 0 3px 0 rgba(169,139,232,.45); } .rh-note.r1 .rh-hd span { color: #8f6cdc; }
.rh-note.r2 .rh-hd { border-color: var(--r2); background: var(--r2f); box-shadow: 0 3px 0 rgba(127,183,245,.45); } .rh-note.r2 .rh-hd span { color: #4f95e6; }
.rh-bar { position: absolute; left: 50%; top: 50%; height: 24px; margin-top: -12px; width: 0; border-radius: 0 99px 99px 0; border: 3px solid #fff; border-left: 0; box-sizing: border-box;
  background: repeating-linear-gradient(135deg, var(--bc) 0 10px, var(--bc2) 10px 20px); box-shadow: 0 3px 0 rgba(160,150,210,.25); }
.rh-note.r0 .rh-bar { --bc: #ffc2d1; --bc2: #ffd6e0; } .rh-note.r1 .rh-bar { --bc: #d9c8fa; --bc2: #e7dcfc; } .rh-note.r2 .rh-bar { --bc: #bcdcff; --bc2: #d2e7ff; }
.rh-note.holding .rh-bar { animation: rhStripe .5s linear infinite; filter: brightness(1.08) saturate(1.3); box-shadow: 0 0 12px 2px rgba(255,255,255,.95); }
.rh-note.holding .rh-hd { animation: rhPulse .25s ease-in-out infinite alternate; box-shadow: 0 0 0 4px #fff, 0 0 16px 4px rgba(255,190,215,.9); }
@keyframes rhStripe { from { background-position: 0 0 } to { background-position: 28px 0 } }
@keyframes rhPulse { from { transform: scale(1) } to { transform: scale(1.15) } }
.rh-note.hit .rh-hd { animation: rhHit .38s ease-out forwards; }
.rh-note.hit .rh-bar { opacity: 0; }
.rh-note.missed { opacity: .4; filter: grayscale(1); transition: opacity .3s; }
@keyframes rhHit { 0% { scale: 1 } 40% { scale: 1.45; opacity: 1 } 100% { scale: 1.9; opacity: 0 } }

/* hit sparks / swipe ghost */
.rh-spark { position: absolute; left: 0; top: 0; font-size: 16px; line-height: 1; color: var(--c, #ff7a93); pointer-events: none; text-shadow: 0 0 6px #fff;
  animation: rhSpark .55s cubic-bezier(.2,.8,.3,1) forwards; }
@keyframes rhSpark { 0% { transform: translate(-50%, -50%) scale(1.1); opacity: 1 } 100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.3) rotate(var(--r)); opacity: 0 } }
.rh-ghost { position: absolute; left: 58px; top: 50%; width: 64px; height: 64px; margin: -32px 0 0 -32px; color: var(--gc, #ff7a93); opacity: 0; pointer-events: none;
  animation: rhGhost .38s ease-out forwards; }
.rh-ghost svg { width: 100%; height: 100%; filter: drop-shadow(0 0 4px #fff); }
@keyframes rhGhost { 0% { opacity: .9; transform: translate(0,0) scale(.8) } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1.35) } }

/* judge / combo / count-in / fever overlays */
.rh-judge { position: absolute; left: -16px; width: 220px; bottom: calc(100% - 46px); height: 150px; pointer-events: none; }
.rh-vocal .rh-judge { left: -24px; bottom: calc(100% - 40px); }
.rh-judge .judge { font-size: 26px; white-space: nowrap; }
.rh-judge .judge.small { font-size: 20px; }
.rh-combo { position: absolute; left: 196px; bottom: calc(100% + 2px); font-size: 34px; font-weight: 900; color: #fff; opacity: 0; transition: opacity .2s; white-space: nowrap;
  text-shadow: 0 3px 0 var(--accDeep), 0 0 12px rgba(255,255,255,.9); -webkit-text-stroke: 1px var(--accDeep); }
.rh-combo small { font-size: 14px; margin-left: 6px; -webkit-text-stroke: 0; color: var(--accDeep); text-shadow: 0 2px 0 #fff; }
.rh-combo.on { opacity: 1; }
.rh-combo.bump { animation: rhBump .25s var(--bounce); }
@keyframes rhBump { 0% { transform: scale(1.35) } 100% { transform: scale(1) } }
.rh-count { font-size: 80px !important; }
.rh-ready { animation: rhReady .45s var(--bounce) both; }
@keyframes rhReady { from { transform: translate(-50%, -50%) scale(.3); opacity: 0 } to { transform: translate(-50%, -50%) scale(1); opacity: 1 } }
.rh-count.word { font-size: 56px !important; }
.rh-fevertext { position: absolute; left: 50%; top: 34%; transform: translate(-50%, -50%); font-size: 48px; font-weight: 900; white-space: nowrap; pointer-events: none; color: #fff;
  -webkit-text-stroke: 2px #fff; text-shadow: 0 4px 0 #ff9db3, 0 8px 0 #c9b3ff, 0 12px 24px rgba(200,120,200,.45); animation: rhFeverIn 1.4s var(--bounce) forwards; z-index: 3; }
@keyframes rhFeverIn { 0% { transform: translate(-50%, -50%) scale(.2) rotate(-8deg); opacity: 0 } 25% { transform: translate(-50%, -50%) scale(1.15) rotate(3deg); opacity: 1 }
  75% { transform: translate(-50%, -50%) scale(1) rotate(0); opacity: 1 } 100% { transform: translate(-50%, -80%) scale(.9); opacity: 0 } }
.rh-edge { position: absolute; inset: 0; pointer-events: none !important; opacity: 0; z-index: 0;
  box-shadow: inset 0 0 70px 14px rgba(255,170,205,.6), inset 0 0 0 5px rgba(255,255,255,.6); border-radius: 0; }

/* intro card */
.rh-card { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(92cqw, 440px); max-height: 94cqh; overflow: auto;
  padding: 16px 20px 18px; text-align: center; animation: popIn .35s var(--bounce); z-index: 3; }
.rh-card.out { opacity: 0; transform: translate(-50%, -46%) scale(.95); transition: all .2s; }
.rh-head { display: flex; align-items: center; justify-content: center; gap: 8px; }
.rh-card h2 { margin: 2px 0 4px; font-size: 26px; }
.rh-card p { margin: 6px 0; font-size: 14px; line-height: 1.4; }
.rh-emoji { font-size: 36px; line-height: 1; animation: hop 1s ease-in-out infinite; display: inline-block; }
.rh-keys { color: var(--ink-soft); font-size: 13px !important; }
.rh-card kbd { display: inline-block; padding: 1px 7px; margin: 0 2px; border-radius: 7px; background: #fff; box-shadow: 0 2px 0 var(--pink); font: inherit; color: var(--ink); }
.rh-small { color: var(--ink-soft); font-size: 12.5px !important; }
.rh-btns { display: flex; flex-direction: row; justify-content: center; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.rh-btns .primary { min-width: 170px; }
.rh-diffs { display: flex; gap: 8px; justify-content: center; margin: 8px 0 2px; }
.rh-diff { flex: 1; max-width: 128px; background: #fff; border-radius: 16px; padding: 7px 4px 6px; box-shadow: 0 3px 0 #e6def5; display: flex; flex-direction: column; align-items: center; gap: 1px;
  transition: transform .15s var(--bounce), box-shadow .15s; color: var(--ink); border: 3px solid transparent; }
.rh-diff i { font-style: normal; font-size: 20px; line-height: 1.1; }
.rh-diff b { font-size: 15px; }
.rh-diff small { font-size: 11px; color: var(--ink-soft); white-space: nowrap; }
.rh-diff.sel { border-color: var(--pink-deep); box-shadow: 0 4px 0 var(--pink-deep), 0 6px 14px rgba(255,122,147,.25); transform: translateY(-2px) scale(1.04); background: #fff7f9; }
.rh-diff[data-d="easy"].sel { border-color: #7fdcb3; box-shadow: 0 4px 0 #7fdcb3, 0 6px 14px rgba(111,211,168,.3); background: #f4fcf8; }
.rh-diff[data-d="hard"].sel { border-color: #ffb36b; box-shadow: 0 4px 0 #ffb36b, 0 6px 14px rgba(255,160,90,.3); background: #fff8f0; }
.rh-diffnote { min-height: 2.6em; color: var(--ink); font-size: 13px !important; }
/* dance move chips */
.rh-moves { display: flex; justify-content: center; gap: 6px; margin: 6px 0 2px; }
.rh-mv { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 58px; }
.rh-mv .rh-note { position: relative; left: auto; top: auto; margin: 0; width: 44px; height: 44px; animation: rhChip 2.5s ease-in-out infinite; animation-delay: calc(var(--i) * .25s); }
.rh-mv .rh-hd svg { width: 26px; height: 26px; }
.rh-mv .rh-hd span { font-size: 22px; }
.rh-mv small { font-size: 11px; color: var(--ink-soft); white-space: nowrap; }
@keyframes rhChip { 0%, 30%, 100% { transform: translateY(0) } 10% { transform: translateY(-7px) scale(1.08) } }
/* vocal mini staff demo */
.rh-vdemo { position: relative; height: 78px; margin: 6px auto 2px; width: min(100%, 300px); border-radius: 18px; background: #fff; box-shadow: 0 3px 0 var(--acc); overflow: hidden; }
.rh-vdemo .rh-row::before { left: 30px; right: 10px; }
.rh-vdemo .rh-row kbd { right: 6px; font-size: 10px; }
.rh-vd-t { position: absolute; left: 20px; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; border: 2px dashed var(--rc); background: #fff; display: grid; place-items: center;
  font-style: normal; font-size: 13px; color: var(--rc); box-sizing: border-box; }
.rh-vd-n { position: absolute; left: 0; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; border: 2px solid var(--rc); background: #fff; display: grid; place-items: center;
  font-style: normal; font-size: 13px; color: var(--rc); box-sizing: border-box; animation: rhVd 3s linear infinite; }
.rh-vd-n.hold::after { content: ''; position: absolute; left: 50%; top: 50%; width: 70px; height: 12px; margin-top: -6px; border-radius: 0 99px 99px 0; background: var(--rf); z-index: -1; }
.rh-vd-n.hold { z-index: 1; animation-name: rhVdHold; }
@keyframes rhVd { 0% { transform: translateX(310px) } 55% { transform: translateX(20px); scale: 1; opacity: 1 } 62% { transform: translateX(20px); scale: 1.6; opacity: 0 } 100% { transform: translateX(20px); opacity: 0 } }
@keyframes rhVdHold { 0% { transform: translateX(310px) } 45% { transform: translateX(20px); scale: 1 } 70% { transform: translateX(20px); scale: 1.2 } 76% { transform: translateX(20px); scale: 1.6; opacity: 0 } 100% { opacity: 0; transform: translateX(20px) } }
.rh-vdemo .r0 { --rc: var(--r0); --rf: #ffc2d1; } .rh-vdemo .r1 { --rc: var(--r1); --rf: #d9c8fa; } .rh-vdemo .r2 { --rc: var(--r2); --rf: #bcdcff; }

/* landscape phones & short windows */
@container (max-height: 520px) {
  .rh-res { padding: 8px 14px 10px !important; }
  .rh-res .big-emoji { font-size: 34px !important; }
  .rh-res h2 { font-size: 21px !important; margin: 2px 0 !important; }
  .rh-res .stats { margin: 6px 0 !important; gap: 8px !important; }
  .rh-res .stat { padding: 4px 10px !important; min-width: 70px !important; }
  .rh-res .stat b { font-size: 18px !important; }
  .rh-res .reward { font-size: 17px !important; margin: 2px 0 4px !important; }
  .rh-res .note { margin: 2px 0 8px !important; }
  .rh-res .btns .candy { min-height: 40px; padding-top: 6px; padding-bottom: 6px; }
}
@container (max-height: 520px) {
  .rh-card { padding: 10px 16px 12px; }
  .rh-emoji { font-size: 26px; }
  .rh-card h2 { font-size: 21px; margin: 0; }
  .rh-card p { margin: 3px 0; font-size: 13px; }
  .rh-btns { margin-top: 6px; }
  .rh-btns .candy { min-height: 40px; padding-top: 6px; padding-bottom: 6px; }
  .rh-btns .primary { min-width: 140px; }
  .rh-diff { padding: 4px 4px 4px; }
  .rh-diff i { font-size: 16px; }
  .rh-diffnote { min-height: 0; }
}
@container (max-height: 520px) and (min-width: 600px) {
  .rh-card { width: min(94cqw, 660px); display: grid; grid-template-columns: 1.05fr 1fr; gap: 4px 16px; align-items: center; text-align: center; }
}
@container (max-height: 460px) {
  .rh-wrap { height: 80px; bottom: calc(10px + var(--sab)); }
  .rh-vocal .rh-wrap { height: 126px; }
  .rh-dance .rh-lane .rh-note:not(.finale) { width: 50px; height: 50px; margin: -25px 0 0 -25px; }
  .rh-dance .rh-lane .rh-hd svg { width: 28px; height: 28px; }
  .rh-target { width: 62px; height: 62px; margin: -31px 0 0 -31px; }
  .rh-vocal .rh-target { width: 34px; height: 34px; margin: -17px 0 0 -17px; }
  .rh-vocal .rh-note { width: 34px; height: 34px; margin: -17px 0 0 -17px; }
  .rh-vocal .rh-hd span { font-size: 18px; }
  .rh-bar { height: 20px; margin-top: -10px; }
  .rh-combo { font-size: 28px; }
  .rh-judge .judge { font-size: 22px; }
  .rh-fevertext { font-size: 38px; top: 30%; }
  .rh-count { font-size: 64px !important; top: 36% !important; }
  .rh-count.word { font-size: 44px !important; }
  .rh-pills .mg-pill { min-width: 54px; padding: 4px 10px; }
  .rh-pills .mg-pill b { font-size: 17px; }
  .rh-dpill { display: none; }
}
`;
