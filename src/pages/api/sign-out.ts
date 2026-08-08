import type { APIRoute } from 'astro';
import { signOut } from '@rekey.dev/astro';
import { rekeyConfig } from '../../lib/rekey';

/**
 * Clearing the cookies signs the browser out. Revoking the refresh token is
 * what signs the *session* out: a 30-day token still valid server-side after
 * someone clicks Sign out is a credential anyone holding a copy can keep using.
 *
 * `signOut` does both and tells you whether the revoke landed. The cookies go
 * either way — the person asked to be signed out — but `revoked: false` means
 * the API could not be reached and the token is still live, which is worth a
 * log line rather than silence.
 */
export const POST: APIRoute = async ({ cookies, redirect }) => {
  const result = await signOut(cookies, rekeyConfig);
  if (!result.revoked) console.error('[rekey] sign-out not revoked:', result.error);
  return redirect('/');
};
