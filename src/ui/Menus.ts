import type { Game } from '../game/Game';
import { el } from './UI';
import { SCENES } from '../scenes/registry';
import type { SceneId } from '../scenes/GameScene';
import { CHARMS, MINIGAMES, PLUSHIES, POSES, SHELLS, STICKERS } from '../game/collectibles';
import { NPCS } from '../npcs/npcData';
import { getLang, LANGS, tr } from '../i18n/i18n';

/** Big language chooser (title screen, menu and settings). */
export function openLanguage(g: Game) {
  const body = el('div', 'lang-grid');
  body.setAttribute('data-no-tr', '');
  const m = g.ui.modal('🌐 Language · 언어 · 言語 · 语言', body);
  for (const l of LANGS) {
    const b = el('button', 'candy' + (getLang() === l.id ? ' primary' : ''), `${l.flag} ${l.label}`);
    b.onclick = async () => { g.audio.sfx('select'); m.close(); await g.changeLang(l.id); };
    body.appendChild(b);
  }
}


export function openMenu(g: Game) {
  const body = el('div', 'menu-grid');
  const d = g.save.data;
  const cards: [string, string, string, () => void][] = [
    ['🌐', 'Language', LANGS.map((l) => l.label).join(' · '), () => { m.close(); openLanguage(g); }],
    ['🗺️', 'Map', `${d.visited.length} places visited`, () => { m.close(); openMap(g); }],
    ['📒', 'Sticker Book', `${d.stickers.length}/${STICKERS.length} stickers`, () => { m.close(); openBook(g); }],
    ['👗', 'Wardrobe', 'Dress up Hamin', () => { m.close(); g.openWardrobe(); }],
    ['⚙️', 'Settings', 'Sound & save', () => { m.close(); openSettings(g); }],
    ['❓', 'How to play', 'Controls & tips', () => { m.close(); openHelp(g); }],
    ['💌', 'Credits', 'Unofficial fan game', () => { m.close(); openCredits(g); }],
  ];
  for (const [e, t, s, fn] of cards) {
    // the language card also names itself in every language, so it can be found whatever is on screen
    const sub = t === 'Language' ? `<small data-no-tr>${s}</small>` : `<small>${s}</small>`;
    const c = el('button', 'menu-card' + (t === 'Language' ? ' lang-card' : ''), `<span class="e">${e}</span>${t}${sub}`);
    c.onclick = () => { g.audio.sfx('select'); fn(); };
    body.appendChild(c);
  }
  const row = el('div', '');
  row.style.cssText = 'grid-column:1/-1;display:flex;justify-content:center;margin-top:4px';
  const title = el('button', 'candy small blue', '🏠 Title screen');
  title.onclick = () => { m.close(); g.goto('title'); };
  row.appendChild(title);
  body.appendChild(row);
  const m = g.ui.modal('♡ Menu ♡', body);
}

export function openMap(g: Game) {
  const body = el('div', 'loc-list');
  const d = g.save.data;
  const order: SceneId[] = ['yard', 'classroom', 'dance', 'vocal', 'cafeteria', 'stage', 'metro', 'beach'];
  body.appendChild(el('p', 'note', 'Tap a place you have visited to travel there. The beach is reached by metro ♡'));
  for (const id of order) {
    const s = SCENES[id];
    const visited = d.visited.includes(id) || id === 'yard' || id === 'classroom';
    const here = g.currentId === id;
    const b = el('button', 'loc' + (visited ? '' : ' locked') + (here ? ' here' : ''),
      `<span class="e">${visited ? s.emoji : '❔'}</span><span class="n">${visited ? s.title : '???'}<small>${visited ? s.blurb : 'Not discovered yet'}</small></span>${here ? '📍' : visited ? '▶' : '🔒'}`);
    b.onclick = () => {
      if (!visited || here) { g.audio.sfx('miss'); return; }
      g.audio.sfx('select');
      m.close();
      if (id === 'beach') g.goto('train', 'toBeach', { text: 'Next stop: Sweet Sea Beach ♡', icon: '🚃' });
      else g.goto(id, 'map');
    };
    body.appendChild(b);
  }
  const m = g.ui.modal('🗺️ Map', body);
}

