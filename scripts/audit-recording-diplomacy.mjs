import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {projectRecordingDiplomacyReview} from '../functions/lib/engines/recordingDiplomacyReview.js';

const [inputPath,outputPath]=process.argv.slice(2);
if(!inputPath||!outputPath)throw new Error('Expected audit input and review output paths.');
const audit=JSON.parse(await readFile(inputPath,'utf8'));
const recordings=[];
for(const row of audit.recordings){
  const input=row.diplomacyReviewInput;
  const before=JSON.stringify(input);
  const review=projectRecordingDiplomacyReview(input);
  assert.equal(review.status,'REVIEW_AVAILABLE',row.id+': '+review.reason);
  assert.equal(JSON.stringify(input),before);
  assert.equal(review.interpretationEnabled,false);
  assert.equal(review.effectiveCommandPromotionEnabled,false);
  assert.equal(review.absenceQualified,false);
  assert.ok(review.timeline.changes.every(change=>change.effectQualification==='COMMAND_ONLY'&&!change.effectiveStateChanged));
  if(!input.diplomacy.normalizedInitialEdges.length)assert.equal(review.knownPairSegmentCount,0);
  const duplicated=structuredClone(input);
  duplicated.players.reverse();
  duplicated.diplomacy.normalizedInitialEdges.reverse();
  for(const key of Object.keys(duplicated.diplomacy.commandTimelines)){
    const commands=duplicated.diplomacy.commandTimelines[key];
    duplicated.diplomacy.commandTimelines[key]=[...commands,...structuredClone(commands)].reverse();
  }
  assert.deepEqual(projectRecordingDiplomacyReview(duplicated),review,row.id+': rebuild differs');
  const refs=new Set(Object.values(input.diplomacy.commandTimelines).flat().map(event=>event.sourceEventId));
  assert.equal(review.commandCount,refs.size);
  assert.ok(review.timeline.changes.every(change=>refs.has(change.eventId)));
  const result={id:row.id,replayPath:row.replayPath,logicalGameGroup:row.logicalGameGroup,
    sourceCommit:audit.sourceCommit,source:row.source,commandCount:review.commandCount,
    normalizedInitialEdgeCount:review.normalizedInitialEdgeCount,rawInitialVectorCount:review.rawInitialVectorCount,
    knownPairSegmentCount:review.knownPairSegmentCount,unknownPairSegmentCount:review.unknownPairSegmentCount,
    commandedModes:[...new Set(review.timeline.changes.map(c=>c.rawMode))].sort(),
    checks:{immutable:true,rebuildIdentical:true,noEffectivePromotion:true,allCommandReferencesRetained:true},
    diplomacyReview:review};
  recordings.push(result);
  console.log('DIPLOMACY_REVIEW '+JSON.stringify(result));
}
const report={modelVersion:'AOF_REAL_DIPLOMACY_REVIEW_AUDIT_V1',sourceCommit:audit.sourceCommit,
  claim:'command chronology and uncertainty regression; not engine-state qualification',recordings};
await writeFile(outputPath,JSON.stringify(report,null,2)+'\n');
