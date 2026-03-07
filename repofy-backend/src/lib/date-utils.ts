const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;

/** Days elapsed since the given ISO date string. */
export function daysAgo(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / MS_PER_DAY);
}

/** ISO timestamp `minutes` from now (for DB expiry columns). */
export function expiresInMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * MS_PER_MINUTE).toISOString();
}

/** ISO timestamp `days` from now (for DB expiry columns). */
export function expiresInDays(days: number): string {
  return new Date(Date.now() + days * MS_PER_DAY).toISOString();
}
