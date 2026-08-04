// @ts-check
import { defineConfig, envField } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
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