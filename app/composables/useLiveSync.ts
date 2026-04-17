/**
 * ─── Live Sync Engine ───
 *
 * Real-time data synchronization using Server-Sent Events (SSE).
 * When ANY user on ANY device modifies data, ALL connected browsers
 * receive an instant push notification and auto-refetch stale data.
 *
 * Architecture:
 * 1. Client opens persistent SSE connection to /api/live-sync
 * 2. Server pushes change events whenever a mutation endpoint fires
 * 3. Client debounces + refetches only the affected data stores
 * 4. Auto-reconnects on disconnect with exponential backoff
 *
 * Zero polling. Zero manual refresh. Fully automatic.
 */

interface LiveSyncEvent {
  type: 'connected' | 'change'
  collection?: string
  action?: 'create' | 'update' | 'delete'
  timestamp?: number
  recordId?: string
  changedBy?: string
}

export function useLiveSync() {
  const _isConnected = useState('livesync_connected', () => false)
  const _lastEvent = useState<LiveSyncEvent | null>('livesync_lastEvent', () => null)
  const _eventSource = useState<EventSource | null>('livesync_es', () => null)
  const _reconnectAttempts = useState('livesync_reconnectAttempts', () => 0)
  const _started = useState('livesync_started', () => false)

  const isLoggedIn = useCookie('isLoggedIn')

  // Debounce map — prevent rapid re-fetches from burst writes
  const _pendingRefresh: Record<string, ReturnType<typeof setTimeout>> = {}

  /**
   * Handle incoming SSE change events.
   * Debounces refetches to avoid hammering the API on rapid edits.
   */
  function handleChange(event: LiveSyncEvent) {
    if (event.type !== 'change' || !event.collection)
      return

    _lastEvent.value = event

    const collection = event.collection

    // Debounce: wait 2s after last event before refetching
    // This handles burst scenarios (e.g. QC saving 10 fields at once)
    if (_pendingRefresh[collection]) {
      clearTimeout(_pendingRefresh[collection])
    }

    _pendingRefresh[collection] = setTimeout(() => {
      refreshCollection(collection, event.recordId)
      delete _pendingRefresh[collection]
    }, 2000)
  }

  /**
   * Refresh the affected data store based on which collection changed.
   */
  async function refreshCollection(collection: string, _recordId?: string) {
    try {
      switch (collection) {
        case 'leads':
        case 'telecallings':
        case 'cars': {
          // Refresh the leads list (silently, no loading spinners)
          const { fetchLeads, fetchCounts } = useLeadsApi()
          await fetchLeads(true)
          fetchCounts()

          // Also silently hot-reload auctions/retail grid
          const { fetchAllCars } = useAuctionsApi()
          await fetchAllCars(true)

          break
        }
        // Extend here for other collections:
        // case 'people': { ... }
        // case 'auctions': { ... }
      }
    }
    catch {
      // Silent fail — user can still manually refresh
    }
  }

  /**
   * Establish SSE connection. Auto-reconnects on failure.
   */
  function connect() {
    // Guard: only one connection per app instance
    if (_eventSource.value)
      return
    if (!isLoggedIn.value)
      return

    try {
      const es = new EventSource('/api/live-sync')

      es.onopen = () => {
        _isConnected.value = true
        _reconnectAttempts.value = 0
      }

      es.onmessage = (e) => {
        try {
          const data: LiveSyncEvent = JSON.parse(e.data)
          handleChange(data)
        }
        catch {
          // Malformed event — ignore
        }
      }

      es.onerror = () => {
        _isConnected.value = false
        es.close()
        _eventSource.value = null

        // Exponential backoff: 2s, 4s, 8s, 16s, max 60s
        const delay = Math.min(2000 * 2 ** _reconnectAttempts.value, 60000)
        _reconnectAttempts.value++

        setTimeout(() => {
          if (isLoggedIn.value) {
            connect()
          }
        }, delay)
      }

      _eventSource.value = es
    }
    catch {
      // SSE not supported or connection failed
    }
  }

  /**
   * Disconnect and cleanup.
   */
  function disconnect() {
    if (_eventSource.value) {
      _eventSource.value.close()
      _eventSource.value = null
    }
    _isConnected.value = false

    // Clear all pending debounced refreshes
    for (const key of Object.keys(_pendingRefresh)) {
      clearTimeout(_pendingRefresh[key])
      delete _pendingRefresh[key]
    }
  }

  /**
   * Boot the live sync engine. Call from app.vue on mount.
   */
  function startLiveSync() {
    if (_started.value)
      return
    _started.value = true

    if (import.meta.client) {
      connect()

      // Reconnect when tab becomes visible again
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !_eventSource.value && isLoggedIn.value) {
          connect()
        }
      })
    }
  }

  return {
    isConnected: _isConnected,
    lastEvent: _lastEvent,
    startLiveSync,
    disconnect,
  }
}
