import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/session';

/**
 * Reads the session once per request and puts it on `Astro.locals`, so pages
 * and endpoints can use it without each one doing its own round trip.
 *
 * It does not protect routes. Whether a route needs a session is a property of
 * the route, so that check lives in the page. See src/pages/dashboard.astro.
 *
 * The catch matters more than it looks. This runs on every route, so letting an
 * error escape takes down the public pages, the sign-in page, and the sign-out
 * endpoint that could clear a poisoned cookie: a brief API outage would leave a
 * visitor with no way back in. Treating it as "no session" degrades to signed
 * out, which the guarded pages already handle.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  try {
    context.locals.session = await getSession(context.cookies, context.request);
  } catch (err) {
    console.error('[rekey] session read failed, continuing signed out:', err);
    context.locals.session = null;
  }
  return next();
});
