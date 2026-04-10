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
    <div class="shrink-0 border-b bg-background/80 backdrop-blur-sm z-10">
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
    <div class="flex-1 min-h-0 overflow-hidden bg-muted/5">
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* No extra styles needed now, handled by utility classes */
</style>
