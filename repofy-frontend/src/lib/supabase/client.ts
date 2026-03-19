import { createBrowserClient } from "@supabase/ssr";

/**
 * No-op lock that bypasses the Web Locks API.
 * Supabase's GoTrueClient uses navigator.locks for cross-tab session
 * coordination. In headless Chromium (CI/Playwright), lock acquisition
 * can hang indefinitely, blocking getSession() and all auth-dependent
 * API calls. This no-op skips the lock and runs the callback directly.
 *
 * @see https://github.com/supabase/supabase-js/issues/1594
 */
const noOpLock = async <T>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<T>,
) => fn();

const disableLocks =
  process.env.NEXT_PUBLIC_DISABLE_SUPABASE_LOCKS === "true";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createBrowserClient(url, anonKey, disableLocks ? {
    auth: { lock: noOpLock },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any : undefined);
}
