/** @type {import('next').NextConfig} */
const appRoot = __dirname;

const nextConfig = {
  outputFileTracingRoot: appRoot,
  turbopack: {
    root: appRoot,
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
