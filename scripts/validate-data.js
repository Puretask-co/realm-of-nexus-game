/**
 * Deep content-integrity validator. Runs at `npm run validate-data` so CI
 * fails when a content reference rots.
 *
 * Coverage (matches src/systems/DataManager.js checkReferences):
 *   spells.combosWith
 *   enemies.spells, enemies.lootTable.items
 *   quests: objective targets (kill/collect/travel), prerequisites,
 *           chainQuest, rewards.items, rewards.spells, dialogue refs
 *   locations: connections, enemies
 *   classes: startingSpells
 *   companions: recruitQuest, personalQuest, recruitLocation
 *   recipes: materials, result, unlockMethod "find:<loc>"
 *   veilkeepers: memorialBuffs.location
 *
 * Plus per-file JSON parse + duplicate-id checks.
 *
 * Exit codes:
 *   0  — clean
 *   1  — hard errors (broken refs in non-dialogue categories, JSON parse,
 *        duplicate ids)
 *   0  — soft warnings only (dialogue refs — printed but don't fail CI,
 *        because dialogues are optional content)
 */
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');

// ── Load + parse every JSON file ────────────────────────────────────
async function loadAll() {
  const files = (await readdir(dataDir)).filter(f => f.endsWith('.json')).sort();
  const out = {};
  const parseErrors = [];
  for (const f of files) {
    try {
      const text = await readFile(join(dataDir, f), 'utf8');
      out[f.replace(/\.json$/, '')] = JSON.parse(text);
    } catch (e) {
      parseErrors.push({ file: f, message: e.message });
    }
  }
  return { data: out, parseErrors, fileCount: files.length };
}

// ── Reference checks (mirror DataManager.checkReferences) ───────────
function checkAll(d) {
  const hard = [];   // category errors
  const soft = [];   // dialogue refs (warnings)
  const E = (cat, type, id, msg) => (cat === 'soft' ? soft : hard).push({ type, id, msg });

  const arr = (x) => (Array.isArray(x) ? x : []);
  const spells     = arr(d.spells?.spells);
  const enemies    = arr(d.enemies?.enemies);
  const items      = arr(d.items?.items).filter(x => x && !x._comment);
  const locations  = arr(d.locations?.locations);
  const quests     = arr(d.quests?.quests);
  const dialogues  = arr(d.dialogues?.dialogues);
  const classes    = arr(d.classes?.classes);
  const companions = arr(d.companions?.companions);
  const recipes    = arr(d.recipes?.recipes);
  const veilkeeps  = arr(d.veilkeepers?.veilkeepers);

  const ids = (list) => new Set(list.map(x => x?.id).filter(Boolean));
  const spellIds    = ids(spells);
  const enemyIds    = ids(enemies);
  const itemIds     = ids(items);
  const locIds      = ids(locations);
  const questIds    = ids(quests);
  const dialogueIds = ids(dialogues);

  // Duplicate-id checks
  const dupCheck = (list, label) => {
    const seen = new Set();
    for (const x of list) {
      if (!x?.id) continue;
      if (seen.has(x.id)) E('hard', label, x.id, `duplicate ${label} id`);
      seen.add(x.id);
    }
  };
  dupCheck(spells, 'spell');
  dupCheck(enemies, 'enemy');
  dupCheck(items, 'item');
  dupCheck(locations, 'location');
  dupCheck(quests, 'quest');
  dupCheck(dialogues, 'dialogue');
  dupCheck(classes, 'class');
  dupCheck(companions, 'companion');
  dupCheck(recipes, 'recipe');
  dupCheck(veilkeeps, 'veilkeeper');

  // Spells: combos
  spells.forEach(sp => arr(sp.combosWith).forEach(c => {
    if (!spellIds.has(c)) E('hard', 'spell', sp.id, `combosWith unknown spell: ${c}`);
  }));

  // Enemies: spells + loot
  enemies.forEach(e => {
    arr(e.spells).forEach(sp => {
      if (!spellIds.has(sp)) E('hard', 'enemy', e.id, `unknown spell: ${sp}`);
    });
    arr(e.lootTable?.items).forEach(drop => {
      if (drop?.itemId && !itemIds.has(drop.itemId)) {
        E('hard', 'enemy', e.id, `lootTable item unknown: ${drop.itemId}`);
      }
    });
  });

  // Quests
  quests.forEach(q => {
    arr(q.objectives).forEach(o => {
      if (!o?.target) return;
      if (o.type === 'kill'    && !enemyIds.has(o.target)) E('hard', 'quest', q.id, `kill objective unknown enemy: ${o.target}`);
      if (o.type === 'collect' && !itemIds.has(o.target))  E('hard', 'quest', q.id, `collect objective unknown item: ${o.target}`);
      if (o.type === 'travel'  && !locIds.has(o.target))   E('hard', 'quest', q.id, `travel objective unknown location: ${o.target}`);
    });
    arr(q.prerequisites).forEach(p => {
      if (p?.type === 'quest' && p.questId && !questIds.has(p.questId)) {
        E('hard', 'quest', q.id, `prerequisite unknown quest: ${p.questId}`);
      }
    });
    if (q.chainQuest && !questIds.has(q.chainQuest)) {
      E('hard', 'quest', q.id, `chainQuest unknown: ${q.chainQuest}`);
    }
    arr(q.rewards?.items).forEach(it => {
      const id = it?.id ?? it?.itemId;
      if (id && !itemIds.has(id)) E('hard', 'quest', q.id, `reward item unknown: ${id}`);
    });
    arr(q.rewards?.spells).forEach(sp => {
      if (sp && !spellIds.has(sp)) E('hard', 'quest', q.id, `reward spell unknown: ${sp}`);
    });
    // Dialogues are optional content — soft warnings only.
    for (const k of ['dialogueId', 'dialogueOnAccept', 'dialogueOnComplete', 'dialogueOnFail']) {
      const v = q[k];
      if (v && !dialogueIds.has(v)) E('soft', 'quest', q.id, `${k} unknown dialogue: ${v}`);
    }
  });

  // Locations
  locations.forEach(loc => {
    arr(loc.connections).forEach(c => {
      if (c && !locIds.has(c)) E('hard', 'location', loc.id, `connection unknown: ${c}`);
    });
    arr(loc.enemies).forEach(e => {
      if (e && !enemyIds.has(e)) E('hard', 'location', loc.id, `enemy unknown: ${e}`);
    });
  });

  // Classes
  classes.forEach(cls => {
    arr(cls.startingSpells).forEach(sp => {
      if (sp && !spellIds.has(sp)) E('hard', 'class', cls.id, `startingSpell unknown: ${sp}`);
    });
  });

  // Companions
  companions.forEach(c => {
    for (const k of ['recruitQuest', 'personalQuest']) {
      const v = c[k];
      if (v && !questIds.has(v)) E('hard', 'companion', c.id, `${k} unknown quest: ${v}`);
    }
    if (c.recruitLocation && !locIds.has(c.recruitLocation)) {
      E('hard', 'companion', c.id, `recruitLocation unknown: ${c.recruitLocation}`);
    }
  });

  // Recipes
  recipes.forEach(r => {
    arr(r.materials).forEach(m => {
      if (m?.itemId && !itemIds.has(m.itemId)) E('hard', 'recipe', r.id, `material unknown: ${m.itemId}`);
    });
    const resultId = r.result?.itemId ?? r.resultItemId;
    if (resultId && !itemIds.has(resultId)) E('hard', 'recipe', r.id, `result item unknown: ${resultId}`);
    if (typeof r.unlockMethod === 'string' && r.unlockMethod.startsWith('find:')) {
      const loc = r.unlockMethod.slice(5);
      if (loc && !locIds.has(loc)) E('hard', 'recipe', r.id, `unlockMethod location unknown: ${loc}`);
    }
  });

  // Veilkeepers
  veilkeeps.forEach(vk => {
    const loc = vk.memorialBuffs?.location;
    if (loc && !locIds.has(loc)) E('hard', 'veilkeeper', vk.id, `memorialBuffs.location unknown: ${loc}`);
  });

  return { hard, soft, counts: {
    spells: spells.length, enemies: enemies.length, items: items.length,
    locations: locations.length, quests: quests.length, dialogues: dialogues.length,
    classes: classes.length, companions: companions.length, recipes: recipes.length,
    veilkeepers: veilkeeps.length,
  }};
}

