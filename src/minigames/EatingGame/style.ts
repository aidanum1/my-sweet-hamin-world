// Scoped styles for the Eating Game HUD (injected once; everything lives under .eat-mg).
const STYLE_ID = 'eat-mg-style';

const CSS = `
.eat-mg .eat-tap{position:absolute;inset:0;background:transparent;touch-action:none;-webkit-tap-highlight-color:transparent}
.eat-mg .mg-top{z-index:2}
.eat-mg .eat-meters{display:flex;flex-direction:column;gap:6px;align-items:flex-end}
.eat-mg .eat-meter-row{display:flex;align-items:center;gap:6px;background:#fff;border-radius:99px;padding:3px 8px 3px 6px;box-shadow:0 3px 0 var(--pink-deep,#ff9db3)}
.eat-mg .eat-meter-row .meter{width:min(30cqw,150px);height:14px;box-shadow:inset 0 2px 0 rgba(0,0,0,.06)}
.eat-mg .eat-meter-row span{font-size:16px;line-height:1}
.eat-mg .meter.fever i{background:linear-gradient(90deg,#ffe9a8,#ff9db3,#e6b2ff);animation:eatShine .5s linear infinite alternate}
.eat-mg .eat-score b{display:inline-block}
.eat-mg .eat-score.bump b{animation:eatScoreBump .22s ease-out}
.eat-mg .eat-timer{min-width:74px;text-align:center}
.eat-mg .eat-timer.low{color:#ff7a93;animation:eatPulseT .5s ease-in-out infinite alternate}
.eat-mg .judge{top:auto;left:68%;bottom:calc(38% + var(--sab,0px))}

/* combo */
.eat-mg .eat-combo{position:absolute;left:calc(14px + var(--sal,0px));top:calc(78px + var(--sat,0px));transform:rotate(-4deg);font-weight:900;font-size:26px;color:#ff7a93;
  text-shadow:0 3px 0 #fff,0 0 12px #fff;pointer-events:none;white-space:nowrap;transition:opacity .2s;transform-origin:20% 60%}
.eat-mg .eat-combo small{display:block;font-size:15px;color:#b48be0;margin:-2px 0 0 4px}
.eat-mg .eat-combo.bump{animation:eatBump .25s ease-out}
.eat-mg .eat-combo.t2{color:#ff5f8a;font-size:30px}
.eat-mg .eat-combo.t3{font-size:34px;background:linear-gradient(90deg,#ff7a93,#ffb347,#8fdcbc,#7fb7f5,#e6b2ff);-webkit-background-clip:text;background-clip:text;color:transparent;
  text-shadow:none;filter:drop-shadow(0 3px 0 #fff) drop-shadow(0 0 6px #fff)}
.eat-mg .eat-combo.t3 small{-webkit-text-fill-color:#b48be0}
.eat-mg .eat-combo.break{animation:eatBreak .45s ease-out forwards}

/* status pills (fever / slow-mo) */
.eat-mg .eat-status{position:absolute;left:50%;bottom:calc(62px + var(--sab,0px));transform:translateX(-50%);display:flex;gap:8px;pointer-events:none;z-index:2}
.eat-mg .eat-pill{position:relative;overflow:hidden;font-weight:900;font-size:17px;color:#fff;border-radius:99px;padding:4px 16px 7px;white-space:nowrap;animation:eatPillIn .35s cubic-bezier(.34,1.56,.64,1)}
.eat-mg .eat-pill.fever{background:linear-gradient(90deg,#ffb3c4,#e6b2ff);box-shadow:0 3px 0 #e85a78}
.eat-mg .eat-pill.fever span{display:inline-block;animation:eatPillPulse .35s ease-in-out infinite alternate}
.eat-mg .eat-pill.slow{background:linear-gradient(90deg,#9fd0ff,#ffb3c4);box-shadow:0 3px 0 #86b8f0}
.eat-mg .eat-pill i{position:absolute;left:0;bottom:0;height:4px;background:rgba(255,255,255,.9);border-radius:99px}

/* screen tints */
.eat-mg .eat-tint{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .45s}
.eat-mg .eat-tint.slow{box-shadow:inset 0 0 120px 46px rgba(127,183,245,.55)}
.eat-mg .eat-tint.fever{box-shadow:inset 0 0 110px 30px rgba(255,210,120,.55);animation:eatFeverGlow .6s ease-in-out infinite alternate}
.eat-mg .eat-tint.on{opacity:1}
.eat-mg .eat-hot{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,rgba(255,170,130,0) 40%,rgba(255,110,120,.5) 100%);animation:eatHot 1.4s ease-out forwards}

.eat-mg .eat-hint{position:absolute;left:50%;bottom:calc(22px + var(--sab,0px));transform:translateX(-50%);background:rgba(255,255,255,.92);border-radius:99px;padding:8px 18px;
  font-weight:800;color:#8a99a8;pointer-events:none;box-shadow:0 3px 0 #ffccd5;white-space:nowrap;font-size:15px;transition:opacity .3s}
.eat-mg .eat-hint.mash{color:#ff7a93;font-size:18px;animation:eatMash .18s ease-in-out infinite alternate}

/* intro card */
.eat-mg .eat-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(94cqw,520px);max-height:94cqh;overflow:auto;padding:12px 16px 14px;text-align:center;z-index:3;
  animation:eatIn .45s cubic-bezier(.34,1.56,.64,1)}
.eat-mg .eat-card .hero{font-size:36px;line-height:1}
.eat-mg .eat-card h2{margin:0 0 2px;font-size:26px}
.eat-mg .eat-card .sub{color:#8a99a8;font-size:13.5px;margin-bottom:8px}
.eat-mg .eat-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:4px 0 9px}
.eat-mg .eat-step{background:#fff;border-radius:16px;padding:7px 6px 7px;box-shadow:0 3px 0 #e9ddff;font-size:12px;line-height:1.22;color:#364049;font-weight:700}
.eat-mg .eat-step .ico{font-size:24px;display:block;margin-bottom:3px;height:32px;line-height:32px;position:relative}
.eat-mg .eat-step .ico .ring{position:absolute;left:50%;top:50%;width:32px;height:32px;margin:-16px 0 0 -16px;border:4px solid #ff9db3;border-radius:50%;box-sizing:border-box}
.eat-mg .eat-step .ico .slide{position:absolute;left:50%;top:50%;font-size:19px;line-height:1;transform:translate(-50%,-50%);animation:eatSlide 1.6s ease-in-out infinite}
.eat-mg .eat-step .ico .no{position:absolute;right:6px;top:-4px;font-size:15px}
.eat-mg .eat-step .ico .bub{display:inline-block;background:#fff;border-radius:50%;box-shadow:0 0 0 3px #ffccd5;width:34px;height:30px;line-height:30px;font-size:19px;animation:eatBob 1.2s ease-in-out infinite}
.eat-mg .eat-best{font-size:12.5px;color:#8a99a8;margin:0 0 9px}
.eat-mg .eat-card .btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.eat-mg .eat-tapfx{position:absolute;width:70px;height:70px;margin:-35px 0 0 -35px;border-radius:50%;border:5px solid #ffb3c4;pointer-events:none;animation:eatRing .35s ease-out forwards}

/* Hamin's craving thought bubble (anchored above his head every frame) */
.eat-mg .eat-think{position:absolute;left:0;top:0;pointer-events:none;will-change:transform;z-index:1}
.eat-mg .eat-think .cloud{position:absolute;left:-34px;top:-62px;width:68px;height:58px;background:#fff;border-radius:50%;display:grid;place-items:center;font-size:34px;line-height:1;
  box-shadow:0 3px 0 #ffccd5,0 6px 16px rgba(255,122,147,.25);opacity:0;transform:scale(.3)}
.eat-mg .eat-think .cloud::before,.eat-mg .eat-think .cloud::after{content:'';position:absolute;background:#fff;border-radius:50%}
.eat-mg .eat-think .cloud::before{width:26px;height:22px;left:-6px;top:6px}
.eat-mg .eat-think .cloud::after{width:24px;height:22px;right:-7px;top:10px}
.eat-mg .eat-think .em{position:relative;z-index:1;animation:eatBob 1.1s ease-in-out infinite}
.eat-mg .eat-think .heart{position:absolute;right:-8px;top:-8px;font-size:16px;z-index:2;opacity:0;transition:opacity .2s}
.eat-mg .eat-think .d1,.eat-mg .eat-think .d2{position:absolute;background:#fff;border-radius:50%;box-shadow:0 2px 0 #ffccd5;opacity:0;transition:opacity .25s}
.eat-mg .eat-think .d1{width:13px;height:13px;left:-40px;top:-6px}
.eat-mg .eat-think .d2{width:8px;height:8px;left:-52px;top:8px}
.eat-mg .eat-think.show .cloud{opacity:1;transform:none;animation:eatThinkIn .45s cubic-bezier(.34,1.56,.64,1)}
.eat-mg .eat-think.show .d1,.eat-mg .eat-think.show .d2{opacity:1}
.eat-mg .eat-think.show.eager .cloud{animation:eatWiggle .28s ease-in-out infinite;box-shadow:0 3px 0 #ff9db3,0 0 0 4px #ffccd5,0 6px 18px rgba(255,122,147,.45)}
.eat-mg .eat-think.show.eager .heart{opacity:1}
.eat-mg .eat-think.shake .cloud{animation:eatShake .4s ease-in-out}
.eat-mg .eat-think.yay .cloud{opacity:1;animation:eatThinkYay .5s ease-out forwards}
.eat-mg .eat-think.sad .cloud{opacity:1;animation:eatThinkSad .7s ease-in forwards}

/* floating score numbers */
.eat-mg .eat-pts{position:absolute;transform:translate(-50%,-50%);font-weight:900;font-size:22px;color:#ff7a93;text-shadow:0 2px 0 #fff,0 0 8px #fff,0 0 2px #fff;
  pointer-events:none;white-space:nowrap;animation:eatPts .9s ease-out forwards;z-index:2}
.eat-mg .eat-pts.good{color:#7fb7f5}
.eat-mg .eat-pts.gold{color:#f5b400;font-size:28px}
.eat-mg .eat-pts.crave{color:#ff5f8a;font-size:28px}
.eat-mg .eat-pts.bad{color:#ff6b7f;font-size:24px}
.eat-mg .eat-pts.mint{color:#3fbf8f}
.eat-mg .eat-pts.big{font-size:38px;animation-duration:1.4s}

/* phase banners */
.eat-mg .eat-banner{position:absolute;left:50%;top:66%;text-align:center;pointer-events:none;z-index:2;animation:eatBanner 2.3s cubic-bezier(.34,1.56,.64,1) forwards;white-space:nowrap}
.eat-mg .eat-banner b{display:inline-block;font-size:clamp(24px,5cqw,38px);font-weight:900;color:#fff;background:linear-gradient(90deg,#ff9db3,#e6b2ff);padding:6px 22px;border-radius:99px;box-shadow:0 4px 0 #e85a78}
.eat-mg .eat-banner.hot b{background:linear-gradient(90deg,#ffb347,#ff7a93);box-shadow:0 4px 0 #e85a78}
.eat-mg .eat-banner.cake b{background:linear-gradient(90deg,#ffd6e0,#ff9db3,#ffe9a8);color:#e85a78;box-shadow:0 4px 0 #ff9db3}
.eat-mg .eat-banner small{display:inline-block;margin-top:8px;font-size:15px;font-weight:800;color:#364049;background:rgba(255,255,255,.92);padding:4px 14px;border-radius:99px}

/* cake tower progress */
.eat-mg .eat-tower{position:absolute;left:calc(12px + var(--sal,0px));top:calc(122px + var(--sat,0px));display:flex;gap:3px;align-items:center;background:#fff;border-radius:99px;
  padding:3px 12px;box-shadow:0 3px 0 #ff9db3;font-size:22px;pointer-events:none;z-index:2;animation:eatTowerIn .35s cubic-bezier(.34,1.56,.64,1);transform-origin:0 50%}
.eat-mg .eat-tower span{display:inline-block;transition:transform .2s,opacity .2s,filter .2s}
.eat-mg .eat-tower span.done{opacity:.3;filter:grayscale(1);transform:scale(.75)}
.eat-mg .eat-tower span.cur{animation:eatBob .5s ease-in-out infinite}

@keyframes eatSlide{0%{transform:translate(-160%,-50%)}45%,60%{transform:translate(-50%,-50%) scale(1.15)}100%{transform:translate(60%,-50%)}}
@keyframes eatIn{from{transform:translate(-50%,-40%) scale(.8);opacity:0}}
@keyframes eatBump{50%{transform:rotate(-4deg) scale(1.3)}}
@keyframes eatBreak{0%{opacity:1;transform:rotate(-4deg)}30%{transform:rotate(-12deg) translateY(4px)}100%{opacity:0;transform:rotate(-20deg) translateY(26px) scale(.8)}}
@keyframes eatScoreBump{50%{transform:scale(1.28);color:#ff7a93}}
@keyframes eatPillPulse{to{transform:scale(1.08)}}
@keyframes eatPillIn{from{transform:scale(.4);opacity:0}}
@keyframes eatTowerIn{from{transform:scale(.4);opacity:0}}
@keyframes eatShine{to{filter:brightness(1.15) saturate(1.3)}}
@keyframes eatRing{from{transform:scale(.4);opacity:1}to{transform:scale(1.3);opacity:0}}
@keyframes eatPulseT{to{transform:scale(1.1)}}
@keyframes eatHot{0%{opacity:0}12%{opacity:1}60%{opacity:.8}100%{opacity:0}}
@keyframes eatFeverGlow{to{box-shadow:inset 0 0 130px 40px rgba(255,170,200,.6)}}
@keyframes eatMash{to{transform:translateX(-50%) scale(1.08)}}
@keyframes eatBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes eatThinkIn{0%{opacity:0;transform:scale(.3) translateY(10px)}100%{opacity:1;transform:none}}
@keyframes eatWiggle{0%,100%{transform:rotate(-6deg) scale(1.08)}50%{transform:rotate(6deg) scale(1.12)}}
@keyframes eatShake{0%,100%{transform:none}20%{transform:translateX(-6px) rotate(-5deg)}40%{transform:translateX(6px) rotate(5deg)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}
@keyframes eatThinkYay{0%{transform:scale(1)}35%{transform:scale(1.45);opacity:1}100%{transform:scale(1.9);opacity:0}}
@keyframes eatThinkSad{0%{transform:none}25%{transform:translateX(-4px) rotate(-6deg)}50%{transform:translateX(4px) rotate(4deg)}100%{transform:translateY(18px) scale(.5);opacity:0}}
@keyframes eatPts{0%{opacity:0;transform:translate(-50%,-30%) scale(.5)}18%{opacity:1;transform:translate(-50%,-85%) scale(1.25)}32%{transform:translate(-50%,-95%) scale(1)}100%{opacity:0;transform:translate(-50%,-230%) scale(.95)}}
@keyframes eatBanner{0%{opacity:0;transform:translateX(-50%) translateY(-16px) scale(.6)}14%{opacity:1;transform:translateX(-50%) scale(1.08)}22%{transform:translateX(-50%) scale(1)}82%{opacity:1;transform:translateX(-50%) scale(1)}100%{opacity:0;transform:translateX(-50%) translateY(-12px) scale(.96)}}
`;

export function injectEatingStyle() {
  const old = document.getElementById(STYLE_ID);
  if (old && old.textContent === CSS) return;
  old?.remove();
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}
