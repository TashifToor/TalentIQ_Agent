const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { appDir: true, instrumentationHook: true },
  output: 'standalone', // smaller, self-contained production build — required for the Docker setup
}

// Sentry wrapping is a no-op at build time if SENTRY_DSN-related env vars
// aren't set — safe to leave in even before you've created a Sentry project.
module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
})