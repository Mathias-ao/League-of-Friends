import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog, deObjectRows } from './build-aoe2-entity-catalog-v2.mjs';

test('AIRef admission rejects non-DE, multiple-version and conflicting IDs', () => {
  const rows = deObjectRows([[{ id: 1, de: 0 }, { id: 2, de: 1 },
    { id: '3 / 4', de: 1 }, { id: 5, de: 1 }, { id: 5, de: 1 }]]);
  assert.deepEqual([...rows.keys()], [2]);
});

test('version-dependent IDs admit only the explicitly marked DE identity', () => {
  const rows = deObjectRows([[{ id: 'WK: 106<br>DE: 1001', de: 1 },
    { id: '2626', de: 1 }, { id: 'WK: 106', de: 1 }]]);
  assert.deepEqual([...rows.keys()], [1001, 2626]);
  assert.equal(rows.get(1001).id, 'WK: 106<br>DE: 1001');
});

test('upgrade keys are unit IDs; research IDs, costs and duration come from upgrade rows', () => {
  const data = { data: { Building: {}, Tech: {}, Unit: {
    24: { ID: 24, LanguageNameId: 5084, internal_name: 'XBW', Cost: { Gold: 45, Wood: 25 } },
  }, unit_upgrades: { 24: { ID: 100, internal_name: 'Crossbow',
    Cost: { Food: 175, Gold: 100 }, ResearchTime: 35 } } } };
  const catalog = buildCatalog(data, { 14084: 'Crossbowman' }, [[]],
    { sourceVersion: 'test', units: {}, buildings: {}, technologies: {} });
  assert.equal(catalog.units[24].name, 'Crossbowman');
  assert.equal(catalog.technologies[24], undefined);
  assert.equal(catalog.technologies[100].upgradesUnitId, 24);
  assert.deepEqual(catalog.technologies[100].cost, { Food: 175, Gold: 100 });
  assert.equal(catalog.technologies[100].researchTime, 35);
});

test('DE gate aliases carry provenance and do not invent build costs', () => {
  const catalog = buildCatalog({ data: { Building: {}, Unit: {}, Tech: {}, unit_upgrades: {} } },
    {}, [[{ id: 490, name: 'Gate Foundation', class: 'gate-class (939)', line: '', de: 1 },
      { id: 673, name: 'Non-DE Gate', class: 'gate-class (939)', line: '', de: 0 }]],
    { sourceVersion: 'test', units: {}, buildings: {}, technologies: {} });
  assert.equal(catalog.buildings[490].airef.deApplicability, 1);
  assert.equal(catalog.buildings[490].cost, undefined);
  assert.equal(catalog.buildings[673], undefined);
});
