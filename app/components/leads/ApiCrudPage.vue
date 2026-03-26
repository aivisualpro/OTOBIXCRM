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

// ─── Incremental data loading ───
const {
  allLeads,
  totalCount,
  hasMore: serverHasMore,
  isLoading,
  isLoadingMore,
  isFetched,
  fetchError,
  fetchLeads,
  loadMore: loadMoreFromServer,
  searchLeads,
  refreshLeads,
  fetchCounts,
  setFilters,
} = useLeadsApi()

// Car dropdowns for Make / Model / Variant
const {
  makes: carMakes,
  getModels: getCarModels,
  getVariants: getCarVariants,
  fetchCarDropdowns,
  isLoading: isCarLoading,
} = useCarDropdowns()

// City dropdown from DB
const { getOptions: getDbOptions, fetchDropdowns: fetchDbDropdowns } = useDropdowns()
const cityOptions = ref<{ label: string, value: string }[]>([])

// Ensure data is loaded with server-side status filters
onMounted(async () => {
  if (props.filters) {
    setFilters(props.filters)
  }
  else {
    fetchLeads()
  }
  fetchCarDropdowns({ limit: 500 })
  await fetchDbDropdowns()
  cityOptions.value = getDbOptions('Inspection City')
})

// Re-apply server filters when route changes (e.g. switching tabs)
watch(() => props.filters, (newFilters) => {
  if (newFilters) {
    setFilters(newFilters)
  }
}, { deep: true })

// ─── Instant Reveal Animation ───
const isRevealed = ref(false)
const isMounted = ref(true)
onBeforeUnmount(() => { isMounted.value = false })

