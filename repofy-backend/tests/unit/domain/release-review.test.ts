import { expect, it } from 'vitest';
import { measureReview, type ReviewDocument, type ReviewBinding } from '../../../scripts/release/review';
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
