import fsp from 'node:fs/promises';
import path from 'node:path';

const SOURCE_VERSION = 'b9d494df6921d4080df69b22f9dbb7a4d1dcd9f0';
const BASE = `https://raw.githubusercontent.com/SiegeEngineers/aoe2techtree/${SOURCE_VERSION}`;
const outputPath = path.resolve(process.argv[2] ?? `replay-tools/entity-catalog/aoe2techtree-${SOURCE_VERSION.slice(0, 12)}.json`);

const KNOWN_ENTITY_OVERRIDES = {
  building: {
    12: { name: 'Barracks', roleKeys: ['barracks', 'military_production'] },
    45: { name: 'Dock', roleKeys: ['dock', 'naval_economy', 'naval_production'] },
    50: { name: 'Farm', roleKeys: ['farm', 'economy'] },
    68: { name: 'Mill', roleKeys: ['mill', 'economy'] },
    70: { name: 'House', roleKeys: ['house'] },
    72: { name: 'Palisade Wall', roleKeys: ['wall', 'fortification'] },
    79: { name: 'Watch Tower', roleKeys: ['tower', 'fortification'] },
    84: { name: 'Market', roleKeys: ['market', 'economy'] },
    87: { name: 'Archery Range', roleKeys: ['archery_range', 'military_production'] },
    101: { name: 'Stable', roleKeys: ['stable', 'military_production'] },
    103: { name: 'Blacksmith', roleKeys: ['blacksmith', 'military_upgrade'] },
    109: { name: 'Town Center', roleKeys: ['town_center', 'economy', 'population_production'] },
    562: { name: 'Lumber Camp', roleKeys: ['lumber_camp', 'economy'] },
    584: { name: 'Mining Camp', roleKeys: ['mining_camp', 'economy'] },
    598: { name: 'Outpost', roleKeys: ['outpost', 'vision'] },
    621: { name: 'Town Center', roleKeys: ['town_center', 'economy', 'population_production'] },
    1665: { name: 'Donjon', roleKeys: ['tower', 'fortification', 'military_production'] },
    1808: { name: 'Mule Cart', roleKeys: ['mobile_dropoff', 'economy'] },
  },
  unit: {
    4: { name: 'Archer', roleKeys: ['archer', 'land_military', 'ranged'] },
    7: { name: 'Skirmisher', roleKeys: ['skirmisher', 'land_military', 'ranged'] },
    13: { name: 'Fishing Ship', roleKeys: ['fishing_ship', 'economic_unit', 'water_unit'] },
    17: { name: 'Trade Cog', roleKeys: ['trade_unit', 'economic_unit', 'water_unit'] },
    38: { name: 'Knight', roleKeys: ['knight', 'land_military', 'cavalry'] },
    74: { name: 'Militia', roleKeys: ['militia', 'land_military', 'infantry'] },
    75: { name: 'Man-at-Arms', roleKeys: ['man_at_arms', 'land_military', 'infantry'] },
    83: { name: 'Villager', roleKeys: ['villager', 'economic_unit'] },
    93: { name: 'Spearman', roleKeys: ['spearman', 'land_military', 'infantry'] },
    125: { name: 'Monk', roleKeys: ['monk', 'land_military', 'support'] },
    128: { name: 'Trade Cart', roleKeys: ['trade_unit', 'economic_unit'] },
    448: { name: 'Scout Cavalry', roleKeys: ['scout_cavalry', 'land_military', 'cavalry', 'raider'] },
    539: { name: 'Galley', roleKeys: ['galley', 'water_military', 'ranged'] },
    545: { name: 'Transport Ship', roleKeys: ['transport_ship', 'water_unit'] },
    1103: { name: 'Fire Galley', roleKeys: ['fire_galley', 'water_military'] },
    1104: { name: 'Demolition Raft', roleKeys: ['demolition_raft', 'water_military'] },
  },
  technology: {
    8: { name: 'Town Watch', roleKeys: ['town_watch'] },
    14: { name: 'Horse Collar', roleKeys: ['horse_collar', 'eco_tech'] },
    22: { name: 'Loom', roleKeys: ['loom', 'eco_tech'] },
    101: { name: 'Feudal Age', roleKeys: ['feudal_age'] },
    102: { name: 'Castle Age', roleKeys: ['castle_age'] },
    103: { name: 'Imperial Age', roleKeys: ['imperial_age'] },
    202: { name: 'Double-Bit Axe', roleKeys: ['double_bit_axe', 'eco_tech'] },
    213: { name: 'Wheelbarrow', roleKeys: ['wheelbarrow', 'eco_tech'] },
    906: { name: 'Fishing Lines', roleKeys: ['fishing_lines', 'eco_tech', 'water_economy'] },
  },
};

function knownOverride(kind, id) {
  return KNOWN_ENTITY_OVERRIDES[kind]?.[id] ?? null;
}


async function getJson(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'Age-of-Friends-entity-catalog-builder/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  return response.json();
}

function cleanName(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>(?:\n)?/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactEntry(kind, raw, strings) {
  const id = Number(raw.ID);
  const languageNameId = Number(raw.LanguageNameId);
  const localized = Number.isFinite(languageNameId) ? strings[String(languageNameId)] : null;
  const override = knownOverride(kind, id);
  const name = cleanName(override?.name || localized || raw.internal_name || `${kind} ${id}`);
  const result = {
    id,
    name,
    internalName: raw.internal_name ?? null,
    kind,
    roleKeys: override?.roleKeys ?? [],
  };
  if (raw.Cost && typeof raw.Cost === 'object') result.cost = raw.Cost;
  if (Number.isFinite(Number(raw.TrainTime))) result.trainTime = Number(raw.TrainTime);
  if (Number.isFinite(Number(raw.ResearchTime))) result.researchTime = Number(raw.ResearchTime);
  return result;
}

const [data, strings] = await Promise.all([
  getJson(`${BASE}/data/data.json`),
  getJson(`${BASE}/data/locales/en/strings.json`),
]);

const catalog = {
  schemaVersion: 'AOF_ENTITY_CATALOG_V1_1',
  sourceVersion: `aoe2techtree@${SOURCE_VERSION}`,
  source: {
    repository: 'SiegeEngineers/aoe2techtree',
    commit: SOURCE_VERSION,
    dataPath: 'data/data.json',
    localePath: 'data/locales/en/strings.json',
  },
  buildings: {},
  units: {},
  technologies: {},
};

for (const [id, raw] of Object.entries(data?.data?.Building ?? {})) {
  catalog.buildings[id] = compactEntry('building', raw, strings);
}
for (const [id, raw] of Object.entries(data?.data?.Unit ?? {})) {
  catalog.units[id] = compactEntry('unit', raw, strings);
}
for (const [id, raw] of Object.entries(data?.data?.Tech ?? {})) {
  catalog.technologies[id] = compactEntry('technology', raw, strings);
}

await fsp.mkdir(path.dirname(outputPath), { recursive: true });
await fsp.writeFile(outputPath, JSON.stringify(catalog, null, 2) + '\n');
console.log(`Wrote ${outputPath}`);
console.log(`Buildings=${Object.keys(catalog.buildings).length}, units=${Object.keys(catalog.units).length}, technologies=${Object.keys(catalog.technologies).length}`);
console.log(`Source=${catalog.sourceVersion}`);
