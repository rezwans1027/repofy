import { expect, it } from 'vitest';
import { humanBoundaryGate, measureReview, measureSourceBoundReview, type ReviewDocument, type ReviewBinding } from '../../../scripts/release/review';
import { rolloutDecision } from '../../../scripts/release/metrics';
const binding: ReviewBinding = { corpusSha256: 'frozen', rubricCasesSha256: 'rubric', renderingSha256: 'rendering',
  cases: [{ id: 'observed', claims: [{ text: 'A bounded observation.', statementId: 'bounded' }] }, { id: 'unknown', claims: [] }],
  rubricCases: [{ id: 'R01', role: 'backend' }] };
const fixture = (): ReviewDocument => ({ corpusSha256: 'frozen', rubricCasesSha256: 'rubric', renderingSha256: 'rendering', requiredIndependentRubricReviewers: 2,
  claimCards: [{ id: 'C01', caseId: 'observed', majorClaim: true, claim: 'A bounded observation.', statementId: 'bounded', expected: 'supported' },
    { id: 'C02', caseId: 'unknown', majorClaim: false, claim: 'Unknown.', statementId: null, expected: 'unknown' }],
  reviews: [{ reviewerId: 'first', reviewType: 'unblinded', independentEngineeringRoleReviewConfirmed: false,
    claimLabels: { C01: 'supported', C02: 'unknown' }, rubricAgreements: { R01: true } }] });
it('separates unknown cards, semantic support and independent empirical calibration', () => {
  const result = measureReview(fixture(), binding);
  expect(result.humanClaimSupport).toMatchObject({ successes: 1, total: 1, rate: 1 });
  expect(result.unknownCards.total).toBe(1);
  expect(result.rubricBoundaryReview).toMatchObject({ rate: 1, independentEngineeringReviewers: 0, empiricallyCalibrated: false });
});
it('missing judgments remain unmeasured, regardless of positive expected labels', () => {
  const f = fixture(); f.reviews[0].claimLabels = {}; f.reviews[0].rubricAgreements = {};
  expect(measureReview(f, binding)).toMatchObject({ completelyReviewed: 0, humanClaimSupport: null, unsupportedMajorClaimRate: null, rubricBoundaryReview: { rate: null } });
});
it('retains disagreement and unsupported labels without doubling the claim denominator', () => {
  const f = fixture(); f.reviews.push({ ...f.reviews[0], reviewerId: 'second', claimLabels: { C01: 'unsupported' }, rubricAgreements: { R01: false } });
  expect(measureReview(f, binding)).toMatchObject({ humanClaimSupport: { rate: 0, total: 1 }, unsupportedMajorClaimRate: { rate: 1, total: 1 }, claimDisagreements: ['C01'] });
  f.reviews[1].reviewerId = 'first'; expect(() => measureReview(f, binding)).toThrow('Duplicate reviewer');
});
it('rejects stale or changed reviewed claims and unknown judgment IDs', () => {
  const f = fixture(); f.corpusSha256 = 'different'; expect(() => measureReview(f, binding)).toThrow();
  f.corpusSha256 = 'frozen'; f.claimCards[0].claim = 'Production is reliable'; expect(() => measureReview(f, binding)).toThrow('Reviewed claim changed');
  f.claimCards[0].claim = 'A bounded observation.'; f.reviews[0].rubricAgreements.R99 = true; expect(() => measureReview(f, binding)).toThrow('Unknown rubric judgment');
});

const source = { reviewedDomainSourceSha256: 'a'.repeat(64), currentDomainSourceSha256: 'a'.repeat(64) };
it('accepts a bound human sample only for the implementation that produced its frozen rendering', () => {
  const review = fixture(), before = structuredClone(review);
  const result = measureSourceBoundReview(review, binding, source);
  expect(result).toMatchObject({ status: 'current', completelyReviewed: 1, humanClaimSupport: { rate: 1, total: 1 } });
  expect(humanBoundaryGate(result).status).toBe('passed');
  expect(result.historicalReview).toEqual(measureReview(review, binding));
  expect(review).toEqual(before);
});
it('keeps earlier approvals historical after a domain change even when the rendered words match', () => {
  const review = fixture(), before = structuredClone(review);
  const result = measureSourceBoundReview(review, binding, { ...source, currentDomainSourceSha256: 'b'.repeat(64) });
  expect(result).toMatchObject({ status: 'stale', reviewCount: 0, completelyReviewed: 0, majorClaimsReviewed: 0,
    humanClaimSupport: null, unsupportedMajorClaimRate: null, rubricBoundaryReview: { rate: null, independentEngineeringReviewers: 0 },
    historicalReview: { completelyReviewed: 1, humanClaimSupport: { successes: 1, total: 1, rate: 1 } } });
  const gate = humanBoundaryGate(result);
  expect(gate.status).toBe('pending');
  expect(rolloutDecision([gate], ['human_boundary_sample'])).toMatchObject({ decision: 'hold', blockers: ['human_boundary_sample'] });
  // Even a consumer copying historical rates back cannot bypass source staleness.
  expect(humanBoundaryGate({ ...result, completelyReviewed: 1, humanClaimSupport: result.historicalReview.humanClaimSupport,
    unsupportedMajorClaimRate: result.historicalReview.unsupportedMajorClaimRate }).status).toBe('pending');
  expect(review).toEqual(before);
});
it('distinguishes absent judgments from stale judgments and never treats null rates as a pass', () => {
  const review = fixture(); review.reviews = [];
  const result = measureSourceBoundReview(review, binding, source);
  expect(result).toMatchObject({ status: 'unreviewed', humanClaimSupport: null, unsupportedMajorClaimRate: null });
  expect(humanBoundaryGate(result).status).toBe('pending');
  review.reviews = [{ ...fixture().reviews[0], claimLabels: { C02: 'unknown' }, rubricAgreements: {} }];
  const partial = measureSourceBoundReview(review, binding, source);
  expect(partial).toMatchObject({ status: 'current', completelyReviewed: 0, humanClaimSupport: null });
  expect(humanBoundaryGate(partial).status).toBe('pending');
});
it('still rejects corrupted frozen review bindings when the implementation has changed', () => {
  const changed = { ...source, currentDomainSourceSha256: 'b'.repeat(64) };
  expect(() => measureSourceBoundReview(fixture(), { ...binding, renderingSha256: 'different' }, changed)).toThrow('different rendered sample');
  const review = fixture(); review.claimCards[0].claim = 'A stronger unapproved claim.';
  expect(() => measureSourceBoundReview(review, binding, changed)).toThrow('Reviewed claim changed');
  expect(() => measureSourceBoundReview(fixture(), binding, { ...source, reviewedDomainSourceSha256: '' })).toThrow('reviewed domain digest');
});
