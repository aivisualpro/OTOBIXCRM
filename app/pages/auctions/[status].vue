<script setup lang="ts">
import { auctionColumns, auctionRouteFilters } from '~/constants/auctions'

const route = useRoute()
const statusKey = computed(() => route.params.status as string)
const filter = computed(() => auctionRouteFilters[statusKey.value])
</script>

<template>
  <AuctionsTablePage
    v-if="filter"
    :title="filter.label"
    :description="`${filter.label} auctions`"
    :icon="filter.icon"
    :columns="auctionColumns"
    :filter-fn="filter.filterFn"
    :status-key="statusKey"
  />
  <div v-else class="flex items-center justify-center h-64 text-muted-foreground">
    <p>Unknown status: {{ statusKey }}</p>
  </div>
</template>
