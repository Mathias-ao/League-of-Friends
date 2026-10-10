import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {decodeReplayStatistics, encodeReplayStatistics, replayArtifactSha256, verifiedReplayArtifactSave} from '../lib/services/replayStatisticsStorage.js';

const raw = {statisticsSchemaVersion:'AOF_CANONICAL_STATISTICS_V1',source:{replaySha256:'e'.repeat(64)},participants:Array.from({length:8},(_,i)=>({slot:i+1,records:Array.from({length:4000},(_,n)=>({at:n*10,kind:'ORDER',units:[1,2,3],notes:'full original evidence without omission'}))}))};

test('gzip saves all eight-player statistics, preserving exact JSON bytes and dual SHA-256 metadata',()=>{
  const artifact=encodeReplayStatistics(raw);
  const original=Buffer.from(JSON.stringify(raw));
  const metadata={...artifact.metadata,path:'a/statistics.json.gz'};
  assert.equal(metadata.format,'json');assert.equal(metadata.compression,'gzip');
  assert.ok(artifact.bytes.length < original.length);
  assert.equal(metadata.bytes,artifact.bytes.length);
  assert.equal(metadata.uncompressedBytes,original.length);
  assert.equal(metadata.sha256,replayArtifactSha256(artifact.bytes));
  assert.equal(metadata.uncompressedSha256,replayArtifactSha256(original));
  assert.deepEqual(decodeReplayStatistics(artifact.bytes,metadata),raw);
});

test('rejects tampered stored bytes, digest, original digest, lengths, codecs and invalid gzip',()=>{
  const artifact=encodeReplayStatistics(raw), metadata={...artifact.metadata,path:'a/statistics.json.gz'};
  const fail=(bytes,changes)=>assert.throws(()=>decodeReplayStatistics(bytes,{...metadata,...changes}));
  const damaged=Buffer.from(artifact.bytes);damaged[damaged.length-5]^=1;
  fail(damaged,{});
  fail(artifact.bytes,{sha256:'0'.repeat(64)});
  fail(artifact.bytes,{uncompressedSha256:'0'.repeat(64)});
  fail(artifact.bytes,{bytes:artifact.bytes.length+1});
  fail(artifact.bytes,{uncompressedBytes:metadata.uncompressedBytes-1});
  fail(artifact.bytes,{compression:'br'});
  fail(artifact.bytes,{format:'xml'});
  fail(artifact.bytes,{path:'a/statistics.json'});
  const invalidJson=Buffer.from('not json'), invalidGzip=gzipSync(invalidJson);
  fail(invalidGzip,{sha256:replayArtifactSha256(invalidGzip),bytes:invalidGzip.length,uncompressedBytes:invalidJson.length,uncompressedSha256:replayArtifactSha256(invalidJson)});
});

test('legacy uncompressed JSON stays readable and SHA-256 checked',()=>{
  const bytes=Buffer.from(JSON.stringify(raw)), metadata={path:'a/statistics.json',sha256:replayArtifactSha256(bytes)};
  assert.deepEqual(decodeReplayStatistics(bytes,metadata),raw);
  assert.throws(()=>decodeReplayStatistics(Buffer.from('tampered'),metadata),/SHA-256/);
});

test('non-resumable upload verifies exact downloaded bytes and removes corrupt object',async()=>{
  const artifact=encodeReplayStatistics(raw);
  let saved, options, deleted=false;
  const file={save:async(bytes,opts)=>{saved=Buffer.from(bytes);options=opts;},download:async()=>[Buffer.from(saved)],delete:async()=>{deleted=true;}};
  await verifiedReplayArtifactSave(file,artifact.bytes,artifact.metadata.sha256,'application/gzip');
  assert.deepEqual(saved,artifact.bytes);
  assert.equal(options.resumable,false);assert.equal(options.metadata.contentType,'application/gzip');
  assert.equal(deleted,false);
  let unexpectedSaves=0;
  file.save=async()=>{unexpectedSaves++;};
  await assert.rejects(
    verifiedReplayArtifactSave(file,artifact.bytes,'0'.repeat(64),'application/gzip'),
    /source integrity/
  );
  assert.equal(unexpectedSaves,0);
  file.save=async(bytes,opts)=>{saved=Buffer.from(bytes);options=opts;};
  file.download=async()=>[Buffer.from('truncated')];
  await assert.rejects(verifiedReplayArtifactSave(file,artifact.bytes,artifact.metadata.sha256,'application/gzip'),/verification failed/);
  assert.equal(deleted,true);
});
