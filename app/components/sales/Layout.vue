<script setup lang="ts">
const route = useRoute()

const currentActiveId = computed(() => {
  const path = route.path
  return path.split('/').pop() || 'list'
})

const navItems = [
  { id: 'all', title: 'All', icon: 'i-lucide-list', link: '/sales/all' },
  { id: 'live', title: 'Live', icon: 'i-lucide-radio', link: '/sales/live' },
  { id: 'otobuy', title: 'Otobuy', icon: 'i-lucide-tag', link: '/sales/otobuy' },
  { id: 'activity', title: 'Activity', icon: 'i-lucide-activity', link: '/sales/activity' },
  { id: 'ended', title: 'Ended', icon: 'i-lucide-timer-off', link: '/sales/ended' },
  { id: 'sold', title: 'Sold', icon: 'i-lucide-badge-check', link: '/sales/sold' },
  { id: 'removed', title: 'Removed', icon: 'i-lucide-trash-2', link: '/sales/removed' },
]

// ─── Live counts per tab ───
const { allCars, isFetched } = useAuctionsApi()

function getTabCount(filterId: string) {
  if (!isFetched.value) return undefined

  return allCars.value.filter(car => {
    let ok = car.approvalStatus === 'Approved'
    if (filterId === 'all') return ok
    
    if (filterId === 'activity') {
      if (car.auctionStatus !== 'live' && car.auctionStatus !== 'otobuy') {
        ok = false
      }
      return ok
    }
    
    const statusMap: Record<string, string> = {
       live: 'live',
       otobuy: 'otobuy',
       ended: 'liveAuctionEnded',
       sold: 'sold',
       removed: 'removed'
    }
    
    if (statusMap[filterId] && car.auctionStatus !== statusMap[filterId]) {
      ok = false
    }
    return ok
  }).length || undefined
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
    <div class="flex-1 min-h-0 overflow-hidden">
      <slot />
    </div>
  </div>
</template>
