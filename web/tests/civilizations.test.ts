import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CIVILIZATION_CATALOGUE_SOURCE,
  CIVILIZATION_CATALOGUE_VERSION,
  civilizationById,
  civilizationCatalogue,
  civilizationName
} from '../src/data/civilizations';

test('civilization catalogue is complete and source-versioned',()=>{
  assert.equal(CIVILIZATION_CATALOGUE_VERSION,'AOF_CIVILIZATION_CATALOGUE_V1');
  assert.equal(CIVILIZATION_CATALOGUE_SOURCE.kind,'AOE2_DE_GAME_DERIVED_REFERENCE');
  assert.equal(civilizationCatalogue.length,53);
  assert.equal(new Set(civilizationCatalogue.map(civ=>civ.id)).size,civilizationCatalogue.length);
  for(const civ of civilizationCatalogue){
    assert.ok(civ.typeLabel.endsWith('civilization'),civ.id+' type');
    assert.ok(civ.identity.endsWith('focus'),civ.id+' identity');
    assert.ok(civ.bonuses.length>0,civ.id+' bonuses');
    assert.ok(civ.teamBonus.length>0,civ.id+' team bonus');
    assert.ok(civ.uniqueUnits.length>0,civ.id+' unique units');
    assert.ok(civ.sourceHelpStringId>0,civ.id+' source help string');
  }
});

test('draft identifiers resolve to current civilization presentation facts',()=>{
  const franks=civilizationById('FRANKS');
  assert.equal(franks?.name,'Franks');
  assert.equal(franks?.identity,'Cavalry focus');
  assert.match(franks?.teamBonus??'',/Knight-line/i);
  assert.equal(civilizationName('BYZANTINES'),'Byzantines');
});
