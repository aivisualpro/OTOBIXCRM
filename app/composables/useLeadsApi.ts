import { computed, shallowRef } from 'vue'
import { deduplicatedFetch, getCachedData, QUERY_KEYS, setCachedData } from '~/composables/useQueryCache'
import { routeFilters } from '~/constants/leads'

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
  items: TelecallingLead[]
  total: number
  totalPages: number
  page: number
  limit: number
}

// ... unchanged lines are kept by only matching the interface ...

interface CountsResponse {
  totalCount: number
  counts: Record<string, number>
}

// ─── Shared state key (PAGE_SIZE is safe at module level - just a constant) ───
const PAGE_SIZE = 25

// ─── Module-level abort controller to cancel previous in-flight fetches ───
let _activeAbortController: AbortController | null = null

function _cancelActiveFetch() {
  if (_activeAbortController) {
    _activeAbortController.abort()
    _activeAbortController = null
  }
}

function _newFetchSignal(): AbortSignal {
  _cancelActiveFetch()
  _activeAbortController = new AbortController()
  return _activeAbortController.signal
}

export function useLeadsApi() {
  // ─── Shallow state for large dataset (rule 14: shallow reactive for big data) ───
  // useState uses deep reactivity by default. For 2000+ row datasets,
  // we manually track a shallowRef inside useState to avoid deep proxy overhead.
  const _leads = useState<TelecallingLead[]>('leads_data', () => shallowRef([]) as any)
  const _fetchSeq = useState<number>('leads_fetch_seq', () => 0)
  const _advancedFilters = useState<Record<string, string>>('leads_advancedFilters', () => ({}))
  const _currentPage = useState('leads_currentPage', () => 0)
  const _totalCount = useState('leads_totalCount', () => 0)
  const _isLoading = useState('leads_isLoading', () => false)
  const _isLoadingMore = useState('leads_isLoadingMore', () => false)
  const _isRefreshing = useState('leads_isRefreshing', () => false)
  const _fetchError = useState<string | null>('leads_fetchError', () => null)
  const _isInitialized = useState('leads_isInitialized', () => false)
  const _fetchedForEnv = useState('leads_fetchedForEnv', () => '')
  const _serverSearch = useState('leads_serverSearch', () => '')
  const _activeTab = useState('leads_activeTab', () => 'all')
  const _counts = useState<Record<string, number>>('leads_counts', () => ({}))
  const _countsTotal = useState('leads_countsTotal', () => 0)
  // Cache of leads before a search — restored instantly on clear
  const _preSearchLeads = useState<TelecallingLead[] | null>('leads_preSearchCache', () => null)
  const _preSearchTotalCount = useState('leads_preSearchTotalCount', () => 0)
  const _sortKey = useState('leads_sortKey', () => '_id')
  const _sortDir = useState('leads_sortDir', () => 'desc')

  const { currentEnv } = useApiEnvironment()

  // ─── Normalize raw items ───
  function normalize(items: any[]): TelecallingLead[] {
    return items.map(item => ({
      ...item,
      id: item._id || item.id,
    }))
  }

  // ─── Build filter params (DRY helper) ───
  function _buildFilterParams(): Record<string, any> {
    const params: Record<string, any> = {}

    if (_serverSearch.value) {
      params.search = _serverSearch.value
    }

    if (_advancedFilters.value.startDate)
      params.startDate = _advancedFilters.value.startDate
    if (_advancedFilters.value.endDate)
      params.endDate = _advancedFilters.value.endDate
    if (_advancedFilters.value.dateField)
      params.dateField = _advancedFilters.value.dateField
    if (_advancedFilters.value.make)
      params.make = _advancedFilters.value.make
    if (_advancedFilters.value.city)
      params.city = _advancedFilters.value.city
    if (_advancedFilters.value.priority)
      params.priority = _advancedFilters.value.priority
    if (_advancedFilters.value.allocatedTo)
      params.allocatedTo = _advancedFilters.value.allocatedTo
    if (_advancedFilters.value.createdBy)
      params.createdBy = _advancedFilters.value.createdBy
    if (_advancedFilters.value.addedBy)
      params.addedBy = _advancedFilters.value.addedBy
    if (_activeTab.value)
      params.tab = _activeTab.value
    if (_sortKey.value)
      params.sort = _sortKey.value
    if (_sortDir.value)
      params.sortDir = _sortDir.value

    return params
  }

  // ─── Fetch counts (lightweight, runs independently) ───
  async function fetchCounts() {
    try {
      const params = _buildFilterParams()
      params.t = String(Date.now())
      const queryKey = QUERY_KEYS.leadsCount(params)
      const res = await deduplicatedFetch(queryKey, () =>
        $fetch<CountsResponse>('/api/leads/counts', { params }))
      _counts.value = res.counts || {}
      _countsTotal.value = res.totalCount || 0
    }
    catch (err: any) {
      console.error('Failed to fetch lead counts:', err)
    }
  }

  // ─── Initial load with SWR pattern ───
  // If data exists, show it immediately and refresh in background
  async function fetchLeads(force = false) {
    // If env changed, force reload
    if (_fetchedForEnv.value && _fetchedForEnv.value !== currentEnv.value) {
      force = true
    }
    if (_isInitialized.value && !force)
      return
    if (_isLoading.value && !force)
      return // Block concurrent fetches unless forced

    _fetchError.value = null
    _fetchSeq.value++
    const currentSeq = _fetchSeq.value
    const signal = _newFetchSignal()

    const params: Record<string, any> = { page: 1, limit: PAGE_SIZE, ..._buildFilterParams() }
    // Remove params.t because we WANT to reuse cache logically
    const queryKey = QUERY_KEYS.leads(params)

    // SWR: Check query cache for this EXACT combination (tab + page + sort, etc.)
    const cachedData = getCachedData<LocalApiResponse>(queryKey)
    if (cachedData) {
      _leads.value = normalize(cachedData.items || [])
      _totalCount.value = cachedData.total
      _currentPage.value = 1
      _isInitialized.value = true
      _isRefreshing.value = true // Show subtle loader
    }
    else {
      // Look if we have ANY existing data to hold visual stability (fallback)
      if (_leads.value.length === 0) {
        _isLoading.value = true
      }
      else {
        _isRefreshing.value = true
      }
    }

    try {
      const response = await deduplicatedFetch(queryKey, () =>
        $fetch<LocalApiResponse>('/api/leads', { params, signal }))

      // Bail if a newer fetch was initiated while we were waiting
      if (_fetchSeq.value !== currentSeq)
        return

      _leads.value = normalize(response.items || [])
      _totalCount.value = response.total
      _currentPage.value = 1
      _isInitialized.value = true
      _fetchedForEnv.value = currentEnv.value

      setCachedData(queryKey, response)

      // Fetch counts in background (non-blocking)
      fetchCounts()

      // Auto-prefetch page 2 for seamless scrolling feeling
      _prefetchNextPage(2)
    }
    catch (err: any) {
      if (err?.name === 'AbortError' || signal.aborted)
        return // Silently ignore cancelled requests
      console.error('Failed to fetch leads:', err)
      _fetchError.value = err?.data?.message || err?.message || 'Failed to fetch leads'
      // Keep stale data visible
      if (_leads.value.length === 0) {
        _leads.value = []
      }
    }
    finally {
      if (!signal.aborted) {
        _isLoading.value = false
        _isRefreshing.value = false
      }
    }
  }

  // ─── Load more (next page) ───
  async function loadMore() {
    if (_isLoadingMore.value)
      return
    if (_leads.value.length >= _totalCount.value)
      return

    _isLoadingMore.value = true
    try {
      const nextPage = _currentPage.value + 1
      const params: Record<string, any> = { page: nextPage, limit: PAGE_SIZE, ..._buildFilterParams() }
      const queryKey = QUERY_KEYS.leads(params)
      const response = await deduplicatedFetch(queryKey, () =>
        $fetch<LocalApiResponse>('/api/leads', { params }))
      const newItems = normalize(response.items || [])

      _leads.value = [..._leads.value, ...newItems]
      _currentPage.value = nextPage
      _totalCount.value = response.total // Keep in sync

      setCachedData(queryKey, response)

      // Auto-prefetch n+1 page in background
      _prefetchNextPage(nextPage + 1)
    }
    catch (err: any) {
      console.error('Failed to load more leads:', err)
    }
    finally {
      _isLoadingMore.value = false
    }
  }

  function _prefetchNextPage(targetPage: number) {
    if (_leads.value.length >= _totalCount.value)
      return
    const params: Record<string, any> = { page: targetPage, limit: PAGE_SIZE, ..._buildFilterParams() }
    const queryKey = QUERY_KEYS.leads(params)

    // Only prefetch if we don't already have it
    if (!getCachedData(queryKey)) {
      deduplicatedFetch(queryKey, () => $fetch<LocalApiResponse>('/api/leads', { params }))
        .then(res => setCachedData(queryKey, res))
        .catch(() => {})
    }
  }

  // ─── Server-side search ───
  let _searchDebounce: ReturnType<typeof setTimeout> | null = null

  function searchLeads(query: string) {
    if (_searchDebounce)
      clearTimeout(_searchDebounce)

    _serverSearch.value = query.trim()

    // Debounce 400ms before hitting server
    _searchDebounce = setTimeout(async () => {
      const signal = _newFetchSignal() // Cancel any previous in-flight fetch
      _isLoading.value = true
      _fetchError.value = null
      try {
        // ── Snapshot current leads before overwriting with search results ──
        if (!_preSearchLeads.value && _leads.value.length > 0) {
          _preSearchLeads.value = [..._leads.value]
          _preSearchTotalCount.value = _totalCount.value
        }

        const params: Record<string, any> = { page: 1, limit: PAGE_SIZE, ..._buildFilterParams() }
        params.t = String(Date.now())

        const queryKey = QUERY_KEYS.leads(params)
        const response = await deduplicatedFetch(queryKey, () =>
          $fetch<LocalApiResponse>('/api/leads', { params, signal }))
        if (signal.aborted)
          return
        _leads.value = normalize(response.items || [])
        _totalCount.value = response.total
        _currentPage.value = 1
        _isInitialized.value = true
      }
      catch (err: any) {
        if (err?.name === 'AbortError' || signal.aborted)
          return
        console.error('Search failed:', err)
        _fetchError.value = err?.data?.message || err?.message || 'Search failed'
      }
      finally {
        if (!signal.aborted) {
          _isLoading.value = false
        }
      }
    }, 400)
  }

  // ─── Force refresh ───
  function cancelSearch() {
    if (_searchDebounce) {
      clearTimeout(_searchDebounce)
      _searchDebounce = null
    }
  }

  async function refreshLeads() {
    cancelSearch()
    _serverSearch.value = ''

    // ── Instant restore from pre-search cache ──
    if (_preSearchLeads.value) {
      _leads.value = _preSearchLeads.value
      _totalCount.value = _preSearchTotalCount.value
      _isInitialized.value = true
      _preSearchLeads.value = null
      _preSearchTotalCount.value = 0
      // Silently refresh in background to pick up any changes made during search
      fetchLeads(true).catch(() => {})
      return
    }

    _isInitialized.value = false
    await fetchLeads(true)
  }

  // ─── Computed ───
  const hasMore = computed(() => _leads.value.length < _totalCount.value)

  // ─── Set server-side status filters ───
  function setTab(tab: string) {
    if (_activeTab.value !== tab) {
      _activeTab.value = tab

      // The user wants each tab to have its own page API call. Force refetch when tab changes.
      fetchLeads(true)
    }
  }

  function setSort(key: string, dir: string) {
    if (_sortKey.value !== key || _sortDir.value !== dir) {
      _sortKey.value = key
      _sortDir.value = dir
      fetchLeads(true)
    }
  }

  // ─── Client-side instant filter ───
  // Now simply acts as a passthrough since filtering is strictly server-side
  const filteredLeads = computed(() => {
    return _leads.value
  })

  // ─── Set advanced UI filters ───
  const activeAdvancedFilterCount = computed(() => {
    let count = 0
    if (_advancedFilters.value.startDate || _advancedFilters.value.endDate)
      count++
    if (_advancedFilters.value.make && _advancedFilters.value.make !== ' ')
      count++
    if (_advancedFilters.value.city && _advancedFilters.value.city !== ' ')
      count++
    if (_advancedFilters.value.priority && _advancedFilters.value.priority !== ' ')
      count++
    if (_advancedFilters.value.allocatedTo && _advancedFilters.value.allocatedTo !== ' ')
      count++
    return count
  })

  // ─── Matching tabs: which tabs contain records from search results ───
  const matchingTabIds = computed(() => {
    const hasSearch = !!_serverSearch.value
    const hasFilters = Object.values(_advancedFilters.value).some(v => !!v && String(v).trim() !== '')
    if (!hasSearch && !hasFilters)
      return [] as string[]

    const tabs = new Set<string>()
    for (const lead of _leads.value) {
      for (const [tabId, filter] of Object.entries(routeFilters)) {
        if (tabId === 'search-results')
          continue
        const inspMatch = filter.inspectionStatus === '*'
          || String(filter.inspectionStatus).trim().toLowerCase() === String(lead.inspectionStatus || '').trim().toLowerCase()
        const appMatch = filter.approvalStatus === '*'
          || String(filter.approvalStatus).trim().toLowerCase() === String(lead.approvalStatus || '').trim().toLowerCase()
        if (inspMatch && appMatch)
          tabs.add(tabId)
      }
    }
    return Array.from(tabs)
  })

  function setAdvancedFilters(filters: Record<string, string>) {
    _advancedFilters.value = { ...filters }
    _isInitialized.value = false
    _leads.value = []
    _totalCount.value = 0
    fetchLeads(true)
  }

  async function deleteLead(telecallingId: string) {
    const res = await $fetch<any>('/api/leads/delete', {
      method: 'POST',
      body: { telecallingId },
    })

    // Optimistic update — reassign array for shallow reactivity
    const idx = _leads.value.findIndex((l: any) => (l._id === telecallingId || l.id === telecallingId || l.appointmentId === telecallingId))
    if (idx >= 0) {
      _leads.value = _leads.value.filter((_: any, i: number) => i !== idx)
      _totalCount.value--
    }
    return res
  }

  return {
    // Data
    allLeads: filteredLeads,
    totalCount: _totalCount,
    hasMore,

    // Status counts (whole DB)
    statusCounts: _counts,
    countsTotal: _countsTotal,
    fetchCounts,

    // Loading states
    isLoading: _isLoading,
    isLoadingMore: _isLoadingMore,
    isRefreshing: _isRefreshing,
    isFetched: _isInitialized,
    fetchError: _fetchError,

    // Actions
    fetchLeads,
    loadMore,
    searchLeads,
    refreshLeads,
    deleteLead,
    sortKey: _sortKey,
    sortDir: _sortDir,
    setSort,
    setTab,
    filteredLeads,
    setAdvancedFilters,
    advancedFilters: _advancedFilters,
    activeAdvancedFilterCount,
    serverSearch: _serverSearch,
    cancelSearch,
    matchingTabIds,
  }
}
