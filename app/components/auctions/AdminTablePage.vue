<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { toast } from 'vue-sonner'

const router = useRouter()
const route = useRoute()

const { setHeader } = usePageHeader()
setHeader({ title: 'Auctions / Admin', description: '', icon: 'i-lucide-shield' })

const {
  allCars,
  isLoading,
  isRefreshing,
  isFetched,
  fetchError,
  fetchCars,
  refreshCars,
  globalSearch,
  searchCars,
  cancelSearch,
  hasMore,
  loadMore,
  isLoadingMore,
  totalCount,
  setSimilarSearchCtx,
} = useAuctionsApi()

onMounted(() => { fetchCars() })

// ─── Search ───
let searchDebounce: ReturnType<typeof setTimeout> | null = null
watch(globalSearch, (v) => {
  if (searchDebounce)
    clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    if (v?.trim())
      searchCars(v.trim())
    else cancelSearch()
  }, 400)
})

// ─── Infinite scroll ───
const loadMoreTrigger = ref<HTMLElement | null>(null)
useIntersectionObserver(loadMoreTrigger, (e) => {
  if (e?.[0]?.isIntersecting && hasMore.value && !isLoadingMore.value)
    loadMore()
}, { rootMargin: '400px' })

// ─── Timer ───
const now = ref(Date.now())
let timerInterval: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timerInterval = setInterval(() => { now.value = Date.now() }, 1000)
})
onUnmounted(() => {
  if (timerInterval)
    clearInterval(timerInterval)
})

// ─── Formatters (identical to retail/TablePage) ───
function formatCurrency(value: any): string {
  if (!value || isNaN(Number(value)))
    return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value))
}

function formatYear(value: string): string {
  if (!value)
    return '—'
  try {
    const y = new Date(value).getFullYear()
    return isNaN(y) ? value : String(y)
  }
  catch { return value }
}

function formatDate(value: string): string {
  if (!value)
    return '—'
  try { return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return value }
}

