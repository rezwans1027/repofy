/**
 * Time-based progress formula for advisor generation.
 * Shared between the advisor list card and the generate page.
 */
export function calculateAdviceProgress(createdAt: string) {
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000;
  const progress = elapsed < 90
    ? (elapsed / 90) * 94
    : 94 + Math.min(((elapsed - 90) / 30) * 4, 4);
  const phaseIndex = Math.min(Math.floor(elapsed / (90 / 8)), 7);
  return { elapsed, progress, phaseIndex };
}
