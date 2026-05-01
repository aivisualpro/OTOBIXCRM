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
watchEffect(() => {
  setHeader({ title: props.title, description: props.description, icon: props.icon })
})

const { allCars, isLoading, isRefreshing, isFetched, fetchError, fetchCars, refreshCars, globalSearch } = useAuctionsApi()

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

const { activeTab, searchCars, cancelSearch, loadMore, hasMore, isLoadingMore, totalCount, setSimilarSearchCtx, advancedFilters = ref({}), setAdvancedFilters = () => {}, facets = ref({
  makes: [],
  models: [],
  cities: [],
  auctionStatuses: [],
  dealStatuses: [],
  leadSources: [],
  referredBys: [],
  ies: [],
  ras: [],
}) } = useAuctionsApi()

const { makes, getModels, fetchCarDropdowns } = useCarDropdowns()
fetchCarDropdowns()

const router = useRouter()
const route = useRoute()

function handleSimilarSearch(car: any) {
  const clean = (str: string) => String(str || '').replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase()

  const yearStr = String(car.yearMonthOfManufacture || '')
  let year = ''
  const d = new Date(yearStr)
  if (!isNaN(d.getTime())) {
    year = String(d.getFullYear())
  }
  else {
    const m = yearStr.match(/\d{4}/)
    if (m)
      year = m[0]
  }

  setSimilarSearchCtx({
    make: car.make,
    model: car.model,
    year,
  })

  let yearDisplaySlug = year
  const yInt = parseInt(year)
  if (!isNaN(yInt)) {
    yearDisplaySlug = `${yInt - 1}-${yInt}-${yInt + 1}`
  }

  const slug = `similar-search-${clean(car.make)}-${clean(car.model)}-${yearDisplaySlug}`.replace(/-+/g, '-')
  router.push({ query: { ...route.query, tab: slug } })
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
// ==========================================
// Advanced Filter State
// ==========================================
const localFilters = ref({
  make: '',
  model: '',
  city: '',
  auctionStatus: '',
  dealStatus: '',
  leadSource: '',
  referredBy: '',
  ie: '',
  ra: '',
  startDate: '',
  endDate: '',
  datePreset: '',
})

const isAdvancedFilterOpen = ref(false)

const { allUsers, fetchAllUsers } = usePeopleApi()

const userOptions = computed(() => {
  const uniqueRA = facets.value?.ras || []
  const uniqueIE = facets.value?.ies || []

  const emails = Array.from(new Set([...uniqueRA, ...uniqueIE]))
  return emails.map((email) => {
    const u = allUsers.value.find(user => user.email === email)
    if (u)
      return { label: u.userName ? `${u.userName} (${u.userRole || 'User'})` : u.email, value: u.email }
    return { label: email as string, value: email as string }
  }).sort((a, b) => a.label.localeCompare(b.label))
})

const viewMakes = computed(() => (facets.value?.makes || []))
const viewModels = computed(() => (facets.value?.models || []))
const viewCities = computed(() => (facets.value?.cities || []))
const viewAuctionStatuses = computed(() => (facets.value?.auctionStatuses || []))
const viewDealStatuses = computed(() => (facets.value?.dealStatuses || []))
const viewLeadSources = computed(() => (facets.value?.leadSources || []))
const viewReferredBys = computed(() => (facets.value?.referredBys || []))
const viewIEs = computed(() => {
  return (facets.value?.ies || [])
    .map((email: string) => userOptions.value.find(u => u.value === email) || { label: email, value: email })
    .sort((a: any, b: any) => a.label.localeCompare(b.label))
})
const viewRAs = computed(() => {
  return (facets.value?.ras || [])
    .map((email: string) => userOptions.value.find(u => u.value === email) || { label: email, value: email })
    .sort((a: any, b: any) => a.label.localeCompare(b.label))
})

function clearAdvancedFilters() {
  localFilters.value = { make: '', model: '', city: '', auctionStatus: '', dealStatus: '', leadSource: '', referredBy: '', ie: '', ra: '', startDate: '', endDate: '', datePreset: '' }
  setAdvancedFilters({})
}

const activeFilterCount = computed(() => {
  if (!advancedFilters.value)
    return 0
  let count = 0
  let hasDate = false
  for (const [k, v] of Object.entries(advancedFilters.value)) {
    if (!v)
      continue
    if (k === 'startDate' || k === 'endDate' || k === 'datePreset') {
      if (!hasDate) {
        count++
        hasDate = true
      }
    }
    else {
      count++
    }
  }
  return count
})

function setDatePreset(preset: string) {
  const dt = new Date()
  const tzo = dt.getTimezoneOffset() * 60000

  const toLocalISOString = (d: Date) => new Date(d.getTime() - tzo).toISOString().split('T')[0] || ''

  localFilters.value.datePreset = preset

  if (preset === 'Today') {
    localFilters.value.startDate = toLocalISOString(dt)
    localFilters.value.endDate = toLocalISOString(dt)
  }
  else if (preset === 'Yesterday') {
    const yest = new Date(dt)
    yest.setDate(dt.getDate() - 1)
    localFilters.value.startDate = toLocalISOString(yest)
    localFilters.value.endDate = localFilters.value.startDate
  }
  else if (preset === 'Tomorrow') {
    const tmrw = new Date(dt)
    tmrw.setDate(dt.getDate() + 1)
    localFilters.value.startDate = toLocalISOString(tmrw)
    localFilters.value.endDate = localFilters.value.startDate
  }
  else if (preset === 'This Month') {
    const firstDay = new Date(dt.getFullYear(), dt.getMonth(), 1)
    const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0)
    localFilters.value.startDate = toLocalISOString(firstDay)
    localFilters.value.endDate = toLocalISOString(lastDay)
  }
  else if (preset === 'This Year') {
    const firstDay = new Date(dt.getFullYear(), 0, 1)
    const lastDay = new Date(dt.getFullYear(), 11, 31)
    localFilters.value.startDate = toLocalISOString(firstDay)
    localFilters.value.endDate = toLocalISOString(lastDay)
  }
  else if (preset === 'Last Year') {
    const firstDay = new Date(dt.getFullYear() - 1, 0, 1)
    const lastDay = new Date(dt.getFullYear() - 1, 11, 31)
    localFilters.value.startDate = toLocalISOString(firstDay)
    localFilters.value.endDate = toLocalISOString(lastDay)
  }
}

