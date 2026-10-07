import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

export const PRIMARY_COMMIT = '3bb43b1439eef88dfe7fe892d7f7dc41ac9dd76f';
export const AIREF_COMMIT = '9d75d03a41a81c3b573f44296a93852d5283005a';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clean = value => String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const sha256 = value => createHash('sha256').update(value).digest('hex');
const execFileAsync = promisify(execFile);

// AI class constants are reference labels, not observed replay class IDs.
const UNIT_ROLES = {
  'archery-class': ['archer', 'land_military', 'ranged'],
  'archery-cannon-class': ['archer', 'land_military', 'ranged'],
  'cavalry-archer-class': ['archer', 'land_military', 'cavalry_archer', 'ranged'],
  'cavalry-cannon-class': ['archer', 'land_military', 'cavalry_archer', 'ranged'],
  'cavalry-class': ['land_military', 'cavalry'],
  'scout-cavalry-class': ['land_military', 'cavalry', 'raider'],
  'infantry-class': ['land_military', 'infantry'],
  'monastery-class': ['land_military', 'monk', 'support'],
  'monk-with-relic-class': ['land_military', 'monk', 'support'],
  'siege-weapon-class': ['land_military', 'siege'],
  'scorpion-class': ['land_military', 'siege'],
  'packed-trebuchet-class': ['land_military', 'siege'],
  'unpacked-trebuchet-class': ['land_military', 'siege'],
  'petard-class': ['land_military', 'siege'],
  'warship-class': ['water_military'],
  'fishing-ship-class': ['fishing_ship', 'economic_unit', 'water_unit'],
  'trade-cog-class': ['trade_unit', 'economic_unit', 'water_unit'],
  'trade-cart-class': ['trade_unit', 'economic_unit'],
  'transport-ship-class': ['transport_ship', 'water_unit'],
  'villager-class': ['villager', 'economic_unit'],
};

export function deObjectRows(groups) {
  const candidates = new Map();
  for (const row of groups.flat()) {
    // Resolve a version-dependent string ONLY through its explicit DE value.
    // Preserve the original representation in every imported row's provenance.
    if (row.de !== 1) continue;
    let id = row.id;
    if (typeof id === 'string') {
      if (/^\d+$/.test(id)) id = Number(id);
      else {
        const matches = [...id.matchAll(/(?:^|<br\s*\/?\s*>)\s*DE:\s*(\d+)(?=<br|$)/g)];
        if (matches.length !== 1) continue;
        id = Number(matches[0][1]);
      }
    }
    if (!Number.isSafeInteger(id)) continue;
    const rows = candidates.get(id) ?? [];
    rows.push(row);
    candidates.set(id, rows);
  }
  return new Map([...candidates].filter(([, rows]) => rows.length === 1)
    .map(([id, rows]) => [id, rows[0]]));
}

export function buildCatalog(data, strings, groups, legacy, hashes = {}, trees = {}) {
  const refs = deObjectRows(groups);
  const result = {
    schemaVersion: 'AOF_ENTITY_CATALOG_V1_2',
    sourceVersion: `aoe2techtree@${PRIMARY_COMMIT}+airef@${AIREF_COMMIT}`,
    referenceGameBuild: 185872,
    source: { repository: 'SiegeEngineers/aoe2techtree', commit: PRIMARY_COMMIT,
      dataPath: 'data/data.json', localePath: 'data/locales/en/strings.json',
      declaredBuildPath: 'index.html', hashes },
    supplementarySource: { repository: 'airef/airef.github.io', commit: AIREF_COMMIT,
      dataPath: 'js/commands.js', tablePath: 'tables/objects.html', requiredDeFlag: 1 },
    legacyRoleSource: legacy.sourceVersion,
    buildings: {}, units: {}, technologies: {},
  };
  for (const [section, sourceKind, kind] of [
    ['buildings', 'Building', 'building'], ['units', 'Unit', 'unit'],
    ['technologies', 'Tech', 'technology'],
  ]) {
    for (const [key, raw] of Object.entries(data.data[sourceKind])) {
      if (String(raw.ID) !== key) throw new Error(`Mismatched ${sourceKind} ID ${key}`);
      const ref = kind !== 'technology' ? refs.get(raw.ID) : null;
      const offset = kind === 'technology' ? 10000 : 9000;
      const localized = strings[String(Number(raw.LanguageNameId) + offset)];
      const row = { id: raw.ID, name: clean(localized || ref?.name || raw.internal_name),
        internalName: raw.internal_name ?? null, kind,
        roleKeys: [...(legacy[section][key]?.roleKeys ?? [])] };
      if (raw.Cost) row.cost = raw.Cost;
      if (Number.isFinite(raw.TrainTime)) row.trainTime = raw.TrainTime;
      if (Number.isFinite(raw.ResearchTime)) row.researchTime = raw.ResearchTime;
      if (ref) {
        const classKey = ref.class.replace(/ \(\d+\)$/, '');
        const roles = kind === 'unit' ? UNIT_ROLES[classKey] ?? [] : [];
        row.roleKeys = [...new Set([...row.roleKeys, ...roles])];
        row.referenceClass = ref.class;
        row.referenceLine = ref.line;
        row.fieldProvenance = { referenceClass: 'airef', referenceLine: 'airef',
          roleKeys: roles.length ? 'legacy_curated_roles+airef_de_class' : 'legacy_curated_roles',
          ...(localized ? {} : { name: 'airef' }) };
        row.airef = { sourceCommit: AIREF_COMMIT, sourceTablePath: 'tables/objects.html',
          sourceDataPath: 'js/commands.js', rawObjectId: ref.id, deApplicability: ref.de };
      }
      result[section][key] = row;
    }
  }
  // This source stores upgrade research separately from ordinary technologies.
  // Keys are upgraded UNIT IDs; raw.ID is the TECHNOLOGY ID.
  for (const [unitId, raw] of Object.entries(data.data.unit_upgrades)) {
    const key = String(raw.ID);
    if (result.technologies[key]) continue; // Primary technology row takes precedence.
    const row = { id: raw.ID, name: clean(raw.internal_name),
      internalName: raw.internal_name, kind: 'technology', roleKeys: ['unit_upgrade'],
      cost: raw.Cost, researchTime: raw.ResearchTime, upgradesUnitId: Number(unitId),
      sourceSection: 'data.unit_upgrades' };
    if (!Number.isSafeInteger(raw.ID) || !result.units[unitId]) {
      throw new Error(`Invalid upgrade ${unitId}`);
    }
    result.technologies[key] = row;
  }
  // Current primary upgrade links disambiguate elite IDs that AIRef still lists
  // under older IDs. Inherit roles, never copy the older object ID or its costs.
  for (const [treePath, tree] of Object.entries(trees)) {
    for (const link of tree.units_techs ?? []) {
      if (link.use_type !== 'Unit' || !['Unit', 'UniqueUnit'].includes(link.link_node_type)) continue;
      const row = result.units[link.node_id];
      const base = result.units[link.link_id];
      if (!row || !base || row.roleKeys.length || !base.roleKeys.length) continue;
      row.roleKeys = [...base.roleKeys];
      row.roleSource = { repository: 'SiegeEngineers/aoe2techtree', commit: PRIMARY_COMMIT,
        path: treePath, baseUnitId: link.link_id, upgradedUnitId: link.node_id,
        method: 'inherit_role_from_primary_upgrade_link' };
    }
  }
  // Gate foundations are valid placement IDs absent from the primary tech tree.
  // Import labels only: a foundation ID has no independently sourced build cost.
  for (const [id, ref] of refs) {
    if (!ref.class.startsWith('gate-class ') || result.buildings[id]) continue;
    result.buildings[id] = { id, name: clean(ref.name), internalName: null,
      kind: 'building', roleKeys: ['gate', 'fortification'],
      referenceClass: ref.class, referenceLine: ref.line,
      fieldProvenance: { name: 'airef', roleKeys: 'airef_de_class',
        referenceClass: 'airef', referenceLine: 'airef' },
      airef: { sourceCommit: AIREF_COMMIT, sourceTablePath: 'tables/objects.html',
        sourceDataPath: 'js/commands.js', rawObjectId: ref.id, deApplicability: ref.de } };
  }
  return result;
}

