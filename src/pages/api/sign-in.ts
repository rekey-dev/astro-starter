import type { APIRoute } from 'astro';
import { RekeyError } from '@rekey.dev/node';
import { rekey } from '../../lib/rekey';
import { setSession } from '../../lib/session';
import { safePath } from '../../lib/safe-path';

/**
 * `<SignIn actionUrl="/api/sign-in">` renders a plain form that posts here, so
 * this page works with JavaScript switched off.
 */
export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const form = await request.formData();
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  const next = url.searchParams.get('next');

  try {
    const outcome = await rekey().auth.signIn({ email, password });

    // An MFA-enrolled account gets a challenge instead of a session. Send them
    // somewhere that can collect the code rather than pretending they are in.
    if (outcome.mfaRequired) {
      return redirect('/sign-in?mfa=1');
    }

    setSession(cookies, request, outcome);
    return redirect(safePath(next, '/dashboard'));
  } catch (err) {
    // Show the API's own message. It already distinguishes a wrong password
    // from a locked account, and replacing it with "something went wrong" only
    // moves the debugging onto your support inbox.
    const message = err instanceof RekeyError ? err.message : 'Could not sign you in.';
    return redirect(`/sign-in?error=${encodeURIComponent(message)}`);
  }
};
