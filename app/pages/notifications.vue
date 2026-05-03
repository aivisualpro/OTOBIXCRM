<script setup lang="ts">
definePageMeta({ layout: 'default' })
useHead({ title: 'Notifications — OTOBIX' })

const activeTab = ref('all')
const tabs = [
  { id: 'all', label: 'All', icon: 'i-lucide-inbox' },
  { id: 'tasks', label: 'Tasks', icon: 'i-lucide-check-square' },
  { id: 'inspections', label: 'Inspections', icon: 'i-lucide-scan-search' },
  { id: 'auctions', label: 'Auctions', icon: 'i-lucide-gavel' },
  { id: 'system', label: 'System', icon: 'i-lucide-settings' },
]

interface NotificationData {
  carId?: string
  carName?: string
  highestBid?: number
  winnerId?: string
}

interface UserNotification {
  _id: string
  userId?: string
  type: string
  title: string
  body: string
  data?: NotificationData
  isRead: boolean
  createdAt: string
  isGlobal?: boolean
}

// Reactive state
const notifications = ref<UserNotification[]>([])
const loading = ref(false)
const unreadCounts = ref({ all: 0, tasks: 0, inspections: 0, auctions: 0, system: 0 })

// Get current user for permission-based filtering
function getCurrentUser() {
  try {
    const cookie = useCookie('userData')
    const user = typeof cookie.value === 'string' ? JSON.parse(cookie.value) : cookie.value
    return {
      email: (user?.email || '').toLowerCase(),
      role: (user?.userType || user?.userRole || user?.role || '').toLowerCase(),
    }
  }
  catch { return { email: '', role: '' } }
}

// Fetch notifications from API
async function fetchNotifications() {
  loading.value = true
  try {
    const typeMap: Record<string, string> = {
      tasks: 'task',
      inspections: 'inspection',
      auctions: 'auction',
      system: 'system',
    }
    const params: Record<string, string> = {}
    const user = getCurrentUser()
    if (user.email) params.email = user.email
    if (user.role) params.role = user.role
    if (activeTab.value !== 'all') {
      params.type = typeMap[activeTab.value] || activeTab.value
    }

    const { data } = await useFetch('/api/notifications', { params })
    if (data.value) {
      notifications.value = (data.value as any).notifications || []
      unreadCounts.value = (data.value as any).unreadCounts || { all: 0, tasks: 0, inspections: 0, auctions: 0, system: 0 }
    }
  }
  catch (err) {
    console.error('Failed to fetch notifications:', err)
  }
  finally {
    loading.value = false
  }
}

const filteredNotifications = computed(() => {
  if (activeTab.value === 'all')
    return notifications.value
  const typeMap: Record<string, string> = {
    tasks: 'task',
    inspections: 'inspection',
    auctions: 'auction',
    system: 'system',
  }
  return notifications.value.filter(n => n.type === typeMap[activeTab.value])
})

const unreadCount = computed(() => unreadCounts.value.all)

const tabCounts = computed(() => unreadCounts.value)

// Watch tab changes and refetch
watch(activeTab, () => fetchNotifications())

const { setHeader } = usePageHeader()
watch([unreadCount, () => activeTab.value], () => {
  setHeader({
    title: 'Notifications',
    icon: 'i-lucide-bell',
    description: 'Stay updated on inspections, auctions, and system activity.',
    badge: unreadCount.value ? `${unreadCount.value} new` : '',
  })
}, { immediate: true })

// Initial fetch
onMounted(() => fetchNotifications())

// Mark all notifications as read
async function markAllRead() {
  try {
    await $fetch('/api/notifications', {
      method: 'PUT',
      body: { markAllRead: true },
    })
    // Optimistic update
    notifications.value.forEach(n => n.isRead = true)
    unreadCounts.value = { all: 0, tasks: 0, inspections: 0, auctions: 0, system: 0 }
  }
  catch (err) {
    console.error('Failed to mark all read:', err)
  }
}

