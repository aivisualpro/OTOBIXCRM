/**
 * ─── Live Sync Engine v3 ───
 *
 * Real-time data synchronization via SSE with event ordering/versioning.
 *
 * Architecture:
 * 1. Client connects to /api/live-sync, receives currentVersion
 * 2. Server pushes versioned events with monotonic eventId
 * 3. Client patches cached data in-place — no refetch needed
 * 4. On reconnect, browser sends Last-Event-ID → server replays missed events
 * 5. If ring buffer is exhausted, falls back to delta endpoints
 *
 * Rules enforced:
 * - create: payload is full normalized record → unshift into cache
 * - update: payload is changed fields only → shallow merge into cached record
 * - delete: payload is null → splice from cache by recordId
 * - Never refetch all collections; only invalidate affected cache entries
 * - Use shallowRef-compatible patching (trigger reactivity explicitly)
 */

interface SyncEvent {
  type: 'connected' | 'change'
  /** Monotonic event ID for ordering */
  eventId?: number
  /** Same as eventId — global sequence */
  version?: number
  /** Server's current version on connect */
  currentVersion?: number
  collection?: string
  action?: 'create' | 'update' | 'delete'
  recordId?: string
  updatedAt?: string
  changedBy?: string
  /** create: full doc, update: changed fields, delete: null */
  payload?: Record<string, any> | null
}

