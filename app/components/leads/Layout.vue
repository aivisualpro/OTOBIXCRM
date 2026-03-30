<script setup lang="ts">
const route = useRoute()

const { statusCounts, fetchCounts, activeAdvancedFilterCount, serverSearch, totalCount, matchingTabIds } = useLeadsApi()

// Fetch counts on mount (lightweight server call)
onMounted(() => fetchCounts())

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
  { id: 'leads', title: 'Leads', icon: 'i-lucide-magnet', color: 'text-blue-500', link: '/leads' },
  { id: 'scheduled', title: 'Scheduled', icon: 'i-lucide-calendar', color: 'text-indigo-500', link: '/leads/scheduled' },
  { id: 're-scheduled', title: 'Re-Scheduled', icon: 'i-lucide-calendar-range', color: 'text-purple-500', link: '/leads/re-scheduled' },
  { id: 'running', title: 'Running', icon: 'i-lucide-activity', color: 'text-green-500', link: '/leads/running' },
  { id: 'cancelled', title: 'Cancelled', icon: 'i-lucide-ban', color: 'text-red-500', link: '/leads/cancelled' },
  { id: 're-inspection', title: 'Re-Inspection', icon: 'i-lucide-rotate-ccw', color: 'text-amber-500', link: '/leads/re-inspection' },
  { id: 'inspected', title: 'Inspected', icon: 'i-lucide-check-circle', color: 'text-emerald-500', link: '/leads/inspected' },
  { id: 'under-review', title: 'Under Review', icon: 'i-lucide-eye', color: 'text-orange-500', link: '/leads/under-review' },
  { id: 'quality-approved', title: 'Quality Approved', icon: 'i-lucide-shield-check', color: 'text-teal-500', link: '/leads/quality-approved' },
  { id: 'quality-rejected', title: 'Quality Rejected', icon: 'i-lucide-shield-x', color: 'text-rose-500', link: '/leads/quality-rejected' },
]

const { activeWorkspace } = useWorkspace()

const currentActiveId = computed(() => {
  const path = route.path
  if (path === '/leads' || path === '/leads/')
    return 'leads'
  return path.split('/').pop() || 'leads'
})

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
      link: '/leads/search-results'
    })
  }
  
  return items
})
</script>

<template>
  <div class="-m-4 lg:-m-6 h-[calc(100%+2rem)] lg:h-[calc(100%+3rem)] flex flex-col overflow-hidden bg-background">
    <!-- Tab Navigation Bar -->
    <div class="shrink-0 border-b bg-muted/30">
      <div class="flex items-center gap-0 overflow-x-auto no-scrollbar px-2">
        <NuxtLink
          v-for="item in filteredNavItems"
          :key="item.id"
          :to="item.link"
          class="leads-tab"
          :class="{
            'is-active': currentActiveId === item.id,
            'has-matches': hasSearchMatches(item.id),
          }"
        >
          <Icon :name="item.icon" class="size-3.5 shrink-0" :class="currentActiveId === item.id ? item.color : hasSearchMatches(item.id) ? 'text-amber-500' : ''" />
          <span>{{ item.title }}</span>
          <span
            v-if="getTabCount(item.id)"
            class="leads-tab-count"
            :class="{
              'is-active': currentActiveId === item.id,
              'is-matching': hasSearchMatches(item.id) && currentActiveId !== item.id,
            }"
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

<style scoped>
.leads-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;
  margin-bottom: -1px;
  flex-shrink: 0;
  position: relative;
}

.leads-tab:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--accent) / 0.5);
}

.leads-tab.is-active {
  color: hsl(var(--foreground));
  border-bottom-color: hsl(var(--primary));
}

/* Animated pulsing border for tabs with matching search results */
.leads-tab.has-matches {
  color: hsl(var(--foreground));
  animation: tab-pulse 2s ease-in-out infinite;
}

.leads-tab.has-matches::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, hsl(38 92% 50%), hsl(45 93% 58%), hsl(38 92% 50%));
  background-size: 200% 100%;
  animation: tab-border-shimmer 2s ease-in-out infinite;
  border-radius: 1px;
}

@keyframes tab-pulse {
  0%, 100% {
    background: hsl(38 92% 50% / 0.06);
  }
  50% {
    background: hsl(38 92% 50% / 0.14);
  }
}

@keyframes tab-border-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* Counter badges — always visible, never clipped */
.leads-tab-count {
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 999px;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  min-width: 18px;
  text-align: center;
}

.leads-tab-count.is-active {
  background: hsl(var(--primary) / 0.15);
  color: hsl(var(--primary));
}

.leads-tab-count.is-matching {
  background: hsl(38 92% 50% / 0.2);
  color: hsl(38 92% 50%);
  animation: count-pulse 2s ease-in-out infinite;
}

@keyframes count-pulse {
  0%, 100% {
    background: hsl(38 92% 50% / 0.15);
  }
  50% {
    background: hsl(38 92% 50% / 0.3);
  }
}
</style>