// Mark a single notification as read
async function markRead(id: string) {
  try {
    await $fetch('/api/notifications', {
      method: 'PUT',
      body: { _id: id },
    })
    // Optimistic update
    const notif = notifications.value.find(n => n._id === id)
    if (notif && !notif.isRead) {
      notif.isRead = true
      unreadCounts.value.all = Math.max(0, unreadCounts.value.all - 1)
      // Decrement the type-specific count
      const typeKey = notif.type === 'inspection' ? 'inspections' : notif.type === 'auction' ? 'auctions' : notif.type === 'task' ? 'tasks' : 'system'
      if (typeKey in unreadCounts.value) {
        (unreadCounts.value as any)[typeKey] = Math.max(0, (unreadCounts.value as any)[typeKey] - 1)
      }
    }
  }
  catch (err) {
    console.error('Failed to mark read:', err)
  }
}

// Dismiss (delete) a notification
async function dismiss(id: string) {
  try {
    await $fetch('/api/notifications', {
      method: 'DELETE',
      body: { _id: id },
    })
    // Optimistic update
    const notif = notifications.value.find(n => n._id === id)
    if (notif && !notif.isRead) {
      unreadCounts.value.all = Math.max(0, unreadCounts.value.all - 1)
      const typeKey = notif.type === 'inspection' ? 'inspections' : notif.type === 'auction' ? 'auctions' : notif.type === 'task' ? 'tasks' : 'system'
      if (typeKey in unreadCounts.value) {
        (unreadCounts.value as any)[typeKey] = Math.max(0, (unreadCounts.value as any)[typeKey] - 1)
      }
    }
    notifications.value = notifications.value.filter(n => n._id !== id)
  }
  catch (err) {
    console.error('Failed to dismiss notification:', err)
  }
}

function typeColor(type: string) {
  switch (type) {
    case 'inspection': return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20'
    case 'auction': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
    case 'system': return 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20'
    case 'user': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    case 'task': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    default: return 'bg-muted text-muted-foreground'
  }
}

function typeIconBg(type: string) {
  switch (type) {
    case 'inspection': return 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
    case 'auction': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
    case 'system': return 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
    case 'task': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
    case 'user': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
    default: return 'bg-muted text-muted-foreground'
  }
}

function typeIcon(type: string) {
  switch (type) {
    case 'inspection': return 'i-lucide-scan-search'
    case 'auction': return 'i-lucide-gavel'
    case 'system': return 'i-lucide-settings'
    case 'user': return 'i-lucide-user'
    case 'task': return 'i-lucide-check-square'
    default: return 'i-lucide-bell'
  }
}

