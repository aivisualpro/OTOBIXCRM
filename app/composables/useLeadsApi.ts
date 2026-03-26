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
  otherSource: string
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

// ─── Shared state key (PAGE_SIZE is safe at module level - just a constant) ───
const PAGE_SIZE = 100

export function useLeadsApi() {
  // useState keyed calls — safe inside composable, shared across all callers via key
  const _leads = useState<TelecallingLead[]>('leads_data', () => [])
  const _fetchSeq = useState<number>('leads_fetch_seq', () => 0)
  const _advancedFilters = useState<Record<string, string>>('leads_advancedFilters', () => ({}))
  const _currentPage = useState('leads_currentPage', () => 0)
  const _totalCount = useState('leads_totalCount', () => 0)
  const _isLoading = useState('leads_isLoading', () => false)
  const _isLoadingMore = useState('leads_isLoadingMore', () => false)
  const _fetchError = useState<string | null>('leads_fetchError', () => null)
  const _isInitialized = useState('leads_isInitialized', () => false)
  const _fetchedForEnv = useState('leads_fetchedForEnv', () => '')
  const _serverSearch = useState('leads_serverSearch', () => '')
  const _statusFilters = useState<Record<string, string>>('leads_statusFilters', () => ({}))
  const _counts = useState<Record<string, number>>('leads_counts', () => ({}))
  const _countsTotal = useState('leads_countsTotal', () => 0)

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
      const params: Record<string, string> = {}
      
      if (_serverSearch.value) {
        params.search = _serverSearch.value
      } else {
        if (_advancedFilters.value.startDate) params.startDate = _advancedFilters.value.startDate
        if (_advancedFilters.value.endDate) params.endDate = _advancedFilters.value.endDate
        if (_advancedFilters.value.dateField) params.dateField = _advancedFilters.value.dateField
        if (_advancedFilters.value.make) params.make = _advancedFilters.value.make
        if (_advancedFilters.value.city) params.city = _advancedFilters.value.city
        if (_advancedFilters.value.priority) params.priority = _advancedFilters.value.priority
        if (_advancedFilters.value.allocatedTo) params.allocatedTo = _advancedFilters.value.allocatedTo
        if (_advancedFilters.value.createdBy) params.createdBy = _advancedFilters.value.createdBy
        if (_advancedFilters.value.addedBy) params.addedBy = _advancedFilters.value.addedBy
      }

      const res = await $fetch<CountsResponse>('/api/leads/counts', { params })
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
    
    _fetchSeq.value++
    const currentSeq = _fetchSeq.value

    try {
      const params: Record<string, any> = { page: 1, limit: PAGE_SIZE }
      if (_serverSearch.value) {
        params.search = _serverSearch.value
      }
      else {
        if (_statusFilters.value.inspectionStatus) params.inspectionStatus = _statusFilters.value.inspectionStatus
        if (_statusFilters.value.approvalStatus) params.approvalStatus = _statusFilters.value.approvalStatus

        // Apply advanced UI filters
        if (_advancedFilters.value.startDate) params.startDate = _advancedFilters.value.startDate
        if (_advancedFilters.value.endDate) params.endDate = _advancedFilters.value.endDate
        if (_advancedFilters.value.dateField) params.dateField = _advancedFilters.value.dateField
        if (_advancedFilters.value.make) params.make = _advancedFilters.value.make
        if (_advancedFilters.value.city) params.city = _advancedFilters.value.city
        if (_advancedFilters.value.priority) params.priority = _advancedFilters.value.priority
        if (_advancedFilters.value.allocatedTo) params.allocatedTo = _advancedFilters.value.allocatedTo
        if (_advancedFilters.value.createdBy) params.createdBy = _advancedFilters.value.createdBy
        if (_advancedFilters.value.addedBy) params.addedBy = _advancedFilters.value.addedBy
      }

      const response = await $fetch<LocalApiResponse>('/api/leads', { params })

      // Bail if a newer fetch was initiated while we were waiting
      if (_fetchSeq.value !== currentSeq) return

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

        // Apply advanced UI filters
        if (_advancedFilters.value.startDate) params.startDate = _advancedFilters.value.startDate
        if (_advancedFilters.value.endDate) params.endDate = _advancedFilters.value.endDate
        if (_advancedFilters.value.dateField) params.dateField = _advancedFilters.value.dateField
        if (_advancedFilters.value.make) params.make = _advancedFilters.value.make
        if (_advancedFilters.value.city) params.city = _advancedFilters.value.city
        if (_advancedFilters.value.priority) params.priority = _advancedFilters.value.priority
        if (_advancedFilters.value.allocatedTo) params.allocatedTo = _advancedFilters.value.allocatedTo
        if (_advancedFilters.value.createdBy) params.createdBy = _advancedFilters.value.createdBy
        if (_advancedFilters.value.addedBy) params.addedBy = _advancedFilters.value.addedBy
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

          if (_advancedFilters.value.startDate) params.startDate = _advancedFilters.value.startDate
          if (_advancedFilters.value.endDate) params.endDate = _advancedFilters.value.endDate
          if (_advancedFilters.value.dateField) params.dateField = _advancedFilters.value.dateField
          if (_advancedFilters.value.make) params.make = _advancedFilters.value.make
          if (_advancedFilters.value.city) params.city = _advancedFilters.value.city
          if (_advancedFilters.value.priority) params.priority = _advancedFilters.value.priority
          if (_advancedFilters.value.allocatedTo) params.allocatedTo = _advancedFilters.value.allocatedTo
          if (_advancedFilters.value.createdBy) params.createdBy = _advancedFilters.value.createdBy
          if (_advancedFilters.value.addedBy) params.addedBy = _advancedFilters.value.addedBy
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
      _leads.value = [] // Instantly clear old tab data
      _totalCount.value = 0
      fetchLeads(true)
    }
  }

  // ─── Set advanced UI filters ───
  const activeAdvancedFilterCount = computed(() => {
    let count = 0
    if (_advancedFilters.value.startDate || _advancedFilters.value.endDate) count++
    if (_advancedFilters.value.make && _advancedFilters.value.make !== ' ') count++
    if (_advancedFilters.value.city && _advancedFilters.value.city !== ' ') count++
    if (_advancedFilters.value.priority && _advancedFilters.value.priority !== ' ') count++
    if (_advancedFilters.value.allocatedTo && _advancedFilters.value.allocatedTo !== ' ') count++
    return count
  })

  function setAdvancedFilters(filters: Record<string, string>) {
    _advancedFilters.value = { ...filters }
    _isInitialized.value = false
    _leads.value = []
    _totalCount.value = 0
    fetchLeads(true)
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
    setAdvancedFilters,
    advancedFilters: _advancedFilters,
    activeAdvancedFilterCount,
  }
}
