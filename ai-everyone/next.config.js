const path = require("path");

/** @type {import('next').NextConfig} */
const workspaceRoot = path.resolve(__dirname, "..");

const nextConfig = {
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
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
