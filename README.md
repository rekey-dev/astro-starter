# Astro + Rekey (auth and billing)

A working Astro app with authentication and billing wired to
[Rekey](https://rekey.dev). Sign-up, sign-in, sessions, plans, hosted checkout,
entitlements and credits.

The pages ship no JavaScript. The session is read on the server, the forms are
forms, and everything here works with scripting switched off. That is Astro's
whole point, so the starter does not fight it.

- Astro 7 (server output, Node adapter)
- Tailwind CSS 4
- `@rekey.dev/node`, plus `@rekey.dev/react` for the sign-in and sign-up forms

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
| `PUBLIC_APP_URL` | Where this app is reachable. Checkout returns the user here, so in production it must be the real origin. |

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
| `src/pages/api/sign-in.ts` | Plain form post. Also sign-up, sign-out, checkout, cancel, use-credit. |
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

The cookie names and lifetimes match `@rekey.dev/nextjs` deliberately, so an app
that later moves between the two does not sign everybody out.

Two details in that file are worth reading rather than skimming.

**Only `USER_TOKEN_INVALID` triggers a refresh.** Any other failure is rethrown.
If a network blip made `getCurrentUser` throw and the code treated that as
signed out, an API hiccup would present itself to your users as a mass logout.

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
wrong key with nothing in the source to show it. `astro:env` resolves at
runtime, and a missing variable fails at boot naming the variable.

## Forms

`<SignIn>` and `<SignUp>` come from `@rekey.dev/react` and are rendered **with
no client directive**. Given `actionUrl` they emit a plain form, so Astro renders
them to HTML and no React reaches the browser:

```astro
<SignIn actionUrl="/api/sign-in" signUpUrl="/sign-up" error={error} />
```

The endpoint they post to is nine lines of real work: call `signIn`, set the
cookies, redirect. If you would rather write your own markup, delete the island
and keep the endpoint.

Pricing is a plain `.astro` grid rather than `<PricingTable>`, because the React
table wants a server action and Astro has form posts. Same result, less
machinery.

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

`cancelSubscription()` cancels at period end by default, so the user keeps what
they paid for. A provider-backed subscription therefore stays `ACTIVE` with
`cancelAt` set, and the provider webhook is what ends it. Read `cancelAt`, or the
`cancelsAtPeriodEnd()` helper, rather than waiting for `status` to flip.

## Deploying

Built for the Node adapter in standalone mode, so `node ./dist/server/entry.mjs`
is the whole deployment. Set the same environment variables, point
`PUBLIC_APP_URL` at the real origin, and add that origin to the Application's
allowed origins in the panel. Swap the adapter in `astro.config.mjs` for any
other target.

## Licence

MIT. Take it apart.
