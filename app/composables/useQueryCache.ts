/**
 * ─── Query Cache v3 ───
 *
 * Centralized client-side cache with SWR semantics.
 * Survives route navigation via module-level Map (not page-level useFetch).
 *
 * Rules:
 * - Centralized query keys with deterministic ordering
 * - Deduplicate concurrent requests for same key
 * - TTL-based staleness detection
 * - Granular invalidation: invalidate by exact key, prefix, or collection
 * - Delta patch helpers for SSE: patch/insert/remove records in cached lists
 * - Never relies on Nuxt page-level useFetch/useAsyncData cache
 */

interface CacheEntry<T = any> {
  data: T
  fetchedAt: number
  queryKey: string
}

interface QueryCacheOptions {
  /** Time-to-live in ms before data is considered stale (default: 30s) */
  ttl?: number
  /** If true, don't auto-fetch on call — wait for explicit fetch */
  lazy?: boolean
}

// ─── Module-level singleton cache — survives across route navigations ───
const _cache = new Map<string, CacheEntry>()
const _inflightFetches = new Map<string, Promise<any>>()

// ─── Query Key Registry ───
// Centralized key namespace so all composables and patchers
// use the same key format and can find each other's cache entries.
export const QUERY_KEYS = {
  leads: (params?: Record<string, any>) => buildQueryKey('leads', params),
  leadsCount: () => 'leads:counts',
  cars: (params?: Record<string, any>) => buildQueryKey('cars', params),
  carsCount: () => 'cars:counts',
  users: (params?: Record<string, any>) => buildQueryKey('users', params),
  workspaces: () => 'workspaces',
  carDropdowns: (params?: Record<string, any>) => buildQueryKey('carDropdowns', params),
} as const

/**
 * Build a deterministic query key from a base key and optional params.
 * Ensures same filters/page/sort always produce the same cache key.
 */
export function buildQueryKey(base: string, params?: Record<string, any>): string {
  if (!params || Object.keys(params).length === 0) return base

  const sorted = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map(k => `${k}=${String(params[k])}`)
    .join('&')

  return sorted ? `${base}?${sorted}` : base
}

/**
 * Check if a cache entry is stale.
 */
export function isCacheStale(queryKey: string, ttl: number = 30000): boolean {
  const entry = _cache.get(queryKey)
  if (!entry) return true
  return Date.now() - entry.fetchedAt > ttl
}

/**
 * Get cached data for a query key.
 */
export function getCachedData<T = any>(queryKey: string): T | undefined {
  return _cache.get(queryKey)?.data as T | undefined
}

/**
 * Set cached data for a query key.
 */
export function setCachedData<T = any>(queryKey: string, data: T): void {
  _cache.set(queryKey, {
    data,
    fetchedAt: Date.now(),
    queryKey,
  })
}

/**
 * Invalidate a specific cache entry.
 */
export function invalidateCache(queryKey: string): void {
  _cache.delete(queryKey)
}

/**
 * Invalidate all cache entries matching a prefix.
 * E.g. invalidateCachePrefix('leads') clears all leads pages/filters.
 * Rule 15: Only invalidate affected queries, never all collections.
 */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) {
      _cache.delete(key)
    }
  }
}

/**
 * Get all cached keys (for debugging/monitoring).
 */
export function getCacheKeys(): string[] {
  return Array.from(_cache.keys())
}

/**
 * Deduplicated fetch: if the same query is already in-flight,
 * return the existing promise instead of a duplicate call.
 * Rule 9: Deduplicate requests.
 */
export async function deduplicatedFetch<T>(
  queryKey: string,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const existing = _inflightFetches.get(queryKey)
  if (existing) return existing as Promise<T>

  const promise = fetchFn().finally(() => {
    _inflightFetches.delete(queryKey)
  })

  _inflightFetches.set(queryKey, promise)
  return promise
}

// ─── Delta Patch Helpers (for SSE) ───

/**
 * Patch a record in all cached lists matching a prefix.
 * Rule 7: Patch cache in place.
 * Rule 15: Only patches matching cache entries.
 */
export function patchCachedRecord(
  cacheKeyPrefix: string,
  recordId: string,
  changedFields: Record<string, any>,
  idField: string = 'id',
): boolean {
  let patched = false

  for (const [key, entry] of _cache.entries()) {
    if (!key.startsWith(cacheKeyPrefix)) continue
    if (!Array.isArray(entry.data)) continue

    const idx = entry.data.findIndex((item: any) =>
      String(item[idField]) === recordId
      || String(item._id) === recordId
      || String(item.appointmentId) === recordId,
    )

    if (idx !== -1) {
      entry.data[idx] = { ...entry.data[idx], ...changedFields }
      patched = true
    }
  }

  return patched
}

/**
 * Insert a new record at the beginning of matching cached lists.
 */
export function insertCachedRecord(
  cacheKeyPrefix: string,
  newRecord: Record<string, any>,
): void {
  for (const [key, entry] of _cache.entries()) {
    if (!key.startsWith(cacheKeyPrefix)) continue
    if (!Array.isArray(entry.data)) continue
    entry.data.unshift(newRecord)
  }
}

/**
 * Remove a record from all matching cached lists.
 */
export function removeCachedRecord(
  cacheKeyPrefix: string,
  recordId: string,
  idField: string = 'id',
): boolean {
  let removed = false

  for (const [key, entry] of _cache.entries()) {
    if (!key.startsWith(cacheKeyPrefix)) continue
    if (!Array.isArray(entry.data)) continue

    const idx = entry.data.findIndex((item: any) =>
      String(item[idField]) === recordId
      || String(item._id) === recordId
      || String(item.appointmentId) === recordId,
    )

    if (idx !== -1) {
      entry.data.splice(idx, 1)
      removed = true
    }
  }

  return removed
}
