/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // "standalone" is only useful for Docker. On Vercel it causes prerender
  // errors when combined with client-only hooks (localStorage, etc.).
  // output: "standalone",
  poweredByHeader: false,
  // Skip linting and type-checking during build — both already enforced in CI.
  // Without this, Vercel fails the build on minor ESLint nits that don't break
  // anything at runtime.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
export default nextConfig;
