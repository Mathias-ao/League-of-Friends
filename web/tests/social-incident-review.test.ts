import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SocialIncidentReview} from '../src/ui/SocialIncidentReview';
import {BattleRecordContent} from '../src/ui/BattleRecord';
import {projectSocialIncidents} from '../../functions/src/engines/socialIncidentCore.js';
const statistics=JSON.parse(fs.readFileSync(new URL('../../functions/tests/fixtures/social-ffa-diplo.json',import.meta.url),'utf8'));
test('Battle record connects the real incident interpreter and preserves offensive uncertainty',()=>{
 const review=projectSocialIncidents({statistics});
 const html=renderToStaticMarkup(React.createElement(BattleRecordContent,{statistics,socialIncidents:review}));
 assert.ok(html.includes('Social incidents'));assert.ok(html.includes('Response to prior withdrawal'));
 assert.ok(html.includes('unverified targeted orders'));assert.ok(html.includes('offensive semantics unqualified'));
 assert.ok(html.includes('Official reputation, relationships and rewards are unchanged'));
});
test('standalone review renders unavailable legacy input and escapes supplied names',()=>{
 const legacy=renderToStaticMarkup(React.createElement(SocialIncidentReview,{statistics:{},name:String}));
 assert.ok(legacy.includes('unavailable'));
 const r=projectSocialIncidents({statistics});
 const html=renderToStaticMarkup(React.createElement(SocialIncidentReview,{review:r,name:()=>'<script>bad</script>'}));
 assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;bad'));
});
