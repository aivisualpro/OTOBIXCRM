/**
 * /api/version — returns a stable build ID.
 *
 * IMPORTANT: do NOT use `Date.now()` here. On serverless platforms (Vercel,
 * Render, etc.) each cold-started function instance evaluates module-level
 * code separately, so `Date.now()` returns a different value per instance.
 * Clients polling the endpoint will hit different instances and see the
 * buildId change constantly, triggering a fake "new version" banner.
 *
 * We pick the first stable identifier we can find:
 *   1. NUXT_PUBLIC_BUILD_ID    — set at build time in your CI
 *   2. VERCEL_GIT_COMMIT_SHA   — provided automatically by Vercel
 *   3. VERCEL_DEPLOYMENT_ID    — provided automatically by Vercel
 *   4. RENDER_GIT_COMMIT       — provided automatically by Render
 *   5. 'dev'                   — local dev fallback (no banner triggers)
 */
const BUILD_ID
  = process.env.NUXT_PUBLIC_BUILD_ID
  || process.env.VERCEL_GIT_COMMIT_SHA
  || process.env.VERCEL_DEPLOYMENT_ID
  || process.env.RENDER_GIT_COMMIT
  || 'dev'

export default defineEventHandler(() => {
  return { buildId: BUILD_ID }
})
