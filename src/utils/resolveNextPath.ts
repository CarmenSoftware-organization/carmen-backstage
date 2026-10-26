/**
 * Open-redirect guard, same as App's `lib/auth/resolve-next-path.ts`: only a same-origin relative path
 * survives; anything else (absent, `//`, `/\`) falls back to `/dashboard`. Keep both in sync.
 * @param next - Raw `next` value from a query string or URL fragment, or null
 * @returns A safe relative path, or `/dashboard` as the fallback
 */
export function resolveNextPath(next: string | null): string {
  const fallback = '/dashboard';
  if (!next) return fallback;
  if (!next.startsWith('/')) return fallback;
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback;
  // Browsers strip tab/CR/LF from URLs, so `/<TAB>/evil.com` would become `//evil.com`.
  for (let i = 0; i < next.length; i += 1) {
    const code = next.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return fallback;
  }
  return next;
}

// Pages that never need a `next`: returning to them after sign-in is the default anyway, and
// `/login/callback` would replay a spent Google fragment. Mirrors AuthContext's publicPaths.
const NO_RETURN_PATHS = ['/', '/login', '/login/callback', '/changelog'];

/**
 * The login URL for a session that has to sign in again, carrying where it was so Login can send
 * it straight back. Explicit logout should keep using a bare `/login` — nobody wants to be
 * returned to the page they just left.
 * @param path - pathname + search + hash of the page being left, e.g. from `window.location`
 * @returns `/login?next=<path>`, or bare `/login` when the path is public or would not survive `resolveNextPath`
 */
export function loginPathFor(path: string): string {
  const pathname = path.split(/[?#]/, 1)[0];
  if (NO_RETURN_PATHS.includes(pathname) || resolveNextPath(path) !== path) return '/login';
  return `/login?${new URLSearchParams({ next: path }).toString()}`;
}

/** {@link loginPathFor} for the page the browser is on right now. */
export function loginPathForCurrentPage(): string {
  const { pathname, search, hash } = window.location;
  return loginPathFor(`${pathname}${search}${hash}`);
}
