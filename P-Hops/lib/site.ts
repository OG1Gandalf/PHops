/**
 * Site-wide URL and indexing policy, shared by the layout metadata, robots.txt and the sitemap.
 * Read at build time (all three are statically generated), so changing these needs a redeploy.
 */

const fromVercel = (host: string | undefined) => (host ? `https://${host}` : undefined);

/** Canonical origin, no trailing slash. Set NEXT_PUBLIC_SITE_URL once the real domain is known. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  fromVercel(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
  fromVercel(process.env.VERCEL_URL) ??
  "http://localhost:3000"
).replace(/\/+$/, "");

/**
 * Search engines may index the site only on the production deployment. Vercel preview deployments are always
 * noindex; set SITE_NOINDEX=true to keep production out of search results until launch day.
 */
export const INDEXABLE = process.env.VERCEL_ENV !== "preview" && process.env.SITE_NOINDEX !== "true";
