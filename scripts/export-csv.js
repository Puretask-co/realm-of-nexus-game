/**
 * Minimal CSV export for designers — exports items list from data/items.json.
 * npm run export-csv
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const itemsPath = join(root, 'data', 'items.json');
const outDir = join(root, 'exports');
const outPath = join(outDir, 'items_export.csv');

function csvEscape(s) {
  const t = String(s ?? '');
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

async function main() {
  const raw = await readFile(itemsPath, 'utf8');
  const data = JSON.parse(raw);
  const items = data.items || [];
  const headers = ['id', 'name', 'type', 'rarity', 'value'];
  const lines = [headers.join(',')];
  for (const it of items) {
    lines.push(
      headers.map((h) => csvEscape(it[h])).join(',')
    );
  }
  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, lines.join('\n'), 'utf8');
  console.log(`[export-csv] Wrote ${items.length} rows → ${outPath}`);
}

main().catch((e) => {
  console.error('[export-csv]', e.message);
  process.exit(1);
});
