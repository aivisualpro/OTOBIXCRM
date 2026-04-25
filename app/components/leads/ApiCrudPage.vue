<script setup lang="ts">
import type { CrudColumn, CrudFormField } from '~/composables/useCrud'
import { toast } from 'vue-sonner'

const props = defineProps<{
  title: string
  description?: string
  icon: string
  entityName?: string
  columns: CrudColumn[]
  formFields: CrudFormField[]
  filters?: Record<string, string>
  clickable?: boolean
  defaultSortKey?: string
  defaultSortDir?: 'asc' | 'desc'
}>()
const inspectionStatuses = ['Pending', 'Scheduled', 'Re-Scheduled', 'Re-Inspection', 'Cancelled']
const approvalStatuses = ['Pending', 'Under Review', 'Approved', 'Quality Rejected']

const router = useRouter()

const { activeWorkspace } = useWorkspace()
const hasAddPermission = computed(() => {
  if (!activeWorkspace.value?.leadActions)
    return true
  return activeWorkspace.value.leadActions.includes('add')
})
const hasEditPermission = computed(() => {
  if (!activeWorkspace.value?.leadActions)
    return true
  return activeWorkspace.value.leadActions.includes('edit')
})
const hasDeletePermission = computed(() => {
  if (!activeWorkspace.value?.leadActions)
    return true
  return activeWorkspace.value.leadActions.includes('delete')
})

const entity = computed(() => props.entityName || 'Lead')

const { setHeader } = usePageHeader()
watchEffect(() => {
  setHeader({ title: props.title, description: props.description || '', icon: props.icon || '' })
})

// ─── Incremental data loading ───
const {
  allLeads,
  totalCount,
  statusCounts: _statusCounts,
  countsTotal,
  hasMore: serverHasMore,
  isLoading,
  isLoadingMore,
  isRefreshing,
  isFetched,
  fetchError,
  fetchLeads,
  deleteLead,
  loadMore: loadMoreFromServer,
  searchLeads,
  refreshLeads,
  fetchCounts,
  advancedFilters,
  setAdvancedFilters,
  serverSearch,
  cancelSearch,
} = useLeadsApi()

// Car dropdowns for Make / Model / Variant
const {
  makes: carMakes,
  getModels: getCarModels,
  getVariants: getCarVariants,
  fetchCarDropdowns,
  isLoading: isCarLoading,
} = useCarDropdowns()

// Dropdowns from DB
const { getOptions: getDbOptions, fetchDropdowns: fetchDbDropdowns } = useDropdowns()
const bankSourceOptions = ref<{ label: string, value: string }[]>([])

// Dynamically fetch strictly populated unique tracking lists natively preventing complete database bleed
const { data: dbFiltersData } = useFetch('/api/leads/filters', { server: false })
const dbCreatedByList = computed(() => dbFiltersData.value?.emails || [])
const dbAddedByList = computed(() => dbFiltersData.value?.addedBys || [])
const cityOptions = computed(() => (dbFiltersData.value?.cities || []).map((c: string) => ({ label: c, value: c })))

function focusGlobalSearch() {
  const el = document.getElementById('globalSearchInput') as HTMLInputElement | null
  if (el) {
    el.focus()
    setTimeout(() => {
      if (el.value) {
        const len = el.value.length
        el.setSelectionRange(len, len)
      }
    }, 10)
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    focusGlobalSearch()
  }
}

// ─── Component mount ───
onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown)

  if (router.currentRoute.value.path === '/leads/search-results' && serverSearch.value) {
    nextTick(() => { focusGlobalSearch() })
  }

  // No longer rely on props.filters since useLeadsApi internally controls Tab/Page via query.tab
  fetchLeads()

  fetchCarDropdowns({ limit: 500 })
  await fetchDbDropdowns()
  bankSourceOptions.value = getDbOptions('Bank Source')
})

// ─── Instant Reveal Animation ───
const isRevealed = ref(false)
const isMounted = ref(true)
onBeforeUnmount(() => {
  isMounted.value = false
  window.removeEventListener('keydown', handleGlobalKeydown)
})

watch(isFetched, (fetched) => {
  if (fetched && isMounted.value) {
    nextTick(() => {
      if (isMounted.value) {
        isRevealed.value = true
      }
    })
  }
  else if (!fetched) {
    // Reset reveal so the animation re-fires after refresh (e.g. clearing search)
    isRevealed.value = false
  }
}, { immediate: true })

// ─── Status Change + Inspector Assignment ───
const { apiBaseUrl: _apiBaseUrl } = useApiEnvironment()
const authToken = useCookie('authToken')
const { allUsers, fetchAllUsers } = usePeopleApi()

const inspectors = computed(() =>
  allUsers.value.filter((u: any) => (u.isStaff === true || u.userRole === 'Inspection Engineer') && u.userRole === 'Inspection Engineer'),
)

onMounted(() => fetchAllUsers())

