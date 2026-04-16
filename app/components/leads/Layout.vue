<script setup lang="ts">
const route = useRoute()

const { statusCounts, fetchCounts, activeAdvancedFilterCount, serverSearch, totalCount, matchingTabIds } = useLeadsApi()

// Fetch counts on mount (lightweight server call)
onMounted(() => fetchCounts())

const { activeWorkspace } = useWorkspace()

const currentActiveId = computed(() => {
  const path = route.path
  if (path === '/leads' || path === '/leads/')
    return 'leads'
  return path.split('/').pop() || 'leads'
})

// For the search-results tab, use the live totalCount from the composable
function getTabCount(itemId: string): number | undefined {
  if (itemId === 'search-results') {
    return totalCount.value || undefined
  }
  return statusCounts.value[itemId]
}

// Check if a tab has matching records from search results (for animated highlight)
function hasSearchMatches(itemId: string): boolean {
  return currentActiveId.value === 'search-results' && matchingTabIds.value.includes(itemId)
}

const navItems = [
  { id: 'all', title: 'All Leads', icon: 'i-lucide-layers', color: 'text-indigo-400', link: '/leads/all' },
  { id: 'pending', title: 'Pending', icon: 'i-lucide-magnet', color: 'text-blue-500', link: '/leads/pending' },
  { id: 'scheduled', title: 'Scheduled', icon: 'i-lucide-calendar', color: 'text-indigo-500', link: '/leads/scheduled' },
  { id: 're-scheduled', title: 'Re-Scheduled', icon: 'i-lucide-calendar-range', color: 'text-purple-500', link: '/leads/re-scheduled' },
  { id: 'running', title: 'Running', icon: 'i-lucide-activity', color: 'text-green-500', link: '/leads/running' },
  { id: 'cancelled', title: 'Cancelled', icon: 'i-lucide-ban', color: 'text-red-500', link: '/leads/cancelled' },
  { id: 're-inspection', title: 'Re-Inspection', icon: 'i-lucide-rotate-ccw', color: 'text-amber-500', link: '/leads/re-inspection' },
  { id: 'inspected', title: 'Inspected', icon: 'i-lucide-check-circle', color: 'text-emerald-500', link: '/leads/inspected' },
  { id: 'under-review', title: 'Under Review', icon: 'i-lucide-eye', color: 'text-orange-500', link: '/leads/under-review' },
  { id: 'quality-approved', title: 'Approved', icon: 'i-lucide-shield-check', color: 'text-teal-500', link: '/leads/quality-approved' },
  { id: 'quality-rejected', title: 'Quality Rejected', icon: 'i-lucide-shield-x', color: 'text-rose-500', link: '/leads/quality-rejected' },
]

const filteredNavItems = computed(() => {
  const allowed = activeWorkspace.value?.leadTabs
  let items = [...navItems]

  if (allowed && allowed.length > 0) {
    items = navItems.filter(item => allowed.includes(item.id))
  }

  if (activeAdvancedFilterCount.value > 0 || serverSearch.value || route.path.includes('/search-results')) {
    items.unshift({
      id: 'search-results',
      title: 'Search Results',
      icon: 'i-lucide-list-filter',
      color: 'text-amber-500',
      link: '/leads/search-results',
    })
  }

  return items
})
</script>

<template>
  <div class="-m-4 lg:-m-6 h-[calc(100%+2rem)] lg:h-[calc(100%+3rem)] flex flex-col overflow-hidden bg-background">
    <!-- Tab Navigation Bar -->
    <div class="shrink-0 border-b bg-background/80 backdrop-blur-sm z-10 flex items-center justify-between">
      <div class="flex items-center gap-2 px-4 lg:px-6 py-2 overflow-x-auto no-scrollbar">
        <NuxtLink
          v-for="item in filteredNavItems"
          :key="item.id"
          :to="item.link"
          class="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold rounded-md transition-all whitespace-nowrap flex-shrink-0 relative group overflow-hidden"
          :class="[
            currentActiveId === item.id 
              ? 'bg-primary text-primary-foreground shadow-sm' 
              : 'bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            hasSearchMatches(item.id) && currentActiveId !== item.id ? 'animate-pulse-subtle border-primary/20 bg-primary/5' : '',
            item.id === 'search-results' ? 'border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400' : ''
          ]"
        >
          <Icon :name="item.icon" class="size-4 shrink-0 transition-colors" />
          <span>{{ item.title }}</span>
          <span
            v-if="getTabCount(item.id)"
            class="text-[10px] font-bold leading-none py-[3px] px-[6px] rounded-full min-w-[20px] text-center"
            :class="[
              currentActiveId === item.id || item.id === 'search-results'
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
              hasSearchMatches(item.id) && currentActiveId !== item.id ? 'bg-primary/20 text-primary' : ''
            ]"
          >
            {{ getTabCount(item.id) }}
          </span>
          <div v-if="item.id === 'search-results'" class="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-500/50 animate-[shimmer_1.5s_infinite_linear] shadow-[0_0_10px_rgba(245,158,11,0.5)] bg-gradient-to-r from-transparent via-amber-500 to-transparent bg-[length:200%_100%]"></div>
        </NuxtLink>
      </div>
    </div>

    <!-- Full-width content area -->
    <div class="flex-1 min-h-0 overflow-hidden">
      <slot />
    </div>
  </div>
</template>

<style scoped>
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.animate-pulse-subtle {
  animation: pulse-subtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes pulse-subtle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}
</style>
