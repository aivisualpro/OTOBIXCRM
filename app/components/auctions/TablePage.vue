<script setup lang="ts">
import type { CrudColumn } from '~/composables/useCrud'
import { toast } from 'vue-sonner'
import { useIntersectionObserver } from '@vueuse/core'

const props = defineProps<{
  title: string
  description: string
  icon: string
  columns: CrudColumn[]
  filterFn: (car: any) => boolean
  statusKey?: string
}>()

const isUpcoming = computed(() => props.statusKey === 'upcoming')
const isLive = computed(() => props.statusKey === 'live')
const hasTimer = computed(() => isUpcoming.value || isLive.value)

const router = useRouter()

const { setHeader } = usePageHeader()
setHeader({ title: props.title, description: props.description, icon: props.icon })

// ─── Global cached data ───
const {
  allCars,
  isLoading,
  isFetched,
  fetchError,
  fetchAllCars,
  refreshCars,
} = useAuctionsApi()

// ─── Highlight on return ───
const highlightedId = ref<string | null>(null)

function navigateToInspection(car: any) {
  if (!car.appointmentId)
    return
  sessionStorage.setItem('auction_last_viewed', car.id || car._id)
  router.push(`/inspection/${car.appointmentId}`)
}

const selectedCar = ref<any>(null);
const showPopup = ref(false);

function openPreview(car: any) {
  selectedCar.value = car;
  showPopup.value = true;
}

// ─── Live countdown timer ───
const now = ref(Date.now())
let timerInterval: ReturnType<typeof setInterval> | null = null

function formatCountdown(targetDate: string, expiredLabel = 'Starting soon'): string {
  if (!targetDate)
    return '—'
  const target = new Date(targetDate).getTime()
  const diff = target - now.value
  if (diff <= 0)
    return expiredLabel
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const secs = Math.floor((diff % (1000 * 60)) / 1000)
  if (days > 0)
    return `${days}d ${hours}h ${mins}m`
  if (hours > 0)
    return `${hours}h ${mins}m ${secs}s`
  return `${mins}m ${secs}s`
}

function getCountdownClass(upcomingUntil: string): string {
  if (!upcomingUntil)
    return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
  const diff = new Date(upcomingUntil).getTime() - now.value
  if (diff <= 0)
    return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
  if (diff < 1000 * 60 * 60)
    return 'bg-red-500/10 text-red-600 border-red-500/20' // < 1 hour
  if (diff < 1000 * 60 * 60 * 24)
    return 'bg-amber-500/10 text-amber-600 border-amber-500/20' // < 24 hours
  return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
}

