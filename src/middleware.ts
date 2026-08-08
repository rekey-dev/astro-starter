import { rekeyMiddleware } from '@rekey.dev/astro';
import { rekeyConfig } from './lib/rekey';

/**
 * Reads the session once per request and puts it on `Astro.locals`, so pages
 * and endpoints can use it without each one doing its own round trip.
 *
 * It does not protect routes. Whether a route needs a session is a property of
 * the route, so that check lives in the page. See src/pages/dashboard.astro.
 *
 * A failed session read degrades to signed out rather than throwing: this runs
 * on every route, so letting an error escape would take down the public pages,
 * the sign-in page, and the sign-out endpoint that could clear a poisoned
 * cookie. A missing `REKEY_SECRET` is the exception and still throws, because a
 * misconfigured deploy that renders perfectly while signing out every visitor
 * is worse than one that fails.
 */
export const onRequest = rekeyMiddleware(rekeyConfig);