watch(localFilters, (newVal) => {
  const filtersToApply = { ...newVal }
  Object.keys(filtersToApply).forEach((k) => {
    if (filtersToApply[k as keyof typeof filtersToApply] === 'ALL') {
      filtersToApply[k as keyof typeof filtersToApply] = ''
    }
  })

  let changed = false
  for (const k of Object.keys(filtersToApply)) {
    if (filtersToApply[k as keyof typeof filtersToApply] !== ((advancedFilters.value as any)[k] || '')) {
      changed = true
      break
    }
  }

  if (changed) {
    setAdvancedFilters(filtersToApply)
  }
}, { deep: true })

watch(advancedFilters, (val) => {
  if (val && Object.keys(val).length > 0) {
    // Only update localFilters if they differ
    let changed = false
    for (const k of Object.keys(val)) {
      if ((localFilters.value[k as keyof typeof localFilters.value] || '') !== (val as any)[k]) {
        changed = true
        break
      }
    }
    if (changed) {
      localFilters.value = { ...localFilters.value, ...val }
    }
  }
}, { immediate: true, deep: true })

let searchDebounce: ReturnType<typeof setTimeout> | null = null
watch(globalSearch, (newVal) => {
  if (searchDebounce)
    clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    if (newVal && newVal.trim().length > 0) {
      searchCars(newVal.trim())
    }
    else {
      cancelSearch()
    }
  }, 400)
})

function resolveUserNameByEmail(email: string) {
  if (!email)
    return '—'
  const user = allUsers.value.find(u => u.email === email)
  return user?.userName || email
}

onMounted(() => {
  fetchCars()
  fetchBidStats()
  fetchDropdowns()
  fetchAllUsers()
})

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
  catch {
    return value
  }
}

function formatDate(value: string): string {
  if (!value)
    return '—'
  try {
    return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }
  catch {
    return value
  }
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
  timerInterval = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (timerInterval)
    clearInterval(timerInterval)
})

function getFirstImage(car: any): string | null {
  let images: any[] = []
  try {
    if (Array.isArray(car.frontMainImages)) {
      images = car.frontMainImages
    }
    else if (typeof car.frontMainImages === 'string' && car.frontMainImages.startsWith('[')) {
      const parsed = JSON.parse(car.frontMainImages)
      if (Array.isArray(parsed))
        images = parsed
    }
  }
  catch (e) {}

  if (images.length === 0 && Array.isArray(car.frontMain)) {
    images = car.frontMain
  }
  else if (images.length === 0 && typeof car.frontMain === 'string' && car.frontMain.startsWith('[')) {
    try { images = JSON.parse(car.frontMain) }
    catch (e) {}
  }

  for (const item of images) {
    const v = typeof item === 'string' ? item : item?.url
    if (v && typeof v === 'string' && v.trim().length > 5 && v !== 'null') {
      if (v.startsWith('http'))
        return v.trim()
      return `https://res.cloudinary.com/dwunzqigc/image/upload/Otobix%20Auction%20App/Car%20Images/${car.appointmentId}/${v.trim()}`
    }
  }

  if (car.imageUrl && typeof car.imageUrl === 'string' && car.imageUrl.trim().length > 5) {
    return car.imageUrl.trim()
  }

  const all = getAllImages(car)
  return all.length > 0 ? (all[0] ?? null) : null
}

