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
const inspectionStatuses = ['Pending', 'Scheduled', 'Re-Scheduled', 'Under Inspection', 'Inspected', 'Cancelled']
const approvalStatuses = ['Pending', 'Under Review', 'Quality Approved', 'Quality Rejected']

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

// Ensure data is loaded (usually already prefetched by boot)
onMounted(() => {
  fetchAllLeads()   // no-op if already prefetched
  fetchCarDropdowns()
})

// ─── Instant Reveal Animation ───
const isRevealed = ref(false)
const isMounted = ref(true)
onBeforeUnmount(() => { isMounted.value = false })

watch(isFetched, (fetched) => {
  if (fetched && isMounted.value) {
    // Micro-delay for the browser to paint the DOM, then trigger CSS transition
    nextTick(() => {
      if (isMounted.value) {
        isRevealed.value = true
      }
    })
  }
}, { immediate: true })

// ─── Status Change + Inspector Assignment ───
const { apiBaseUrl } = useApiEnvironment()
const authToken = useCookie('authToken')
const { allUsers, fetchAllUsers } = usePeopleApi()

// Inspector users from people/otobix with role "Inspection Engineer"
const inspectors = computed(() =>
  allUsers.value.filter((u: any) => (u.isStaff === true || u.userRole === 'Inspection Engineer') && u.userRole === 'Inspection Engineer'),
)

onMounted(() => fetchAllUsers())

const showAssignDialog = ref(false)
const assigningLead = ref<any>(null)
const selectedInspector = ref('')
const isUpdatingStatus = ref(false)

async function updateLeadStatus(lead: any, field: string, newStatus: string) {
  // If changing inspection status to 'Scheduled', show inspector assignment dialog
  if (field === 'inspectionStatus' && newStatus === 'Scheduled') {
    assigningLead.value = { ...lead, _pendingStatus: newStatus }
    selectedInspector.value = lead.allocatedTo || ''
    showAssignDialog.value = true
    return
  }

  await doStatusUpdate(lead, { [field]: newStatus })
}

async function confirmAssignInspector() {
  if (!assigningLead.value)
    return
  const lead = assigningLead.value

  // Look up the inspector's phone number from the users list
  const inspectorUser = allUsers.value.find((u: any) => u.userName === selectedInspector.value)
  const inspectorPhone = inspectorUser?.phoneNumber || ''

  await doStatusUpdate(lead, {
    inspectionStatus: lead._pendingStatus || 'Scheduled',
    allocatedTo: selectedInspector.value,
    inspectionEngineerNumber: inspectorPhone,
  })
  showAssignDialog.value = false
  assigningLead.value = null
  selectedInspector.value = ''
}

async function doStatusUpdate(lead: any, updates: Record<string, string>) {
  isUpdatingStatus.value = true
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authToken.value)
      headers.Authorization = `Bearer ${authToken.value}`

    // Get logged-in user info for changedBy
    const userCookie = useCookie('userData')
    const currentUser = userCookie.value ? (typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value) : {}

    await $fetch<any>(
      `${apiBaseUrl.value}inspection/telecallings/update`,
      {
        method: 'PUT',
        headers,
        body: {
          telecallingId: lead._id || lead.id,
          appointmentId: lead.appointmentId,
          changedBy: currentUser?.userName || 'Admin',
          source: 'CRM',
          ...updates,
        },
      },
    )

    // Update local cache
    const leadId = lead._id || lead.id
    const idx = allLeads.value.findIndex((l: any) => (l._id || l.id) === leadId)
    if (idx !== -1) {
      Object.assign(allLeads.value[idx] as object, updates)
    }

    toast.success(`Status updated to ${Object.values(updates).join(', ')}`)
  }
  catch (err: any) {
    console.error('Status update failed:', err)
    toast.error(err?.data?.message || err?.message || 'Failed to update status')
  }
  finally {
    isUpdatingStatus.value = false
  }
}

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
  // '*' = match any value (wildcard)
  if (props.filters) {
    const filters = props.filters
    result = result.filter(item =>
      Object.entries(filters).every(([field, val]) =>
        val === '*' || String(item[field] ?? '').toLowerCase() === val.toLowerCase(),
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

// ─── Client-side infinite scroll (load more on scroll) ───
const BATCH_SIZE = 30
const visibleCount = ref(BATCH_SIZE)

// Reset visible count when search or filters change
watch(search, () => { visibleCount.value = BATCH_SIZE })

const totalFiltered = computed(() => filteredItems.value.length)
const hasMore = computed(() => visibleCount.value < totalFiltered.value)

const visibleItems = computed(() => {
  return filteredItems.value.slice(0, visibleCount.value)
})

function loadMore() {
  if (hasMore.value) {
    visibleCount.value = Math.min(visibleCount.value + BATCH_SIZE, totalFiltered.value)
  }
}

// IntersectionObserver for the scroll sentinel
const scrollSentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        loadMore()
      }
    },
    { rootMargin: '200px' },
  )
})

