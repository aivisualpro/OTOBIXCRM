<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { toast } from 'vue-sonner'

const router = useRouter()
const route = useRoute()

const { setHeader } = usePageHeader()
setHeader({ title: 'Auctions / Admin', description: '', icon: 'i-lucide-shield' })

const _userCookie = useCookie('userData')
const loggedInUserRole = computed(() => {
  try {
    const parsed = typeof _userCookie.value === 'string' ? JSON.parse(_userCookie.value) : _userCookie.value
    return parsed?.userRole || parsed?.role || ''
  }
  catch { return '' }
})

const { allUsers, fetchAllUsers, isFetched: isUsersFetched } = usePeopleApi()
const { dropdowns, fetchDropdowns, getOptions } = useDropdowns()

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

// ─── Car Simulation Persistence ───
const { loadSimulations, hydrateSimulations, saveSimulation, deleteSimulation, isLoaded: simsLoaded } = useCarSimulations()

onMounted(() => {
  fetchCars()
  loadSimulations()
  fetchAllUsers()
  fetchDropdowns()
  fetchBidStats()
})

watch([allCars, simsLoaded], () => {
  if (simsLoaded.value && allCars.value.length) {
    hydrateSimulations(allCars.value)
    simulationTrigger.value++
  }
})

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

function formatDateTimeStr(val: string) {
  if (!val) return ''
  try {
    const d = new Date(val)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    let h = d.getHours()
    const ap = h >= 12 ? 'PM' : 'AM'
    h = h % 12 || 12
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${dd}/${mm} ${h}:${min} ${ap}`
  }
  catch { return val }
}

function getFollowupBgColor(tsStr: string) {
  if (!tsStr) return ''
  const dateStr = tsStr.split('T')[0] || ''
  const today = new Date()
  const todayStr = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0] || ''
  if (!dateStr || !todayStr) return ''
  if (dateStr > todayStr) return 'bg-blue-600 text-white border-transparent'
  if (dateStr === todayStr) return 'bg-green-600 text-white border-transparent'
  return 'bg-red-600 text-white border-transparent'
}

function resolveUserNameByEmail(email: string) {
  if (!email) return '—'
  const user = allUsers.value.find(u => u.email === email)
  return user?.userName || email
}

// ─── Bid Stats ───
const bidStats = ref<Record<string, { totalBids: number, uniqueDealers: number, lastBidAt?: string }>>({})
const isStatsLoading = ref(false)

async function fetchBidStats() {
  try {
    isStatsLoading.value = true
    const res = await $fetch<any>('/api/retail/bids-stats')
    if (res.success && res.stats) {
      bidStats.value = res.stats
    }
  }
  catch {}
  finally {
    isStatsLoading.value = false
  }
}

function buildLog(fieldKey: string, newValue: any, oldValue: any) {
  return {
    updatedAt: new Date().toISOString(),
    updatedBy: 'Admin',
    fieldChanged: String(fieldKey || ''),
    oldValue: String(oldValue || ''),
    newValue: String(newValue || ''),
  }
}

async function updateCarField(car: any, fieldKey: string, newValue: any, overrideOldValue?: any) {
  try {
    const oldVal = arguments.length > 3 ? overrideOldValue : car[fieldKey]
    if (oldVal === newValue) return
    const log = buildLog(fieldKey, newValue, oldVal)
    car[fieldKey] = newValue
    if (!car.retailChangeLog) car.retailChangeLog = []
    car.retailChangeLog.unshift(log)
    await $fetch('/api/cars/update', {
      method: 'PUT',
      body: {
        _id: car._id,
        [fieldKey]: newValue,
        _push: { retailChangeLog: { $each: [log], $position: 0 } },
      },
    })
    toast.success('Updated successfully')
  }
  catch {
    toast.error('Failed to update')
    refreshCars()
  }
}

function getOptionMeta(dropdownName: string, value: string) {
  if (!value) return {}
  const opts = getOptions(dropdownName) || []
  return opts.find((o: any) => String(o.value) === String(value)) || {}
}

// ─── Deal Status ───
const isFollowupDialogOpen = ref(false)
const pendingFollowupCar = ref<any>(null)
const tempFollowupDate = ref('')

async function updateDealStatus(car: any, newStatus: string) {
  if (car.dealStatus === newStatus) return
  if (newStatus === 'Under Negotiation') {
    pendingFollowupCar.value = car
    tempFollowupDate.value = ''
    isFollowupDialogOpen.value = true
    return
  }
  const autoClearTs = newStatus === '' ? '' : null
  await commitDealStatus(car, newStatus, autoClearTs)
}

async function commitDealStatus(car: any, newStatus: string, followupTs: string | null) {
  try {
    const oldVal = car.dealStatus
    const log = buildLog('dealStatus', newStatus, oldVal)
    car.dealStatus = newStatus
    if (!car.retailChangeLog) car.retailChangeLog = []
    const logsToPush = [log]
    car.retailChangeLog.unshift(log)
    const payload: any = { _id: car._id, dealStatus: newStatus }
    if (followupTs !== null) {
      const oldFollowup = car.followupTimeStamp
      car.followupTimeStamp = followupTs
      payload.followupTimeStamp = followupTs
      const fLog = buildLog('followupTimeStamp', followupTs, oldFollowup || '')
      car.retailChangeLog.unshift(fLog)
      logsToPush.unshift(fLog)
    }
    payload._push = { retailChangeLog: { $each: logsToPush, $position: 0 } }
    await $fetch('/api/cars/update', { method: 'PUT', body: payload })
    toast.success('Deal status updated')
  }
  catch {
    toast.error('Failed to update deal status')
    refreshCars()
  }
}

async function confirmFollowup() {
  if (!tempFollowupDate.value) {
    toast.error('Followup Date & Time is required')
    return
  }
  if (!pendingFollowupCar.value) return
  await commitDealStatus(pendingFollowupCar.value, 'Under Negotiation', tempFollowupDate.value)
  isFollowupDialogOpen.value = false
  pendingFollowupCar.value = null
}

function cancelFollowup() {
  isFollowupDialogOpen.value = false
  pendingFollowupCar.value = null
}

// ─── Remarks ───
const isRemarksOpen = ref(false)
const selectedCarForRemarks = ref<any>(null)
const tempRemarks = ref('')

function openRemarks(car: any) {
  selectedCarForRemarks.value = car
  tempRemarks.value = car.remarks || ''
  isRemarksOpen.value = true
}

function saveRemarks() {
  if (!selectedCarForRemarks.value) return
  const original = selectedCarForRemarks.value.remarks || ''
  const newVal = tempRemarks.value
  if (original !== newVal) {
    updateCarField(selectedCarForRemarks.value, 'remarks', newVal, original)
  }
  selectedCarForRemarks.value.remarks = newVal
  isRemarksOpen.value = false
}

// ─── Retail Associate Editing ───
const raEditing = ref<Record<string, boolean>>({})
const raValue = ref<Record<string, string>>({})
const raSaving = ref<Record<string, boolean>>({})
const retailersList = computed(() => allUsers.value.filter(u => String(u.userRole || '').toLowerCase() === 'retailer'))

function openRa(car: any) {
  if (loggedInUserRole.value !== 'Admin') return
  const key = car._id || car.id
  raValue.value[key] = car.retailAssociate || ''
  raEditing.value[key] = true
}

function closeRa(car: any) {
  const key = car._id || car.id
  raEditing.value[key] = false
  raValue.value[key] = ''
}

async function confirmRa(car: any) {
  const key = car._id || car.id
  const newVal = raValue.value[key]
  if (newVal === car.retailAssociate) {
    closeRa(car)
    return
  }
  raSaving.value[key] = true
  try {
    await $fetch('/api/leads/update', {
      method: 'PUT',
      body: {
        telecallingId: car.appointmentId || car._id?.$oid || car.id || car._id,
        retailAssociate: newVal,
      },
    })
    car.retailAssociate = newVal
    toast.success('Retail Associate updated')
    closeRa(car)
  }
  catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Failed to update Retail Associate')
  }
  finally {
    raSaving.value[key] = false
  }
}

// ─── CEP vs PD Bucket Analysis ───
function getCepPdBucket(car: any): { label: string, bg: string, text: string, border: string } | null {
  const actBid = Number(car.highestBid || 0)
  const actCep = Number(car.customerExpectedPrice || car.cep || 0)
  const pd = Number(car.priceDiscovery || 0)
  if (!actCep || !pd) return null

  if (actBid >= actCep && actCep > pd) {
    return { label: 'Retail Bucket', bg: 'bg-red-600', text: 'text-white', border: 'border-red-700' }
  }
  if (actBid > pd && actCep <= pd) {
    return { label: 'High Probability', bg: 'bg-emerald-700', text: 'text-white', border: 'border-emerald-800' }
  }
  if (actBid < pd && actCep <= pd) {
    return { label: 'Sales Bucket', bg: 'bg-emerald-400', text: 'text-emerald-950', border: 'border-emerald-500' }
  }
  if (actBid < pd && actCep > pd) {
    return { label: 'Sales & Retail', bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-700' }
  }
  return null
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

function hasMarginSimulation(car: any) {
  void simulationTrigger.value
  return car.marginSimulation !== undefined && car.marginSimulation !== null && car.marginSimulation !== ''
}

function hasSimulation(car: any) {
  void simulationTrigger.value
  return hasMarginSimulation(car) || hasCepSimulation(car)
}

function startSimulation(car: any) {
  if (!hasMarginSimulation(car)) {
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

function getMarginSimValue(car: any): string {
  void simulationTrigger.value
  return Number(car.marginSimulation || 0).toFixed(1)
}

function resetSimulation(car: any) {
  car.marginSimulation = undefined
  simulationTrigger.value++
  stopEdit(car, 'marginSimulation')
  saveSimulation(car)
}

// ─── CEP Value Simulation ───
const cepSimEditing = ref<Record<string, boolean>>({})
const cepSimValue = ref<Record<string, string>>({})

function getEffectiveSimCep(car: any): number {
  void simulationTrigger.value
  if (car._cepSimulation !== undefined && car._cepSimulation !== null && car._cepSimulation !== '') {
    return Number(car._cepSimulation) || 0
  }
  return Number(car.customerExpectedPrice || 0)
}

function hasCepSimulation(car: any): boolean {
  void simulationTrigger.value
  return car._cepSimulation !== undefined && car._cepSimulation !== null && car._cepSimulation !== ''
}

function openCepSim(car: any) {
  const key = car._id || car.id
  cepSimValue.value[key] = String(Number(car._cepSimulation || car.customerExpectedPrice || 0))
  cepSimEditing.value[key] = true
}

function closeCepSim(car: any) {
  const key = car._id || car.id
  cepSimEditing.value[key] = false
  cepSimValue.value[key] = ''
}

function confirmCepSim(car: any) {
  const key = car._id || car.id
  const newVal = Number(cepSimValue.value[key])
  if (isNaN(newVal) || newVal <= 0) {
    toast.error('Enter a valid price')
    return
  }
  car._cepSimulation = newVal
  simulationTrigger.value++
  cepSimEditing.value[key] = false
  saveSimulation(car)
}

function clearCepSimulation(car: any) {
  const key = car._id || car.id
  car._cepSimulation = undefined
  cepSimEditing.value[key] = false
  cepSimValue.value[key] = ''
  simulationTrigger.value++
  saveSimulation(car)
}

// ─── Simulated calculations ───
function getSimulatedNetBid(car: any): number {
  void simulationTrigger.value
  const baseBid = Number(car.highestBid) || 0
  if (!baseBid) return 0
  const simMarginPct = Number(String(car.marginSimulation || '0').replace(/[^0-9.-]/g, '')) || 0
  const factor = 1 + simMarginPct / 100
  if (factor <= 0) return 0
  return Math.floor((baseBid / factor) / 1000) * 1000
}

function getSimulatedInflatedCep(car: any): number {
  void simulationTrigger.value
  const basePrice = getEffectiveSimCep(car)
  if (!basePrice) return 0
  const simMarginPct = Number(String(car.marginSimulation || '0').replace(/[^0-9.-]/g, '')) || 0
  if (simMarginPct) {
    return Math.ceil((basePrice + (basePrice * simMarginPct / 100)) / 1000) * 1000
  }
  // CEP sim only → use actual margins with simulated base
  const fm = Number(car.fixedMargin || 0)
  const vm = Number(String(car.variableMargin || '0').replace(/[^0-9.-]/g, '')) || 0
  return Math.ceil((basePrice + (basePrice * fm / 100) + (basePrice * vm / 100)) / 1000) * 1000
}

// ─── Logged-in user ID ───
const loggedInUserId = computed(() => {
  try {
    const parsed = typeof _userCookie.value === 'string' ? JSON.parse(_userCookie.value) : _userCookie.value
    return parsed?._id || parsed?.id || ''
  }
  catch { return '' }
})

// ─── Re-Set Var. Margin ───
const OTOBIX_API_BASE = 'https://ob-dealerapp-kong.onrender.com/api'
const resetVarEditing = ref<Record<string, boolean>>({})
const resetVarValue = ref<Record<string, string>>({})
const resetVarSaving = ref<Record<string, boolean>>({})

function openResetVar(car: any) {
  const key = car._id || car.id
  const currentVar = Number(String(car.variableMargin || '0').replace(/[^0-9.-]/g, ''))
  resetVarValue.value[key] = currentVar > 0 ? String(Math.max(0, currentVar - 0.5).toFixed(2)) : ''
  resetVarEditing.value[key] = true
}

function closeResetVar(car: any) {
  const key = car._id || car.id
  resetVarEditing.value[key] = false
  resetVarValue.value[key] = ''
}

async function confirmResetVar(car: any) {
  const key = car._id || car.id
  const newMargin = Number(resetVarValue.value[key])
  const currentVar = Number(String(car.variableMargin || '0').replace(/[^0-9.-]/g, ''))
  const rawId = car._id?.$oid || car._id || car.id

  if (newMargin <= 0) {
    toast.error('Variable margin must be greater than 0')
    return
  }
  if (newMargin >= currentVar) {
    toast.error(`New margin must be less than current variable margin (${currentVar}%)`)
    return
  }
  if (!loggedInUserId.value) {
    toast.error('Cannot determine logged-in user')
    return
  }

  resetVarSaving.value[key] = true
  try {
    await $fetch(`${OTOBIX_API_BASE}/otobix/set-variable-margin`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer QmFwR0RjLjJmMzkyMjJw98UNpMGFqpgGJV6BXgQ1ye12d100f5c`,
      },
      body: {
        carId: rawId,
        userId: loggedInUserId.value,
        variableMargin: newMargin,
        bidAmount: Number(car.highestBid || 0),
      },
    })
    car.variableMargin = String(newMargin)
    toast.success(`Variable margin updated to ${newMargin}%`)
    closeResetVar(car)
  }
  catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Failed to update variable margin')
  }
  finally {
    resetVarSaving.value[key] = false
  }
}

