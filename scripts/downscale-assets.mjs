/**
 * Downscale oversized imported PNGs in place to slash boot time + GPU memory.
 * Painterly assets are generated at 1024-1254px but displayed at 56-256px
 * in-game; backdrops fill an 800px zone. We cap dimensions accordingly and
 * re-encode with good PNG compression. Run once; safe to re-run (skips files
 * already at/under target).
 *
 *   node scripts/downscale-assets.mjs
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ROOT = 'public/assets/imported';

// Per-folder max dimension (longest side). Folders not listed default to 512.
const FOLDER_MAX = {
  backdrops: 768,
  portraits: 640,
  enemies: 640,
  props: 512,
  npcs: 512,
  sprites: 512,
  icons: 256,
  ui: 512,
  environment: 384,
  vfx: 256,
  characters: 512,            // sprite sheets — keep frames legible
  ground_tiles: 256,
  character_sprite_sheets: 512,
  environment_sprite_sheets: 384,
  Skill_spritesheets: 256,
};
const DEFAULT_MAX = 512;

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.png$/i.test(e.name)) yield p;
  }
}

const maxFor = (file) => {
  const rel = path.relative(ROOT, file).split(path.sep)[0];
  return FOLDER_MAX[rel] ?? DEFAULT_MAX;
};

let processed = 0, skipped = 0, savedBytes = 0, failed = 0;

const files = [...walk(ROOT)];
console.log(`[downscale] scanning ${files.length} PNGs...`);

for (const file of files) {
  try {
    const max = maxFor(file);
    const img = sharp(file, { failOn: 'none' });
    const meta = await img.metadata();
    const longest = Math.max(meta.width || 0, meta.height || 0);
    const before = fs.statSync(file).size;

    // Skip sprite sheets that encode col/row dims — resizing would break frames
    // unless we keep them divisible; we still downscale by an integer factor.
    const isSheet = /_(\d+)col_(\d+)row_(\d+)px/.test(file);

    if (longest <= max && before < 600 * 1024) { skipped++; continue; }

    let pipeline = img;
    if (longest > max) {
      // For sheets, scale by the largest integer factor that keeps it >= max-ish
      // so frames stay aligned; otherwise plain fit-inside resize.
      if (isSheet) {
        const factor = Math.max(1, Math.floor(longest / max));
        if (factor > 1) {
          pipeline = pipeline.resize(Math.round((meta.width) / factor), Math.round((meta.height) / factor));
        }
      } else {
        pipeline = pipeline.resize({ width: meta.width >= meta.height ? max : null,
                                     height: meta.height > meta.width ? max : null,
                                     fit: 'inside', withoutEnlargement: true });
      }
    }

    const buf = await pipeline.png({ compressionLevel: 9, quality: 90 }).toBuffer();
    if (buf.length < before) {
      fs.writeFileSync(file, buf);
      savedBytes += (before - buf.length);
      processed++;
    } else {
      skipped++;
    }
  } catch (e) {
    console.error(`[downscale] FAILED ${file}: ${e.message}`);
    failed++;
  }
}

console.log(`[downscale] done. resized ${processed}, skipped ${skipped}, failed ${failed}`);
console.log(`[downscale] saved ${(savedBytes / 1024 / 1024).toFixed(1)} MB`);
