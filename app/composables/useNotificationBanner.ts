import { toast } from 'vue-sonner'

/**
 * Polls for new unread notifications and shows toast banners.
 * Call once in the root layout — it auto-starts polling on mount.
 */
export function useNotificationBanner() {
  const POLL_INTERVAL = 30_000 // 30 seconds
  const seenIds = useState<Set<string>>('notif_seen_ids', () => new Set())
  const unreadTotal = useState('notif_unread_total', () => 0)
  let timer: ReturnType<typeof setInterval> | null = null

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

      // Show toast for each NEW unread notification we haven't seen yet
      for (const n of notifications) {
        const id = n._id || n.id
        if (!id || n.isRead || seenIds.value.has(id)) continue

        seenIds.value.add(id)

        // Show toast banner
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
    }
    catch {
      // Silently fail — don't break the app for notification polling errors
    }
  }

  onMounted(() => {
    // Initial poll after a short delay (let the page settle)
    setTimeout(() => poll(), 2000)
    timer = setInterval(poll, POLL_INTERVAL)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  return { unreadTotal }
}
