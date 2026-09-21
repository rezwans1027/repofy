const { test } = require('node:test');
const assert = require('node:assert/strict');
const c = require('../dist');
const { InternalEvidenceObservationSchema } = require('../dist/internal');
const { createSyntheticEvidenceFixture } = require('../dist/testing');
const detail = () => ({ kind:'dependency', confidenceBasis:'parsed_declaration', calibration:'uncalibrated', claimBoundary:'dependency_presence',
  limitations:['Presence does not establish use.'], counts:{production:1}, technologies:['react'] });
test('structural evidence has a closed fact vocabulary and source-specific claim boundary',()=>{
  const value=detail(); assert.ok(c.StructuralObservationSchema.parse(value));
  for(const changed of [{...value,claimBoundary:'source_structure_only'},{...value,technologies:['PRIVATE_PACKAGE_NAME']},{...value,counts:{rawSource:1}},
    {...value,counts:{production:-1}},{...value,path:'private/path'},{...value,confidenceBasis:'provider_record'}]) assert.equal(c.StructuralObservationSchema.safeParse(changed).success,false);
  const evidence=createSyntheticEvidenceFixture(); evidence.structural=value;
  assert.equal(InternalEvidenceObservationSchema.safeParse(evidence).success,false);
  evidence.sourceType='dependency'; assert.ok(InternalEvidenceObservationSchema.parse(evidence));
});
test('exact-commit result boundaries require typed exact-commit provider context',()=>{
  const value={...detail(),kind:'check',confidenceBasis:'provider_record',claimBoundary:'exact_commit_result',counts:{},technologies:[],
    provider:{retrievedAt:'2026-09-20T00:00:00Z',subjectSha:'a'.repeat(40),relationship:'exact_commit',result:'success',authorMatch:'unavailable',authorType:'unknown'}};
  assert.ok(c.StructuralObservationSchema.parse(value));
  value.provider.relationship='repository_context'; assert.equal(c.StructuralObservationSchema.safeParse(value).success,false);
  value.claimBoundary='historical_context'; assert.ok(c.StructuralObservationSchema.parse(value));
});
test('processing and metadata counters distinguish failures and missing signals without invented records',()=>{
  const processing={source:'configuration',eligibleFiles:4,analyzedFiles:1,parseFailures:1,unsupportedFiles:1,limitedFiles:1,noSignalFiles:1};
  assert.ok(c.SourceProcessingSchema.parse(processing));
  assert.equal(c.SourceProcessingSchema.safeParse({...processing,analyzedFiles:2}).success,false);
  assert.equal(c.SourceProcessingSchema.safeParse({...processing,noSignalFiles:2}).success,false);
  for(const state of ['not_requested','no_signal','permission_denied','provider_unavailable','parse_failure','processing_limit']){
    assert.ok(c.MetadataCoverageSchema.parse({source:'checks',state,records:0,exactCommitRecords:0}));
    assert.equal(c.MetadataCoverageSchema.safeParse({source:'checks',state,records:1,exactCommitRecords:0}).success,false);
  }
  assert.equal(c.MetadataCoverageSchema.safeParse({source:'checks',state:'available',records:0,exactCommitRecords:0}).success,false);
});