async function main() {
  const { values } = parseArgs({ options: {
    'primary-dir': { type: 'string' }, 'airef-dir': { type: 'string' },
    out: { type: 'string', default: path.join(ROOT, 'replay-tools/entity-catalog/aoe2de-185872-v2.json') },
  } });
  async function read(directory, repository, commit, relative) {
    if (directory) {
      // Read the pinned Git object rather than potentially dirty working files.
      const { stdout } = await execFileAsync('git', ['show', `${commit}:${relative}`],
        { cwd: directory, maxBuffer: 16 * 1024 * 1024 });
      return stdout;
    }
    const response = await fetch(`https://raw.githubusercontent.com/${repository}/${commit}/${relative}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${relative}`);
    return response.text();
  }
  const treePaths = ['data/trees/SAXONS.json', 'data/trees/VARANGIANS.json', 'data/trees/SHU.json'];
  const [dataText, stringsText, indexText, aiText, legacy, ...treeTexts] = await Promise.all([
    read(values['primary-dir'], 'SiegeEngineers/aoe2techtree', PRIMARY_COMMIT, 'data/data.json'),
    read(values['primary-dir'], 'SiegeEngineers/aoe2techtree', PRIMARY_COMMIT, 'data/locales/en/strings.json'),
    read(values['primary-dir'], 'SiegeEngineers/aoe2techtree', PRIMARY_COMMIT, 'index.html'),
    read(values['airef-dir'], 'airef/airef.github.io', AIREF_COMMIT, 'js/commands.js'),
    fs.readFile(path.join(ROOT, 'replay-tools/entity-catalog/aoe2techtree-b9d494df6921.json'), 'utf8').then(JSON.parse),
    ...treePaths.map(relative => read(values['primary-dir'], 'SiegeEngineers/aoe2techtree', PRIMARY_COMMIT, relative)),
  ]);
  if (!indexText.includes('definitive-edition-update-185872/')) throw new Error('Unexpected primary game build');
  const context = vm.createContext({ urlPrefix: '..' });
  vm.runInContext(aiText, context, { timeout: 10000 });
  const catalog = buildCatalog(JSON.parse(dataText), JSON.parse(stringsText), context.objectsArray,
    legacy, { data: sha256(dataText), locale: sha256(stringsText), index: sha256(indexText),
      airefData: sha256(aiText), ...Object.fromEntries(treePaths.map((p, i) => [p, sha256(treeTexts[i])])) },
    Object.fromEntries(treePaths.map((p, i) => [p, JSON.parse(treeTexts[i])])));
  await fs.writeFile(values.out, JSON.stringify(catalog, null, 2) + '\n');
  console.log(`Wrote ${values.out}: ${Object.keys(catalog.units).length} units, ${Object.keys(catalog.technologies).length} technologies, ${Object.keys(catalog.buildings).length} buildings`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