export function useLiveSync() {
  const _isConnected = useState('livesync_connected', () => false)
  const _lastEvent = useState<SyncEvent | null>('livesync_lastEvent', () => null)
  const _eventSource = useState<EventSource | null>('livesync_es', () => null)
  const _reconnectAttempts = useState('livesync_reconnectAttempts', () => 0)
  const _started = useState('livesync_started', () => false)
  const _lastEventId = useState('livesync_lastEventId', () => 0)
  const _lastSyncTimestamp = useState('livesync_lastSyncTs', () => 0)

  const isLoggedIn = useCookie('isLoggedIn')

  // Debounce map — prevent rapid re-patches from burst writes
  const _pendingPatch: Record<string, ReturnType<typeof setTimeout>> = {}

  /**
   * Handle incoming SSE change events.
   * Debounces update patches to avoid thrashing on rapid edits.
   */
  function handleChange(event: SyncEvent) {
    if (event.type !== 'change' || !event.collection) return

    _lastEvent.value = event

    // Track latest eventId for ordering
    if (event.eventId) {
      _lastEventId.value = Math.max(_lastEventId.value, event.eventId)
    }
    if (event.updatedAt) {
      const ts = new Date(event.updatedAt).getTime()
      if (!isNaN(ts)) {
        _lastSyncTimestamp.value = Math.max(_lastSyncTimestamp.value, ts)
      }
    }

    const key = `${event.collection}:${event.recordId || 'batch'}`

    // Deletes and creates: apply immediately
    if (event.action === 'delete' || event.action === 'create') {
      applyDeltaPatch(event)
      return
    }

    // Updates: debounce 300ms to batch rapid field-by-field saves
    if (_pendingPatch[key]) {
      clearTimeout(_pendingPatch[key])
    }

    _pendingPatch[key] = setTimeout(() => {
      applyDeltaPatch(event)
      delete _pendingPatch[key]
    }, 300)
  }

  /**
   * Apply a delta patch to the cached data stores.
   * Only patches the affected collection — never refetches all.
   */
  function applyDeltaPatch(event: SyncEvent) {
    const { collection, action, recordId, payload } = event
    if (!collection || !action) return

    try {
      switch (collection) {
        case 'leads':
        case 'telecallings':
          _patchLeads(action, recordId, payload)
          break
        case 'cars':
          _patchCars(action, recordId, payload)
          break
        case 'users':
          _patchUsers(action, recordId, payload)
          break
      }
    }
    catch {
      // Silent fail — data will refresh on next navigation
    }
  }

  // ──────────────────────────────────────────────
  // Collection patchers — use useState directly
  // (safe from SSE callbacks since useState is just a keyed Map lookup)
  // ──────────────────────────────────────────────

  function _patchLeads(action: string, recordId?: string, payload?: Record<string, any> | null) {
    const _leads = useState<any[]>('leads_data')
    const _totalCount = useState<number>('leads_totalCount')

    if (action === 'create' && payload) {
      const normalized = { ...payload, id: payload._id || payload.id }
      const exists = _leads.value.some((l: any) =>
        String(l._id || l.id) === String(normalized.id)
        || String(l.appointmentId) === String(payload.appointmentId),
      )
      if (!exists) {
        _leads.value = [normalized, ..._leads.value]
        _totalCount.value = (_totalCount.value || 0) + 1
      }
      _refreshLeadCounts()
    }
    else if (action === 'update' && recordId && payload) {
      const idx = _leads.value.findIndex((l: any) =>
        String(l._id || l.id) === recordId
        || String(l.appointmentId) === recordId,
      )
      if (idx !== -1) {
        // Shallow merge changed fields → reassign to trigger reactivity
        const updated = { ..._leads.value[idx], ...payload }
        const arr = [..._leads.value]
        arr[idx] = updated
        _leads.value = arr
      }
    }
    else if (action === 'delete' && recordId) {
      const idx = _leads.value.findIndex((l: any) =>
        String(l._id || l.id) === recordId
        || String(l.appointmentId) === recordId,
      )
      if (idx !== -1) {
        const arr = [..._leads.value]
        arr.splice(idx, 1)
        _leads.value = arr
        _totalCount.value = Math.max(0, (_totalCount.value || 0) - 1)
      }
      _refreshLeadCounts()
    }
  }

  /** Lightweight background counts refresh (non-blocking) */
  function _refreshLeadCounts() {
    $fetch('/api/leads/counts', { params: { t: String(Date.now()) } }).then((res: any) => {
      const _counts = useState<Record<string, number>>('leads_counts')
      const _countsTotal = useState('leads_countsTotal')
      if (res?.counts) _counts.value = res.counts
      if (res?.totalCount) _countsTotal.value = res.totalCount
    }).catch(() => {})
  }

  function _patchCars(action: string, recordId?: string, payload?: Record<string, any> | null) {
    const _allCars = useState<any[]>('auctions_data')

    if (action === 'create' && payload) {
      const normalized = { ...payload, id: payload._id || payload.id }
      const exists = _allCars.value.some((c: any) =>
        String(c._id || c.id) === String(normalized.id)
        || String(c.appointmentId) === String(payload.appointmentId),
      )
      if (!exists) {
        _allCars.value = [normalized, ..._allCars.value]
      }
    }
    else if (action === 'update' && recordId && payload) {
      const idx = _allCars.value.findIndex((c: any) =>
        String(c._id || c.id) === recordId
        || String(c.appointmentId) === recordId,
      )
      if (idx !== -1) {
        const updated = { ..._allCars.value[idx], ...payload }
        const arr = [..._allCars.value]
        arr[idx] = updated
        _allCars.value = arr
      }
    }
    else if (action === 'delete' && recordId) {
      const idx = _allCars.value.findIndex((c: any) =>
        String(c._id || c.id) === recordId
        || String(c.appointmentId) === recordId,
      )
      if (idx !== -1) {
        const arr = [..._allCars.value]
        arr.splice(idx, 1)
        _allCars.value = arr
      }
    }
  }

  function _patchUsers(action: string, recordId?: string, payload?: Record<string, any> | null) {
    const _allUsers = useState<any[]>('people_users')

    if (action === 'create' && payload) {
      const normalized = { ...payload, id: payload._id || payload.id }
      const exists = _allUsers.value.some((u: any) =>
        String(u._id || u.id) === String(normalized.id),
      )
      if (!exists) {
        _allUsers.value = [normalized, ..._allUsers.value]
      }
    }
    else if (action === 'update' && recordId && payload) {
      const idx = _allUsers.value.findIndex((u: any) =>
        String(u._id || u.id) === recordId,
      )
      if (idx !== -1) {
        const updated = { ..._allUsers.value[idx], ...payload }
        const arr = [..._allUsers.value]
        arr[idx] = updated
        _allUsers.value = arr
      }
    }
    else if (action === 'delete' && recordId) {
      const idx = _allUsers.value.findIndex((u: any) =>
        String(u._id || u.id) === recordId,
      )
      if (idx !== -1) {
        const arr = [..._allUsers.value]
        arr.splice(idx, 1)
        _allUsers.value = arr
      }
    }
  }

  // ──────────────────────────────────────────────
  // Reconnect catch-up: delta endpoints as fallback
  // ──────────────────────────────────────────────

  async function _catchUpAfterReconnect() {
    const since = _lastSyncTimestamp.value
    if (!since) return

    try {
      // Catch up leads (only records changed since last sync)
      const leadsRes = await $fetch<{ leads: any[], ts: number }>(`/api/leads/delta?since=${since}&t=${Date.now()}`)
      if (leadsRes.leads?.length) {
        const _leads = useState<any[]>('leads_data')
        const changedMap = new Map(leadsRes.leads.map((l: any) => [String(l._id || l.id), l]))
        _leads.value = _leads.value.map((existing: any) => {
          const key = String(existing._id || existing.id)
          const updated = changedMap.get(key)
          if (updated) {
            changedMap.delete(key)
            return { ...updated, id: updated.id || updated._id }
          }
          return existing
        })
        for (const [, newLead] of changedMap) {
          _leads.value.push({ ...newLead, id: newLead.id || newLead._id })
        }
      }

      // Catch up cars
      const carsRes = await $fetch<{ cars: any[], ts: number }>(`/api/cars/sync?since=${since}&t=${Date.now()}`)
      if (carsRes.cars?.length) {
        const _allCars = useState<any[]>('auctions_data')
        const changedMap = new Map(carsRes.cars.map((c: any) => [String(c._id || c.id), c]))
        _allCars.value = _allCars.value.map((existing: any) => {
          const key = String(existing._id || existing.id)
          const updated = changedMap.get(key)
          if (updated) {
            changedMap.delete(key)
            return { ...updated, id: updated.id || updated._id }
          }
          return existing
        })
        for (const [, newCar] of changedMap) {
          _allCars.value.push({ ...newCar, id: newCar.id || newCar._id })
        }
      }

      // Catch up users
      const usersRes = await $fetch<{ users: any[], ts: number }>(`/api/users/delta?since=${since}&t=${Date.now()}`)
      if (usersRes.users?.length) {
        const _allUsers = useState<any[]>('people_users')
        const changedMap = new Map(usersRes.users.map((u: any) => [String(u._id || u.id), u]))
        _allUsers.value = _allUsers.value.map((existing: any) => {
          const key = String(existing._id || existing.id)
          const updated = changedMap.get(key)
          if (updated) {
            changedMap.delete(key)
            return { ...updated, id: updated.id || updated._id }
          }
          return existing
        })
        for (const [, newUser] of changedMap) {
          _allUsers.value.push({ ...newUser, id: newUser.id || newUser._id })
        }
      }

      // Update timestamp to latest
      const maxTs = Math.max(
        leadsRes.ts || since,
        carsRes.ts || since,
        usersRes.ts || since,
      )
      _lastSyncTimestamp.value = maxTs
    }
    catch {
      // Silent fail — will catch up on next successful sync
    }
  }

  // ──────────────────────────────────────────────
  // SSE Connection
  // ──────────────────────────────────────────────

  function connect() {
    if (_eventSource.value) return
    if (!isLoggedIn.value) return

    try {
      const es = new EventSource('/api/live-sync')

      es.onopen = () => {
        _isConnected.value = true
        const wasDisconnected = _reconnectAttempts.value > 0
        _reconnectAttempts.value = 0

        // On reconnect: browser auto-sends Last-Event-ID header,
        // so the server replays missed events from ring buffer.
        // If buffer was exhausted (long disconnect), fall back to delta endpoints.
        if (wasDisconnected && _lastSyncTimestamp.value) {
          _catchUpAfterReconnect()
        }
      }

      es.onmessage = (e) => {
        try {
          const data: SyncEvent = JSON.parse(e.data)

          if (data.type === 'connected') {
            // Store server's current version for gap detection
            if (data.currentVersion) {
              _lastEventId.value = data.currentVersion
            }
            if (!_lastSyncTimestamp.value) {
              _lastSyncTimestamp.value = Date.now()
            }
            return
          }

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

  function disconnect() {
    if (_eventSource.value) {
      _eventSource.value.close()
      _eventSource.value = null
    }
    _isConnected.value = false

    for (const key of Object.keys(_pendingPatch)) {
      clearTimeout(_pendingPatch[key])
      delete _pendingPatch[key]
    }
  }

  function startLiveSync() {
    if (_started.value) return
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
    lastEventId: _lastEventId,
    startLiveSync,
    disconnect,
  }
}
