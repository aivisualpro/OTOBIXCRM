import { computed, shallowRef } from 'vue'
import { deduplicatedFetch, getCachedData, QUERY_KEYS, setCachedData } from '~/composables/useQueryCache'

export interface AuctionCar {
  [key: string]: any
  id: string
  _id?: string
  appointmentId: string
  imageUrl: string
  make: string
  model: string
  variant: string
  priceDiscovery: number
  yearMonthOfManufacture: string
  odometerReadingInKms: number
  ownerSerialNumber: number
  fuelType: string
  registrationNumber: string
  registeredRto: string
  registrationState: string
  registrationDate: string
  city: string
  isInspected: boolean
  cubicCapacity: number
  oneClickPrice: number
  otobuyOffer: number
  soldAt: number
  highestBid: number
  highestBidder: string
  auctionStartTime: string
  auctionEndTime: string
  auctionDuration: number
  auctionStatus: string
  upcomingTime: string | null
  upcomingUntil: string
  liveAt: string
  soldTo: string | null
  soldToName: string
  customerExpectedPrice: number
  imageUrls: { title: string, url: string }[]
  autoBidsForLiveSection?: any[]
}

interface LocalApiResponse {
  items: AuctionCar[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const PAGE_SIZE = 30

/** Centralized environment state so we know when to invalidate memory */
const _fetchedForEnv = import.meta.client ? window.sessionStorage.getItem('auctions_env') : null

export function useAuctionsApi() {
  const { currentEnv } = useApiEnvironment()

  const _cars = useState<AuctionCar[]>('auctions_data', () => shallowRef([]) as any)
  const _totalCount = useState<number>('auctions_total', () => 0)
  const _currentPage = useState<number>('auctions_page', () => 1)

  const _isInitialized = useState('auctions_isInitialized', () => false)
  const _isLoading = useState('auctions_isLoading', () => false)
  const _isLoadingMore = useState('auctions_isLoadingMore', () => false)
  const _isRefreshing = useState('auctions_isRefreshing', () => false)
  const _fetchError = useState<string | null>('auctions_fetchError', () => null)

  const _activeTab = useState<string>('auctions_activeTab', () => 'all')
  const _sortKey = useState<string>('auctions_sortKey', () => 'createdAt')
  const _sortDir = useState<'asc' | 'desc'>('auctions_sortDir', () => 'desc')
  const serverSearch = useState<string>('auctions_serverSearch', () => '')

  const _statusCounts = useState<Record<string, number>>('auctions_counts', () => ({}))

  // Fetch Cancellation wrapper
  const _fetchSeq = useState('auctions_fetchSeq', () => 0)
  const _abortController = shallowRef<AbortController | null>(null)

  function _newFetchSignal() {
    if (_abortController.value && !_abortController.value.signal.aborted) {
      _abortController.value.abort()
    }
    _abortController.value = new AbortController()
    return _abortController.value.signal
  }

  const hasMore = computed(() => _cars.value.length < _totalCount.value)
  const countsTotal = computed(() => _statusCounts.value.all || 0)

  // ─── Setters ───
  async function setTab(tab: string) {
    if (_activeTab.value === tab)
      return
    _activeTab.value = tab
    _currentPage.value = 1
    await fetchCars(true)
    fetchCounts()
  }

  async function setSort(key: string, dir: 'asc' | 'desc') {
    if (_sortKey.value === key && _sortDir.value === dir)
      return
    _sortKey.value = key
    _sortDir.value = dir
    _currentPage.value = 1
    await fetchCars(true)
  }

  const _similarSearchCtx = useState<{ make: string, model: string, year: string | number } | null>('auctions_similarSearch', () => null)

  function _buildFilterParams(): Record<string, string> {
    const route = useRoute()
    const currentModule = route.path.split('/')[1] || ''
    
    const params: Record<string, string> = { tab: _activeTab.value, module: currentModule }
    if (serverSearch.value)
      params.search = serverSearch.value
    if (_sortKey.value)
      params.sort = _sortKey.value
    if (_sortDir.value)
      params.sortDir = _sortDir.value
      
    if (_activeTab.value.startsWith('similar-search') && _similarSearchCtx.value) {
      params.similarMake = _similarSearchCtx.value.make
      params.similarModel = _similarSearchCtx.value.model
      params.similarYear = String(_similarSearchCtx.value.year || '')
    }
    return params
  }

  // ─── Fetch Counts (Background) ───
  async function fetchCounts() {
    try {
      const params = _buildFilterParams()
      params.t = String(Date.now())
      const queryKey = QUERY_KEYS.carsCount(params)
      const res = await deduplicatedFetch(queryKey, () =>
        $fetch<Record<string, number>>('/api/cars/counts', { params }))
      _statusCounts.value = res || {}
    }
    catch (e) {
      console.warn('Failed to fetch car counts', e)
    }
  }

  // ─── Data Fetching SWR ───
  async function fetchCars(force = false) {
    if (_isInitialized.value && !force)
      return
    if (_isLoading.value && !force)
      return

    _fetchError.value = null
    _fetchSeq.value++
    const currentSeq = _fetchSeq.value
    const signal = _newFetchSignal()

    const params: Record<string, any> = { page: 1, limit: PAGE_SIZE, ..._buildFilterParams() }
    const queryKey = QUERY_KEYS.cars(params) // Needs definition in useQueryCache

    // SWR Hydration
    const cachedData = getCachedData<LocalApiResponse>(queryKey)
    if (cachedData) {
      _cars.value = cachedData.items || []
      _totalCount.value = cachedData.total
      _currentPage.value = 1
      _isInitialized.value = true
      _isRefreshing.value = true
    }
    else {
      if (_cars.value.length === 0)
        _isLoading.value = true
      else _isRefreshing.value = true
    }

    try {
      const response = await deduplicatedFetch(queryKey, () =>
        $fetch<LocalApiResponse>('/api/cars', { params, signal }))

      if (_fetchSeq.value !== currentSeq)
        return

      _cars.value = response.items || []
      _totalCount.value = response.total
      _currentPage.value = 1
      _isInitialized.value = true

      if (import.meta.client) {
        window.sessionStorage.setItem('auctions_env', currentEnv.value)
      }

      setCachedData(queryKey, response)
      fetchCounts()
      _prefetchNextPage(2)
    }
    catch (err: any) {
      if (err?.name === 'AbortError' || signal.aborted)
        return
      console.error('Failed to fetch cars:', err)
      _fetchError.value = err?.data?.message || err?.message || 'Failed to fetch cars'
      if (_cars.value.length === 0)
        _cars.value = []
    }
    finally {
      if (!signal.aborted) {
        _isLoading.value = false
        _isRefreshing.value = false
      }
    }
  }

  async function loadMore() {
    if (_isLoadingMore.value || !hasMore.value)
      return
    _isLoadingMore.value = true

    try {
      const nextPage = _currentPage.value + 1
      const params: Record<string, any> = { page: nextPage, limit: PAGE_SIZE, ..._buildFilterParams() }
      const queryKey = QUERY_KEYS.cars(params)

      const response = await deduplicatedFetch(queryKey, () =>
        $fetch<LocalApiResponse>('/api/cars', { params }))

      _cars.value = [..._cars.value, ...(response.items || [])]
      _currentPage.value = nextPage
      _totalCount.value = response.total

      setCachedData(queryKey, response)
      _prefetchNextPage(nextPage + 1)
    }
    catch (err: any) {
      console.error('Failed to load more cars:', err)
    }
    finally {
      _isLoadingMore.value = false
    }
  }

  function _prefetchNextPage(targetPage: number) {
    if (_cars.value.length >= _totalCount.value)
      return
    const params: Record<string, any> = { page: targetPage, limit: PAGE_SIZE, ..._buildFilterParams() }
    const queryKey = QUERY_KEYS.cars(params)

    if (!getCachedData(queryKey)) {
      deduplicatedFetch(queryKey, () => $fetch<LocalApiResponse>('/api/cars', { params }))
        .then(res => setCachedData(queryKey, res))
        .catch(() => {})
    }
  }

  // ─── Server-side search ───

  async function searchCars(query: string) {
    serverSearch.value = query.trim()
    _currentPage.value = 1
    await fetchCars(true)
  }

  function cancelSearch() {
    serverSearch.value = ''
    _currentPage.value = 1
    fetchCars(true)
  }

  async function refreshCars() {
    await fetchCars(true)
    fetchCounts()
  }

  function setSimilarSearchCtx(ctx: { make: string, model: string, year: string | number } | null) {
    _similarSearchCtx.value = ctx
  }

  return {
    allCars: _cars,
    totalCount: _totalCount,
    statusCounts: _statusCounts,
    countsTotal,
    hasMore,
    isLoading: _isLoading,
    isLoadingMore: _isLoadingMore,
    isRefreshing: _isRefreshing,
    isFetched: _isInitialized,
    fetchError: _fetchError,

    activeTab: _activeTab,
    sortKey: _sortKey,
    sortDir: _sortDir,
    serverSearch,
    similarSearchCtx: _similarSearchCtx,

    setTab,
    setSimilarSearchCtx,
    setSort,
    fetchCars,
    refreshCars,
    loadMore,
    searchCars,
    cancelSearch,
    fetchCounts,

    // Alias to avoid renaming in templates immediately where possible
    globalSearch: serverSearch,
    fetchAllCars: fetchCars,
  }
}