function getAllImages(car: any): string[] {
  const urls = new Set<string>()
  const prefix = `https://res.cloudinary.com/dwunzqigc/image/upload/Otobix%20Auction%20App/Car%20Images/${car.appointmentId}/`

  function scan(value: any, keyName?: string) {
    if (!value)
      return
    if (typeof value === 'string') {
      const v = value.trim()
      if (v === 'null' || v === 'undefined' || v === '[]' || v.length < 5)
        return

      if (v.toLowerCase().endsWith('.pdf') || v.toLowerCase().endsWith('.mp4') || v.toLowerCase().endsWith('.mov'))
        return

      if (v.startsWith('[') && v.endsWith(']')) {
        try {
          const parsed = JSON.parse(v)
          scan(parsed, keyName)
          return
        }
        catch (e) {}
      }

      if (v.startsWith('http')) {
        urls.add(v)
      }
      else if (keyName && (keyName.toLowerCase().includes('image') || keyName.toLowerCase().includes('photo') || keyName.toLowerCase().includes('apron') || keyName.toLowerCase().includes('main'))) {
        urls.add(prefix + v)
      }
      else if (v.toLowerCase().endsWith('.jpg') || v.toLowerCase().endsWith('.jpeg') || v.toLowerCase().endsWith('.png') || v.toLowerCase().endsWith('.webp')) {
        urls.add(prefix + v)
      }
    }
    else if (Array.isArray(value)) {
      value.forEach(item => scan(item, keyName))
    }
    else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        scan(v, k)
      }
    }
  }

  scan(car)
  return Array.from(urls)
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

const simulationTrigger = ref(0)

function getSimulatedInflatedCep(car: any): number {
  void simulationTrigger.value // Track dependency
  const basePrice = Number(car.customerExpectedPrice || car.cep || 0)
  if (!basePrice)
    return 0

  const simMarginStr = String(car.marginSimulation || '0').replace(/[^0-9.-]/g, '')
  const simMarginPct = Number(simMarginStr) || 0

  const rawCep = basePrice + (basePrice * simMarginPct / 100)
  return Math.ceil(rawCep / 1000) * 1000
}

function hasSimulation(car: any) {
  void simulationTrigger.value // Track dependency
  return car.marginSimulation !== undefined && car.marginSimulation !== null && car.marginSimulation !== ''
}

