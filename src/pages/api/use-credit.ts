import type { APIRoute } from 'astro';
import { rekey } from '../../lib/rekey';

/**
 * The shape of a metered feature: check the balance, do the work, then deduct.
 *
 * Deduct last, so a failure costs the user nothing. `idempotencyKey` makes a
 * retry a no-op rather than a double charge, so pass something stable for the
 * unit of work (a job id, a request id).
 */
export const POST: APIRoute = async ({ locals, request }) => {
  const session = locals.session;
  if (!session) return new Response('Sign in first', { status: 401 });

  const { creditBalance } = await rekey.billing.getEntitlements(session.accessToken);
  if (creditBalance < 1) {
    return Response.json({ ok: false, reason: 'no-credits' }, { status: 402 });
  }

  // ... your actual work goes here ...

  const idempotencyKey = request.headers.get('idempotency-key') ?? crypto.randomUUID();
  await rekey.credits.consume({ endUserId: session.user.id, amount: 1, idempotencyKey });

  return Response.json({ ok: true });
};