watch(isFetched, (fetched) => {
  if (fetched && isMounted.value) {
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

const inspectors = computed(() =>
  allUsers.value.filter((u: any) => (u.isStaff === true || u.userRole === 'Inspection Engineer') && u.userRole === 'Inspection Engineer'),
)

onMounted(() => fetchAllUsers())

const showAssignDialog = ref(false)
const assigningLead = ref<any>(null)
const selectedInspector = ref('')
const isUpdatingStatus = ref(false)

async function updateLeadStatus(lead: any, field: string, newStatus: string) {
  if (field === 'inspectionStatus' && newStatus === 'Scheduled') {
    assigningLead.value = { ...lead, _pendingStatus: newStatus }
    selectedInspector.value = lead.allocatedTo || ''
    showAssignDialog.value = true
    return
  }
  await doStatusUpdate(lead, { [field]: newStatus })
}

async function confirmAssignInspector() {
  if (!assigningLead.value) return
  const lead = assigningLead.value
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
    const userCookie = useCookie('userData')
    const currentUser = userCookie.value ? (typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value) : {}

    await $fetch<any>('/api/leads/update', {
      method: 'PUT',
      body: {
        telecallingId: lead._id || lead.id,
        changedBy: currentUser?.userName || 'Admin',
        ...updates,
      },
    })

    const leadId = lead._id || lead.id
    const idx = allLeads.value.findIndex((l: any) => (l._id || l.id) === leadId)
    if (idx !== -1) {
      Object.assign(allLeads.value[idx] as object, updates)
    }

    // Refresh counts after status change
    fetchCounts()
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

// When make changes, fetch it and reset model + variant
watch(() => formData.value.make, async (newMake, oldMake) => {
  if (newMake && oldMake !== undefined && newMake !== oldMake) {
    formData.value.model = ''
    formData.value.variant = ''
    await fetchCarDropdowns({ search: newMake, limit: 1000 })
  }
})

// When model changes, reset variant
watch(() => formData.value.model, (newModel, oldModel) => {
  if (oldModel !== undefined && newModel !== oldModel) {
    formData.value.variant = ''
  }
})

// ─── Client-side route filtering (on already-loaded data) ───
const filteredItems = computed(() => {
  let result = allLeads.value as Record<string, any>[]

  // Apply route-specific filters (inspectionStatus/approvalStatus)
  // '*' = match any value (wildcard)
  if (props.filters) {
    const filters = props.filters
    result = result.filter(item =>
      Object.entries(filters).every(([field, val]) =>
        val === '*' || String(item[field] ?? '').toLowerCase() === val.toLowerCase(),
      ),
    )
  }

  return result
})

const totalFiltered = computed(() => filteredItems.value.length)

// ─── Search triggers server-side query ───
watch(search, (q) => {
  searchLeads(q)
})

// ─── IntersectionObserver for infinite scroll (loads from server) ───
const scrollSentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && serverHasMore.value) {
        loadMoreFromServer()
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
  if (el)
    observer?.observe(el)
})

// ─── Form Tabs ───
const activeTab = ref('owner')
const tabValidationErrors = ref<Record<string, string>>({})

const formTabs = [
  { id: 'owner', label: 'Owner Info', icon: 'i-lucide-user', keys: ['ownerName', 'customerContactNumber', 'carRegistrationNumber', 'emailAddress', 'ownershipSerialNumber'] },
  { id: 'vehicle', label: 'Vehicle', icon: 'i-lucide-car', keys: ['vehicleStatus', 'make', 'model', 'variant', 'yearOfRegistration', 'yearOfManufacture', 'odometerReadingInKms'] },
  { id: 'location', label: 'Location', icon: 'i-lucide-map-pin', keys: ['city', 'zipCode', 'inspectionAddress', 'inspectionDateTime'] },
  { id: 'status', label: 'Status', icon: 'i-lucide-settings', keys: ['inspectionStatus', 'approvalStatus', 'priority', 'appointmentSource', 'allocatedTo', 'repName', 'repContact', 'bankSource', 'referenceName'] },
  { id: 'notes', label: 'Notes', icon: 'i-lucide-file-text', keys: ['remarks', 'additionalNotes'] },
]

const currentTabIndex = computed(() => formTabs.findIndex(t => t.id === activeTab.value))
const isFirstTab = computed(() => currentTabIndex.value === 0)
const isLastTab = computed(() => currentTabIndex.value === formTabs.length - 1)

function getFieldsForTab(tabId: string) {
  const tab = formTabs.find(t => t.id === tabId)
  if (!tab)
    return []
  return props.formFields.filter((f) => {
    // Basic tab check
    if (!tab.keys.includes(f.key))
      return false
    // Hide fields on create if needed
    if (!editingItem.value && f.hideOnCreate)
      return false
    return true
  }).map((f) => {
    // Overrides: if city field and we have DB options, use them
    if (f.key === 'city' && cityOptions.value.length > 0) {
      return { ...f, options: cityOptions.value }
    }
    return f
  })
}

function validateCurrentTab(): boolean {
  tabValidationErrors.value = {}
  const fields = getFieldsForTab(activeTab.value)
  let valid = true
  for (const field of fields) {
    if (field.required) {
      const value = formData.value[field.key]
      if (value === undefined || value === null || String(value).trim() === '') {
        tabValidationErrors.value[field.key] = `${field.label} is required`
        valid = false
      }
    }
  }
  return valid
}

function handleNextTab() {
  if (!validateCurrentTab()) {
    toast.error('Please fill in all required fields')
    return
  }
  const nextIndex = currentTabIndex.value + 1
  if (nextIndex < formTabs.length) {
    activeTab.value = formTabs[nextIndex]!.id
  }
}

function handlePrevTab() {
  tabValidationErrors.value = {}
  const prevIndex = currentTabIndex.value - 1
  if (prevIndex >= 0) {
    activeTab.value = formTabs[prevIndex]!.id
  }
}

// ─── CRUD Handlers ───
function openCreate() {
  editingItem.value = null
  formData.value = {}
  props.formFields.forEach((f) => {
    formData.value[f.key] = f.defaultValue !== undefined ? f.defaultValue : ''
  })
  activeTab.value = 'owner'
  tabValidationErrors.value = {}
  showDialog.value = true
}

function openEdit(item: any) {
  editingItem.value = item
  formData.value = { ...item }
  activeTab.value = 'owner'
  tabValidationErrors.value = {}
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
      // Update existing lead via local MongoDB route
      await $fetch<any>('/api/leads/update', {
        method: 'PUT',
        body: {
          telecallingId: editingItem.value._id || editingItem.value.id,
          changedBy: currentUser?.userName || 'Admin',
          ...formData.value,
        },
      })

      // Update local cache
      const leadId = editingItem.value._id || editingItem.value.id
      const idx = allLeads.value.findIndex((l: any) => (l._id || l.id) === leadId)
      if (idx !== -1) {
        Object.assign(allLeads.value[idx] as object, formData.value)
      }

      toast.success(`${entity.value} updated successfully`)
    }
    else {
      // Create new lead — direct MongoDB via local server route
      const payload = {
        ...formData.value,
        addedBy: currentUser?.userName || 'Admin',
        changedBy: currentUser?.userName || 'Admin',
        source: 'CRM',
      }

      const response = await $fetch<any>('/api/leads/add', {
        method: 'POST',
        body: payload,
      })

      // Instantly inject the new lead at the top of the list (no refresh needed)
      if (response?.data) {
        const newLead = { ...response.data, id: response.data._id || response.data.id }
        allLeads.value.unshift(newLead)
      }

      fetchCounts() // Update tab counters
      toast.success(`${entity.value} created successfully`)
    }
    showDialog.value = false
  }
  catch (err: any) {
    const errBody = err?.data || err?.response?._data || {}
    console.error('Save failed:', err, 'Response body:', errBody)
    toast.error(errBody?.message || err?.message || 'Failed to save')
  }
  finally {
    isSaving.value = false
  }
}