function getSalesOneClickPrice(car: any): number {
  const basePrice = Number(car.oneClickPrice || 0)
  if (!basePrice) {
    return 0
  }

  const fixedMarginPct = Number(car.fixedMargin || 0)
  const varMarginStr = String(car.variableMargin || '0').replace(/[^0-9.-]/g, '')
  const varMarginPct = Number(varMarginStr) || 0

  const raw = basePrice + (basePrice * fixedMarginPct / 100) + (basePrice * varMarginPct / 100)
  return Math.ceil(raw / 1000) * 1000
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

async function shareCarToWhatsApp(car: any) {
  const imageUrl = getFirstImage(car) || ''

  const parts = []
  parts.push(`🚗 *${car.make || ''} ${car.model || ''}*`)
  if (car.variant)
    parts.push(`_${car.variant}_`)
  parts.push('')

  parts.push(`*Specs:*`)
  if (car.registrationDate)
    parts.push(`• Reg: ${formatYear(car.registrationDate)}`)
  if (car.yearMonthOfManufacture)
    parts.push(`• Mfg: ${formatYear(car.yearMonthOfManufacture)}`)
  if (car.odometerReadingInKms)
    parts.push(`• KMS: ${Number(car.odometerReadingInKms).toLocaleString()}`)
  if (car.fuelType)
    parts.push(`• Fuel: ${car.fuelType}`)
  if (car.ownerSerialNumber)
    parts.push(`• Owner: ${car.ownerSerialNumber}`)
  if (car.registeredRto || car.registrationState)
    parts.push(`• Loc: ${car.registeredRto || ''} ${car.registrationState || ''}`.trim())

  if (car.priceDiscovery) {
    parts.push('')
    parts.push(`💰 *Expected Price:* ${formatCurrency(car.priceDiscovery)}`)
  }

  const text = parts.join('\n')
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

  if (isMobile && imageUrl && navigator.share) {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg'
      const file = new File([blob], `${car.make}_${car.model}.${ext}`, { type: blob.type })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${car.make} ${car.model}`,
          text,
        })
        return
      }
    }
    catch (err) {
      console.error('Native share failed:', err)
    }
  }
  else if (!isMobile && imageUrl && navigator.clipboard) {
    try {
      const toastId = toast.loading('Copying image to clipboard...')

      await new Promise<void>((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          if (!ctx)
            return reject(new Error('No canvas context'))

          ctx.drawImage(img, 0, 0)
          canvas.toBlob(async (blob) => {
            if (!blob)
              return reject(new Error('Blob creation failed'))
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob }),
              ])
              resolve()
            }
            catch (err) {
              reject(err)
            }
          }, 'image/png')
        }
        img.onerror = () => reject(new Error('Failed to load image for clipboard'))
        img.src = imageUrl
      })

      toast.dismiss(toastId)
      toast.success('Image copied! Press Cmd+V in WhatsApp to attach the photo.')
    }
    catch (err) {
      console.error('Clipboard copy failed:', err)
      toast.error('Could not copy image automatically. You may need to attach it manually.')
    }
  }

  const fallbackText = encodeURIComponent(text)
  window.open(`https://wa.me/?text=${fallbackText}`, '_blank')
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

async function exportToGoogleSheets() {
  if (!allCars.value || !allCars.value.length) {
    toast.error('No data to export')
    return
  }

  const headers = [
    'Date',
    'App ID',
    'Make',
    'Model',
    'Variant',
    'Fuel',
    'Reg Year',
    'Mfg Year',
    'Odometer (Kms)',
    'Auction Status',
    'PD',
    'CEP',
    'Sim. CEP',
    'HB',
    'Auto Bid',
    'GAP',
    'Overall Bids',
    '1-Clik Price',
    'OtoBuy Offer',
    'Deal Status',
    'RA',
    'Remarks',
  ]

  const rows = allCars.value.map((car: any) => {
    const actCep = car.customerExpectedPrice || car.cep || 0
    const delCep = getInflatedCep(car) || 0
    const hb = car.highestBid || 0
    const gap = delCep ? hb - delCep : 0

    return [
      formatDate((car.approvalDate && car.approvalDate !== 'null') ? car.approvalDate : ((car.auctionStartTime && car.auctionStartTime !== 'null') ? car.auctionStartTime : car.createdAt)) || '',
      car.appointmentId || '',
      car.make || '',
      car.model || '',
      car.variant || '',
      car.fuelType || '',
      formatYear(car.registrationDate) || '',
      formatYear(car.yearMonthOfManufacture) || '',
      car.odometerReadingInKms || '',
      car.auctionStatus || '',
      car.priceDiscovery || '',
      actCep,
      delCep,
      hb,
      getHighestAutoBidObj(car)?.maxAmount || '',
      gap,
      bidStats.value[String(car.id || car._id)]?.totalBids || 0,
      getSalesOneClickPrice(car) || '',
      car.otobuyOffer || '',
      car.dealStatus || '',
      car.retailAssociate || '',
      car.remarks || '',
    ].map(v => String(v).replace(/\t/g, ' ')).join('\t')
  })

  const tsvContent = [headers.join('\t'), ...rows].join('\n')

  try {
    await navigator.clipboard.writeText(tsvContent)
    toast.success('Data copied! Opening Google Sheets... Just press Ctrl+V / Cmd+V')
    setTimeout(() => {
      window.open('https://sheet.new', '_blank')
    }, 1500)
  }
  catch (err) {
    toast.error('Failed to copy data to clipboard. You may need to export as CSV instead.')
  }
}

const isZipping = ref<string>('')

async function loadJSZip(): Promise<any> {
  if ((window as any).JSZip)
    return (window as any).JSZip
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
    script.onload = () => resolve((window as any).JSZip)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

async function downloadImagesZip(car: any) {
  isZipping.value = car.appointmentId || car._id
  toast.info('Fetching full inspection details...')

  let fullCar = car
  try {
    const response = await $fetch<any>(`/api/leads/${car.appointmentId}`)
    if (response && response.carDetails) {
      fullCar = response.carDetails
    }
    else if (response) {
      fullCar = response
    }
  }
  catch (err) {
    console.error('Failed to fetch full car details, falling back to list data', err)
  }

  const images = getAllImages(fullCar)
  if (!images.length) {
    toast.error('No images available for this car')
    isZipping.value = ''
    return
  }

  toast.info(`Zipping ${images.length} images, please wait...`)

  try {
    const JSZipCtor = await loadJSZip()
    const zip = new JSZipCtor()
    const folder = zip.folder(`${car.appointmentId}-images`)

    // Fetch all images concurrently
    const promises = images.map(async (url: string, idx: number) => {
      try {
        const response = await fetch(url)
        const blob = await response.blob()
        const extension = url.split('.').pop()?.split('?')[0] || 'jpg'
        folder?.file(`image-${idx + 1}.${extension}`, blob)
      }
      catch (err) {
        console.error(`Failed to fetch image ${url}`, err)
      }
    })

    await Promise.all(promises)

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${car.appointmentId}-images.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Images downloaded successfully!')
  }
  catch (err) {
    toast.error('Failed to create zip file')
  }
  finally {
    isZipping.value = ''
  }
}
</script>

<template>
  <ClientOnly>
    <HeaderActions>
      <div class="relative ml-auto sm:ml-0 flex items-center gap-2">
        <div class="relative">
          <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input v-model="globalSearch" placeholder="Search sales..." class="pl-8 h-8 w-40 text-sm" />
        </div>
        <Popover v-model:open="isAdvancedFilterOpen">
          <PopoverTrigger as-child>
            <button class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input border-dashed bg-muted/30 hover:bg-muted hover:text-foreground h-8 px-3 gap-1.5 relative pr-6">
              <Icon name="i-lucide-list-filter" class="size-3.5 text-emerald-600" />
              <span class="hidden sm:inline font-medium">Filter</span>
              <span v-if="activeFilterCount > 0" class="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] text-white font-bold ring-2 ring-background">{{ activeFilterCount }}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" class="w-[400px] p-4 rounded-xl shadow-2xl border border-border/50 bg-background/95 backdrop-blur-xl z-[200]">
            <div class="flex items-center justify-between mb-4">
              <h4 class="font-semibold text-sm">
                Advanced Filters
              </h4>
              <Button variant="ghost" size="sm" class="h-6 px-2 text-xs text-muted-foreground hover:text-foreground" @click="clearAdvancedFilters">
                Clear All
              </Button>
            </div>
            <div class="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
              <!-- Date Filters -->
              <div class="space-y-3 pb-2 border-b">
                <Label class="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><Icon name="i-lucide-calendar-days" class="size-3" /> Date Range</Label>
                <div class="flex flex-wrap gap-1.5">
                  <Badge v-for="p in ['Today', 'Yesterday', 'Tomorrow', 'This Month', 'This Year', 'Last Year']" :key="p" variant="secondary" class="cursor-pointer text-[10px] font-normal transition-colors" :class="localFilters.datePreset === p ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/50 text-muted-foreground'" @click="setDatePreset(p)">
                    {{ p }}
                  </Badge>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1.5">
                    <Label class="text-[10px] uppercase text-muted-foreground">From</Label>
                    <Input v-model="localFilters.startDate" type="date" class="h-8 text-xs bg-muted/30 focus:bg-background" @input="localFilters.datePreset = ''" />
                  </div>
                  <div class="space-y-1.5">
                    <Label class="text-[10px] uppercase text-muted-foreground">To</Label>
                    <Input v-model="localFilters.endDate" type="date" class="h-8 text-xs bg-muted/30 focus:bg-background" @input="localFilters.datePreset = ''" />
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <Label class="text-xs font-medium text-muted-foreground">Make</Label>
                  <SearchableSelect
                    v-model="localFilters.make"
                    :options="[{ label: 'Any Make', value: 'ALL' }, ...viewMakes.map((m: any) => ({ label: m, value: m }))]"
                    placeholder="Any Make"
                    :use-pills="false"
                  />
                </div>
                <div class="space-y-1.5">
                  <Label class="text-xs font-medium text-muted-foreground">Model</Label>
                  <SearchableSelect
                    v-model="localFilters.model"
                    :options="[{ label: 'Any Model', value: 'ALL' }, ...viewModels.map((m: any) => ({ label: m, value: m }))]"
                    placeholder="Any Model"
                    :disabled="!localFilters.make || localFilters.make === 'ALL'"
                    :use-pills="false"
                  />
                </div>
                <div class="space-y-1.5">
                  <Label class="text-xs font-medium text-muted-foreground">City</Label>
                  <SearchableSelect
                    v-model="localFilters.city"
                    :options="[{ label: 'Any City', value: 'ALL' }, ...viewCities.map((m: any) => ({ label: m, value: m }))]"
                    placeholder="Any City"
                    :use-pills="false"
                  />
                </div>
                <div class="space-y-1.5">
                  <Label class="text-xs font-medium text-muted-foreground">Auction Status</Label>
                  <SearchableSelect
                    v-model="localFilters.auctionStatus"
                    :options="[{ label: 'Any Status', value: 'ALL' }, ...viewAuctionStatuses.map((m: any) => ({ label: m, value: m }))]"
                    placeholder="Any Status"
                    :use-pills="false"
                  />
                </div>
                <div class="space-y-1.5">
                  <Label class="text-xs font-medium text-muted-foreground">Deal Status</Label>
                  <SearchableSelect
                    v-model="localFilters.dealStatus"
                    :options="[{ label: 'Any Status', value: 'ALL' }, ...viewDealStatuses.map((m: any) => ({ label: m, value: m }))]"
                    placeholder="Any Status"
                    :use-pills="false"
                  />
                </div>
                <div class="space-y-1.5">
                  <Label class="text-xs font-medium text-muted-foreground">Lead Source</Label>
                  <SearchableSelect
                    v-model="localFilters.leadSource"
                    :options="[{ label: 'Any Source', value: 'ALL' }, ...viewLeadSources.map((m: any) => ({ label: m, value: m }))]"
                    placeholder="Any Source"
                    :use-pills="false"
                  />
                </div>
                <div class="space-y-1.5">
                  <Label class="text-xs font-medium text-muted-foreground">Referred By</Label>
                  <SearchableSelect
                    v-model="localFilters.referredBy"
                    :options="[{ label: 'Any Referrer', value: 'ALL' }, ...viewReferredBys.map((m: any) => ({ label: m, value: m }))]"
                    placeholder="Any Referrer"
                    :use-pills="false"
                  />
                </div>
                <div class="space-y-1.5">
                  <Label class="text-xs font-medium text-muted-foreground">IE (Inspector)</Label>
                  <SearchableSelect
                    v-model="localFilters.ie"
                    :options="[{ label: 'Any IE', value: 'ALL' }, ...viewIEs]"
                    placeholder="Any IE"
                    :use-pills="false"
                  />
                </div>
                <div class="space-y-1.5">
                  <Label class="text-xs font-medium text-muted-foreground">RA (Associate)</Label>
                  <SearchableSelect
                    v-model="localFilters.ra"
                    :options="[{ label: 'Any RA', value: 'ALL' }, ...viewRAs]"
                    placeholder="Any RA"
                    :use-pills="false"
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <!-- View in Google Sheets Button -->
        <Button variant="outline" size="icon" class="h-8 w-8 shrink-0 border-dashed bg-[#E8F0FE] hover:bg-[#D2E3FC] text-[#1967D2] hover:text-[#174EA6] border-[#8AB4F8]/50 transition-colors" title="Open in Google Sheets" @click="exportToGoogleSheets">
          <Icon name="i-lucide-file-spreadsheet" class="size-4" />
        </Button>
      </div>
      <p class="text-xs text-muted-foreground tabular-nums hidden sm:block whitespace-nowrap">
        {{ totalCount }} record{{ totalCount !== 1 ? 's' : '' }}
      </p>
      <BaseSyncIndicator :syncing="isRefreshing" />
      <Button variant="ghost" size="sm" class="h-8" :disabled="isLoading" @click="handleRefresh">
        <Icon name="i-lucide-refresh-cw" class="mr-1 size-3.5" :class="{ 'animate-spin': isLoading }" />
        Refresh
      </Button>
    </HeaderActions>
  </ClientOnly>

  <div class="w-full flex flex-col h-full overflow-hidden relative">
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
    <div v-else-if="!fetchError" class="flex-1 min-h-0 overflow-hidden flex flex-col relative">
      <!-- Minimalist loading bar -->
      <div v-if="isRefreshing || isLoadingMore" class="absolute top-0 left-0 right-0 h-[2px] bg-primary/20 overflow-hidden z-30">
        <div class="h-full bg-primary origin-left animate-in fade-in duration-500 rounded-full" style="width: 30%; animation: indeterminate 1.5s infinite linear;" />
      </div>

      <Table container-class="h-full pb-10">
        <TableHeader class="sticky top-0 z-50 bg-background border-b border-border shadow-sm">
          <TableRow>
            <TableHead class="whitespace-nowrap pl-[19px]">
              Date
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Car Pic
            </TableHead>
            <TableHead class="whitespace-nowrap">
              App ID
            </TableHead>
            <TableHead class="whitespace-nowrap sticky left-0 z-50 bg-white dark:bg-[#09090b] border-r border-border/50 shadow-[4px_0_12px_rgba(0,0,0,0.05)]">
              Specs
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Report
            </TableHead>
            <TableHead v-if="!['ended', 'removed', 'sold', 'otobuy'].includes(activeTab)" class="whitespace-nowrap">
              Auction Status
            </TableHead>
            <TableHead class="whitespace-nowrap">
              PD
            </TableHead>
            <TableHead class="whitespace-nowrap">
              CEP
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
            <TableHead class="whitespace-nowrap text-center">
              GAP
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Overall Bids
            </TableHead>
            <TableHead class="whitespace-nowrap">
              1-Clik Price
            </TableHead>
            <TableHead class="whitespace-nowrap">
              OtoBuy Offer
            </TableHead>
            <TableHead class="whitespace-nowrap">
              Deal Status
            </TableHead>
            <TableHead class="whitespace-nowrap">
              RA
            </TableHead>

            <TableHead class="whitespace-nowrap pr-[19px]">
              Remarks
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="car in allCars"
            :key="car.id || car._id"
            class="group hover:bg-muted/50 transition-all duration-300"
          >
            <TableCell class="whitespace-nowrap text-xs text-muted-foreground pl-[19px]">
              {{ formatDate((car.approvalDate && car.approvalDate !== 'null') ? car.approvalDate : ((car.auctionStartTime && car.auctionStartTime !== 'null') ? car.auctionStartTime : car.createdAt)) }}
            </TableCell>
            <TableCell class="w-24">
              <HoverCard :open-delay="200" :close-delay="100">
                <HoverCardTrigger as-child>
                  <div class="relative w-20 h-14 rounded-md overflow-hidden bg-muted border cursor-pointer group/pic" @click.stop="shareCarToWhatsApp(car)">
                    <img v-if="getFirstImage(car)" :src="getFirstImage(car)!" class="size-full object-cover transition-transform duration-300 group-hover/pic:scale-110">
                    <div v-else class="size-full flex items-center justify-center">
                      <Icon name="i-lucide-car" class="size-5 text-muted-foreground" />
                    </div>
                    <!-- WhatsApp Share Overlay -->
                    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover/pic:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center backdrop-blur-[1px]">
                      <Icon name="i-lucide-message-circle" class="size-5 text-emerald-400 drop-shadow-md mb-0.5" />
                      <span class="text-[8px] font-bold text-white uppercase tracking-widest">Share</span>
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
            <TableCell class="min-w-[260px] max-w-[320px] py-3 sticky left-0 z-40 bg-white dark:bg-[#09090b] group-hover:bg-muted transition-colors border-r border-border/50 shadow-[4px_0_12px_rgba(0,0,0,0.05)]">
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
            <TableCell>
              <div class="flex justify-center gap-1">
                <Button
                  v-if="car.appointmentId && (!activeTab || !activeTab.startsWith('similar-search'))"
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
                <Button
                  v-if="car.appointmentId"
                  variant="ghost"
                  class="p-1 hover:bg-muted/50 rounded-md transition-colors w-12 h-12 flex items-center justify-center border border-transparent hover:border-border"
                  title="Download Images"
                  :disabled="isZipping === (car.appointmentId || car._id)"
                  @click.stop="downloadImagesZip(car)"
                >
                  <Icon v-if="isZipping === (car.appointmentId || car._id)" name="i-lucide-loader-2" class="!size-6 text-blue-500 shrink-0 animate-spin" />
                  <Icon v-else name="i-lucide-images" class="!size-8 text-blue-500 shrink-0" />
                </Button>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </div>
            </TableCell>
            <TableCell v-if="!['ended', 'removed', 'sold', 'otobuy'].includes(activeTab)" class="whitespace-nowrap text-xs">
              <Badge v-if="car.auctionStatus === 'live' && car.auctionEndTime" variant="outline" class="font-bold tracking-wide bg-[#EB4C4C] text-white border-transparent uppercase text-[10px] tabular-nums w-[84px] justify-center">
                {{ formatCountdown(car.auctionEndTime) }}
              </Badge>
              <Badge v-else variant="outline" class="font-bold uppercase tracking-wider text-[10px] w-[84px] justify-center" :class="getAuctionStatusColor(car.auctionStatus)">
                {{ car.auctionStatus?.toLowerCase() === 'liveauctionended' ? 'Ended' : (car.auctionStatus || '—') }}
              </Badge>
            </TableCell>
            <TableCell class="text-xs whitespace-nowrap font-medium">
              {{ car.priceDiscovery ? formatCurrency(car.priceDiscovery) : '—' }}
            </TableCell>
            <TableCell class="text-xs align-middle px-2">
              <div class="flex flex-col items-center gap-1 w-full justify-center min-h-[44px] relative">
                <span class="text-[11px] px-2 py-0.5 font-bold tabular-nums whitespace-nowrap transition-all" :class="hasSimulation(car) ? 'text-muted-foreground line-through opacity-50' : 'text-foreground'" title="Inflated CEP">
                  {{ formatCurrency(getInflatedCep(car)) }}
                </span>

                <Transition
                  enter-active-class="transition-all duration-300 ease-out z-10"
                  enter-from-class="opacity-0 -translate-y-2 scale-95"
                  enter-to-class="opacity-100 translate-y-0 scale-100"
                  leave-active-class="transition-all duration-200 ease-in absolute z-0"
                  leave-from-class="opacity-100 translate-y-0 scale-100"
                  leave-to-class="opacity-0 -translate-y-2 scale-95"
                >
                  <div
                    v-if="hasSimulation(car)"
                    class="text-[11px] px-2 py-0.5 font-bold tabular-nums whitespace-nowrap flex items-center gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 rounded-md"
                    title="Simulated CEP"
                  >
                    <Icon name="i-lucide-activity" class="size-3" />
                    {{ formatCurrency(getSimulatedInflatedCep(car)) }}
                  </div>
                </Transition>
              </div>
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

            <TableCell class="text-xs font-bold text-blue-600 tabular-nums text-center">
              <div v-if="getHighestAutoBidObj(car)" class="flex flex-col gap-0.5 items-center">
                <span v-if="getHighestAutoBidObj(car).dealerName" class="text-[10px] text-muted-foreground font-semibold capitalize whitespace-nowrap">{{ String(getHighestAutoBidObj(car).dealerName).toLowerCase() }}</span>
                <span>{{ formatCurrency(getHighestAutoBidObj(car).maxAmount) }}</span>
                <span v-if="getHighestAutoBidObj(car).kamName" class="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium capitalize whitespace-nowrap">{{ String(getHighestAutoBidObj(car).kamName).toLowerCase() }}</span>
              </div>
              <span v-else>—</span>
            </TableCell>

            <TableCell class="text-xs whitespace-nowrap font-bold tabular-nums text-center" :class="getInflatedCep(car) - Number(car.highestBid || 0) > 0 ? 'text-amber-600' : 'text-muted-foreground'">
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

            <TableCell class="text-xs whitespace-nowrap text-muted-foreground">
              {{ formatCurrency(getSalesOneClickPrice(car)) }}
            </TableCell>
            <TableCell class="text-xs whitespace-nowrap text-emerald-600 font-semibold dark:text-emerald-400">
              {{ formatCurrency(car.otobuyOffer) }}
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
            <TableCell class="text-xs align-middle px-1">
              <div class="flex items-center justify-center gap-1.5 font-medium whitespace-nowrap text-emerald-700 dark:text-emerald-300" :title="car.retailAssociate">
                <span>{{ resolveUserNameByEmail(car.retailAssociate) || '—' }}</span>
              </div>
            </TableCell>
            <TableCell class="text-xs text-muted-foreground text-center pr-[19px]">
              —
            </TableCell>
          </TableRow>
          <TableRow v-if="allCars.length === 0">
            <TableCell :colspan="['ended', 'removed', 'sold', 'otobuy'].includes(activeTab) ? 16 : 17" class="h-32 text-center text-muted-foreground bg-muted/10">
              No matching records found
            </TableCell>
          </TableRow>
          <!-- Scroll Sentinel — MUST be inside the table's overflow-auto container -->
          <TableRow v-if="hasMore">
            <TableCell :colspan="['ended', 'removed', 'sold', 'otobuy'].includes(activeTab) ? 16 : 17" class="p-0 h-1">
              <div ref="loadMoreTrigger" class="h-1 w-full" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Info bar -->
    <div v-if="isFetched && !fetchError" class="shrink-0 border-t bg-muted/30 px-4 lg:px-6 py-2 flex items-center justify-between">
      <p class="text-xs text-muted-foreground tabular-nums">
        Showing {{ allCars.length }} of {{ totalCount }} records
      </p>
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
</template>

<style scoped>
@keyframes indeterminate {
  0% { transform: translateX(-100%) scaleX(0.2); }
  50% { transform: translateX(0%) scaleX(0.5); }
  100% { transform: translateX(200%) scaleX(0.2); }
}
</style>
