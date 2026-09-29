// Render every drawn UI icon (src/ui/icons/set*.ts) into one contact sheet PNG for review.
// usage: node scripts/icon-sheet.mjs [out.png]   (Node ≥ 22.18: imports the .ts files directly)
import sharp from 'sharp';
import path from 'node:path';
const out = process.argv[2] ?? 'art-src/icons_sheet.png';
const all = {};
for (const s of 'ABCDE') Object.assign(all, (await import(path.resolve(`src/ui/icons/set${s}.ts`)))[`SET_${s}`]);
const keys = Object.keys(all);
const S = 72, cols = 14, rows = Math.ceil(keys.length / cols);
const comps = [];
for (const [i, k] of keys.entries()) {
  const png = await sharp(Buffer.from(all[k]), { density: 144 }).resize(S - 8, S - 8).png().toBuffer();
  comps.push({ input: png, left: (i % cols) * S + 4, top: Math.floor(i / cols) * S + 4 });
}
await sharp({ create: { width: cols * S, height: rows * S, channels: 4, background: '#FFF6FA' } }).composite(comps).png().toFile(out);
console.log(`${keys.length} icons → ${out}`);
