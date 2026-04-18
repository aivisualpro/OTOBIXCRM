<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { activeWorkspace } = useWorkspace()
const { setTab, similarSearchCtx } = useAuctionsApi()

const ALL_RETAIL_TABS = ['all', 'upcoming', 'live', 'otobuy', 'customer-activity', 'dealer-activity', 'ended', 'sold', 'removed', 'followup']

const navItems = computed(() => {
  const allowed = activeWorkspace.value?.retailTabs
  if (allowed && allowed.length > 0) {
    return ALL_RETAIL_TABS.filter(id => allowed.includes(id))
  }
  return ALL_RETAIL_TABS
})

const tabParam = computed(() => String(route.query.tab || ''))

if (!tabParam.value || (!tabParam.value.startsWith('similar-search') && !navItems.value.includes(tabParam.value))) {
  const fallback = navItems.value.length > 0 ? navItems.value[0] : 'all'
  router.replace({ query: { ...route.query, tab: fallback } })
}

watch(tabParam, (newTab) => {
  if (newTab && (newTab.startsWith('similar-search') || navItems.value.includes(newTab))) {
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
  'followup': { title: 'Followup', icon: 'i-lucide-phone-forwarded' },
  'similar-search': { title: 'Similar Search', icon: 'i-lucide-search' },
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
</script>

<template>
  <RetailTablePage
    v-if="currentConfig"
    :title="`Retail / ${currentConfig.title}`"
    description=""
    :icon="currentConfig.icon"
  />
</template>