function timeAgo(dateStr: string) {
  if (!dateStr)
    return ''
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60)
    return 'just now'
  if (diffMin < 60)
    return `${diffMin} min ago`
  if (diffHour < 24)
    return `${diffHour}h ago`
  if (diffDay < 7)
    return `${diffDay}d ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header Actions (Teleported) -->
    <Teleport to="#header-actions">
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          class="gap-2 h-8 px-3 rounded-lg border-border/50 bg-background/50 hover:bg-background"
          @click="fetchNotifications"
        >
          <Icon name="i-lucide-refresh-cw" class="size-3.5" :class="loading ? 'animate-spin' : ''" />
          <span class="hidden sm:inline">Refresh</span>
        </Button>
        <Button
          v-if="unreadCount"
          variant="outline"
          size="sm"
          class="gap-2 h-8 px-3 rounded-lg border-border/50 bg-background/50 hover:bg-background"
          @click="markAllRead"
        >
          <Icon name="i-lucide-check-check" class="size-3.5" />
          <span class="hidden sm:inline">Mark all read</span>
        </Button>
      </div>
    </Teleport>

    <!-- Actions bar -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-1 p-1 bg-muted/50 rounded-xl border w-fit">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200"
          :class="
            activeTab === tab.id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          "
          @click="activeTab = tab.id"
        >
          <Icon :name="tab.icon" class="size-4" />
          {{ tab.label }}
          <span
            v-if="tabCounts[tab.id as keyof typeof tabCounts]"
            class="flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground"
          >
            {{ tabCounts[tab.id as keyof typeof tabCounts] }}
          </span>
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading && notifications.length === 0" class="space-y-3">
      <div v-for="i in 5" :key="i" class="rounded-xl border p-4 animate-pulse">
        <div class="flex items-start gap-4">
          <div class="size-10 rounded-full bg-muted" />
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-muted rounded w-1/3" />
            <div class="h-3 bg-muted rounded w-2/3" />
          </div>
        </div>
      </div>
    </div>

    <!-- Notifications list -->
    <div v-else class="space-y-3">
      <TransitionGroup name="list" tag="div" class="space-y-3">
        <div
          v-for="notif in filteredNotifications"
          :key="notif._id"
          class="group relative rounded-xl border transition-all duration-300 hover:shadow-md"
          :class="notif.isRead ? 'bg-card' : 'bg-primary/[0.02] border-primary/20'"
        >
          <!-- Unread indicator bar -->
          <div
            v-if="!notif.isRead"
            class="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-primary"
          />

          <div class="flex items-start gap-4 p-4" :class="!notif.isRead ? 'pl-5' : ''">
            <!-- Icon -->
            <div class="shrink-0 mt-0.5">
              <div
                class="size-10 rounded-full flex items-center justify-center"
                :class="typeIconBg(notif.type)"
              >
                <Icon :name="typeIcon(notif.type)" class="size-5" />
              </div>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0 space-y-1.5">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-2 min-w-0">
                  <!-- Unread dot -->
                  <span
                    v-if="!notif.isRead"
                    class="shrink-0 size-2 rounded-full bg-primary"
                  />
                  <h3
                    class="text-sm truncate"
                    :class="notif.isRead ? 'font-medium' : 'font-semibold'"
                  >
                    {{ notif.title }}
                  </h3>
                  <Badge
                    variant="outline"
                    class="shrink-0 text-[10px] capitalize"
                    :class="typeColor(notif.type)"
                  >
                    {{ notif.type }}
                  </Badge>
                  <Badge
                    v-if="notif.isGlobal"
                    variant="outline"
                    class="shrink-0 text-[10px] bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20"
                  >
                    Global
                  </Badge>
                </div>
                <span class="shrink-0 text-xs text-muted-foreground whitespace-nowrap">{{ timeAgo(notif.createdAt) }}</span>
              </div>

              <p class="text-sm text-muted-foreground leading-relaxed">
                {{ notif.body }}
              </p>

              <!-- Data details (car info, bid info) -->
              <div
                v-if="notif.data && (notif.data.carName || notif.data.highestBid)"
                class="flex flex-wrap items-center gap-2 pt-0.5"
              >
                <Badge v-if="notif.data.carName" variant="secondary" class="text-[11px] gap-1">
                  <Icon name="i-lucide-car" class="size-3" />
                  {{ notif.data.carName }}
                </Badge>
                <Badge v-if="notif.data.highestBid" variant="secondary" class="text-[11px] gap-1">
                  <Icon name="i-lucide-indian-rupee" class="size-3" />
                  {{ Number(notif.data.highestBid).toLocaleString('en-IN') }}
                </Badge>
              </div>

              <!-- Actions row -->
              <div class="flex items-center gap-2 pt-1">
                <Button
                  v-if="!notif.isRead"
                  variant="ghost"
                  size="sm"
                  class="h-7 text-xs gap-1.5 text-muted-foreground"
                  @click.stop="markRead(notif._id)"
                >
                  <Icon name="i-lucide-check" class="size-3" />
                  Mark read
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 text-xs gap-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                  @click.stop="dismiss(notif._id)"
                >
                  <Icon name="i-lucide-x" class="size-3" />
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      </TransitionGroup>

      <!-- Empty state -->
      <div
        v-if="!loading && filteredNotifications.length === 0"
        class="flex flex-col items-center justify-center py-20 text-center"
      >
        <div class="size-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-6">
          <Icon name="i-lucide-bell-off" class="size-8 text-muted-foreground/50" />
        </div>
        <h3 class="text-lg font-semibold mb-1">
          All caught up!
        </h3>
        <p class="text-sm text-muted-foreground max-w-sm">
          No {{ activeTab === 'all' ? '' : `${activeTab} ` }}notifications right now. We'll let you know when something needs your attention.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
.list-move {
  transition: transform 0.3s ease;
}
</style>
