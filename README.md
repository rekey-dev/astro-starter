# Astro + Rekey (auth and billing)

A working Astro app with authentication and billing wired to
[Rekey](https://rekey.dev). Sign-up, sign-in, sessions, plans, hosted checkout,
entitlements and credits.

The pages ship no JavaScript. The session is read on the server, the forms are
forms, and everything here works with scripting switched off. That is Astro's
whole point, so the starter does not fight it.

- Astro 7 (server output, Node adapter)
- Tailwind CSS 4
- `@rekey.dev/node`, and nothing else. No React, no islands.

## Getting it running

You need a Rekey Application. Either sign up at [rekey.dev](https://rekey.dev),
or run the whole thing yourself with
[the open source repo](https://github.com/rekey-dev/rekey). Only the API URL
changes between the two.

```bash
git clone https://github.com/rekey-dev/astro-starter my-app
cd my-app
npm install
cp .env.example .env
```

Fill in `.env` from **Panel → your Application → Developer → API keys**:

| Variable | What it is |
| --- | --- |
| `REKEY_SECRET` | Server-only. Full API access for this Application. Never commit it. |
| `REKEY_URL` | `https://api.rekey.dev`, or your own API if you self-host. |
| `PUBLIC_REKEY_PUBLIC_KEY` | Safe in the browser. Identifies the Application; grants nothing on its own. |
| `PUBLIC_REKEY_URL` | Same API, the browser-visible copy. |
| `PUBLIC_APP_URL` | Where this app is reachable. Checkout returns the user here, **and it is also what tells Astro which origin to trust for form posts** — see Deploying. Needed at build time. |
| `REKEY_COOKIE_SECURE` | Optional, and only for serving over plain HTTP on a non-localhost hostname. Otherwise the browser refuses the session cookie and sign-in silently never sticks. |

```bash
npm run dev
```

Create an account at `/sign-up` and you are signed in. The billing pages stay
empty until you create a plan.

## What is where

| File | What it does |
| --- | --- |
| `src/lib/rekey.ts` | The server client. Holds the secret key. |
| `src/lib/session.ts` | The whole session adapter: two cookies, a read that refreshes, a write. |
| `src/middleware.ts` | Reads the session once per request onto `Astro.locals`. |
| `src/lib/safe-path.ts` | Reduces a `?next=` value to a path on this site. |
| `src/pages/api/sign-in.ts` | Plain form post. Also sign-up, sign-out, checkout, cancel, use-credit. |
| `src/components/AuthCard.astro` | The sign-in and sign-up form. Plain markup. |
| `src/pages/pricing.astro` | Plans read from the API, rendered without an island. |
| `src/pages/dashboard.astro` | A page that guards itself and reads entitlements server-side. |
| `src/pages/account.astro` | Plan status, cancel, credit balance. |

## Sessions

There is no `@rekey.dev/astro` package yet, so `src/lib/session.ts` is the
adapter. It is about ninety lines and it is all of it:

- Two httpOnly cookies, `rekey_access` and `rekey_refresh`
- A read that returns the user, and refreshes silently when the access token
  has expired
- A write, and a clear
- Sign-out that **revokes** the refresh token as well as clearing the cookies.
  Clearing alone leaves a 30-day credential valid server-side, which is not
  what a user means when they click Sign out.

The cookie names and lifetimes match `@rekey.dev/nextjs` deliberately, so an app
that later moves between the two does not sign everybody out.

Two details in that file are worth reading rather than skimming.

**Only `USER_TOKEN_INVALID` triggers a refresh**, and only a verdict about the
token itself clears the cookies. A timeout must not delete the refresh cookie:
that is the one credential that can recover the session, so throwing it away
turns a two-second outage into everybody signing in again.

The middleware catches too, and that matters more than it looks. It runs on
every route, so an uncaught error takes down the public pages, the sign-in page
and the sign-out endpoint that could clear a poisoned cookie, leaving a visitor
with no way back in.

**`Secure` is decided per request**, not from `import.meta.env.PROD`. That is a
build-time answer to a request-time question, and it fails in the direction that
costs you the session: guessing wrong on a real host means the browser refuses
the cookie, which is loud and takes one env var to fix, while guessing wrong the
other way puts a session credential on the wire in cleartext, silently.

### Reading it

Middleware puts it on `Astro.locals`, so a page just reads it:

```astro
---
const session = Astro.locals.session;
if (!session) return Astro.redirect('/sign-in?next=/dashboard');
---
```

Three lines, and the answer to "does this route need a session" lives in the
route. Middleware deliberately does not guard anything; move the check there if
you would rather keep a central list.

## Secrets

`REKEY_SECRET` is declared in `astro.config.mjs` under `env.schema` and imported
from `astro:env/server`, not read through `import.meta.env`. Vite inlines
`import.meta.env` at build time, so a secret read that way ends up baked into
`dist/`, and a container built once and run in two environments carries the
wrong key with nothing in the source to show it. `astro:env` resolves it at
runtime instead, and a missing variable is reported by name.

Two things to know about that, both learned the hard way:

**The built server does not read `.env`.** Vite loads `.env` for `astro dev`
only. `node ./dist/server/entry.mjs` reads `process.env`, so exporting the
variables (or a real env file in your process manager, or `--env-file=.env` on
Node 20.6+) is part of deploying, not an optional nicety.

**It fails on the first request, not at boot.** The server starts and listens
happily with `REKEY_SECRET` missing; the first page load then returns a 500
naming the variable. A health check that only tests whether the port is open
will call that deploy healthy.

## Forms, and why there is no React here

`@rekey.dev/react` ships `<SignIn>` and `<SignUp>`, and given `actionUrl` they
render a plain form, which looks like a perfect fit for Astro. It is not, and
the reason is worth knowing before you reach for them.

Those components style themselves by injecting a `<style>` block from a client
effect. Rendering one server-only, which is what Astro does without a client
directive, gives you correct markup with no styling at all. Adding `client:load`
fixes the appearance by shipping React to a page that otherwise needs none.

So `src/components/AuthCard.astro` is the form, in about forty lines of markup
you can restyle by editing it. Pricing is a plain `.astro` grid for a related
reason: `<PricingTable>` requires a `checkoutAction`, which is a Next server
action, and Astro has form posts.

The endpoints are the part that matters and they are unchanged: call `signIn`,
set the cookies, redirect.

## Billing

### Create a plan first

Panel, then your Application, then Billing, then Plans. Give it a slug, a price
and an interval, then add entitlements: feature flags, numeric limits, or a
credit grant. Connect a provider (Stripe, Razorpay, PayPal or Paddle) under
Billing then Providers, or checkout has nothing to redirect to.

### Selling

`/pricing` reads plans from the API, so no prices live in the source. The form
posts a slug to `/api/checkout`, which creates the session:

```ts
const { url } = await rekey.billing.createCheckout(session.accessToken, {
  planSlug,
  successUrl: `${appUrl}/dashboard?checkout=done`,
  cancelUrl: `${appUrl}/pricing?checkout=canceled`,
});
return redirect(url);
```

The subscription stays `PENDING` until the provider webhook confirms payment.
Rekey handles that webhook; you do not need an endpoint for it.

### Checking what someone is allowed to do

```ts
const { features, creditBalance } = await rekey.billing.getEntitlements(session.accessToken);
if (!features.export_csv) return notAllowed();
```

Server-side. A client-side check is a hint for your UI, not a gate.

Worth knowing before you price anything: where two subscriptions grant the same
numeric entitlement, the higher value wins, they are not added together. Ten
copies of a one-seat plan is not a ten-seat plan.

### Credits

Check, do the work, then deduct, so a failure costs the user nothing. Pass a
stable `idempotencyKey` and a retry becomes a no-op instead of a double charge.
See `src/pages/api/use-credit.ts`.

### Cancelling

`cancelSubscription()` asks for cancellation at period end, so the user keeps
what they paid for. A provider-backed subscription therefore stays `ACTIVE`
with `cancelAt` set, and the provider webhook is what eventually ends it. Read
`cancelAt` rather than waiting for `status` to flip.

`cancelAt` and `cancelsAtPeriodEnd()` answer different questions, and swapping
them is a bug worth avoiding by name because this starter shipped with it:

- **`subscription.cancelAt`** — is this *already* scheduled to end?
- **`cancelsAtPeriodEnd(subscription)`** — if I cancel *now*, does the user keep
  the rest of the period, or does access stop on click with no refund?

The second is `status === 'ACTIVE' && currentPeriodEnd !== null`, so it is
`true` for every healthy subscriber. Use it to word the button and it reads
correctly; use it to mean "already ending" and the cancel button disappears for
everyone who could have used it, while a `PAST_DUE` subscriber gets a button
labelled "cancel at period end" that actually ends their access immediately.

## Deploying

### The one step that decides whether any form works

Astro checks the `Origin` header on form posts, and it builds the URL it
compares against from the socket. Behind a TLS-terminating proxy that is
`http://your-host`, while the browser sends `Origin: https://your-host`. They do
not match and **every** sign-in, sign-up, checkout and cancel returns 403.

It works perfectly on localhost, so this only appears once you deploy. Astro
trusts `X-Forwarded-Proto` once you tell it which host is yours, which is what
`security.allowedDomains` in `astro.config.mjs` does. It reads `PUBLIC_APP_URL`,
and **that file runs at build time**, so the variable has to be set for the
build, not only at runtime:

```bash
PUBLIC_APP_URL=https://your-host npm run build
```

Get it wrong and the symptom is a bare 403 with nothing in the logs.

### Running it

Built for the Node adapter in standalone mode, so this is the whole deployment:

```bash
npm run build
node --env-file=.env ./dist/server/entry.mjs
```

The `--env-file` matters: the built server reads `process.env`, not `.env`. On
a platform that injects environment variables for you, drop the flag.

Point `PUBLIC_APP_URL` at the real origin and add that origin to the
Application's allowed origins in the panel. Swap the adapter in
`astro.config.mjs` for any other target.

## Licence

MIT. Take it apart.
