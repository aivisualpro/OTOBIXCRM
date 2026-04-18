<script setup lang="ts">
import type { CrudColumn } from '~/composables/useCrud'
import { useIntersectionObserver } from '@vueuse/core'
import { toast } from 'vue-sonner'

const props = defineProps<{
  title: string
  description: string
  icon: string
  columns: CrudColumn[]
}>()

const router = useRouter()

const { setHeader } = usePageHeader()
watchEffect(() => {
  setHeader({ title: props.title, description: props.description, icon: props.icon })
})

// ─── Global cached data ───
const {
  allCars,
  isLoading,
  isRefreshing,
  isFetched,
  fetchError,
  fetchCars,
  refreshCars,
} = useAuctionsApi()

// ─── Inline Expansion State ───
const expandedCarId = ref<string | null>(null)
const previewImageIndex = ref(0)
const expandedEl = ref<HTMLElement | null>(null)

function toggleExpand(car: any) {
  const carId = car.id || car._id
  if (expandedCarId.value === carId) {
    expandedCarId.value = null
  }
  else {
    expandedCarId.value = carId
    previewImageIndex.value = 0
    nextTick(() => {
      setTimeout(() => {
        const el = document.getElementById(`expanded-card-${carId}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 50)
    })
  }
}

function navigateToInspection(car: any) {
  if (!car.appointmentId)
    return
  sessionStorage.setItem('auction_last_viewed', car.id || car._id)
  router.push(`/inspection/${car.appointmentId}`)
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

onMounted(async () => {
  fetchCars()

  timerInterval = setInterval(() => {
    now.value = Date.now()
  }, 1000)

  const lastViewed = sessionStorage.getItem('auction_last_viewed')
  if (lastViewed) {
    sessionStorage.removeItem('auction_last_viewed')
    expandedCarId.value = lastViewed

    await nextTick()
    setTimeout(() => {
      const el = document.getElementById(`expanded-card-${lastViewed}`)
      if (el)
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)
  }

  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  if (timerInterval)
    clearInterval(timerInterval)
  window.removeEventListener('keydown', handleGlobalKeydown)
})

// ─── UI State ───
const { globalSearch, searchCars, cancelSearch, hasMore, loadMore, isLoadingMore, totalCount, activeTab } = useAuctionsApi()

const isUpcoming = computed(() => activeTab.value === 'upcoming')
const isLive = computed(() => activeTab.value === 'live')
const hasTimer = computed(() => isUpcoming.value || isLive.value)

let searchDebounce: ReturnType<typeof setTimeout> | null = null
watch(globalSearch, (newVal) => {
  expandedCarId.value = null
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    if (newVal && newVal.trim().length > 0) {
      searchCars(newVal.trim())
    } else {
      cancelSearch()
    }
  }, 400)
})

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
  // Remove escape since we are inline
  if (e.key === 'Escape' && expandedCarId.value) {
    expandedCarId.value = null
  }
}

const loadMoreTrigger = ref<HTMLElement | null>(null)
useIntersectionObserver(
  loadMoreTrigger,
  (entries) => {
    if (entries?.[0]?.isIntersecting && hasMore.value && !isLoadingMore.value) {
      loadMore()
    }
  },
  { rootMargin: '400px' },
)

// ─── Formatters ───
function formatCurrency(value: any): string {
  if (value === null || value === undefined || value === 0)
    return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value))
}

function formatNumber(value: any): string {
  if (value === null || value === undefined)
    return '—'
  return new Intl.NumberFormat('en-IN').format(Number(value))
}

function getAllImages(car: any): string[] {
  // frontMainImages can be a native array OR a JSON string
  let images: any[] = []
  try {
    if (Array.isArray(car.frontMainImages)) {
      images = car.frontMainImages
    }
    else if (typeof car.frontMainImages === 'string' && car.frontMainImages !== '[]' && car.frontMainImages !== 'null' && car.frontMainImages !== '') {
      const parsed = JSON.parse(car.frontMainImages)
      if (Array.isArray(parsed))
        images = parsed
    }
  }
  catch (e) {}

  // Normalize: each item may be a string URL or an object with a .url property
  const validImages = images
    .map((item: any) => {
      if (typeof item === 'string')
        return item.trim()
      if (item && typeof item === 'object' && typeof item.url === 'string')
        return item.url.trim()
      return null
    })
    .filter((url): url is string => !!url && url.length > 5 && url !== 'null' && url !== 'undefined')

  if (validImages.length === 0) {
    // frontMain can also be an array or a string
    const fb = car.frontMain
    if (Array.isArray(fb)) {
      const first = fb.find((x: any) => typeof x === 'string' && x.trim().length > 5 && x !== 'null')
      if (first)
        validImages.push(first.trim())
    }
    else if (fb && typeof fb === 'string' && fb.trim().length > 5 && fb !== 'null' && fb !== '[]') {
      validImages.push(fb.trim())
    }
  }

  if (validImages.length === 0 && car.imageUrl && typeof car.imageUrl === 'string' && car.imageUrl.trim().length > 5) {
    validImages.push(car.imageUrl.trim())
  }

  return validImages
}

function getFirstImage(car: any): string | null {
  const images = getAllImages(car)
  return images.length > 0 ? (images[0] ?? null) : null
}

const statusLabels: Record<string, string> = {
  live: 'Live',
  upcoming: 'Upcoming',
  otobuy: 'Otobuy',
  liveAuctionEnded: 'Ended',
  sold: 'Sold',
  removed: 'Removed',
}

function getStatusLabel(value?: string | null): string {
  if (!value)
    return '—'
  return statusLabels[value] || value || '—'
}

async function handleRefresh() {
  await refreshCars()
  toast.success('Auction data refreshed')
}

// ─── Act. CEP Edit Workflow ───
const OTOBIX_API_BASE = 'https://ob-dealerapp-kong.onrender.com/api'
const cepEditing = ref<Record<string, boolean>>({})
const cepValue = ref<Record<string, string>>({})
const cepSaving = ref<Record<string, boolean>>({})

function openCep(car: any) {
  const key = car._id || car.id
  cepValue.value[key] = String(Number(car.customerExpectedPrice || 0))
  cepEditing.value[key] = true
}

function closeCep(car: any) {
  const key = car._id || car.id
  cepEditing.value[key] = false
  cepValue.value[key] = ''
}

async function confirmCep(car: any) {
  const key = car._id || car.id
  const newCep = Number(cepValue.value[key])
  const rawId = car._id?.$oid || car._id || car.id

  if (isNaN(newCep) || newCep <= 0) {
    toast.error('Invalid price')
    return
  }

  const currentCep = Number(car.customerExpectedPrice) || 0
  const pd = Number(car.priceDiscovery) || 0

  if (!currentCep) {
    if (pd > 0 && newCep > pd * 1.5) {
      toast.error(`Act. CEP cannot exceed 150% of PD (${formatCurrency(pd * 1.5)})`)
      return
    }
  }
  else {
    if (newCep >= currentCep) {
      toast.error(`Act. CEP must be less than the current value (${formatCurrency(currentCep)})`)
      return
    }
  }

  cepSaving.value[key] = true
  try {
    await $fetch(`${OTOBIX_API_BASE}/otobix/set-customer-expected-price`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer QmFwR0RjLjJmMzkyMjJw98UNpMGFqpgGJV6BXgQ1ye12d100f5c`,
      },
      body: {
        carId: rawId,
        customerExpectedPrice: newCep,
      },
    })
    car.customerExpectedPrice = newCep
    toast.success(`Act. CEP updated to ${formatCurrency(newCep)}`)
    closeCep(car)
  }
  catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Failed to update Act. CEP')
  }
  finally {
    cepSaving.value[key] = false
  }
}
</script>

<template>
  <ClientOnly>
    <HeaderActions>
      <div class="relative">
        <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input id="globalSearchInput" v-model="globalSearch" placeholder="Search across auctions..." class="pl-8 h-8 w-48 text-sm bg-muted/20" />
        <div v-if="!globalSearch" class="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex text-muted-foreground">
          <span class="text-[9px]">⌘</span>K
        </div>
      </div>
      <p class="text-xs text-muted-foreground tabular-nums hidden sm:block whitespace-nowrap">
        {{ totalCount }} car{{ totalCount !== 1 ? 's' : '' }}
      </p>
      <Button variant="ghost" size="sm" class="h-8" :disabled="isLoading" @click="handleRefresh">
        <Icon name="i-lucide-refresh-cw" class="mr-1 size-3.5" :class="{ 'animate-spin': isLoading }" />
        Refresh
      </Button>
    </HeaderActions>
  </ClientOnly>

  <div class="w-full flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-background">
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

    <!-- Main Content -->
    <div v-else-if="!fetchError" class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 lg:p-6 pb-24 relative">
      <!-- Minimalist loading bar -->
      <div v-if="isRefreshing || isLoadingMore" class="absolute top-0 left-0 right-0 h-1 bg-primary/20 overflow-hidden z-20">
        <div class="h-full bg-primary origin-left animate-in fade-in duration-500 rounded-full" style="width: 30%; animation: indeterminate 1.5s infinite linear;" />
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 items-start transition-all duration-500 ease-in-out relative">
        <template v-for="car in allCars" :key="car.id || car._id">
          <!-- Normal Card -->
          <div
            v-if="expandedCarId !== (car.id || car._id)"
            class="auction-card group cursor-pointer bg-card rounded-2xl border shadow-sm outline-[2px] outline-transparent hover:outline-primary/20 outline focus-within:outline-primary/20 transition-all duration-300 hover:shadow-lg overflow-hidden flex flex-col h-full"
            @click="toggleExpand(car)"
          >
            <!-- Hero Image -->
            <div class="relative h-[210px] w-full bg-muted/20 overflow-hidden shrink-0">
              <img v-if="getFirstImage(car)" :src="getFirstImage(car)!" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" @error="(e: any) => e.target.style.display = 'none'">
              <div v-else class="absolute inset-0 flex items-center justify-center -z-10">
                <Icon name="i-lucide-car" class="size-16 text-muted-foreground/20" />
              </div>

              <div class="absolute top-2.5 right-2.5">
                <Badge v-if="isUpcoming || isLive" class="backdrop-blur-md text-white font-semibold tabular-nums border-0" :class="isLive ? 'bg-emerald-800/90' : 'bg-black/60'">
                  <span v-if="isLive" class="size-1.5 rounded-full bg-rose-500 animate-pulse mr-1.5 inline-block" />
                  <Icon v-else name="i-lucide-clock" class="size-3 mr-1" />
                  {{ formatCountdown(isUpcoming ? car.upcomingUntil : car.auctionEndTime) }}
                </Badge>
                <Badge v-else class="backdrop-blur-md bg-black/60 text-white font-semibold border-0 opacity-80">
                  {{ getStatusLabel(car.auctionStatus || activeTab) }}
                </Badge>
              </div>
            </div>

            <!-- Details Block -->
            <div class="p-4 flex flex-col flex-1">
              <h3 class="text-[15px] font-extrabold text-foreground leading-tight truncate group-hover:text-primary transition-colors">
                <template v-if="car.make || car.model">
                  {{ car.make }} {{ car.model }}
                </template>
                <template v-else>
                  <span class="italic text-muted-foreground font-normal">Pending Details</span>
                </template>
              </h3>
              <p class="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1.5">
                <span v-if="car.variant" class="font-medium text-foreground/80">{{ car.variant }}</span>
                <span v-if="car.variant" class="size-0.5 rounded-full bg-border" />
                <span class="font-mono uppercase">{{ [car.registrationNumber, car.appointmentId].filter(Boolean).join(' • ') }}</span>
              </p>

              <div class="mt-auto pt-4 flex items-center justify-between">
                <div class="flex items-center gap-1">
                  <div class="flex items-center gap-1.5 bg-muted/40 rounded-full px-2 py-0.5 text-xs font-semibold text-muted-foreground shrink-0 border">
                    <Icon name="i-lucide-users" class="size-3" />
                    {{ car.biddersCount || 0 }}
                  </div>
                </div>
                <div v-if="car.highestBid" class="flex items-end flex-col gap-0.5">
                  <span class="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Highest Bid</span>
                  <span class="text-sm font-black text-emerald-600 dark:text-emerald-500 tabular-nums leading-none">{{ formatCurrency(car.highestBid) }}</span>
                </div>
                <div v-else class="text-xs text-muted-foreground font-medium">
                  No bids yet
                </div>
              </div>
            </div>
          </div>

          <!-- Expanded Inline View -->
          <div
            v-if="expandedCarId === (car.id || car._id)"
            :id="`expanded-card-${car.id || car._id}`"
            class="transition-all duration-500 ease-in-out col-span-full border rounded-[1.5rem] bg-card shadow-2xl relative z-10 my-2 overflow-hidden flex flex-col md:flex-row overflow-y-auto"
          >
            <!-- Dismiss Button -->
            <button class="absolute top-4 right-5 z-50 bg-background/80 hover:bg-background border shadow-sm backdrop-blur-md rounded-full size-8 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground" @click.stop="expandedCarId = null">
              <Icon name="i-lucide-x" class="size-4" />
            </button>

            <!-- Left: Image Gallery (Mimicking 2nd layout) -->
            <div class="md:w-[55%] xl:w-[60%] flex flex-col bg-muted/10 shrink-0 border-r border-border/50">
              <div class="w-full relative bg-muted/20 aspect-[16/10] md:h-full md:max-h-[500px]">
                <img
                  v-if="getAllImages(car).length > 0"
                  :src="getAllImages(car)[previewImageIndex]!"
                  class="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                >
                <div v-else class="absolute inset-0 flex items-center justify-center">
                  <Icon name="i-lucide-car" class="size-20 text-muted-foreground/20" />
                </div>
              </div>

              <!-- Thumbnails Row -->
              <div v-if="getAllImages(car).length > 1" class="p-3 bg-card border-t border-border/50 flex gap-2 overflow-x-auto scroller-none snap-x">
                <button
                  v-for="(img, idx) in getAllImages(car)" :key="idx"
                  class="relative shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer snap-center"
                  :class="previewImageIndex === idx ? 'border-primary shadow-sm' : 'border-transparent hover:border-muted-foreground/30 opacity-70 hover:opacity-100'"
                  @click.stop="previewImageIndex = idx"
                >
                  <img :src="img" class="w-full h-full object-cover">
                </button>
              </div>
            </div>

            <!-- Right: Data Block -->
            <div class="flex-1 p-6 md:p-8 flex flex-col overflow-y-auto">
              <div class="flex flex-col gap-1.5 pr-8">
                <h2 class="text-2xl lg:text-3xl font-black text-foreground tracking-tight leading-none">
                  <template v-if="car.make || car.model">
                    {{ car.make }} {{ car.model }}
                  </template>
                  <template v-else>
                    <span class="italic text-muted-foreground">Pending Details</span>
                  </template>
                </h2>
                <p v-if="car.variant" class="text-lg text-muted-foreground font-medium">
                  {{ car.variant }}
                </p>
              </div>

              <div class="flex items-center justify-between mt-6 bg-muted/30 rounded-2xl p-5 border border-border/60">
                <div class="flex items-center gap-8 md:gap-12 pl-2">
                  <div class="flex flex-col gap-1">
                    <p class="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      Highest Bid
                    </p>
                    <p class="text-3xl font-black text-emerald-600 dark:text-emerald-500 tabular-nums leading-none mt-1">
                      {{ car.highestBid ? formatCurrency(car.highestBid) : 'Awaiting Bids' }}
                    </p>
                  </div>

                  <div class="border-l border-border/60 pl-8 md:pl-12 flex flex-col gap-1">
                    <p class="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      Act. CEP
                    </p>
                    <!-- CEP Editor -->
                    <div class="flex flex-col items-start justify-center group rounded relative cursor-pointer" @click="!cepEditing[car._id || car.id] && openCep(car)">
                      <template v-if="!cepEditing[car._id || car.id]">
                        <div class="flex items-center gap-3 font-black text-2xl text-foreground tabular-nums leading-none transition-colors group-hover:text-amber-600 mt-1" title="Actual Customer Expected Price">
                          <span>{{ car.customerExpectedPrice ? formatCurrency(car.customerExpectedPrice) : '—' }}</span>
                          <Icon name="i-lucide-pencil" class="size-4 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </template>
                      <template v-else>
                        <div class="flex items-center gap-2 mt-0.5" @click.stop>
                          <div class="relative bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-lg flex items-center px-3 py-1 shadow-sm transition-all">
                            <span class="text-teal-600 dark:text-teal-400 font-bold text-lg mr-1">₹</span>
                            <input
                              v-model="cepValue[car._id || car.id]"
                              type="number"
                              class="w-28 bg-transparent text-teal-700 dark:text-teal-300 font-black tabular-nums text-xl border-none outline-none focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder-teal-600/30"
                              placeholder="Price"
                              @keydown.enter="confirmCep(car)"
                            >
                          </div>
                          <div class="flex items-center gap-1.5 ml-1">
                            <button class="size-8 flex items-center justify-center rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors shadow-sm border border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800" @click.stop="confirmCep(car)">
                              <Icon v-if="cepSaving[car._id || car.id]" name="i-lucide-loader-2" class="size-4 animate-spin" />
                              <Icon v-else name="i-lucide-check" class="size-4" />
                            </button>
                            <button class="size-8 flex items-center justify-center rounded-full bg-background hover:bg-muted text-muted-foreground transition-colors shadow-sm border border-border" @click.stop="closeCep(car)">
                              <Icon name="i-lucide-x" class="size-4" />
                            </button>
                          </div>
                        </div>
                      </template>
                    </div>
                  </div>
                </div>

                <Badge class="font-semibold text-sm px-3 py-1 border-0" :class="isLive ? 'bg-emerald-800/90 text-white' : (isUpcoming ? 'bg-blue-500/10 text-blue-600' : 'bg-muted text-muted-foreground opacity-80')">
                  <span v-if="isLive" class="size-1.5 rounded-full bg-rose-500 animate-pulse mr-2 inline-block" />
                  {{ isUpcoming || isLive ? formatCountdown(isUpcoming ? car.upcomingUntil : car.auctionEndTime) : getStatusLabel(car.auctionStatus || activeTab) }}
                </Badge>
              </div>

              <!-- Inspection & Specs Data (List View like VIN report) -->
              <div class="mt-8">
                <h4 class="text-[13px] font-black uppercase tracking-widest text-foreground mb-4">
                  Vehicle Characteristics
                </h4>
                <div class="grid grid-cols-2 gap-y-5 gap-x-4">
                  <div class="flex flex-col gap-0.5">
                    <span class="text-xs text-muted-foreground font-medium flex items-center gap-1.5"><Icon name="i-lucide-fuel" class="size-3.5" /> Fuel Type</span>
                    <span class="text-sm font-semibold text-foreground pl-5">{{ car.fuelType || '—' }}</span>
                  </div>
                  <div class="flex flex-col gap-0.5">
                    <span class="text-xs text-muted-foreground font-medium flex items-center gap-1.5"><Icon name="i-lucide-gauge" class="size-3.5" /> Odometer</span>
                    <span class="text-sm font-semibold text-foreground tabular-nums pl-5">{{ formatNumber(car.odometerReadingInKms) }} km</span>
                  </div>
                  <div class="flex flex-col gap-0.5">
                    <span class="text-xs text-muted-foreground font-medium flex items-center gap-1.5"><Icon name="i-lucide-settings-2" class="size-3.5" /> Transmission</span>
                    <span class="text-sm font-semibold text-foreground pl-5">{{ car.transmission || 'Auto' }}</span>
                  </div>
                  <div class="flex flex-col gap-0.5">
                    <span class="text-xs text-muted-foreground font-medium flex items-center gap-1.5"><Icon name="i-lucide-hash" class="size-3.5" /> App ID / Reg</span>
                    <span class="text-sm font-mono font-bold text-foreground pl-5">{{ [car.registrationNumber, car.appointmentId].filter(Boolean).join(' • ') }}</span>
                  </div>
                  <div class="flex flex-col gap-0.5 col-span-2 mt-2 pt-4 border-t border-border/50">
                    <span class="text-xs text-muted-foreground font-medium flex items-center gap-1.5"><Icon name="i-lucide-map-pin" class="size-3.5" /> Location</span>
                    <span class="text-sm font-semibold text-foreground pl-5">{{ car.city || 'Location Unavailable' }}</span>
                  </div>
                </div>
              </div>

              <div class="mt-10 pt-6 border-t border-border/50">
                <Button class="w-full h-12 rounded-xl text-[15px] font-bold shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30" @click="navigateToInspection(car)">
                  <Icon name="i-lucide-file-text" class="mr-2" />
                  Get Full Inspection Report
                </Button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div v-if="allCars.length === 0 && !isLoading" class="col-span-full h-40 flex flex-col items-center justify-center text-muted-foreground">
        <Icon name="i-lucide-grid-2x2-x" class="size-10 mb-3 opacity-20" />
        <p>No auction listings found.</p>
      </div>

      <div v-if="hasMore" ref="loadMoreTrigger" class="h-24 flex items-center justify-center mt-6">
        <Icon name="i-lucide-loader-2" class="size-6 animate-spin text-muted-foreground opacity-50" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.scroller-none::-webkit-scrollbar {
  display: none;
}
.scroller-none {
  scrollbar-width: none;
}
@keyframes indeterminate {
  0% { transform: translateX(-100%) scaleX(0.2); }
  50% { transform: translateX(0%) scaleX(0.5); }
  100% { transform: translateX(200%) scaleX(0.2); }
}
</style>
