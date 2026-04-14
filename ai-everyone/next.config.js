/** @type {import('next').NextConfig} */
if (!process.env.NEXT_PUBLIC_DEBUG_BUILD_ID) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8);
  process.env.NEXT_PUBLIC_DEBUG_BUILD_ID = `dev-${stamp}-${random}`;
}

const nextConfig = {
  compress: true,
  turbopack: {
    root: __dirname,
  },
  env: {
    NEXT_PUBLIC_DEBUG_BUILD_ID: process.env.NEXT_PUBLIC_DEBUG_BUILD_ID,
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-popover",
      "date-fns",
    ],
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";
    if (!isProduction) {
      // Prevent stale dev bundles across browser profiles/tabs.
      // Next.js dev chunk paths are not content-hashed, so immutable caching
      // can cause different tabs to run different UI code versions.
      return [];
    }

    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/marketplace/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/logo.png",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/agent/:path*',
        destination: 'http://localhost:8300/:path*',
      },
    ]
  },
}

module.exports = nextConfig
