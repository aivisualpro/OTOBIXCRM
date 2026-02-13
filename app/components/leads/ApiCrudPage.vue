<script setup lang="ts">
import type { CrudColumn, CrudFormField } from '~/composables/useCrud'
import { toast } from 'vue-sonner'

const props = defineProps<{
  title: string
  description: string
  icon: string
  entityName?: string
  columns: CrudColumn[]
  formFields: CrudFormField[]
  filters?: Record<string, string>
  clickable?: boolean
}>()

const router = useRouter()

const entity = computed(() => props.entityName || 'Lead')

const { setHeader } = usePageHeader()
setHeader({ title: props.title, description: props.description, icon: props.icon })

// ─── Global cached data ───
const {
  allLeads,
  isLoading,
  isFetched,
  fetchError,
  fetchAllLeads,
  refreshLeads,
} = useLeadsApi()

// Car dropdowns for Make / Model / Variant
const {
  makes: carMakes,
  getModels: getCarModels,
  getVariants: getCarVariants,
  fetchCarDropdowns,
} = useCarDropdowns()

// Fetch all leads + car dropdowns once
onMounted(() => {
  fetchAllLeads()
  fetchCarDropdowns()
})


// ─── UI State ───
const search = ref('')
const showDialog = ref(false)
const showDeleteDialog = ref(false)
const editingItem = ref<any>(null)
const deletingItem = ref<any>(null)
const formData = ref<Record<string, any>>({})

// Cascading: computed models/variants based on current form selection
const availableModels = computed(() => formData.value.make ? getCarModels(formData.value.make) : [])
const availableVariants = computed(() =>
  formData.value.make && formData.value.model
    ? getCarVariants(formData.value.make, formData.value.model)
    : [],
)

// When make changes, reset model + variant
watch(() => formData.value.make, (newMake, oldMake) => {
  if (oldMake !== undefined && newMake !== oldMake) {
    formData.value.model = ''
    formData.value.variant = ''
  }
})

// When model changes, reset variant
watch(() => formData.value.model, (newModel, oldModel) => {
  if (oldModel !== undefined && newModel !== oldModel) {
    formData.value.variant = ''
  }
})

// ─── Client-side filtering by inspectionStatus + approvalStatus ───
const filteredItems = computed(() => {
  let result = allLeads.value as Record<string, any>[]

  // Apply route-specific filters (e.g. inspectionStatus=Pending, approvalStatus=Pending)
  if (props.filters) {
    const filters = props.filters
    result = result.filter(item =>
      Object.entries(filters).every(([field, val]) =>
        String(item[field] ?? '').toLowerCase() === val.toLowerCase(),
      ),
    )
  }

  // Apply search across visible columns
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(item =>
      props.columns.some(col =>
        String(item[col.key] ?? '').toLowerCase().includes(q),
      ),
    )
  }

  return result
})

// ─── Client-side pagination (30 per page) ───
const PER_PAGE = 30
const currentPage = ref(1)

// Reset page when search or filters change
watch(search, () => { currentPage.value = 1 })

const totalFiltered = computed(() => filteredItems.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalFiltered.value / PER_PAGE)))

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * PER_PAGE
  return filteredItems.value.slice(start, start + PER_PAGE)
})

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
}

// ─── Pagination display helpers ───
const showingFrom = computed(() => totalFiltered.value === 0 ? 0 : ((currentPage.value - 1) * PER_PAGE) + 1)
const showingTo = computed(() => Math.min(currentPage.value * PER_PAGE, totalFiltered.value))

// ─── Form Tabs ───
const activeTab = ref('owner')

