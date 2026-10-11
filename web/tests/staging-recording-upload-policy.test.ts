import test from 'node:test';
import assert from 'node:assert/strict';
import {assertRecordingUploadFile} from '../src/domain/recordingUploadPolicy';

test('ordinary legacy recording upload retains .aoe2record and .mgz support',()=>{
  assert.doesNotThrow(()=>assertRecordingUploadFile('game.aoe2record',1000,'LEGACY'));
  assert.doesNotThrow(()=>assertRecordingUploadFile('game.MGZ',1000,'LEGACY'));
  assert.doesNotThrow(()=>assertRecordingUploadFile('game.mgz',32*1024*1024,'LEGACY'));
});
test('native experimental upload accepts only bounded .aoe2record and never .mgz',()=>{
  assert.doesNotThrow(()=>assertRecordingUploadFile('game.aoe2record',1000,'NATIVE_VALIDATION_V1'));
  for(const name of ['game.mgz','game.aoe2record.exe','game.exe','bad.aoe2record/'])
    assert.throws(()=>assertRecordingUploadFile(name,1000,'NATIVE_VALIDATION_V1'));
  for(const bytes of [0,-1,NaN,1.25,32*1024*1024+1])
    assert.throws(()=>assertRecordingUploadFile('game.aoe2record',bytes,'NATIVE_VALIDATION_V1'));
});
