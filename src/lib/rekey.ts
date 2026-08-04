import { Rekey } from '@rekey.dev/node';
import { REKEY_SECRET, REKEY_URL } from 'astro:env/server';
import { PUBLIC_APP_URL } from 'astro:env/client';

/**
 * Server-side Rekey client.
 *
 * Holds the secret key, so nothing in this file may be imported from a client
 * island. Astro components run on the server, so importing it from `.astro`
 * frontmatter is fine.
 *
 * The variables come from `astro:env`, declared in astro.config.mjs, which
 * resolves them at runtime instead of inlining them into the build.
 */
export const rekey = new Rekey({
  secretKey: REKEY_SECRET,
  apiUrl: REKEY_URL,
});

export const appUrl = PUBLIC_APP_URL;
