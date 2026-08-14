// @ts-check
import { defineConfig, envField } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
/**
 * Astro checks the Origin header on form posts, and it builds the URL it
 * compares against from the socket: behind a TLS-terminating proxy that is
 * `http://your-host` while the browser sends `Origin: https://your-host`. They
 * do not match, and every sign-in, sign-up, checkout and cancel returns 403.
 *
 * It only trusts `X-Forwarded-Proto` once you have told it which host is
 * yours, which is what this does. It is read at BUILD time, because that is
 * when this file runs.
 *
 * Symptom if you skip it: works perfectly on localhost, every form dead the
 * moment you deploy.
 */
const site = process.env.PUBLIC_APP_URL ?? process.env.APP_URL;
const allowedDomains = [];
if (site) {
  try {
    const { hostname, protocol } = new URL(site);
    allowedDomains.push({ hostname, protocol: protocol.replace(':', '') });
  } catch {
    throw new Error(`PUBLIC_APP_URL is not a URL: ${site}`);
  }
}

export default defineConfig({
  security: { allowedDomains },

  // Auth means every page is per-request. Individual pages can still opt back
  // into prerendering with `export const prerender = true`.
  output: 'server',

  // Declared here rather than read through `import.meta.env`, which Vite
  // inlines at build time. A secret read that way is baked into `dist/`, so a
  // container built once and run in two environments would carry the wrong key
  // and there would be nothing in the source to show it. `access: 'secret'`
  // resolves at runtime instead, and a missing variable fails at boot with the
  // name of the variable rather than a 401 an hour later.
  env: {
    schema: {
      REKEY_SECRET: envField.string({ context: 'server', access: 'secret' }),
      // No defaults on any of the three URLs below, deliberately. Each one
      // used to have one, and each default was a way for a misconfigured
      // deployment to keep working while doing the wrong thing silently.
      //
      // `REKEY_URL` defaulted to `https://api.rekey.dev`. It is passed
      // straight into `new Rekey({ secretKey, apiUrl })` in `lib/rekey.ts`, so
      // a self-hosted deployment that forgot the variable did not fail: it
      // sent `REKEY_SECRET` in an Authorization header to a host its operator
      // never chose, and surfaced as an unexplained 401 long after the secret
      // had left. `@rekey.dev/astro` removed its own copy of this default for
      // that reason; passing an explicit value from here put it straight back,
      // so the SDK's fix did not protect this kit.
      //
      // `PUBLIC_APP_URL` defaulted to `http://localhost:4321`, which is worse
      // than failing: checkout built its return URLs from it, so a deployment
      // missing the variable took the buyer's money and returned them to
      // localhost. It is also what `security.allowedDomains` above reads, so
      // the same omission silently rejects every form post in production.
      //
      // Missing now means a build that stops and names the variable. That is
      // the loudest of the available outcomes and the only one that cannot be
      // shipped by accident.
      REKEY_URL: envField.string({ context: 'server', access: 'secret' }),
      REKEY_COOKIE_SECURE: envField.string({ context: 'server', access: 'secret', optional: true }),
      PUBLIC_REKEY_PUBLIC_KEY: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_REKEY_URL: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_APP_URL: envField.string({ context: 'client', access: 'public' }),
    },
  },

  vite: {
    plugins: [tailwindcss()]
  },

  adapter: node({
    mode: 'standalone'
  }),
});