const formTabs = [
  { id: 'owner', label: 'Owner Info', icon: 'i-lucide-user', keys: ['ownerName', 'customerContactNumber', 'emailAddress', 'ownershipSerialNumber'] },
  { id: 'vehicle', label: 'Vehicle', icon: 'i-lucide-car', keys: ['carRegistrationNumber', 'make', 'model', 'variant', 'yearOfRegistration', 'yearOfManufacture', 'odometerReadingInKms'] },
  { id: 'location', label: 'Location', icon: 'i-lucide-map-pin', keys: ['city', 'zipCode', 'inspectionAddress', 'inspectionDateTime'] },
  { id: 'status', label: 'Status', icon: 'i-lucide-settings', keys: ['inspectionStatus', 'approvalStatus', 'priority', 'appointmentSource', 'allocatedTo', 'repName', 'repContact', 'bankSource', 'referenceName'] },
  { id: 'notes', label: 'Notes', icon: 'i-lucide-file-text', keys: ['remarks', 'additionalNotes'] },
]

function getFieldsForTab(tabId: string) {
  const tab = formTabs.find(t => t.id === tabId)
  if (!tab) return []
  return props.formFields.filter(f => tab.keys.includes(f.key))
}

// ─── CRUD Handlers ───
function openCreate() {
  editingItem.value = null
  formData.value = {}
  props.formFields.forEach((f) => {
    formData.value[f.key] = ''
  })
  activeTab.value = 'owner'
  showDialog.value = true
}

function openEdit(item: any) {
  editingItem.value = item
  formData.value = { ...item }
  activeTab.value = 'owner'
  showDialog.value = true
}

function handleSave() {
  if (editingItem.value) {
    toast.info(`Update for ${entity.value} will be sent to API (coming soon)`)
  }
  else {
    toast.info(`Create ${entity.value} will be sent to API (coming soon)`)
  }
  showDialog.value = false
}

function confirmDelete(item: any) {
  deletingItem.value = item
  showDeleteDialog.value = true
}

function handleDelete() {
  if (deletingItem.value) {
    toast.info(`Delete ${entity.value} will be sent to API (coming soon)`)
  }
  showDeleteDialog.value = false
  deletingItem.value = null
}

async function handleRefresh() {
  await refreshLeads()
  toast.success('Data refreshed from server')
}

// ─── Formatters ───
const badgeClasses: Record<string, string> = {
  'Pending': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Scheduled': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Re-Scheduled': 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  'Under Inspection': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Cancelled': 'bg-red-500/10 text-red-600 border-red-500/20',
  'Inspected': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Under Review': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'Quality Approved': 'bg-teal-500/10 text-teal-600 border-teal-500/20',
  'Quality Rejected': 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  'High': 'bg-red-500/10 text-red-600 border-red-500/20',
  'Medium': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Low': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Approved': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Rejected': 'bg-red-500/10 text-red-600 border-red-500/20',
  'Customer': 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  'Admin': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'New': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
}

function getBadgeClass(value: string): string {
  return badgeClasses[value] || 'bg-gray-500/10 text-gray-600 border-gray-500/20'
}

function formatCurrency(value: any): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value))
}

function formatDate(value: string): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  catch { return value }
}

function formatNumber(value: any): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US').format(Number(value))
}

function getInitials(name: string): string {
  if (!name) return '??'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Pagination page numbers with ellipsis ───
const pageNumbers = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages: (number | string)[] = [1]
  if (current > 3) pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i)
  }
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
})
</script>

