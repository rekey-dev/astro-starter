import type { APIRoute } from 'astro';
import { rekey } from '../../lib/rekey';
import { REFRESH_COOKIE, clearSession } from '../../lib/session';

/**
 * Clearing the cookies signs the browser out. Revoking the refresh token is
 * what signs the *session* out: a 30-day token that is still valid server-side
 * after someone clicks Sign out is a credential anyone holding a copy can keep
 * using. Do both, and do not let a failed revoke leave the cookies in place.
 */
export const POST: APIRoute = async ({ cookies, redirect }) => {
  const refresh = cookies.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    await rekey().auth.signOut(refresh).catch(() => {
      // Already expired or revoked. The cookies still go.
    });
  }
  clearSession(cookies);
  return redirect('/');
};
