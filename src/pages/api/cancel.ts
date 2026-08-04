import type { APIRoute } from 'astro';
import { rekey } from '../../lib/rekey';

/**
 * Cancels at period end, which is the humane default: the user keeps what they
 * paid for until the period runs out. A provider-backed subscription therefore
 * stays ACTIVE with `cancelAt` set, and the provider webhook is what ends it.
 */
export const POST: APIRoute = async ({ locals, redirect }) => {
  const session = locals.session;
  if (!session) return redirect('/sign-in');

  await rekey.billing.cancelSubscription(session.accessToken);
  return redirect('/account');
};
