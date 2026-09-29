// Extract player-visible English strings from src/ into src/i18n/strings.json (for translators).
// Template literals become {0}-style patterns; HTML strings are split into their text segments.
// usage: node scripts/extract-strings.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('src');
const files = [];
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { if (f !== 'i18n') walk(p); }
    else if (p.endsWith('.ts') && !p.endsWith('ref.ts')) files.push(p);
  }
};
walk(ROOT);

/** Minimal tokenizer: yields {q, body, start} for string literals, skipping comments. */
function* literals(src) {
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2); if (i < 0) return; i += 2; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1, body = '';
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') { body += src[j + 1] === 'n' ? '\n' : src[j + 1]; j += 2; continue; } body += src[j++]; }
      yield { q: c, body, start: i };
      i = j + 1;
      continue;
    }
    if (c === '`') {
      let j = i + 1, body = '', n = 0, depth = 0;
      while (j < src.length) {
        if (src[j] === '\\') { body += src[j + 1]; j += 2; continue; }
        if (src[j] === '`') break;
        if (src[j] === '$' && src[j + 1] === '{') {
          depth = 1; j += 2;
          const s0 = j;
          while (j < src.length && depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
          // strings nested inside ${ … } (ternaries, inner templates) are player text too
          for (const inner of literals(src.slice(s0, j - 1))) yield { ...inner, start: -1 };
          body += `{${n++}}`;
          continue;
        }
        body += src[j++];
      }
      yield { q: '`', body, start: i };
      i = j + 1;
      continue;
    }
    i++;
  }
}

const out = new Map();
const add = (s, file, htmlSeg = false) => {
  s = s.replace(/\s+/g, ' ').trim();
  if (!s || !/[A-Za-z]/.test(s)) return;
  if (s.length < 2) return;
  if (htmlSeg && /^[a-z]{2,}$/.test(s)) { if (!out.has(s)) out.set(s, file); return; } // words between tags: "score", "or"…
  // code-ish noise
  if (/^[a-z][A-Za-z0-9_]*$/.test(s)) return; // ids: dance, yard, top_denim
  if (/^[a-z0-9_:\-]+( [a-z0-9_:\-]+)*$/.test(s) && !/ /.test(s)) return;
  if (/^[a-z0-9_\-]+( [a-z0-9_\-]+)+$/.test(s) && /-|_/.test(s)) return; // css class lists
  if (/^(Key|Arrow|Shift|Digit)[A-Z]/.test(s)) return;
  if (/^#[0-9a-f]{3,8}$/i.test(s) || /^rgba?\(/.test(s) || /\d+px|\bvh\b|\bvw\b|calc\(|var\(--/.test(s)) return;
  if (/^[.#\[]?[a-z\-]+[\[\].#>:]/.test(s)) return; // selectors
  if (/\.(ts|js|glb|png|json|css|svg)$/.test(s) || s.startsWith('models/') || s.includes('://')) return;
  if (/^[A-Z][a-z]+([A-Z][a-z0-9]+)+$/.test(s)) return; // CamelCase types
  if (/^(bold|italic|\d+) /.test(s) && /Nunito|sans-serif|px/.test(s)) return; // fonts
  if (/^(image|audio|video|text)\//.test(s)) return;
  if (/^[A-Z_]+$/.test(s) && s.length > 3) return; // CONSTANTS
  if (/^(pointer|key|mouse|touch)(down|up|move|cancel)$/.test(s)) return;
  if (!out.has(s)) out.set(s, file);
};

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = path.relative(process.cwd(), f);
  for (const { body, start } of literals(src)) {
    const before = start < 0 ? '' : src.slice(Math.max(0, start - 40), start);
    if (/import\s[^;]*from\s*$|import\(\s*$|require\(\s*$/.test(before)) continue;
    if (/(querySelector(All)?|getElementById|classList\.(add|remove|toggle|contains)|addEventListener|removeEventListener|setAttribute|getAttribute|getObjectByName|sfx|playMusic|ambience|play|playAsync|setFlag|flag|mg|npc|goto|createElement|el|dispatchEvent|KeyboardEvent|PointerEvent|Event|getContext|toDataURL|setItem|getItem)\(\s*$/.test(before)) continue;
    if (/\.(type|kind|mode|id|slot|theme|style|species|idle|acc|design|pattern|sleeve|emblem|name)\s*===?\s*$/.test(before) && !/ /.test(body)) continue;
    if (body.includes('<') && body.includes('>')) {
      for (const seg of body.split(/<[^>]+>/)) add(seg, rel, true);
    } else add(body, rel);
  }
}

const list = [...out.entries()].map(([s, f]) => ({ s, f })).sort((a, b) => a.f.localeCompare(b.f) || a.s.localeCompare(b.s));
fs.mkdirSync('src/i18n', { recursive: true });
fs.writeFileSync('src/i18n/strings.json', JSON.stringify(list, null, 1));
console.log(`extracted ${list.length} strings from ${files.length} files`);
