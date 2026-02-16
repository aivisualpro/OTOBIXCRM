<script setup lang="ts">
definePageMeta({ layout: 'default' })
useHead({ title: 'Notifications — OTOBIX' })

const activeTab = ref('all')
const tabs = [
  { id: 'all', label: 'All', icon: 'i-lucide-inbox' },
  { id: 'inspections', label: 'Inspections', icon: 'i-lucide-scan-search' },
  { id: 'auctions', label: 'Auctions', icon: 'i-lucide-gavel' },
  { id: 'system', label: 'System', icon: 'i-lucide-settings' },
]

interface Notification {
  id: string
  type: 'inspection' | 'auction' | 'system' | 'user'
  title: string
  message: string
  time: string
  read: boolean
  avatar?: string
  initials?: string
  icon?: string
  action?: { label: string, to?: string }
  priority?: 'low' | 'medium' | 'high'
}

const notifications = ref<Notification[]>([
  {
    id: '1',
    type: 'inspection',
    title: 'Inspection Completed',
    message: '2024 Toyota Camry (MH-12-AB-1234) inspection has been completed by Inspector Ravi. Ready for review.',
    time: '2 min ago',
    read: false,
    initials: 'RK',
    icon: 'i-lucide-check-circle',
    action: { label: 'Review', to: '/inspection/1' },
    priority: 'high',
  },
  {
    id: '2',
    type: 'auction',
    title: 'New Bid Received',
    message: 'Honda City (GJ-01-CD-5678) received a new highest bid of ₹4,85,000 from AutoMax Dealers.',
    time: '15 min ago',
    read: false,
    initials: 'AM',
    icon: 'i-lucide-trending-up',
    action: { label: 'View Auction' },
    priority: 'high',
  },
  {
    id: '3',
    type: 'inspection',
    title: 'Inspection Assigned',
    message: 'New inspection for 2023 Hyundai Creta (DL-03-EF-9012) has been assigned to you.',
    time: '1 hour ago',
    read: false,
    initials: 'OT',
    icon: 'i-lucide-clipboard-list',
    action: { label: 'Start Inspection' },
    priority: 'medium',
  },
  {
    id: '4',
    type: 'auction',
    title: 'Auction Ending Soon',
    message: 'Maruti Suzuki Swift (KA-05-GH-3456) auction ends in 30 minutes. Current bid: ₹3,20,000.',
    time: '2 hours ago',
    read: true,
    initials: 'AT',
    icon: 'i-lucide-clock',
    priority: 'medium',
  },
  {
    id: '5',
    type: 'system',
    title: 'Weekly Report Generated',
    message: 'Your weekly inspection summary report for Feb 9 – Feb 15 is ready to download.',
    time: '5 hours ago',
    read: true,
    icon: 'i-lucide-file-bar-chart',
    action: { label: 'Download' },
    priority: 'low',
  },
  {
    id: '6',
    type: 'system',
    title: 'System Maintenance',
    message: 'Scheduled downtime on Feb 17, 2:00 AM – 4:00 AM IST for server upgrades. Plan accordingly.',
    time: '1 day ago',
    read: true,
    icon: 'i-lucide-wrench',
    priority: 'low',
  },
  {
    id: '7',
    type: 'inspection',
    title: 'Inspection Rejected',
    message: '2022 Kia Seltos (TN-10-IJ-7890) inspection was rejected by QA. Please re-inspect exterior panels.',
    time: '1 day ago',
    read: true,
    initials: 'QA',
    icon: 'i-lucide-x-circle',
    action: { label: 'View Details' },
    priority: 'high',
  },
  {
    id: '8',
    type: 'auction',
    title: 'Auction Won',
    message: 'Congratulations! Tata Nexon (MH-04-KL-2345) was sold to PrimeCars for ₹6,10,000.',
    time: '2 days ago',
    read: true,
    initials: 'PC',
    icon: 'i-lucide-party-popper',
    priority: 'low',
  },
])

const filteredNotifications = computed(() => {
  if (activeTab.value === 'all') return notifications.value
  const typeMap: Record<string, string> = {
    inspections: 'inspection',
    auctions: 'auction',
    system: 'system',
  }
  return notifications.value.filter(n => n.type === typeMap[activeTab.value])
})

const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

const tabCounts = computed(() => ({
  all: notifications.value.filter(n => !n.read).length,
  inspections: notifications.value.filter(n => !n.read && n.type === 'inspection').length,
  auctions: notifications.value.filter(n => !n.read && n.type === 'auction').length,
  system: notifications.value.filter(n => !n.read && n.type === 'system').length,
}))

function markAllRead() {
  notifications.value.forEach(n => n.read = true)
}

function markRead(id: string) {
  const notif = notifications.value.find(n => n.id === id)
  if (notif) notif.read = true
}

