import { RekeyError } from '@rekey.dev/node';

/**
 * The sentence to put in front of a CUSTOMER when checkout is refused.
 *
 * `RekeyError.message` and `.fix` are written for whoever can act on the
 * problem, and for several codes that is the operator, not the buyer.
 * Rendering them on a pricing page shows a paying customer a sentence about
 * themselves in the third person and an instruction they cannot carry out:
 *
 *   "This subscriber pays through "paypal", which is no longer configured for
 *    this Application. ... Re-add the "paypal" credentials in Panel ->
 *    Application -> Billing ..."
 *
 * That is a real thing a buyer saw on the Next.js starter before this existed.
 * The codes below are the ones whose text names the panel, an API route, or
 * the subscriber in the third person; each gets one sentence a customer can
 * act on. Everything else falls through to the API's own `message`,
 * deliberately: a declined card, an expired coupon or a provider the buyer
 * picked being unavailable are all their situation to resolve, and the API
 * already says so in words they can use.
 *
 * Keep this list short. A code belongs here only when its text is addressed to
 * somebody other than the person reading it.
 */
const OPERATOR_FACING: Record<string, string> = {
  BILLING_BOUND_PROVIDER_UNAVAILABLE:
    'We cannot start a new subscription on this account right now. Please get in touch and we will sort it out.',
  BILLING_PROVIDER_SWITCH_BLOCKED:
    'You already have a subscription or an unfinished checkout with a different payment provider. That one has to finish before you can start this one.',
  BILLING_SUBSCRIPTION_SUBJECT_CONFLICT:
    'You already have this plan on another account of yours. It has to be cancelled and finish before you can start it here.',
  PLAN_NOT_REGISTERED_WITH_PROVIDER:
    'This plan is not ready to buy yet. Please get in touch and we will sort it out.',
  BILLING_CREDENTIALS_NOT_CONFIGURED:
    'Payments are not set up here yet, so checkout is not available.',
};

export function explainToBuyer(err: unknown, fallback: string): string {
  if (!(err instanceof RekeyError)) return fallback;
  const safe = err.code ? OPERATOR_FACING[err.code] : undefined;
  if (safe) {
    // Still surface the real one where you will see it.
    console.error(`checkout refused (${err.code}):`, err.message, err.fix ?? '');
    return safe;
  }
  return err.message;
}
