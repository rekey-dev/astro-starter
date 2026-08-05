import type { APIRoute } from 'astro';
import { RekeyError } from '@rekey.dev/node';
import { rekey } from '../../lib/rekey';

/**
 * Cancels at period end where that is possible, which is the humane default:
 * the user keeps what they paid for until the period runs out, the row stays
 * ACTIVE with `cancelAt` set, and the provider webhook is what ends it.
 *
 * On a subscription that is not ACTIVE the API cancels immediately and there is
 * no refund, which is why /account says which of the two the button will do
 * before it is pressed.
 */
export const POST: APIRoute = async ({ locals, redirect }) => {
  const session = locals.session;
  if (!session) return redirect('/sign-in?next=/account');

  try {
    await rekey().billing.cancelSubscription(session.accessToken);
    return redirect('/account?canceled=1');
  } catch (err) {
    const message = err instanceof RekeyError ? err.message : 'Could not cancel the subscription.';
    return redirect(`/account?error=${encodeURIComponent(message)}`);
  }
};
