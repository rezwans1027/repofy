import assert from 'node:assert/strict';
import { proportion } from './metrics';

type Label = 'supported' | 'unsupported' | 'unknown' | 'uncertain';
export interface ReviewDocument {
  corpusSha256: string;
  rubricCasesSha256: string;
  renderingSha256: string;
  requiredIndependentRubricReviewers: number;
  claimCards: { id: string; caseId: string; majorClaim: boolean; claim: string; statementId: string | null; expected: Label }[];
  reviews: { reviewerId: string; reviewType: string; independentEngineeringRoleReviewConfirmed: boolean;
    claimLabels: Record<string, Label>; rubricAgreements: Record<string, boolean> }[];
}
export interface ReviewBinding {
  corpusSha256: string;
  rubricCasesSha256: string;
  renderingSha256: string;
  cases: { id: string; claims: { text: string; statementId: string }[] }[];
  rubricCases: { id: string; role: string }[];
}

// Read actual judgments, never substitute expected labels for missing answers.
// Repeated reviewers cannot enlarge the claim sample or satisfy independence.
export function measureReview(document: ReviewDocument, binding: ReviewBinding) {
  assert.equal(document.corpusSha256, binding.corpusSha256, 'Review is for a different frozen corpus');
  assert.equal(document.rubricCasesSha256, binding.rubricCasesSha256, 'Review is for different rubric boundaries');
  assert.equal(document.renderingSha256, binding.renderingSha256, 'Review is for a different rendered sample');
  assert.equal(document.requiredIndependentRubricReviewers, 2);
  const cards = document.claimCards, reviews = document.reviews;
  assert.equal(new Set(cards.map(c => c.id)).size, cards.length);
  assert.equal(new Set(cards.map(c => c.caseId)).size, binding.cases.length);
  assert.equal(cards.length, binding.cases.length, 'Every evaluation case must have a review card');
  assert.equal(new Set(reviews.map(r => r.reviewerId)).size, reviews.length, 'Duplicate reviewer');
  for (const card of cards) {
    const result = binding.cases.find(c => c.id === card.caseId);
    assert.ok(result, 'Unknown reviewed case');
    if (card.majorClaim) assert.ok(result.claims.some(c => c.text === card.claim && c.statementId === card.statementId), `Reviewed claim changed: ${card.id}; obtain a new review`);
    else { assert.equal(result.claims.length, 0); assert.equal(card.statementId, null); assert.equal(card.expected, 'unknown'); }
  }
  for (const review of reviews) {
    assert.ok(review.reviewerId.trim() && review.reviewType.trim());
    for (const [id, label] of Object.entries(review.claimLabels)) {
      assert.ok(cards.some(c => c.id === id), 'Unknown claim judgment');
      assert.ok(['supported', 'unsupported', 'unknown', 'uncertain'].includes(label));
    }
    for (const [id, agreement] of Object.entries(review.rubricAgreements)) {
      assert.ok(binding.rubricCases.some(c => c.id === id), 'Unknown rubric judgment');
      assert.equal(typeof agreement, 'boolean');
    }
  }
  const rated = cards.map(card => ({ ...card, labels: reviews.flatMap(r => r.claimLabels[card.id] ? [r.claimLabels[card.id]] : []) })).filter(c => c.labels.length);
  const major = rated.filter(c => c.majorClaim);
  const rubricRatings = binding.rubricCases.flatMap(c => reviews.flatMap(r =>
    typeof r.rubricAgreements[c.id] === 'boolean' ? [{ ...c, agrees: r.rubricAgreements[c.id] }] : []));
  const agreement = (items: { agrees: boolean }[]) => proportion(items.filter(i => i.agrees).length, items.length);
  return {
    reviewCount: reviews.length,
    completelyReviewed: reviews.filter(r => cards.every(c => r.claimLabels[c.id]) && binding.rubricCases.every(c => typeof r.rubricAgreements[c.id] === 'boolean')).length,
    majorClaimsReviewed: major.length,
    // Each unique claim is counted once, and all available judgments must support it.
    humanClaimSupport: major.length ? proportion(major.filter(c => c.labels.every(l => l === 'supported')).length, major.length) : null,
    unsupportedMajorClaimRate: major.length ? proportion(major.filter(c => c.labels.some(l => l === 'unsupported')).length, major.length) : null,
    uncertainMajorClaims: major.filter(c => c.labels.some(l => l === 'unknown' || l === 'uncertain')).length,
    unknownCards: proportion(rated.filter(c => !c.majorClaim && c.labels.every(l => l === 'unknown')).length, rated.filter(c => !c.majorClaim).length),
    claimDisagreements: rated.filter(c => new Set(c.labels).size > 1).map(c => c.id),
    rubricBoundaryReview: { ...agreement(rubricRatings),
      byRole: Object.fromEntries([...new Set(binding.rubricCases.map(c => c.role))].map(role => [role, agreement(rubricRatings.filter(c => c.role === role))])),
      independentEngineeringReviewers: reviews.filter(r => r.independentEngineeringRoleReviewConfirmed && binding.rubricCases.every(c => typeof r.rubricAgreements[c.id] === 'boolean')).length,
      requiredIndependentEngineeringReviewers: 2, empiricallyCalibrated: false },
    limitations: ['Unblinded boundary review; role expertise and independent calibration are separate requirements',
      `${major.length} selected major claims and ${rated.filter(c => !c.majorClaim).length} explicit unknown cases do not represent all ${binding.cases.reduce((n, c) => n + c.claims.length, 0)} rendered major claims or production prevalence`,
      'Intervals are descriptive; authored correlated examples are not a random independent sample',
      'Agreement on hypothetical arithmetic does not calibrate detector coverage, role weights, strength bands or improvement usefulness'],
  };
}
