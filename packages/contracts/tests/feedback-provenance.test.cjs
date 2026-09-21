const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { FindingReferenceSchema, FindingFeedbackRequestSchema, ReviewRequestSchema, ReviewQueueSchema, ProvenanceAssessmentSchema } = require('../dist');
const snapshot = () => ({ snapshotId: randomUUID(), repositoryId: randomUUID(), commitSha: 'a'.repeat(40), detector: { id: 'provenance_context', version: '1.0.0' }, observedAt: '2026-09-20T00:00:00Z',
  provider: { state: 'unavailable', fork: null, templateOrigin: 'unknown', relationship: 'current_repository_context' },
  history: { state: 'not_requested', records: 0, linkedToConnected: 0, linkedToOthers: 0, unlinked: 0, headIsOnlyRoot: false, relationship: 'pinned_head_and_bounded_ancestors' },
  files: { total: 100, generatedExcluded: 2, generatedMarked: 1, vendorExcluded: 5 }, signals: ['history_unavailable'], limitations: ['not_authorship'],
  contribution: { state: 'unknown', confidence: null, strengthModifier: null, confidenceModifier: null, basis: 'context_only_uncalibrated' } });
test('feedback has typed finding references, exactly four choices, a bounded comment and required revision/idempotency', () => {
  for (const kind of ['claim','evidence','improvement']) assert.equal(FindingReferenceSchema.safeParse({ kind, id: 'path/to/private.ts' }).success, false);
  assert.equal(FindingReferenceSchema.safeParse({ kind: 'capability', id: 'testing_behavior' }).success, true);
  const valid = { classification: 'accurate', expectedRevision: 0, idempotencyKey: randomUUID() };
  for (const classification of ['accurate','inaccurate','unclear','irrelevant']) assert.equal(FindingFeedbackRequestSchema.parse({ ...valid, classification }).comment, '');
  for (const delta of [{ comment: 'x'.repeat(1001) }, { comment: 'hidden\u202etext' }, { expectedRevision: -1 }, { classification: 'fraud' }, { ownerId: randomUUID() }]) assert.equal(FindingFeedbackRequestSchema.safeParse({ ...valid, ...delta }).success, false);
});
test('review contracts allow controlled notes and synthetic cases but no private prose or arbitrary URLs', () => {
  const request = { expectedRevision: 1, expectedReviewRevision: 0, disposition: 'confirmed_issue', note: 'reproduced_synthetic', benchmarkCase: 'run15.fork', idempotencyKey: randomUUID() };
  assert.equal(ReviewRequestSchema.safeParse(request).success, true);
  for (const delta of [{ note: 'PRIVATE_CUSTOMER_SENTINEL' }, { benchmarkCase: 'https://private.example' }, { source: 'private source' }]) assert.equal(ReviewRequestSchema.safeParse({ ...request, ...delta }).success, false);
  const item = { id: randomUUID(), kind: 'evidence', classification: 'unclear', revision: 1, reviewRevision: 0, disposition: 'open', note: null, benchmarkCase: null, detector: null, updatedAt: '2026-09-20T00:00:00Z' };
  assert.equal(ReviewQueueSchema.safeParse({ items: [{ ...item, comment: 'PRIVATE_COMMENT' }], nextId: null }).success, false);
});
test('provenance is closed, unknown contribution is nonnumeric, and file/identity counts remain bounded', () => {
  const valid = { policy: { id: 'provenance_context', version: '1.0.0' }, snapshots: [snapshot()] }; assert.equal(ProvenanceAssessmentSchema.safeParse(valid).success, true);
  for (const change of [s => s.contribution.confidence = 0, s => s.contribution.confidenceModifier = .8, s => s.provider.fork = true,
    s => s.history.linkedToConnected = 1, s => s.files.generatedExcluded = 101, s => s.signals.push('fraud'), s => s.history.email = 'person@example.test', s => s.signals.push('history_unavailable')]) {
    const invalid = structuredClone(valid); change(invalid.snapshots[0]); assert.equal(ProvenanceAssessmentSchema.safeParse(invalid).success, false);
  }
  assert.equal(ProvenanceAssessmentSchema.safeParse({ ...valid, snapshots: [valid.snapshots[0], valid.snapshots[0]] }).success, false);
});