// ── Reporter ────────────────────────────────────────────────────────
function formatGroup(label, list, max = 30) {
  if (!list.length) return '';
  let out = `\n${label} (${list.length}):\n`;
  const groups = new Map();
  for (const e of list) {
    const k = `${e.type}:${e.id}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e.msg);
  }
  let shown = 0;
  for (const [k, msgs] of groups) {
    if (shown >= max) { out += `  …and ${list.length - shown} more\n`; break; }
    out += `  ${k}\n`;
    for (const m of msgs) { out += `    - ${m}\n`; shown++; }
  }
  return out;
}

async function main() {
  const { data, parseErrors, fileCount } = await loadAll();

  if (parseErrors.length) {
    console.error('[validate-data] JSON parse errors:');
    for (const e of parseErrors) console.error(`  ${e.file}: ${e.message}`);
    process.exit(1);
  }

  const { hard, soft, counts } = checkAll(data);

  console.log(`[validate-data] ${fileCount} files parsed.  ` +
    `spells:${counts.spells} enemies:${counts.enemies} items:${counts.items} ` +
    `locations:${counts.locations} quests:${counts.quests} dialogues:${counts.dialogues} ` +
    `classes:${counts.classes} companions:${counts.companions} recipes:${counts.recipes} ` +
    `veilkeepers:${counts.veilkeepers}`);

  if (hard.length === 0 && soft.length === 0) {
    console.log('[validate-data] ✓ All references resolve.');
    process.exit(0);
  }

  if (hard.length) {
    process.stderr.write(formatGroup('HARD broken references (fail)', hard, 40));
  }
  if (soft.length) {
    process.stdout.write(formatGroup('Soft warnings (missing dialogues — non-blocking)', soft, 20));
  }

  if (hard.length) {
    console.error(`[validate-data] FAILED — ${hard.length} hard broken reference(s).`);
    process.exit(1);
  } else {
    console.log(`[validate-data] OK — ${soft.length} soft warning(s) only.`);
    process.exit(0);
  }
}

main().catch(e => {
  console.error('[validate-data] uncaught:', e);
  process.exit(1);
});
