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

// ─── Logged-in user ID (from auth cookie) ───
const _userCookie = useCookie('userData')
const loggedInUserId = computed(() => {
  try {
    const parsed = typeof _userCookie.value === 'string' ? JSON.parse(_userCookie.value) : _userCookie.value
    return parsed?._id || parsed?.id || ''
  }
  catch {
    return ''
  }
})

const { allCars, isLoading, isFetched, fetchError, fetchAllCars, refreshCars, globalSearch } = useAuctionsApi()
const { dropdowns, fetchDropdowns, getOptions } = useDropdowns()

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

function buildLog(fieldKey: string, newValue: any, oldValue: any) {
  return {
    updatedAt: new Date().toISOString(),
    updatedBy: 'Adeel Jabbar',
    fieldChanged: String(fieldKey || ''),
    oldValue: String(oldValue || ''),
    newValue: String(newValue || ''),
  }
}

function formatDateDMY(dateStr: string) {
  if (!dateStr)
    return '—'
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dateStr
}

function formatDateTimeStr(val: string) {
  if (!val)
    return ''
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
  catch (e) { return val }
}

function getFollowupBgColor(tsStr: string) {
  if (!tsStr)
    return ''
  const dateStr = tsStr.split('T')[0] || ''
  const today = new Date()
  const todayStr = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0] || ''

  if (!dateStr || !todayStr)
    return ''

  if (dateStr > todayStr)
    return 'bg-blue-600 text-white border-transparent'
  if (dateStr === todayStr)
    return 'bg-green-600 text-white border-transparent'
  return 'bg-red-600 text-white border-transparent'
}

const isRemarksOpen = ref(false)
const selectedCarForRemarks = ref<any>(null)
const tempRemarks = ref('')

function openRemarks(car: any) {
  selectedCarForRemarks.value = car
  tempRemarks.value = car.remarks || ''
  isRemarksOpen.value = true
}

function saveRemarks() {
  if (!selectedCarForRemarks.value)
    return
  const original = selectedCarForRemarks.value.remarks || ''
  const newVal = tempRemarks.value
  if (original !== newVal) {
    updateCarField(selectedCarForRemarks.value, 'remarks', newVal, original)
  }
  selectedCarForRemarks.value.remarks = newVal
  isRemarksOpen.value = false
}

const isImageModalOpen = ref(false)
const selectedImageCar = ref<any>(null)
const imageCarDetails = ref<any>(null)
const isFetchingImageDetails = ref(false)

async function openImageModal(car: any) {
  selectedImageCar.value = car
  isImageModalOpen.value = true
  imageCarDetails.value = null

  if (car.appointmentId) {
    try {
      isFetchingImageDetails.value = true
      const res = await $fetch<any>(`/api/leads/${car.appointmentId}`)
      if (res && res.carDetails) {
        imageCarDetails.value = res.carDetails
      }
    }
    catch (e) {}
    finally {
      isFetchingImageDetails.value = false
    }
  }
}

const isHistoryOpen = ref(false)
const selectedCarForHistory = ref<any>(null)

function viewHistory(car: any) {
  selectedCarForHistory.value = car
  isHistoryOpen.value = true
}

const isFollowupDialogOpen = ref(false)
const pendingFollowupCar = ref<any>(null)
const tempFollowupDate = ref('')

async function updateDealStatus(car: any, newStatus: string) {
  if (car.dealStatus === newStatus)
    return
  if (newStatus === 'Under Negotiation') {
    pendingFollowupCar.value = car
    tempFollowupDate.value = ''
    isFollowupDialogOpen.value = true
    return
  }
  await commitDealStatus(car, newStatus, null)
}