onBeforeUnmount(() => {
  observer?.disconnect()
})

watch(scrollSentinel, (el) => {
  observer?.disconnect()
  if (el) observer?.observe(el)
})

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
  if (!tab)
    return []
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

const isSaving = ref(false)

async function handleSave() {
  isSaving.value = true
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authToken.value)
      headers.Authorization = `Bearer ${authToken.value}`

    const userCookie = useCookie('userData')
    const currentUser = userCookie.value ? (typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value) : {}

    if (editingItem.value) {
      // Update existing lead
      await $fetch<any>(
        `${apiBaseUrl.value}inspection/telecallings/update`,
        {
          method: 'PUT',
          headers,
          body: {
            telecallingId: editingItem.value._id || editingItem.value.id,
            appointmentId: editingItem.value.appointmentId,
            changedBy: currentUser?.userName || 'Admin',
            source: 'CRM',
            ...formData.value,
          },
        },
      )

      // Update local cache
      const leadId = editingItem.value._id || editingItem.value.id
      const idx = allLeads.value.findIndex((l: any) => (l._id || l.id) === leadId)
      if (idx !== -1) {
        Object.assign(allLeads.value[idx] as object, formData.value)
      }

      toast.success(`${entity.value} updated successfully`)
    }
    else {
      toast.info(`Create ${entity.value} will be sent to API (coming soon)`)
    }
    showDialog.value = false
  }
  catch (err: any) {
    console.error('Save failed:', err)
    toast.error(err?.data?.message || err?.message || 'Failed to save')
  }
  finally {
    isSaving.value = false
  }
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
  if (value === null || value === undefined)
    return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value))
}

