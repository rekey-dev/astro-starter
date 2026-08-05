import type { APIRoute } from 'astro';
import { RekeyError } from '@rekey.dev/node';
import { rekey } from '../../lib/rekey';
import { setSession } from '../../lib/session';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');

  try {
    const result = await rekey().auth.signUp({ email, password });
    setSession(cookies, request, result);
    return redirect('/dashboard');
  } catch (err) {
    const message = err instanceof RekeyError ? err.message : 'Could not create the account.';
    return redirect(`/sign-up?error=${encodeURIComponent(message)}`);
  }
};
