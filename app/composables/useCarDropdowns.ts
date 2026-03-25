// ─── Car Dropdowns API ───
// Fetches make/model/variant data from the API and caches globally.
// Supports cascading: selecting a Make filters available Models,
// selecting a Model filters available Variants.

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

// Global cache
const _carDropdowns = ref<CarDropdownItem[]>([])
const _carDropdownsFetched = ref(false)
const _carDropdownsFetching = ref(false)
const _totalCount = ref(0)

export function useCarDropdowns() {
  const { apiBaseUrl } = useApiEnvironment()
  const authToken = useCookie('authToken')

  async function fetchCarDropdowns(opts: { page?: number, limit?: number, search?: string, append?: boolean } = {}) {
    if (_carDropdownsFetching.value)
      return

    const { page = 1, limit = 50, search = '', append = false } = opts
    _carDropdownsFetching.value = true

    try {
      const response = await $fetch<CarDropdownResponse>(
        `${apiBaseUrl.value}admin/customers/car-dropdowns/get-list`,
        {
          method: 'GET',
          params: { page, limit, search: search.trim() },
          headers: {
            Authorization: `Bearer ${authToken.value}`,
          },
        },
      )

      const newData = response.data || []
      if (append) {
        _carDropdowns.value = [..._carDropdowns.value, ...newData]
      }
      else {
        _carDropdowns.value = newData
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
    isFetched: _carDropdownsFetched,
    isLoading: _carDropdownsFetching,
    makes,
    getModels,
    getVariants,
    fetchCarDropdowns,
    addDropdown: async (payload: { make: string, model: string, variant: string }) => {
      const response = await $fetch<any>(`${apiBaseUrl.value}admin/customers/car-dropdowns/add`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken.value}` },
        body: payload,
      })
      await fetchCarDropdowns({ append: false })
      return response
    },
    editDropdown: async (payload: { dropdownId: string, make: string, model: string, variant: string, isActive: boolean }) => {
      const response = await $fetch<any>(`${apiBaseUrl.value}admin/customers/car-dropdowns/edit`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${authToken.value}` },
        body: payload,
      })
      await fetchCarDropdowns({ append: false })
      return response
    },
    deleteDropdown: async (dropdownId: string) => {
      const response = await $fetch<any>(`${apiBaseUrl.value}admin/customers/car-dropdowns/delete`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken.value}` },
        body: { dropdownId },
      })
      await fetchCarDropdowns({ append: false })
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
      return response
    },
  }
}
