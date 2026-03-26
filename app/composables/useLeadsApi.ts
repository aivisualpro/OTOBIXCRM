export interface TelecallingLead {
  [key: string]: any
  _id: string
  id: string
  appointmentId: string
  yearOfRegistration: string
  ownerName: string
  ownershipSerialNumber: number
  make: string
  model: string
  variant: string
  emailAddress: string
  appointmentSource: string
  vehicleStatus: string
  zipCode: string
  customerContactNumber: string
  city: string
  yearOfManufacture: string
  allocatedTo: string
  inspectionStatus: string
  approvalStatus: string
  priority: string
  ncdUcdName: string
  repName: string
  repContact: string
  bankSource: string
  referenceName: string
  remarks: string
  createdBy: string
  odometerReadingInKms: number
  additionalNotes: string
  carImages: string[]
  inspectionDateTime: string
  inspectionAddress: string
  inspectionEngineerNumber: string
  addedBy: string
  timeStamp: string
  createdAt: string
  updatedAt: string
}

interface LocalApiResponse {
  data: TelecallingLead[]
  totalCount: number
  totalPages: number
  page: number
  limit: number
}

interface CountsResponse {
  totalCount: number
  counts: Record<string, number>
}

// ─── Shared state (persists across route navigations) ───
const PAGE_SIZE = 100

const _leads = ref<TelecallingLead[]>([])
const _currentPage = ref(0) // Pages loaded so far
const _totalCount = ref(0) // Total matching records on server
const _isLoading = ref(false) // Initial load in progress
const _isLoadingMore = ref(false) // "Load more" in progress
const _fetchError = ref<string | null>(null)
const _isInitialized = ref(false)
const _fetchedForEnv = ref<string>('')
const _serverSearch = ref('') // Current server-side search term
const _statusFilters = ref<Record<string, string>>({}) // Server-side status filters

// Status group counts (whole database)
const _counts = ref<Record<string, number>>({})
const _countsTotal = ref(0)

export function useLeadsApi() {
  const { currentEnv } = useApiEnvironment()

  // ─── Normalize raw items ───
  function normalize(items: any[]): TelecallingLead[] {
    return items.map(item => ({
      ...item,
      id: item._id || item.id,
    }))
  }

  // ─── Fetch counts (lightweight, runs independently) ───
  async function fetchCounts() {
    try {
      const res = await $fetch<CountsResponse>('/api/leads/counts')
      _counts.value = res.counts || {}
      _countsTotal.value = res.totalCount || 0
    }
    catch (err: any) {
      console.error('Failed to fetch lead counts:', err)
    }
  }

  // ─── Initial load: first 100 leads ───
  async function fetchLeads(force = false) {
    // If env changed, force reload
    if (_fetchedForEnv.value && _fetchedForEnv.value !== currentEnv.value) {
      force = true
    }
    if (_isInitialized.value && !force) return
    if (_isLoading.value && !force) return

    _isLoading.value = true
    _fetchError.value = null

    try {
      const params: Record<string, any> = { page: 1, limit: PAGE_SIZE }
      if (_serverSearch.value) params.search = _serverSearch.value
      if (_statusFilters.value.inspectionStatus) params.inspectionStatus = _statusFilters.value.inspectionStatus
      if (_statusFilters.value.approvalStatus) params.approvalStatus = _statusFilters.value.approvalStatus

      const response = await $fetch<LocalApiResponse>('/api/leads', { params })

      _leads.value = normalize(response.data || [])
      _totalCount.value = response.totalCount
      _currentPage.value = 1
      _isInitialized.value = true
      _fetchedForEnv.value = currentEnv.value

      // Fetch counts in background (non-blocking)
      fetchCounts()
    }
    catch (err: any) {
      console.error('Failed to fetch leads:', err)
      _fetchError.value = err?.data?.message || err?.message || 'Failed to fetch leads'
      _leads.value = []
    }
    finally {
      _isLoading.value = false
    }
  }

  // ─── Load more (next page) ───
  async function loadMore() {
    if (_isLoadingMore.value) return
    if (_leads.value.length >= _totalCount.value) return

    _isLoadingMore.value = true
    try {
      const nextPage = _currentPage.value + 1
      const params: Record<string, any> = { page: nextPage, limit: PAGE_SIZE }
      if (_serverSearch.value) {
        params.search = _serverSearch.value
      }
      else {
        if (_statusFilters.value.inspectionStatus) params.inspectionStatus = _statusFilters.value.inspectionStatus
        if (_statusFilters.value.approvalStatus) params.approvalStatus = _statusFilters.value.approvalStatus
      }

      const response = await $fetch<LocalApiResponse>('/api/leads', { params })
      const newItems = normalize(response.data || [])

      _leads.value = [..._leads.value, ...newItems]
      _currentPage.value = nextPage
      _totalCount.value = response.totalCount // Keep in sync
    }
    catch (err: any) {
      console.error('Failed to load more leads:', err)
    }
    finally {
      _isLoadingMore.value = false
    }
  }

  // ─── Server-side search ───
  let _searchDebounce: ReturnType<typeof setTimeout> | null = null

  function searchLeads(query: string) {
    if (_searchDebounce) clearTimeout(_searchDebounce)
    _serverSearch.value = query.trim()

    // Debounce 300ms before hitting server
    _searchDebounce = setTimeout(async () => {
      _isLoading.value = true
      _fetchError.value = null
      try {
        const params: Record<string, any> = { page: 1, limit: PAGE_SIZE }
        if (_serverSearch.value) {
          // Global overriding behavior: search across all active queues
          params.search = _serverSearch.value
        }
        else {
          // Strictly apply tab filters seamlessly when not performing global search
          if (_statusFilters.value.inspectionStatus) params.inspectionStatus = _statusFilters.value.inspectionStatus
          if (_statusFilters.value.approvalStatus) params.approvalStatus = _statusFilters.value.approvalStatus
        }

        const response = await $fetch<LocalApiResponse>('/api/leads', { params })
        _leads.value = normalize(response.data || [])
        _totalCount.value = response.totalCount
        _currentPage.value = 1
      }
      catch (err: any) {
        console.error('Search failed:', err)
        _fetchError.value = err?.data?.message || err?.message || 'Search failed'
      }
      finally {
        _isLoading.value = false
      }
    }, 300)
  }

  // ─── Force refresh ───
  async function refreshLeads() {
    _serverSearch.value = ''
    _isInitialized.value = false
    await fetchLeads(true)
  }

  // ─── Computed ───
  const hasMore = computed(() => _leads.value.length < _totalCount.value)

  // ─── Set server-side status filters ───
  function setFilters(filters: Record<string, string>) {
    const newInsp = filters.inspectionStatus || ''
    const newAppr = filters.approvalStatus || ''
    const oldInsp = _statusFilters.value.inspectionStatus || ''
    const oldAppr = _statusFilters.value.approvalStatus || ''

    if (newInsp !== oldInsp || newAppr !== oldAppr) {
      _statusFilters.value = { ...filters }
      // Force reload with new filters
      _isInitialized.value = false
      fetchLeads(true)
    }
  }

  return {
    // Data
    allLeads: _leads,
    totalCount: _totalCount,
    hasMore,

    // Status counts (whole DB)
    statusCounts: _counts,
    countsTotal: _countsTotal,
    fetchCounts,

    // Loading states
    isLoading: _isLoading,
    isLoadingMore: _isLoadingMore,
    isFetched: _isInitialized,
    fetchError: _fetchError,

    // Actions
    fetchLeads,
    loadMore,
    searchLeads,
    refreshLeads,
    setFilters,
  }
}
