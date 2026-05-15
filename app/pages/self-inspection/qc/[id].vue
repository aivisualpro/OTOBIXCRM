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
const STATUS_META: Record<string, { label: string, dotClass: string, bgClass: string }> = {
  inspectionRequested: { label: 'Requested', dotClass: 'bg-amber-500', bgClass: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400' },
  inspectionApproved: { label: 'Approved', dotClass: 'bg-teal-500', bgClass: 'bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-400' },
  inspectionUnderReview: { label: 'Under Review', dotClass: 'bg-violet-500 animate-pulse', bgClass: 'bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-400' },
  inspectionRejected: { label: 'Rejected', dotClass: 'bg-red-500', bgClass: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400' },
  liveForBidding: { label: 'Live', dotClass: 'bg-emerald-500 animate-pulse', bgClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400' },
}

const currentStatus = computed(() => car.value?.auctionStatus || '')
const statusInfo = computed(() => STATUS_META[currentStatus.value] || { label: currentStatus.value || 'Unknown', dotClass: 'bg-gray-500', bgClass: 'bg-muted border-border text-muted-foreground' })

// ─── Image Fields ───
const imageFields = [
  { key: 'frontMainImage', label: 'Front Main' },
  { key: 'rhsFullImage', label: 'Right Side' },
  { key: 'rearMainImage', label: 'Rear Main' },
  { key: 'bootFloorImage', label: 'Boot Floor' },
  { key: 'lhsMainImage', label: 'Left Side' },
  { key: 'engineBayImage', label: 'Engine Bay' },
  { key: 'dashboardImage', label: 'Dashboard' },
]

// ─── QC Actions ───
const isApproving = ref(false)
const isRejecting = ref(false)
const showRejectDialog = ref(false)
const rejectReason = ref('')

const userCookie = useCookie('userData')
const currentUser = computed(() => {
  return typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value
})

async function handleApprove() {
  if (!car.value) return
  isApproving.value = true
  try {
    await $fetch(`/api/self-inspected/${carId}`, {
      method: 'PATCH',
      body: {
        auctionStatus: 'inspectionApproved',
        approvalStatus: 'Approved',
        qcApprovedBy: currentUser.value?.email || '',
        qcApprovedAt: new Date().toISOString(),
      },
    })
    car.value.auctionStatus = 'inspectionApproved'
    car.value.approvalStatus = 'Approved'
    toast.success('Inspection approved successfully')
  }
  catch (err: any) {
    toast.error(err?.data?.message || 'Failed to approve')
  }
  finally {
    isApproving.value = false
  }
}

async function handleReject() {
  if (!car.value || !rejectReason.value.trim()) {
    toast.error('Please provide a rejection reason')
    return
  }
  isRejecting.value = true
  try {
    await $fetch(`/api/self-inspected/${carId}`, {
      method: 'PATCH',
      body: {
        auctionStatus: 'inspectionRejected',
        approvalStatus: 'Rejected',
        inspectionStatus: 'Rejected',
        qcRejectedBy: currentUser.value?.email || '',
        qcRejectedAt: new Date().toISOString(),
        rejectionReason: rejectReason.value.trim(),
      },
    })
    car.value.auctionStatus = 'inspectionRejected'
    car.value.approvalStatus = 'Rejected'
    toast.success('Inspection rejected')
    showRejectDialog.value = false
    rejectReason.value = ''
  }
  catch (err: any) {
    toast.error(err?.data?.message || 'Failed to reject')
  }
  finally {
    isRejecting.value = false
  }
}

// ─── Editable Fields ───
const editableFields = ref<Record<string, any>>({})

const EDITABLE_KEYS = [
  'registrationNumber', 'make', 'model', 'variant', 'roadTaxValidity', 'taxValidTill',
  'registrationDate', 'fitnessValidity', 'engineNumber', 'chassisNumber', 'manufacturingDate',
  'fuelType', 'cubicCapacity', 'registrationState', 'registeredRTO', 'ownershipSerialNo',
  'registeredOwner', 'registeredAddressAsPerRC', 'hypothecationDetails', 'financierName',
  'insuranceValidity', 'rcStatus', 'blacklistStatus', 'pucValidityDate', 'pucNumber',
  'odometer', 'accidentalStatus', 'clutch', 'suspension', 'steering', 'brake', 'ac',
  'expectedDateOfCarHandover', 'expectedPrice', 'additionalNotes', 'userId',
  'auctionStatus', 'sellerContactNumber', 'qcBy', 'inspectionId', 'priceDiscovery',
]

watch(car, (val) => {
  if (val) {
    const obj: Record<string, any> = {}
    EDITABLE_KEYS.forEach(k => { obj[k] = val[k] ?? '' })
    editableFields.value = obj
  }
}, { immediate: true })

const isSavingFields = ref(false)

async function saveEditableFields() {
  isSavingFields.value = true
  try {
    // Only send fields that changed
    const body: Record<string, any> = {}
    EDITABLE_KEYS.forEach(k => {
      if (editableFields.value[k] !== (car.value?.[k] ?? '')) {
        body[k] = editableFields.value[k]
      }
    })
    if (Object.keys(body).length === 0) {
      toast.info('No changes to save')
      isSavingFields.value = false
      return
    }
    await $fetch(`/api/self-inspected/${carId}`, { method: 'PATCH', body })
    Object.assign(car.value, body)
    toast.success('Vehicle details updated')
  }
  catch (err: any) {
    toast.error(err?.data?.message || 'Failed to save changes')
  }
  finally {
    isSavingFields.value = false
  }
}

// ─── Sections for Left Column ───
const leftSections = computed(() => [
  {
    title: 'Vehicle Identity',
    icon: 'i-lucide-car',
    color: 'text-blue-500',
    fields: [
      { key: 'registrationNumber', label: 'Registration Number' },
      { key: 'make', label: 'Make' },
      { key: 'model', label: 'Model' },
      { key: 'variant', label: 'Variant' },
      { key: 'fuelType', label: 'Fuel Type' },
      { key: 'cubicCapacity', label: 'Cubic Capacity' },
      { key: 'odometer', label: 'Odometer' },
    ],
  },
  {
    title: 'Registration & Tax',
    icon: 'i-lucide-file-text',
    color: 'text-amber-500',
    fields: [
      { key: 'registrationDate', label: 'Registration Date' },
      { key: 'registrationState', label: 'Registration State' },
      { key: 'registeredRTO', label: 'Registered RTO' },
      { key: 'roadTaxValidity', label: 'Road Tax Validity' },
      { key: 'taxValidTill', label: 'Tax Valid Till' },
      { key: 'fitnessValidity', label: 'Fitness Validity' },
      { key: 'rcStatus', label: 'RC Status' },
    ],
  },
  {
    title: 'Ownership & Finance',
    icon: 'i-lucide-user-circle',
    color: 'text-emerald-500',
    fields: [
      { key: 'ownershipSerialNo', label: 'Ownership Serial No' },
      { key: 'registeredOwner', label: 'Registered Owner' },
      { key: 'registeredAddressAsPerRC', label: 'Registered Address' },
      { key: 'hypothecationDetails', label: 'Hypothecation Details' },
      { key: 'financierName', label: 'Financier Name' },
    ],
  },
  {
    title: 'Engine & Chassis',
    icon: 'i-lucide-settings',
    color: 'text-violet-500',
    fields: [
      { key: 'engineNumber', label: 'Engine Number' },
      { key: 'chassisNumber', label: 'Chassis Number' },
      { key: 'manufacturingDate', label: 'Manufacturing Date' },
    ],
  },
  {
    title: 'Compliance',
    icon: 'i-lucide-shield-check',
    color: 'text-cyan-500',
    fields: [
      { key: 'insuranceValidity', label: 'Insurance Validity' },
      { key: 'blacklistStatus', label: 'Blacklist Status' },
      { key: 'pucValidityDate', label: 'PUC Validity' },
      { key: 'pucNumber', label: 'PUC Number' },
    ],
  },
  {
    title: 'Condition',
    icon: 'i-lucide-wrench',
    color: 'text-rose-500',
    fields: [
      { key: 'accidentalStatus', label: 'Accidental Status' },
      { key: 'clutch', label: 'Clutch' },
      { key: 'suspension', label: 'Suspension' },
      { key: 'steering', label: 'Steering' },
      { key: 'brake', label: 'Brake' },
      { key: 'ac', label: 'AC' },
    ],
  },
  {
    title: 'Pricing & Handover',
    icon: 'i-lucide-indian-rupee',
    color: 'text-orange-500',
    fields: [
      { key: 'expectedPrice', label: 'Expected Price' },
      { key: 'priceDiscovery', label: 'Price Discovery' },
      { key: 'expectedDateOfCarHandover', label: 'Expected Handover Date' },
      { key: 'additionalNotes', label: 'Additional Notes' },
    ],
  },
  {
    title: 'Auction & Contact',
    icon: 'i-lucide-radio',
    color: 'text-indigo-500',
    fields: [
      { key: 'auctionStatus', label: 'Auction Status' },
      { key: 'userId', label: 'User ID' },
      { key: 'sellerContactNumber', label: 'Seller Contact' },
      { key: 'qcBy', label: 'QC By' },
      { key: 'inspectionId', label: 'Inspection ID' },
    ],
  },
])

// ─── Selected image for full preview ───
const selectedImage = ref<{ url: string, label: string } | null>(null)

function formatLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
}
</script>

<template>
  <div class="h-full overflow-hidden bg-background flex flex-col">
    <!-- ─── Loading ─── -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <div class="text-center space-y-3">
        <Icon name="i-lucide-loader-2" class="size-8 animate-spin text-muted-foreground mx-auto" />
        <p class="text-sm text-muted-foreground">Loading inspection...</p>
      </div>
    </div>

    <!-- ─── Error ─── -->
    <div v-else-if="fetchError" class="flex-1 flex items-center justify-center">
      <div class="text-center space-y-3">
        <Icon name="i-lucide-alert-circle" class="size-10 text-destructive mx-auto" />
        <p class="text-sm text-destructive font-medium">{{ fetchError }}</p>
        <Button variant="outline" size="sm" @click="router.back()">Go Back</Button>
      </div>
    </div>

    <!-- ─── Main Content ─── -->
    <template v-else-if="car">
      <!-- Sticky Header -->
      <div class="shrink-0 border-b bg-background/80 backdrop-blur-lg px-4 py-2.5 flex items-center justify-between gap-3 z-30">
        <div class="flex items-center gap-2.5 min-w-0">
          <Button variant="ghost" size="icon" class="size-7 shrink-0" @click="router.back()">
            <Icon name="i-lucide-arrow-left" class="size-3.5" />
          </Button>
          <Badge variant="outline" class="bg-violet-500/10 text-violet-600 border-violet-500/20 text-[10px] font-bold shrink-0">
            <Icon name="i-lucide-smartphone" class="size-3 mr-1" />
            Self Inspected QC
          </Badge>
          <Separator orientation="vertical" class="h-4" />
          <span class="text-sm font-semibold truncate">{{ car.make }} {{ car.model }}</span>
          <Badge v-if="car.registrationNumber" variant="outline" class="font-mono text-[10px] shrink-0">{{ car.registrationNumber }}</Badge>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <Badge variant="outline" :class="statusInfo.bgClass" class="text-xs font-semibold">
            <span class="size-1.5 rounded-full mr-1" :class="statusInfo.dotClass" />
            {{ statusInfo.label }}
          </Badge>
          <!-- Save -->
          <Button
            v-if="currentStatus === 'inspectionUnderReview'"
            size="sm"
            variant="outline"
            class="h-7 text-xs"
            :disabled="isSavingFields"
            @click="saveEditableFields"
          >
            <Icon :name="isSavingFields ? 'i-lucide-loader-2' : 'i-lucide-save'" class="size-3 mr-1" :class="{ 'animate-spin': isSavingFields }" />
            Save
          </Button>
          <!-- Approve -->
          <Button
            v-if="currentStatus === 'inspectionUnderReview'"
            size="sm"
            class="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
            :disabled="isApproving"
            @click="handleApprove"
          >
            <Icon :name="isApproving ? 'i-lucide-loader-2' : 'i-lucide-check'" class="size-3 mr-1" :class="{ 'animate-spin': isApproving }" />
            Approve
          </Button>
          <!-- Reject -->
          <Button
            v-if="currentStatus === 'inspectionUnderReview'"
            variant="destructive"
            size="sm"
            class="h-7 text-xs"
            @click="showRejectDialog = true"
          >
            <Icon name="i-lucide-x" class="size-3 mr-1" />
            Reject
          </Button>
        </div>
      </div>

      <!-- 3-Column Layout -->
      <div class="flex-1 flex gap-2 p-2 overflow-hidden min-h-0">
        <!-- ═══════════ LEFT: Vehicle Details (editable sections) ═══════════ -->
        <div class="flex-1 min-w-0 flex flex-col overflow-hidden rounded-xl border bg-card">
          <div class="shrink-0 px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2">
            <Icon name="i-lucide-clipboard-list" class="size-4 text-blue-500" />
            <h3 class="text-sm font-bold">Vehicle Details</h3>
            <span class="text-[10px] text-muted-foreground ml-auto">{{ EDITABLE_KEYS.length }} fields</span>
          </div>
          <div class="flex-1 overflow-y-auto p-3 space-y-3">
            <div v-for="section in leftSections" :key="section.title" class="rounded-lg border overflow-hidden">
              <!-- Section Header -->
              <div class="px-3 py-2 bg-muted/20 border-b flex items-center gap-2">
                <Icon :name="section.icon" class="size-3.5" :class="section.color" />
                <span class="text-[11px] font-bold uppercase tracking-wider" :class="section.color">{{ section.title }}</span>
              </div>
              <!-- Fields -->
              <div class="divide-y">
                <div v-for="field in section.fields" :key="field.key" class="flex items-center gap-2 px-3 py-1.5">
                  <label class="text-[10px] text-muted-foreground w-28 shrink-0 truncate">{{ field.label }}</label>
                  <Input
                    v-if="currentStatus === 'inspectionUnderReview'"
                    v-model="editableFields[field.key]"
                    class="h-7 text-xs flex-1"
                  />
                  <span v-else class="text-xs font-medium flex-1 truncate">
                    {{ car[field.key] || '—' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Timestamps (read-only) -->
            <div class="rounded-lg border overflow-hidden">
              <div class="px-3 py-2 bg-muted/20 border-b flex items-center gap-2">
                <Icon name="i-lucide-clock" class="size-3.5 text-gray-500" />
                <span class="text-[11px] font-bold uppercase tracking-wider text-gray-500">Timestamps</span>
              </div>
              <div class="divide-y">
                <div class="flex items-center gap-2 px-3 py-1.5">
                  <label class="text-[10px] text-muted-foreground w-28 shrink-0">Created</label>
                  <span class="text-xs font-medium">{{ formatDateFull(car.createdAt) }}</span>
                </div>
                <div class="flex items-center gap-2 px-3 py-1.5">
                  <label class="text-[10px] text-muted-foreground w-28 shrink-0">Updated</label>
                  <span class="text-xs font-medium">{{ formatDateFull(car.updatedAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══════════ MIDDLE: Images ═══════════ -->
        <div class="flex-1 min-w-0 flex flex-col overflow-hidden rounded-xl border bg-card">
          <div class="shrink-0 px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2">
            <Icon name="i-lucide-camera" class="size-4 text-rose-500" />
            <h3 class="text-sm font-bold">Inspection Photos</h3>
            <span class="text-[10px] text-muted-foreground ml-auto">{{ imageFields.filter(f => car[f.key]).length }}/{{ imageFields.length }}</span>
          </div>
          <div class="flex-1 overflow-y-auto p-3 space-y-2">
            <div
              v-for="img in imageFields"
              :key="img.key"
              class="rounded-lg border overflow-hidden group"
            >
              <div class="px-3 py-1.5 bg-muted/20 border-b flex items-center gap-2">
                <Icon name="i-lucide-image" class="size-3 text-muted-foreground" />
                <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{{ img.label }}</span>
                <Badge v-if="!car[img.key]" variant="outline" class="ml-auto text-[8px] text-red-500 border-red-500/20">Missing</Badge>
                <Badge v-else variant="outline" class="ml-auto text-[8px] text-emerald-600 border-emerald-500/20">✓</Badge>
              </div>
              <div v-if="car[img.key]" class="relative cursor-pointer" @click="selectedImage = { url: car[img.key], label: img.label }">
                <img
                  :src="car[img.key]"
                  :alt="img.label"
                  class="w-full aspect-[16/10] object-cover group-hover:scale-[1.02] transition-transform duration-300"
                />
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <Icon name="i-lucide-maximize-2" class="size-5 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow-md" />
                </div>
              </div>
              <div v-else class="aspect-[16/10] bg-muted/10 flex items-center justify-center">
                <Icon name="i-lucide-image-off" class="size-8 text-muted-foreground/15" />
              </div>
            </div>
          </div>
        </div>

        <!-- ═══════════ RIGHT: Attestr Payload ═══════════ -->
        <div class="flex-1 min-w-0 flex flex-col overflow-hidden rounded-xl border bg-card">
          <div class="shrink-0 px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2">
            <Icon name="i-lucide-scan-text" class="size-4 text-violet-500" />
            <h3 class="text-sm font-bold">Attestr Payload</h3>
            <span v-if="car.attestrPayload" class="text-[10px] text-muted-foreground ml-auto">{{ Object.keys(car.attestrPayload).length }} fields</span>
          </div>
          <div class="flex-1 overflow-y-auto">
            <div v-if="car.attestrPayload && Object.keys(car.attestrPayload).length > 0" class="divide-y">
              <div
                v-for="(value, key) in car.attestrPayload"
                :key="key"
                class="flex items-start gap-2 px-4 py-2 hover:bg-muted/20 transition-colors"
              >
                <span class="text-[9px] font-bold text-violet-500/70 uppercase tracking-widest w-32 shrink-0 pt-0.5 truncate" :title="formatLabel(String(key))">
                  {{ formatLabel(String(key)) }}
                </span>
                <span v-if="value === null || value === undefined" class="text-[11px] text-muted-foreground/50 italic">—</span>
                <span
                  v-else-if="typeof value === 'boolean'"
                  class="text-[11px] font-bold"
                  :class="value ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'"
                >{{ value ? 'Yes' : 'No' }}</span>
                <span v-else class="text-[11px] text-foreground font-medium leading-tight break-all flex-1">{{ value }}</span>
              </div>
            </div>
            <div v-else class="flex-1 flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Icon name="i-lucide-scan-text" class="size-8 opacity-20" />
              <p class="text-xs">No attestr data available</p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Image Preview Dialog -->
    <Dialog :open="!!selectedImage" @update:open="v => { if (!v) selectedImage = null }">
      <DialogContent class="sm:max-w-[80vw] max-h-[85vh] p-0 overflow-hidden">
        <DialogHeader class="sr-only">
          <DialogTitle>{{ selectedImage?.label || 'Image Preview' }}</DialogTitle>
        </DialogHeader>
        <div v-if="selectedImage" class="relative">
          <div class="absolute top-3 left-3 z-10">
            <Badge class="bg-black/60 text-white border-0 text-xs">{{ selectedImage.label }}</Badge>
          </div>
          <img :src="selectedImage.url" :alt="selectedImage.label" class="w-full max-h-[80vh] object-contain" />
        </div>
      </DialogContent>
    </Dialog>

    <!-- Reject Dialog -->
    <Dialog v-model:open="showRejectDialog">
      <DialogContent class="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="i-lucide-x-circle" class="size-4 text-destructive" />
            Reject Inspection
          </DialogTitle>
          <DialogDescription class="text-xs">
            Provide a reason for rejecting this self-inspection.
          </DialogDescription>
        </DialogHeader>
        <div class="py-4 space-y-3">
          <Label for="reject-reason">Rejection Reason</Label>
          <Textarea
            id="reject-reason"
            v-model="rejectReason"
            placeholder="e.g., Front main image not clear..."
            rows="3"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" @click="showRejectDialog = false">Cancel</Button>
          <Button variant="destructive" size="sm" :disabled="isRejecting || !rejectReason.trim()" @click="handleReject">
            <Icon :name="isRejecting ? 'i-lucide-loader-2' : 'i-lucide-x-circle'" class="mr-1 size-3.5" :class="{ 'animate-spin': isRejecting }" />
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
