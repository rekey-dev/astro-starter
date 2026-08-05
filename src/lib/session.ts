import type { AstroCookies } from 'astro';
import type { Rekey } from '@rekey.dev/node';
import { RekeyError } from '@rekey.dev/node';
import { REKEY_COOKIE_SECURE } from 'astro:env/server';
import { rekey } from './rekey';

/**
 * Session handling for Astro.
 *
 * There is no `@rekey.dev/astro` package, so this file is the adapter. It is
 * about eighty lines and it is all of it: two cookies holding the tokens, a
 * read that refreshes when the access token has expired, and a write.
 *
 * The cookie names and lifetimes match `@rekey.dev/nextjs` deliberately, so an
 * app that later moves between the two does not log everybody out.
 */

/**
 * Codes that mean the refresh token itself is finished. Anything else is a
 * transport problem and must not cost the user their session.
 */
const TOKEN_IS_DEAD = new Set([
  'REFRESH_TOKEN_EXPIRED',
  'REFRESH_TOKEN_REUSED',
  'USER_TOKEN_INVALID',
]);

export const ACCESS_COOKIE = 'rekey_access';
export const REFRESH_COOKIE = 'rekey_refresh';

/**
 * `getCurrentUser` returns more than `EndUserDto` — notably
 * `activeOrganizationId`, which decides whose credits and entitlements a call
 * resolves against. Deriving the type from the call keeps that.
 */
export type SessionUser = Awaited<ReturnType<Rekey['auth']['getCurrentUser']>>;

export interface Session {
  user: SessionUser;
  accessToken: string;
}

/** Hosts a browser already treats as a secure context over plain HTTP. */
function isLoopback(host: string): boolean {
  const bare = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : (host.split(':')[0] ?? '');
  const h = bare.trim().toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.localhost');
}

/**
 * Whether the session cookie must carry `Secure` on this request.
 *
 * Deliberately decided per request rather than from `import.meta.env.PROD`,
 * which is a build-time answer to a request-time question. Getting it wrong on
 * a real host means the browser refuses the cookie, which is loud. Getting it
 * wrong the other way puts a session credential on the wire in cleartext, which
 * is silent, so the fallback leans secure.
 */
function secureFor(request: Request): boolean {
  const override = (REKEY_COOKIE_SECURE ?? '').trim().toLowerCase();
  if (override === 'true') return true;
  if (override === 'false') return false;

  const proto = (request.headers.get('x-forwarded-proto') ?? '').split(',')[0]?.trim().toLowerCase();
  if (proto === 'https') return true;

  // Deliberately not `x-forwarded-host`: a client can send that, and letting it
  // choose would let someone ask for a cookie without `Secure`. `Host` is set
  // by the connection.
  return !isLoopback(request.headers.get('host') ?? '');
}

export function setSession(
  cookies: AstroCookies,
  request: Request,
  tokens: { accessToken: string; refreshToken: string },
): void {
  const base = { httpOnly: true, sameSite: 'lax', path: '/', secure: secureFor(request) } as const;
  cookies.set(ACCESS_COOKIE, tokens.accessToken, { ...base, maxAge: 60 * 15 });
  cookies.set(REFRESH_COOKIE, tokens.refreshToken, { ...base, maxAge: 60 * 60 * 24 * 30 });
}

export function clearSession(cookies: AstroCookies): void {
  cookies.delete(ACCESS_COOKIE, { path: '/' });
  cookies.delete(REFRESH_COOKIE, { path: '/' });
}

/**
 * Read the session, refreshing it if the access token has expired.
 *
 * Only `USER_TOKEN_INVALID` falls through to a refresh. Any other failure is a
 * real error and is rethrown, so an API outage does not quietly present itself
 * as everyone being signed out.
 */
export async function getSession(cookies: AstroCookies, request: Request): Promise<Session | null> {
  const access = cookies.get(ACCESS_COOKIE)?.value;
  if (access) {
    try {
      return { user: await rekey().auth.getCurrentUser(access), accessToken: access };
    } catch (err) {
      if (!(err instanceof RekeyError) || err.code !== 'USER_TOKEN_INVALID') throw err;
    }
  }

  const refresh = cookies.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;

  try {
    const fresh = await rekey().auth.refresh(refresh);
    setSession(cookies, request, fresh);
    return { user: await rekey().auth.getCurrentUser(fresh.accessToken), accessToken: fresh.accessToken };
  } catch (err) {
    // Only clear on a verdict about the token itself. A timeout or a network
    // blip must not delete the refresh cookie: that is the one credential that
    // can recover the session, and deleting it turns a two-second outage into
    // everybody signing in again. Leave it and let the next request retry.
    if (err instanceof RekeyError && TOKEN_IS_DEAD.has(err.code)) {
      clearSession(cookies);
    }
    return null;
  }
}
