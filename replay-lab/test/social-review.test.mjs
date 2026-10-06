import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectSocialIncidents} from '../../functions/src/engines/socialIncidentCore.js';
import {socialIncidentHtml} from '../public/social-review.js';
test('real social review renders source-backed response context and unavailable attack gates',()=>{
 const s=JSON.parse(fs.readFileSync(new URL('../../functions/tests/fixtures/social-ffa-diplo.json',import.meta.url)));
 const r=projectSocialIncidents({statistics:s});const html=socialIncidentHtml(r);
 assert.match(html,/Bot\(Halvar\)/);assert.match(html,/response after withdrawal/);
 assert.match(html,/unverified targeted orders/);assert.match(html,/offensive semantics unqualified/);
 assert.match(html,/Official reputation, relationships and rewards are unchanged/);
});
test('social rendering escapes names and malformed/missing evidence remains unavailable',()=>{
 const r={status:'REVIEW_AVAILABLE',participants:[{playerId:1,name:'<script>alert(1)</script>'},{playerId:2,name:'Bob'}],
 exposure:[],decisions:[],incidents:[{incidentId:'x',actorPlayerId:1,targetPlayerId:2,moment:{atMs:1234},role:'CONTESTED_WITHDRAWAL',
 qualifiedOffenses:[],targetedOrderCandidates:[],counterpartDeclaration:'ALLY',sourceEventIds:['<img>'],anchorEventId:'<img>'}]};
 const html=socialIncidentHtml(r);assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img&gt;/);
 assert.match(socialIncidentHtml(null),/Unavailable/);
});
