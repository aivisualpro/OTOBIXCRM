/**
 * /api/version — returns the build ID baked at deploy time.
 * Each Vercel deployment creates a new build, so BUILD_TS changes.
 * Client polls this to detect when a new version is live.
 */
const BUILD_TS = String(Date.now())

export default defineEventHandler(() => {
  return { buildId: BUILD_TS }
})
