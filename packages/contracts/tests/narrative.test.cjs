const { test }=require('node:test');
const assert=require('node:assert/strict');
const { NarrativeSelectionSchema, GeneralizedNarrativeSchema, ImprovementPriorityTraceSchema }=require('../dist');
test('model selection has no channel for prose, prices, scores, paths or provider tools',()=>{
  const empty={schemaVersion:'1.0.0',explanations:[],improvements:[]};
  assert.equal(NarrativeSelectionSchema.safeParse(empty).success,true);
  for(const key of ['text','confidence','priority','path','price','tools'])assert.equal(NarrativeSelectionSchema.safeParse({...empty,[key]:'private'}).success,false);
});
test('generalized narrative cannot carry owner identifiers or nested repository details',()=>{
  const base={projection:'generalized',policy:'bounded_narrative_1.0.0',capabilities:[{capabilityId:'api_design',state:'unknown',strength:null,confidence:null}]};
  assert.equal(GeneralizedNarrativeSchema.safeParse(base).success,true);
  for(const key of ['ownerUserId','repositoryId','evidenceIds','summary','location'])assert.equal(GeneralizedNarrativeSchema.safeParse({...base,[key]:'private'}).success,false);
  assert.equal(GeneralizedNarrativeSchema.safeParse({...base,capabilities:[{...base.capabilities[0],text:'private'}]}).success,false);
});
test('ranking terms are bounded and never divide by zero',()=>{
  const terms={roleRelevance:.1,gap:.5,expectedProof:.5,confidence:.5,effortCost:.25,confidenceBasis:'assessed_evidence'};
  assert.equal(ImprovementPriorityTraceSchema.safeParse(terms).success,true);
  assert.equal(ImprovementPriorityTraceSchema.safeParse({...terms,effortCost:0}).success,false);
  assert.equal(ImprovementPriorityTraceSchema.safeParse({...terms,confidence:1.1}).success,false);
});
