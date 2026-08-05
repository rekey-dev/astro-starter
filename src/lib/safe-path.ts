/**
 * Reduce a caller-supplied `next` value to a path on this site.
 *
 * `startsWith('/') && !startsWith('//')` is the obvious version and it is
 * wrong: `/\evil.com` passes it, and a browser resolves that to
 * `https://evil.com/`. Tab and newline forms slip through the same way. Asking
 * the same parser the browser will use, and keeping the result only when the
 * origin survived, is the version that holds.
 */
export function safePath(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback;
  try {
    const url = new URL(next, 'http://internal.invalid');
    if (url.origin !== 'http://internal.invalid') return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
