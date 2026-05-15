<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { activeWorkspace } = useWorkspace()
const { setTab, similarSearchCtx } = useAuctionsApi()

const ALL_SALES_TABS = ['all', 'upcoming', 'live', 'otobuy', 'customer-activity', 'dealer-activity', 'ended', 'sold', 'removed', 'dealers']

const navItems = computed(() => {
  const allowed = activeWorkspace.value?.salesTabs
  if (allowed && allowed.length > 0) {
    return ALL_SALES_TABS.filter(id => allowed.includes(id))
  }
  return ALL_SALES_TABS
})

const tabParam = computed(() => String(route.query.tab || ''))

if (!tabParam.value || (!tabParam.value.startsWith('similar-search') && !navItems.value.includes(tabParam.value))) {
  let fallback = 'all'
  const ws = activeWorkspace.value

  if (ws?.defaultRoutes?.sales) {
    fallback = ws.defaultRoutes.sales.split('=').pop() || 'all'
  }
  else {
    fallback = navItems.value[0] || 'all'
  }
  router.replace({ query: { ...route.query, tab: fallback } })
}

watch(tabParam, (newTab) => {
  if (newTab && newTab !== 'dealers' && (newTab.startsWith('similar-search') || navItems.value.includes(newTab))) {
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
  'similar-search': { title: 'Similar Search', icon: 'i-lucide-search' },
  'dealers': { title: 'Dealers', icon: 'i-lucide-store' },
}

const currentConfig = computed(() => {
  if (tabParam.value.startsWith('similar-search')) {
    let titleStr = 'Similar Search'
    if (similarSearchCtx.value) {
      let yearDisplay = similarSearchCtx.value.year
      const yInt = parseInt(String(yearDisplay))
      if (!isNaN(yInt)) {
        yearDisplay = `${yInt - 1}, ${yInt}, ${yInt + 1}`
      }
      titleStr += ` - ${similarSearchCtx.value.make} - ${similarSearchCtx.value.model} - ${yearDisplay}`
    }
    return { title: titleStr, icon: 'i-lucide-search' }
  }
  return routeMap[tabParam.value] || routeMap.all
})

const isDealersTab = computed(() => tabParam.value === 'dealers')
</script>

<template>
  <SalesTablePage
    v-if="currentConfig && !isDealersTab"
    :title="`Sales / ${currentConfig.title}`"
    description=""
    :icon="currentConfig.icon"
  />
  <SalesDealersPage
    v-else-if="isDealersTab"
  />
</template>
