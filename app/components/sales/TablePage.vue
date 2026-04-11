<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { toast } from 'vue-sonner'

const props = defineProps<{
  title: string
  description: string
  icon: string
  filterStatus?: string
}>()

const { setHeader } = usePageHeader()
setHeader({ title: props.title, description: props.description, icon: props.icon })

const { allCars, isLoading, isFetched, fetchError, fetchAllCars, refreshCars, globalSearch } = useAuctionsApi()

const { fetchDropdowns, getOptions } = useDropdowns()

function getOptionMeta(dropdownName: string, value: string) {
  if (!value)
    return {}
  const opts = getOptions(dropdownName) || []
  return opts.find((o: any) => String(o.value) === String(value)) || {}
}

const bidStats = ref<Record<string, { totalBids: number, uniqueDealers: number, lastBidAt?: string }>>({})
const isStatsLoading = ref(false)

async function fetchBidStats() {
  try {
    isStatsLoading.value = true
    const res = await $fetch<any>('/api/sales/bids-stats')
    if (res.success && res.stats) {
      bidStats.value = res.stats
    }
  }
  catch (e) {}
  finally {
    isStatsLoading.value = false
  }
}

onMounted(() => {
  if (!isFetched.value)
    fetchAllCars()
  fetchBidStats()
  fetchDropdowns()
})

const quickFilterStatus = ref('all')

const quickFilterCounts = computed(() => {
  const counts: Record<string, number> = {
    all: 0,
    upcoming: 0,
    live: 0,
    otobuy: 0,
    sold: 0,
    removed: 0,
    liveAuctionEnded: 0,
  }
  for (const car of allCars.value) {
    counts.all = (counts.all || 0) + 1
    if (typeof car.auctionStatus === 'string' && car.auctionStatus.trim().length > 0) {
      counts[car.auctionStatus] = (counts[car.auctionStatus] || 0) + 1
    }
  }
  return counts
})

const baseFilteredItems = computed(() => {
  const result = allCars.value.filter((car) => {
    // Exclude records with blank auction status altogether
    if (!car.auctionStatus || car.auctionStatus.trim() === '') {
      return false
    }

    let ok = true
    if (props.filterStatus) {
      if (props.filterStatus === 'customer-activity') {
        if (car.auctionStatus !== 'live' && car.auctionStatus !== 'otobuy') {
          ok = false
        }
      }
      else if (props.filterStatus === 'dealer-activity') {
        if (car.auctionStatus !== 'live' && car.auctionStatus !== 'otobuy' && car.auctionStatus !== 'upcoming') {
          ok = false
        }
      }
      else if (car.auctionStatus !== props.filterStatus) {
        ok = false
      }
    }
    else if (quickFilterStatus.value !== 'all') {
      if (car.auctionStatus !== quickFilterStatus.value) {
        ok = false
      }
    }
    return ok
  })

  // Ensure 'customer-activity' tab enforces descending latest-activity sort
  if (props.filterStatus === 'customer-activity') {
    result.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
  }

  // 'dealer-activity' tab relies directly on tracking $max updatedAt of active bids per vehicle
  if (props.filterStatus === 'dealer-activity') {
    result.sort((a, b) => {
      const statA = bidStats.value[String(a.id || a._id)]
      const actA = statA?.lastBidAt
        ? new Date(statA.lastBidAt).getTime()
        : new Date(a.createdAt || 0).getTime() // Fallback to creation date if no bids

      const statB = bidStats.value[String(b.id || b._id)]
      const actB = statB?.lastBidAt
        ? new Date(statB.lastBidAt).getTime()
        : new Date(b.createdAt || 0).getTime()

      return actB - actA
    })
  }

  return result
})

const filteredItems = computed(() => {
  let result = baseFilteredItems.value
  if (globalSearch && globalSearch.value) {
    const q = globalSearch.value.toLowerCase()
    result = result.filter(item =>
      ['make', 'model', 'variant', 'registrationNumber', 'inspectionLocation', 'fuelType', 'appointmentId'].some(key =>
        String(item[key] ?? '').toLowerCase().includes(q),
      ),
    )
  }
  return result
})

