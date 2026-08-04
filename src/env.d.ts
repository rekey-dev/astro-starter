/// <reference types="astro/client" />

import type { Session } from './lib/session';

declare global {
  namespace App {
    interface Locals {
      /** Set by src/middleware.ts on every request. Null when signed out. */
      session: Session | null;
    }
  }
}

export {};