export function openBook(g: Game, tab = 'stickers') {
  const d = g.save.data;
  const tabs = el('div', 'tabs');
  const content = el('div');
  const defs: [string, string][] = [['stickers', '⭐ Stickers'], ['collect', '🐚 Collection'], ['quests', '📝 Requests'], ['scores', '🏆 Scores'], ['photos', '📸 Photos']];
  const render = (t: string) => {
    tabs.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', (x as HTMLElement).dataset.t === t));
    content.innerHTML = '';
    if (t === 'stickers') {
      content.appendChild(el('div', 'sect', `Room stickers · ${d.stickers.length}/${STICKERS.length}`));
      const grid = el('div', 'stk-grid');
      for (const s of STICKERS) {
        const has = d.stickers.includes(s.id);
        grid.appendChild(el('div', 'stk' + (has ? '' : ' missing'), `${has ? s.emoji : '?'}<span>${has ? s.name : SCENES[s.scene as SceneId]?.title ?? ''}</span>`));
      }
      content.appendChild(grid);
      content.appendChild(el('div', 'sect', `Charms · ${d.charms.length}/${CHARMS.length}`));
      const cg = el('div', 'stk-grid');
      for (const c of CHARMS) {
        const has = d.charms.includes(c.id);
        cg.appendChild(el('div', 'stk' + (has ? '' : ' missing'), `${has ? c.emoji : '?'}<span>${has ? c.name : c.how}</span>`));
      }
      content.appendChild(cg);
    } else if (t === 'collect') {
      content.appendChild(el('div', 'sect', `🐑 Hidden sheep plushies · ${d.plushies.length}/${PLUSHIES.length}`));
      const pg = el('div', 'stk-grid');
      for (const p of PLUSHIES) {
        const has = d.plushies.includes(p.id);
        pg.appendChild(el('div', 'stk' + (has ? '' : ' missing'), `${has ? '🐑' : '?'}<span>${SCENES[p.scene as SceneId]?.title ?? ''}</span>`));
      }
      content.appendChild(pg);
      content.appendChild(el('div', 'sect', `🐚 Shells · ${d.shells.length}/${SHELLS.length}`));
      const sg = el('div', 'stk-grid');
      for (const s of SHELLS) sg.appendChild(el('div', 'stk' + (d.shells.includes(s) ? '' : ' missing'), d.shells.includes(s) ? '🐚' : '?'));
      content.appendChild(sg);
      content.appendChild(el('div', 'sect', `📸 Stage poses · ${d.poses.length}/${POSES.length}`));
      const po = el('div', 'stk-grid');
      for (const p of POSES) po.appendChild(el('div', 'stk' + (d.poses.includes(p.id) ? '' : ' missing'), `${d.poses.includes(p.id) ? '💫' : '?'}<span>${p.name}</span>`));
      content.appendChild(po);
    } else if (t === 'quests') {
      let any = false;
      for (const n of NPCS) {
        if (!n.quest) continue;
        const r = d.npc[n.id];
        if (!r?.questStarted) continue;
        any = true;
        const met = g.questMet(n.quest);
        content.appendChild(el('div', 'quest' + (r.questDone ? ' done' : ''), `<span style="font-size:24px">${n.emoji}</span><div style="flex:1">${n.quest.hint}<br><small class="note">${n.name} · ${r.questDone ? 'done ♡' : met ? 'ready — go tell them!' : `reward ${n.quest.reward} ♡`}</small></div>${r.questDone ? '✅' : met ? '💌' : '⏳'}`));
      }
      if (!any) content.appendChild(el('p', 'note', 'Talk to the NPCs around school — some of them have little requests for you ♡'));
    } else if (t === 'scores') {
      for (const [id, info] of Object.entries(MINIGAMES)) {
        const r = d.minigames[id];
        content.appendChild(el('div', 'quest', `<span style="font-size:24px">${info.emoji}</span><div style="flex:1">${info.name}<br><small class="note">${r ? `played ${r.plays}× ${r.cleared ? '· cleared ♡' : ''}` : 'not played yet'}</small></div><b>${r ? r.best : '–'}</b>`));
      }
      content.appendChild(el('p', 'note', `Total hearts earned: ${d.totalHearts} ♡`));
    } else {
      if (!d.photos.length) content.appendChild(el('p', 'note', 'No photos yet! Find photo spots on the stage and at the beach 📸'));
      const ph = el('div', 'photos');
      d.photos.slice().reverse().forEach((p, i) => {
        const e = el('div', 'polaroid', `<img src="${p.img}" alt="photo"><span>${p.place}</span>`);
        e.style.setProperty('--r', (i % 2 ? 2 : -2) + 'deg');
        ph.appendChild(e);
      });
      content.appendChild(ph);
    }
  };
  for (const [id, label] of defs) {
    const b = el('button', 'tab', label);
    b.dataset.t = id;
    b.onclick = () => { g.audio.sfx('tap'); render(id); };
    tabs.appendChild(b);
  }
  g.ui.modal('📒 Sticker Book', content, { tabs });
  render(tab);
}