const PER_PAGE = 30
const currentPage = ref(1)
watch(globalSearch, () => { currentPage.value = 1 })

const totalFiltered = computed(() => filteredItems.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalFiltered.value / PER_PAGE)))

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * PER_PAGE
  return filteredItems.value.slice(start, start + PER_PAGE)
})

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value)
    currentPage.value = page
}

const showingFrom = computed(() => totalFiltered.value === 0 ? 0 : ((currentPage.value - 1) * PER_PAGE) + 1)
const showingTo = computed(() => Math.min(currentPage.value * PER_PAGE, totalFiltered.value))

function formatCurrency(value: any): string {
  if (!value || isNaN(Number(value)))
    return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value))
}

function formatYear(value: string): string {
  if (!value)
    return '—'
  try {
    const year = new Date(value).getFullYear()
    return isNaN(year) ? value : String(year)
  }
  catch { return value }
}

function formatDate(value: string): string {
  if (!value)
    return '—'
  try { return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return value }
}

const now = ref(Date.now())
let timerInterval: ReturnType<typeof setInterval> | null = null

function formatCountdown(targetDate: string, expiredLabel = 'Ended'): string {
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

onMounted(() => {
  timerInterval = setInterval(() => { now.value = Date.now() }, 1000)
})

onUnmounted(() => {
  if (timerInterval)
    clearInterval(timerInterval)
})

function getFirstImage(car: any): string | null {
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
    // frontMain can also be an array or string
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

  return validImages.length > 0 ? (validImages[0] ?? null) : null
}

function getInflatedCep(car: any): number {
  const basePrice = Number(car.customerExpectedPrice || car.cep || 0)
  if (!basePrice)
    return 0

  const fixedMarginPct = Number(car.fixedMargin || 0)
  const varMarginStr = String(car.variableMargin || '0').replace(/[^0-9.-]/g, '')
  const varMarginPct = Number(varMarginStr) || 0

  const rawCep = basePrice + (basePrice * fixedMarginPct / 100) + (basePrice * varMarginPct / 100)
  return Math.ceil(rawCep / 1000) * 1000
}

function getAuctionStatusColor(status: string) {
  if (!status)
    return 'bg-muted text-muted-foreground'
  switch (status.toLowerCase()) {
    case 'inspected': return 'bg-orange-600 text-white border-transparent'
    case 'liveauctionended': return 'bg-gray-600 text-white border-transparent'
    case 'otobuy': return 'bg-blue-600 text-white border-transparent'
    case 'sold': return 'bg-green-600 text-white border-transparent'
    case 'removed': return 'bg-zinc-900 text-white border-transparent'
    default: return 'bg-muted text-muted-foreground'
  }
}

async function handleRefresh() {
  await refreshCars()
  toast.success('Sales data refreshed')
}

const showReportPreview = ref(false)
const previewAppId = ref('')
const pdfBlobUrl = ref('')
const { copy } = useClipboard()

function openPreview(appid: string) {
  previewAppId.value = ''
  pdfBlobUrl.value = ''
  nextTick(() => {
    previewAppId.value = appid
    showReportPreview.value = true
  })
}

function triggerDownload() {
  if (pdfBlobUrl.value) {
    const a = document.createElement('a')
    a.href = pdfBlobUrl.value
    a.download = `Inspection_Report_${previewAppId.value}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
}

function shareLink() {
  const url = `${window.location.origin}/inspection/${previewAppId.value}`
  copy(url)
  toast.success('Inspection link copied to clipboard!')
}

const showBidsPopup = ref(false)
const selectedCarForBids = ref<any>(null)
const bidsLoading = ref(false)
const carBids = ref<any[]>([])

async function fetchAndShowBids(car: any) {
  selectedCarForBids.value = car
  showBidsPopup.value = true
  bidsLoading.value = true
  carBids.value = []

  try {
    const rawId = car._id?.$oid || car._id || car.id
    const res = await $fetch<any>(`/api/sales/bids?carId=${rawId}`)
    if (res.success) {
      carBids.value = res.bids || []
    }
  }
  catch (err) {
    toast.error('Failed to load bids')
  }
  finally {
    bidsLoading.value = false
  }
}

const pageNumbers = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages: (number | string)[] = [1]
  if (current > 3)
    pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i)
  }
  if (current < total - 2)
    pages.push('...')
  pages.push(total)
  return pages
})
</script>

<template>
  <ClientOnly>
    <HeaderActions>
      <div v-if="!props.filterStatus" class="hidden md:flex items-center bg-muted/40 p-1 rounded-md ml-auto sm:ml-0 overflow-x-auto no-scrollbar">
        <button
          v-for="status in ['all', 'upcoming', 'live', 'otobuy', 'sold', 'removed', 'liveAuctionEnded']"
          :key="status"
          class="px-2.5 py-1 flex items-center gap-1.5 text-xs font-semibold rounded-sm transition-all whitespace-nowrap"
          :class="quickFilterStatus === status ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'"
          @click="quickFilterStatus = status"
        >
          <span>{{ status === 'all' ? 'All Data' : status === 'liveAuctionEnded' ? 'Ended' : status === 'otobuy' ? 'OtoBuy' : status.charAt(0).toUpperCase() + status.slice(1) }}</span>
          <span
            class="px-1.5 py-0.5 rounded-full text-[10px] leading-none font-bold"
            :class="quickFilterStatus === status ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/10 text-muted-foreground'"
          >
            {{ quickFilterCounts[status] || 0 }}
          </span>
        </button>
      </div>
      <div class="relative ml-auto sm:ml-0">
        <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input v-model="globalSearch" placeholder="Search sales..." class="pl-8 h-8 w-40 text-sm" />
      </div>
      <p class="text-xs text-muted-foreground tabular-nums hidden sm:block whitespace-nowrap">
        {{ totalFiltered }} record{{ totalFiltered !== 1 ? 's' : '' }}
      </p>
      <Button variant="ghost" size="sm" class="h-8" :disabled="isLoading" @click="handleRefresh">
        <Icon name="i-lucide-refresh-cw" class="mr-1 size-3.5" :class="{ 'animate-spin': isLoading }" />
        Refresh
      </Button>
    </HeaderActions>
  </ClientOnly>

  <div class="w-full flex flex-col h-full overflow-hidden">
    <div v-if="fetchError" class="shrink-0 m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
      <Icon name="i-lucide-alert-circle" class="size-5 text-destructive shrink-0" />
      <div class="flex-1">
        <p class="text-sm font-medium text-destructive">
          Failed to load sales data
        </p>
        <p class="text-xs text-muted-foreground mt-0.5">
          {{ fetchError }}
        </p>
      </div>
      <Button variant="outline" size="sm" @click="handleRefresh">
        Retry
      </Button>
    </div>

    <div v-if="!isFetched && !fetchError" class="flex-1 min-h-0 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-muted-foreground">
        <Icon name="i-lucide-loader-2" class="size-8 animate-spin" />
        <p class="text-sm">
          Loading sales data...
        </p>
      </div>
    </div>

    <!-- Table -->
    <div v-else-if="!fetchError" class="flex-1 min-h-0 overflow-hidden flex flex-col">
      <Table container-class="h-full pb-10 px-[19px]">
        <TableHeader class="sticky top-0 z-20 bg-background border-b border-border shadow-sm">
          <TableRow>
            <TableHead class="whitespace-nowrap">
              Date
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Car Pic
            </TableHead>
            <TableHead class="whitespace-nowrap">
              App ID
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Specs
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Report
            </TableHead>
            <TableHead v-if="!['liveAuctionEnded', 'removed', 'sold', 'otobuy'].includes(filterStatus || '')" class="whitespace-nowrap">
              Auction Status
            </TableHead>
            <TableHead class="whitespace-nowrap">
              PD
            </TableHead>
            <TableHead class="whitespace-nowrap">
              CEP
            </TableHead>
            <TableHead class="whitespace-nowrap">
              OtoBuy
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Act Bids
            </TableHead>
            <TableHead class="whitespace-nowrap">
              HB
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Auto Bid
            </TableHead>
            <TableHead class="whitespace-nowrap">
              GAP
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Overall Bids
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Deal Status
            </TableHead>

            <TableHead class="whitespace-nowrap">
              Remarks
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="car in paginatedItems"
            :key="car.id"
            class="group hover:bg-muted/50 transition-all duration-300"
          >
            <TableCell class="whitespace-nowrap text-xs text-muted-foreground">
              {{ formatDate(car.createdAt) }}
            </TableCell>
            <TableCell class="w-24">
              <HoverCard :open-delay="200" :close-delay="100">
                <HoverCardTrigger as-child>
                  <div class="relative w-20 h-14 rounded-md overflow-hidden bg-muted border cursor-zoom-in">
                    <img v-if="getFirstImage(car)" :src="getFirstImage(car)!" class="size-full object-cover">
                    <div v-else class="size-full flex items-center justify-center">
                      <Icon name="i-lucide-car" class="size-5 text-muted-foreground" />
                    </div>
                  </div>
                </HoverCardTrigger>
                <HoverCardContent v-if="getFirstImage(car)" side="right" :side-offset="15" class="w-96 h-72 p-0 border shadow-2xl rounded-xl overflow-hidden bg-card z-[100]" avoid-collisions>
                  <img :src="getFirstImage(car)!" class="w-full h-full object-cover">
                </HoverCardContent>
              </HoverCard>
            </TableCell>
            <TableCell class="whitespace-nowrap text-xs font-mono">
              {{ car.appointmentId || '—' }}
            </TableCell>
            <TableCell class="min-w-[260px] max-w-[320px] py-3">
              <p class="font-medium text-xs">
                {{ car.make }} {{ car.model }}
              </p>
              <div class="flex flex-wrap items-center gap-1.5 mt-1 mb-0.5">
                <p class="text-[11px] text-muted-foreground leading-none">
                  {{ car.variant }}
                </p>
                <span v-if="car.fuelType" class="bg-rose-500/10 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider leading-none">{{ car.fuelType }}</span>
                <span v-if="car.ownerSerialNumber" class="bg-primary/10 text-primary px-1.5 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider leading-none">Owner {{ car.ownerSerialNumber }}</span>
              </div>
              <div class="mt-1.5 flex flex-wrap gap-x-1.5 gap-y-1.5 text-[10px] text-muted-foreground leading-tight">
                <span v-if="car.registrationDate" class="bg-sky-500/10 text-sky-600 dark:text-sky-400 px-1.5 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider leading-none">Reg. {{ formatYear(car.registrationDate) }}</span>
                <span v-if="car.registeredRto" class="bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider leading-none">{{ car.registeredRto }}</span>
                <span v-if="car.registrationState" class="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider leading-none">{{ car.registrationState }}</span>
              </div>
              <div v-if="car.roadTaxValidity || car.taxValidTill" class="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-[10px] text-muted-foreground leading-tight">
                <span v-if="car.roadTaxValidity">Tax: {{ car.roadTaxValidity }}</span>
                <span v-if="car.roadTaxValidity && car.taxValidTill">•</span>
                <span v-if="car.taxValidTill">Till {{ formatDate(car.taxValidTill) }}</span>
              </div>
            </TableCell>
            <TableCell>
              <div class="flex justify-center">
                <Button
                  v-if="car.appointmentId"
                  variant="ghost"
                  class="p-1 hover:bg-muted/50 rounded-md transition-colors w-12 h-12 flex items-center justify-center border border-transparent hover:border-border"
                  @click.stop="openPreview(car.appointmentId)"
                >
                  <Icon name="i-lucide-file-text" class="!size-8 text-red-500 shrink-0" />
                </Button>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </div>
            </TableCell>
            <TableCell v-if="!['liveAuctionEnded', 'removed', 'sold', 'otobuy'].includes(filterStatus || '')" class="whitespace-nowrap text-xs">
              <Badge v-if="car.auctionStatus === 'live' && car.auctionEndTime" variant="outline" class="font-bold tracking-wide bg-[#333] text-white border-transparent uppercase text-[10px]">
                <span class="size-1.5 rounded-full mr-1.5 bg-red-500 animate-pulse" />
                {{ formatCountdown(car.auctionEndTime) }}
              </Badge>
              <Badge v-else variant="outline" class="font-bold uppercase tracking-wider text-[10px]" :class="getAuctionStatusColor(car.auctionStatus)">
                {{ car.auctionStatus || '—' }}
              </Badge>
            </TableCell>
            <TableCell class="text-xs whitespace-nowrap font-medium">
              {{ car.priceDiscovery ? formatCurrency(car.priceDiscovery) : '—' }}
            </TableCell>
            <TableCell class="text-xs whitespace-nowrap font-medium" title="Inflated CEP">
              {{ formatCurrency(getInflatedCep(car)) }}
            </TableCell>
            <TableCell class="text-xs whitespace-nowrap text-muted-foreground">
              {{ formatCurrency(car.oneClickPrice) }}
            </TableCell>
            <TableCell class="text-xs text-center px-1">
              <Button variant="outline" class="h-6 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 border-blue-200 text-[10px] uppercase font-bold tracking-wider rounded-md" @click.stop="fetchAndShowBids(car)">
                <Icon name="i-lucide-gavel" class="mr-1 size-3" />
                View
              </Button>
            </TableCell>

            <TableCell class="text-xs font-bold text-emerald-600 tabular-nums">
              {{ formatCurrency(car.highestBid) }}
            </TableCell>

            <TableCell class="text-xs text-muted-foreground text-center">
              —
            </TableCell>

            <TableCell class="text-xs whitespace-nowrap font-medium tabular-nums shadow-sm" :class="getInflatedCep(car) - Number(car.highestBid || 0) > 0 ? 'text-amber-600' : 'text-muted-foreground'">
              {{ (getInflatedCep(car) && car.highestBid) ? formatCurrency(getInflatedCep(car) - Number(car.highestBid)) : '—' }}
            </TableCell>

            <TableCell class="text-[11px] font-mono text-center font-semibold text-foreground/80 tracking-wide">
              <template v-if="isStatsLoading">
                <Icon name="i-lucide-loader-2" class="size-3 animate-spin inline-block text-muted-foreground opacity-50" />
              </template>
              <template v-else>
                {{ bidStats[String(car.id || car._id)]?.totalBids || 0 }} <span class="mx-0.5 text-muted-foreground/50">/</span> {{ bidStats[String(car.id || car._id)]?.uniqueDealers || 0 }}
              </template>
            </TableCell>

            <TableCell class="text-xs text-center px-1">
              <div
                class="inline-flex px-2 py-1 items-center justify-center gap-1.5 min-w-[70px] rounded text-[10px] uppercase font-bold tracking-wider transition-colors border"
                :class="!car.dealStatus ? 'border-dashed border-border/60 bg-muted/50 text-muted-foreground' : 'text-white border-transparent shadow-sm'"
                :style="car.dealStatus ? { backgroundColor: getOptionMeta('Deal Status', car.dealStatus).color || '#27272a' } : {}"
              >
                <Icon v-if="car.dealStatus && getOptionMeta('Deal Status', car.dealStatus).icon" :name="getOptionMeta('Deal Status', car.dealStatus).icon" class="size-3 shrink-0" />
                <span class="truncate max-w-[80px]">{{ car.dealStatus || 'Set Status' }}</span>
              </div>
            </TableCell>
            <TableCell class="text-xs text-muted-foreground text-center">
              —
            </TableCell>
          </TableRow>
          <TableRow v-if="paginatedItems.length === 0">
            <TableCell :colspan="['liveAuctionEnded', 'removed', 'sold', 'otobuy'].includes(filterStatus || '') ? 14 : 15" class="h-32 text-center text-muted-foreground bg-muted/10">
              No matching records found
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Pagination -->
    <div v-if="isFetched && !fetchError" class="shrink-0 border-t bg-muted/30 px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs text-muted-foreground tabular-nums">
        Showing {{ showingFrom }} to {{ showingTo }} out of {{ totalFiltered }} records
      </p>
      <div v-if="totalPages > 1" class="flex items-center gap-1">
        <Button variant="outline" size="icon" class="size-7" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">
          <Icon name="i-lucide-chevron-left" class="size-3.5" />
        </Button>
        <template v-for="pg in pageNumbers" :key="pg">
          <Button
            v-if="pg !== '...'"
            :variant="pg === currentPage ? 'default' : 'outline'"
            size="icon"
            class="size-7 text-xs"
            @click="goToPage(pg as number)"
          >
            {{ pg }}
          </Button>
          <span v-else class="px-1 text-xs text-muted-foreground">…</span>
        </template>
        <Button variant="outline" size="icon" class="size-7" :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
        </Button>
      </div>
    </div>
  </div>

  <Dialog v-model:open="showReportPreview">
    <DialogContent class="max-w-[95vw] lg:max-w-6xl xl:max-w-7xl h-[95vh] p-0 flex flex-col overflow-hidden bg-muted/20 border-border">
      <div class="p-4 pr-12 border-b flex items-center justify-between bg-background shrink-0">
        <div>
          <DialogTitle class="text-lg font-bold">
            Inspection Report Preview
          </DialogTitle>
        </div>
        <div class="flex items-center gap-2">
          <Button size="sm" :disabled="!pdfBlobUrl" @click="triggerDownload">
            <Icon name="i-lucide-download" class="mr-2 size-4" />
            Download PDF
          </Button>
        </div>
      </div>
      <div class="flex-1 bg-muted relative overflow-hidden flex items-center justify-center">
        <iframe v-if="pdfBlobUrl" :src="pdfBlobUrl" class="w-full h-full border-0 absolute inset-0 bg-white" />
        <div v-else class="flex flex-col items-center gap-3 text-muted-foreground p-8 text-center max-w-sm mx-auto">
          <Icon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
          <p class="text-sm font-medium text-foreground">
            Generating PDF Document...
          </p>
          <p class="text-xs">
            Preparing the high-resolution inspection report document. This may take a few moments...
          </p>
        </div>

        <!-- Hidden Generator -->
        <div class="hidden absolute top-[-10000px] left-[-10000px] pointer-events-none opacity-0">
          <CarInspectionView v-if="previewAppId && !pdfBlobUrl" :appointment-id="previewAppId" headless-pdf @pdf-blob-ready="pdfBlobUrl = $event" />
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Active Bids Inspector Popup -->
  <Dialog v-model:open="showBidsPopup">
    <DialogContent class="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0 rounded-2xl border-0 shadow-2xl bg-white dark:bg-background">
      <div class="shrink-0 p-5 border-b flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-transparent dark:from-muted/20">
        <div>
          <DialogTitle class="flex items-center gap-2 text-xl font-bold text-[#1f3b58] dark:text-foreground">
            <Icon name="i-lucide-gavel" class="size-6 text-blue-600" />
            Live Auction Bids
          </DialogTitle>
          <DialogDescription class="mt-1 flex items-center gap-2">
            <span class="font-medium text-foreground">{{ selectedCarForBids?.make }} {{ selectedCarForBids?.model }}</span>
            <span class="text-muted-foreground">({{ selectedCarForBids?.variant }})</span>
            <Badge variant="secondary" class="font-mono text-[10px] ml-2">
              {{ selectedCarForBids?.appointmentId || selectedCarForBids?.registrationNumber }}
            </Badge>
          </DialogDescription>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto min-h-[300px] p-0 relative">
        <div v-if="bidsLoading" class="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-background/80 backdrop-blur-sm z-10 text-muted-foreground gap-3">
          <Icon name="i-lucide-loader-2" class="size-8 animate-spin text-blue-500" />
          <p class="font-medium">
            Syncing live bids...
          </p>
        </div>

        <div v-else-if="carBids.length === 0" class="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
          <div class="size-20 rounded-full bg-muted/30 flex items-center justify-center mb-4 border border-dashed border-border/50">
            <Icon name="i-lucide-receipt" class="size-8 opacity-40" />
          </div>
          <p class="text-base font-semibold text-foreground/70">
            No Bids Registered
          </p>
          <p class="text-sm mt-1">
            This vehicle currently has no active bidding history.
          </p>
        </div>

        <Table v-else>
          <TableHeader class="sticky top-0 z-20 bg-background border-b border-border shadow-sm">
            <TableRow>
              <TableHead class="w-16 text-center">
                #
              </TableHead>
              <TableHead>Execution Time</TableHead>
              <TableHead>Bid Amount</TableHead>
              <TableHead>Dealer / Buyer</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead class="text-center">
                System Bid
              </TableHead>
              <TableHead class="text-right">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(bid, idx) in carBids" :key="bid._id" class="group transition-colors hover:bg-blue-50/30">
              <TableCell class="text-center text-xs text-muted-foreground font-mono">
                {{ idx + 1 }}
              </TableCell>
              <TableCell>
                <div class="flex items-center gap-2">
                  <Icon name="i-lucide-clock" class="size-3.5 text-muted-foreground" />
                  <span class="font-mono text-xs">{{ formatDate(bid.createdAt) }}</span>
                </div>
              </TableCell>
              <TableCell class="font-bold text-emerald-600 text-[15px] tabular-nums">
                {{ formatCurrency(bid.bidAmount || bid.amount) }}
              </TableCell>
              <TableCell>
                <div v-if="bid.dealer" class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold">{{ bid.dealer.shopName || bid.dealer.fullName || 'Unknown Dealer' }}</span>
                  <span v-if="bid.dealer.shopName && bid.dealer.fullName" class="text-[10px] text-muted-foreground w-max uppercase tracking-wider">{{ bid.dealer.fullName }}</span>
                </div>
                <span v-else class="text-muted-foreground italic text-xs">Unregistered User</span>
              </TableCell>
              <TableCell>
                <span v-if="bid.dealer?.phone" class="font-mono text-xs bg-muted/50 px-2 py-1 rounded-md">{{ bid.dealer.phone }}</span>
                <span v-else class="text-muted-foreground">—</span>
              </TableCell>
              <TableCell class="text-center">
                <span
                  v-if="bid.isSystemBid"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800"
                >
                  <Icon name="i-lucide-check-circle-2" class="size-3 shrink-0" />
                  Auto
                </span>
                <span v-else class="text-muted-foreground/40 text-xs">—</span>
              </TableCell>
              <TableCell class="text-right">
                <Badge variant="outline" :class="idx === 0 && !bid.isActive ? 'bg-amber-100 text-amber-800 border-amber-300' : (bid.isActive ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300')">
                  <span class="flex items-center gap-1.5">
                    <span class="size-1.5 rounded-full" :class="idx === 0 || bid.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'" />
                    {{ idx === 0 || bid.isActive ? 'Active' : 'Archived' }}
                  </span>
                </Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </DialogContent>
  </Dialog>
</template>
