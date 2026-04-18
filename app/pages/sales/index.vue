<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { activeWorkspace } = useWorkspace()
const { setTab } = useAuctionsApi()

const ALL_SALES_TABS = ['all', 'upcoming', 'live', 'otobuy', 'customer-activity', 'dealer-activity', 'ended', 'sold', 'removed']

const navItems = computed(() => {
  const allowed = activeWorkspace.value?.salesTabs
  if (allowed && allowed.length > 0) {
    return ALL_SALES_TABS.filter(id => allowed.includes(id))
  }
  return ALL_SALES_TABS
})

const tabParam = computed(() => String(route.query.tab || ''))

if (!tabParam.value || !navItems.value.includes(tabParam.value)) {
  const fallback = navItems.value.length > 0 ? navItems.value[0] : 'all'
  router.replace({ query: { ...route.query, tab: fallback } })
}

watch(tabParam, (newTab) => {
  if (newTab && navItems.value.includes(newTab)) {
    setTab(newTab)
  }
}, { immediate: true })

const routeMap: Record<string, { title: string, icon: string }> = {
  'all': { title: 'All', icon: 'i-lucide-list' },
  'upcoming': { title: 'Upcoming', icon: 'i-lucide-calendar-clock' },
  'live': { title: 'Live', icon: 'i-lucide-radio' },
  'otobuy': { title: 'Otobuy', icon: 'i-lucide-tag' },
  'customer-activity': { title: 'Customer Activity', icon: 'i-lucide-activity' },
  'dealer-activity': { title: 'Dealer Activity', icon: 'i-lucide-users' },
  'ended': { title: 'Ended', icon: 'i-lucide-timer-off' },
  'sold': { title: 'Sold', icon: 'i-lucide-badge-check' },
  'removed': { title: 'Removed', icon: 'i-lucide-trash-2' },
}

const currentConfig = computed(() => routeMap[tabParam.value] || routeMap.all)
</script>

<template>
  <SalesTablePage
    v-if="currentConfig"
    :title="`Sales / ${currentConfig.title}`"
    description=""
    :icon="currentConfig.icon"
  />
</template>