async function handleRefresh() {
  await refreshCars()
  toast.success('Refreshed')
}

// ─── Live Auction Bids Popup ───
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
function getHighestAutoBidObj(car: any): any {
  if (!car || !Array.isArray(car.autoBidsForLiveSection)) {
    return null
  }
  const relevantBids = car.autoBidsForLiveSection.filter((b: any) => {
    const cid = String(b.carId)
    return cid === String(car._id) || cid === String(car.id)
  })
  if (!relevantBids.length) {
    return null
  }
  return relevantBids.reduce((highest: any, current: any) => {
    return (Number(current.maxAmount) || 0) > (Number(highest.maxAmount) || 0) ? current : highest
  })
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
              Inflated GAP
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Margin Simulation
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Re-Set Var. Margin
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Act Bids
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Auto Bid
            </TableHead>
            <TableHead class="whitespace-nowrap text-center">
              Overall Bids
            </TableHead>
            <TableHead class="whitespace-nowrap">
              RA
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

            <!-- Act CEP + Simulate -->
            <TableCell class="text-xs whitespace-nowrap align-middle px-2">
              <div class="flex flex-col items-center justify-center gap-1 min-h-[36px]">
                <span class="font-medium transition-all" :class="hasCepSimulation(car) ? 'text-muted-foreground line-through opacity-50' : 'text-amber-600'">
                  {{ car.customerExpectedPrice ? formatCurrency(car.customerExpectedPrice) : '—' }}
                </span>
                <div class="flex flex-col items-center gap-1" @click.stop>
                  <Transition
                    enter-active-class="transition-all duration-300 ease-out"
                    enter-from-class="opacity-0 -translate-y-2 scale-95"
                    enter-to-class="opacity-100 translate-y-0 scale-100"
                    leave-active-class="transition-all duration-200 ease-in"
                    leave-from-class="opacity-100"
                    leave-to-class="opacity-0 scale-95"
                  >
                    <div
                      v-if="hasCepSimulation(car) && !cepSimEditing[car._id || car.id]"
                      class="text-[11px] px-2 py-0.5 font-bold tabular-nums whitespace-nowrap flex items-center gap-1 text-amber-700 dark:text-amber-400 bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 rounded-md cursor-pointer hover:bg-amber-100 transition-colors"
                      title="Simulated CEP (click to adjust)"
                      @click.stop="openCepSim(car)"
                    >
                      <Icon name="i-lucide-activity" class="size-3" />
                      {{ formatCurrency(car._cepSimulation) }}
                      <button class="ml-0.5 size-3.5 rounded-full bg-amber-200 hover:bg-red-400 hover:text-white text-amber-700 flex items-center justify-center transition-colors" title="Clear" @click.stop="clearCepSimulation(car)">
                        <Icon name="i-lucide-x" class="size-2" />
                      </button>
                    </div>
                  </Transition>
                  <div v-if="cepSimEditing[car._id || car.id]" class="flex items-center gap-1">
                    <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-full flex items-center px-2 py-0.5 shadow-sm">
                      <span class="text-amber-600 font-bold text-[10px] mr-1">₹</span>
                      <input
                        v-model="cepSimValue[car._id || car.id]"
                        type="number"
                        class="w-20 bg-transparent text-amber-700 dark:text-amber-300 font-bold tabular-nums text-xs border-none outline-none focus:ring-0 p-0 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="Sim Price"
                        @keydown.enter="confirmCepSim(car)"
                        @click.stop
                      >
                    </div>
                    <div class="flex flex-col gap-0.5">
                      <button class="size-[18px] flex items-center justify-center rounded-full bg-amber-50 hover:bg-amber-100 text-amber-600 shadow-sm border border-amber-200" @click.stop="confirmCepSim(car)">
                        <Icon name="i-lucide-check" class="size-2.5" />
                      </button>
                      <button class="size-[18px] flex items-center justify-center rounded-full bg-background hover:bg-muted text-muted-foreground shadow-sm border border-border" @click.stop="closeCepSim(car)">
                        <Icon name="i-lucide-x" class="size-2.5" />
                      </button>
                    </div>
                  </div>
                  <button
                    v-if="!cepSimEditing[car._id || car.id] && !hasCepSimulation(car)"
                    class="inline-flex items-center gap-1 px-2 py-[3px] rounded-md text-[10px] font-semibold uppercase tracking-wider border bg-violet-50 hover:bg-violet-100 text-violet-600 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800 transition-all"
                    @click.stop="openCepSim(car)"
                  >
                    <Icon name="i-lucide-activity" class="size-3" />
                    Simulate
                  </button>
                </div>
              </div>
            </TableCell>

            <!-- Act HB -->
            <TableCell class="text-xs whitespace-nowrap font-medium text-emerald-600">
              {{ car.highestBid ? formatCurrency(car.highestBid) : '—' }}
            </TableCell>

            <!-- Actual Gap (CEP - HB) -->
            <TableCell class="text-xs whitespace-nowrap align-middle">
              <div class="flex flex-col items-center gap-1 min-h-[36px] justify-center">
                <span v-if="computeGap(car) !== null" class="font-bold tabular-nums transition-all" :class="[hasSimulation(car) ? 'text-muted-foreground line-through opacity-50' : '', computeGap(car)! > 0 ? 'text-red-500' : 'text-emerald-500']">
                  {{ formatCurrency(computeGap(car)) }}
                </span>
                <span v-else class="text-muted-foreground">—</span>
                <Transition
                  enter-active-class="transition-all duration-300 ease-out"
                  enter-from-class="opacity-0 -translate-y-2 scale-95"
                  enter-to-class="opacity-100 translate-y-0 scale-100"
                  leave-active-class="transition-all duration-200 ease-in"
                  leave-from-class="opacity-100"
                  leave-to-class="opacity-0 scale-95"
                >
                  <div
                    v-if="hasSimulation(car) && (getEffectiveSimCep(car) && car.highestBid)"
                    class="text-[11px] px-2 py-0.5 font-bold tabular-nums whitespace-nowrap flex items-center gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 rounded-md"
                  >
                    <Icon name="i-lucide-activity" class="size-3" />
                    {{ formatCurrency(getEffectiveSimCep(car) - Number(car.highestBid)) }}
                  </div>
                </Transition>
              </div>
            </TableCell>

            <!-- Inflated CEP -->
            <TableCell class="text-xs whitespace-nowrap align-middle">
              <div class="flex flex-col items-center gap-1 min-h-[36px] justify-center">
                <span class="tabular-nums transition-all" :class="hasSimulation(car) ? 'text-muted-foreground line-through opacity-50' : 'text-muted-foreground'">
                  {{ getInflatedCep(car) ? formatCurrency(getInflatedCep(car)) : '—' }}
                </span>
                <Transition
                  enter-active-class="transition-all duration-300 ease-out"
                  enter-from-class="opacity-0 -translate-y-2 scale-95"
                  enter-to-class="opacity-100 translate-y-0 scale-100"
                  leave-active-class="transition-all duration-200 ease-in"
                  leave-from-class="opacity-100"
                  leave-to-class="opacity-0 scale-95"
                >
                  <div
                    v-if="hasSimulation(car)"
                    class="text-[11px] px-2 py-0.5 font-bold tabular-nums whitespace-nowrap flex items-center gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 rounded-md"
                  >
                    <Icon name="i-lucide-activity" class="size-3" />
                    {{ formatCurrency(getSimulatedInflatedCep(car)) }}
                  </div>
                </Transition>
              </div>
            </TableCell>

            <!-- Deflated HB -->
            <TableCell class="text-xs whitespace-nowrap align-middle">
              <div class="flex flex-col items-center gap-1 min-h-[36px] justify-center">
                <span class="tabular-nums transition-all" :class="hasMarginSimulation(car) ? 'text-muted-foreground line-through opacity-50' : 'text-muted-foreground'">
                  {{ getNetBidAmount(car) ? formatCurrency(getNetBidAmount(car)) : '—' }}
                </span>
                <Transition
                  enter-active-class="transition-all duration-300 ease-out"
                  enter-from-class="opacity-0 -translate-y-2 scale-95"
                  enter-to-class="opacity-100 translate-y-0 scale-100"
                  leave-active-class="transition-all duration-200 ease-in"
                  leave-from-class="opacity-100"
                  leave-to-class="opacity-0 scale-95"
                >
                  <div
                    v-if="hasMarginSimulation(car)"
                    class="text-[11px] px-2 py-0.5 font-bold tabular-nums whitespace-nowrap flex items-center gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 rounded-md"
                  >
                    <Icon name="i-lucide-activity" class="size-3" />
                    {{ formatCurrency(getSimulatedNetBid(car)) }}
                  </div>
                </Transition>
              </div>
            </TableCell>

            <!-- Inflated GAP (Act CEP - Deflated HB) -->
            <TableCell class="text-xs whitespace-nowrap align-middle">
              <div class="flex flex-col items-center gap-1 min-h-[36px] justify-center">
                <span v-if="Number(car.customerExpectedPrice) && getNetBidAmount(car)" class="tabular-nums font-bold transition-all" :class="[hasSimulation(car) ? 'text-muted-foreground line-through opacity-50' : '', (Number(car.customerExpectedPrice) - getNetBidAmount(car)) > 0 ? 'text-red-500' : 'text-emerald-500']">
                  {{ formatCurrency(Number(car.customerExpectedPrice) - getNetBidAmount(car)) }}
                </span>
                <span v-else class="text-muted-foreground">—</span>
                <Transition
                  enter-active-class="transition-all duration-300 ease-out"
                  enter-from-class="opacity-0 -translate-y-2 scale-95"
                  enter-to-class="opacity-100 translate-y-0 scale-100"
                  leave-active-class="transition-all duration-200 ease-in"
                  leave-from-class="opacity-100"
                  leave-to-class="opacity-0 scale-95"
                >
                  <div
                    v-if="hasSimulation(car)"
                    class="text-[11px] px-2 py-0.5 font-bold tabular-nums whitespace-nowrap flex items-center gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 rounded-md"
                  >
                    <Icon name="i-lucide-activity" class="size-3" />
                    {{ formatCurrency(getEffectiveSimCep(car) - (hasMarginSimulation(car) ? getSimulatedNetBid(car) : getNetBidAmount(car))) }}
                  </div>
                </Transition>
              </div>
            </TableCell>

            <!-- Margin Simulation -->
            <TableCell class="text-xs text-center px-1">
              <div class="min-h-[32px] min-w-[70px] flex items-center justify-center p-1 rounded group transition-colors relative" :class="isEditing(car, 'marginSimulation') ? '' : 'hover:bg-muted/30'">
                <div v-if="!isEditing(car, 'marginSimulation')" class="flex flex-col items-center gap-1 w-full">
                  <span v-if="hasMarginSimulation(car)" class="font-bold text-primary bg-primary/10 px-2.5 py-0.5 tabular-nums rounded cursor-pointer" @click="startSimulation(car)">
                    {{ getMarginSimValue(car) }}%
                  </span>
                  <span v-else class="text-muted-foreground/40">—</span>
                  <button
                    class="inline-flex items-center gap-1 px-2 py-[3px] rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all border"
                    :class="hasMarginSimulation(car)
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800'
                      : 'bg-violet-50 hover:bg-violet-100 text-violet-600 border-violet-200 dark:bg-violet-950/40 dark:hover:bg-violet-950/60 dark:text-violet-400 dark:border-violet-800'"
                    @click.stop="startSimulation(car)"
                  >
                    <Icon name="i-lucide-activity" class="size-3" />
                    {{ hasMarginSimulation(car) ? 'Adjust' : 'Simulate' }}
                  </button>
                </div>
                <div v-else class="flex items-center gap-1.5">
                  <div class="flex items-center gap-1 bg-muted/30 p-0.5 rounded-full border shadow-sm">
                    <button class="size-6 flex items-center justify-center rounded-full bg-background hover:bg-red-50 hover:text-red-600 transition-colors shadow-sm border border-border/50 text-muted-foreground" @click.stop="stepSimulation(car, -0.5)">
                      <Icon name="i-lucide-minus" class="size-3" />
                    </button>
                    <div class="font-bold tabular-nums text-[11px] text-primary min-w-[36px] text-center">
                      {{ getMarginSimValue(car) }}%
                    </div>
                    <button class="size-6 flex items-center justify-center rounded-full bg-background hover:bg-emerald-50 hover:text-emerald-600 transition-colors shadow-sm border border-border/50 text-muted-foreground" @click.stop="stepSimulation(car, 0.5)">
                      <Icon name="i-lucide-plus" class="size-3" />
                    </button>
                  </div>
                  <div class="flex flex-col gap-1">
                    <button
                      class="size-5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-sm transition-colors"
                      title="Save simulation"
                      @click.stop="stopEdit(car, 'marginSimulation'); saveSimulation(car)"
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

            <!-- Re-Set Var. Margin -->
            <TableCell class="text-xs text-center px-1">
              <div class="min-h-[36px] min-w-[80px] flex flex-col items-center justify-center gap-1 p-1 group rounded relative" :class="resetVarEditing[car._id || car.id] ? '' : 'hover:bg-muted/30 cursor-pointer'" @click="!resetVarEditing[car._id || car.id] && openResetVar(car)">
                <!-- Display: current variableMargin -->
                <template v-if="!resetVarEditing[car._id || car.id]">
                  <div class="flex flex-row items-center justify-center gap-1.5 w-full">
                    <span v-if="Number(String(car.variableMargin || '').replace(/[^0-9.-]/g, ''))" class="font-bold text-xs tabular-nums text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-2.5 py-0.5 rounded border border-violet-200 dark:border-violet-800">
                      {{ Number(String(car.variableMargin || '0').replace(/[^0-9.-]/g, '')) }}%
                    </span>
                    <span v-else class="text-muted-foreground/40">—</span>
                    <Icon name="i-lucide-arrow-down-to-dot" class="size-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </template>
                <!-- Edit mode: inline input + confirm -->
                <template v-else>
                  <div class="flex flex-col items-center gap-1 w-full">
                    <div class="text-[9px] text-muted-foreground font-medium">
                      Max: {{ Number(String(car.variableMargin || '0').replace(/[^0-9.-]/g, '')) }}%
                    </div>
                    <div class="flex items-center gap-2">
                      <!-- Input pill wrapper -->
                      <div class="flex items-center bg-violet-50 dark:bg-violet-950/20 px-1 py-0.5 rounded-md border" :class="Number(resetVarValue[car._id || car.id]) <= 0 || Number(resetVarValue[car._id || car.id]) >= Number(String(car.variableMargin || '0').replace(/[^0-9.-]/g, '')) ? 'border-red-300 dark:border-red-800' : 'border-violet-200 dark:border-violet-800'">
                        <input
                          v-model="resetVarValue[car._id || car.id]"
                          type="number"
                          step="0.01"
                          min="0.01"
                          :max="Number(String(car.variableMargin || '0').replace(/[^0-9.-]/g, '')) - 0.01"
                          class="h-6 w-16 text-[12px] font-bold text-center font-mono bg-transparent outline-none text-violet-700 dark:text-violet-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          autofocus
                          @keydown.enter.stop="confirmResetVar(car)"
                          @keydown.esc.stop="closeResetVar(car)"
                          @click.stop
                        >
                      </div>

                      <!-- Action buttons -->
                      <div class="flex items-center gap-1">
                        <button
                          class="size-6 rounded-md flex items-center justify-center shadow-sm transition-colors"
                          :class="resetVarSaving[car._id || car.id] || Number(resetVarValue[car._id || car.id]) <= 0 || Number(resetVarValue[car._id || car.id]) >= Number(String(car.variableMargin || '0').replace(/[^0-9.-]/g, '')) ? 'bg-muted text-muted-foreground' : 'bg-violet-600 hover:bg-violet-700 text-white'"
                          title="Save variable margin"
                          :disabled="resetVarSaving[car._id || car.id] || Number(resetVarValue[car._id || car.id]) <= 0 || Number(resetVarValue[car._id || car.id]) >= Number(String(car.variableMargin || '0').replace(/[^0-9.-]/g, ''))"
                          @click.stop="confirmResetVar(car)"
                        >
                          <Icon v-if="resetVarSaving[car._id || car.id]" name="i-lucide-loader-2" class="size-3 animate-spin" />
                          <Icon v-else name="i-lucide-check" class="size-3.5" />
                        </button>
                        <button
                          class="size-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors border border-transparent hover:border-border"
                          title="Cancel"
                          @click.stop="closeResetVar(car)"
                        >
                          <Icon name="i-lucide-x" class="size-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </TableCell>

            <!-- Act Bids -->
            <TableCell class="text-xs text-center px-1">
              <Button variant="outline" class="h-6 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 border-blue-200 text-[10px] uppercase font-bold tracking-wider rounded-md" @click.stop="fetchAndShowBids(car)">
                <Icon name="i-lucide-gavel" class="mr-1 size-3" />
                View
              </Button>
            </TableCell>

            <!-- Auto Bid -->
            <TableCell class="text-xs font-bold text-blue-600 tabular-nums text-center">
              <div v-if="getHighestAutoBidObj(car)" class="flex flex-col gap-0.5 items-center">
                <span v-if="getHighestAutoBidObj(car).dealerName" class="text-[10px] text-muted-foreground font-semibold capitalize whitespace-nowrap">{{ String(getHighestAutoBidObj(car).dealerName).toLowerCase() }}</span>
                <span>{{ formatCurrency(getHighestAutoBidObj(car).maxAmount) }}</span>
                <span v-if="getHighestAutoBidObj(car).kamName" class="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium capitalize whitespace-nowrap">{{ String(getHighestAutoBidObj(car).kamName).toLowerCase() }}</span>
              </div>
              <span v-else>—</span>
            </TableCell>

            <!-- Overall Bids -->
            <TableCell class="text-[11px] font-mono text-center font-semibold text-foreground/80 tracking-wide">
              <template v-if="isStatsLoading">
                <Icon name="i-lucide-loader-2" class="size-3 animate-spin inline-block text-muted-foreground opacity-50" />
              </template>
              <template v-else>
                {{ bidStats[String(car.id || car._id)]?.totalBids || 0 }} <span class="mx-0.5 text-muted-foreground/50">/</span> {{ bidStats[String(car.id || car._id)]?.uniqueDealers || 0 }}
              </template>
            </TableCell>

            <!-- RA (Retail Associate) -->
            <TableCell class="text-xs align-middle px-1">
              <div class="min-h-[36px] flex flex-col items-center justify-center gap-1 group rounded relative" :class="raEditing[car._id || car.id] || loggedInUserRole !== 'Admin' ? '' : 'hover:bg-muted/30 cursor-pointer'" @click="!raEditing[car._id || car.id] && openRa(car)">
                <template v-if="!raEditing[car._id || car.id]">
                  <div class="flex items-center gap-1.5 font-medium whitespace-nowrap text-emerald-700 dark:text-emerald-300" title="Retail Associate">
                    <span>{{ resolveUserNameByEmail(car.retailAssociate) || '—' }}</span>
                    <Icon v-if="loggedInUserRole === 'Admin'" name="i-lucide-pencil" class="size-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </template>
                <template v-else>
                  <div class="flex flex-col items-center gap-1 w-full relative z-10" @click.stop>
                    <div class="relative bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-md shadow-sm transition-all shadow-emerald-500/10 w-[110px]">
                      <select
                        v-model="raValue[car._id || car.id]"
                        class="w-full bg-transparent text-emerald-700 dark:text-emerald-300 font-bold text-[10px] outline-none focus:ring-0 px-2 py-1 appearance-none cursor-pointer"
                        @change="confirmRa(car)"
                      >
                        <option value="">
                          Unassigned
                        </option>
                        <option v-for="user in retailersList" :key="user.email" :value="user.email || user.userName">
                          {{ user.fullName || user.userName || user.email }}
                        </option>
                      </select>
                      <Icon name="i-lucide-chevron-down" class="size-3 text-emerald-600/50 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <div class="flex items-center gap-1 mt-0.5 justify-center">
                      <button class="size-[20px] flex items-center justify-center rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors shadow-sm border border-emerald-200" @click.stop="confirmRa(car)">
                        <Icon v-if="raSaving[car._id || car.id]" name="i-lucide-loader-2" class="size-2.5 animate-spin" />
                        <Icon v-else name="i-lucide-check" class="size-2.5" />
                      </button>
                      <button class="size-[20px] flex items-center justify-center rounded-full bg-background hover:bg-muted text-muted-foreground transition-colors shadow-sm border border-border" @click.stop="closeRa(car)">
                        <Icon name="i-lucide-x" class="size-2.5" />
                      </button>
                    </div>
                  </div>
                </template>
              </div>
            </TableCell>

            <!-- Deal Status -->
            <TableCell class="text-xs text-center px-1">
              <div class="flex flex-col items-center justify-center gap-1.5 py-2 min-h-[40px]">
                <!-- TOP ROW: Date & Time -->
                <div v-if="car.dealStatus === 'Under Negotiation'" class="w-full flex justify-center">
                  <Input v-if="isEditing(car, 'followupTimeStamp')" v-model="car.followupTimeStamp" type="datetime-local" autofocus class="h-[24px] w-[140px] text-[10px] px-1 bg-card shadow-sm border-border" @blur="stopEdit(car, 'followupTimeStamp')" @keydown.enter="stopEdit(car, 'followupTimeStamp')" />
                  <button v-else class="hover:opacity-80 transition-opacity flex justify-center w-[140px]" title="Edit Followup Time" @click="startEdit(car, 'followupTimeStamp')">
                    <div v-if="car.followupTimeStamp" class="w-full px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase border border-transparent shadow-sm whitespace-nowrap flex items-center justify-center gap-1" :class="getFollowupBgColor(car.followupTimeStamp)">
                      <Icon name="i-lucide-calendar-clock" class="size-3 shrink-0" />
                      {{ formatDateTimeStr(car.followupTimeStamp) }}
                    </div>
                    <div v-else class="w-full px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border border-dashed border-border/70 text-muted-foreground bg-muted hover:bg-muted/60 shadow-sm transition-colors whitespace-nowrap flex items-center justify-center">
                      + Set Followup Time
                    </div>
                  </button>
                </div>

                <!-- MIDDLE ROW: Deal Status Dropdown -->
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <button
                      class="relative px-2 py-1 flex items-center justify-center gap-1.5 w-[140px] rounded text-[10px] uppercase font-bold tracking-wider transition-colors border shadow-sm z-10"
                      :class="!car.dealStatus ? 'border-dashed border-border/60 hover:bg-muted text-muted-foreground' : 'text-white border-transparent shadow-sm'"
                      :style="car.dealStatus ? { backgroundColor: getOptionMeta('Deal Status', car.dealStatus).color || '#27272a' } : {}"
                    >
                      <Icon v-if="car.dealStatus && getOptionMeta('Deal Status', car.dealStatus).icon" :name="getOptionMeta('Deal Status', car.dealStatus).icon" class="size-3 shrink-0 z-10" />
                      <span class="truncate z-10">{{ car.dealStatus || 'Set Status' }}</span>
                      <Icon name="i-lucide-chevron-down" class="size-3 opacity-50 shrink-0 ml-0.5 z-10" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" class="w-40 min-w-[140px]">
                    <DropdownMenuItem
                      v-for="opt in getOptions('Deal Status')"
                      :key="opt.value"
                      class="text-xs cursor-pointer font-medium flex items-center gap-2"
                      @click="updateDealStatus(car, opt.value)"
                    >
                      <Icon v-if="opt.icon" :name="opt.icon" class="size-3 shrink-0" :style="{ color: opt.color || '#27272a' }" />
                      <span v-else class="size-2 rounded-full shrink-0" :style="{ backgroundColor: opt.color || '#27272a' }" />
                      {{ opt.label }}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator v-if="getOptions('Deal Status').length" />
                    <DropdownMenuItem class="text-xs cursor-pointer text-muted-foreground italic" @click="updateDealStatus(car, '')">
                      Clear Status
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <!-- BOTTOM ROW: Counter -->
                <div v-if="car.dealStatus === 'Under Negotiation' && car.followupTimeStamp && !isEditing(car, 'followupTimeStamp')" class="w-full flex justify-center">
                  <div class="w-[140px] px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-transparent shadow-sm whitespace-nowrap flex items-center justify-center" :class="getFollowupBgColor(car.followupTimeStamp)">
                    {{ formatCountdown(car.followupTimeStamp, 'OVERDUE') }}
                  </div>
                </div>
              </div>
            </TableCell>

            <!-- Quality -->
            <TableCell class="whitespace-nowrap text-[11px] text-center text-muted-foreground">
              {{ car.retailQuality || car.quality || '—' }}
            </TableCell>

            <!-- Remarks -->
            <TableCell class="text-xs text-center px-1">
              <div class="min-h-[28px] min-w-[60px] flex items-center justify-center cursor-pointer group/cell rounded hover:bg-muted/50 transition-colors" @click="openRemarks(car)">
                <HoverCard v-if="car.remarks" :open-delay="200" :close-delay="100">
                  <HoverCardTrigger as-child>
                    <div class="px-2 py-0.5 border border-dashed rounded text-[10px] bg-muted/50 text-muted-foreground flex items-center gap-1.5 cursor-pointer max-w-[80px]">
                      <Icon name="i-lucide-message-square-text" class="size-3 text-emerald-600 dark:text-emerald-400" />
                      <span class="truncate">View</span>
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent side="left" :side-offset="15" class="w-72 p-4 border shadow-2xl rounded-xl text-left whitespace-pre-wrap text-xs text-foreground leading-relaxed bg-card z-[100]" avoid-collisions>
                    {{ car.remarks }}
                  </HoverCardContent>
                </HoverCard>
                <Icon v-else name="i-lucide-pencil" class="size-3 text-muted-foreground/40 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
              </div>
            </TableCell>

            <!-- CEP vs PD — Bucket Analysis -->
            <TableCell class="whitespace-nowrap text-center px-1">
              <HoverCard v-if="getCepPdBucket(car)" :open-delay="200" :close-delay="100">
                <HoverCardTrigger as-child>
                  <div
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider cursor-pointer border shadow-sm transition-all hover:scale-105"
                    :class="[getCepPdBucket(car)!.bg, getCepPdBucket(car)!.text, getCepPdBucket(car)!.border]"
                  >
                    <Icon name="i-lucide-layers" class="size-3 shrink-0" />
                    {{ getCepPdBucket(car)!.label }}
                  </div>
                </HoverCardTrigger>
                <HoverCardContent side="left" :side-offset="15" class="w-80 p-0 border shadow-2xl rounded-xl bg-card z-[100] overflow-hidden" avoid-collisions>
                  <div class="p-3 border-b" :class="[getCepPdBucket(car)!.bg, getCepPdBucket(car)!.text]">
                    <div class="flex items-center gap-2 font-bold text-sm">
                      <Icon name="i-lucide-layers" class="size-4" />
                      {{ getCepPdBucket(car)!.label }}
                    </div>
                  </div>
                  <div class="p-4 space-y-3 text-xs">
                    <div class="grid grid-cols-2 gap-2">
                      <div class="space-y-1 p-2 rounded-lg bg-muted/40 border">
                        <span class="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Act CEP</span>
                        <div class="font-bold text-foreground tabular-nums">{{ formatCurrency(car.customerExpectedPrice || car.cep) }}</div>
                      </div>
                      <div class="space-y-1 p-2 rounded-lg bg-muted/40 border">
                        <span class="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Price Discovery</span>
                        <div class="font-bold text-foreground tabular-nums">{{ formatCurrency(car.priceDiscovery) }}</div>
                      </div>
                      <div class="space-y-1 p-2 rounded-lg bg-muted/40 border">
                        <span class="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Act Bid (HB)</span>
                        <div class="font-bold text-foreground tabular-nums">{{ formatCurrency(car.highestBid) }}</div>
                      </div>
                      <div class="space-y-1 p-2 rounded-lg bg-muted/40 border">
                        <span class="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">CEP / PD</span>
                        <div class="font-bold text-foreground tabular-nums">{{ Number(car.priceDiscovery) ? ((Number(car.customerExpectedPrice || car.cep) / Number(car.priceDiscovery)) * 100).toFixed(1) : '—' }}%</div>
                      </div>
                    </div>
                    <div class="text-[10px] text-muted-foreground leading-relaxed border-t pt-3 space-y-1.5">
                      <div class="flex items-start gap-2">
                        <span class="inline-block size-2 rounded-full bg-red-600 mt-1 shrink-0" />
                        <span><strong>Retail Bucket:</strong> Act Bid &amp; CEP &gt; PD</span>
                      </div>
                      <div class="flex items-start gap-2">
                        <span class="inline-block size-2 rounded-full bg-emerald-700 mt-1 shrink-0" />
                        <span><strong>High Probability:</strong> Act Bid &gt; PD, CEP &lt; PD</span>
                      </div>
                      <div class="flex items-start gap-2">
                        <span class="inline-block size-2 rounded-full bg-emerald-400 mt-1 shrink-0" />
                        <span><strong>Sales Bucket:</strong> Act Bid &lt; PD, CEP &lt; PD</span>
                      </div>
                      <div class="flex items-start gap-2">
                        <span class="inline-block size-2 rounded-full bg-blue-600 mt-1 shrink-0" />
                        <span><strong>Sales &amp; Retail:</strong> Act Bid &lt; PD, CEP &gt; PD</span>
                      </div>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
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
          <TableHeader class="sticky top-0 z-50 bg-background border-b border-border shadow-sm">
            <TableRow>
              <TableHead class="w-16 text-center">
                #
              </TableHead>
              <TableHead>Execution Time</TableHead>
              <TableHead>Bid Amount</TableHead>
              <TableHead>Dealer / Buyer</TableHead>
              <TableHead>KAM</TableHead>
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
                {{ formatCurrency(Math.ceil(Number(bid.bidAmount || bid.amount) / 1000) * 1000) }}
              </TableCell>
              <TableCell>
                <div v-if="bid.dealer" class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold capitalize">{{ String(bid.dealer.shopName || bid.dealer.fullName || 'Unknown Dealer').toLowerCase() }}</span>
                  <span v-if="bid.dealer.shopName && bid.dealer.fullName" class="text-[10px] text-muted-foreground w-max uppercase tracking-wider">{{ bid.dealer.fullName }}</span>
                </div>
                <span v-else class="text-muted-foreground italic text-xs">Unregistered User</span>
              </TableCell>
              <TableCell>
                <div v-if="bid.dealer?.kamName || bid.dealer?.assignedKam" class="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <span class="capitalize">{{ String(bid.dealer.kamName || bid.dealer.assignedKam).toLowerCase() }}</span>
                </div>
                <span v-else class="text-muted-foreground">—</span>
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

  <!-- Add Remarks Dialog -->
  <Dialog :open="isRemarksOpen" @update:open="isRemarksOpen = $event">
    <DialogContent class="sm:max-w-[400px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon name="i-lucide-message-square-text" class="size-4 text-emerald-600" />
          Admin Remarks
        </DialogTitle>
        <DialogDescription class="text-xs">
          Add specific comments or handover notes for this vehicle.
        </DialogDescription>
      </DialogHeader>
      <div class="py-4">
        <Textarea
          v-model="tempRemarks"
          placeholder="Type your remarks here..."
          class="min-h-[150px] text-sm resize-none"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" size="sm" @click="isRemarksOpen = false">
          Cancel
        </Button>
        <Button size="sm" @click="saveRemarks">
          Save Remarks
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Set Followup Dialog for Under Negotiation -->
  <Dialog
    :open="isFollowupDialogOpen" @update:open="(val) => {
      if (!val)
        cancelFollowup(); else isFollowupDialogOpen = val
    }"
  >
    <DialogContent class="sm:max-w-[400px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon name="i-lucide-calendar-clock" class="size-4 text-blue-600" />
          Set Followup Date & Time
        </DialogTitle>
        <DialogDescription class="text-xs">
          Set a followup date and time for "Under Negotiation" status.
        </DialogDescription>
      </DialogHeader>
      <div class="py-4">
        <Input v-model="tempFollowupDate" type="datetime-local" class="w-full" />
      </div>
      <DialogFooter>
        <Button variant="outline" size="sm" @click="cancelFollowup">
          Cancel
        </Button>
        <Button size="sm" @click="confirmFollowup">
          <Icon name="i-lucide-check" class="mr-1 size-3.5" />
          Confirm
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
@keyframes indeterminate {
  0% { transform: translateX(-100%) scaleX(0.2); }
  50% { transform: translateX(0%) scaleX(0.5); }
  100% { transform: translateX(200%) scaleX(0.2); }
}
</style>
