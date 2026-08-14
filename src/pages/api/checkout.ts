import type { APIRoute } from 'astro';
import { rekey, appUrl } from '../../lib/rekey';
import { explainToBuyer } from '../../lib/rekey-error';

/**
 * The pricing form posts a plan slug here; this turns it into a hosted checkout
 * URL and sends the browser there.
 */
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const planSlug = String(form.get('planSlug') ?? '');
  if (!planSlug) return redirect('/pricing');

  const session = locals.session;
  if (!session) {
    return redirect(`/sign-in?next=${encodeURIComponent(`/pricing?plan=${planSlug}`)}`);
  }

  try {
    const { url } = await rekey().billing.createCheckout(session.accessToken, {
      planSlug,
      successUrl: `${appUrl}/dashboard?checkout=done`,
      cancelUrl: `${appUrl}/pricing?checkout=canceled`,
    });
    return redirect(url);
  } catch (err) {
    const message = explainToBuyer(err, 'Could not start checkout.');
    return redirect(`/pricing?error=${encodeURIComponent(message)}`);
  }
};
