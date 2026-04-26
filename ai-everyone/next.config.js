/** @type {import('next').NextConfig} */
const appRoot = __dirname;
const DEFAULT_LOCAL_AGENT_SERVER_URL = "http://localhost:8300";

function normalizeBaseUrl(value) {
  const trimmed = (value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function resolveAgentServerUrl() {
  const normalizedConfiguredUrl = normalizeBaseUrl(process.env.AGENT_SERVER_URL);
  if (process.env.VERCEL) {
    if (!normalizedConfiguredUrl) {
      throw new Error(
        "Missing AGENT_SERVER_URL in production mode (VERCEL is set). Set AGENT_SERVER_URL before build/start."
      );
    }
    return normalizedConfiguredUrl;
  }

  return normalizedConfiguredUrl || DEFAULT_LOCAL_AGENT_SERVER_URL;
}

const resolvedAgentServerUrl = resolveAgentServerUrl();
const publicApiBase =
  normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE) ||
  normalizeBaseUrl(process.env.AGENT_SERVER_URL);

const nextConfig = {
  outputFileTracingRoot: appRoot,
  env: {
    NEXT_PUBLIC_API_BASE: publicApiBase,
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF:
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ||
      process.env.VERCEL_GIT_COMMIT_REF ||
      process.env.NEXT_PUBLIC_LOCAL_BRANCH ||
      process.env.LOCAL_BRANCH ||
      "",
  },
  turbopack: {
    root: appRoot,
  },
  async rewrites() {
    return [
      {
        source: "/api/agent/:path*",
        destination: `${resolvedAgentServerUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