function formatDate(value: string): string {
  if (!value)
    return '—'
  try {
    return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  catch { return value }
}

function formatNumber(value: any): string {
  if (value === null || value === undefined)
    return '—'
  return new Intl.NumberFormat('en-US').format(Number(value))
}

function getInitials(name: string): string {
  if (!name)
    return '??'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}


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
        <p class="text-sm font-medium text-destructive">
          Failed to load leads
        </p>
        <p class="text-xs text-muted-foreground mt-0.5">
          {{ fetchError }}
        </p>
      </div>
      <Button variant="outline" size="sm" @click="handleRefresh">
        Retry
      </Button>
    </div>

    <!-- Ultra-minimal loading shimmer (only visible if data wasn't prefetched) -->
    <div v-else-if="!isFetched" class="flex-1 min-h-0 overflow-hidden">
      <div class="leads-shimmer">
        <div v-for="i in 12" :key="i" class="leads-shimmer-row" :style="{ animationDelay: `${i * 40}ms` }" />
      </div>
    </div>

    <!-- Table (scrollable) — instant reveal with smooth animation -->
    <div
      v-else
      class="flex-1 min-h-0 overflow-auto leads-table-reveal"
      :class="{ 'is-revealed': isRevealed }"
    >
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
            v-for="item in visibleItems"
            :key="item.id || item._id"
            class="group"
            :class="{ 'cursor-pointer hover:bg-muted/50': props.clickable }"
            @click="props.clickable && item.appointmentId ? router.push(`/inspection/${item.appointmentId}`) : undefined"
          >
            <TableCell v-for="col in columns" :key="col.key">
              <!-- Avatar -->
              <div v-if="col.type === 'avatar'" class="flex items-center gap-3">
                <Avatar class="size-8 border">
                  <AvatarImage v-if="item.avatar" :src="item.avatar" :alt="item[col.key]" />
                  <AvatarFallback class="text-xs">
                    {{ getInitials(item[col.key]) }}
                  </AvatarFallback>
                </Avatar>
                <span class="font-medium">{{ item[col.key] || '—' }}</span>
              </div>
              <!-- Clickable Badge (Status columns) -->
              <DropdownMenu v-else-if="col.type === 'badge' && (col.key === 'inspectionStatus' || col.key === 'approvalStatus')">
                <DropdownMenuTrigger as-child>
                  <Badge
                    variant="outline"
                    class="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
                    :class="[getBadgeClass(item[col.key]), col.key === 'inspectionStatus' ? 'uppercase' : '']"
                  >
                    {{ item[col.key] || '—' }}
                    <Icon name="i-lucide-chevron-down" class="size-3 ml-1 opacity-50" />
                  </Badge>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" class="min-w-[160px]">
                  <DropdownMenuLabel class="text-xs">
                    {{ col.label }}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    v-for="status in (col.key === 'inspectionStatus' ? inspectionStatuses : approvalStatuses)"
                    :key="status"
                    :class="{ 'bg-accent': item[col.key] === status }"
                    @click.stop="updateLeadStatus(item, col.key, status)"
                  >
                    <Badge variant="outline" :class="[getBadgeClass(status), col.key === 'inspectionStatus' ? 'uppercase' : '']" class="text-[10px] h-5">
                      {{ status }}
                    </Badge>
                    <Icon v-if="item[col.key] === status" name="i-lucide-check" class="ml-auto size-3.5 text-primary" />
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <!-- Other Badge columns -->
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
          <TableRow v-if="visibleItems.length === 0 && !isLoading">
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

      <!-- Scroll Sentinel for infinite loading -->
      <div v-if="hasMore" ref="scrollSentinel" class="flex items-center justify-center py-6">
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon name="i-lucide-loader-2" class="size-4 animate-spin" />
          Loading more...
        </div>
      </div>
    </div>

    <!-- Footer info bar -->
    <div v-if="isFetched && !fetchError" class="shrink-0 border-t bg-muted/30 px-4 lg:px-6 py-2 flex items-center justify-between">
      <p class="text-xs text-muted-foreground tabular-nums">
        Showing {{ visibleItems.length }} of {{ totalFiltered }} records
      </p>
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
              <Button variant="outline" type="button" :disabled="isSaving" @click="showDialog = false">
                Cancel
              </Button>
              <Button type="submit" :disabled="isSaving">
                <Icon v-if="isSaving" name="i-lucide-loader-2" class="mr-1.5 size-3.5 animate-spin" />
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

    <!-- Assign Inspector Dialog -->
    <Dialog v-model:open="showAssignDialog">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="i-lucide-user-check" class="size-5 text-blue-500" />
            Assign Inspector
          </DialogTitle>
          <DialogDescription>
            Select an inspector to assign for this scheduled inspection.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <!-- Lead Info -->
          <div v-if="assigningLead" class="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p class="text-sm font-medium">
              {{ assigningLead.ownerName || 'Unknown' }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ assigningLead.make }} {{ assigningLead.model }} — {{ assigningLead.carRegistrationNumber }}
            </p>
          </div>

          <!-- Inspector Select -->
          <div class="space-y-2">
            <Label for="inspector-select">Inspector</Label>
            <Select v-model="selectedInspector">
              <SelectTrigger id="inspector-select">
                <SelectValue placeholder="Select an inspector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="insp in inspectors" :key="insp._id || insp.id" :value="insp.userName">
                  <div class="flex items-center gap-2">
                    <Avatar class="size-5">
                      <AvatarFallback class="text-[9px]">
                        {{ insp.userName?.slice(0, 2)?.toUpperCase() }}
                      </AvatarFallback>
                    </Avatar>
                    {{ insp.userName }}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="inspectors.length === 0" class="text-xs text-muted-foreground">
              No inspectors found. Add users with role "Inspection Engineer" first.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showAssignDialog = false">
            Cancel
          </Button>
          <Button :disabled="!selectedInspector || isUpdatingStatus" @click="confirmAssignInspector">
            <Icon v-if="isUpdatingStatus" name="i-lucide-loader-2" class="mr-1.5 size-3.5 animate-spin" />
            <Icon v-else name="i-lucide-check" class="mr-1.5 size-3.5" />
            Assign & Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
/* ─── Instant Reveal Animation ─── */
.leads-table-reveal {
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.leads-table-reveal.is-revealed {
  opacity: 1;
  transform: translateY(0);
}

/* ─── Ultra-fast Shimmer (fallback for cold starts) ─── */
.leads-shimmer {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0;
  height: 100%;
}

.leads-shimmer-row {
  height: 40px;
  border-radius: 0;
  background: linear-gradient(
    90deg,
    hsl(var(--muted) / 0.3) 0%,
    hsl(var(--muted) / 0.6) 40%,
    hsl(var(--muted) / 0.3) 80%
  );
  background-size: 200% 100%;
  animation: shimmer-sweep 0.8s ease-in-out infinite;
  opacity: 0;
  animation: shimmer-sweep 0.8s ease-in-out infinite, shimmer-appear 0.2s ease forwards;
}

@keyframes shimmer-sweep {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes shimmer-appear {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 0.6;
    transform: translateX(0);
  }
}
</style>