async function commitDealStatus(car: any, newStatus: string, followupTs: string | null) {
  try {
    const oldVal = car.dealStatus
    const log = buildLog('dealStatus', newStatus, oldVal)
    car.dealStatus = newStatus

    if (!car.retailChangeLog)
      car.retailChangeLog = []
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
  catch (err: any) {
    toast.error('Failed to update deal status')
    refreshCars()
  }
}

async function confirmFollowup() {
  if (!tempFollowupDate.value) {
    toast.error('Followup Date & Time is required')
    return
  }
  if (!pendingFollowupCar.value)
    return
  await commitDealStatus(pendingFollowupCar.value, 'Under Negotiation', tempFollowupDate.value)
  isFollowupDialogOpen.value = false
  pendingFollowupCar.value = null
}

function cancelFollowup() {
  isFollowupDialogOpen.value = false
  pendingFollowupCar.value = null
}

async function updateCarField(car: any, fieldKey: string, newValue: any, overrideOldValue?: any) {
  try {
    const oldVal = overrideOldValue !== undefined ? overrideOldValue : car[fieldKey]
    if (oldVal === newValue)
      return
    const log = buildLog(fieldKey, newValue, oldVal)

    car[fieldKey] = newValue

    if (!car.retailChangeLog)
      car.retailChangeLog = []
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
  catch (err: any) {
    toast.error('Failed to update')
    refreshCars()
  }
}

function getOptionMeta(dropdownName: string, value: string) {
  if (!value)
    return {}
  const opts = getOptions(dropdownName) || []
  return opts.find((o: any) => String(o.value) === String(value)) || {}
}

const editingCell = ref<{ id: string, field: string, originalValue: any } | null>(null)

function startEdit(car: any, field: string) {
  editingCell.value = { id: String(car._id || car.id), field, originalValue: car[field] }
}

function stopEdit(car: any, field: string) {
  if (editingCell.value?.id === String(car._id || car.id) && editingCell.value?.field === field) {
    const original = editingCell.value.originalValue
    editingCell.value = null
    if (car[field] !== original) {
      updateCarField(car, field, car[field], original)
    }
  }
}

function cancelEdit(car: any, field: string) {
  if (editingCell.value?.id === String(car._id || car.id) && editingCell.value?.field === field) {
    car[field] = editingCell.value.originalValue
    editingCell.value = null
  }
}

function isEditing(car: any, field: string) {
  return editingCell.value?.id === String(car._id || car.id) && editingCell.value?.field === field
}

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
      ['make', 'model', 'variant', 'registrationNumber', 'inspectionLocation', 'fuelType', 'appointmentId', 'registeredRto', 'registrationState', 'roadTaxValidity', 'ownerSerialNumber'].some(key =>
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


const showBidsPopup = ref(false)
const selectedCarForBids = ref<any>(null)
const bidsLoading = ref(false)
const carBids = ref<any[]>([])

function getNetBidAmount(rawValue: any, sourceInfo?: any, fallbackCar?: any): number {
  if (rawValue == null) {
    return 0
  }
  const baseBid = Number(rawValue) || 0
  if (!baseBid) {
    return 0
  }

  const fixedMarginPct = Number(sourceInfo?.fixedMargin || fallbackCar?.fixedMargin || 0)
  const varMarginStr = String(sourceInfo?.variableMargin || fallbackCar?.variableMargin || '0').replace(/[^0-9.-]/g, '')
  const varMarginPct = Number(varMarginStr) || 0

  const totalMargin = (fixedMarginPct + varMarginPct) / 100.0
  const factor = 1 + totalMargin
  if (factor <= 0) {
    return 0
  }

  const netBid = baseBid / factor
  return Math.floor(netBid / 1000) * 1000
}

function getSimulatedNetBid(car: any): number {
  const baseBid = Number(car.highestBid) || 0
  if (!baseBid) return 0
  
  const simMarginStr = String(car.marginSimulation || '0').replace(/[^0-9.-]/g, '')
  const simMarginPct = Number(simMarginStr) || 0
  
  const totalMargin = simMarginPct / 100.0
  const factor = 1 + totalMargin
  if (factor <= 0) return 0
  
  const netBid = baseBid / factor
  return Math.floor(netBid / 1000) * 1000
}

function startSimulation(car: any) {
  if (car.marginSimulation === undefined || car.marginSimulation === null || car.marginSimulation === '') {
    const fixedMarginPct = Number(car.fixedMargin || 0)
    const varMarginStr = String(car.variableMargin || '0').replace(/[^0-9.-]/g, '')
    const varMarginPct = Number(varMarginStr) || 0
    car.marginSimulation = (fixedMarginPct + varMarginPct).toFixed(1)
  }
  startEdit(car, 'marginSimulation')
}

function stepSimulation(car: any, step: number) {
  const current = Number(car.marginSimulation) || 0
  car.marginSimulation = Math.max(0, current + step).toFixed(1)
}

function resetSimulation(car: any) {
  car.marginSimulation = undefined
  stopEdit(car, 'marginSimulation')
}

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
    // Update locally so UI reflects immediately
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

// ─── Act. CEP ───
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

  if (isNaN(newCep) || newCep < 0) {
    toast.error('Invalid price')
    return
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

async function handleRefresh() {
  await refreshCars()
  toast.success('Retail data refreshed')
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

async function fetchAndShowBids(car: any) {
  selectedCarForBids.value = car
  showBidsPopup.value = true
  bidsLoading.value = true
  carBids.value = []

  try {
    const rawId = car._id?.$oid || car._id || car.id
    const res = await $fetch<any>(`/api/retail/bids?carId=${rawId}`)
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
        <Input v-model="globalSearch" placeholder="Search retail..." class="pl-8 h-8 w-40 text-sm" />
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
          Failed to load retail data
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
          Loading retail data...
        </p>
      </div>
    </div>

    <!-- Table -->
    <div v-else-if="!fetchError" class="flex-1 min-h-0 overflow-hidden flex flex-col">
      <Table container-class="h-full pb-10">
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
              Act. CEP
            </TableHead>
            <TableHead class="whitespace-nowrap">
              OtoBuy
            </TableHead>
            <TableHead class="whitespace-nowrap text-center">
              Deal Price
            </TableHead>
            <TableHead class="whitespace-nowrap text-center">
              HB
            </TableHead>
            <TableHead class="whitespace-nowrap text-center">
              Auto Bid
            </TableHead>
            <TableHead class="whitespace-nowrap text-center">
              GAP
            </TableHead>
            <TableHead class="whitespace-nowrap text-center">
              Overall Bids
            </TableHead>
            <TableHead class="whitespace-nowrap text-center">
              Current Margin
            </TableHead>
            <TableHead class="whitespace-nowrap text-center">
              Margin Simulation
            </TableHead>
            <TableHead class="whitespace-nowrap text-center">
              Re-Set Var. Margin
            </TableHead>
            <TableHead class="whitespace-nowrap text-center">
              Retail Quality
            </TableHead>
            <TableHead class="whitespace-nowrap text-center">
              Sale Reason
            </TableHead>
            <TableHead class="whitespace-nowrap text-center">
              Deal Status
            </TableHead>
            <TableHead class="whitespace-nowrap text-center">
              Tentative Handover Date
            </TableHead>
            <TableHead class="whitespace-nowrap text-center">
              Remarks
            </TableHead>
            <TableHead class="w-10 text-center">
              <Icon name="i-lucide-history" class="size-4" />
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
                  <div class="relative w-20 h-14 rounded-md overflow-hidden bg-muted border cursor-zoom-in" @click="openImageModal(car)">
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
            <!-- Act. CEP Edit Workflow -->
            <TableCell class="text-xs whitespace-nowrap align-middle px-2">
              <div class="min-h-[36px] flex flex-col items-center justify-center gap-1 group rounded relative" :class="cepEditing[car._id || car.id] ? '' : 'hover:bg-muted/30 cursor-pointer'" @click="!cepEditing[car._id || car.id] && openCep(car)">
                
                <template v-if="!cepEditing[car._id || car.id]">
                  <div class="flex items-center gap-1.5 font-medium" title="Actual CEP">
                    <span>{{ car.customerExpectedPrice ? formatCurrency(car.customerExpectedPrice) : '—' }}</span>
                    <Icon name="i-lucide-pencil" class="size-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </template>

                <template v-else>
                  <div class="flex items-center gap-1">
                    <div class="relative bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-full flex items-center px-2 py-0.5 shadow-sm transition-all shadow-teal-500/10">
                      <span class="text-teal-600 dark:text-teal-400 font-bold text-[10px] mr-1">₹</span>
                      <input
                        v-model="cepValue[car._id || car.id]"
                        type="number"
                        class="w-20 bg-transparent text-teal-700 dark:text-teal-300 font-bold tabular-nums text-xs border-none outline-none focus:ring-0 p-0 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder-teal-600/30"
                        placeholder="Price"
                        @keydown.enter="confirmCep(car)"
                        @click.stop
                      >
                    </div>
                    <div class="flex flex-col gap-0.5 bg-muted/30 p-0.5 rounded-full border shadow-sm" @click.stop>
                      <button class="size-[18px] flex items-center justify-center rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors shadow-sm border border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800" @click.stop="confirmCep(car)">
                        <Icon v-if="cepSaving[car._id || car.id]" name="i-lucide-loader-2" class="size-2.5 animate-spin" />
                        <Icon v-else name="i-lucide-check" class="size-2.5" />
                      </button>
                      <button class="size-[18px] flex items-center justify-center rounded-full bg-background hover:bg-muted text-muted-foreground transition-colors shadow-sm border border-border" @click.stop="closeCep(car)">
                        <Icon name="i-lucide-x" class="size-2.5" />
                      </button>
                    </div>
                  </div>
                </template>

              </div>
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
              {{ formatCurrency(getNetBidAmount(car.highestBid, car, car)) }}
            </TableCell>

            <TableCell class="text-xs text-muted-foreground text-center">
              —
            </TableCell>

            <TableCell class="text-xs align-middle">
              <div class="flex flex-col items-center gap-1 w-full justify-center min-h-[44px] relative">
                <span v-if="(Number(car.customerExpectedPrice || 0) && car.highestBid)" class="text-[11px] px-2 py-0.5 min-w-[75px] max-w-fit text-center rounded-md bg-background border border-border/70 shadow-sm font-bold tabular-nums whitespace-nowrap transition-all" :class="Number(car.customerExpectedPrice || 0) - getNetBidAmount(car.highestBid, car, car) > 0 ? 'text-amber-600' : 'text-muted-foreground'">
                  {{ formatCurrency(Number(car.customerExpectedPrice || 0) - getNetBidAmount(car.highestBid, car, car)) }}
                </span>
                <span v-else class="text-muted-foreground/50">—</span>
                
                <Transition
                  enter-active-class="transition-all duration-300 ease-out z-10"
                  enter-from-class="opacity-0 -translate-y-2 scale-95"
                  enter-to-class="opacity-100 translate-y-0 scale-100"
                  leave-active-class="transition-all duration-200 ease-in absolute z-0"
                  leave-from-class="opacity-100 translate-y-0 scale-100"
                  leave-to-class="opacity-0 -translate-y-2 scale-95"
                >
                  <div
                    v-if="car.marginSimulation !== undefined && car.marginSimulation !== null && car.marginSimulation !== ''"
                    class="text-[11px] px-2 py-0.5 min-w-[75px] max-w-fit justify-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 shadow-sm flex items-center gap-1 font-bold tabular-nums whitespace-nowrap"
                  >
                    <Icon name="i-lucide-activity" class="size-3" />
                    {{ formatCurrency(Number(car.customerExpectedPrice || 0) - getSimulatedNetBid(car)) }}
                  </div>
                </Transition>
              </div>
            </TableCell>

            <TableCell class="text-[11px] font-mono text-center font-semibold text-foreground/80 tracking-wide">
              <template v-if="isStatsLoading">
                <Icon name="i-lucide-loader-2" class="size-3 animate-spin inline-block text-muted-foreground opacity-50" />
              </template>
              <template v-else>
                {{ bidStats[String(car.id || car._id)]?.totalBids || 0 }} <span class="mx-0.5 text-muted-foreground/50">/</span> {{ bidStats[String(car.id || car._id)]?.uniqueDealers || 0 }}
              </template>
            </TableCell>

            <!-- Current Margin -->
            <TableCell class="text-xs text-center px-2">
              <template v-if="Number(car.fixedMargin) || Number(String(car.variableMargin || '').replace(/[^0-9.-]/g, ''))">
                <div class="inline-flex flex-col items-center gap-0.5">
                  <div class="flex items-center gap-1 text-[10px] font-semibold tabular-nums">
                    <span class="px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800 whitespace-nowrap">
                      Fix: {{ Number(car.fixedMargin) || 0 }}%
                    </span>
                    <span class="text-muted-foreground/50">+</span>
                    <span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 whitespace-nowrap">
                      Var: {{ Number(String(car.variableMargin || '0').replace(/[^0-9.-]/g, '')) || 0 }}%
                    </span>
                  </div>
                  <span class="text-[11px] font-black tabular-nums text-foreground/80">
                    ({{ (Number(car.fixedMargin) || 0) + (Number(String(car.variableMargin || '0').replace(/[^0-9.-]/g, '')) || 0) }}%)
                  </span>
                </div>
              </template>
              <span v-else class="text-muted-foreground/40">—</span>
            </TableCell>

            <!-- Margin Simulation -->
            <TableCell class="text-xs text-center px-1">
              <div class="min-h-[32px] min-w-[70px] flex items-center justify-center p-1 rounded group transition-colors relative" :class="isEditing(car, 'marginSimulation') ? '' : 'hover:bg-muted/30'">

                <!-- Not Editing State -->
                <div v-if="!isEditing(car, 'marginSimulation')" class="flex items-center gap-1.5 cursor-pointer w-full justify-center" @click="startSimulation(car)">
                  <span v-if="car.marginSimulation !== undefined && car.marginSimulation !== null && car.marginSimulation !== ''" class="font-bold text-primary bg-primary/10 px-2.5 py-0.5 tabular-nums rounded">
                    {{ Number(car.marginSimulation).toFixed(1) }}%
                  </span>
                  <span v-else class="text-muted-foreground/40">—</span>
                  <Icon name="i-lucide-activity" class="size-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <!-- Editing / Stepper State -->
                <div v-else class="flex items-center gap-1.5">
                  <!-- Stepper pill -->
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

                  <!-- Save / Reset action buttons stacked vertically -->
                  <div class="flex flex-col gap-1">
                    <!-- Save (checkmark) -->
                    <button
                      class="size-5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-sm transition-colors"
                      title="Save simulation"
                      @click.stop="stopEdit(car, 'marginSimulation')"
                    >
                      <Icon name="i-lucide-check" class="size-3" />
                    </button>
                    <!-- Reset (X) -->
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
                        />
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

            <!-- Retail Quality -->
            <TableCell class="text-xs text-center px-1">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <button
                    class="relative px-2 py-1 flex items-center justify-center gap-1.5 min-w-[70px] rounded text-[10px] uppercase font-bold tracking-wider transition-colors border"
                    :class="!car.retailQuality ? 'border-dashed border-border/60 hover:bg-muted text-muted-foreground' : 'text-white border-transparent shadow-sm'"
                    :style="car.retailQuality ? { backgroundColor: getOptionMeta('Retail Quality', car.retailQuality).color || '#27272a' } : {}"
                  >
                    <Icon v-if="car.retailQuality && getOptionMeta('Retail Quality', car.retailQuality).icon" :name="getOptionMeta('Retail Quality', car.retailQuality).icon" class="size-3 shrink-0" />
                    <span class="truncate max-w-[80px]">{{ car.retailQuality || 'Set Quality' }}</span>
                    <Icon name="i-lucide-chevron-down" class="size-3 opacity-50 shrink-0 ml-0.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" class="w-40 min-w-[140px]">
                  <DropdownMenuItem
                    v-for="opt in getOptions('Retail Quality')"
                    :key="opt.value"
                    class="text-xs cursor-pointer font-medium flex items-center gap-2"
                    @click="updateCarField(car, 'retailQuality', opt.value)"
                  >
                    <Icon v-if="opt.icon" :name="opt.icon" class="size-3 shrink-0" :style="{ color: opt.color || '#27272a' }" />
                    <span v-else class="size-2 rounded-full shrink-0" :style="{ backgroundColor: opt.color || '#27272a' }" />
                    {{ opt.label }}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator v-if="getOptions('Retail Quality').length" />
                  <DropdownMenuItem class="text-xs cursor-pointer text-muted-foreground italic" @click="updateCarField(car, 'retailQuality', '')">
                    Clear Quality
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>

            <!-- Sale Reason -->
            <TableCell class="text-xs text-center px-1">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <button
                    class="relative px-2 py-1 flex items-center justify-center gap-1.5 min-w-[80px] rounded text-[10px] uppercase font-bold tracking-wider transition-colors border"
                    :class="!car.saleReason ? 'border-dashed border-border/60 hover:bg-muted text-muted-foreground' : 'text-white border-transparent shadow-sm'"
                    :style="car.saleReason ? { backgroundColor: getOptionMeta('Sale Reason', car.saleReason).color || '#27272a' } : {}"
                  >
                    <Icon v-if="car.saleReason && getOptionMeta('Sale Reason', car.saleReason).icon" :name="getOptionMeta('Sale Reason', car.saleReason).icon" class="size-3 shrink-0" />
                    <span class="truncate max-w-[100px]">{{ car.saleReason || 'Set Reason' }}</span>
                    <Icon name="i-lucide-chevron-down" class="size-3 opacity-50 shrink-0 ml-0.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" class="w-48 min-w-[160px]">
                  <DropdownMenuItem
                    v-for="opt in getOptions('Sale Reason')"
                    :key="opt.value"
                    class="text-xs cursor-pointer font-medium flex items-center gap-2"
                    @click="updateCarField(car, 'saleReason', opt.value)"
                  >
                    <Icon v-if="opt.icon" :name="opt.icon" class="size-3 shrink-0" :style="{ color: opt.color || '#27272a' }" />
                    <span v-else class="size-2 rounded-full shrink-0" :style="{ backgroundColor: opt.color || '#27272a' }" />
                    {{ opt.label }}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator v-if="getOptions('Sale Reason').length" />
                  <DropdownMenuItem class="text-xs cursor-pointer text-muted-foreground italic" @click="updateCarField(car, 'saleReason', '')">
                    Clear Reason
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>

            <!-- Deal Status -->
            <TableCell class="text-xs text-center px-1">
              <div class="flex flex-col items-center justify-center gap-1.5 py-2 min-h-[40px]">
                <!-- TOP ROW: Date & Time -->
                <div v-if="car.dealStatus === 'Under Negotiation'" class="w-full flex justify-center">
                  <Input v-if="isEditing(car, 'followupTimeStamp')" v-model="car.followupTimeStamp" type="datetime-local" autofocus class="h-[24px] w-[140px] text-[10px] px-1 bg-card shadow-sm border-border" @blur="stopEdit(car, 'followupTimeStamp')" @keydown.enter="stopEdit(car, 'followupTimeStamp')" @keydown.esc="cancelEdit(car, 'followupTimeStamp')" />
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

            <!-- Tentative Handover Date -->
            <TableCell class="text-xs text-center px-1">
              <div class="min-h-[28px] min-w-[60px] flex items-center justify-center cursor-pointer group rounded hover:bg-muted/50 transition-colors" @click="startEdit(car, 'tentativeHandoverDate')">
                <Input v-if="isEditing(car, 'tentativeHandoverDate')" v-model="car.tentativeHandoverDate" type="date" autofocus class="h-6 w-[130px] text-[10px]" @blur="stopEdit(car, 'tentativeHandoverDate')" @keydown.enter="stopEdit(car, 'tentativeHandoverDate')" @keydown.esc="cancelEdit(car, 'tentativeHandoverDate')" />
                <span v-else-if="car.tentativeHandoverDate" class="whitespace-nowrap">{{ formatDateDMY(car.tentativeHandoverDate) }}</span>
                <Icon v-else name="i-lucide-pencil" class="size-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
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

            <TableCell class="text-xs text-center px-1">
              <Button variant="ghost" size="icon" class="size-7 hover:bg-primary/10 hover:text-primary transition-colors" @click="viewHistory(car)">
                <Icon name="i-lucide-history" class="size-3.5" />
              </Button>
            </TableCell>
          </TableRow>
          <TableRow v-if="paginatedItems.length === 0">
            <TableCell :colspan="['liveAuctionEnded', 'removed', 'sold', 'otobuy'].includes(filterStatus || '') ? 21 : 22" class="h-32 text-center text-muted-foreground bg-muted/10">
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
                {{ formatCurrency(getNetBidAmount(bid.bidAmount || bid.amount, bid, selectedCarForBids)) }}
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

  <!-- Retail History Dialog -->
  <Dialog :open="isHistoryOpen" @update:open="isHistoryOpen = $event">
    <DialogContent class="sm:max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden gap-0 bg-background/95 backdrop-blur-md">
      <div class="px-5 py-4 border-b border-border/50 bg-muted/30 flex items-center justify-between">
        <h2 class="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Icon name="i-lucide-history" class="size-4 text-primary" />
          Retail Modification History
        </h2>
        <Badge v-if="selectedCarForHistory" variant="outline" class="font-mono text-[10px]">
          {{ selectedCarForHistory.vehicleDetails?.make || selectedCarForHistory.legacyCarDetails?.make }}
          {{ selectedCarForHistory.vehicleDetails?.model || selectedCarForHistory.legacyCarDetails?.model }}
        </Badge>
      </div>

      <div class="flex-1 overflow-y-auto p-5 relative">
        <div v-if="!selectedCarForHistory?.retailChangeLog?.length" class="flex flex-col items-center justify-center py-10 opacity-60">
          <Icon name="i-lucide-file-clock" class="size-8 mb-2" />
          <p class="text-xs">
            No retail modifications recorded yet.
          </p>
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="(log, idx) in selectedCarForHistory.retailChangeLog" :key="idx"
            class="bg-muted/20 border border-border/50 rounded-md p-3 relative overflow-hidden group"
          >
            <div class="flex items-center justify-between mb-2 pb-2 border-b border-border/30">
              <div class="flex items-center gap-2">
                <Icon name="i-lucide-user" class="size-3 text-primary opacity-70" />
                <span class="text-xs font-medium">{{ log.updatedBy || 'Unknown User' }}</span>
              </div>
              <span class="text-[10px] font-mono text-muted-foreground bg-muted items-center px-1.5 py-0.5 rounded flex gap-1">
                <Icon name="i-lucide-calendar" class="size-2.5" />
                {{ formatDate(log.updatedAt) }}
              </span>
            </div>
            <div class="flex items-start gap-4">
              <div class="flex flex-col flex-1">
                <span class="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80 mb-0.5">{{ log.fieldChanged.replace(/([A-Z])/g, ' $1').trim() }}</span>
                <div class="flex flex-col sm:flex-row sm:items-start gap-3 mt-1">
                  <span class="text-xs pl-2 border-l-2 border-red-400/50 text-muted-foreground line-through decoration-red-400/50 whitespace-pre-wrap break-words flex-1" :title="log.oldValue || 'Empty'">{{ log.oldValue || '(Empty)' }}</span>
                  <Icon name="i-lucide-arrow-right" class="size-3 text-muted-foreground shrink-0 hidden sm:block mt-1" />
                  <Icon name="i-lucide-arrow-down" class="size-3 text-muted-foreground shrink-0 sm:hidden ml-2" />
                  <span class="text-xs font-semibold pl-2 border-l-2 border-emerald-500 text-foreground whitespace-pre-wrap break-words flex-1" :title="log.newValue || 'Empty'">{{ log.newValue || '(Empty)' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="px-5 py-3 border-t bg-muted/20 flex justify-end">
        <Button variant="outline" size="sm" @click="isHistoryOpen = false">
          Close
        </Button>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Add Remarks Dialog -->
  <Dialog :open="isRemarksOpen" @update:open="isRemarksOpen = $event">
    <DialogContent class="sm:max-w-[400px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon name="i-lucide-message-square-text" class="size-4 text-emerald-600" />
          Retail Remarks
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
  <Dialog :open="isFollowupDialogOpen" @update:open="(val) => { if (!val) cancelFollowup(); else isFollowupDialogOpen = val }">
    <DialogContent class="sm:max-w-[400px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon name="i-lucide-calendar-clock" class="size-4 text-primary" />
          Followup Required
        </DialogTitle>
        <DialogDescription class="text-xs">
          Please select a followup date and time to set this deal as Under Negotiation.
        </DialogDescription>
      </DialogHeader>
      <div class="py-6 flex justify-center">
        <Input v-model="tempFollowupDate" type="datetime-local" class="w-[200px]" autofocus @keydown.enter="confirmFollowup" />
      </div>
      <DialogFooter>
        <Button variant="outline" size="sm" @click="cancelFollowup">
          Cancel
        </Button>
        <Button size="sm" @click="confirmFollowup">
          Set Status & Followup
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Car Pic Details Dialog -->
  <Dialog :open="isImageModalOpen" @update:open="isImageModalOpen = $event">
    <DialogContent class="sm:max-w-[750px] p-0 overflow-hidden bg-background">
      <button class="absolute top-3 right-3 z-50 flex items-center justify-center size-8 rounded-full bg-white/90 hover:bg-white text-black shadow-md border hover:scale-105 transition-all focus:outline-none" @click="isImageModalOpen = false">
        <Icon name="i-lucide-x" class="size-4" />
      </button>
      <div class="flex flex-col md:flex-row h-auto min-h-[350px]">
        <div class="w-full md:w-1/2 bg-muted relative border-r overflow-hidden flex items-center justify-center">
          <img v-if="getFirstImage(selectedImageCar)" :src="getFirstImage(selectedImageCar)!" class="w-full h-full object-cover max-h-[450px]">
          <div v-else class="text-muted-foreground flex flex-col items-center">
            <Icon name="i-lucide-car" class="size-12 opacity-30 mb-2" />
            <span class="text-xs font-semibold">No Image Provided</span>
          </div>
        </div>
        <div class="w-full md:w-1/2 p-6 flex flex-col bg-card">
          <div class="flex items-center gap-2 mb-6 border-b pb-4">
            <Icon name="i-lucide-car-front" class="size-5 text-emerald-600" />
            <h3 class="text-base font-bold">
              {{ selectedImageCar?.make }} {{ selectedImageCar?.model }} <span class="text-xs font-normal text-muted-foreground ml-1">{{ selectedImageCar?.variant }}</span>
            </h3>
          </div>

          <div class="space-y-0 mt-3 flex-1 flex flex-col">
            <div class="border rounded-lg overflow-hidden flex-1 shadow-sm">
              <div class="grid grid-cols-[140px_1fr] border-b">
                <div class="bg-muted/30 p-2.5 text-[10px] font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
                  <Icon name="i-lucide-hash" class="size-3" /> Registration
                </div>
                <div class="p-2.5 text-sm flex items-center">
                  <span class="font-mono bg-muted/60 px-2 py-0.5 rounded border border-border/50 shadow-sm">{{ selectedImageCar?.registrationNumber || selectedImageCar?.teleVehicleRegistrationNumber || imageCarDetails?.registrationNumber || 'Not documented' }}</span>
                </div>
              </div>

              <div class="grid grid-cols-[140px_1fr] border-b">
                <div class="bg-muted/30 p-2.5 text-[10px] font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
                  <Icon name="i-lucide-user" class="size-3" /> Owner
                </div>
                <div class="p-2.5 text-sm font-medium">
                  {{ selectedImageCar?.ownerName || imageCarDetails?.ownerName || imageCarDetails?.registeredOwner || 'Unknown' }}
                </div>
              </div>

              <div class="grid grid-cols-[140px_1fr] border-b">
                <div class="bg-muted/30 p-2.5 text-[10px] font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
                  <Icon name="i-lucide-building-2" class="size-3" /> Hypothecation
                </div>
                <div class="p-2.5 text-sm font-medium capitalize">
                  {{ selectedImageCar?.hypothecationDetails || imageCarDetails?.hypothecationDetails || 'Not Hypothecated' }}
                </div>
              </div>

              <div class="grid grid-cols-[140px_1fr]">
                <div class="bg-muted/30 p-2.5 text-[10px] font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
                  <Icon name="i-lucide-landmark" class="size-3" /> Hypothecated To
                </div>
                <div class="p-2.5 text-sm font-medium capitalize">
                  {{ selectedImageCar?.hypothecatedTo || imageCarDetails?.hypothecatedTo || 'N/A' }}
                </div>
              </div>
            </div>

            <div v-if="isFetchingImageDetails" class="py-4 flex gap-2 items-center text-muted-foreground mt-4 shrink-0">
              <Icon name="i-lucide-loader-2" class="size-4 animate-spin" />
              <span class="text-xs">Connecting to telecalling database...</span>
            </div>
            <div v-else-if="imageCarDetails?.customerContactNumber || selectedImageCar?.customerContactNumber" class="space-y-2 pt-4 border-t mt-4 shrink-0">
              <p class="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1.5">
                Customer Contact
              </p>
              <div class="flex items-center justify-between border rounded-lg p-2.5 bg-muted/20 shadow-sm">
                <div class="flex items-center gap-2.5">
                  <Icon name="i-lucide-phone" class="size-4 text-emerald-600" />
                  <span class="font-mono text-base tracking-tight font-bold">{{ imageCarDetails?.customerContactNumber || selectedImageCar?.customerContactNumber }}</span>
                </div>
                <div class="flex gap-2">
                  <a :href="`tel:${imageCarDetails?.customerContactNumber || selectedImageCar?.customerContactNumber}`" class="size-8 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-700 flex items-center justify-center transition-colors hover:scale-105" title="Call Customer">
                    <Icon name="i-lucide-phone-call" class="size-3.5" />
                  </a>
                  <a :href="`sms:${imageCarDetails?.customerContactNumber || selectedImageCar?.customerContactNumber}`" class="size-8 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 flex items-center justify-center transition-colors hover:scale-105" title="Send SMS">
                    <Icon name="i-lucide-message-square" class="size-3.5" />
                  </a>
                  <a :href="`https://wa.me/${String(imageCarDetails?.customerContactNumber || selectedImageCar?.customerContactNumber).replace(/\D/g, '')}`" target="_blank" class="size-8 rounded-full bg-[#E8F8F0] hover:bg-[#D4F3E3] text-[#25D366] flex items-center justify-center transition-colors hover:scale-105" title="WhatsApp">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>
                  </a>
                </div>
              </div>
            </div>
            <div v-else class="py-5 flex flex-col items-center justify-center text-center text-xs text-muted-foreground border-t mt-4 gap-2 bg-muted/20 rounded-lg shrink-0">
              <Icon name="i-lucide-phone-off" class="size-6 opacity-30" />
              <p>No valid contact details found in telecalling registry</p>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