export function openSettings(g: Game) {
  const s = g.save.data.settings;
  const body = el('div');
  const slider = (label: string, key: 'master' | 'music' | 'sfx') => {
    const row = el('div', 'set-row', `<label>${label}</label>`);
    const inp = el('input') as HTMLInputElement;
    inp.type = 'range';
    inp.min = '0'; inp.max = '1'; inp.step = '0.05';
    inp.value = String(s[key]);
    inp.oninput = () => { s[key] = parseFloat(inp.value); g.applySettings(); g.save.save(); };
    inp.onchange = () => g.audio.sfx('tap');
    row.appendChild(inp);
    body.appendChild(row);
  };
  const toggle = (label: string, get: () => boolean, set: (v: boolean) => void) => {
    const row = el('div', 'set-row', `<label>${label}</label>`);
    const t = el('button', 'toggle' + (get() ? ' on' : ''));
    t.onclick = () => { set(!get()); t.classList.toggle('on', get()); g.applySettings(); g.save.save(); g.audio.sfx('tap'); };
    row.appendChild(t);
    body.appendChild(row);
  };
  {
    const row = el('div', 'set-row', `<label>🌐 Language</label>`);
    const pills = el('div', 'lang-pills');
    pills.setAttribute('data-no-tr', '');
    for (const l of LANGS) {
      const b = el('button', 'lang-pill' + (getLang() === l.id ? ' on' : ''), l.label);
      b.onclick = async () => { g.audio.sfx('select'); m.close(); await g.changeLang(l.id); };
      pills.appendChild(b);
    }
    row.appendChild(pills);
    body.appendChild(row);
  }
  slider('🔊 Master', 'master');
  slider('🎵 Music', 'music');
  slider('✨ Sound effects', 'sfx');
  toggle('🔇 Mute all', () => s.muted, (v) => (s.muted = v));
  toggle('🎥 Swipe to turn camera', () => s.camSwipe, (v) => (s.camSwipe = v));
  const info = el('p', 'note', tr('Your progress saves automatically on this device (no account needed).') + (g.save.storageOk ? '' : ' ' + tr('⚠️ Storage is blocked in this browser, so progress may not be kept.')));
  body.appendChild(info);
  const reset = el('button', 'candy small', '🗑️ Reset Save');
  reset.style.marginTop = '8px';
  reset.onclick = async () => {
    m.close();
    const ok = await g.ui.confirm('Reset save?', 'This erases your hearts, outfits, stickers and progress on this device. Are you sure?', 'Reset', 'Keep');
    if (ok) {
      g.save.reset();
      await g.dressHamin(g.save.data.outfit);
      g.tutorial.reset();
      g.ui.toast('🧽', 'Save reset. A fresh sweet start!');
      g.goto('title');
    }
  };
  body.appendChild(reset);
  const m = g.ui.modal('⚙️ Settings', body);
}