function formatCountdown(targetDate: string, expiredLabel = 'Ended'): string {
  if (!targetDate)
    return '—'
  const diff = new Date(targetDate).getTime() - now.value
  if (diff <= 0)
    return expiredLabel
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  if (d > 0)
    return `${d}d ${h}h ${m}m`
  if (h > 0)
    return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

function getFirstImage(car: any): string | null {
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
  catch {}
  const valid = images
    .map((i: any) => (typeof i === 'string' ? i.trim() : i?.url?.trim()))
    .filter((u): u is string => !!u && u.length > 5 && u !== 'null')
  if (valid.length === 0) {
    const fb = car.frontMain
    if (Array.isArray(fb)) {
      const f = fb.find((x: any) => typeof x === 'string' && x.trim().length > 5); if (f)
        valid.push(f.trim())
    }
    else if (fb && typeof fb === 'string' && fb.trim().length > 5 && fb !== 'null' && fb !== '[]') {
      valid.push(fb.trim())
    }
  }
  if (valid.length === 0 && car.imageUrl && typeof car.imageUrl === 'string' && car.imageUrl.trim().length > 5)
    valid.push(car.imageUrl.trim())
  return valid.length > 0 ? (valid[0] ?? null) : null
}

function getAuctionStatusColor(status: string) {
  if (!status)
    return 'bg-muted text-muted-foreground'
  switch (status.toLowerCase()) {
    case 'inspected': return 'bg-orange-600 text-white border-transparent'
    case 'upcoming': return 'bg-amber-500 text-white border-transparent'
    case 'liveauctionended': return 'bg-gray-600 text-white border-transparent'
    case 'otobuy': return 'bg-blue-600 text-white border-transparent'
    case 'sold': return 'bg-green-600 text-white border-transparent'
    case 'removed': return 'bg-zinc-900 text-white border-transparent'
    default: return 'bg-muted text-muted-foreground'
  }
}

function handleSimilarSearch(car: any) {
  const clean = (str: string) => String(str || '').replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase()
  const yearStr = String(car.yearMonthOfManufacture || '')
  let year = ''
  const d = new Date(yearStr)
  if (!isNaN(d.getTime())) {
    year = String(d.getFullYear())
  }
  else {
    const m = yearStr.match(/\d{4}/); if (m)
      year = m[0]
  }
  setSimilarSearchCtx({ make: car.make, model: car.model, year })
  let yearSlug = year
  const yInt = parseInt(year)
  if (!isNaN(yInt))
    yearSlug = `${yInt - 1}-${yInt}-${yInt + 1}`
  const slug = `similar-search-${clean(car.make)}-${clean(car.model)}-${yearSlug}`.replace(/-+/g, '-')
  router.push({ path: '/retail', query: { tab: slug } })
}

function openPreview(appid: string) {
  router.push(`/inspection/${appid}`)
}

function computeGap(car: any): number | null {
  const cep = Number(car.customerExpectedPrice) || 0
  const hb = Number(car.highestBid) || 0
  if (!cep || !hb)
    return null
  return cep - hb
}

function getInflatedCep(car: any): number {
  const base = Number(car.customerExpectedPrice || 0)
  if (!base)
    return 0
  const fm = Number(car.fixedMargin || 0)
  const vm = Number(String(car.variableMargin || '0').replace(/[^0-9.-]/g, '')) || 0
  return Math.ceil((base + (base * fm / 100) + (base * vm / 100)) / 1000) * 1000
}

function getNetBidAmount(car: any): number {
  const baseBid = Number(car.highestBid) || 0
  if (!baseBid)
    return 0
  const fm = Number(car.fixedMargin || 0)
  const vm = Number(String(car.variableMargin || '0').replace(/[^0-9.-]/g, '')) || 0
  const factor = 1 + (fm + vm) / 100
  if (factor <= 0)
    return 0
  return Math.floor((baseBid / factor) / 1000) * 1000
}

// ─── Margin Simulation (same as retail) ───
const simulationTrigger = ref(0)
const editingCells = ref<Record<string, boolean>>({})

function isEditing(car: any, field: string): boolean {
  return !!editingCells.value[`${car._id || car.id}_${field}`]
}

function startEdit(car: any, field: string) {
  editingCells.value[`${car._id || car.id}_${field}`] = true
}

function stopEdit(car: any, field: string) {
  editingCells.value[`${car._id || car.id}_${field}`] = false
}

function hasSimulation(car: any) {
  void simulationTrigger.value
  return car.marginSimulation !== undefined && car.marginSimulation !== null && car.marginSimulation !== ''
}

function startSimulation(car: any) {
  if (!hasSimulation(car)) {
    const fm = Number(car.fixedMargin || 0)
    const vm = Number(String(car.variableMargin || '0').replace(/[^0-9.-]/g, '')) || 0
    car.marginSimulation = (fm + vm).toFixed(1)
  }
  simulationTrigger.value++
  startEdit(car, 'marginSimulation')
}

function stepSimulation(car: any, step: number) {
  const current = Number(car.marginSimulation) || 0
  car.marginSimulation = Math.max(0, current + step).toFixed(1)
  simulationTrigger.value++
}

function resetSimulation(car: any) {
  car.marginSimulation = undefined
  simulationTrigger.value++
  stopEdit(car, 'marginSimulation')
}

async function handleRefresh() {
  await refreshCars()
  toast.success('Refreshed')
}
</script>

<template>
  <ClientOnly>
    <HeaderActions>
      <div class="relative">
        <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input id="globalSearchInput" v-model="globalSearch" placeholder="Search..." class="pl-8 h-8 w-48 text-sm bg-muted/20" />
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

  <div class="w-full flex flex-col h-full overflow-hidden bg-background">
    <div v-if="fetchError" class="shrink-0 m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
      <Icon name="i-lucide-alert-circle" class="size-5 text-destructive shrink-0" />
      <p class="text-sm text-destructive flex-1">
        Failed to load data
      </p>
      <Button variant="outline" size="sm" @click="handleRefresh">
        Retry
      </Button>
    </div>

    <div v-if="!isFetched && !fetchError" class="flex-1 flex items-center justify-center">
      <Icon name="i-lucide-loader-2" class="size-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Table — same structure as retail/TablePage -->
    <div v-else-if="!fetchError" class="flex-1 min-h-0 overflow-hidden flex flex-col relative">
      <div v-if="isRefreshing || isLoadingMore" class="absolute top-0 left-0 right-0 h-[2px] bg-primary/20 overflow-hidden z-30">
        <div class="h-full bg-primary origin-left rounded-full" style="width: 30%; animation: indeterminate 1.5s infinite linear;" />
      </div>

      <Table container-class="h-full pb-10">
        <TableHeader class="sticky top-0 z-50 bg-background border-b border-border shadow-sm">
          <TableRow>
            <!-- ══ SAME AS RETAIL ══ -->
            <TableHead class="whitespace-nowrap pl-[19px]">
              Date
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Car Pic
            </TableHead>
            <TableHead class="whitespace-nowrap">
              App ID
            </TableHead>
            <TableHead class="whitespace-nowrap sticky left-0 z-50 bg-background border-r border-border/50 shadow-[4px_0_12px_rgba(0,0,0,0.05)]">
              Specs
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Actions
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Auction Status
            </TableHead>
            <!-- ══ ADMIN-SPECIFIC ══ -->
            <TableHead class="whitespace-nowrap">
              PD
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Act CEP
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Act HB
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Actual Gap
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Inflated CEP
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Deflated HB
            </TableHead>
            <TableHead class="whitespace-nowrap">
              GAP
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Margin Simulation
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Set Margin
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Act Bids
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Auto Bids
            </TableHead>
            <TableHead class="whitespace-nowrap text-center">
              Bids / Bidders
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Prospective Dealers
            </TableHead>
            <TableHead class="whitespace-nowrap text-center">
              Deal Status
            </TableHead>
            <TableHead class="whitespace-nowrap text-center">
              Quality
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Remarks
            </TableHead>
            <TableHead class="whitespace-nowrap text-center">
              CEP vs PD
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="car in allCars"
            :key="car.id || car._id"
            class="group hover:bg-muted/50 transition-all duration-300"
          >
            <!-- ══ DATE — exact retail copy ══ -->
            <TableCell class="whitespace-nowrap text-xs text-muted-foreground pl-[19px]">
              {{ formatDate((car.approvalDate && car.approvalDate !== 'null') ? car.approvalDate : ((car.auctionStartTime && car.auctionStartTime !== 'null') ? car.auctionStartTime : car.createdAt)) }}
            </TableCell>

            <!-- ══ CAR PIC — exact retail copy ══ -->
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

            <!-- ══ APP ID — exact retail copy ══ -->
            <TableCell class="whitespace-nowrap text-xs font-mono">
              {{ car.appointmentId || '—' }}
            </TableCell>

            <!-- ══ SPECS — exact retail copy ══ -->
            <TableCell class="min-w-[260px] max-w-[320px] py-3 sticky left-0 z-40 bg-background group-hover:bg-muted transition-colors border-r border-border/50 shadow-[4px_0_12px_rgba(0,0,0,0.05)]">
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
                <span v-if="car.yearMonthOfManufacture" class="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider leading-none">Mfg. {{ formatYear(car.yearMonthOfManufacture) }}</span>
                <span v-if="car.odometerReadingInKms" class="flex items-center gap-1 bg-slate-500/10 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider leading-none border border-slate-500/20">
                  <Icon name="i-lucide-gauge" class="size-2.5" />
                  {{ Number(car.odometerReadingInKms).toLocaleString() }} KMS
                </span>
                <span v-if="car.registeredRto" class="bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider leading-none">{{ car.registeredRto }}</span>
                <span v-if="car.registrationState" class="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider leading-none">{{ car.registrationState }}</span>
              </div>
              <div v-if="car.roadTaxValidity || car.taxValidTill" class="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-[10px] text-muted-foreground leading-tight">
                <span v-if="car.roadTaxValidity">Tax: {{ car.roadTaxValidity }}</span>
                <span v-if="car.roadTaxValidity && car.taxValidTill">•</span>
                <span v-if="car.taxValidTill">Till {{ formatDate(car.taxValidTill) }}</span>
              </div>
            </TableCell>

            <!-- ══ ACTIONS — same as retail but NO transfer button ══ -->
            <TableCell>
              <div class="flex justify-center gap-1">
                <Button
                  v-if="car.appointmentId"
                  variant="ghost"
                  class="p-1 hover:bg-muted/50 rounded-md transition-colors w-12 h-12 flex items-center justify-center border border-transparent hover:border-border"
                  title="Similar Search"
                  @click.stop="handleSimilarSearch(car)"
                >
                  <Icon name="i-lucide-search" class="!size-6 text-blue-500 shrink-0" />
                </Button>
                <Button
                  v-if="car.appointmentId"
                  variant="ghost"
                  class="p-1 hover:bg-muted/50 rounded-md transition-colors w-12 h-12 flex items-center justify-center border border-transparent hover:border-border"
                  title="PDF Report"
                  @click.stop="openPreview(car.appointmentId)"
                >
                  <Icon name="i-lucide-file-text" class="!size-8 text-red-500 shrink-0" />
                </Button>
              </div>
            </TableCell>

            <!-- ══ AUCTION STATUS — exact retail copy ══ -->
            <TableCell class="whitespace-nowrap text-xs">
              <Badge v-if="car.auctionStatus === 'live' && car.auctionEndTime" variant="outline" class="font-bold tracking-wide bg-[#EB4C4C] text-white border-transparent uppercase text-[10px] tabular-nums w-[84px] justify-center">
                {{ formatCountdown(car.auctionEndTime) }}
              </Badge>
              <Badge v-else variant="outline" class="font-bold uppercase tracking-wider text-[10px] w-[84px] justify-center" :class="getAuctionStatusColor(car.auctionStatus)">
                {{ car.auctionStatus?.toLowerCase() === 'liveauctionended' ? 'Ended' : (car.auctionStatus || '—') }}
              </Badge>
            </TableCell>

            <!-- ══ ADMIN COLUMNS ══ -->
            <!-- PD -->
            <TableCell class="text-xs whitespace-nowrap font-medium">
              {{ car.priceDiscovery ? formatCurrency(car.priceDiscovery) : '—' }}
            </TableCell>

            <!-- Act CEP -->
            <TableCell class="text-xs whitespace-nowrap font-medium text-amber-600">
              {{ car.customerExpectedPrice ? formatCurrency(car.customerExpectedPrice) : '—' }}
            </TableCell>

            <!-- Act HB -->
            <TableCell class="text-xs whitespace-nowrap font-medium text-emerald-600">
              {{ car.highestBid ? formatCurrency(car.highestBid) : '—' }}
            </TableCell>

            <!-- Actual Gap (CEP - HB) -->
            <TableCell class="text-xs whitespace-nowrap font-bold tabular-nums">
              <span :class="computeGap(car) !== null ? (computeGap(car)! > 0 ? 'text-red-500' : 'text-emerald-500') : 'text-muted-foreground'">
                {{ computeGap(car) !== null ? formatCurrency(computeGap(car)) : '—' }}
              </span>
            </TableCell>

            <!-- Inflated CEP -->
            <TableCell class="text-xs whitespace-nowrap tabular-nums text-muted-foreground">
              {{ getInflatedCep(car) ? formatCurrency(getInflatedCep(car)) : '—' }}
            </TableCell>

            <!-- Deflated HB -->
            <TableCell class="text-xs whitespace-nowrap tabular-nums text-muted-foreground">
              {{ getNetBidAmount(car) ? formatCurrency(getNetBidAmount(car)) : '—' }}
            </TableCell>

            <!-- GAP (Inflated CEP - Deflated HB) -->
            <TableCell class="text-xs whitespace-nowrap tabular-nums font-bold">
              <span v-if="getInflatedCep(car) && getNetBidAmount(car)" :class="(getInflatedCep(car) - getNetBidAmount(car)) > 0 ? 'text-red-500' : 'text-emerald-500'">
                {{ formatCurrency(getInflatedCep(car) - getNetBidAmount(car)) }}
              </span>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>

            <!-- Margin Simulation -->
            <TableCell class="text-xs text-center px-1">
              <div class="min-h-[32px] min-w-[70px] flex items-center justify-center p-1 rounded group transition-colors relative" :class="isEditing(car, 'marginSimulation') ? '' : 'hover:bg-muted/30'">
                <div v-if="!isEditing(car, 'marginSimulation')" class="flex items-center gap-1.5 cursor-pointer w-full justify-center" @click="startSimulation(car)">
                  <span v-if="hasSimulation(car)" class="font-bold text-primary bg-primary/10 px-2.5 py-0.5 tabular-nums rounded">
                    {{ Number(car.marginSimulation).toFixed(1) }}%
                  </span>
                  <span v-else class="text-muted-foreground/40">—</span>
                  <Icon name="i-lucide-activity" class="size-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div v-else class="flex items-center gap-1.5">
                  <div class="flex items-center gap-1 bg-muted/30 p-0.5 rounded-full border shadow-sm">
                    <button class="size-6 flex items-center justify-center rounded-full bg-background hover:bg-red-50 hover:text-red-600 transition-colors shadow-sm border border-border/50 text-muted-foreground" @click.stop="stepSimulation(car, -0.5)">
                      <Icon name="i-lucide-minus" class="size-3" />
                    </button>
                    <div class="font-bold tabular-nums text-[11px] text-primary min-w-[36px] text-center">
                      {{ Number(car.marginSimulation).toFixed(1) }}%
                    </div>
                    <button class="size-6 flex items-center justify-center rounded-full bg-background hover:bg-emerald-50 hover:text-emerald-600 transition-colors shadow-sm border border-border/50 text-muted-foreground" @click.stop="stepSimulation(car, 0.5)">
                      <Icon name="i-lucide-plus" class="size-3" />
                    </button>
                  </div>
                  <div class="flex flex-col gap-1">
                    <button
                      class="size-5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-sm transition-colors"
                      title="Save simulation"
                      @click.stop="stopEdit(car, 'marginSimulation')"
                    >
                      <Icon name="i-lucide-check" class="size-3" />
                    </button>
                    <button
                      class="size-5 rounded-full bg-muted border border-border text-muted-foreground hover:bg-destructive hover:text-destructive-foreground hover:border-destructive flex items-center justify-center shadow-sm transition-colors"
                      title="Clear simulation"
                      @click.stop="resetSimulation(car)"
                    >
                      <Icon name="i-lucide-x" class="size-2.5" />
                    </button>
                  </div>
                </div>
              </div>
            </TableCell>

            <!-- Set Margin -->
            <TableCell class="text-xs whitespace-nowrap text-center font-bold tabular-nums">
              {{ car.variableMargin || '—' }}
            </TableCell>

            <!-- Act Bids -->
            <TableCell>
              <div v-if="car.topBids?.length" class="flex flex-col gap-0.5 text-[10px] min-w-[120px]">
                <div v-for="(bid, i) in car.topBids.slice(0, 2)" :key="i" class="flex items-center gap-1.5">
                  <span class="font-bold text-foreground tabular-nums">{{ formatCurrency(bid.amount || bid.bidAmount) }}</span>
                  <span class="text-muted-foreground truncate max-w-[80px]">{{ bid.dealerName || bid.bidderName || '' }}</span>
                </div>
              </div>
              <span v-else class="text-[10px] text-muted-foreground">—</span>
            </TableCell>

            <!-- Auto Bids -->
            <TableCell>
              <div v-if="car.autoBids?.length" class="flex flex-col gap-0.5 text-[10px] min-w-[120px]">
                <div v-for="(bid, i) in car.autoBids.slice(0, 2)" :key="i" class="flex items-center gap-1.5">
                  <span class="font-bold text-foreground tabular-nums">{{ formatCurrency(bid.amount || bid.bidAmount) }}</span>
                  <span class="text-muted-foreground truncate max-w-[80px]">{{ bid.bidderName || '' }}</span>
                </div>
              </div>
              <span v-else class="text-[10px] text-muted-foreground">—</span>
            </TableCell>

            <!-- Bids / Bidders -->
            <TableCell class="text-center whitespace-nowrap">
              <div class="flex flex-col items-center gap-0.5">
                <span class="text-[11px] font-bold text-foreground tabular-nums">{{ car.totalBids || car.bidsCount || 0 }}</span>
                <span class="text-[9px] text-muted-foreground">{{ car.biddersCount || 0 }} bidders</span>
              </div>
            </TableCell>

            <!-- Prospective Dealers -->
            <TableCell class="text-[10px] text-muted-foreground">
              {{ car.prospectiveDealers || '—' }}
            </TableCell>

            <!-- Deal Status -->
            <TableCell class="whitespace-nowrap text-center">
              <Badge v-if="car.dealStatus" variant="outline" class="text-[9px] font-bold">
                {{ car.dealStatus }}
              </Badge>
              <span v-else class="text-[10px] text-muted-foreground">—</span>
            </TableCell>

            <!-- Quality -->
            <TableCell class="whitespace-nowrap text-[11px] text-center text-muted-foreground">
              {{ car.retailQuality || car.quality || '—' }}
            </TableCell>

            <!-- Remarks -->
            <TableCell class="text-[10px] text-muted-foreground max-w-[120px] truncate">
              {{ car.remarks || '—' }}
            </TableCell>

            <!-- CEP vs PD -->
            <TableCell class="whitespace-nowrap text-center">
              <div v-if="car.customerExpectedPrice && car.priceDiscovery" class="flex flex-col items-center gap-0.5">
                <span
                  class="text-[10px] font-bold tabular-nums"
                  :class="Number(car.customerExpectedPrice) > Number(car.priceDiscovery) ? 'text-red-500' : 'text-emerald-500'"
                >
                  {{ ((Number(car.customerExpectedPrice) / Number(car.priceDiscovery)) * 100).toFixed(0) }}%
                </span>
                <span class="text-[8px] text-muted-foreground">CEP/PD</span>
              </div>
              <span v-else class="text-[10px] text-muted-foreground">—</span>
            </TableCell>
          </TableRow>

          <TableRow v-if="allCars.length === 0 && !isLoading">
            <TableCell :colspan="23" class="h-40 text-center text-muted-foreground">
              No data found
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div v-if="hasMore" ref="loadMoreTrigger" class="h-20 flex items-center justify-center">
        <Icon name="i-lucide-loader-2" class="size-5 animate-spin text-muted-foreground/50" />
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes indeterminate {
  0% { transform: translateX(-100%) scaleX(0.2); }
  50% { transform: translateX(0%) scaleX(0.5); }
  100% { transform: translateX(200%) scaleX(0.2); }
}
</style>
