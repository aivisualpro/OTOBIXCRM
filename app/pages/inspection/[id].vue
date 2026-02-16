<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const carId = route.params.id as string

const { setHeader } = usePageHeader()
setHeader({ title: `Inspection: ${carId}`, description: 'Vehicle inspection details', icon: 'i-lucide-scan-eye' })

const { carDetails: car, isLoading, error, fetchCarDetails } = useCarDetails()

onMounted(() => fetchCarDetails(carId))

const activeTab = ref('overview')

const tabs = [
  { id: 'overview', label: 'Overview', icon: 'i-lucide-car' },
  { id: 'exterior', label: 'Exterior', icon: 'i-lucide-scan-eye' },
  { id: 'engine', label: 'Engine', icon: 'i-lucide-cog' },
  { id: 'interior', label: 'Interior', icon: 'i-lucide-armchair' },
  { id: 'documents', label: 'Documents', icon: 'i-lucide-file-text' },
  { id: 'auction', label: 'Auction', icon: 'i-lucide-gavel' },
]

// ─── Helpers ───
function _conditionColor(val: string) {
  if (!val)
    return 'bg-muted text-muted-foreground'
  const v = val.toLowerCase()
  if (v === 'okay' || v === 'working' || v === 'effective' || v === 'no mismatch' || v === 'no blow by')
    return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
  if (v.includes('scratched') && !v.includes('dented') && !v.includes('damaged'))
    return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
  if (v.includes('repainted') || v.includes('repaired') || v.includes('changed'))
    return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20'
  if (v.includes('damaged') || v.includes('broken') || v.includes('rusted') || v.includes('weak'))
    return 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20'
  if (v.includes('not applicable'))
    return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
  return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20'
}

function conditionIcon(val: string): string {
  const v = val.toLowerCase().trim()
  if (v === 'okay' || v === 'working' || v === 'effective')
    return 'i-lucide-check-circle'
  if (v === 'repainted')
    return 'i-lucide-paintbrush'
  if (v === 'repaired')
    return 'i-lucide-wrench'
  if (v === 'scratched')
    return 'i-lucide-slash'
  if (v === 'dented')
    return 'i-lucide-circle-dot'
  if (v === 'damaged')
    return 'i-lucide-alert-triangle'
  if (v === 'rusted')
    return 'i-lucide-flame'
  if (v === 'broken')
    return 'i-lucide-x-circle'
  if (v === 'changed')
    return 'i-lucide-refresh-cw'
  if (v === 'not working')
    return 'i-lucide-x-octagon'
  if (v.includes('tyre life'))
    return 'i-lucide-disc'
  if (v === 'faded')
    return 'i-lucide-sun'
  if (v === 'not applicable')
    return 'i-lucide-minus-circle'
  return 'i-lucide-info'
}

function conditionTextColor(val: string): string {
  const v = val.toLowerCase().trim()
  if (v === 'okay' || v === 'working' || v === 'effective')
    return 'text-emerald-500'
  if (v === 'repainted' || v === 'repaired' || v === 'changed')
    return 'text-orange-500'
  if (v === 'scratched' || v === 'faded')
    return 'text-amber-500'
  if (v === 'dented' || v === 'damaged' || v === 'broken' || v === 'rusted' || v === 'not working')
    return 'text-red-500'
  if (v.includes('tyre life'))
    return 'text-blue-500'
  if (v === 'not applicable')
    return 'text-zinc-400'
  return 'text-blue-500'
}

function splitConditions(val: string): string[] {
  if (!val || val === '—')
    return ['—']
  return val.split(',').map(s => s.trim()).filter(Boolean)
}

