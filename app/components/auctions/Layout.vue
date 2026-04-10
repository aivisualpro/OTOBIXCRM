<script setup lang="ts">
import { auctionRouteFilters } from '~/constants/auctions'

const route = useRoute()

const navItems = Object.entries(auctionRouteFilters).map(([key, filter]) => ({
  id: key,
  title: filter.label,
  icon: filter.icon,
  color: filter.color,
  link: `/auctions/${key}`,
}))

const currentActiveId = computed(() => {
  const path = route.path
  return path.split('/').pop() || 'upcoming'
})

// ─── Live counts per tab ───
const { allCars, isFetched } = useAuctionsApi()

function getTabCount(filterKey: string) {
  if (!isFetched.value)
    return undefined
  const filter = auctionRouteFilters[filterKey]
  if (!filter)
    return 0
  return allCars.value.filter(filter.filterFn).length || undefined
}
</script>

<template>
  <div class="-m-4 lg:-m-6 h-[calc(100%+2rem)] lg:h-[calc(100%+3rem)] flex flex-col overflow-hidden bg-background">
    <!-- Tab Navigation Bar -->
    <div class="shrink-0 border-b bg-muted/30">
      <div class="flex items-center gap-0 overflow-x-auto no-scrollbar px-2">
        <NuxtLink
          v-for="item in navItems"
          :key="item.id"
          :to="item.link"
          class="auctions-tab"
          :class="[
            currentActiveId === item.id ? 'is-active' : ''
          ]"
        >
          <Icon :name="item.icon" class="size-3.5 shrink-0 transition-colors" />
          <span>{{ item.title }}</span>
          <span
            v-if="getTabCount(item.id) !== undefined"
            class="auctions-tab-count"
            :class="{ 'is-active': currentActiveId === item.id }"
          >
            {{ getTabCount(item.id) }}
          </span>
        </NuxtLink>
      </div>
    </div>

    <!-- Full-width content area -->
    <div class="flex-1 min-h-0 overflow-hidden bg-muted/5">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.auctions-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--muted-foreground);
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;
  margin-bottom: -1px;
  flex-shrink: 0;
  position: relative;
}

.auctions-tab:hover {
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 5%, color-mix(in srgb, var(--accent) 50%, transparent));
}

.auctions-tab.is-active {
  color: var(--primary);
  border-bottom-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 8%, transparent);
}

.auctions-tab-count {
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 999px;
  background: var(--muted);
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  min-width: 18px;
  text-align: center;
}

.auctions-tab-count.is-active {
  background: color-mix(in srgb, var(--primary) 15%, transparent);
  color: var(--primary);
}
</style>
