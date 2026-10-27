/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

// The DEMO deployment (fictional data, shared only with invited people) must never appear in
// search engines: every response carries "noindex" (see also app/robots.ts and the page metadata).
const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const demoHeaders = isDemo ? [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] : [];

const nextConfig = {
  // Lets the e2e tests run a second dev server (empty database) next to the first one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: [...securityHeaders, ...demoHeaders] },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};
export default nextConfig;