function formatDate(d: string) {
  if (!d)
    return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getImages(obj: Record<string, any> | null, key: string): string[] {
  const val = obj?.[key]
  if (!val)
    return []
  if (Array.isArray(val))
    return val.filter((u: string) => u && typeof u === 'string')
  if (typeof val === 'string' && val.startsWith('http'))
    return [val]
  return []
}

function humanize(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .replace(/Lhs/g, 'LHS')
    .replace(/Rhs/g, 'RHS')
    .replace(/Orvm/g, 'ORVM')
    .replace(/Images$/, '')
    .replace(/Dropdown List$/, '')
    .trim()
}

// ─── Section data builders ───
const exteriorSections = [
  {
    title: 'Front',
    icon: 'i-lucide-arrow-up',
    imageKeys: ['frontMain', 'bonnetImages', 'frontWindshieldImages', 'roofImages', 'frontBumperImages', 'lhsHeadlampImages', 'lhsFoglampImages', 'rhsHeadlampImages', 'rhsFoglampImages'],
    parts: [
      { key: 'bonnet', label: 'Bonnet' },
      { key: 'frontWindshield', label: 'Front Windshield' },
      { key: 'roof', label: 'Roof' },
      { key: 'frontBumper', label: 'Front Bumper' },
      { key: 'lhsHeadlamp', label: 'LHS Headlamp' },
      { key: 'lhsFoglamp', label: 'LHS Foglamp' },
      { key: 'rhsHeadlamp', label: 'RHS Headlamp' },
      { key: 'rhsFoglamp', label: 'RHS Foglamp' },
    ],
  },
  {
    title: 'Left (LHS)',
    icon: 'i-lucide-arrow-left',
    imageKeys: ['lhsFront45Degree', 'lhsFenderImages', 'lhsOrvmImages', 'lhsFrontAlloyImages', 'lhsFrontTyreImages', 'lhsFrontDoorImages', 'lhsRearDoorImages', 'lhsRunningBorderImages', 'lhsRearTyreImages', 'lhsQuarterPanelImages'],
    parts: [
      { key: 'lhsFender', label: 'Fender' },
      { key: 'lhsOrvm', label: 'ORVM' },
      { key: 'lhsAPillar', label: 'A-Pillar' },
      { key: 'lhsBPillar', label: 'B-Pillar' },
      { key: 'lhsCPillar', label: 'C-Pillar' },
      { key: 'lhsFrontAlloy', label: 'Front Alloy' },
      { key: 'lhsFrontTyre', label: 'Front Tyre' },
      { key: 'lhsRearAlloy', label: 'Rear Alloy' },
      { key: 'lhsRearTyre', label: 'Rear Tyre' },
      { key: 'lhsFrontDoor', label: 'Front Door' },
      { key: 'lhsRearDoor', label: 'Rear Door' },
      { key: 'lhsRunningBorder', label: 'Running Border' },
      { key: 'lhsQuarterPanel', label: 'Quarter Panel' },
    ],
  },
  {
    title: 'Rear',
    icon: 'i-lucide-arrow-down',
    imageKeys: ['rearMain', 'rearBumperImages', 'lhsTailLampImages', 'rhsTailLampImages', 'spareTyreImages', 'bootFloorImages'],
    parts: [
      { key: 'rearBumper', label: 'Rear Bumper' },
      { key: 'lhsTailLamp', label: 'LHS Tail Lamp' },
      { key: 'rhsTailLamp', label: 'RHS Tail Lamp' },
      { key: 'rearWindshield', label: 'Rear Windshield' },
      { key: 'bootDoor', label: 'Boot Door' },
      { key: 'spareTyre', label: 'Spare Tyre' },
      { key: 'bootFloor', label: 'Boot Floor' },
    ],
  },
  {
    title: 'Right (RHS)',
    icon: 'i-lucide-arrow-right',
    imageKeys: ['rhsRear45Degree', 'rhsFenderImages', 'rhsOrvmImages', 'rhsFrontAlloyImages', 'rhsFrontTyreImages', 'rhsFrontDoorImages', 'rhsRearDoorImages', 'rhsRunningBorderImages', 'rhsQuarterPanelImages'],
    parts: [
      { key: 'rhsFender', label: 'Fender' },
      { key: 'rhsOrvm', label: 'ORVM' },
      { key: 'rhsAPillar', label: 'A-Pillar' },
      { key: 'rhsBPillar', label: 'B-Pillar' },
      { key: 'rhsCPillar', label: 'C-Pillar' },
      { key: 'rhsFrontAlloy', label: 'Front Alloy' },
      { key: 'rhsFrontTyre', label: 'Front Tyre' },
      { key: 'rhsRearAlloy', label: 'Rear Alloy' },
      { key: 'rhsRearTyre', label: 'Rear Tyre' },
      { key: 'rhsFrontDoor', label: 'Front Door' },
      { key: 'rhsRearDoor', label: 'Rear Door' },
      { key: 'rhsRunningBorder', label: 'Running Border' },
      { key: 'rhsQuarterPanel', label: 'Quarter Panel' },
    ],
  },
]

const engineParts = [
  { key: 'upperCrossMember', label: 'Upper Cross Member' },
  { key: 'radiatorSupport', label: 'Radiator Support' },
  { key: 'headlightSupport', label: 'Headlight Support' },
  { key: 'lowerCrossMember', label: 'Lower Cross Member' },
  { key: 'lhsApron', label: 'LHS Apron' },
  { key: 'rhsApron', label: 'RHS Apron' },
  { key: 'firewall', label: 'Firewall' },
  { key: 'cowlTop', label: 'Cowl Top' },
  { key: 'engine', label: 'Engine' },
  { key: 'battery', label: 'Battery' },
  { key: 'coolant', label: 'Coolant' },
  { key: 'engineOilLevelDipstick', label: 'Engine Oil Dipstick' },
  { key: 'engineOil', label: 'Engine Oil' },
  { key: 'engineMount', label: 'Engine Mount' },
  { key: 'enginePermisableBlowBy', label: 'Blow-by' },
  { key: 'exhaustSmoke', label: 'Exhaust Smoke' },
  { key: 'clutch', label: 'Clutch' },
  { key: 'gearShift', label: 'Gear Shift' },
  { key: 'steering', label: 'Steering' },
  { key: 'brakes', label: 'Brakes' },
  { key: 'suspension', label: 'Suspension' },
]

const _exteriorImageKeys = [
  'frontMain',
  'bonnetImages',
  'frontWindshieldImages',
  'roofImages',
  'frontBumperImages',
  'lhsHeadlampImages',
  'lhsFoglampImages',
  'rhsHeadlampImages',
  'rhsFoglampImages',
  'lhsFront45Degree',
  'lhsFenderImages',
  'lhsFrontAlloyImages',
  'lhsFrontTyreImages',
  'lhsRunningBorderImages',
  'lhsOrvmImages',
  'lhsFrontDoorImages',
  'lhsRearDoorImages',
  'lhsRearTyreImages',
  'lhsQuarterPanelImages',
  'rearMain',
  'rearBumperImages',
  'lhsTailLampImages',
  'rhsTailLampImages',
  'spareTyreImages',
  'bootFloorImages',
  'rhsRear45Degree',
  'rhsQuarterPanelImages',
  'rhsRearDoorImages',
  'rhsFrontDoorImages',
  'rhsRunningBorderImages',
  'rhsFrontTyreImages',
  'rhsOrvmImages',
  'rhsFenderImages',
]

const engineImageKeys = [
  'engineBay',
  'apronLhsRhs',
  'batteryImages',
  'additionalImages',
]

const engineVideoKeys = [
  { key: 'engineSound', label: 'Engine Sound' },
  { key: 'exhaustSmokeImages', label: 'Exhaust Smoke' },
]

function getVideos(obj: Record<string, any> | null, key: string): string[] {
  const val = obj?.[key]
  if (!val)
    return []
  if (Array.isArray(val))
    return val.filter((u: string) => u && typeof u === 'string')
  if (typeof val === 'string' && val.startsWith('http'))
    return [val]
  return []
}

const interiorImageKeys = [
  'meterConsoleWithEngineOn',
  'airbags',
  'frontSeatsFromDriverSideDoorOpen',
  'rearSeatsFromRightSideDoorOpen',
  'dashboardFromRearSeat',
  'sunroofImages',
  'additionalImages2',
  'acImages',
]

const documentImageKeys = [
  'rcTaxToken',
  'insuranceCopy',
  'bothKeys',
  'form26GdCopyIfRcIsLost',
  'chassisEmbossmentImages',
  'vinPlateImages',
  'pucImages',
  'rtoNocImages',
  'rtoForm28Images',
  'roadTaxImages',
]

// Lightbox / Gallery
const lightboxImages = ref<{ url: string, label: string }[]>([])
const lightboxIndex = ref(0)
const showLightbox = ref(false)

function openLightbox(images: { url: string, label: string }[], index: number) {
  lightboxImages.value = images
  lightboxIndex.value = index
  showLightbox.value = true
}

function openLightboxUrls(urls: string[], index: number, label?: string) {
  lightboxImages.value = urls.map((u, i) => ({ url: u, label: label ? `${label} (${i + 1})` : `Image ${i + 1}` }))
  lightboxIndex.value = index
  showLightbox.value = true
}

function closeLightbox() {
  showLightbox.value = false
}

function prevImage() {
  lightboxIndex.value = (lightboxIndex.value - 1 + lightboxImages.value.length) % lightboxImages.value.length
  scrollThumbIntoView()
}

function nextImage() {
  lightboxIndex.value = (lightboxIndex.value + 1) % lightboxImages.value.length
  scrollThumbIntoView()
}

function goToImage(idx: number) {
  lightboxIndex.value = idx
  scrollThumbIntoView()
}

function scrollThumbIntoView() {
  nextTick(() => {
    const el = document.querySelector(`[data-thumb-idx="${lightboxIndex.value}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  })
}

// Keyboard navigation
function onLightboxKeydown(e: KeyboardEvent) {
  if (!showLightbox.value)
    return
  if (e.key === 'ArrowLeft')
    prevImage()
  else if (e.key === 'ArrowRight')
    nextImage()
  else if (e.key === 'Escape')
    closeLightbox()
}

onMounted(() => window.addEventListener('keydown', onLightboxKeydown))
onUnmounted(() => window.removeEventListener('keydown', onLightboxKeydown))

// Collect all images for a section
function sectionImages(keys: string[]) {
  if (!car.value)
    return []
  const imgs: { url: string, label: string }[] = []
  for (const key of keys) {
    const urls = getImages(car.value, key)
    for (const url of urls) {
      imgs.push({ url, label: humanize(key) })
    }
  }
  return imgs
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden -m-4 lg:-m-6">
    <!-- Loading -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-muted-foreground">
        <Icon name="i-lucide-loader-2" class="size-10 animate-spin" />
        <p class="text-sm">
          Loading inspection details...
        </p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center gap-4 text-center max-w-md">
        <div class="size-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <Icon name="i-lucide-alert-triangle" class="size-8 text-destructive" />
        </div>
        <h2 class="text-lg font-semibold">
          Failed to Load Details
        </h2>
        <p class="text-sm text-muted-foreground">
          {{ error }}
        </p>
        <div class="flex gap-2">
          <Button variant="outline" @click="router.back()">
            <Icon name="i-lucide-arrow-left" class="mr-1 size-4" /> Go Back
          </Button>
          <Button @click="fetchCarDetails(carId)">
            <Icon name="i-lucide-refresh-cw" class="mr-1 size-4" /> Retry
          </Button>
        </div>
      </div>
    </div>

    <!-- Content -->
    <template v-else-if="car">
      <!-- Hero Section -->
      <div class="shrink-0 border-b bg-gradient-to-r from-primary/5 via-background to-primary/5">
        <div class="p-6 flex flex-col lg:flex-row gap-6">
          <!-- Main Image -->
          <div class="shrink-0 w-full lg:w-80 h-48 rounded-xl overflow-hidden bg-muted relative group cursor-pointer" @click="getImages(car, 'frontMain').length && openLightboxUrls(getImages(car, 'frontMain'), 0, `${car.make} ${car.model}`)">
            <img
              v-if="getImages(car, 'frontMain').length"
              :src="getImages(car, 'frontMain')[0]"
              :alt="`${car.make} ${car.model}`"
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            >
            <div v-else class="w-full h-full flex items-center justify-center">
              <Icon name="i-lucide-car" class="size-16 text-muted-foreground/30" />
            </div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div class="absolute bottom-3 left-3 right-3">
              <Badge variant="outline" class="bg-black/50 text-white border-white/20 backdrop-blur-sm">
                <Icon name="i-lucide-hash" class="size-3 mr-1" />
                {{ car.appointmentId }}
              </Badge>
            </div>
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-4 mb-3">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <Button variant="ghost" size="icon" class="size-8 -ml-2" @click="router.back()">
                    <Icon name="i-lucide-arrow-left" class="size-4" />
                  </Button>
                  <h1 class="text-2xl font-bold tracking-tight">
                    {{ car.make }} {{ car.model }}
                  </h1>
                </div>
                <p class="text-muted-foreground text-sm ml-8">
                  {{ car.variant }} · {{ car.fuelType }} · {{ car.cubicCapacity }}cc
                </p>
              </div>
              <div class="flex gap-2 shrink-0">
                <Badge :class="car.approvalStatus === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/15 text-amber-600 border-amber-500/20'" variant="outline">
                  {{ car.approvalStatus || 'Pending' }}
                </Badge>
                <Badge :class="car.status === 'INSPECTED' ? 'bg-blue-500/15 text-blue-600 border-blue-500/20' : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'" variant="outline">
                  {{ car.status || '—' }}
                </Badge>
              </div>
            </div>

            <!-- Key Stats Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 ml-8">
              <div class="rounded-lg border bg-card p-3 space-y-1">
                <p class="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Registration
                </p>
                <p class="text-sm font-semibold">
                  {{ car.registrationNumber }}
                </p>
              </div>
              <div class="rounded-lg border bg-card p-3 space-y-1">
                <p class="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Odometer
                </p>
                <p class="text-sm font-semibold">
                  {{ (car.odometerReadingInKms || 0).toLocaleString() }} km
                </p>
              </div>
              <div class="rounded-lg border bg-card p-3 space-y-1">
                <p class="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Owner
                </p>
                <p class="text-sm font-semibold">
                  {{ car.ownerSerialNumber || '—' }}{{ car.ownerSerialNumber === 1 ? 'st' : car.ownerSerialNumber === 2 ? 'nd' : car.ownerSerialNumber === 3 ? 'rd' : 'th' }}
                </p>
              </div>
              <div class="rounded-lg border bg-card p-3 space-y-1">
                <p class="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  MFG Year
                </p>
                <p class="text-sm font-semibold">
                  {{ car.yearMonthOfManufacture ? new Date(car.yearMonthOfManufacture).getFullYear() : '—' }}
                </p>
              </div>
              <div class="rounded-lg border bg-card p-3 space-y-1">
                <p class="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  City
                </p>
                <p class="text-sm font-semibold">
                  {{ car.city || '—' }}
                </p>
              </div>
              <div class="rounded-lg border bg-card p-3 space-y-1">
                <p class="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Price Discovery
                </p>
                <p class="text-sm font-semibold text-primary">
                  ₹{{ (car.priceDiscovery || 0).toLocaleString() }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab Bar -->
      <div class="shrink-0 border-b bg-background/80 backdrop-blur-sm">
        <div class="flex gap-1 px-6 overflow-x-auto no-scrollbar">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px"
            :class="activeTab === tab.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'"
            @click="activeTab = tab.id"
          >
            <Icon :name="tab.icon" class="size-4" />
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- Tab Content (scrollable) -->
      <div class="flex-1 min-h-0 overflow-auto p-6">
        <!-- ═══════ OVERVIEW TAB ═══════ -->
        <div v-if="activeTab === 'overview'" class="space-y-6">
          <!-- Registration Details -->
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-file-badge" class="size-4 text-primary" />
                Registration Details
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                <div
                  v-for="item in [
                    { label: 'Registration Number', value: car.registrationNumber },
                    { label: 'Registration Date', value: formatDate(car.registrationDate) },
                    { label: 'Registration Type', value: car.registrationType },
                    { label: 'Registration State', value: car.registrationState },
                    { label: 'Registered RTO', value: car.registeredRto },
                    { label: 'Registered Owner', value: car.registeredOwner },
                    { label: 'RC Book', value: car.rcBookAvailability },
                    { label: 'RC Condition', value: car.rcCondition },
                    { label: 'RC Status', value: car.rcStatus },
                    { label: 'Fitness Till', value: formatDate(car.fitnessTill) },
                    { label: 'To Be Scrapped', value: car.toBeScrapped },
                    { label: 'Seating Capacity', value: car.seatingCapacity },
                    { label: 'Number of Cylinders', value: car.numberOfCylinders },
                    { label: 'Emission Norms', value: car.norms },
                    { label: 'Color', value: car.color },
                  ]" :key="item.label" class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0"
                >
                  <p class="text-xs text-muted-foreground whitespace-nowrap">
                    {{ item.label }}
                  </p>
                  <p class="text-sm font-medium text-right">
                    {{ item.value || '—' }}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Insurance -->
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-shield-check" class="size-4 text-primary" />
                Insurance Details
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                <div
                  v-for="item in [
                    { label: 'Insurance Type', value: car.insurance },
                    { label: 'Policy Number', value: car.insurancePolicyNumber },
                    { label: 'Validity', value: formatDate(car.insuranceValidity) },
                    { label: 'No Claim Bonus', value: car.noClaimBonus },
                    { label: 'Mismatch', value: car.mismatchInInsurance },
                    { label: 'Insurer', value: car.insurer },
                    { label: 'Hypothecated To', value: car.hypothecatedTo },
                    { label: 'Hypothecation Details', value: car.hypothecationDetails },
                  ]" :key="item.label" class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0"
                >
                  <p class="text-xs text-muted-foreground whitespace-nowrap">
                    {{ item.label }}
                  </p>
                  <p class="text-sm font-medium text-right">
                    {{ item.value || '—' }}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Additional Info -->
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-info" class="size-4 text-primary" />
                Additional Info
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                <div
                  v-for="item in [
                    { label: 'Engine Number', value: car.engineNumber },
                    { label: 'Chassis Number', value: car.chassisNumber },
                    { label: 'Fuel Type', value: car.fuelType },
                    { label: 'Cubic Capacity', value: car.cubicCapacity ? `${car.cubicCapacity}cc` : '—' },
                    { label: 'Road Tax Validity', value: car.roadTaxValidity },
                    { label: 'Tax Valid Till', value: formatDate(car.taxValidTill) },
                    { label: 'Duplicate Key', value: car.duplicateKey },
                    { label: 'RTO NOC', value: car.rtoNoc },
                    { label: 'Party Peshi', value: car.partyPeshi },
                    { label: 'Mismatch in RC', value: car.mismatchInRc },
                    { label: 'Contact Number', value: car.contactNumber },
                    { label: 'Email', value: car.emailAddress },
                  ]" :key="item.label" class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0"
                >
                  <p class="text-xs text-muted-foreground whitespace-nowrap">
                    {{ item.label }}
                  </p>
                  <p class="text-sm font-medium text-right">
                    {{ item.value || '—' }}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- ═══════ EXTERIOR TAB ═══════ -->
        <div v-else-if="activeTab === 'exterior'" class="space-y-6">
          <!-- Condition Grid -->
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-scan-eye" class="size-4 text-primary" />
                Exterior Condition
              </CardTitle>
              <p class="text-xs text-muted-foreground mt-1">
                Condition of each exterior component as inspected
              </p>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div v-for="section in exteriorSections" :key="section.title" class="mb-6 last:mb-0">
                <!-- Section heading -->
                <div class="flex items-center gap-2 mb-3">
                  <Icon :name="section.icon" class="size-4 text-primary" />
                  <h3 class="text-sm font-semibold">
                    {{ section.title }}
                  </h3>
                  <Separator class="flex-1" />
                </div>
                <!-- Parts grid -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  <div
                    v-for="part in section.parts"
                    :key="part.key"
                    class="rounded-lg border overflow-hidden"
                  >
                    <div
                      class="px-3 py-2 bg-muted/40 border-b flex items-center justify-between gap-2"
                      :class="getImages(car, `${part.key}Images`).length ? 'cursor-pointer hover:bg-muted/70 transition-colors' : ''"
                      @click="getImages(car, `${part.key}Images`).length && openLightboxUrls(getImages(car, `${part.key}Images`), 0, part.label)"
                    >
                      <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{{ part.label }}</span>
                      <span v-if="getImages(car, `${part.key}Images`).length" class="flex items-center gap-1 text-[10px] text-primary">
                        <Icon name="i-lucide-camera" class="size-3" />
                        {{ getImages(car, `${part.key}Images`).length }}
                      </span>
                    </div>
                    <div class="divide-y divide-border/50">
                      <div
                        v-for="(cond, ci) in splitConditions(car[part.key] || '')"
                        :key="ci"
                        class="flex items-center gap-2 px-3 py-1.5"
                      >
                        <Icon
                          :name="conditionIcon(cond)"
                          class="size-3.5 shrink-0"
                          :class="conditionTextColor(cond)"
                        />
                        <span class="text-sm" :class="conditionTextColor(cond)">{{ cond }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- Section photos -->
                <div v-if="sectionImages(section.imageKeys).length" class="mt-3">
                  <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                    <div
                      v-for="(img, idx) in sectionImages(section.imageKeys)"
                      :key="idx"
                      class="group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer border hover:border-primary/50 transition-colors"
                      @click="openLightbox(sectionImages(section.imageKeys), idx)"
                    >
                      <img :src="img.url" :alt="img.label" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy">
                      <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <Badge variant="secondary" class="absolute bottom-1 left-1 text-[9px] max-w-[calc(100%-8px)] truncate">
                        {{ img.label }}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="car.comments" class="mt-4 rounded-lg bg-muted/50 p-4">
                <p class="text-xs font-medium text-muted-foreground mb-1">
                  Inspector Comments
                </p>
                <p class="text-sm">
                  {{ car.comments }}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- ═══════ ENGINE TAB ═══════ -->
        <div v-else-if="activeTab === 'engine'" class="space-y-6">
          <!-- Mechanical Condition -->
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-cog" class="size-4 text-primary" />
                Engine & Mechanical
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                <div
                  v-for="part in engineParts"
                  :key="part.key"
                  class="rounded-lg border overflow-hidden"
                >
                  <div
                    class="px-3 py-2 bg-muted/40 border-b flex items-center justify-between gap-2"
                    :class="getImages(car, `${part.key}Images`).length ? 'cursor-pointer hover:bg-muted/70 transition-colors' : ''"
                    @click="getImages(car, `${part.key}Images`).length && openLightboxUrls(getImages(car, `${part.key}Images`), 0, part.label)"
                  >
                    <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{{ part.label }}</span>
                    <span v-if="getImages(car, `${part.key}Images`).length" class="flex items-center gap-1 text-[10px] text-primary">
                      <Icon name="i-lucide-camera" class="size-3" />
                      {{ getImages(car, `${part.key}Images`).length }}
                    </span>
                  </div>
                  <div class="divide-y divide-border/50">
                    <div
                      v-for="(cond, ci) in splitConditions(car[part.key] || '')"
                      :key="ci"
                      class="flex items-center gap-2 px-3 py-1.5"
                    >
                      <Icon
                        :name="conditionIcon(cond)"
                        class="size-3.5 shrink-0"
                        :class="conditionTextColor(cond)"
                      />
                      <span class="text-sm" :class="conditionTextColor(cond)">{{ cond }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Engine Photos inline -->
              <div v-if="sectionImages(engineImageKeys).length" class="mt-4">
                <div class="flex items-center gap-2 mb-3">
                  <Icon name="i-lucide-image" class="size-4 text-primary" />
                  <h3 class="text-sm font-semibold">
                    Engine Photos
                  </h3>
                  <Badge variant="secondary" class="text-xs">
                    {{ sectionImages(engineImageKeys).length }}
                  </Badge>
                  <Separator class="flex-1" />
                </div>
                <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                  <div
                    v-for="(img, idx) in sectionImages(engineImageKeys)"
                    :key="idx"
                    class="group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer border hover:border-primary/50 transition-colors"
                    @click="openLightbox(sectionImages(engineImageKeys), idx)"
                  >
                    <img :src="img.url" :alt="img.label" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <Badge variant="secondary" class="absolute bottom-1 left-1 text-[9px] max-w-[calc(100%-8px)] truncate">
                      {{ img.label }}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Test Drive -->
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-gauge" class="size-4 text-primary" />
                Test Drive & Performance
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-0">
                <div
                  v-for="item in [
                    { label: 'Odometer Reading', value: `${(car.odometerReadingInKms || 0).toLocaleString()} km` },
                    { label: 'Fuel Level', value: car.fuelLevel },
                    { label: 'ABS', value: car.abs },
                    { label: 'Electricals', value: car.electricals },
                  ]" :key="item.label" class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0"
                >
                  <p class="text-xs text-muted-foreground whitespace-nowrap">
                    {{ item.label }}
                  </p>
                  <p class="text-sm font-medium text-right">
                    {{ item.value || '—' }}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card v-if="car && engineVideoKeys.some(v => getVideos(car, v.key).length > 0)">
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-video" class="size-4 text-primary" />
                Engine Videos
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <template v-for="vk in engineVideoKeys" :key="vk.key">
                  <div v-for="(videoUrl, vIdx) in getVideos(car, vk.key)" :key="`${vk.key}-${vIdx}`" class="space-y-2">
                    <p class="text-sm font-medium flex items-center gap-2">
                      <Icon name="i-lucide-play-circle" class="size-4 text-primary" />
                      {{ vk.label }}
                    </p>
                    <div class="rounded-lg overflow-hidden border bg-black">
                      <video
                        :src="videoUrl"
                        controls
                        preload="metadata"
                        class="w-full max-h-64 object-contain"
                      >
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </div>
                </template>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- ═══════ INTERIOR TAB ═══════ -->
        <div v-else-if="activeTab === 'interior'" class="space-y-6">
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-armchair" class="size-4 text-primary" />
                Interior Features
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                <div
                  v-for="item in [
                    { label: 'Music System', value: car.musicSystem },
                    { label: 'Stereo', value: car.stereo },
                    { label: 'Inbuilt Speaker', value: car.inbuiltSpeaker },
                    { label: 'External Speaker', value: car.externalSpeaker },
                    { label: 'Steering Audio Control', value: car.steeringMountedAudioControl },
                    { label: 'Power Windows', value: car.noOfPowerWindows },
                    { label: 'Rear Wiper/Washer', value: car.rearWiperWasher },
                    { label: 'Rear Defogger', value: car.rearDefogger },
                    { label: 'Reverse Camera', value: car.reverseCamera },
                    { label: 'Sunroof', value: car.sunroof },
                    { label: 'Leather Seats', value: car.leatherSeats },
                    { label: 'Fabric Seats', value: car.fabricSeats },
                    { label: 'AC (Manual)', value: car.airConditioningManual },
                    { label: 'AC (Climate)', value: car.airConditioningClimateControl },
                  ]" :key="item.label" class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0"
                >
                  <p class="text-xs text-muted-foreground whitespace-nowrap">
                    {{ item.label }}
                  </p>
                  <p class="text-sm font-medium text-right">
                    {{ item.value || '—' }}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Airbags -->
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-shield" class="size-4 text-primary" />
                Safety — Airbags ({{ car.noOfAirBags || 0 }})
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                <div
                  v-for="item in [
                    { label: 'Driver Side', key: 'airbagFeaturesDriverSide' },
                    { label: 'Co-Driver Side', key: 'airbagFeaturesCoDriverSide' },
                    { label: 'LHS A-Pillar Curtain', key: 'airbagFeaturesLhsAPillarCurtain' },
                    { label: 'LHS B-Pillar Curtain', key: 'airbagFeaturesLhsBPillarCurtain' },
                    { label: 'LHS C-Pillar Curtain', key: 'airbagFeaturesLhsCPillarCurtain' },
                    { label: 'RHS A-Pillar Curtain', key: 'airbagFeaturesRhsAPillarCurtain' },
                    { label: 'RHS B-Pillar Curtain', key: 'airbagFeaturesRhsBPillarCurtain' },
                    { label: 'RHS C-Pillar Curtain', key: 'airbagFeaturesRhsCPillarCurtain' },
                  ]"
                  :key="item.key"
                  class="rounded-lg border overflow-hidden"
                >
                  <div class="px-3 py-2 bg-muted/40 border-b">
                    <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{{ item.label }}</span>
                  </div>
                  <div class="divide-y divide-border/50">
                    <div
                      v-for="(cond, ci) in splitConditions(car[item.key] || '')"
                      :key="ci"
                      class="flex items-center gap-2 px-3 py-1.5"
                    >
                      <Icon
                        :name="conditionIcon(cond)"
                        class="size-3.5 shrink-0"
                        :class="conditionTextColor(cond)"
                      />
                      <span class="text-sm" :class="conditionTextColor(cond)">{{ cond }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Power Windows -->
          <Card v-if="car.noOfPowerWindows">
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-move-vertical" class="size-4 text-primary" />
                Power Windows
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div
                  v-for="item in [
                    { label: 'RHS Front', value: car.powerWindowConditionRhsFront },
                    { label: 'LHS Front', value: car.powerWindowConditionLhsFront },
                    { label: 'RHS Rear', value: car.powerWindowConditionRhsRear },
                    { label: 'LHS Rear', value: car.powerWindowConditionLhsRear },
                  ]" :key="item.label" class="rounded-lg border overflow-hidden"
                >
                  <div class="px-3 py-2 bg-muted/40 border-b">
                    <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{{ item.label }}</span>
                  </div>
                  <div class="divide-y divide-border/50">
                    <div
                      v-for="(cond, ci) in splitConditions(item.value || '')"
                      :key="ci"
                      class="flex items-center gap-2 px-3 py-1.5"
                    >
                      <Icon
                        :name="conditionIcon(cond)"
                        class="size-3.5 shrink-0"
                        :class="conditionTextColor(cond)"
                      />
                      <span class="text-sm" :class="conditionTextColor(cond)">{{ cond }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Interior Photos inline -->
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-image" class="size-4 text-primary" />
                Interior Photos
                <Badge variant="secondary" class="ml-auto text-xs">
                  {{ sectionImages(interiorImageKeys).length }} photos
                </Badge>
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                <div
                  v-for="(img, idx) in sectionImages(interiorImageKeys)"
                  :key="idx"
                  class="group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer border hover:border-primary/50 transition-colors"
                  @click="openLightbox(sectionImages(interiorImageKeys), idx)"
                >
                  <img :src="img.url" :alt="img.label" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy">
                  <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <Badge variant="secondary" class="absolute bottom-1 left-1 text-[9px] max-w-[calc(100%-8px)] truncate">
                    {{ img.label }}
                  </Badge>
                </div>
              </div>
              <p v-if="sectionImages(interiorImageKeys).length === 0" class="text-center text-muted-foreground text-sm py-8">
                No interior photos available
              </p>
            </CardContent>
          </Card>
        </div>

        <!-- ═══════ DOCUMENTS TAB ═══════ -->
        <div v-else-if="activeTab === 'documents'" class="space-y-6">
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-file-text" class="size-4 text-primary" />
                Document Images
                <Badge variant="secondary" class="ml-auto text-xs">
                  {{ sectionImages(documentImageKeys).length }} documents
                </Badge>
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                <div
                  v-for="(img, idx) in sectionImages(documentImageKeys)"
                  :key="idx"
                  class="group relative aspect-[4/3] rounded-lg overflow-hidden bg-muted cursor-pointer border hover:border-primary/50 transition-colors"
                  @click="openLightbox(sectionImages(documentImageKeys), idx)"
                >
                  <img :src="img.url" :alt="img.label" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy">
                  <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <Badge variant="secondary" class="absolute bottom-1.5 left-1.5 text-[10px] max-w-[calc(100%-12px)] truncate">
                    {{ img.label }}
                  </Badge>
                </div>
              </div>
              <p v-if="sectionImages(documentImageKeys).length === 0" class="text-center text-muted-foreground text-sm py-8">
                No document images available
              </p>
            </CardContent>
          </Card>

          <!-- Document Text Info -->
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-scan-text" class="size-4 text-primary" />
                Chassis & VIN
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
                <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40">
                  <p class="text-xs text-muted-foreground whitespace-nowrap">
                    Chassis Details
                  </p>
                  <p class="text-sm font-medium font-mono text-right">
                    {{ car.chassisDetails || car.chassisNumber || '—' }}
                  </p>
                </div>
                <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40">
                  <p class="text-xs text-muted-foreground whitespace-nowrap">
                    VIN Plate Details
                  </p>
                  <p class="text-sm font-medium font-mono text-right">
                    {{ car.vinPlateDetails || '—' }}
                  </p>
                </div>
                <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40">
                  <p class="text-xs text-muted-foreground whitespace-nowrap">
                    PUC Number
                  </p>
                  <p class="text-sm font-medium text-right">
                    {{ car.pucNumber || '—' }}
                  </p>
                </div>
                <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
                  <p class="text-xs text-muted-foreground whitespace-nowrap">
                    PUC Validity
                  </p>
                  <p class="text-sm font-medium text-right">
                    {{ formatDate(car.pucValidity) }}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- ═══════ AUCTION TAB ═══════ -->
        <div v-else-if="activeTab === 'auction'" class="space-y-6">
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-gavel" class="size-4 text-primary" />
                Auction Details
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                <div
                  v-for="item in [
                    { label: 'Price Discovery', value: car.priceDiscovery ? `₹${car.priceDiscovery.toLocaleString()}` : '—' },
                    { label: 'Price Discovery By', value: car.priceDiscoveryBy },
                    { label: 'Customer Expected Price', value: car.customerExpectedPrice ? `₹${car.customerExpectedPrice.toLocaleString()}` : '—' },
                    { label: 'Auction Status', value: car.auctionStatus },
                    { label: 'Auction Start', value: formatDate(car.auctionStartTime) },
                    { label: 'Auction End', value: formatDate(car.auctionEndTime) },
                    { label: 'Auction Duration', value: car.auctionDuration ? `${car.auctionDuration} hours` : '—' },
                    { label: 'Highest Bid', value: car.highestBid ? `₹${car.highestBid.toLocaleString()}` : '—' },
                    { label: 'Highest Bidder', value: car.highestBidder },
                    { label: 'One Click Price', value: car.oneClickPrice ? `₹${car.oneClickPrice.toLocaleString()}` : '—' },
                    { label: 'Otobuy Offer', value: car.otobuyOffer ? `₹${car.otobuyOffer.toLocaleString()}` : '—' },
                    { label: 'Sold At', value: car.soldAt ? `₹${car.soldAt.toLocaleString()}` : '—' },
                    { label: 'Sold To', value: car.soldTo },
                    { label: 'Fixed Margin', value: car.fixedMargin ? `${car.fixedMargin}%` : '—' },
                    { label: 'Variable Margin', value: car.variableMargin ? `${car.variableMargin}%` : '—' },
                    { label: 'Budget Car', value: car.budgetCar },
                    { label: 'KM Range Level', value: car.kmRangeLevel },
                    { label: 'Retail Associate', value: car.retailAssociate },
                  ]" :key="item.label" class="space-y-1"
                >
                  <p class="text-xs text-muted-foreground">
                    {{ item.label }}
                  </p>
                  <p class="text-sm font-medium">
                    {{ item.value || '—' }}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Approval -->
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-check-circle" class="size-4 text-primary" />
                Approval Info
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-0">
                <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40">
                  <p class="text-xs text-muted-foreground whitespace-nowrap">
                    Approved By
                  </p>
                  <p class="text-sm font-medium text-right">
                    {{ car.approvedBy || '—' }}
                  </p>
                </div>
                <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40">
                  <p class="text-xs text-muted-foreground whitespace-nowrap">
                    Approval Date
                  </p>
                  <p class="text-sm font-medium text-right">
                    {{ formatDate(car.approvalDate) }}
                  </p>
                </div>
                <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40">
                  <p class="text-xs text-muted-foreground whitespace-nowrap">
                    Approval Status
                  </p>
                  <Badge variant="outline" :class="car.approvalStatus === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/15 text-amber-600 border-amber-500/20'">
                    {{ car.approvalStatus || '—' }}
                  </Badge>
                </div>
                <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40">
                  <p class="text-xs text-muted-foreground whitespace-nowrap">
                    New Arrival Message
                  </p>
                  <p class="text-sm font-medium text-right">
                    {{ formatDate(car.newArrivalMessage) }}
                  </p>
                </div>
                <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40">
                  <p class="text-xs text-muted-foreground whitespace-nowrap">
                    Sent to Auction APK
                  </p>
                  <p class="text-sm font-medium text-right">
                    {{ formatDate(car.sendToAuctionApk) }}
                  </p>
                </div>
                <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
                  <p class="text-xs text-muted-foreground whitespace-nowrap">
                    Lat/Long
                  </p>
                  <p class="text-sm font-medium font-mono text-right">
                    {{ car.latlong || '—' }}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </template>

    <!-- Gallery Lightbox -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showLightbox" class="fixed inset-0 z-[100] bg-black/95 flex flex-col" @click.self="closeLightbox">
          <!-- Top bar: title + close -->
          <div class="shrink-0 flex items-center justify-between px-6 py-3 bg-black/60 backdrop-blur-sm border-b border-white/10">
            <div class="flex items-center gap-3 min-w-0">
              <Badge variant="outline" class="border-white/20 text-white/70 text-xs shrink-0">
                {{ lightboxIndex + 1 }} / {{ lightboxImages.length }}
              </Badge>
              <h3 class="text-white text-sm font-medium truncate">
                {{ lightboxImages[lightboxIndex]?.label || 'Image' }}
              </h3>
            </div>
            <button class="text-white/60 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10" @click="closeLightbox">
              <Icon name="i-lucide-x" class="size-5" />
            </button>
          </div>

          <!-- Main image area -->
          <div class="flex-1 min-h-0 flex items-center justify-center relative px-16" @click.self="closeLightbox">
            <!-- Prev -->
            <button
              v-if="lightboxImages.length > 1"
              class="absolute left-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all z-10 backdrop-blur-sm"
              @click="prevImage"
            >
              <Icon name="i-lucide-chevron-left" class="size-5" />
            </button>

            <!-- Image -->
            <img
              :key="lightboxIndex"
              :src="lightboxImages[lightboxIndex]?.url"
              :alt="lightboxImages[lightboxIndex]?.label"
              class="max-w-full max-h-full object-contain rounded-lg select-none animate-in fade-in duration-200"
            >

            <!-- Next -->
            <button
              v-if="lightboxImages.length > 1"
              class="absolute right-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all z-10 backdrop-blur-sm"
              @click="nextImage"
            >
              <Icon name="i-lucide-chevron-right" class="size-5" />
            </button>
          </div>

          <!-- Thumbnail strip -->
          <div v-if="lightboxImages.length > 1" class="shrink-0 bg-black/60 backdrop-blur-sm border-t border-white/10 px-6 py-3">
            <div class="flex gap-2 overflow-x-auto no-scrollbar justify-center max-w-full">
              <button
                v-for="(thumb, ti) in lightboxImages"
                :key="ti"
                :data-thumb-idx="ti"
                class="shrink-0 size-14 rounded-lg overflow-hidden border-2 transition-all duration-200"
                :class="ti === lightboxIndex ? 'border-primary ring-2 ring-primary/30 scale-105' : 'border-white/10 hover:border-white/30 opacity-60 hover:opacity-100'"
                @click="goToImage(ti)"
              >
                <img :src="thumb.url" :alt="thumb.label" class="w-full h-full object-cover" loading="lazy">
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
