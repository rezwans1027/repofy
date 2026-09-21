const { test } = require('node:test');
const assert = require('node:assert/strict');
const c = require('../dist');
const { InternalEvidenceObservationSchema } = require('../dist/internal');
const { createSyntheticEvidenceFixture } = require('../dist/testing');
const { randomUUID } = require('node:crypto');
const detail = () => ({kind:'state_guard',confidenceBasis:'resolved_static_pattern',calibration:'uncalibrated',claimBoundary:'observed_control',
  span:{lines:{start:1,end:2},startColumn:1,endColumn:2},symbolId:randomUUID(),conceptId:randomUUID(),patternId:randomUUID(),relations:[],
  testBoundary:'not_a_test',limitations:['A local guard does not prove concurrency safety.']});
test('implementation facts carry closed patterns and source-free opaque references',()=>{
  assert.ok(c.ImplementationObservationSchema.parse(detail()));
  for(const bad of [{...detail(),kind:'secure_system'},{...detail(),source:'private'},{...detail(),symbolId:'privateFunction'},
    {...detail(),calibration:'proven'},{...detail(),claimBoundary:'assertion_source'},{...detail(),span:{lines:{start:2,end:1},startColumn:1,endColumn:1}}]){
    assert.equal(c.ImplementationObservationSchema.safeParse(bad).success,false);
  }
});
test('implementation sources and detector identifiers cannot be confused with structural or test evidence',()=>{
  const value=createSyntheticEvidenceFixture();value.implementation=detail();value.detector={id:'tsjs.state_guard',version:'1.0.0'};value.sourceType='code';
  assert.ok(InternalEvidenceObservationSchema.parse(value));
  for(const changed of [{...value,sourceType:'docs'},{...value,detector:{id:'tsjs.authentication_guard',version:'1.0.0'}},
    {...value,implementation:{...detail(),kind:'asserted_call',testBoundary:'not_a_test',claimBoundary:'assertion_source'}}]){
    assert.equal(InternalEvidenceObservationSchema.safeParse(changed).success,false);
  }
});