<template>
  <!-- Teleport toolbar into the main header -->
  <Teleport to="#header-actions">
    <div class="relative">
      <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
      <Input v-model="search" placeholder="Search leads..." class="pl-8 h-8 w-48 text-sm" />
    </div>
    <p class="text-xs text-muted-foreground tabular-nums hidden sm:block whitespace-nowrap">
      {{ totalFiltered }} record{{ totalFiltered !== 1 ? 's' : '' }}
    </p>
    <Button variant="ghost" size="sm" class="h-8" :disabled="isLoading" @click="handleRefresh">
      <Icon name="i-lucide-refresh-cw" class="mr-1 size-3.5" :class="{ 'animate-spin': isLoading }" />
      Refresh
    </Button>
    <Button size="sm" class="h-8" @click="openCreate">
      <Icon name="i-lucide-plus" class="mr-1 size-3.5" />
      Add {{ entity }}
    </Button>
  </Teleport>

  <div class="w-full flex flex-col h-full overflow-hidden">

    <!-- Error Banner -->
    <div v-if="fetchError" class="shrink-0 m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
      <Icon name="i-lucide-alert-circle" class="size-5 text-destructive shrink-0" />
      <div class="flex-1">
        <p class="text-sm font-medium text-destructive">Failed to load leads</p>
        <p class="text-xs text-muted-foreground mt-0.5">{{ fetchError }}</p>
      </div>
      <Button variant="outline" size="sm" @click="handleRefresh">
        Retry
      </Button>
    </div>

    <!-- Loading State -->
    <div v-if="!isFetched && !fetchError" class="flex-1 min-h-0 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-muted-foreground">
        <Icon name="i-lucide-loader-2" class="size-8 animate-spin" />
        <p class="text-sm">Loading leads...</p>
      </div>
    </div>

    <!-- Table (scrollable) -->
    <div v-else-if="!fetchError" class="flex-1 min-h-0 overflow-auto">
      <Table>
        <TableHeader class="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm">
          <TableRow>
            <TableHead v-for="col in columns" :key="col.key">
              {{ col.label }}
            </TableHead>
            <TableHead class="w-[80px] text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="item in paginatedItems"
            :key="item.id || item._id"
            class="group"
            :class="{ 'cursor-pointer hover:bg-muted/50': props.clickable }"
            @click="props.clickable && item.appointmentId ? router.push(`/inspection/${item.appointmentId}`) : undefined"
          >
            <TableCell v-for="col in columns" :key="col.key">
              <!-- Avatar -->
              <div v-if="col.type === 'avatar'" class="flex items-center gap-3">
                <Avatar class="size-8 border">
                  <AvatarImage :src="item.avatar" :alt="item[col.key]" />
                  <AvatarFallback class="text-xs">
                    {{ getInitials(item[col.key]) }}
                  </AvatarFallback>
                </Avatar>
                <span class="font-medium">{{ item[col.key] || '—' }}</span>
              </div>
              <!-- Badge -->
              <Badge v-else-if="col.type === 'badge'" variant="outline" :class="getBadgeClass(item[col.key])">
                {{ item[col.key] || '—' }}
              </Badge>
              <!-- Currency -->
              <span v-else-if="col.type === 'currency'" class="font-medium tabular-nums">
                {{ formatCurrency(item[col.key]) }}
              </span>
              <!-- Date -->
              <span v-else-if="col.type === 'date'" class="text-muted-foreground text-sm">
                {{ formatDate(item[col.key]) }}
              </span>
              <!-- Number -->
              <span v-else-if="col.type === 'number'" class="tabular-nums">
                {{ formatNumber(item[col.key]) }}
              </span>
              <!-- Progress -->
              <div v-else-if="col.type === 'progress'" class="flex items-center gap-2">
                <Progress :model-value="Number(item[col.key])" class="h-2 w-20" />
                <span class="text-sm tabular-nums text-muted-foreground">{{ item[col.key] }}%</span>
              </div>
              <!-- Tags -->
              <div v-else-if="col.type === 'tags'" class="flex flex-wrap gap-1">
                <Badge v-for="tag in (item[col.key] || [])" :key="tag" variant="secondary" class="text-xs font-normal">
                  {{ tag }}
                </Badge>
              </div>
              <!-- Default text -->
              <span v-else class="text-sm">{{ item[col.key] ?? '—' }}</span>
            </TableCell>
            <TableCell class="text-right">
              <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" class="size-8" @click="openEdit(item)">
                  <Icon name="i-lucide-pencil" class="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" class="size-8 text-destructive hover:text-destructive" @click="confirmDelete(item)">
                  <Icon name="i-lucide-trash-2" class="size-3.5" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
          <TableRow v-if="paginatedItems.length === 0 && !isLoading">
            <TableCell :colspan="columns.length + 1" class="h-32 text-center">
              <div class="flex flex-col items-center gap-2 text-muted-foreground">
                <Icon name="i-lucide-inbox" class="size-8" />
                <p>No leads found</p>
                <Button size="sm" variant="outline" @click="openCreate">
                  <Icon name="i-lucide-plus" class="mr-1 size-4" />
                  Add {{ entity }}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Loading Skeleton -->
    <div v-else-if="isLoading" class="flex-1 p-8">
      <div class="space-y-4">
        <Skeleton class="h-8 w-full" />
        <Skeleton class="h-8 w-full" />
        <Skeleton class="h-8 w-full" />
        <Skeleton class="h-8 w-full" />
        <Skeleton class="h-8 w-3/4" />
      </div>
    </div>

    <!-- Pagination Bar (pinned to bottom) -->
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

    <!-- Create/Edit Dialog -->
    <Dialog v-model:open="showDialog">
      <DialogContent class="sm:max-w-[600px] p-0 gap-0">
        <DialogHeader class="p-6 pb-4">
          <DialogTitle>{{ editingItem ? 'Edit' : 'New' }} {{ entity }}</DialogTitle>
          <DialogDescription class="sr-only">
            {{ editingItem ? 'Edit' : 'Create' }} a {{ entity.toLowerCase() }} record
          </DialogDescription>
        </DialogHeader>

        <form @submit.prevent="handleSave">
          <!-- Tab Navigation -->
          <div class="border-b px-6">
            <div class="flex gap-1 -mb-px overflow-x-auto no-scrollbar">
              <button
                v-for="tab in formTabs"
                :key="tab.id"
                type="button"
                class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
                :class="activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'"
                @click="activeTab = tab.id"
              >
                <Icon :name="tab.icon" class="size-3.5" />
                {{ tab.label }}
              </button>
            </div>
          </div>

          <!-- Tab Content -->
          <div class="p-6 min-h-[320px]">
            <div class="space-y-4">
              <div v-for="field in getFieldsForTab(activeTab)" :key="field.key" class="space-y-2">
                <Label :for="field.key">{{ field.label }}</Label>

                <!-- Car Make dropdown -->
                <Select v-if="field.key === 'make'" v-model="formData.make">
                  <SelectTrigger>
                    <SelectValue placeholder="Select make" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="m in carMakes" :key="m" :value="m">
                      {{ m }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <!-- Car Model dropdown (filtered by make) -->
                <Select v-else-if="field.key === 'model'" v-model="formData.model" :disabled="!formData.make">
                  <SelectTrigger>
                    <SelectValue :placeholder="formData.make ? 'Select model' : 'Select make first'" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="m in availableModels" :key="m" :value="m">
                      {{ m }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <!-- Car Variant dropdown (filtered by make + model) -->
                <Select v-else-if="field.key === 'variant'" v-model="formData.variant" :disabled="!formData.model">
                  <SelectTrigger>
                    <SelectValue :placeholder="formData.model ? 'Select variant' : 'Select model first'" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="v in availableVariants" :key="v" :value="v">
                      {{ v }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <!-- Regular select fields -->
                <Select v-else-if="field.type === 'select'" v-model="formData[field.key]">
                  <SelectTrigger>
                    <SelectValue :placeholder="field.placeholder || `Select ${field.label.toLowerCase()}`" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="opt in field.options" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  v-else-if="field.type === 'textarea'"
                  :id="field.key"
                  v-model="formData[field.key]"
                  :placeholder="field.placeholder"
                  rows="3"
                />
                <Input
                  v-else
                  :id="field.key"
                  v-model="formData[field.key]"
                  :type="field.type || 'text'"
                  :placeholder="field.placeholder"
                />
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="border-t p-6 pt-4 flex items-center justify-between">
            <p class="text-xs text-muted-foreground">
              {{ formTabs.findIndex(t => t.id === activeTab) + 1 }} of {{ formTabs.length }}
            </p>
            <div class="flex gap-2">
              <Button variant="outline" type="button" @click="showDialog = false">
                Cancel
              </Button>
              <Button type="submit">
                {{ editingItem ? 'Update' : 'Create' }}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation -->
    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this {{ entity.toLowerCase() }} record.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-destructive-foreground hover:bg-destructive/90" @click="handleDelete">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