export function openHelp(g: Game) {
  const touch = document.body.classList.contains('touch');
  const body = el('div', 'credits');
  body.innerHTML = touch
    ? `<h3>Moving</h3><p>Drag anywhere on the left half of the screen to walk. Drag far to run.</p>
       <h3>Interacting</h3><p>Tap the big ♡ button when a label pops up: talk, sit, enter doors, play…</p>
       <h3>Camera</h3><p>Drag on the right half to turn and tilt the camera, and pinch to zoom in on Hamin. Zoomed in, you can go all the way round him. 🎥 goes closer → face close-up → back.</p>`
    : `<h3>Moving</h3><p>WASD or the arrow keys to walk. Hold Shift to run.</p>
       <h3>Interacting</h3><p>E, Space or Enter to interact (or click ♡). Esc opens the menu.</p>
       <h3>Camera</h3><p>Drag with the mouse to turn and tilt the camera, scroll to zoom (or Q / R to turn, + / − to zoom). Zoomed in, you can go all the way round Hamin. 🎥 goes closer → face close-up → back, C resets.</p>`;
  body.innerHTML += `<h3>Hamin Hearts ♡</h3><p>Earn hearts from mini-games, stickers, NPC requests and chatting each day. Spend them in the 👗 Wardrobe.</p>
    <h3>Mini-games</h3><p>🐶 Dog Chase — pet Bori in the schoolyard<br>🍱 Eating Game — the cafeteria counter<br>💃 Dance & 🎤 Vocal practice — their rooms<br>🌟 Stage show — center stage</p>`;
  g.ui.modal('❓ How to play', body);
}

export function openCredits(g: Game) {
  const body = el('div', 'credits');
  body.innerHTML = `<p style="text-align:center;font-size:20px" class="grad-text">MY SWEET HAMIN WORLD</p>
  <p style="text-align:center"><b>Unofficial fan-made project.</b><br>Not affiliated with, endorsed by, or connected to Hamin, SMTR25, SM Entertainment, Mnet or any broadcaster.</p>
  <h3>Made by</h3><p style="text-align:center"><b class="grad-text" style="font-size:18px">mysweethamin</b><br>
  <span class="cred-tags"><span>𝕏 X</span><span>📕 RedNote</span><span>🌐 Weibo</span><span>▶️ YouTube</span></span></p>
  <h3>Development & design</h3><p>Game design, code, UI, world building and writing: a fan tribute made with love by mysweethamin.</p>
  <h3>Original artwork & assets</h3><p>The chibi Hamin (8 looks), the landmark props, the NPCs and the sheep were generated from original prompts with Higgsfield AI (image → 3D) and then optimised and animated for the game. Rooms, UI and icons are original, made in code and hand-drawn SVG. No photos, logos or official assets are used.</p>
  <h3>Music & sound</h3><p>All music and sound effects are original and synthesised live in your browser. No copyrighted songs are used.</p>
  <h3>Tools</h3><p>Three.js · TypeScript · Vite · Higgsfield (character generation) · gltf-transform · Nunito font (Google Fonts, OFL)</p>
  <h3>Respect</h3><p>This is a sweet, fictional little world. Everything that happens here is made up for fun ♡ Places like "Sweet Reply High" and "Sweet Sea Beach" are fictional.</p>
  <p style="text-align:center;margin-top:16px">Made with ✨ and 💕</p>`;
  g.ui.modal('💌 Credits', body);
}
