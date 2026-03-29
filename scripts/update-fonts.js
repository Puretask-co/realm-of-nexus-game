/**
 * update-fonts.js
 * Replaces all fontFamily values with 'Open Sans' and increases all fontSize values by 40%.
 * Run: node scripts/update-fonts.js
 */

const { readFileSync, writeFileSync, readdirSync, statSync } = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'src');

function walk(dir) {
  const results = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      results.push(...walk(full));
    } else if (name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

const FILES = walk(ROOT);

let totalFiles = 0;

for (const file of FILES) {
  let src = readFileSync(file, 'utf8');
  const original = src;

  // 1. Replace known fontFamily values with 'Open Sans'
  src = src.replace(/fontFamily:\s*'monospace'/g, "fontFamily: 'Open Sans'");
  src = src.replace(/fontFamily:\s*"monospace"/g, 'fontFamily: "Open Sans"');
  src = src.replace(/fontFamily:\s*'Georgia,\s*serif'/g, "fontFamily: 'Open Sans'");
  src = src.replace(/fontFamily:\s*'Georgia,\s*"Times New Roman",\s*serif'/g, "fontFamily: 'Open Sans'");
  src = src.replace(/fontFamily:\s*'Georgia'/g, "fontFamily: 'Open Sans'");
  src = src.replace(/fontFamily:\s*"Georgia,\s*serif"/g, 'fontFamily: "Open Sans"');

  // 2. Replace fontSize: 'Npx' — increase by 40%, round to nearest int
  src = src.replace(/fontSize:\s*'(\d+)px'/g, (_, sizeStr) => {
    return `fontSize: '${Math.round(parseInt(sizeStr, 10) * 1.4)}px'`;
  });

  // 3. Replace fontSize: "Npx" (double quotes)
  src = src.replace(/fontSize:\s*"(\d+)px"/g, (_, sizeStr) => {
    return `fontSize: "${Math.round(parseInt(sizeStr, 10) * 1.4)}px"`;
  });

  if (src !== original) {
    writeFileSync(file, src, 'utf8');
    totalFiles++;
    console.log('  updated:', path.relative(ROOT, file));
  }
}

console.log('\nDone. Updated', totalFiles, 'files.');