function getUserLabel(emailOrName: string) {
  if (!emailOrName)
    return '—'
  const val = String(emailOrName).trim().toLowerCase()
  const found = allUsers.value.find((u: any) =>
    String(u.email || '').toLowerCase() === val
    || String(u.userName || '').toLowerCase() === val
    || String(u.emailAddress || '').toLowerCase() === val,
  )

  let resolvedName = ''
  if (found) {
    resolvedName = found.fullName || found.userName || found.name || ''
  }

  if (!resolvedName && val.includes('@')) {
    // Graceful fallback: 'sanat.das@otobix.in' -> 'Sanat Das'
    resolvedName = val.split('@')[0]?.replace(/[._]/g, ' ') || ''
  }

  if (!resolvedName)
    resolvedName = emailOrName

  // Format to standard Title Case (e.g. Sanat Das)
  return resolvedName
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

const showAssignDialog = ref(false)
const assigningLead = ref<any>(null)
const selectedInspector = ref('')
const showRescheduleDialog = ref(false)
const reschedulingLead = ref<any>(null)
const newInspectionDateTime = ref('')

const showCancelDialog = ref(false)
const cancellingLead = ref<any>(null)
const cancelNotes = ref('')

const showQcReviewDialog = ref(false)
const qcReviewingLead = ref<any>(null)

const showInspectedActionDialog = ref(false)
const inspectedActionLead = ref<any>(null)

const showReInspectionDialog = ref(false)
const reAllocatedTo = ref('')
const reInspectionDateTime = ref('')

function openInspectedActionDialog(lead: any) {
  inspectedActionLead.value = lead
  showInspectedActionDialog.value = true
}

function proceedUnderReview() {
  showInspectedActionDialog.value = false
  qcReviewingLead.value = inspectedActionLead.value
  showQcReviewDialog.value = true
}

function proceedReInspection() {
  showInspectedActionDialog.value = false
  reAllocatedTo.value = inspectedActionLead.value?.allocatedTo || ''
  reInspectionDateTime.value = ''
  showReInspectionDialog.value = true
}

async function confirmReInspection() {
  if (!inspectedActionLead.value || !reAllocatedTo.value || !reInspectionDateTime.value) {
    toast.error('Please fill in all re-inspection details')
    return
  }
  const lead = inspectedActionLead.value

  await doStatusUpdate(lead, {
    inspectionStatus: 'Re-Inspection',
    reAllocatedTo: reAllocatedTo.value,
    reInspectionDateTime: reInspectionDateTime.value,
  })

  showReInspectionDialog.value = false
  inspectedActionLead.value = null
  reAllocatedTo.value = ''
  reInspectionDateTime.value = ''
}

function _openQcReviewDialog(lead: any) {
  qcReviewingLead.value = lead
  showQcReviewDialog.value = true
}

async function confirmQcReview() {
  if (!qcReviewingLead.value)
    return
  const lead = qcReviewingLead.value

  const userCookie = useCookie('userData')
  const currentUser = userCookie.value ? (typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value) : {}
  const qcByEmail = currentUser?.email || ''

  await doStatusUpdate(lead, {
    approvalStatus: 'Under Review',
    qcBy: qcByEmail,
  })

  showQcReviewDialog.value = false
  qcReviewingLead.value = null
}
const isUpdatingStatus = ref(false)

async function updateLeadStatus(lead: any, field: string, newStatus: string) {
  if (field === 'inspectionStatus' && newStatus === 'Scheduled') {
    assigningLead.value = { ...lead, _pendingStatus: newStatus }
    selectedInspector.value = lead.allocatedTo || ''
    showAssignDialog.value = true
    return
  }
  if (field === 'inspectionStatus' && newStatus === 'Re-Scheduled') {
    reschedulingLead.value = { ...lead, _pendingStatus: newStatus }
    newInspectionDateTime.value = lead.inspectionDateTime || ''
    showRescheduleDialog.value = true
    return
  }
  if (field === 'inspectionStatus' && newStatus === 'Cancelled') {
    cancellingLead.value = { ...lead, _pendingStatus: newStatus }
    cancelNotes.value = lead.additionalNotes || ''
    showCancelDialog.value = true
    return
  }
  await doStatusUpdate(lead, { [field]: newStatus })
}

async function confirmAssignInspector() {
  if (!assigningLead.value)
    return
  const lead = assigningLead.value
  const inspectorUser = allUsers.value.find((u: any) => u.email === selectedInspector.value)
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

async function confirmReschedule() {
  if (!reschedulingLead.value)
    return
  if (!newInspectionDateTime.value) {
    toast.error('Please select a new date and time')
    return
  }
  const lead = reschedulingLead.value
  await doStatusUpdate(lead, {
    inspectionStatus: lead._pendingStatus || 'Re-Scheduled',
    inspectionDateTime: newInspectionDateTime.value,
  })
  showRescheduleDialog.value = false
  reschedulingLead.value = null
  newInspectionDateTime.value = ''
}

async function confirmCancel() {
  if (!cancellingLead.value)
    return
  if (!cancelNotes.value.trim()) {
    toast.error('Additional notes are required to cancel a lead')
    return
  }
  const lead = cancellingLead.value
  await doStatusUpdate(lead, {
    inspectionStatus: lead._pendingStatus || 'Cancelled',
    additionalNotes: cancelNotes.value.trim(),
  })
  showCancelDialog.value = false
  cancellingLead.value = null
  cancelNotes.value = ''
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
const search = ref(serverSearch.value || String(useRoute().query.search || ''))
const showDialog = ref(false)
const editingItem = ref<any>(null)

const isAdmin = computed(() => {
  const userCookie = useCookie<any>('userData')
  if (!userCookie.value)
    return false
  const user = typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value
  const role = String(user?.userType || user?.userRole || user?.role || '').toLowerCase()
  return role === 'admin'
})
// Status is editable inline when the lead's current inspectionStatus is one of these
const EDITABLE_INSPECTION_STATUSES = ['pending', 'scheduled', 're-scheduled', 're-inspection']
function isInspectionStatusEditable(item: Record<string, any>): boolean {
  const current = String(item?.inspectionStatus || '').trim().toLowerCase()
  return EDITABLE_INSPECTION_STATUSES.includes(current)
}
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

// ─── Sort state (default: appointmentId descending or from props) ───
const sortKey = ref(props.defaultSortKey || 'appointmentId')
const sortDir = ref<'asc' | 'desc'>(props.defaultSortDir || 'desc')

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  }
  else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

// ─── Advanced Filters UI State ───
const showAdvancedFilters = ref(false)

const localFilters = ref({
  startDate: '',
  endDate: '',
  dateField: 'inspectionDateTime',
  datePreset: '',
  make: '',
  city: '',
  priority: '',
  allocatedTo: '',
  createdBy: '',
  addedBy: '',
  inspectionStatus: '',
})

const activeFilterCount = computed(() => {
  let count = 0
  if (advancedFilters.value.startDate || advancedFilters.value.endDate)
    count++
  if (advancedFilters.value.make)
    count++
  if (advancedFilters.value.city)
    count++
  if (advancedFilters.value.priority)
    count++
  if (advancedFilters.value.allocatedTo)
    count++
  if (advancedFilters.value.createdBy)
    count++
  if (advancedFilters.value.addedBy)
    count++
  if (advancedFilters.value.inspectionStatus)
    count++
  return count
})

watch(advancedFilters, (newF) => {
  localFilters.value = {
    startDate: newF.startDate || '',
    endDate: newF.endDate || '',
    dateField: newF.dateField || 'inspectionDateTime',
    datePreset: newF.datePreset || '',
    make: newF.make || '',
    city: newF.city || '',
    priority: newF.priority || '',
    allocatedTo: newF.allocatedTo || '',
    createdBy: newF.createdBy || '',
    addedBy: newF.addedBy || '',
    inspectionStatus: newF.inspectionStatus || '',
  }
}, { deep: true, immediate: true })

function applyAdvancedFilters() {
  setAdvancedFilters(localFilters.value)
  showAdvancedFilters.value = false
  if (router.currentRoute.value.query.tab !== 'search-results') {
    router.push({ path: '/leads', query: { ...router.currentRoute.value.query, tab: 'search-results' } })
  }
}

function clearAdvancedFilters() {
  localFilters.value = { startDate: '', endDate: '', dateField: 'inspectionDateTime', datePreset: '', make: '', city: '', priority: '', allocatedTo: '', createdBy: '', addedBy: '', inspectionStatus: '' }
  setAdvancedFilters({})
  showAdvancedFilters.value = false
  // Only leave search-results if there's also no active text search
  if (router.currentRoute.value.query.tab === 'search-results' && !serverSearch.value) {
    const resetQuery = { ...router.currentRoute.value.query }
    resetQuery.tab = 'all'
    router.push({ path: '/leads', query: resetQuery })
  }
}

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

// ─── Sorted display (we rely on server-side status filtering implicitly) ───
const { setSort } = useLeadsApi()

// When the user clicks a column header, `sortKey` and `sortDir` are updated. We just sync it with the server!
watch([sortKey, sortDir], ([newKey, newDir]) => {
  setSort(newKey, newDir)
})

const filteredItems = computed(() => {
  return allLeads.value as Record<string, any>[]
})

const frontendDisplayLimit = ref(100)

watch(() => props.filters, () => {
  frontendDisplayLimit.value = 100
}, { deep: true })

// The backend handles ALL pagination now. We just display what was fetched.
const displayedItems = computed(() => {
  return filteredItems.value
})

const _totalFiltered = computed(() => filteredItems.value.length)

// ─── Search triggers server-side query & auto-navigates to Search Results tab ───
let _localSearchDebounce: ReturnType<typeof setTimeout> | null = null

watch(() => router.currentRoute.value.query.tab, (newTab) => {
  if (newTab !== 'search-results' && search.value) {
    search.value = ''
  }
})

watch(search, async (q) => {
  const trimmed = q.trim()

  // Cancel any pending debounce immediately
  if (_localSearchDebounce) {
    clearTimeout(_localSearchDebounce)
    _localSearchDebounce = null
  }

  if (trimmed) {
    // Navigate to search-results tab (if not already there)
    // searchLeads() will be called from the search-results page's onMounted/route watch
    if (router.currentRoute.value.query.tab !== 'search-results') {
      serverSearch.value = trimmed
      router.push({ path: '/leads', query: { tab: 'search-results', search: trimmed } })
    }
    else {
      // Already on search-results — debounce then hit server
      serverSearch.value = trimmed
      _localSearchDebounce = setTimeout(() => {
        router.replace({ path: '/leads', query: { ...router.currentRoute.value.query, search: trimmed } })
        frontendDisplayLimit.value = 100
        searchLeads(trimmed)
      }, 400)
    }
  }
  else {
    // Search cleared
    cancelSearch()
    serverSearch.value = ''

    // Remove search from query
    const resetQuery = { ...router.currentRoute.value.query }
    delete resetQuery.search

    if (router.currentRoute.value.query.tab === 'search-results') {
      resetQuery.tab = 'all' // Fallback to all leads when search is cleared
      router.push({ path: '/leads', query: resetQuery })
    }
    else {
      router.replace({ path: '/leads', query: resetQuery })
      refreshLeads()
    }
  }
})

// ─── IntersectionObserver for infinite scroll (loads from server) ───
const scrollSentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  // On the search-results tab: read URL query and fire search
  const routeSearch = String(useRoute().query.search || '').trim()
  if (routeSearch && router.currentRoute.value.query.tab === 'search-results') {
    serverSearch.value = routeSearch
    search.value = routeSearch
    searchLeads(routeSearch)
  }

  // Find the table's scrollable container (the div with overflow-auto wrapping the table)
  const scrollRoot = document.querySelector('[data-slot="table-container"]') as HTMLElement | null

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        if (frontendDisplayLimit.value < filteredItems.value.length) {
          // Load 100 more from in-memory cache
          frontendDisplayLimit.value += 100
        }
        else if (serverHasMore.value) {
          loadMoreFromServer()
        }
      }
    },
    { root: scrollRoot, rootMargin: '400px' },
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
  { id: 'status', label: 'Status', icon: 'i-lucide-settings', keys: ['inspectionStatus', 'approvalStatus', 'priority', 'appointmentSource', 'allocatedTo', 'repName', 'repContact', 'otherSource', 'bankSource', 'referenceName'] },
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
    // Hide fields conditionally unified fully for both New and Edit states equivalently
    if (f.hideOnCreate)
      return false

    // Conditional logic based on Source
    if (f.key === 'bankSource' && formData.value.appointmentSource !== 'Bank')
      return false
    if (f.key === 'referenceName' && formData.value.appointmentSource !== 'Reference')
      return false
    // NCD/UCD-only fields
    const isNcdUcd = ['NCD', 'UCD'].includes(formData.value.appointmentSource)
    if (f.key === 'repName' && !isNcdUcd)
      return false
    if (f.key === 'repContact' && !isNcdUcd)
      return false
    // Other-only fields
    if (f.key === 'otherSource' && formData.value.appointmentSource !== 'Other')
      return false

    return true
  }).map((f) => {
    // Overrides: if city field and we have DB options, use them
    if (f.key === 'city' && cityOptions.value.length > 0) {
      return { ...f, options: cityOptions.value }
    }
    // Override: bank source list from dropdown configuration
    if (f.key === 'bankSource') {
      return { ...f, type: 'select', options: bankSourceOptions.value }
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

    // Strict 10-digit validation for all records
    if (field.key === 'customerContactNumber') {
      const value = String(formData.value[field.key] || '')
      if (value.length !== 10 || !/^\d{10}$/.test(value)) {
        tabValidationErrors.value[field.key] = `Contact number must be exactly 10 digits (without country code)`
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

async function openCreate() {
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
  const cloned = { ...item }
  props.formFields.forEach((f) => {
    if (f.type === 'datetime-local' && cloned[f.key]) {
      const dbDate = new Date(String(cloned[f.key]).trim())
      if (!Number.isNaN(dbDate.getTime())) {
        const offset = dbDate.getTimezoneOffset()
        const localDt = new Date(dbDate.getTime() - (offset * 60000))
        cloned[f.key] = localDt.toISOString().slice(0, 16)
      }
    }
  })

  if (cloned.customerContactNumber) {
    let num = String(cloned.customerContactNumber).replace(/\D/g, '')
    if (num.length > 10 && num.startsWith('91'))
      num = num.slice(2)
    cloned.customerContactNumber = num.slice(0, 10)
  }

  formData.value = cloned
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
      // appointmentId is generated server-side at insert time (no pre-reservation)
      const roleStr = String(currentUser?.userRole || currentUser?.appRole || currentUser?.role || '')
      const isTelecaller = roleStr === 'Telecaller'

      const payload: Record<string, any> = {
        ...formData.value,
        addedBy: isTelecaller ? 'Telecaller' : (currentUser?.userName || 'Admin'),
        changedBy: currentUser?.userName || 'Admin',
        source: 'CRM',
      }

      if (isTelecaller) {
        payload.emailAddress = currentUser?.email || ''
        payload.createdByFullName = currentUser?.userName || ''
      }
      else {
        payload.createdByFullName = currentUser?.userName || ''
      }

      // Removed +91 insertion logic

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

// ─── Delete ───
const showDeleteDialog = ref(false)
const deletingItem = ref<any>(null)
const isDeleting = ref(false)

function confirmDelete(item: any) {
  deletingItem.value = item
  showDeleteDialog.value = true
}

async function handleDelete() {
  if (!deletingItem.value)
    return
  isDeleting.value = true
  try {
    const leadId = deletingItem.value._id || deletingItem.value.id || deletingItem.value.appointmentId
    await deleteLead(leadId)
    toast.success(`Lead deleted successfully`)
    showDeleteDialog.value = false
    deletingItem.value = null
  }
  catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Delete failed')
  }
  finally {
    isDeleting.value = false
  }
}

// ─── Bulk Actions ───

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
  'Re-Inspection': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Under Inspection': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Cancelled': 'bg-red-500/10 text-red-600 border-red-500/20',
  'Inspected': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Under Review': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'Approved': 'bg-teal-500/10 text-teal-600 border-teal-500/20',
  'Quality Rejected': 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  'High': 'bg-red-500/10 text-red-600 border-red-500/20',
  'Medium': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Low': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
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
  <HeaderActions>
    <div class="relative">
      <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
      <Input id="globalSearchInput" v-model="search" placeholder="Search global leads..." class="pl-8 h-8 w-[240px] text-sm flex-1 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pr-10" />
      <div v-if="!search" class="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex text-muted-foreground">
        <span class="text-[9px]">⌘</span>K
      </div>
      <Button
        v-if="search"
        variant="ghost"
        size="icon"
        class="absolute right-0 top-0 h-full size-8 rounded-l-none text-muted-foreground hover:bg-transparent hover:text-foreground"
        @click="search = ''; router.replace({ query: {} })"
      >
        <Icon name="i-lucide-x" class="size-3.5" />
      </Button>
    </div>

    <!-- Advanced Filters Popover -->
    <Popover v-model:open="showAdvancedFilters">
      <PopoverTrigger as-child>
        <Button variant="outline" size="sm" class="relative bg-muted/20 border-muted/50 h-8 ml-2 gap-2 hover:bg-muted/50 transition-colors">
          <Icon name="i-lucide-filter" class="size-3.5 text-muted-foreground" />
          Filter
          <Badge v-if="activeFilterCount > 0" class="absolute -right-2 -top-2 size-4 flex items-center justify-center p-0 text-[9px] bg-blue-600 text-white rounded-full">
            {{ activeFilterCount }}
          </Badge>
        </Button>
      </PopoverTrigger>

      <PopoverContent class="w-[340px] p-0 shadow-lg border-muted" align="start">
        <div class="flex flex-col">
          <!-- Header -->
          <div class="px-4 py-3 border-b bg-muted/10 flex items-center justify-between">
            <h4 class="font-medium text-sm text-foreground flex items-center gap-1.5">
              <Icon name="i-lucide-sliders-horizontal" class="size-4 text-primary" /> Advanced Filters
            </h4>
            <Button v-if="activeFilterCount > 0" variant="ghost" size="sm" class="h-6 px-2 text-xs text-muted-foreground hover:text-destructive" @click="clearAdvancedFilters">
              Clear All
            </Button>
          </div>

          <!-- Content -->
          <div class="p-4 space-y-5 max-h-[400px] overflow-y-auto custom-scrollbar">
            <!-- Date Filters -->
            <div class="space-y-3">
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
              <div class="space-y-1.5 mt-2">
                <Label class="text-[10px] uppercase text-muted-foreground">Date Tracking Field</Label>
                <div class="flex gap-2">
                  <Badge variant="outline" :class="localFilters.dateField === 'createdAt' ? 'bg-primary/10 text-primary border-primary' : 'bg-muted/10'" class="cursor-pointer font-normal rounded-md" @click="localFilters.dateField = 'createdAt'">
                    Created Date
                  </Badge>
                  <Badge variant="outline" :class="localFilters.dateField === 'inspectionDateTime' ? 'bg-primary/10 text-primary border-primary' : 'bg-muted/10'" class="cursor-pointer font-normal rounded-md" @click="localFilters.dateField = 'inspectionDateTime'">
                    Inspection Date
                  </Badge>
                </div>
              </div>
            </div>

            <Separator class="bg-muted/50" />

            <!-- Field Filters -->
            <div class="space-y-3">
              <Label class="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><Icon name="i-lucide-list-filter" class="size-3" /> Properties</Label>
              <div class="grid gap-3">
                <div class="grid grid-cols-2 gap-3">
                  <!-- Make -->
                  <div class="space-y-1.5">
                    <Label class="text-xs text-muted-foreground">Make</Label>
                    <Select v-model="localFilters.make">
                      <SelectTrigger class="h-8 text-xs bg-muted/30 uppercase">
                        <SelectValue placeholder="ANY MAKE" />
                      </SelectTrigger>
                      <SelectContent class="uppercase">
                        <SelectItem value=" ">
                          ANY MAKE
                        </SelectItem>
                        <SelectItem v-for="make in carMakes" :key="make" :value="make">
                          {{ make }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <!-- Priority -->
                  <div class="space-y-1.5">
                    <Label class="text-xs text-muted-foreground">Priority</Label>
                    <Select v-model="localFilters.priority">
                      <SelectTrigger class="h-8 text-xs bg-muted/30 uppercase">
                        <SelectValue placeholder="ANY PRIORITY" />
                      </SelectTrigger>
                      <SelectContent class="uppercase">
                        <SelectItem value=" ">
                          ANY PRIORITY
                        </SelectItem>
                        <SelectItem value="High">
                          HIGH
                        </SelectItem>
                        <SelectItem value="Medium">
                          MEDIUM
                        </SelectItem>
                        <SelectItem value="Low">
                          LOW
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1.5">
                    <Label class="text-xs text-muted-foreground">Status</Label>
                    <Select v-model="localFilters.inspectionStatus">
                      <SelectTrigger class="h-8 text-xs bg-muted/30 uppercase">
                        <SelectValue placeholder="ANY STATUS" />
                      </SelectTrigger>
                      <SelectContent class="uppercase">
                        <SelectItem value=" ">
                          ANY STATUS
                        </SelectItem>
                        <SelectItem v-for="st in inspectionStatuses" :key="st" :value="st">
                          {{ st }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="space-y-1.5">
                    <Label class="text-xs text-muted-foreground">City Location</Label>
                    <Select v-model="localFilters.city">
                      <SelectTrigger class="h-8 text-xs bg-muted/30 uppercase">
                        <SelectValue placeholder="ANY CITY" />
                      </SelectTrigger>
                      <SelectContent class="uppercase">
                        <SelectItem value=" ">
                          ANY CITY
                        </SelectItem>
                        <SelectItem v-for="c in cityOptions" :key="c.value" :value="c.value">
                          {{ c.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div class="space-y-1.5">
                  <Label class="text-xs text-muted-foreground">Assigned Inspector</Label>
                  <Select v-model="localFilters.allocatedTo">
                    <SelectTrigger class="h-8 text-xs bg-muted/30 uppercase">
                      <SelectValue placeholder="ANYONE" />
                    </SelectTrigger>
                    <SelectContent class="uppercase">
                      <SelectItem value=" ">
                        ANYONE
                      </SelectItem>
                      <SelectItem v-for="insp in inspectors" :key="insp._id || insp.id" :value="insp.email">
                        {{ getUserLabel(insp.email) }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1.5">
                    <Label class="text-xs text-muted-foreground">Created By</Label>
                    <Select v-model="localFilters.createdBy">
                      <SelectTrigger class="h-8 text-xs bg-muted/30 uppercase">
                        <SelectValue placeholder="ANYONE" />
                      </SelectTrigger>
                      <SelectContent class="uppercase">
                        <SelectItem value=" ">
                          ANYONE
                        </SelectItem>
                        <SelectItem v-for="u in dbCreatedByList" :key="u.email" :value="u.email">
                          {{ u.name }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="space-y-1.5">
                    <Label class="text-xs text-muted-foreground">Added By</Label>
                    <Select v-model="localFilters.addedBy">
                      <SelectTrigger class="h-8 text-xs bg-muted/30 uppercase">
                        <SelectValue placeholder="ANYONE" />
                      </SelectTrigger>
                      <SelectContent class="uppercase">
                        <SelectItem value=" ">
                          ANYONE
                        </SelectItem>
                        <SelectItem v-for="u in dbAddedByList" :key="u" :value="u">
                          {{ u }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-4 py-3 border-t bg-muted/20 flex justify-between gap-2">
            <Button variant="outline" size="sm" class="h-8 text-xs" @click="showAdvancedFilters = false">
              Cancel
            </Button>
            <div class="flex gap-2">
              <Button variant="secondary" size="sm" class="h-8 text-xs" @click="clearAdvancedFilters">
                Clear
              </Button>
              <Button size="sm" class="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm" @click="applyAdvancedFilters">
                Apply {{ activeFilterCount > 0 ? `(${activeFilterCount})` : '' }}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>

    <!-- Total Counter -->
    <div v-if="countsTotal > 0" class="hidden sm:flex items-center mx-2 mr-auto">
      <Badge variant="outline" class="bg-muted/30 border-primary/20 text-muted-foreground uppercase text-[10px] tracking-wider font-mono h-[24px]">
        Total Records: <span class="text-primary font-semibold ml-1.5 text-xs tracking-normal">{{ formatNumber(countsTotal) }}</span>
      </Badge>
    </div>

    <BaseSyncIndicator :syncing="isRefreshing" />
    <Button v-if="hasAddPermission && router.currentRoute.value.path.startsWith('/leads')" size="sm" class="h-8" @click="openCreate">
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
      class="flex-1 min-h-0 overflow-hidden flex flex-col leads-table-reveal"
      :class="{ 'is-revealed': isRevealed }"
    >
      <Table container-class="h-full pb-10 px-[19px]">
        <TableHeader class="sticky top-0 z-10 bg-muted border-b border-border">
          <TableRow relative>
            <!-- Sleek inline loader requested by formatting rules -->
            <div v-show="isRefreshing || isLoadingMore" class="absolute bottom-0 left-0 right-0 h-[2px] bg-primary/20 overflow-hidden z-20">
              <div class="h-full bg-primary origin-left animate-in fade-in duration-500 rounded-full" style="width: 30%; animation: indeterminate 1.5s infinite linear;" />
            </div>

            <TableHead
              v-for="col in columns"
              :key="col.key"
              class="cursor-pointer select-none hover:bg-muted/80 transition-colors whitespace-nowrap"
              @click="toggleSort(col.key)"
            >
              <div class="flex items-center gap-1">
                {{ col.label }}
                <span class="text-muted-foreground/60 text-xs">
                  <template v-if="sortKey === col.key">
                    {{ sortDir === 'asc' ? '↑' : '↓' }}
                  </template>
                  <template v-else>↕</template>
                </span>
              </div>
            </TableHead>
            <TableHead v-if="router.currentRoute.value.path !== '/leads/under-review'" class="w-[80px] text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="item in displayedItems"
            :key="item.id || item._id"
            class="group"
            :class="{ 'cursor-pointer hover:bg-muted/50': props.clickable || item.inspectionStatus === 'Inspected' }"
            @click="(props.clickable || item.inspectionStatus === 'Inspected') && item.appointmentId ? (item.approvalStatus === 'Under Review' ? router.push(`/qc/${item.appointmentId}`) : router.push(`/inspection/${item.appointmentId}`)) : undefined"
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
              <template v-else-if="col.type === 'badge' && (col.key === 'inspectionStatus' || col.key === 'approvalStatus')">
                <DropdownMenu v-if="col.key === 'approvalStatus' || (col.key === 'inspectionStatus' && isInspectionStatusEditable(item))">
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
                <!-- Clickable when in inspected tab wrapper OR search results with correct status -->
                <Badge
                  v-else-if="col.key === 'inspectionStatus' && item.inspectionStatus === 'Inspected' && router.currentRoute.value.path.startsWith('/leads') && item.approvalStatus !== 'Approved'"
                  variant="outline"
                  class="cursor-pointer hover:ring-1 hover:ring-orange-500/50 transition-all uppercase"
                  :class="getBadgeClass(item[col.key])"
                  title="Click to take this lead under Quality Review or Send For Re-Inspection"
                  @click.stop="openInspectedActionDialog(item)"
                >
                  {{ item[col.key] || '—' }}
                </Badge>
                <Badge
                  v-else
                  variant="outline"
                  class="cursor-default"
                  :class="[getBadgeClass(item[col.key]), col.key === 'inspectionStatus' ? 'uppercase' : '']"
                >
                  {{ item[col.key] || '—' }}
                </Badge>
              </template>
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
              <!-- User Identifiers -->
              <span v-else-if="['createdBy', 'createdByFullName', 'addedBy', 'allocatedTo', 'qcBy', 'emailAddress'].includes(col.key)" class="text-sm font-medium">
                {{ getUserLabel(item[col.key]) }}
              </span>
              <!-- Default text -->
              <span v-else class="text-sm">{{ item[col.key] ?? '—' }}</span>
            </TableCell>
            <TableCell v-if="router.currentRoute.value.path !== '/leads/under-review'" class="text-right">
              <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button v-if="hasEditPermission && router.currentRoute.value.path.startsWith('/leads') && item.inspectionStatus !== 'Inspected'" variant="ghost" size="icon" class="size-8" @click.stop="openEdit(item)">
                  <Icon name="i-lucide-pencil" class="size-3.5" />
                </Button>
                <Button v-if="hasDeletePermission && router.currentRoute.value.path === '/leads' && item.inspectionStatus === 'Pending'" variant="ghost" size="icon" class="size-8 text-destructive hover:bg-destructive/10" @click.stop="confirmDelete(item)">
                  <Icon name="i-lucide-trash-2" class="size-3.5" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
          <TableRow v-if="displayedItems.length === 0 && !isLoading">
            <TableCell :colspan="router.currentRoute.value.path !== '/leads/under-review' ? columns.length + 1 : columns.length" class="h-32 text-center">
              <div class="flex flex-col items-center gap-2 text-muted-foreground">
                <Icon name="i-lucide-inbox" class="size-8" />
                <p>No leads found</p>
                <Button v-if="hasAddPermission && router.currentRoute.value.path.startsWith('/leads')" size="sm" variant="outline" @click="openCreate">
                  <Icon name="i-lucide-plus" class="mr-1 size-4" />
                  Add {{ entity }}
                </Button>
              </div>
            </TableCell>
          </TableRow>
          <!-- Scroll Sentinel — MUST be inside the table's overflow-auto container -->
          <TableRow v-if="serverHasMore || frontendDisplayLimit < filteredItems.length">
            <TableCell :colspan="columns.length + 1" class="p-0 h-1">
              <div ref="scrollSentinel" class="h-1 w-full" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Footer info bar -->
    <div v-if="isFetched && !fetchError" class="shrink-0 border-t bg-muted/30 px-4 lg:px-6 py-2 flex items-center justify-between">
      <p class="text-xs text-muted-foreground tabular-nums">
        Showing {{ displayedItems.length }} of {{ totalCount }} records
      </p>
    </div>

    <!-- Create/Edit Dialog -->
    <Dialog v-model:open="showDialog">
      <DialogContent class="sm:max-w-[600px] p-0 gap-0">
        <DialogHeader class="p-6 pb-4">
          <DialogTitle class="flex items-center gap-2">
            {{ editingItem ? 'Edit' : 'New' }} {{ entity }}
            <Badge v-if="!editingItem" variant="outline" class="text-xs font-mono text-muted-foreground">
              ID: Auto-generated
            </Badge>
          </DialogTitle>
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

                <!-- Premium Priority Selector -->
                <div v-else-if="field.key === 'priority'" class="grid grid-cols-3 gap-2 pt-1">
                  <button
                    v-for="p in [
                      { label: 'High', value: 'High', icon: 'i-lucide-flame', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', active: 'ring-2 ring-red-500/40 bg-red-500/5' },
                      { label: 'Medium', value: 'Medium', icon: 'i-lucide-activity', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', active: 'ring-2 ring-amber-500/40 bg-amber-500/5' },
                      { label: 'Low', value: 'Low', icon: 'i-lucide-arrow-down-to-line', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', active: 'ring-2 ring-blue-500/40 bg-blue-500/5' },
                    ]"
                    :key="p.value"
                    type="button"
                    class="group flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    :class="formData[field.key] === p.value
                      ? `${p.border} ${p.active} shadow-sm scale-[1.02]`
                      : 'border-input bg-background hover:bg-muted/50 hover:border-border'"
                    @click="formData[field.key] = p.value"
                  >
                    <div
                      class="p-2.5 rounded-full mb-2 transition-colors duration-200"
                      :class="formData[field.key] === p.value ? p.bg : 'bg-muted group-hover:bg-muted/80'"
                    >
                      <Icon
                        :name="p.icon" class="size-5 transition-colors"
                        :class="formData[field.key] === p.value ? p.color : 'text-muted-foreground group-hover:text-foreground'"
                      />
                    </div>
                    <span
                      class="text-xs font-semibold tracking-wide transition-colors"
                      :class="formData[field.key] === p.value ? p.color : 'text-muted-foreground'"
                    >
                      {{ p.label }}
                    </span>
                  </button>
                </div>

                <!-- Interactive Ownership Number Buttons -->
                <div v-else-if="field.key === 'ownershipSerialNumber'" class="flex gap-1.5 h-9 pt-1 w-full max-w-sm">
                  <button
                    v-for="n in 5"
                    :key="n"
                    type="button"
                    class="flex-1 rounded-md text-sm font-bold transition-all duration-200 border flex items-center justify-center gap-1"
                    :class="Number(formData[field.key]) === n
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-1 ring-blue-600/50 scale-[1.02]'
                      : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'"
                    @click="formData[field.key] = n"
                  >
                    {{ n }}{{ n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th' }}
                  </button>
                </div>

                <!-- Searchable dropdown for generic select fields (like city) -->
                <SearchableSelect
                  v-else-if="field.type === 'select'"
                  v-model="formData[field.key]"
                  :options="field.options || []"
                  :placeholder="field.placeholder || `Select ${field.label.toLowerCase()}`"
                  :search-placeholder="`Search ${field.label.toLowerCase()}...`"
                  :class="{ 'ring-1 ring-destructive rounded-md': tabValidationErrors[field.key] }"
                />
                <!-- Phone Field (Max 10 digits) -->
                <div v-else-if="field.key === 'customerContactNumber'" class="w-full">
                  <Input
                    :id="field.key"
                    :model-value="formData[field.key]"
                    type="text"
                    maxlength="10"
                    placeholder="9999999999"
                    :required="field.required"
                    class="font-medium tabular-nums shadow-none"
                    :class="{ 'ring-1 ring-destructive': tabValidationErrors[field.key] }"
                    @update:model-value="(v) => formData[field.key] = String(v).replace(/\D/g, '').slice(0, 10)"
                  />
                </div>

                <!-- Textarea -->
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
              <Button v-else-if="(editingItem && hasEditPermission) || (!editingItem && hasAddPermission)" type="submit" :disabled="isSaving">
                <Icon v-if="isSaving" name="i-lucide-loader-2" class="mr-1.5 size-3.5 animate-spin" />
                {{ editingItem ? 'Update' : 'Create' }}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>

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
            <Select v-model="selectedInspector">
              <SelectTrigger id="inspector-select">
                <SelectValue placeholder="Select an inspector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="insp in inspectors" :key="insp._id || insp.id" :value="insp.email">
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
              No inspectors available.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showAssignDialog = false">
            Cancel
          </Button>
          <Button :disabled="!selectedInspector || isUpdatingStatus" class="bg-blue-600 hover:bg-blue-700" @click="confirmAssignInspector">
            <Icon v-if="isUpdatingStatus" name="i-lucide-loader-2" class="mr-2 size-4 animate-spin" />
            Assign & Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Reschedule Inspector Dialog -->
    <Dialog v-model:open="showRescheduleDialog">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="i-lucide-calendar-clock" class="size-5 text-purple-500" />
            Reschedule Inspection
          </DialogTitle>
          <DialogDescription>
            Record a new inspection date and time.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <div v-if="reschedulingLead" class="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p class="text-sm font-medium">
              {{ reschedulingLead.ownerName || 'Unknown' }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ reschedulingLead.make }} {{ reschedulingLead.model }} — {{ reschedulingLead.carRegistrationNumber }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="reschedule-datetime">New Date & Time</Label>
            <Input id="reschedule-datetime" v-model="newInspectionDateTime" type="datetime-local" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showRescheduleDialog = false">
            Cancel
          </Button>
          <Button :disabled="!newInspectionDateTime || isUpdatingStatus" class="bg-purple-600 hover:bg-purple-700" @click="confirmReschedule">
            <Icon v-if="isUpdatingStatus" name="i-lucide-loader-2" class="mr-2 size-4 animate-spin" />
            Confirm Reschedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Cancel Confirmation Dialog -->
    <Dialog v-model:open="showCancelDialog">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="i-lucide-ban" class="size-5 text-destructive" />
            Cancel Inspection
          </DialogTitle>
          <DialogDescription>
            You must provide a cancellation reason.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <div v-if="cancellingLead" class="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p class="text-sm font-medium">
              {{ cancellingLead.ownerName || 'Unknown' }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ cancellingLead.make }} {{ cancellingLead.model }} — {{ cancellingLead.carRegistrationNumber }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="cancel-notes" class="flex gap-1">Reason <span class="text-destructive">*</span></Label>
            <Textarea
              id="cancel-notes"
              v-model="cancelNotes"
              placeholder="Provide a required reason for cancellation..."
              rows="4"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showCancelDialog = false">
            Abort
          </Button>
          <Button :disabled="!cancelNotes.trim() || isUpdatingStatus" class="bg-destructive text-destructive-foreground hover:bg-destructive/90" @click="confirmCancel">
            <Icon v-if="isUpdatingStatus" name="i-lucide-loader-2" class="mr-2 size-4 animate-spin" />
            Confirm Cancellation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Take to Quality Review Confirmation Dialog -->
    <Dialog v-model:open="showQcReviewDialog">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="i-lucide-activity" class="size-5 text-orange-500" />
            Take Under Review
          </DialogTitle>
          <DialogDescription>
            You are about to assign this inspection to yourself for quality review.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <div v-if="qcReviewingLead" class="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p class="text-sm font-medium">
              {{ qcReviewingLead.ownerName || 'Unknown' }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ qcReviewingLead.make }} {{ qcReviewingLead.model }} — {{ qcReviewingLead.carRegistrationNumber }}
            </p>
            <p class="text-sm font-medium text-muted-foreground mt-3 border-t pt-3 w-full">
              Taking Responsibility as:
              <strong class="text-foreground text-orange-600">
                {{ useCookie('userData').value ? (typeof useCookie('userData').value === 'string' ? JSON.parse(useCookie('userData').value as any).userName : (useCookie('userData').value as any).userName) : 'Unknown' }}
              </strong>
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showQcReviewDialog = false">
            Cancel
          </Button>
          <Button :disabled="isUpdatingStatus" class="bg-orange-600 hover:bg-orange-700 text-white" @click="confirmQcReview">
            <Icon v-if="isUpdatingStatus" name="i-lucide-loader-2" class="mr-2 size-4 animate-spin" />
            Confirm QC Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Inspected Action Choice Dialog -->
    <Dialog v-model:open="showInspectedActionDialog">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="i-lucide-check-circle" class="size-5 text-emerald-500" />
            Inspected Lead Actions
          </DialogTitle>
          <DialogDescription>
            Choose how you would like to proceed with this inspected lead.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-3 py-4">
          <Button class="justify-start gap-3 h-12 text-base font-medium" variant="outline" @click="proceedUnderReview">
            <Icon name="i-lucide-activity" class="size-5 text-orange-500" />
            Take Under Review
          </Button>
          <Button class="justify-start gap-3 h-12 text-base font-medium" variant="outline" @click="proceedReInspection">
            <Icon name="i-lucide-rotate-ccw" class="size-5 text-blue-500" />
            Send for Re-Inspection
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" @click="showInspectedActionDialog = false">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Re-Inspection Details Dialog -->
    <Dialog v-model:open="showReInspectionDialog">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="i-lucide-rotate-ccw" class="size-5 text-blue-500" />
            Schedule Re-Inspection
          </DialogTitle>
          <DialogDescription>
            Assign an inspector and select a new date and time for re-inspection.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <div v-if="inspectedActionLead" class="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p class="text-sm font-medium">
              {{ inspectedActionLead.ownerName || 'Unknown' }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ inspectedActionLead.make }} {{ inspectedActionLead.model }} — {{ inspectedActionLead.carRegistrationNumber }}
            </p>
          </div>

          <div class="space-y-2">
            <Label>Re-Allocate To</Label>
            <Select v-model="reAllocatedTo">
              <SelectTrigger>
                <SelectValue placeholder="Select an inspector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="insp in inspectors" :key="insp._id || insp.id" :value="insp.email">
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
          </div>
          <div class="space-y-2">
            <Label>Re-Inspection Date & Time</Label>
            <Input v-model="reInspectionDateTime" type="datetime-local" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showReInspectionDialog = false">
            Cancel
          </Button>
          <Button :disabled="!reAllocatedTo || !reInspectionDateTime || isUpdatingStatus" class="bg-blue-600 hover:bg-blue-700 text-white" @click="confirmReInspection">
            <Icon v-if="isUpdatingStatus" name="i-lucide-loader-2" class="mr-2 size-4 animate-spin" />
            Confirm Re-Inspection
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
@keyframes indeterminate {
  0% { transform: translateX(-100%) scaleX(0.2); }
  50% { transform: translateX(0%) scaleX(0.5); }
  100% { transform: translateX(200%) scaleX(0.2); }
}
</style>