onMounted(async () => {
  if (!isFetched.value) fetchAllCars()

  // Start countdown ticker when on upcoming or live route
  if (hasTimer.value) {
    timerInterval = setInterval(() => {
      now.value = Date.now()
    }, 1000)
  }

  // Check if returning from inspection
  const lastViewed = sessionStorage.getItem('auction_last_viewed')
  if (lastViewed) {
    sessionStorage.removeItem('auction_last_viewed')
    highlightedId.value = lastViewed

    // Wait for data + DOM to render, then scroll into view
    await nextTick()
    setTimeout(() => {
      const el = document.getElementById(`auction-row-${lastViewed}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 300)

    // Clear highlight after 3 seconds
    setTimeout(() => {
      highlightedId.value = null
    }, 3500)
  }

  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  window.removeEventListener('keydown', handleGlobalKeydown)
})

// ─── UI State ───
const search = ref('')

// ─── Base filtered items (before search) ───
const baseFilteredItems = computed(() => allCars.value.filter(props.filterFn))

// ─── Client-side filtering with search ───
const filteredItems = computed(() => {
  let result = baseFilteredItems.value

  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(item =>
      ['make', 'model', 'variant', 'registrationNumber', 'inspectionLocation', 'fuelType', 'appointmentId'].some(key =>
        String(item[key] ?? '').toLowerCase().includes(q),
      ),
    )
  }

  return result
})

// ─── Infinite Scroll ───
const ITEMS_PER_PAGE = 30
const visibleCount = ref(ITEMS_PER_PAGE)

watch(search, () => { visibleCount.value = ITEMS_PER_PAGE })

function focusGlobalSearch() {
  const el = document.getElementById('globalSearchInput') as HTMLInputElement | null
  if (el) {
    el.focus()
    setTimeout(() => {
      if (el.value) {
        const len = el.value.length
        el.setSelectionRange(len, len)
      }
    }, 10)
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    focusGlobalSearch()
  }
}

const totalFiltered = computed(() => filteredItems.value.length)
const paginatedItems = computed(() => filteredItems.value.slice(0, visibleCount.value))
const hasMore = computed(() => paginatedItems.value.length < filteredItems.value.length)

const loadMoreTrigger = ref<HTMLElement | null>(null)
useIntersectionObserver(
  loadMoreTrigger,
  (entries) => {
    if (entries?.[0]?.isIntersecting && hasMore.value) {
      visibleCount.value += ITEMS_PER_PAGE
    }
  },
  { rootMargin: '400px' }
)

// ─── Formatters ───
const statusBadgeClasses: Record<string, string> = {
  live: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  upcoming: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  otobuy: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  liveAuctionEnded: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  sold: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
  removed: 'bg-red-500/10 text-red-600 border-red-500/20',
}

const statusLabels: Record<string, string> = {
  live: 'Live',
  upcoming: 'Upcoming',
  otobuy: 'Otobuy',
  liveAuctionEnded: 'Ended',
  sold: 'Sold',
  removed: 'Removed',
}

function getBadgeClass(value: string): string {
  return statusBadgeClasses[value] || 'bg-gray-500/10 text-gray-600 border-gray-500/20'
}

function getStatusLabel(value: string): string {
  return statusLabels[value] || value || '—'
}

function formatCurrency(value: any): string {
  if (value === null || value === undefined || value === 0)
    return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value))
}

function formatDate(value: string): string {
  if (!value)
    return '—'
  try {
    return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  catch { return value }
}

function formatNumber(value: any): string {
  if (value === null || value === undefined)
    return '—'
  return new Intl.NumberFormat('en-IN').format(Number(value))
}

function getFirstImage(car: any): string | null {
  try {
    if (car.frontMainImages) {
      const parsed = typeof car.frontMainImages === 'string' ? JSON.parse(car.frontMainImages) : car.frontMainImages;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
    }
  } catch (e) {}
  return car.imageUrl || null;
}

async function handleRefresh() {
  await refreshCars()
  toast.success('Auction data refreshed')
}

</script>

<template>
  <!-- Teleport toolbar into the main header -->
  <ClientOnly>
    <HeaderActions>
      <div class="relative">
        <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input id="globalSearchInput" v-model="search" placeholder="Search auctions..." class="pl-8 pr-12 h-8 w-48 text-sm" />
        <div v-if="!search" class="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex text-muted-foreground">
          <span class="text-[9px]">⌘</span>K
        </div>
      </div>
      <p class="text-xs text-muted-foreground tabular-nums hidden sm:block whitespace-nowrap">
        {{ totalFiltered }} car{{ totalFiltered !== 1 ? 's' : '' }}
      </p>
      <Button variant="ghost" size="sm" class="h-8" :disabled="isLoading" @click="handleRefresh">
        <Icon name="i-lucide-refresh-cw" class="mr-1 size-3.5" :class="{ 'animate-spin': isLoading }" />
        Refresh
      </Button>
    </HeaderActions>
  </ClientOnly>

  <div class="w-full flex flex-col h-full overflow-hidden">
    <!-- Error Banner -->
    <div v-if="fetchError" class="shrink-0 m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
      <Icon name="i-lucide-alert-circle" class="size-5 text-destructive shrink-0" />
      <div class="flex-1">
        <p class="text-sm font-medium text-destructive">
          Failed to load auction data
        </p>
        <p class="text-xs text-muted-foreground mt-0.5">
          {{ fetchError }}
        </p>
      </div>
      <Button variant="outline" size="sm" @click="handleRefresh">
        Retry
      </Button>
    </div>

    <!-- Loading State -->
    <div v-if="!isFetched && !fetchError" class="flex-1 min-h-0 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-muted-foreground">
        <Icon name="i-lucide-loader-2" class="size-8 animate-spin" />
        <p class="text-sm">
          Loading auctions...
        </p>
      </div>
    </div>

    <!-- Cards Grid -->
    <div v-else-if="!fetchError" class="flex-1 min-h-0 overflow-auto p-4 lg:p-6 bg-slate-50/50 dark:bg-transparent">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
        <div
          v-for="car in paginatedItems"
          :ref="`auction-row-${car.id}`"
          :key="car.id"
          class="group flex flex-col bg-white dark:bg-card border border-border/80 shadow-sm rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-primary/50 hover:-translate-y-1 relative"
          @click="openPreview(car)"
        >
          <!-- Status Banner for live/upcoming overlay -->
          <div v-if="isUpcoming || isLive" class="absolute top-3 right-3 z-20">
            <Badge variant="secondary" class="bg-white/90 backdrop-blur-md border text-xs shadow-sm shadow-black/5" :class="isUpcoming ? 'text-blue-600' : 'text-rose-600'">
              <Icon :name="isUpcoming ? 'i-lucide-clock' : 'i-lucide-timer'" class="mr-1.5 size-3" />
              {{ formatCountdown(isUpcoming ? car.upcomingUntil : car.auctionEndTime, isUpcoming ? 'Starting soon' : 'Ended') }}
            </Badge>
          </div>

          <!-- Top Meta -->
          <div class="p-4 flex flex-col gap-1 z-10 w-full relative">
            <h3 class="font-bold text-[#1f3b58] dark:text-foreground text-[17px] leading-tight truncate pr-8">
              {{ car.make }} {{ car.model }} <span v-if="car.variant" class="font-normal opacity-80 text-[15px]">({{ car.variant }})</span>
            </h3>
            <p class="text-[14px] text-[#25527a] dark:text-muted-foreground font-medium font-mono uppercase tracking-wide">
              {{ car.registrationNumber || car.appointmentId || '—' }}
            </p>
          </div>

          <!-- Expanding Image -->
          <div class="relative w-full h-52 -mt-4 transition-transform duration-500 group-hover:scale-[1.03]">
            <div class="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white dark:from-card to-transparent z-10" />
            <img 
              v-if="getFirstImage(car)" 
              :src="getFirstImage(car)!" 
              class="absolute inset-0 w-full h-full object-contain p-4 drop-shadow-xl" 
            />
            <div v-else class="absolute inset-0 flex items-center justify-center opacity-10">
               <Icon name="i-lucide-car" class="size-24" />
            </div>
          </div>

          <!-- Bottom Footer -->
          <div class="p-4 pb-4 mt-auto border-t border-border/50 bg-slate-50/50 dark:bg-muted/10 relative z-20 flex items-center justify-between">
            <div class="flex items-center gap-1.5 text-slate-500 dark:text-muted-foreground font-medium text-[15px]">
              <Icon name="i-lucide-user" class="size-4.5 text-[#1f3b58] dark:text-primary stroke-[2.5]" />
              {{ car.biddersCount || 0 }}
            </div>
            
            <div class="flex items-center gap-4">
               <span class="rounded bg-[#1f3b58] text-white dark:bg-primary dark:text-primary-foreground text-xs font-bold px-2 py-0.5" v-if="car.highestBid">
                 {{ formatCurrency(car.highestBid) }}
               </span>
               <div class="flex items-center gap-1.5 text-slate-500 dark:text-muted-foreground font-medium text-[15px]">
                 <Icon name="i-lucide-settings-2" class="size-4.5 text-[#1f3b58] dark:text-primary stroke-[2.5]" />
                 {{ car.transmission || 'Auto' }}
               </div>
            </div>
          </div>
        </div>

        <div v-if="paginatedItems.length === 0 && !isLoading" class="col-span-full h-40 flex flex-col items-center justify-center text-muted-foreground">
          <Icon name="i-lucide-grid-2x2-x" class="size-10 mb-3 opacity-20" />
          <p>No auction listings found.</p>
        </div>
        
        <!-- Infinite Scroll Trigger -->
        <div v-if="hasMore" ref="loadMoreTrigger" class="col-span-full h-24 flex items-center justify-center">
          <Icon name="i-lucide-loader-2" class="size-6 animate-spin text-muted-foreground opacity-50" />
        </div>
      </div>
    </div>

    <!-- Preview Dialog -->
    <Dialog v-model:open="showPopup">
      <DialogContent class="sm:max-w-2xl overflow-hidden p-0 rounded-3xl border shadow-2xl bg-white dark:bg-background">
        <div v-if="selectedCar" class="relative group">
          <!-- Banner header -->
          <div class="h-16 bg-gradient-to-r from-[#1f3b58] to-[#25527a] dark:from-primary/20 dark:to-primary/5 flex items-center px-6">
             <Badge class="bg-white/20 hover:bg-white/30 text-white border-0">{{ getStatusLabel(selectedCar.auctionStatus) }}</Badge>
          </div>
          
          <div class="px-6 pb-6 pt-0 relative -mt-4">
             <div class="w-20 h-20 rounded-full border-4 border-white dark:border-background bg-card shadow-md flex items-center justify-center overflow-hidden z-20 relative">
                 <Icon name="i-lucide-car" class="size-8 text-primary shadow-sm" />
             </div>
             
             <div class="mt-4 flex flex-col gap-1">
                <h2 class="text-2xl font-bold text-[#1f3b58] dark:text-foreground">{{ selectedCar.make }} {{ selectedCar.model }} <span class="font-normal opacity-70">({{ selectedCar.variant }})</span></h2>
                <div class="flex items-center gap-2 text-[#25527a] dark:text-muted-foreground font-mono font-medium">
                  {{ selectedCar.registrationNumber || selectedCar.appointmentId }}
                  <span class="w-1 h-1 rounded-full bg-border" />
                  {{ selectedCar.inspectionLocation || 'N/A' }}
                </div>
             </div>

             <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                <div class="bg-muted/30 rounded-xl p-3 flex flex-col gap-1 border border-border/50">
                   <span class="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Fuel</span>
                   <span class="text-sm font-semibold">{{ selectedCar.fuelType || '—' }}</span>
                </div>
                <div class="bg-muted/30 rounded-xl p-3 flex flex-col gap-1 border border-border/50">
                   <span class="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Odometer</span>
                   <span class="text-sm font-semibold tabular-nums">{{ formatNumber(selectedCar.odometerReadingInKms) }} km</span>
                </div>
                <div class="bg-muted/30 rounded-xl p-3 flex flex-col gap-1 border border-border/50">
                   <span class="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Highest Bid</span>
                   <span class="text-sm font-semibold text-emerald-600 dark:text-emerald-500">{{ formatCurrency(selectedCar.highestBid) }}</span>
                </div>
                <div class="bg-muted/30 rounded-xl p-3 flex flex-col gap-1 border border-border/50">
                   <span class="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Bidders</span>
                   <span class="text-sm font-semibold">{{ selectedCar.biddersCount || 0 }}</span>
                </div>
             </div>
             
             <div class="mt-8 flex gap-3">
               <Button class="w-full h-11" @click="navigateToInspection(selectedCar)">
                  <Icon name="i-lucide-file-search" class="mr-2" />
                  Full Inspection Report
               </Button>
               <Button variant="outline" class="h-11" @click="showPopup = false">
                  Cancel
               </Button>
             </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.auction-row-highlight {
  animation: row-glow 3s ease-out forwards;
  position: relative;
  z-index: 1;
}

.auction-row-highlight td {
  border-top: 1px solid oklch(0.65 0.25 265) !important;
  border-bottom: 1px solid oklch(0.65 0.25 265) !important;
}

.auction-row-highlight td:first-child {
  border-left: 2px solid oklch(0.65 0.25 265) !important;
}

.auction-row-highlight td:last-child {
  border-right: 2px solid oklch(0.65 0.25 265) !important;
}

@keyframes row-glow {
  0% {
    background-color: oklch(0.65 0.25 265 / 15%);
    box-shadow: inset 0 0 20px oklch(0.65 0.25 265 / 8%), 0 0 15px oklch(0.65 0.25 265 / 10%);
  }
  30% {
    background-color: oklch(0.65 0.25 265 / 10%);
    box-shadow: inset 0 0 15px oklch(0.65 0.25 265 / 5%), 0 0 10px oklch(0.65 0.25 265 / 6%);
  }
  70% {
    background-color: oklch(0.65 0.25 265 / 5%);
    box-shadow: inset 0 0 8px oklch(0.65 0.25 265 / 2%), 0 0 5px oklch(0.65 0.25 265 / 3%);
  }
  100% {
    background-color: transparent;
    box-shadow: none;
  }
}

.dark .auction-row-highlight td {
  border-top-color: oklch(0.7 0.2 265) !important;
  border-bottom-color: oklch(0.7 0.2 265) !important;
}

.dark .auction-row-highlight td:first-child {
  border-left-color: oklch(0.7 0.2 265) !important;
}

.dark .auction-row-highlight td:last-child {
  border-right-color: oklch(0.7 0.2 265) !important;
}
</style>
