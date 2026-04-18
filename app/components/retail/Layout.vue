<script setup lang="ts">
const route = useRoute()
const { activeWorkspace } = useWorkspace()

const isBaseRoute = computed(() => {
  return route.path === '/retail' || route.path === '/retail/'
})

const currentActiveId = computed(() => {
  return String(route.query.tab || 'all')
})

const ALL_RETAIL_TABS = [
  { id: 'all', title: 'All', icon: 'i-lucide-list', link: '/retail?tab=all' },
  { id: 'upcoming', title: 'Upcoming', icon: 'i-lucide-calendar-clock', link: '/retail?tab=upcoming' },
  { id: 'live', title: 'Live', icon: 'i-lucide-radio', link: '/retail?tab=live' },
  { id: 'otobuy', title: 'Otobuy', icon: 'i-lucide-tag', link: '/retail?tab=otobuy' },
  { id: 'customer-activity', title: 'Customer Activity', icon: 'i-lucide-activity', link: '/retail?tab=customer-activity' },
  { id: 'dealer-activity', title: 'Dealer Activity', icon: 'i-lucide-users', link: '/retail?tab=dealer-activity' },
  { id: 'ended', title: 'Ended', icon: 'i-lucide-timer-off', link: '/retail?tab=ended' },
  { id: 'sold', title: 'Sold', icon: 'i-lucide-badge-check', link: '/retail?tab=sold' },
  { id: 'removed', title: 'Removed', icon: 'i-lucide-trash-2', link: '/retail?tab=removed' },
  { id: 'followup', title: 'Followup', icon: 'i-lucide-phone-forwarded', link: '/retail?tab=followup' },
]

const navItems = computed(() => {
  const allowed = activeWorkspace.value?.retailTabs
  if (allowed && allowed.length > 0) {
    return ALL_RETAIL_TABS.filter(item => allowed.includes(item.id))
  }
  return ALL_RETAIL_TABS
})

// ─── Live counts per tab ───
const { statusCounts, isFetched, fetchCounts } = useAuctionsApi()

function getTabCount(filterId: string) {
  if (!isFetched.value || !statusCounts.value) return undefined
  return statusCounts.value[filterId] || 0
}

onMounted(() => {
  if (isBaseRoute.value) fetchCounts()
})
</script>

<template>
  <div class="-m-4 lg:-m-6 h-[calc(100%+2rem)] lg:h-[calc(100%+3rem)] flex flex-col overflow-hidden bg-background">
    <!-- Tab Navigation Bar -->
    <div v-if="isBaseRoute" class="shrink-0 border-b bg-background/80 backdrop-blur-sm z-10">
      <div class="flex items-center gap-2 px-4 lg:px-6 py-2 overflow-x-auto no-scrollbar">
        <NuxtLink
          v-for="item in navItems"
          :key="item.id"
          :to="item.link"
          class="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold rounded-md transition-all whitespace-nowrap flex-shrink-0"
          :class="currentActiveId === item.id
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground'"
        >
          <Icon :name="item.icon" class="size-4" />
          <span>{{ item.title }}</span>
          <span
            v-if="getTabCount(item.id) !== undefined"
            class="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
            :class="currentActiveId === item.id
              ? 'bg-primary-foreground/20 text-primary-foreground'
              : 'bg-muted text-muted-foreground'"
          >
            {{ getTabCount(item.id) }}
          </span>
        </NuxtLink>
      </div>
    </div>

    <!-- Full-width content area -->
    <div class="flex-1 min-h-0 overflow-hidden">
      <slot />
    </div>
  </div>
</template>
