<script setup lang="ts">
import { auctionColumns, auctionRouteFilters } from '~/constants/auctions'

const route = useRoute()
const router = useRouter()
const { setTab } = useAuctionsApi()

const tabParam = computed(() => String(route.query.tab || ''))

if (!tabParam.value || !auctionRouteFilters[tabParam.value]) {
  const ws = useWorkspace().activeWorkspace.value
  const allowedTabs = ws?.auctionTabs
  let fallback = 'upcoming'

  if (ws?.defaultRoutes?.auctions) {
    fallback = ws.defaultRoutes.auctions.split('=').pop() || 'upcoming'
  }
  else if (allowedTabs && allowedTabs.length > 0 && !allowedTabs.includes(fallback)) {
    fallback = allowedTabs[0] as string
  }

  router.replace({ query: { ...route.query, tab: fallback } })
}

const filter = computed(() => auctionRouteFilters[tabParam.value] || auctionRouteFilters.upcoming)
const isAdminTab = computed(() => tabParam.value === 'admin')

watch(tabParam, (newTab) => {
  if (newTab && auctionRouteFilters[newTab]) {
    setTab(newTab)
  }
}, { immediate: true })
</script>

<template>
  <!-- Admin tab uses the dedicated table view -->
  <AuctionsAdminTablePage v-if="isAdminTab" />

  <!-- All other tabs use the standard card view -->
  <AuctionsTablePage
    v-else-if="filter"
    :title="`Auctions / ${filter.label}`"
    description=""
    :icon="filter.icon"
    :columns="auctionColumns"
  />
</template>