function dismiss(id: string) {
  notifications.value = notifications.value.filter(n => n.id !== id)
}

function typeColor(type: string) {
  switch (type) {
    case 'inspection': return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20'
    case 'auction': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
    case 'system': return 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20'
    default: return 'bg-muted text-muted-foreground'
  }
}

function typeIconBg(type: string) {
  switch (type) {
    case 'inspection': return 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
    case 'auction': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
    case 'system': return 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
    default: return 'bg-muted text-muted-foreground'
  }
}

function priorityDot(priority?: string) {
  switch (priority) {
    case 'high': return 'bg-red-500'
    case 'medium': return 'bg-amber-500'
    default: return 'bg-emerald-500'
  }
}
</script>

<template>
  <div class="p-4 md:p-6 lg:p-8 space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-2xl font-bold tracking-tight flex items-center gap-3">
          <div class="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon name="i-lucide-bell" class="size-5 text-primary" />
          </div>
          Notifications
          <Badge v-if="unreadCount" variant="destructive" class="text-xs">
            {{ unreadCount }} new
          </Badge>
        </h1>
        <p class="text-sm text-muted-foreground">Stay updated on inspections, auctions, and system activity.</p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          v-if="unreadCount"
          variant="outline"
          size="sm"
          class="gap-2"
          @click="markAllRead"
        >
          <Icon name="i-lucide-check-check" class="size-4" />
          Mark all read
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm" class="gap-2">
              <Icon name="i-lucide-sliders-horizontal" class="size-4" />
              Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Show</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>All notifications</DropdownMenuItem>
            <DropdownMenuItem>Unread only</DropdownMenuItem>
            <DropdownMenuItem>High priority</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <!-- Tab bar -->
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

    <!-- Notifications list -->
    <div class="space-y-3">
      <TransitionGroup name="list" tag="div" class="space-y-3">
        <div
          v-for="notif in filteredNotifications"
          :key="notif.id"
          class="group relative rounded-xl border transition-all duration-300 hover:shadow-md"
          :class="notif.read ? 'bg-card' : 'bg-primary/[0.02] border-primary/20'"
        >
          <!-- Unread indicator bar -->
          <div
            v-if="!notif.read"
            class="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-primary"
          />

          <div class="flex items-start gap-4 p-4" :class="!notif.read ? 'pl-5' : ''">
            <!-- Icon / Avatar -->
            <div class="shrink-0 mt-0.5">
              <div
                v-if="notif.initials"
                class="size-10 rounded-full flex items-center justify-center text-xs font-bold"
                :class="typeIconBg(notif.type)"
              >
                {{ notif.initials }}
              </div>
              <div
                v-else
                class="size-10 rounded-full flex items-center justify-center"
                :class="typeIconBg(notif.type)"
              >
                <Icon :name="notif.icon || 'i-lucide-bell'" class="size-5" />
              </div>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0 space-y-1.5">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-2 min-w-0">
                  <!-- Priority dot -->
                  <span
                    class="shrink-0 size-2 rounded-full"
                    :class="priorityDot(notif.priority)"
                  />
                  <h3
                    class="text-sm truncate"
                    :class="notif.read ? 'font-medium' : 'font-semibold'"
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
                </div>
                <span class="shrink-0 text-xs text-muted-foreground whitespace-nowrap">{{ notif.time }}</span>
              </div>

              <p class="text-sm text-muted-foreground leading-relaxed">
                {{ notif.message }}
              </p>

              <!-- Actions row -->
              <div class="flex items-center gap-2 pt-1">
                <Button
                  v-if="notif.action"
                  variant="outline"
                  size="sm"
                  class="h-7 text-xs gap-1.5"
                >
                  <Icon name="i-lucide-external-link" class="size-3" />
                  {{ notif.action.label }}
                </Button>
                <Button
                  v-if="!notif.read"
                  variant="ghost"
                  size="sm"
                  class="h-7 text-xs gap-1.5 text-muted-foreground"
                  @click.stop="markRead(notif.id)"
                >
                  <Icon name="i-lucide-check" class="size-3" />
                  Mark read
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 text-xs gap-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                  @click.stop="dismiss(notif.id)"
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
        v-if="filteredNotifications.length === 0"
        class="flex flex-col items-center justify-center py-20 text-center"
      >
        <div class="size-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-6">
          <Icon name="i-lucide-bell-off" class="size-8 text-muted-foreground/50" />
        </div>
        <h3 class="text-lg font-semibold mb-1">All caught up!</h3>
        <p class="text-sm text-muted-foreground max-w-sm">
          No {{ activeTab === 'all' ? '' : activeTab + ' ' }}notifications right now. We'll let you know when something needs your attention.
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
