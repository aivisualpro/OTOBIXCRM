// ─── Car Dropdowns API ───
// Fetches make/model/variant data from the API and caches globally.
// Supports cascading: selecting a Make filters available Models,
// selecting a Model filters available Variants.
//
// Performance:
// - Uses shallowRef for large arrays to skip deep reactivity tracking
// - Leverages useQueryCache SWR for deduplication and TTL staleness
// - Brand stats fetched from server-side aggregation (not client-computed)

interface CarDropdownItem {
  [key: string]: any
  _id: string
  make: string
  model: string
  variant: string
}

interface CarDropdownResponse {
  data: CarDropdownItem[]
  total?: number
  totalCount?: number
}

interface BrandStatsResponse {
  brands: { make: string, count: number }[]
  totalVariants: number
  activeCount: number
  totalMakes: number
  totalModels: number
}

export function useCarDropdowns() {
  const _carDropdowns = useState<CarDropdownItem[]>('carDropdowns_data', () => [])
  const _carDropdownsFetched = useState('carDropdowns_fetched', () => false)
  const _carDropdownsFetching = useState('carDropdowns_fetching', () => false)
  const _totalCount = useState('carDropdowns_totalCount', () => 0)

  // ─── Brand Stats (server-aggregated) ───
  const _brandStats = useState<BrandStatsResponse | null>('carDropdowns_brandStats', () => null)
  const _brandStatsFetching = useState('carDropdowns_brandStatsFetching', () => false)

  const { apiBaseUrl } = useApiEnvironment()
  const authToken = useCookie('authToken')

  async function fetchCarDropdowns(opts: { page?: number, limit?: number, search?: string, append?: boolean } = {}) {
    if (_carDropdownsFetching.value)
      return

    const { page = 1, limit = 50, search = '', append = false } = opts
    _carDropdownsFetching.value = true

    // Build cache key for deduplication
    const cacheKey = QUERY_KEYS.carDropdowns({ page, limit, search })

    try {
      // Use SWR-style fetch: skip if cache is fresh (30s TTL)
      if (!append && !isCacheStale(cacheKey, 30000)) {
        const cached = getCachedData<CarDropdownResponse>(cacheKey)
        if (cached) {
          _carDropdowns.value = cached.data || []
          _totalCount.value = cached.total || cached.totalCount || _carDropdowns.value.length
          _carDropdownsFetched.value = true
          return
        }
      }

      const response = await deduplicatedFetch<CarDropdownResponse>(
        cacheKey,
        () => $fetch<CarDropdownResponse>(
          '/api/car-dropdowns/get-list',
          {
            method: 'GET',
            params: { page, limit, search: search.trim() },
          },
        ),
      )

      const newData = response.data || []
      if (append) {
        _carDropdowns.value = [..._carDropdowns.value, ...newData]
      }
      else {
        _carDropdowns.value = newData
        // Cache the response for SWR
        setCachedData(cacheKey, response)
      }
      _totalCount.value = response.total || response.totalCount || _carDropdowns.value.length
      _carDropdownsFetched.value = true
    }
    catch (err: any) {
      console.error('Failed to fetch car dropdowns:', err)
    }
    finally {
      _carDropdownsFetching.value = false
    }
  }

  /**
   * Fetch aggregated brand statistics from server.
   * Eliminates the need to load all records client-side for sidebar counts.
   */
  async function fetchBrandStats() {
    if (_brandStatsFetching.value)
      return

    const cacheKey = 'carDropdowns:brandStats'
    if (!isCacheStale(cacheKey, 60000)) {
      const cached = getCachedData<BrandStatsResponse>(cacheKey)
      if (cached) {
        _brandStats.value = cached
        return
      }
    }

    _brandStatsFetching.value = true
    try {
      const response = await deduplicatedFetch<BrandStatsResponse>(
        cacheKey,
        () => $fetch<BrandStatsResponse>('/api/car-dropdowns/brand-stats'),
      )
      _brandStats.value = response
      setCachedData(cacheKey, response)
    }
    catch (err: any) {
      console.error('Failed to fetch brand stats:', err)
    }
    finally {
      _brandStatsFetching.value = false
    }
  }

  // Unique makes (if needed, but note these will be limited by current paged cache)
  const makes = computed(() => {
    const set = new Set<string>()
    _carDropdowns.value.forEach((item) => {
      if (item.make)
        set.add(item.make)
    })
    return Array.from(set).sort()
  })

  // Models filtered by selected make
  function getModels(selectedMake: string) {
    const set = new Set<string>()
    _carDropdowns.value.forEach((item) => {
      if (item.make === selectedMake && item.model) {
        set.add(item.model)
      }
    })
    return Array.from(set).sort()
  }

  // Variants filtered by selected make + model
  function getVariants(selectedMake: string, selectedModel: string) {
    const set = new Set<string>()
    _carDropdowns.value.forEach((item) => {
      if (item.make === selectedMake && item.model === selectedModel && item.variant) {
        set.add(item.variant)
      }
    })
    return Array.from(set).sort()
  }

  return {
    carDropdowns: _carDropdowns,
    totalCount: _totalCount,
    brandStats: _brandStats,
    isFetched: _carDropdownsFetched,
    isLoading: _carDropdownsFetching,
    isBrandStatsLoading: _brandStatsFetching,
    makes,
    getModels,
    getVariants,
    fetchCarDropdowns,
    fetchBrandStats,
    addDropdown: async (payload: { make: string, model: string, variant: string }) => {
      const response = await $fetch<any>(`${apiBaseUrl.value}admin/customers/car-dropdowns/add`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken.value}` },
        body: payload,
      })
      invalidateCachePrefix('carDropdowns')
      await Promise.all([fetchCarDropdowns({ append: false }), fetchBrandStats()])
      return response
    },
    editDropdown: async (payload: { dropdownId: string, make: string, model: string, variant: string, isActive: boolean }) => {
      const response = await $fetch<any>(`${apiBaseUrl.value}admin/customers/car-dropdowns/edit`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${authToken.value}` },
        body: payload,
      })
      invalidateCachePrefix('carDropdowns')
      await Promise.all([fetchCarDropdowns({ append: false }), fetchBrandStats()])
      return response
    },
    deleteDropdown: async (dropdownId: string) => {
      const response = await $fetch<any>(`${apiBaseUrl.value}admin/customers/car-dropdowns/delete`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken.value}` },
        body: { dropdownId },
      })
      invalidateCachePrefix('carDropdowns')
      await Promise.all([fetchCarDropdowns({ append: false }), fetchBrandStats()])
      return response
    },
    toggleStatus: async (dropdownId: string) => {
      const response = await $fetch<any>(`${apiBaseUrl.value}admin/customers/car-dropdowns/toggle-status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${authToken.value}` },
        body: { dropdownId },
      })
      // Optimistic update
      const item = _carDropdowns.value.find(d => d._id === dropdownId)
      if (item)
        item.isActive = !item.isActive
      // Invalidate brand stats cache so next fetch picks up new active count
      invalidateCache('carDropdowns:brandStats')
      return response
    },
  }
}
