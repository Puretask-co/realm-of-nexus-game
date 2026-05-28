/**
 * Realm of Nexus — DALL-E / gpt-image batch generator
 *
 * Generates images from OpenAI's image API and saves them as PNG files.
 * The API key is read from the environment (OPENAI_API_KEY) and never logged.
 *
 * USAGE
 *   Single image:
 *     node --env-file=.env scripts/generate-images.mjs \
 *       --prompt "a painterly fantasy tree, top-down" \
 *       --out public/assets/imported/props/test.png
 *
 *   Batch from a JSON file (recommended):
 *     node --env-file=.env scripts/generate-images.mjs \
 *       --batch scripts/image-batch.json --outdir public/assets/imported/props
 *
 *   The batch JSON is an array of objects:
 *     [
 *       { "filename": "prop_oak.png", "prompt": "a painterly fantasy oak tree..." },
 *       { "filename": "enemy_wolf.png", "prompt": "a snarling grey wolf...", "size": "1024x1024" }
 *     ]
 *
 * OPTIONS
 *   --model    openai image model (default: gpt-image-1; fallback: dall-e-3)
 *   --size     default size for all images (default: 1024x1024)
 *   --quality  gpt-image-1: low|medium|high|auto (default: high)
 *   --outdir   directory for batch output (created if missing)
 *
 * NOTE: gpt-image-1 may require a verified OpenAI org. If you get a 403/model
 * error, re-run with --model dall-e-3.
 */

import fs from 'fs';
import path from 'path';

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('\n[gen] ERROR: OPENAI_API_KEY is not set.');
  console.error('[gen] Run with: node --env-file=.env scripts/generate-images.mjs ...\n');
  process.exit(1);
}

// ── Parse CLI args ─────────────────────────────────────────────────────
function getArg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const MODEL   = getArg('model', 'gpt-image-1');
const SIZE    = getArg('size', '1024x1024');
const QUALITY = getArg('quality', 'high');
const OUTDIR  = getArg('outdir', 'public/assets/imported/generated');
const BATCH   = getArg('batch');
const PROMPT  = getArg('prompt');
const OUT     = getArg('out');

// ── Core generation call ───────────────────────────────────────────────
async function generateOne(prompt, size, modelOverride, qualityOverride) {
  const model = modelOverride || MODEL;
  const body = {
    model,
    prompt,
    n: 1,
    size: size || SIZE,
  };
  // gpt-image-1 accepts a quality param (low|medium|high|auto) and always
  // returns base64. We do NOT send response_format — newer models reject it,
  // and we handle both base64 and URL responses below.
  if (model === 'gpt-image-1') {
    body.quality = qualityOverride || QUALITY;
  }

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const item = data?.data?.[0];
  if (!item) throw new Error('No image data returned');

  // Response can be base64 (gpt-image-1, and dall-e-3 when b64 requested) or
  // a temporary URL (dall-e-3 default). Handle both.
  if (item.b64_json) {
    return Buffer.from(item.b64_json, 'base64');
  }
  if (item.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) throw new Error(`Failed to download image URL: ${imgRes.status}`);
    return Buffer.from(await imgRes.arrayBuffer());
  }
  throw new Error('Response had neither b64_json nor url');
}

function saveBuffer(buf, filepath) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, buf);
  console.log(`[gen] saved → ${filepath} (${(buf.length / 1024).toFixed(0)} KB)`);
}

// ── Run ────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[gen] model=${MODEL} size=${SIZE} quality=${QUALITY}`);

  // Single-image mode
  if (PROMPT && OUT) {
    try {
      const buf = await generateOne(PROMPT, SIZE);
      saveBuffer(buf, OUT);
    } catch (e) {
      console.error(`[gen] FAILED: ${e.message}`);
      process.exit(1);
    }
    return;
  }

  // Batch mode
  if (BATCH) {
    const jobs = JSON.parse(fs.readFileSync(BATCH, 'utf8'));
    if (!Array.isArray(jobs)) {
      console.error('[gen] batch file must be a JSON array');
      process.exit(1);
    }
    console.log(`[gen] batch: ${jobs.length} images → ${OUTDIR}\n`);

    let ok = 0, fail = 0;
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const label = `[${i + 1}/${jobs.length}] ${job.filename}`;
      try {
        process.stdout.write(`[gen] ${label} ... `);
        const buf = await generateOne(job.prompt, job.size, job.model, job.quality);
        saveBuffer(buf, path.join(OUTDIR, job.filename));
        ok++;
      } catch (e) {
        console.error(`FAILED: ${e.message}`);
        fail++;
      }
    }
    console.log(`\n[gen] done. ${ok} succeeded, ${fail} failed.`);
    return;
  }

  console.error('[gen] Nothing to do. Provide --prompt + --out, or --batch.');
  console.error('[gen] See the header of this file for usage.');
  process.exit(1);
}

main();
