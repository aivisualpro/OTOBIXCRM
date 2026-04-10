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
    if (car.frontMainImages && typeof car.frontMainImages === 'string' && car.frontMainImages !== '[]' && car.frontMainImages !== 'null') {
      const parsed = JSON.parse(car.frontMainImages);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string' && parsed[0].startsWith('http')) return parsed[0];
    } else if (Array.isArray(car.frontMainImages) && car.frontMainImages.length > 0 && typeof car.frontMainImages[0] === 'string' && car.frontMainImages[0].startsWith('http')) {
      return car.frontMainImages[0];
    }
  } catch (e) {}

  const fallback = car.frontMain || car.imageUrl;
  if (!fallback || fallback === 'null' || fallback === 'undefined' || fallback === '[]' || (typeof fallback === 'string' && !fallback.startsWith('http'))) {
    return null;
  }
  return fallback;
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
        <p class="text-sm font-medium text-destructive">Failed to load auction data</p>
        <p class="text-xs text-muted-foreground mt-0.5">{{ fetchError }}</p>
      </div>
      <Button variant="outline" size="sm" @click="handleRefresh">Retry</Button>
    </div>

    <!-- Loading State -->
    <div v-if="!isFetched && !fetchError" class="flex-1 min-h-0 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-muted-foreground">
        <Icon name="i-lucide-loader-2" class="size-8 animate-spin" />
        <p class="text-sm">Loading auctions...</p>
      </div>
    </div>

    <!-- Cards Grid -->
    <div v-else-if="!fetchError" class="flex-1 min-h-0 overflow-auto p-4 lg:p-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
        <div
          v-for="car in paginatedItems"
          :ref="`auction-row-${car.id}`"
          :key="car.id"
          class="auction-card group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 hover:shadow-2xl hover:-translate-y-1"
          @click="openPreview(car)"
        >
          <!-- Hero Image Section -->
          <div class="relative h-52 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 overflow-hidden">
            <img 
              v-if="getFirstImage(car)" 
              :src="getFirstImage(car)!" 
              class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
              @error="(e: any) => e.target.style.display = 'none'"
            />
            <div v-if="!getFirstImage(car)" class="absolute inset-0 flex items-center justify-center">
               <Icon name="i-lucide-car" class="size-20 text-slate-300 dark:text-slate-700" />
            </div>

            <!-- Dark gradient overlay from bottom -->
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            <!-- Timer Badge -->
            <div v-if="isUpcoming || isLive" class="absolute top-3 right-3 z-20">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide backdrop-blur-lg border" :class="isLive ? 'bg-rose-500/20 text-rose-100 border-rose-400/30' : 'bg-white/15 text-white border-white/20'">
                <span v-if="isLive" class="size-1.5 rounded-full bg-rose-400 animate-pulse" />
                <Icon v-else name="i-lucide-clock" class="size-3" />
                {{ formatCountdown(isUpcoming ? car.upcomingUntil : car.auctionEndTime, isUpcoming ? 'Starting soon' : 'Ended') }}
              </span>
            </div>

            <!-- Title over image -->
            <div class="absolute bottom-0 left-0 right-0 p-4 z-10">
              <h3 class="text-white font-bold text-[15px] leading-tight truncate drop-shadow-lg">
                <template v-if="car.make || car.model">
                  {{ car.make }} {{ car.model }}
                </template>
                <template v-else>
                  <span class="opacity-60 italic">Pending Details</span>
                </template>
              </h3>
              <p class="text-white/70 text-xs font-mono mt-0.5 truncate">
                <span v-if="car.variant" class="mr-1.5">{{ car.variant }}</span>
                <span>{{ car.registrationNumber || car.appointmentId || '—' }}</span>
              </p>
            </div>
          </div>

          <!-- Specs Section -->
          <div class="bg-white dark:bg-card border border-t-0 border-border/60 rounded-b-2xl">
            <div class="grid grid-cols-3 divide-x divide-border/50">
              <div class="p-3 flex flex-col items-center gap-1">
                <Icon name="i-lucide-users" class="size-4 text-muted-foreground/60" />
                <span class="text-[11px] font-bold text-foreground tabular-nums">{{ car.biddersCount || 0 }}</span>
                <span class="text-[9px] text-muted-foreground uppercase tracking-widest font-medium">Bidders</span>
              </div>
              <div class="p-3 flex flex-col items-center gap-1">
                <Icon name="i-lucide-indian-rupee" class="size-4 text-emerald-500" />
                <span class="text-[11px] font-bold text-foreground tabular-nums">{{ car.highestBid ? formatCurrency(car.highestBid) : '—' }}</span>
                <span class="text-[9px] text-muted-foreground uppercase tracking-widest font-medium">Top Bid</span>
              </div>
              <div class="p-3 flex flex-col items-center gap-1">
                <Icon name="i-lucide-gauge" class="size-4 text-muted-foreground/60" />
                <span class="text-[11px] font-bold text-foreground tabular-nums">{{ car.transmission || 'Auto' }}</span>
                <span class="text-[9px] text-muted-foreground uppercase tracking-widest font-medium">Trans.</span>
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
      <DialogContent class="sm:max-w-3xl overflow-hidden p-0 rounded-3xl border-0 shadow-2xl bg-white dark:bg-background">
        <div v-if="selectedCar" class="relative">
          <!-- Hero Image in Dialog -->
          <div class="relative h-72 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 overflow-hidden">
            <img 
              v-if="getFirstImage(selectedCar)" 
              :src="getFirstImage(selectedCar)!" 
              class="absolute inset-0 w-full h-full object-cover" 
              @error="(e: any) => e.target.style.display = 'none'"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
            
            <!-- Status pill over image -->
            <div class="absolute top-5 left-5 z-10">
              <Badge class="text-white border-0 backdrop-blur-lg text-xs font-bold px-3 py-1" :class="getBadgeClass(selectedCar.auctionStatus)">
                {{ getStatusLabel(selectedCar.auctionStatus) }}
              </Badge>
            </div>

            <!-- Title overlay at bottom of image -->
            <div class="absolute bottom-0 left-0 right-0 p-6 z-10">
              <h2 class="text-3xl font-extrabold text-white drop-shadow-xl">
                {{ selectedCar.make }} {{ selectedCar.model }}
                <span class="font-normal text-white/60 text-xl" v-if="selectedCar.variant">({{ selectedCar.variant }})</span>
              </h2>
              <div class="flex items-center gap-3 mt-2 text-white/80 text-sm font-mono">
                <span>{{ selectedCar.registrationNumber || selectedCar.appointmentId }}</span>
                <span class="size-1 rounded-full bg-white/40" />
                <span>{{ selectedCar.inspectionLocation || 'N/A' }}</span>
              </div>
            </div>
          </div>
          
          <!-- Specification Grid -->
          <div class="px-6 pt-6 pb-2">
            <h4 class="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Specification</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div class="spec-card rounded-xl p-3.5 flex flex-col gap-1.5 bg-muted/40 dark:bg-muted/20 border border-border/50">
                <Icon name="i-lucide-fuel" class="size-5 text-amber-500" />
                <span class="text-sm font-bold text-foreground">{{ selectedCar.fuelType || '—' }}</span>
                <span class="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Fuel Type</span>
              </div>
              <div class="spec-card rounded-xl p-3.5 flex flex-col gap-1.5 bg-muted/40 dark:bg-muted/20 border border-border/50">
                <Icon name="i-lucide-gauge" class="size-5 text-blue-500" />
                <span class="text-sm font-bold text-foreground tabular-nums">{{ formatNumber(selectedCar.odometerReadingInKms) }} km</span>
                <span class="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Odometer</span>
              </div>
              <div class="spec-card rounded-xl p-3.5 flex flex-col gap-1.5 bg-muted/40 dark:bg-muted/20 border border-border/50">
                <Icon name="i-lucide-trending-up" class="size-5 text-emerald-500" />
                <span class="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{{ formatCurrency(selectedCar.highestBid) }}</span>
                <span class="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Highest Bid</span>
              </div>
              <div class="spec-card rounded-xl p-3.5 flex flex-col gap-1.5 bg-muted/40 dark:bg-muted/20 border border-border/50">
                <Icon name="i-lucide-users" class="size-5 text-violet-500" />
                <span class="text-sm font-bold text-foreground tabular-nums">{{ selectedCar.biddersCount || 0 }}</span>
                <span class="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Bidders</span>
              </div>
            </div>
          </div>
             
          <div class="px-6 pb-6 pt-4 flex gap-3">
            <Button class="w-full h-11 rounded-xl font-semibold" @click="navigateToInspection(selectedCar)">
               <Icon name="i-lucide-file-search" class="mr-2 size-4" />
               Full Inspection Report
            </Button>
            <Button variant="outline" class="h-11 rounded-xl px-6" @click="showPopup = false">
               Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.auction-card {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
}
.auction-card:hover {
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(0, 0, 0, 0.08);
}
.dark .auction-card {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);
}
.dark .auction-card:hover {
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 8px 16px rgba(0, 0, 0, 0.3);
}

.spec-card {
  transition: all 0.2s ease;
}
.spec-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}
</style>

