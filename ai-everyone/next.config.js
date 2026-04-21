/** @type {import('next').NextConfig} */
const DEFAULT_LOCAL_AGENT_SERVER_URL = 'http://localhost:8300'
const DEFAULT_VERCEL_AGENT_SERVER_URL = 'http://35.154.54.246'

function normalizeBaseUrl(value) {
  const trimmed = (value || '').trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `http://${trimmed}`
}

const defaultAgentServerUrl = process.env.VERCEL
  ? DEFAULT_VERCEL_AGENT_SERVER_URL
  : DEFAULT_LOCAL_AGENT_SERVER_URL

const resolvedAgentServerUrl =
  normalizeBaseUrl(process.env.AGENT_SERVER_URL) || defaultAgentServerUrl

const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: '/api/agent/:path*',
        destination: `${resolvedAgentServerUrl}/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
