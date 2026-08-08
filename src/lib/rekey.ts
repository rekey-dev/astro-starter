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
 * Built on first use, not at import: the constructor validates the key, and
 * doing that at module scope turns a missing variable into an unhandled throw
 * during module evaluation rather than an error you can catch and report.
 */
let client: Rekey | undefined;

export function rekey(): Rekey {
  client ??= new Rekey({ secretKey: REKEY_SECRET, apiUrl: REKEY_URL });
  return client;
}

/**
 * Config for `@rekey.dev/astro`.
 *
 * The package defaults to reading `process.env`, which is right for most Astro
 * apps. This one takes secrets through `astro:env` instead — `import.meta.env`
 * is inlined into `dist/` by Vite, which would ship the secret key to anyone
 * who reads the bundle — so it passes them in explicitly.
 */
export const rekeyConfig = { secretKey: REKEY_SECRET, apiUrl: REKEY_URL };

export const appUrl = PUBLIC_APP_URL;
