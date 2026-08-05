import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { RekeyError } from '@rekey.dev/node';
import { rekey } from '../../lib/rekey';

/**
 * The shape of a metered feature: check, do the work, then deduct.
 *
 * Three things here are load-bearing.
 *
 * **The idempotency key is derived on the server.** Taking it from a header
 * hands the caller the dedupe switch: send the same key every time and the
 * first call deducts while every later one is a no-op that still does the work.
 * Free metered usage, forever.
 *
 * **The balance check is not a lock.** Two requests at balance 1 both pass it,
 * so the deduction is the real arbiter and its 402 has to be handled.
 *
 * **Read and write must name the same subject.** `getEntitlements` resolves the
 * caller's active organization when they have one, while `consume({ endUserId })`
 * always hits the personal pool. Reading one and deducting from the other is
 * how you get a passing check followed by a failing deduction.
 */
export const POST: APIRoute = async ({ locals }) => {
  const session = locals.session;
  if (!session) return new Response('Sign in first', { status: 401 });

  const organizationId = session.user.activeOrganizationId ?? undefined;

  try {
    const { creditBalance } = await rekey().billing.getEntitlements(session.accessToken, {
      ...(organizationId ? { organizationId } : {}),
    });
    if (creditBalance < 1) {
      return Response.json({ ok: false, reason: 'no-credits' }, { status: 402 });
    }

    // Whatever identifies this unit of work for you: a job row, an upload id.
    // It must come from your side, never from the request.
    const jobId = randomUUID();

    // ... your actual work goes here ...

    const result = await rekey().credits.consume({
      ...(organizationId ? { organizationId } : { endUserId: session.user.id }),
      amount: 1,
      idempotencyKey: `${session.user.id}:${jobId}`,
    });

    // A repeat of the same key returns the original result rather than
    // deducting again. Worth branching on if you retry.
    return Response.json({ ok: true, jobId, applied: result.applied });
  } catch (err) {
    if (err instanceof RekeyError) {
      return Response.json({ ok: false, reason: err.code, message: err.message }, { status: 402 });
    }
    throw err;
  }
};
