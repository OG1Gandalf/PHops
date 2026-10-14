import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Must stay relative: Turbopack rejects absolute paths for next-intl.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy.
 *
 * Pages are prerendered (Cache Components), so a per-request nonce is not possible and the inline scripts
 * Next.js emits for hydration, plus the tiny no-flash theme script, need 'unsafe-inline'. Everything else is locked
 * down: no remote scripts, no plugins, no framing, and the only third-party origin is the OpenStreetMap tile server
 * (images only). `connect-src 'self'` means the app can only talk to its own /api routes; Supabase is called
 * server-side, never from the browser. Dev needs 'unsafe-eval' and websockets for React refresh / HMR.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // geolocation is the only powerful feature the app uses; everything else keeps the browser default
          { key: "Permissions-Policy", value: "geolocation=(self)" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
