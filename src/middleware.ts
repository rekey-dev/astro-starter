import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/session';

/**
 * Reads the session once per request and puts it on `Astro.locals`, so pages
 * and endpoints can use it without each one doing its own round trip.
 *
 * It does not protect routes. Whether a route needs a session is a property of
 * the route, so that check lives in the page. See src/pages/dashboard.astro.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.session = await getSession(context.cookies, context.request);
  return next();
});
