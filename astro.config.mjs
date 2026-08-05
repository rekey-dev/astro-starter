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
      REKEY_URL: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
        default: 'https://api.rekey.dev',
      }),
      REKEY_COOKIE_SECURE: envField.string({ context: 'server', access: 'secret', optional: true }),
      PUBLIC_REKEY_PUBLIC_KEY: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_REKEY_URL: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
        default: 'https://api.rekey.dev',
      }),
      PUBLIC_APP_URL: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
        default: 'http://localhost:4321',
      }),
    },
  },

  vite: {
    plugins: [tailwindcss()]
  },

  adapter: node({
    mode: 'standalone'
  }),
});