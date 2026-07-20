import type { NextConfig } from "next";

// Security headers, applied to every response.
//
// The CSP deliberately allows `'unsafe-inline'` for scripts. The alternative —
// a per-request nonce via proxy.ts — forces *every* page to render dynamically,
// giving up static rendering and CDN caching for the whole app. That trade
// isn't worth it here: the only `dangerouslySetInnerHTML` in the codebase is the
// static theme-init script, and everything user-supplied (evidence notes, card
// text, generated Markdown) is rendered as escaped text by React, so there is no
// HTML-injection sink for a stricter script-src to protect.
//
// Note that hashing just the theme script would be worse than useless: adding
// any hash to script-src makes browsers ignore 'unsafe-inline', which would then
// block Next's own streaming hydration scripts.
//
// `frame-ancestors 'none'` is the directive doing real work — without it the app
// is framable, and a framed page can be positioned to trick a reviewer into
// clicking Approve.
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  // 'unsafe-eval' is React's dev-only error reconstruction; never in production.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // GitHub avatars are the only remote images; blob:/data: cover uploads.
  "img-src 'self' blob: data: https://avatars.githubusercontent.com",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // frame-ancestors supersedes this, but it costs nothing and covers browsers
  // or intermediaries that honour only the older header.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the origin cross-site, never the path — repo owners and KSB ids
  // shouldn't leak to third parties through the Referer header.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
