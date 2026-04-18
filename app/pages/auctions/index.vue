<script setup lang="ts">
import { auctionColumns, auctionRouteFilters } from '~/constants/auctions'

const route = useRoute()
const router = useRouter()
const { setTab } = useAuctionsApi()

const tabParam = computed(() => String(route.query.tab || ''))

if (!tabParam.value || !auctionRouteFilters[tabParam.value]) {
  const allowedTabs = useWorkspace().activeWorkspace.value?.auctionTabs
  let fallback = 'upcoming'
  if (allowedTabs && allowedTabs.length > 0 && !allowedTabs.includes(fallback)) {
    fallback = allowedTabs[0] as string
  }
  router.replace({ query: { ...route.query, tab: fallback } })
}

const filter = computed(() => auctionRouteFilters[tabParam.value] || auctionRouteFilters.upcoming)

watch(tabParam, (newTab) => {
  if (newTab && auctionRouteFilters[newTab]) {
    setTab(newTab)
  }
}, { immediate: true })
</script>

<template>
  <AuctionsTablePage
    v-if="filter"
    :title="`Auctions / ${filter.label}`"
    description=""
    :icon="filter.icon"
    :columns="auctionColumns"
  />
</template>
