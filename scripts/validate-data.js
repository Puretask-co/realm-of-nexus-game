/**
 * Validates every JSON file under data/ parses successfully.
 * npm run validate-data
 */
import { readdir, readFile } from 'fs/promises';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');
const logDir = join(root, '.cursor');
const logPath = join(logDir, 'debug.log');

function agentLog(message, data, hypothesisId = 'H1') {
  // #region agent log
  try {
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    appendFileSync(
      logPath,
      `${JSON.stringify({
        location: 'scripts/validate-data.js',
        message,
        data,
        hypothesisId,
        timestamp: Date.now(),
        runId: process.env.DEBUG_RUN_ID || 'validate-data'
      })}\n`
    );
  } catch {
    /* ignore log I/O errors */
  }
  // #endregion
}

async function main() {
  agentLog('validate-data start', { dataDir }, 'H1');

  let files;
  try {
    files = await readdir(dataDir);
  } catch (e) {
    agentLog('validate-data readdir failed', { error: String(e.message) }, 'H1');
    console.error('[validate-data] Cannot read data/:', e.message);
    process.exit(1);
  }

  const jsonFiles = files.filter((f) => f.endsWith('.json')).sort();
  const errors = [];

  for (const f of jsonFiles) {
    const full = join(dataDir, f);
    try {
      const text = await readFile(full, 'utf8');
      JSON.parse(text);
    } catch (e) {
      errors.push({ file: f, message: e.message });
    }
  }

  if (errors.length) {
    agentLog('validate-data FAILED', { errorCount: errors.length, errors }, 'H1');
    console.error('[validate-data] Invalid JSON:', errors);
    process.exit(1);
  }

  agentLog('validate-data OK', { fileCount: jsonFiles.length, files: jsonFiles }, 'H1');
  console.log(`[validate-data] OK — ${jsonFiles.length} JSON file(s) in data/`);
}

main().catch((e) => {
  agentLog('validate-data exception', { error: String(e.message) }, 'H1');
  console.error(e);
  process.exit(1);
});
