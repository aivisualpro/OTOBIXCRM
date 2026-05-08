import { toast } from 'vue-sonner'

/**
 * Polls for new unread notifications and shows toast banners.
 * Call once in the root layout — it auto-starts polling on mount.
 *
 * KEY DESIGN:
 * The FIRST poll silently seeds all existing notification IDs into the
 * "known" set WITHOUT showing any toasts. Only notifications that appear
 * in SUBSEQUENT polls (i.e. truly new ones) trigger a toast.
 * This prevents the "flood of old toasts on page load" bug.
 *
 * Known IDs are persisted in localStorage so they survive HMR & soft reloads.
 */
export function useNotificationBanner() {
  const POLL_INTERVAL = 30_000 // 30 seconds
  const LS_KEY = 'otobix_notif_known_ids'

  const unreadTotal = useState('notif_unread_total', () => 0)
  const _started = useState('notif_banner_started', () => false)

  // Track whether the very first poll (baseline) has completed
  let _baselineLoaded = false
  let timer: ReturnType<typeof setInterval> | null = null

  // ── Persist known IDs in localStorage (survives HMR + page reload) ──
  function loadKnownIds(): Record<string, boolean> {
    if (!import.meta.client) return {}
    try {
      const raw = localStorage.getItem(LS_KEY)
      return raw ? JSON.parse(raw) : {}
    }
    catch { return {} }
  }

  function saveKnownIds(ids: Record<string, boolean>) {
    if (!import.meta.client) return
    try {
      // Cap at 500 entries to prevent localStorage bloat
      const keys = Object.keys(ids)
      if (keys.length > 500) {
        const trimmed: Record<string, boolean> = {}
        keys.slice(-500).forEach(k => { trimmed[k] = true })
        localStorage.setItem(LS_KEY, JSON.stringify(trimmed))
        return
      }
      localStorage.setItem(LS_KEY, JSON.stringify(ids))
    }
    catch { /* quota exceeded — ignore */ }
  }

  function getCurrentUser() {
    try {
      const cookie = useCookie('userData')
      const user = typeof cookie.value === 'string' ? JSON.parse(cookie.value) : cookie.value
      return {
        email: (user?.email || '').toLowerCase(),
        role: user?.userType || user?.userRole || user?.role || '',
      }
    }
    catch { return { email: '', role: '' } }
  }

  async function poll() {
    const user = getCurrentUser()
    if (!user.email) return

    try {
      const params: Record<string, string> = { email: user.email, role: user.role }
      const data = await $fetch<any>('/api/notifications', { params })
      if (!data) return

      const notifications: any[] = data.notifications || []
      unreadTotal.value = data.unreadCounts?.all || 0

      const knownIds = loadKnownIds()

      if (!_baselineLoaded) {
        // ── FIRST POLL: seed all current IDs as "known" — no toasts ──
        for (const n of notifications) {
          const id = n._id || n.id
          if (id) knownIds[id] = true
        }
        saveKnownIds(knownIds)
        _baselineLoaded = true
        return
      }

      // ── SUBSEQUENT POLLS: only toast truly NEW notifications ──
      let hasNew = false
      for (const n of notifications) {
        const id = n._id || n.id
        if (!id || n.isRead || knownIds[id]) continue

        knownIds[id] = true
        hasNew = true

        const icon = n.type === 'task' ? '☑️' : n.type === 'inspection' ? '🔍' : n.type === 'auction' ? '🔨' : '🔔'
        toast(`${icon} ${n.title || 'New Notification'}`, {
          description: n.body?.slice(0, 120) || '',
          duration: 8000,
          action: {
            label: 'View',
            onClick: () => navigateTo('/notifications'),
          },
        })
      }

      if (hasNew) {
        saveKnownIds(knownIds)
      }
    }
    catch {
      // Silently fail — don't break the app for notification polling errors
    }
  }

  onMounted(() => {
    // Guard: only one polling loop across all layout mounts
    if (_started.value) return
    _started.value = true

    // Initial baseline poll after a short delay (let the page settle)
    setTimeout(() => poll(), 2000)
    timer = setInterval(poll, POLL_INTERVAL)
  })

  onUnmounted(() => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    // Allow re-start if the layout truly unmounts (e.g. logout)
    _started.value = false
  })

  return { unreadTotal }
}
