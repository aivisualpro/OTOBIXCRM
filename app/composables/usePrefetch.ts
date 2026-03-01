/**
 * ─── Smart Prefetch Engine ───
 *
 * Pre-loads data for key routes BEFORE the user navigates there.
 *
 * Strategy:
 * 1. Boot prefetch: As soon as the app loads (if logged in), silently
 *    start fetching leads, people, and car data in the background.
 * 2. Hover-intent prefetch: When the user hovers over a sidebar link,
 *    trigger the relevant data fetch for that route.
 * 3. Zero-loading guarantee: By the time the user clicks, data is already
 *    in the global cache, so the page renders instantly.
 */

// Prefetch status tracking
const _prefetchStarted = ref(false)
const _prefetchComplete = ref(false)
const _prefetchProgress = ref(0) // 0-100

// Route-to-fetcher mapping
const ROUTE_PREFETCH_MAP: Record<string, string[]> = {
  '/leads': ['leads', 'people', 'carDropdowns'],
  '/people': ['people'],
  '/auctions': ['auctions'],
  '/support/tickets': ['people'],
}

export function usePrefetch() {
  const isLoggedIn = useCookie('isLoggedIn')

  /**
   * Boot prefetch — call once from app.vue or a plugin.
   * Silently loads all essential data in the background.
   */
  async function bootPrefetch() {
    // Only run once, only if logged in
    if (_prefetchStarted.value || !isLoggedIn.value)
      return

    _prefetchStarted.value = true
    _prefetchProgress.value = 10

    try {
      // Import the composables dynamically to avoid SSR issues
      const { fetchAllLeads } = useLeadsApi()
      const { fetchAllUsers } = usePeopleApi()
      const { fetchCarDropdowns } = useCarDropdowns()

      // Fire all fetches in parallel — non-blocking, silent
      const tasks = [
        fetchAllLeads().then(() => { _prefetchProgress.value = Math.min(_prefetchProgress.value + 30, 90) }),
        fetchAllUsers().then(() => { _prefetchProgress.value = Math.min(_prefetchProgress.value + 30, 90) }),
        fetchCarDropdowns().then(() => { _prefetchProgress.value = Math.min(_prefetchProgress.value + 30, 90) }),
      ]

      await Promise.allSettled(tasks)
      _prefetchProgress.value = 100
      _prefetchComplete.value = true
    }
    catch {
      // Silent fail — data will be fetched on demand when user navigates
      _prefetchProgress.value = 100
      _prefetchComplete.value = true
    }
  }

  /**
   * Hover-intent prefetch — call when user hovers over a nav link.
   * Checks what data that route needs and starts fetching.
   */
  function prefetchForRoute(routePath: string) {
    if (!isLoggedIn.value)
      return

    // Find matching prefetch targets
    const matchedKey = Object.keys(ROUTE_PREFETCH_MAP).find(key =>
      routePath.startsWith(key),
    )

    if (!matchedKey)
      return

    const targets = ROUTE_PREFETCH_MAP[matchedKey]
    if (!targets)
      return

    targets.forEach((target) => {
      switch (target) {
        case 'leads': {
          const { fetchAllLeads } = useLeadsApi()
          fetchAllLeads() // no-op if already cached
          break
        }
        case 'people': {
          const { fetchAllUsers } = usePeopleApi()
          fetchAllUsers()
          break
        }
        case 'carDropdowns': {
          const { fetchCarDropdowns } = useCarDropdowns()
          fetchCarDropdowns()
          break
        }
        case 'auctions': {
          const { fetchAllCars } = useAuctionsApi()
          fetchAllCars()
          break
        }
      }
    })
  }

  return {
    prefetchStarted: _prefetchStarted,
    prefetchComplete: _prefetchComplete,
    prefetchProgress: _prefetchProgress,
    bootPrefetch,
    prefetchForRoute,
  }
}
