<script setup lang="ts">
import { formatDateFull } from '~/lib/format'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const carId = route.params.id as string

const car = ref<any>(null)
const isLoading = ref(true)
const fetchError = ref('')

async function fetchCar() {
  isLoading.value = true
  fetchError.value = ''
  try {
    car.value = await $fetch<any>(`/api/self-inspected/${carId}`)
  }
  catch (err: any) {
    fetchError.value = err?.data?.message || 'Failed to load record'
  }
  finally {
    isLoading.value = false
  }
}

onMounted(fetchCar)

// ─── Status Meta ───
const STATUS_META: Record<string, { label: string, dotClass: string, bgClass: string, icon: string }> = {
  inspectionRequested: { label: 'Inspection Requested', dotClass: 'bg-amber-500', bgClass: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400', icon: 'i-lucide-clipboard-list' },
  inspectionApproved: { label: 'Inspection Approved', dotClass: 'bg-teal-500', bgClass: 'bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-400', icon: 'i-lucide-check-circle' },
  liveForBidding: { label: 'Live for Bidding', dotClass: 'bg-emerald-500 animate-pulse', bgClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400', icon: 'i-lucide-radio' },
  biddingEnded: { label: 'Bidding Ended', dotClass: 'bg-gray-500', bgClass: 'bg-muted border-border text-muted-foreground', icon: 'i-lucide-timer-off' },
  offerAccepted: { label: 'Offer Accepted', dotClass: 'bg-emerald-500', bgClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400', icon: 'i-lucide-badge-check' },
  movedToMarketplace: { label: 'Marketplace', dotClass: 'bg-blue-500', bgClass: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400', icon: 'i-lucide-store' },
}

const currentStatus = computed(() => car.value?.auctionStatus || '')
const statusInfo = computed(() => STATUS_META[currentStatus.value] || { label: currentStatus.value || 'Unknown', dotClass: 'bg-gray-500', bgClass: 'bg-muted border-border text-muted-foreground', icon: 'i-lucide-circle' })

// ─── Image Gallery ───
const imageFields = [
  { key: 'frontMainImage', label: 'Front Main' },
  { key: 'rhsFullImage', label: 'Right Side' },
  { key: 'rearMainImage', label: 'Rear Main' },
  { key: 'bootFloorImage', label: 'Boot Floor' },
  { key: 'lhsMainImage', label: 'Left Side' },
  { key: 'engineBayImage', label: 'Engine Bay' },
  { key: 'dashboardImage', label: 'Dashboard' },
]

const carImages = computed(() => {
  if (!car.value) return []
  return imageFields.filter(f => car.value[f.key]).map(f => ({ url: car.value[f.key], label: f.label }))
})

// ─── Active Tab ───
const activeTab = 'condition'

// ─── Copy ID ───
const truncatedId = computed(() => {
  const id = car.value?._id || ''
  if (id.length > 12) return `${id.slice(0, 8)}…${id.slice(-4)}`
  return id
})

function copyId() {
  if (!car.value?._id) return
  navigator.clipboard.writeText(car.value._id)
  toast.success('ID copied to clipboard')
}
</script>

<template>
  <div class="h-full overflow-auto bg-background">
    <!-- ─── Loading Skeleton ─── -->
    <div v-if="isLoading" class="space-y-6 p-6">
      <!-- Top bar skeleton -->
      <div class="flex items-center gap-4">
        <Skeleton class="size-9 rounded-lg" />
        <div class="space-y-2 flex-1">
          <Skeleton class="h-6 w-64" />
          <Skeleton class="h-4 w-48" />
        </div>
        <Skeleton class="h-7 w-28 rounded-full" />
      </div>
      <!-- Hero skeleton -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div class="lg:col-span-3">
          <Skeleton class="aspect-[16/10] rounded-2xl w-full" />
          <div class="flex gap-2 mt-3">
            <Skeleton v-for="i in 5" :key="i" class="w-16 h-12 rounded-lg shrink-0" />
          </div>
        </div>
        <div class="lg:col-span-2">
          <Skeleton class="h-full min-h-64 rounded-2xl" />
        </div>
      </div>
      <!-- Facts skeleton -->
      <Skeleton class="h-16 rounded-xl" />
      <!-- Tabs skeleton -->
      <Skeleton class="h-10 w-96 rounded-lg" />
      <Skeleton class="h-64 rounded-2xl" />
    </div>

    <!-- ─── Error State ─── -->
    <div v-else-if="fetchError" class="flex flex-col items-center justify-center h-64 gap-4">
      <Icon name="i-lucide-alert-circle" class="size-12 text-destructive" />
      <p class="text-destructive font-medium">{{ fetchError }}</p>
      <Button variant="outline" @click="router.back()">
        Go Back
      </Button>
    </div>

    <!-- ─── Main Content ─── -->
    <div v-else-if="car" class="space-y-6">
      <!-- A. Sticky Top Bar -->
      <div class="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border -mx-0 px-4 sm:px-6 py-3">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" class="shrink-0 size-8" @click="router.back()">
              <Icon name="i-lucide-arrow-left" class="size-4" />
            </Button>
            <!-- Breadcrumb (mobile: hidden) -->
            <div class="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
              <NuxtLink to="/self-inspection" class="hover:text-foreground transition-colors">
                Inspections
              </NuxtLink>
              <Icon name="i-lucide-chevron-right" class="size-3.5" />
              <span class="text-foreground font-medium truncate">{{ car.inspectionId || carId }}</span>
            </div>
          </div>

          <!-- Center: Vehicle Title -->
          <div class="flex-1 min-w-0 text-center hidden md:block">
            <div class="flex items-center justify-center gap-2.5">
              <h1 class="text-base font-semibold tracking-tight truncate">
                {{ car.make }} {{ car.model }}
                <span v-if="car.variant" class="text-muted-foreground font-normal"> · {{ car.variant }}</span>
              </h1>
              <Badge variant="outline" class="font-mono text-[10px] tracking-wide shrink-0">
                {{ car.registrationNumber }}
              </Badge>
            </div>
          </div>

          <!-- Right: Status + Actions -->
          <div class="flex items-center gap-2 shrink-0">
            <Badge variant="outline" :class="statusInfo.bgClass" class="text-xs font-semibold">
              <span class="size-1.5 rounded-full mr-1" :class="statusInfo.dotClass" />
              {{ statusInfo.label }}
            </Badge>
          </div>
        </div>
      </div>

      <!-- Mobile Title (visible below sticky bar on small screens) -->
      <div class="md:hidden px-4 -mt-2">
        <h1 class="text-xl font-bold tracking-tight">
          {{ car.make }} {{ car.model }}
        </h1>
        <div class="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
          <span v-if="car.variant">{{ car.variant }}</span>
          <span v-if="car.variant && car.registrationNumber">·</span>
          <span class="font-mono text-xs">{{ car.registrationNumber }}</span>
        </div>
      </div>

      <div class="px-4 sm:px-6 space-y-6 pb-8">
        <!-- B. Hero Section: Gallery (60%) + Auction Card (40%) -->
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <!-- Gallery -->
          <div class="lg:col-span-3">
            <InspectionHeroGallery v-if="carImages.length > 0" :images="carImages" />
            <div v-else class="aspect-[16/10] rounded-2xl bg-muted flex items-center justify-center">
              <div class="text-center text-muted-foreground">
                <Icon name="i-lucide-image-off" class="size-10 mx-auto mb-2" />
                <p class="text-sm">No images available</p>
              </div>
            </div>
          </div>

          <!-- Live Auction Card -->
          <div class="lg:col-span-2">
            <InspectionLiveAuctionCard :car="car" />
          </div>
        </div>

        <!-- C. Quick-Facts Strip -->
        <InspectionQuickFacts :car="car" />

        <!-- D. Tabbed Detail Section -->
        <Tabs :default-value="activeTab" class="w-full">
          <TabsList class="w-full sm:w-auto grid grid-cols-4 sm:inline-flex gap-1 bg-muted/50 p-1 rounded-lg">
            <TabsTrigger value="condition" class="text-xs sm:text-sm gap-1.5">
              <Icon name="i-lucide-wrench" class="size-3.5 hidden sm:block" />
              Condition
            </TabsTrigger>
            <TabsTrigger value="auction" class="text-xs sm:text-sm gap-1.5">
              <Icon name="i-lucide-trending-up" class="size-3.5 hidden sm:block" />
              Auction
            </TabsTrigger>
            <TabsTrigger value="registration" class="text-xs sm:text-sm gap-1.5">
              <Icon name="i-lucide-file-text" class="size-3.5 hidden sm:block" />
              Registration
            </TabsTrigger>
            <TabsTrigger value="photos" class="text-xs sm:text-sm gap-1.5">
              <Icon name="i-lucide-camera" class="size-3.5 hidden sm:block" />
              Photos
            </TabsTrigger>
          </TabsList>

          <div class="mt-6">
            <TabsContent value="condition" class="mt-0">
              <div class="rounded-2xl border bg-card p-6">
                <InspectionConditionTab :car="car" />
              </div>
            </TabsContent>

            <TabsContent value="auction" class="mt-0">
              <div class="rounded-2xl border bg-card p-6">
                <InspectionAuctionTab :car="car" />
              </div>
            </TabsContent>

            <TabsContent value="registration" class="mt-0">
              <div class="rounded-2xl border bg-card p-6">
                <InspectionRegistrationTab :car="car" />
              </div>
            </TabsContent>

            <TabsContent value="photos" class="mt-0">
              <div class="rounded-2xl border bg-card p-6">
                <InspectionPhotosTab v-if="carImages.length > 0" :images="carImages" />
                <div v-else class="py-12 text-center text-muted-foreground">
                  <Icon name="i-lucide-image-off" class="size-10 mx-auto mb-2" />
                  <p class="text-sm">No photos available</p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <!-- E. Footer Meta Row -->
        <div class="rounded-xl border bg-muted/30 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div class="flex items-center gap-3 flex-wrap">
            <span>Created {{ formatDateFull(car.createdAt) }}</span>
            <span class="text-border">·</span>
            <span>Updated {{ formatDateFull(car.updatedAt) }}</span>
            <span class="text-border">·</span>
            <button
              class="font-mono text-[10px] hover:text-foreground transition-colors inline-flex items-center gap-1 cursor-pointer"
              @click="copyId"
            >
              ID: {{ truncatedId }}
              <Icon name="i-lucide-copy" class="size-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