function confirmDelete(item: any) {
  deletingItem.value = item
  showDeleteDialog.value = true
}

async function handleDelete() {
  if (deletingItem.value) {
    try {
      await $fetch<any>('/api/leads/delete', {
        method: 'POST',
        body: {
          telecallingId: deletingItem.value._id || deletingItem.value.id,
        },
      })

      // Remove from local cache instantly
      const delId = deletingItem.value._id || deletingItem.value.id
      allLeads.value = allLeads.value.filter((l: any) => (l._id || l.id) !== delId)

      fetchCounts() // Update tab counters
      toast.success(`${entity.value} deleted successfully`)
    }
    catch (err: any) {
      console.error('Delete failed:', err)
      toast.error(err?.data?.message || err?.message || 'Failed to delete')
    }
  }
  showDeleteDialog.value = false
  deletingItem.value = null
}

async function handleRefresh() {
  search.value = '' // Clear search on refresh
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
  <HeaderActions>
    <div class="relative">
      <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
      <Input v-model="search" placeholder="Search all leads..." class="pl-8 h-8 w-48 text-sm" />
    </div>
    <p class="text-xs text-muted-foreground tabular-nums hidden sm:block whitespace-nowrap">
      {{ totalFiltered }} of {{ totalCount }} records
    </p>
    <Button variant="ghost" size="sm" class="h-8" :disabled="isLoading" @click="handleRefresh">
      <Icon name="i-lucide-refresh-cw" class="mr-1.5 size-3.5" :class="{ 'animate-spin': isLoading }" />
      Refresh
    </Button>
    <Button size="sm" class="h-8" @click="openCreate">
      <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
      Add {{ entity }}
    </Button>
  </HeaderActions>

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
            v-for="item in filteredItems"
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
          <TableRow v-if="filteredItems.length === 0 && !isLoading">
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

      <!-- Scroll Sentinel for infinite loading from server -->
      <div v-if="serverHasMore" ref="scrollSentinel" class="flex items-center justify-center py-6">
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon v-if="isLoadingMore" name="i-lucide-loader-2" class="size-4 animate-spin" />
          <Icon v-else name="i-lucide-chevrons-down" class="size-4" />
          {{ isLoadingMore ? 'Loading more...' : 'Scroll for more' }}
        </div>
      </div>
    </div>

    <!-- Footer info bar -->
    <div v-if="isFetched && !fetchError" class="shrink-0 border-t bg-muted/30 px-4 lg:px-6 py-2 flex items-center justify-between">
      <p class="text-xs text-muted-foreground tabular-nums">
        Showing {{ filteredItems.length }} of {{ totalCount }} records
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
          <div class="p-6 h-[450px] overflow-y-auto">
            <div class="space-y-4">
              <div v-for="field in getFieldsForTab(activeTab)" :key="field.key" class="space-y-2">
                <Label :for="field.key" class="flex items-center gap-1">
                  {{ field.label }}
                  <span v-if="field.required" class="text-destructive text-xs">*</span>
                </Label>

                <!-- Car Make dropdown -->
                <SearchableSelect
                  v-if="field.key === 'make'"
                  v-model="formData.make"
                  :options="carMakes.map(m => ({ label: m, value: m }))"
                  placeholder="Select Make"
                  search-placeholder="Search brands..."
                  :class="{ 'ring-1 ring-destructive rounded-md': tabValidationErrors[field.key] }"
                />

                <!-- Car Model dropdown (filtered by make) -->
                <SearchableSelect
                  v-else-if="field.key === 'model'"
                  v-model="formData.model"
                  :options="availableModels.map(m => ({ label: m, value: m }))"
                  :disabled="!formData.make || isCarLoading"
                  :placeholder="isCarLoading ? 'Loading models...' : (formData.make ? 'Select Model' : 'Select make first')"
                  search-placeholder="Search models..."
                  :class="{ 'ring-1 ring-destructive rounded-md': tabValidationErrors[field.key] }"
                />

                <!-- Car Variant dropdown (filtered by make + model) -->
                <SearchableSelect
                  v-else-if="field.key === 'variant'"
                  v-model="formData.variant"
                  :options="availableVariants.map(v => ({ label: v, value: v }))"
                  :disabled="!formData.model || isCarLoading"
                  :placeholder="isCarLoading ? 'Loading variants...' : (formData.model ? 'Select Variant' : 'Select model first')"
                  search-placeholder="Search variants..."
                  :class="{ 'ring-1 ring-destructive rounded-md': tabValidationErrors[field.key] }"
                />

                <!-- Searchable dropdown for generic select fields (like city) -->
                <SearchableSelect
                  v-else-if="field.type === 'select'"
                  v-model="formData[field.key]"
                  :options="field.options || []"
                  :placeholder="field.placeholder || `Select ${field.label.toLowerCase()}`"
                  :search-placeholder="`Search ${field.label.toLowerCase()}...`"
                  :class="{ 'ring-1 ring-destructive rounded-md': tabValidationErrors[field.key] }"
                />
                <Textarea
                  v-else-if="field.type === 'textarea'"
                  :id="field.key"
                  v-model="formData[field.key]"
                  :placeholder="field.placeholder"
                  :required="field.required"
                  rows="3"
                  :class="{ 'ring-1 ring-destructive': tabValidationErrors[field.key] }"
                />
                <Input
                  v-else
                  :id="field.key"
                  v-model="formData[field.key]"
                  :type="field.type || 'text'"
                  :placeholder="field.placeholder"
                  :required="field.required"
                  :class="{ 'ring-1 ring-destructive': tabValidationErrors[field.key] }"
                />
                <p v-if="tabValidationErrors[field.key]" class="text-xs text-destructive mt-1">
                  {{ tabValidationErrors[field.key] }}
                </p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="border-t p-6 pt-4 flex items-center justify-between">
            <p class="text-xs text-muted-foreground">
              {{ formTabs.findIndex(t => t.id === activeTab) + 1 }} of {{ formTabs.length }}
            </p>
            <div class="flex gap-2">
              <!-- Back button (shown on tabs 2+) -->
              <Button v-if="!isFirstTab" variant="outline" type="button" @click="handlePrevTab">
                <Icon name="i-lucide-arrow-left" class="mr-1.5 size-3.5" />
                Back
              </Button>
              <!-- Cancel (always shown) -->
              <Button variant="outline" type="button" :disabled="isSaving" @click="showDialog = false">
                Cancel
              </Button>
              <!-- Next button (shown on all tabs except last) -->
              <Button v-if="!isLastTab" type="button" @click="handleNextTab">
                Next
                <Icon name="i-lucide-arrow-right" class="ml-1.5 size-3.5" />
              </Button>
              <!-- Create/Update button (only on last tab) -->
              <Button v-else type="submit" :disabled="isSaving">
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
