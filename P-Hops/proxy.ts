import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

// Locale routing ("/" = English, "/bn" = Bengali). Next.js 16 calls this file "proxy".
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals, the generated image routes (/og, /icon, /apple-icon) and any path with a file extension
  matcher: ["/((?!api|_next|_vercel|og$|icon$|apple-icon$|.*\\..*).*)"],
};
